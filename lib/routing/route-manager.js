const path = require('path');
const fs = require('fs');

class RouteManager {
  constructor(app, options) {
    this.app = app;
    this.options = options;
    this.routeMap = new Map();
    this.dynamicRoutes = new Map();
  }

  createRoute(method, path, handler, options = {}) {
    try {
      method = method.toLowerCase();
      
      if (this.app.plugins) {
        this.app.plugins.executeHook('route:create', method, path, handler, options);
      }

      if (this.routeExists(method, path)) {
        this.app.logger.log('warning', 'Route already exists', `${method.toUpperCase()} ${path}`);
        return this.app;
      }

      if (Array.isArray(handler)) {
        this.app.app[method](path, ...handler);
      } else {
        this.app.app[method](path, handler);
      }

      const routeKey = `${method}:${path}`;
      this.dynamicRoutes.set(routeKey, {
        method,
        path,
        handler,
        options,
        createdAt: new Date().toISOString()
      });

      this.app.logger.log('create', 'Route created dynamically', `${method.toUpperCase()} ${path}`);
      
      if (this.app.plugins) {
        this.app.plugins.executeHook('route:created', method, path, handler, options);
      }
      
      if (this.app.options.isDev && this.app.devServer) {
        this.app.devServer.broadcast({
          type: 'route-created',
          method: method.toUpperCase(),
          path,
          timestamp: new Date().toISOString()
        });
      }

      return this.app;
    } catch (error) {
      this.app.logger.log('error', 'Error creating route', `${method?.toUpperCase()} ${path} → ${error.message}`);
      return this.app;
    }
  }

  deleteRoute(method, path) {
    try {
      method = method.toLowerCase();
      const routeKey = `${method}:${path}`;

      if (!this.dynamicRoutes.has(routeKey) && !this.routeExists(method, path)) {
        this.app.logger.log('warning', 'Route not found', `${method.toUpperCase()} ${path}`);
        return this.app;
      }

      this.removeRouteFromRouter(method, path);
      this.dynamicRoutes.delete(routeKey);

      this.app.logger.log('delete', 'Route deleted dynamically', `${method.toUpperCase()} ${path}`);
      
      if (this.app.options.isDev && this.app.devServer) {
        this.app.devServer.broadcast({
          type: 'route-deleted',
          method: method.toUpperCase(),
          path,
          timestamp: new Date().toISOString()
        });
      }

      return this.app;
    } catch (error) {
      this.app.logger.log('error', 'Error deleting route', `${method?.toUpperCase()} ${path} → ${error.message}`);
      return this.app;
    }
  }

  updateRoute(method, path, newHandler) {
    try {
      this.deleteRoute(method, path);
      this.createRoute(method, path, newHandler);
      
      this.app.logger.log('reload', 'Route updated', `${method.toUpperCase()} ${path}`);
      return this.app;
    } catch (error) {
      this.app.logger.log('error', 'Error updating route', `${method?.toUpperCase()} ${path} → ${error.message}`);
      return this.app;
    }
  }

  routeExists(method, path) {
    if (!this.app.app._router) return false;
    
    return this.app.app._router.stack.some(layer => {
      if (layer.route) {
        const routeMethods = Object.keys(layer.route.methods);
        return layer.route.path === path && routeMethods.includes(method.toLowerCase());
      }
      return false;
    });
  }

  removeRouteFromRouter(method, path) {
    if (!this.app.app._router) return;
    
    this.app.app._router.stack = this.app.app._router.stack.filter(layer => {
      if (layer.route) {
        const routeMethods = Object.keys(layer.route.methods);
        const shouldRemove = layer.route.path === path && routeMethods.includes(method.toLowerCase());
        
        if (shouldRemove) {
          this.app.logger.log('dev', 'Route removed from Express router', `🗑️ ${method.toUpperCase()} ${path}`);
        }
        
        return !shouldRemove;
      }
      return true;
    });
  }

  loadRoutes(routesDir = this.options.routesDir) {
    const routesPath = path.join(process.cwd(), routesDir);
    
    if (!fs.existsSync(routesPath)) {
      this.app.logger.log('warning', 'Routes directory not found', `📁 ${routesDir}`);
      this.createDefaultRoute();
      return this.app;
    }

    this.app.logger.log('info', 'Scanning routes...', `📂 ${routesDir}`);
    this.scanDirectory(routesPath, routesPath);
    return this.app;
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
      
      this.routeMap.set(filePath, routePath);
      
      if (typeof routeModule === 'function') {
        routeModule(this.app.app);
      } else if (routeModule.router) {
        this.app.app.use(routePath, routeModule.router);
      } else if (routeModule.get || routeModule.post || routeModule.put || routeModule.delete) {
        this.setupRouteHandlers(routePath, routeModule);
      }
      
      const fileName = path.basename(filePath);
      this.app.logger.log('route', 'Route loaded', `${fileName} → ${routePath}`);
    } catch (error) {
      const fileName = path.basename(filePath);
      this.app.logger.log('error', 'Failed to load', `${fileName} → ${error.message}`);
    }
  }

  createDefaultRoute() {
    this.app.app.get('/', (req, res) => {
      res.render('index', { 
        title: 'Veko.js - Ultra modern framework',
        message: 'Welcome to Veko.js! 🚀' 
      });
    });
    
    this.app.logger.log('route', 'Default route created', '🏠 GET /');
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
    if (handlers.get) this.app.app.get(routePath, handlers.get);
    if (handlers.post) this.app.app.post(routePath, handlers.post);
    if (handlers.put) this.app.app.put(routePath, handlers.put);
    if (handlers.delete) this.app.app.delete(routePath, handlers.delete);
    if (handlers.patch) this.app.app.patch(routePath, handlers.patch);
  }

  listRoutes() {
    const routes = [];
    
    this.routeMap.forEach((routePath, filePath) => {
      routes.push({
        type: 'file',
        path: routePath,
        source: path.relative(process.cwd(), filePath),
        methods: this.getRouteMethods(routePath)
      });
    });
    
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

  getRouteMethods(routePath) {
    if (!this.app.app._router) return [];
    
    const methods = [];
    this.app.app._router.stack.forEach(layer => {
      if (layer.route && layer.route.path === routePath) {
        methods.push(...Object.keys(layer.route.methods).map(m => m.toUpperCase()));
      }
    });
    
    return [...new Set(methods)];
  }
}

module.exports = RouteManager;