const express = require('express');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const WebSocket = require('ws');
const PluginManager = require('./plugin-manager');

// Enhanced ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m'
};

class App {
  constructor(options = {}) {
    this.options = {
      port: 3000,
      wsPort: 3008,
      viewsDir: 'views',
      staticDir: 'public',
      routesDir: 'routes',
      isDev: false,
      watchDirs: ['views', 'routes', 'public'],
      errorLog: 'error.log',
      showStack: true,
      // Plugin configuration
      plugins: {
        enabled: true,
        autoLoad: true,
        pluginsDir: 'plugins'
      },
      prefetch: {
        enabled: true,
        maxConcurrent: 3,
        notifyUser: true,
        cacheRoutes: true,
        prefetchDelay: 1000
      },
      ...options
    };
    
    this.express = express();
    this.wss = null;
    this.watchers = [];
    this.routeMap = new Map();
    this.dynamicRoutes = new Map();
    
    // Initialize plugin manager
    if (this.options.plugins.enabled) {
      this.plugins = new PluginManager(this, this.options.plugins);
    }
    
    this.init();
  }

  // ============= ULTRA BEAUTIFUL LOGGING SYSTEM =============
  log(type, message, details = '') {
    const timestamp = new Date().toLocaleTimeString('en-US');
    const prefix = `${colors.gray}[${timestamp}]${colors.reset}`;
    
    const logStyles = {
      success: {
        badge: `${colors.bgGreen}${colors.white} ✨ `,
        text: `${colors.green}${colors.bright}`,
        icon: '🎉'
      },
      error: {
        badge: `${colors.bgRed}${colors.white} 💥 `,
        text: `${colors.red}${colors.bright}`,
        icon: '❌'
      },
      warning: {
        badge: `${colors.bgYellow}${colors.white} ⚡ `,
        text: `${colors.yellow}${colors.bright}`,
        icon: '⚠️'
      },
      info: {
        badge: `${colors.bgBlue}${colors.white} 💎 `,
        text: `${colors.blue}${colors.bright}`,
        icon: 'ℹ️'
      },
      server: {
        badge: `${colors.bgMagenta}${colors.white} 🚀 `,
        text: `${colors.magenta}${colors.bright}`,
        icon: '🌟'
      },
      route: {
        badge: `${colors.bgCyan}${colors.white} 🌐 `,
        text: `${colors.cyan}${colors.bright}`,
        icon: '🔗'
      },
      dev: {
        badge: `${colors.bgBlue}${colors.white} 🛠️ `,
        text: `${colors.blue}${colors.bright}`,
        icon: '⚙️'
      },
      file: {
        badge: `${colors.bgGreen}${colors.white} 📁 `,
        text: `${colors.green}${colors.bright}`,
        icon: '📂'
      },
      reload: {
        badge: `${colors.bgYellow}${colors.white} 🔄 `,
        text: `${colors.yellow}${colors.bright}`,
        icon: '🔄'
      },
      create: {
        badge: `${colors.bgGreen}${colors.white} ➕ `,
        text: `${colors.green}${colors.bright}`,
        icon: '✅'
      },
      delete: {
        badge: `${colors.bgRed}${colors.white} 🗑️ `,
        text: `${colors.red}${colors.bright}`,
        icon: '🗑️'
      }
    };

    const style = logStyles[type] || logStyles.info;
    
    console.log(
      `${prefix} ${style.badge}${colors.reset} ${style.text}${message}${colors.reset} ${colors.dim}${details}${colors.reset}`
    );
  }

  // ============= INITIALIZATION =============
  init() {
    this.setupExpress();
    
    // Execute initialization hook
    if (this.plugins) {
      this.plugins.executeHook('app:init', this);
    }
    
    if (this.options.isDev) {
      this.setupDevMode();
    }
  }

  setupExpress() {
    // Express + EJS configuration
    this.express.set('view engine', 'ejs');
    this.express.set('views', [
      path.join(process.cwd(), this.options.viewsDir),
      path.join(__dirname, '..', 'views'),
      path.join(__dirname, '..', 'error')
    ]);
    
    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(express.static(path.join(process.cwd(), this.options.staticDir)));

    // Dev middleware if enabled
    if (this.options.isDev) {
      this.express.use(this.devMiddleware());
      this.express.use(this.injectReloadScript());
    }

    this.log('success', 'Express configuration initialized', '⚡ Ready to start');
  }

  // ============= DYNAMIC ROUTE CREATION AND DELETION =============
  
  /**
   * Creates a new route dynamically
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {string} path - Route path
   * @param {Function|Array} handler - Handler or array of middlewares + handler
   * @param {Object} options - Additional options
   */
  createRoute(method, path, handler, options = {}) {
    try {
      method = method.toLowerCase();
      
      // Before creation hook
      if (this.plugins) {
        this.plugins.executeHook('route:create', method, path, handler, options);
      }

      // Check if route already exists
      if (this.routeExists(method, path)) {
        this.log('warning', 'Route already exists', `${method.toUpperCase()} ${path}`);
        return this;
      }

      // Create the route
      if (Array.isArray(handler)) {
        this.express[method](path, ...handler);
      } else {
        this.express[method](path, handler);
      }

      // Register dynamic route
      const routeKey = `${method}:${path}`;
      this.dynamicRoutes.set(routeKey, {
        method,
        path,
        handler,
        options,
        createdAt: new Date().toISOString()
      });

      this.log('create', 'Route created dynamically', `${method.toUpperCase()} ${path}`);
      
      // After creation hook
      if (this.plugins) {
        this.plugins.executeHook('route:created', method, path, handler, options);
      }
      
      // Notify via WebSocket if in dev mode
      if (this.options.isDev && this.wss) {
        this.broadcast({
          type: 'route-created',
          method: method.toUpperCase(),
          path,
          timestamp: new Date().toISOString()
        });
      }

      return this;
    } catch (error) {
      this.log('error', 'Error creating route', `${method?.toUpperCase()} ${path} → ${error.message}`);
      return this;
    }
  }

  /**
   * Deletes a route dynamically
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   */
  deleteRoute(method, path) {
    try {
      method = method.toLowerCase();
      const routeKey = `${method}:${path}`;

      // Check if route exists
      if (!this.dynamicRoutes.has(routeKey) && !this.routeExists(method, path)) {
        this.log('warning', 'Route not found', `${method.toUpperCase()} ${path}`);
        return this;
      }

      // Remove route from Express router
      this.removeRouteFromRouter(method, path);

      // Remove from our registry
      this.dynamicRoutes.delete(routeKey);

      this.log('delete', 'Route deleted dynamically', `${method.toUpperCase()} ${path}`);
      
      // Notify via WebSocket if in dev mode
      if (this.options.isDev && this.wss) {
        this.broadcast({
          type: 'route-deleted',
          method: method.toUpperCase(),
          path,
          timestamp: new Date().toISOString()
        });
      }

      return this;
    } catch (error) {
      this.log('error', 'Error deleting route', `${method?.toUpperCase()} ${path} → ${error.message}`);
      return this;
    }
  }

  /**
   * Updates an existing route
   * @param {string} method - HTTP method
   * @param {string} path - Route path
   * @param {Function|Array} newHandler - New handler
   */
  updateRoute(method, path, newHandler) {
    try {
      this.deleteRoute(method, path);
      this.createRoute(method, path, newHandler);
      
      this.log('reload', 'Route updated', `${method.toUpperCase()} ${path}`);
      return this;
    } catch (error) {
      this.log('error', 'Error updating route', `${method?.toUpperCase()} ${path} → ${error.message}`);
      return this;
    }
  }

  /**
   * Creates a physical route file
   * @param {string} routePath - Route path (e.g. /users/profile)
   * @param {Object} handlers - Handlers for different HTTP methods
   * @param {Object} options - Additional options
   */
  createRouteFile(routePath, handlers, options = {}) {
    try {
      // Convert route path to file path
      const filePath = this.routeToFilePath(routePath);
      const fullPath = path.join(process.cwd(), this.options.routesDir, filePath);
      
      // Create directory if necessary
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log('create', 'Directory created', `📁 ${path.relative(process.cwd(), dir)}`);
      }

      // Generate file content
      const fileContent = this.generateRouteFileContent(handlers, options);
      
      // Write file
      fs.writeFileSync(fullPath, fileContent, 'utf8');
      
      const relativePath = path.relative(process.cwd(), fullPath);
      this.log('create', 'Route file created', `📄 ${relativePath}`);
      
      // Load route automatically
      setTimeout(() => {
        const routesPath = path.join(process.cwd(), this.options.routesDir);
        this.loadRouteFile(fullPath, routesPath);
      }, 100);

      return this;
    } catch (error) {
      this.log('error', 'Error creating route file', error.message);
      return this;
    }
  }

  /**
   * Deletes a physical route file
   * @param {string} routePath - Route path
   */
  deleteRouteFile(routePath) {
    try {
      const filePath = this.routeToFilePath(routePath);
      const fullPath = path.join(process.cwd(), this.options.routesDir, filePath);
      
      if (fs.existsSync(fullPath)) {
        // Remove route from router first
        this.removeRouteFromExpress(fullPath);
        this.routeMap.delete(fullPath);
        
        // Delete file
        fs.unlinkSync(fullPath);
        
        const relativePath = path.relative(process.cwd(), fullPath);
        this.log('delete', 'Route file deleted', `📄 ${relativePath}`);
        
        return this;
      } else {
        this.log('warning', 'Route file not found', `📄 ${filePath}`);
        return this;
      }
    } catch (error) {
      this.log('error', 'Error deleting route file', error.message);
      return this;
    }
  }

  // ============= ROUTE UTILITY METHODS =============
  
  /**
   * Checks if a route exists
   */
  routeExists(method, path) {
    if (!this.express._router) return false;
    
    return this.express._router.stack.some(layer => {
      if (layer.route) {
        const routeMethods = Object.keys(layer.route.methods);
        return layer.route.path === path && routeMethods.includes(method.toLowerCase());
      }
      return false;
    });
  }

  /**
   * Removes a route from Express router
   */
  removeRouteFromRouter(method, path) {
    if (!this.express._router) return;
    
    this.express._router.stack = this.express._router.stack.filter(layer => {
      if (layer.route) {
        const routeMethods = Object.keys(layer.route.methods);
        const shouldRemove = layer.route.path === path && routeMethods.includes(method.toLowerCase());
        
        if (shouldRemove) {
          this.log('dev', 'Route removed from Express router', `🗑️ ${method.toUpperCase()} ${path}`);
        }
        
        return !shouldRemove;
      }
      return true;
    });
  }

  /**
   * Converts a route path to file path
   */
  routeToFilePath(routePath) {
    let filePath = routePath
      .replace(/^\//, '') // Remove initial slash
      .replace(/\/$/, '') // Remove final slash
      .replace(/:/g, '[') // Convert :param to [param
      .replace(/([^[\]]+)(?=\/|$)/g, (match, param) => {
        if (match.startsWith('[')) {
          return match + ']';
        }
        return match;
      });
    
    if (!filePath) filePath = 'index';
    if (!filePath.endsWith('.js')) filePath += '.js';
    
    return filePath;
  }

  /**
   * Generates route file content
   */
  generateRouteFileContent(handlers, options = {}) {
    const { description = '', middleware = [] } = options;
    
    let content = `// Route automatically generated by Veko.js\n`;
    if (description) {
      content += `// ${description}\n`;
    }
    content += `// Created on: ${new Date().toLocaleString('en-US')}\n\n`;
    
    if (middleware.length > 0) {
      content += `// Custom middleware\n`;
      middleware.forEach((mw, index) => {
        content += `const middleware${index + 1} = ${mw.toString()};\n`;
      });
      content += '\n';
    }
    
    content += `module.exports = {\n`;
    
    Object.entries(handlers).forEach(([method, handler]) => {
      content += `  // ${method.toUpperCase()} handler\n`;
      content += `  ${method}: `;
      
      if (middleware.length > 0) {
        content += `[${middleware.map((_, i) => `middleware${i + 1}`).join(', ')}, `;
        content += `${handler.toString()}],\n\n`;
      } else {
        content += `${handler.toString()},\n\n`;
      }
    });
    
    content += `};\n`;
    
    return content;
  }

  /**
   * Lists all routes (files + dynamic)
   */
  listRoutes() {
    const routes = [];
    
    // File routes
    this.routeMap.forEach((routePath, filePath) => {
      routes.push({
        type: 'file',
        path: routePath,
        source: path.relative(process.cwd(), filePath),
        methods: this.getRouteMethods(routePath)
      });
    });
    
    // Dynamic routes
    this.dynamicRoutes.forEach((routeInfo, routeKey) => {
      routes.push({
        type: 'dynamic',
        path: routeInfo.path,
        method: routeInfo.method.toUpperCase(),
        createdAt: routeInfo.createdAt
      });
    });
    
    return routes;
  }

  /**
   * Gets HTTP methods for a given route
   */
  getRouteMethods(routePath) {
    if (!this.express._router) return [];
    
    const methods = [];
    this.express._router.stack.forEach(layer => {
      if (layer.route && layer.route.path === routePath) {
        methods.push(...Object.keys(layer.route.methods).map(m => m.toUpperCase()));
      }
    });
    
    return [...new Set(methods)];
  }

  // ============= DEVELOPMENT MODE =============
  setupDevMode() {
    this.log('dev', 'Development mode activated', '🔥 Hot reload & WebSocket');
    this.setupErrorHandling();
    this.setupWebSocketServer();
    this.setupFileWatching();
  }

  setupErrorHandling() {
    process.on('uncaughtException', (error) => {
      this.log('error', 'Uncaught exception', error.message);
      if (this.wss) {
        this.broadcast({ type: 'error', message: error.message, stack: error.stack });
      }
    });
    
    process.on('unhandledRejection', (reason) => {
      this.log('error', 'Unhandled rejection', reason.toString());
      if (this.wss) {
        this.broadcast({ type: 'error', message: reason.toString() });
      }
    });
  }

  setupWebSocketServer() {
    this.wss = new WebSocket.Server({ port: this.options.wsPort });
    
    this.wss.on('connection', (ws) => {
      this.log('dev', 'Client connected', `WebSocket on port ${this.options.wsPort}`);
      
      ws.send(JSON.stringify({ 
        type: 'connected', 
        message: 'Connected to Veko.js server ✨' 
      }));

      // Send available routes for prefetching
      if (this.options.prefetch.enabled) {
        this.sendAvailableRoutes(ws);
      }
    });
  }

  setupFileWatching() {
    const watchPaths = this.options.watchDirs.map(dir => 
      path.join(process.cwd(), dir)
    );
    
    watchPaths.forEach(watchPath => {
      if (fs.existsSync(watchPath)) {
        const watcher = chokidar.watch(watchPath, {
          ignored: /node_modules/,
          persistent: true,
          ignoreInitial: true
        });
        
        watcher.on('change', (filePath) => {
          this.handleFileChange(filePath);
        });
        
        watcher.on('add', (filePath) => {
          this.log('file', 'File added', `➕ ${path.relative(process.cwd(), filePath)}`);
          if (this.isRouteFile(filePath)) {
            this.reloadSpecificRoute(filePath);
          } else {
            this.broadcast({ type: 'reload' });
          }
        });
        
        watcher.on('unlink', (filePath) => {
          this.log('file', 'File deleted', `🗑️ ${path.relative(process.cwd(), filePath)}`);
          if (this.isRouteFile(filePath)) {
            this.removeRoute(filePath);
          } else {
            this.broadcast({ type: 'reload' });
          }
        });
        
        this.watchers.push(watcher);
      }
    });
  }

  // ============= INTELLIGENT RELOAD MANAGEMENT =============
  handleFileChange(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    this.log('file', 'File modified', `📝 ${relativePath}`);
    
    if (this.isRouteFile(filePath)) {
      this.reloadSpecificRoute(filePath);
    } else if (this.isViewFile(filePath)) {
      // For views, we can do a light reload
      this.broadcast({ 
        type: 'view-reload', 
        file: relativePath 
      });
      this.log('reload', 'View reloaded', `🎨 ${relativePath}`);
    } else {
      // For other files (CSS, client JS), full reload
      this.broadcast({ type: 'reload' });
    }
  }

  isRouteFile(filePath) {
    const routesPath = path.join(process.cwd(), this.options.routesDir);
    return filePath.startsWith(routesPath) && filePath.endsWith('.js');
  }

  isViewFile(filePath) {
    const viewsPath = path.join(process.cwd(), this.options.viewsDir);
    return filePath.startsWith(viewsPath) && filePath.endsWith('.ejs');
  }

  reloadSpecificRoute(filePath) {
    try {
      // Clear require cache
      delete require.cache[require.resolve(filePath)];
      
      // Remove old route from Express router
      this.removeRouteFromExpress(filePath);
      
      // Reload new route
      const routesPath = path.join(process.cwd(), this.options.routesDir);
      this.loadRouteFile(filePath, routesPath);
      
      const relativePath = path.relative(process.cwd(), filePath);
      this.log('reload', 'Route reloaded', `🔄 ${relativePath}`);
      
      // Notify client that this specific route has been reloaded
      this.broadcast({ 
        type: 'route-reload', 
        file: relativePath,
        route: this.routeMap.get(filePath)
      });
      
    } catch (error) {
      this.log('error', 'Error reloading route', error.message);
      // In case of error, do a full reload
      this.broadcast({ type: 'reload' });
    }
  }

  removeRouteFromExpress(filePath) {
    // Get route associated with this file
    const routePath = this.routeMap.get(filePath);
    
    if (routePath && this.express._router) {
      // Filter layers to remove those corresponding to this route
      this.express._router.stack = this.express._router.stack.filter(layer => {
        if (layer.route && layer.route.path === routePath) {
          this.log('dev', 'Route removed from router', `🗑️ ${routePath}`);
          return false;
        }
        return true;
      });
    }
  }

  removeRoute(filePath) {
    this.removeRouteFromExpress(filePath);
    this.routeMap.delete(filePath);
    
    const relativePath = path.relative(process.cwd(), filePath);
    this.log('route', 'Route removed', `🗑️ ${relativePath}`);
    
    this.broadcast({ 
      type: 'route-removed', 
      file: relativePath 
    });
  }

  // ============= ROUTE LOADING =============
  loadRoutes(routesDir = this.options.routesDir) {
    const routesPath = path.join(process.cwd(), routesDir);
    
    if (!fs.existsSync(routesPath)) {
      this.log('warning', 'Routes directory not found', `📁 ${routesDir}`);
      this.createDefaultRoute();
      return this;
    }

    this.log('info', 'Scanning routes...', `📂 ${routesDir}`);
    this.scanDirectory(routesPath, routesPath);
    return this;
  }

  scanDirectory(dirPath, basePath) {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        this.scanDirectory(filePath, basePath);
      } else if (file.endsWith('.js')) {
        this.loadRouteFile(filePath, basePath);
      }
    });
  }

  loadRouteFile(filePath, basePath) {
    try {
      delete require.cache[require.resolve(filePath)];
      const routeModule = require(filePath);
      
      const relativePath = path.relative(basePath, filePath);
      const routePath = this.filePathToRoute(relativePath);
      
      // Register file -> route mapping
      this.routeMap.set(filePath, routePath);
      
      if (typeof routeModule === 'function') {
        routeModule(this.express);
      } else if (routeModule.router) {
        this.express.use(routePath, routeModule.router);
      } else if (routeModule.get || routeModule.post || routeModule.put || routeModule.delete) {
        this.setupRouteHandlers(routePath, routeModule);
      }
      
      const fileName = path.basename(filePath);
      this.log('route', 'Route loaded', `${fileName} → ${routePath}`);
    } catch (error) {
      const fileName = path.basename(filePath);
      this.log('error', 'Failed to load', `${fileName} → ${error.message}`);
    }
  }

  createDefaultRoute() {
    this.express.get('/', (req, res) => {
      res.render('index', { 
        title: 'Veko.js - Ultra modern framework',
        message: 'Welcome to Veko.js! 🚀' 
      });
    });
    
    this.log('route', 'Default route created', '🏠 GET /');
  }

  filePathToRoute(filePath) {
    let route = filePath
      .replace(/\\/g, '/')
      .replace(/\.js$/, '')
      .replace(/\/index$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1');
    
    if (!route.startsWith('/')) {
      route = '/' + route;
    }
    
    return route === '/' ? '/' : route;
  }

  setupRouteHandlers(routePath, handlers) {
    if (handlers.get) this.express.get(routePath, handlers.get);
    if (handlers.post) this.express.post(routePath, handlers.post);
    if (handlers.put) this.express.put(routePath, handlers.put);
    if (handlers.delete) this.express.delete(routePath, handlers.delete);
    if (handlers.patch) this.express.patch(routePath, handlers.patch);
  }

  // ============= DEVELOPMENT MIDDLEWARE =============
  devMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        
        let logType = 'info';
        if (status >= 400) logType = 'error';
        else if (status >= 300) logType = 'warning';
        else logType = 'success';
        
        this.log(logType, `${req.method} ${req.url}`, `${status} - ${duration}ms`);
      });
      
      next();
    };
  }

  // Enhanced hot reload injection script
  injectReloadScript() {
    return (req, res, next) => {
      const originalSend = res.send;
      
      res.send = function(body) {
        if (typeof body === 'string' && body.includes('</body>')) {
          const reloadScript = `
            <script>
              (function() {
                const ws = new WebSocket('ws://localhost:${req.app.locals.wsPort || 3008}');
                
                ws.onopen = () => console.log('🔗 Veko.js connected');
                ws.onmessage = (event) => {
                  const data = JSON.parse(event.data);
                  
                  switch(data.type) {
                    case 'reload':
                      console.log('🔄 Full reload...');
                      setTimeout(() => window.location.reload(), 300);
                      break;
                      
                    case 'route-reload':
                      console.log('🔄 Route reloaded:', data.route);
                      // If we're on this route, reload
                      if (window.location.pathname === data.route) {
                        setTimeout(() => window.location.reload(), 300);
                      }
                      break;
                      
                    case 'route-created':
                      console.log('➕ Route created:', data.method, data.path);
                      break;
                      
                    case 'route-deleted':
                      console.log('🗑️ Route deleted:', data.method, data.path);
                      break;
                      
                    case 'view-reload':
                      console.log('🎨 View reloaded:', data.file);
                      // Reload only if it's a view
                      setTimeout(() => window.location.reload(), 300);
                      break;
                      
                    case 'route-removed':
                      console.log('🗑️ Route removed:', data.file);
                      break;
                  }
                };
                ws.onclose = () => console.log('🔌 Veko.js disconnected');
              })();
            </script>
          `;
          body = body.replace('</body>', `${reloadScript}</body>`);
        }
        return originalSend.call(this, body);
      };
      
      next();
    };
  }

  // ============= UTILITY METHODS =============
  sendAvailableRoutes(ws) {
    const routes = this.collectAvailableRoutes();
    
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'routes',
        routes: routes,
        config: this.options.prefetch
      }));
      this.log('dev', 'Routes sent for prefetching', `📋 ${routes.length} routes`);
    }, this.options.prefetch.prefetchDelay);
  }

  collectAvailableRoutes() {
    const routes = ['/'];
    
    try {
      const stack = this.express._router?.stack || [];
      stack.forEach(layer => {
        if (layer.route) {
          const path = layer.route.path;
          if (path && !routes.includes(path)) {
            routes.push(path);
          }
        }
      });
    } catch (error) {
      // Ignore errors
    }
    
    return [...new Set(routes)];
  }

  broadcast(data) {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    }
  }

  use(middleware) {
    this.express.use(middleware);
    return this;
  }

  // ============= SERVER STARTUP =============
  listen(port = this.options.port) {
    return this.express.listen(port, async () => {
      console.log('\n' + '═'.repeat(60));
      console.log(`${colors.magenta}${colors.bright}
   ╔══════════════════════════════════════════════════════╗
   ║                    🚀 VEKO.JS 🚀                     ║
   ╚══════════════════════════════════════════════════════╝${colors.reset}`);
      
      this.log('server', 'Server started successfully', `🌐 http://localhost:${port}`);
      
      if (this.options.isDev) {
        this.log('dev', 'Development mode active', `🔥 Smart hot reload on port ${this.options.wsPort}`);
      }

      // Display plugin stats
      if (this.plugins) {
        const stats = this.plugins.getStats();
        this.log('info', 'Plugin system', `🔌 ${stats.active}/${stats.total} plugins active`);
      }
      
      // Execute startup hook
      if (this.plugins) {
        await this.plugins.executeHook('app:start', this, port);
      }
      
      console.log('═'.repeat(60) + '\n');
    });
  }

  // Method to start in dev mode
  startDev(port = this.options.port) {
    this.options.isDev = true;
    this.setupDevMode();
    this.loadRoutes();
    return this.listen(port);
  }

  // Method to stop the server
  stop() {
    // Execute stop hook
    if (this.plugins) {
      this.plugins.executeHook('app:stop', this);
    }

    this.watchers.forEach(watcher => watcher.close());
    if (this.wss) this.wss.close();
    this.log('server', 'Server stopped', '🛑 Goodbye!');
  }
}

module.exports = App;