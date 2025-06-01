const express = require('express');
const path = require('path');
const fs = require('fs');

const ModuleInstaller = require('./core/module-installer');
const Logger = require('./core/logger');
const LayoutManager = require('./layout/layout-manager');
const RouteManager = require('./routing/route-manager');
const DevServer = require('./dev/dev-server');
const PluginManager = require('./plugin-manager');
const AuthManager = require('./core/auth-manager');

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
      autoInstall: true,
      layouts: {
        enabled: true,
        layoutsDir: 'views/layouts',
        defaultLayout: 'main',
        extension: '.ejs',
        sections: ['head', 'header', 'content', 'footer', 'scripts'],
        cache: true
      },
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
    this.app.set('view engine', 'ejs');
    this.app.set('views', [
      path.join(process.cwd(), this.options.viewsDir || 'views'),
      path.join(process.cwd(), this.options.layouts?.layoutsDir || 'views/layouts'),
      path.join(__dirname, '..', 'views'),
      path.join(__dirname, '..', 'error')
    ]);
    
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Vérifier que staticDir est défini avant de l'utiliser
    const staticDir = this.options.staticDir || 'public';
    this.app.use(express.static(path.join(process.cwd(), staticDir)));

    if (this.options.layouts?.enabled) {
      this.app.use(this.layoutManager.middleware());
    }

    if (this.options.isDev) {
      this.app.use(this.devServer.middleware());
    }

    this.logger.log('success', 'Express configuration initialized', '⚡ Ready to start');
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