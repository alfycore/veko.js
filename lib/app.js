const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet'); // Sécurité headers
const rateLimit = require('express-rate-limit'); // Protection DDoS
const validator = require('validator'); // Validation d'entrées

const ModuleInstaller = require('./core/module-installer');
const Logger = require('./core/logger');
const LayoutManager = require('./layout/layout-manager');
const RouteManager = require('./routing/route-manager');
const DevServer = require('./dev/dev-server');
const PluginManager = require('./plugin-manager');
const AuthManager = require('./core/auth-manager');

class App {
  constructor(options = {}) {
    // Validation des options d'entrée
    this.validateOptions(options);
    
    this.options = {
      port: this.sanitizePort(options.port) || 3000,
      wsPort: this.sanitizePort(options.wsPort) || 3008,
      viewsDir: this.sanitizePath(options.viewsDir) || 'views',
      staticDir: this.sanitizePath(options.staticDir) || 'public',
      routesDir: this.sanitizePath(options.routesDir) || 'routes',
      isDev: Boolean(options.isDev),
      watchDirs: this.sanitizePaths(options.watchDirs) || ['views', 'routes', 'public'],
      errorLog: this.sanitizePath(options.errorLog) || 'error.log',
      showStack: process.env.NODE_ENV !== 'production' && Boolean(options.showStack),
      autoInstall: Boolean(options.autoInstall ?? true),
      // Configuration sécurisée par défaut
      security: {
        helmet: true,
        rateLimit: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100, // limit each IP to 100 requests per windowMs
          message: 'Trop de requêtes, veuillez réessayer plus tard.'
        },
        cors: {
          origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
          credentials: true
        },
        ...options.security
      },
      layouts: {
        enabled: true,
        layoutsDir: this.sanitizePath(options.layouts?.layoutsDir) || 'views/layouts',
        defaultLayout: this.sanitizeString(options.layouts?.defaultLayout) || 'main',
        extension: this.sanitizeString(options.layouts?.extension) || '.ejs',
        sections: this.sanitizeArray(options.layouts?.sections) || ['head', 'header', 'content', 'footer', 'scripts'],
        cache: process.env.NODE_ENV === 'production',
        ...options.layouts
      },
      plugins: {
        enabled: Boolean(options.plugins?.enabled ?? true),
        autoLoad: Boolean(options.plugins?.autoLoad ?? true),
        pluginsDir: this.sanitizePath(options.plugins?.pluginsDir) || 'plugins',
        whitelist: options.plugins?.whitelist || [], // Plugins autorisés
        ...options.plugins
      },
      prefetch: {
        enabled: Boolean(options.prefetch?.enabled ?? true),
        maxConcurrent: Math.min(Math.max(1, options.prefetch?.maxConcurrent || 3), 10),
        notifyUser: Boolean(options.prefetch?.notifyUser ?? true),
        cacheRoutes: Boolean(options.prefetch?.cacheRoutes ?? true),
        prefetchDelay: Math.max(100, options.prefetch?.prefetchDelay || 1000),
        ...options.prefetch
      }
    };
    
    this.app = express();
    this.express = this.app;
    
    // Initialize components
    this.logger = new Logger();
    this.layoutManager = new LayoutManager(this, this.options.layouts);
    this.routeManager = new RouteManager(this, this.options);
    
    // Système d'authentification
    this.auth = new AuthManager(this);
    
    if (this.options.isDev) {
      this.devServer = new DevServer(this, this.options);
    }
    
    if (this.options.plugins.enabled) {
      this.plugins = new PluginManager(this, this.options.plugins);
    }
    
    this.init();
  }

  async ensureModules() {
    if (this.options.autoInstall !== false) {
      try {
        await ModuleInstaller.checkAndInstall();
        ModuleInstaller.createPackageJsonIfNeeded();
      } catch (error) {
        this.logger.log('error', 'Erreur lors de la vérification des modules', error.message);
      }
    }
  }

  async installModule(moduleName, version = 'latest') {
    return await ModuleInstaller.installModule(moduleName, version);
  }

  log(type, message, details = '') {
    this.logger.log(type, message, details);
  }

  init() {
    this.setupExpress();
    
    if (this.plugins) {
      this.plugins.executeHook('app:init', this);
    }
    
    if (this.options.isDev) {
      this.devServer.setup();
    }
  }

  setupExpress() {
    // Configuration sécurisée des headers
    if (this.options.security.helmet) {
      this.app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        hsts: process.env.NODE_ENV === 'production'
      }));
    }

    // Rate limiting
    if (this.options.security.rateLimit) {
      const limiter = rateLimit(this.options.security.rateLimit);
      this.app.use(limiter);
    }

    this.app.set('view engine', 'ejs');
    this.app.set('views', [
      path.join(process.cwd(), this.options.viewsDir),
      path.join(process.cwd(), this.options.layouts.layoutsDir),
      path.join(__dirname, '..', 'views'),
      path.join(__dirname, '..', 'error')
    ]);
    
    // Configuration sécurisée du parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        // Vérification de la taille et du contenu
        if (buf.length > 10485760) { // 10MB
          throw new Error('Payload trop volumineux');
        }
      }
    }));
    
    this.app.use(express.urlencoded({ 
      extended: true,
      limit: '10mb',
      parameterLimit: 100
    }));
    
    // Serveur de fichiers statiques sécurisé
    const staticDir = this.options.staticDir;
    this.app.use(express.static(path.join(process.cwd(), staticDir), {
      dotfiles: 'deny',
      index: false,
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
    }));

    // Middleware de sécurité personnalisé
    this.app.use(this.securityMiddleware());

    if (this.options.layouts?.enabled) {
      this.app.use(this.layoutManager.middleware());
    }

    if (this.options.isDev) {
      this.app.use(this.devServer.middleware());
    }

    this.logger.log('success', 'Express configuration initialized', '⚡ Ready to start');
  }

  // Middleware de sécurité personnalisé
  securityMiddleware() {
    return (req, res, next) => {
      // Protection XSS
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Masquer les informations du serveur
      res.removeHeader('X-Powered-By');
      
      // Validation des headers
      const suspiciousHeaders = ['x-forwarded-host', 'x-real-ip'];
      for (const header of suspiciousHeaders) {
        if (req.headers[header] && !this.isValidHeader(req.headers[header])) {
          return res.status(400).json({ error: 'En-tête suspect détecté' });
        }
      }
      
      next();
    };
  }

  isValidHeader(value) {
    // Validation basique des headers
    return typeof value === 'string' && 
           value.length < 1000 && 
           !/[<>\"']/.test(value);
  }

  /**
   * Active le système d'authentification
   * @param {Object} config - Configuration de l'authentification
   */
  async enableAuth(config = {}) {
    await this.auth.init(config);
    return this;
  }

  /**
   * Vérifie si l'authentification est activée
   */
  isAuthEnabled() {
    return this.auth.isEnabled;
  }

  /**
   * Middleware pour protéger une route
   */
  requireAuth() {
    if (!this.auth.isEnabled) {
      throw new Error('Le système d\'authentification n\'est pas activé');
    }
    return this.auth.requireAuth.bind(this.auth);
  }

  /**
   * Middleware pour protéger une route avec un rôle spécifique
   */
  requireRole(role) {
    if (!this.auth.isEnabled) {
      throw new Error('Le système d\'authentification n\'est pas activé');
    }
    return this.auth.requireRole(role);
  }

  // Delegate route methods to RouteManager
  createRoute(method, path, handler, options = {}) {
    return this.routeManager.createRoute(method, path, handler, options);
  }

  deleteRoute(method, path) {
    return this.routeManager.deleteRoute(method, path);
  }

  updateRoute(method, path, newHandler) {
    return this.routeManager.updateRoute(method, path, newHandler);
  }

  loadRoutes(routesDir = this.options.routesDir) {
    return this.routeManager.loadRoutes(routesDir);
  }

  listRoutes() {
    return this.routeManager.listRoutes();
  }

  // Delegate layout methods to LayoutManager
  createLayout(layoutName, content = null) {
    return this.layoutManager.createLayout(layoutName, content);
  }

  deleteLayout(layoutName) {
    return this.layoutManager.deleteLayout(layoutName);
  }

  listLayouts() {
    return this.layoutManager.listLayouts();
  }

  use(middleware) {
    this.app.use(middleware);
    return this;
  }

  listen(port = this.options.port, callback) {
    return this.app.listen(port, async () => {
      console.log('\n' + '═'.repeat(60));
      console.log(`\x1b[35m\x1b[1m
   ╔══════════════════════════════════════════════════════╗
   ║                    🚀 VEKO.JS 🚀                     ║
   ╚══════════════════════════════════════════════════════╝\x1b[0m`);
      
      this.logger.log('server', 'Server started successfully', `🌐 http://localhost:${port}`);
      
      if (this.options.isDev) {
        this.logger.log('dev', 'Development mode active', `🔥 Smart hot reload on port ${this.options.wsPort}`);
      }

      if (this.plugins) {
        const stats = this.plugins.getStats();
        this.logger.log('info', 'Plugin system', `🔌 ${stats.active}/${stats.total} plugins active`);
        await this.plugins.executeHook('app:start', this, port);
      }
      
      console.log('═'.repeat(60) + '\n');
      
      if (callback && typeof callback === 'function') {
        callback();
      }
    });
  }

  startDev(port = this.options.port) {
    this.options.isDev = true;
    if (!this.devServer) {
      this.devServer = new DevServer(this, this.options);
      this.devServer.setup();
    }
    this.loadRoutes();
    return this.listen(port);
  }

  async stop() {
    if (this.plugins) {
      this.plugins.executeHook('app:stop', this);
    }

    if (this.devServer) {
      this.devServer.stop();
    }

    // Fermer l'authentification si activée
    if (this.auth.isEnabled) {
      await this.auth.destroy();
    }
    
    this.logger.log('server', 'Server stopped', '🛑 Goodbye!');
  }
}

module.exports = App;