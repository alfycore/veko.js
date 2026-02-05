const express = require('express');
const path = require('path');
const fs = require('fs');
const net = require('net'); // Port checking
const { execSync, spawn } = require('child_process'); // For auto-install
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

// Support React - chargé dynamiquement pour éviter les erreurs si non installé
let ReactSupport = null;
function loadReactSupport() {
  if (ReactSupport) return ReactSupport;
  try {
    // Clear cache to ensure fresh load after install
    const reactModulePath = require.resolve('./react');
    delete require.cache[reactModulePath];
    ReactSupport = require('./react');
    return ReactSupport;
  } catch (error) {
    return null;
  }
}

// Vérification de l'existence de l'auto-updater de manière sécurisée
let AutoUpdater = null;
try {
  AutoUpdater = require('./core/auto-updater');
} catch (error) {
  // L'auto-updater n'est pas disponible, mais l'application peut continuer
  console.warn('Auto-updater non disponible:', error.message);
}

class App {
  constructor(options = {}) {
    // Validation des options d'entrée
    this.validateOptions(options);
    
    // Configuration par défaut
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
      },
      // Configuration de l'auto-updater
      autoUpdater: {
        enabled: Boolean(options.autoUpdater?.enabled ?? true) && AutoUpdater !== null,
        checkOnStart: Boolean(options.autoUpdater?.checkOnStart ?? true),
        autoUpdate: Boolean(options.autoUpdater?.autoUpdate ?? false),
        updateChannel: options.autoUpdater?.updateChannel || 'stable',
        securityUpdates: Boolean(options.autoUpdater?.securityUpdates ?? true),
        showNotifications: Boolean(options.autoUpdater?.showNotifications ?? true),
        backupCount: Math.max(1, options.autoUpdater?.backupCount || 5),
        checkInterval: Math.max(300000, options.autoUpdater?.checkInterval || 3600000), // min 5 min
        ...options.autoUpdater
      },
      // Configuration React
      react: {
        enabled: Boolean(options.react?.enabled ?? false),
        mode: options.react?.mode || 'hybrid', // 'ssr', 'csr', 'hybrid', 'streaming'
        componentsDir: this.sanitizePath(options.react?.componentsDir) || 'components',
        pagesDir: this.sanitizePath(options.react?.pagesDir) || 'pages',
        buildDir: this.sanitizePath(options.react?.buildDir) || '.veko/react',
        hydration: Boolean(options.react?.hydration ?? true),
        streaming: Boolean(options.react?.streaming ?? false),
        hmr: Boolean(options.react?.hmr ?? true),
        bundler: options.react?.bundler || 'esbuild', // 'esbuild', 'vite', 'webpack'
        typescript: Boolean(options.react?.typescript ?? false),
        ...options.react
      }
    };
    
    this.app = express();
    this.express = this.app;
    
    // Initialize components - silent by default, verbose with VEKO_VERBOSE=true
    this.logger = new Logger({ 
      silent: false, 
      verbose: process.env.VEKO_VERBOSE === 'true' 
    });
    this.layoutManager = new LayoutManager(this, this.options.layouts);
    this.routeManager = new RouteManager(this, this.options);
    
    // Système d'authentification
    this.auth = new AuthManager(this);
    
    // Système React (si activé)
    if (this.options.react.enabled && ReactSupport) {
      this.react = ReactSupport.initReact(this, this.options.react);
    }
    
    // Système d'auto-updater (si disponible)
    if (this.options.autoUpdater.enabled && AutoUpdater) {
      this.autoUpdater = AutoUpdater;
      this.autoUpdaterActive = false;
    }
    
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
        // Silent error handling
      }
    }
  }

  async installModule(moduleName, version = 'latest') {
    return await ModuleInstaller.installModule(moduleName, version);
  }

  log(type, message, details = '') {
    this.logger.log(type, message, details);
  }

  // 🚀 Initialisation de l'auto-updater non bloquante avec meilleure gestion des erreurs
  async initAutoUpdater() {
    if (!this.options.autoUpdater.enabled || !this.autoUpdater) return;
    
    try {
        // Tester si l'auto-updater a les méthodes nécessaires
        if (typeof this.autoUpdater.init !== 'function') {
            return;
        }
        
        // Configure l'auto-updater avec les options de l'app
        this.autoUpdater.config = {
            ...this.autoUpdater.defaultConfig || {},
            autoCheck: this.options.autoUpdater.checkOnStart,
            autoUpdate: this.options.autoUpdater.autoUpdate,
            updateChannel: this.options.autoUpdater.updateChannel,
            securityCheck: this.options.autoUpdater.securityUpdates,
            notifications: this.options.autoUpdater.showNotifications,
            backupCount: this.options.autoUpdater.backupCount,
            checkInterval: this.options.autoUpdater.checkInterval
        };
        
        // Initialiser l'auto-updater de manière non bloquante
        this.autoUpdater.init().then(() => {
            this.autoUpdaterActive = true;
            
            // Vérification initiale si demandée, mais sans bloquer
            if (this.options.autoUpdater.checkOnStart) {
                setTimeout(() => {
                    this.checkForUpdates(true).catch(() => {});
                }, 2000);
            }
        }).catch(() => {
            this.autoUpdaterActive = false;
        });
        
    } catch (error) {
        this.autoUpdaterActive = false;
    }
  }

  // 🔍 Vérification des mises à jour avec gestion d'erreurs améliorée
  async checkForUpdates(silent = false) {
    if (!this.autoUpdaterActive) return null;
    
    try {
      const updateInfo = await Promise.race([
        this.autoUpdater.checkForUpdates(silent),
        // Timeout après 5 secondes pour ne pas bloquer
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout lors de la vérification')), 5000))
      ]);
      
      if (updateInfo.hasUpdate && !silent) {
        this.log('warning', 'Mise à jour disponible', `${updateInfo.currentVersion} → ${updateInfo.latestVersion}`);
        
        // Notification pour les mises à jour de sécurité
        if (updateInfo.security) {
          this.log('error', 'MISE À JOUR DE SÉCURITÉ CRITIQUE', '🔒 Mise à jour fortement recommandée');
          
          // Mise à jour automatique pour les correctifs de sécurité si activée
          if (this.options.autoUpdater.securityUpdates && this.options.autoUpdater.autoUpdate) {
            this.log('info', 'Mise à jour de sécurité automatique', '🚀 Démarrage...');
            this.performUpdate(updateInfo).catch(err => {
              this.log('error', 'Échec de la mise à jour de sécurité', err.message);
            });
          }
        }
        
        // Mise à jour automatique normale si activée
        if (this.options.autoUpdater.autoUpdate && !updateInfo.security) {
          this.log('info', 'Mise à jour automatique', '🚀 Démarrage...');
          this.performUpdate(updateInfo).catch(err => {
            this.log('error', 'Échec de la mise à jour automatique', err.message);
          });
        }
      } else if (updateInfo.needsInstall && !silent) {
        this.log('warning', 'Veko non installé correctement', '⚠️ Réinstallation requise');
      } else if (!updateInfo.hasUpdate && !silent) {
        this.log('success', 'Veko à jour', `✅ Version ${updateInfo.currentVersion || 'inconnue'}`);
      }
      
      return updateInfo;
      
    } catch (error) {
      // Log l'erreur mais continue l'exécution
      this.log('error', 'Erreur lors de la vérification des mises à jour', error.message);
      return { hasUpdate: false, error: error.message };
    }
  }

  // 🚀 Exécution de la mise à jour
  async performUpdate(updateInfo) {
    if (!this.autoUpdaterActive) {
      throw new Error('Auto-updater non actif');
    }
    
    try {
      this.log('info', 'Début de la mise à jour', `🚀 ${updateInfo.latestVersion}`);
      
      // Hook avant mise à jour
      if (this.plugins) {
        await this.plugins.executeHook('app:before-update', this, updateInfo);
      }
      
      const success = await this.autoUpdater.performUpdate(updateInfo);
      
      if (success) {
        this.log('success', 'Mise à jour terminée', '✅ Redémarrage requis');
        
        // Hook après mise à jour réussie
        if (this.plugins) {
          await this.plugins.executeHook('app:after-update', this, updateInfo);
        }
        
        // Notification optionnelle de redémarrage
        if (this.options.autoUpdater.showNotifications) {
          console.log('\n' + '═'.repeat(60));
          console.log('\x1b[32m\x1b[1m🎉 MISE À JOUR VEKO RÉUSSIE!\x1b[0m');
          console.log('\x1b[33m⚠️  Redémarrez l\'application pour appliquer les changements\x1b[0m');
          console.log('═'.repeat(60) + '\n');
        }
        
        return true;
      } else {
        this.log('error', 'Échec de la mise à jour', '❌');
        return false;
      }
      
    } catch (error) {
      this.log('error', 'Erreur durant la mise à jour', error.message);
      
      // Hook en cas d'erreur
      if (this.plugins) {
        await this.plugins.executeHook('app:update-error', this, error);
      }
      
      return false;
    }
  }

  // 🔄 Rollback vers une version précédente
  async rollbackUpdate(backupPath = null) {
    if (!this.autoUpdaterActive) {
      throw new Error('Auto-updater non actif');
    }
    
    try {
      this.log('info', 'Début du rollback', '🔄');
      
      const success = await this.autoUpdater.rollback(backupPath);
      
      if (success) {
        this.log('success', 'Rollback terminé', '✅');
        return true;
      } else {
        this.log('error', 'Échec du rollback', '❌');
        return false;
      }
      
    } catch (error) {
      this.log('error', 'Erreur durant le rollback', error.message);
      return false;
    }
  }

  // 📊 Informations sur l'auto-updater
  getAutoUpdaterInfo() {
    if (!this.autoUpdaterActive) {
      return { active: false, message: 'Auto-updater désactivé' };
    }
    
    return {
      active: true,
      currentVersion: this.autoUpdater.getCurrentVersion(),
      config: this.autoUpdater.config,
      stats: this.autoUpdater.stats
    };
  }

  // 📋 Route d'administration pour l'auto-updater
  setupAutoUpdaterRoutes() {
    if (!this.autoUpdaterActive) return;
    
    // Route pour vérifier les mises à jour
    this.app.get('/_veko/updates/check', async (req, res) => {
      try {
        const updateInfo = await this.checkForUpdates(true);
        res.json(updateInfo);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Route pour déclencher une mise à jour
    this.app.post('/_veko/updates/perform', async (req, res) => {
      try {
        const updateInfo = await this.checkForUpdates(true);
        if (updateInfo.hasUpdate) {
          const success = await this.performUpdate(updateInfo);
          res.json({ success, updateInfo });
        } else {
          res.json({ success: false, message: 'Aucune mise à jour disponible' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Route pour les statistiques
    this.app.get('/_veko/updates/stats', (req, res) => {
      res.json(this.getAutoUpdaterInfo());
    });
    
    // Route pour effectuer un rollback
    this.app.post('/_veko/updates/rollback', async (req, res) => {
      try {
        const { backupPath } = req.body;
        const success = await this.rollbackUpdate(backupPath);
        res.json({ success });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Routes auto-updater configurées silencieusement
  }

  async init() {
    this.setupExpress();
    
    // Initialisation asynchrone et non bloquante de l'auto-updater
    this.initAutoUpdater().catch(err => {
      // L'erreur est déjà enregistrée dans la méthode initAutoUpdater
    });
    
    if (this.plugins) {
      this.plugins.executeHook('app:init', this);
    }
    
    if (this.options.isDev) {
      this.devServer.setup();
    }
    
    // Configuration des routes d'administration seulement si l'auto-updater est activé
    if (this.autoUpdaterActive) {
      this.setupAutoUpdaterRoutes();
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

    // Middleware React
    if (this.options.react?.enabled && ReactSupport) {
      this.app.use(ReactSupport.reactMiddleware(this.options.react));
    }

    if (this.options.isDev) {
      this.app.use(this.devServer.middleware());
    }
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
    const actualPort = typeof port === 'number' ? port : this.options.port;
    
    return this.app.listen(actualPort, async () => {
      // Style Next.js - minimaliste
      console.log();
      console.log(`\x1b[32m\x1b[1m ▲ Veko.js 1.2.11\x1b[0m`);
      console.log(`\x1b[90m   - Local:        \x1b[0m\x1b[36mhttp://localhost:${actualPort}\x1b[0m`);
      
      if (this.options.isDev) {
        console.log(`\x1b[90m   - Mode:         \x1b[0m\x1b[33mdevelopment\x1b[0m`);
      }
      
      console.log();
      
      // Silent initialization - no verbose logs
      if (this.autoUpdaterActive) {
        try {
          if (this.autoUpdater.config && this.autoUpdater.config.autoCheck) {
            this.scheduleAutoUpdates();
          }
        } catch (err) {
          // Silent
        }
      }

      if (this.plugins) {
        await this.plugins.executeHook('app:start', this, actualPort);
      }
      
      console.log(`\x1b[32m ✓ Ready\x1b[0m`);
      console.log();
      
      if (callback && typeof callback === 'function') {
        callback();
      }
    });
  }

  /**
   * Démarre le serveur (alias pour listen avec chargement des routes)
   * @param {number} port - Port d'écoute
   * @param {Function} callback - Callback optionnel
   * @returns {Promise} Promise qui se résout quand le serveur démarre
   */
  async start(port = this.options.port, callback) {
    // Charger les routes si pas déjà fait
    this.loadRoutes();
    
    // Find available port
    let actualPort = port;
    try {
      actualPort = await this.findAvailablePort(port);
      if (actualPort !== port) {
        this.log('info', `Port ${port} occupé`, `✅ Utilisation du port ${actualPort}`);
        this.options.port = actualPort;
      }
    } catch (portError) {
      this.log('error', 'Erreur de port', portError.message);
      throw portError;
    }
    
    // Retourner une Promise qui ne se résout jamais (garde le serveur actif)
    return new Promise((resolve, reject) => {
      try {
        this.server = this.listen(actualPort, () => {
          if (callback && typeof callback === 'function') {
            callback();
          }
          // Ne pas résoudre la Promise pour garder le processus actif
        });
        
        this.server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            this.log('error', `Port ${actualPort} déjà utilisé`, '❌');
            // Try next port
            this.start(actualPort + 1, callback).then(resolve).catch(reject);
          } else {
            reject(err);
          }
        });
        
        // Gestion du signal de fermeture
        process.on('SIGINT', async () => {
          console.log('\n');
          await this.stop();
          process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
          await this.stop();
          process.exit(0);
        });
        
      } catch (err) {
        reject(err);
      }
    });
  }

  // ⏰ Programmation des vérifications automatiques avec protection
  scheduleAutoUpdates() {
    if (!this.autoUpdaterActive) return;
    
    try {
      const interval = this.autoUpdater.config.checkInterval || 3600000;
      
      setInterval(() => {
        this.checkForUpdates(true).catch(error => {
          // Capture les erreurs sans bloquer le timer
          this.log('error', 'Erreur vérification automatique', error.message);
        });
      }, interval);
      
      this.log('info', 'Vérifications automatiques programmées', `⏰ Toutes les ${Math.round(interval / 60000)} minutes`);
    } catch (error) {
      this.log('error', 'Erreur lors de la programmation des vérifications', error.message);
    }
  }

  async startDev(port = this.options.port) {
    this.options.isDev = true;
    if (!this.devServer) {
      this.devServer = new DevServer(this, this.options);
      await this.devServer.setup();
    }
    // Use start() which handles port finding
    return this.start(port);
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
    
    // Nettoyage de l'auto-updater de manière sécurisée
    if (this.autoUpdaterActive && this.autoUpdater && typeof this.autoUpdater.closeReadline === 'function') {
      try {
        this.autoUpdater.closeReadline();
        this.log('info', 'Auto-updater arrêté', '🔄');
      } catch (err) {
        this.log('error', 'Erreur lors de l\'arrêt de l\'auto-updater', err.message);
      }
    }
    
    this.logger.log('server', 'Server stopped', '🛑 Goodbye!');
  }

  // Méthodes de validation et sanitisation
  validateOptions(options) {
    if (typeof options !== 'object' || options === null) {
      throw new Error('Les options doivent être un objet');
    }

    // Validation du port
    if (options.port !== undefined && !this.isValidPort(options.port)) {
      throw new Error('Le port doit être un nombre entre 1 et 65535');
    }

    // Validation du port WebSocket
    if (options.wsPort !== undefined && !this.isValidPort(options.wsPort)) {
      throw new Error('Le port WebSocket doit être un nombre entre 1 et 65535');
    }

    // Validation des chemins
    const pathOptions = ['viewsDir', 'staticDir', 'routesDir', 'errorLog'];
    for (const pathOption of pathOptions) {
      if (options[pathOption] !== undefined && !this.isValidPath(options[pathOption])) {
        throw new Error(`${pathOption} doit être un chemin valide`);
      }
    }

    // Validation des tableaux
    if (options.watchDirs !== undefined && !Array.isArray(options.watchDirs)) {
      throw new Error('watchDirs doit être un tableau');
    }
  }

  isValidPort(port) {
    const portNumber = parseInt(port, 10);
    return !isNaN(portNumber) && portNumber >= 1 && portNumber <= 65535;
  }

  /**
   * Check if a port is available
   * @param {number} port - Port to check
   * @returns {Promise<boolean>} True if port is available
   */
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
  }

  /**
   * Find an available port starting from the given port
   * @param {number} startPort - Starting port
   * @param {number} maxAttempts - Maximum attempts (default 100)
   * @returns {Promise<number>} Available port
   */
  async findAvailablePort(startPort, maxAttempts = 100) {
    let port = startPort;
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
      this.log('warning', `Port ${port} occupé`, `🔍 Essai du port ${port + 1}...`);
      port++;
    }
    throw new Error(`Aucun port disponible trouvé après ${maxAttempts} tentatives (à partir de ${startPort})`);
  }

  isValidPath(path) {
    if (typeof path !== 'string') return false;
    // Empêcher les chemins dangereux
    const dangerousPatterns = ['../', '..\\', '<', '>', '|', '?', '*'];
    return !dangerousPatterns.some(pattern => path.includes(pattern)) && path.length > 0;
  }

  sanitizePort(port) {
    if (port === undefined || port === null) return null;
    const portNumber = parseInt(port, 10);
    return this.isValidPort(portNumber) ? portNumber : null;
  }

  sanitizePath(path) {
    if (typeof path !== 'string') return null;
    // Nettoyer et valider le chemin
    const cleanPath = validator.escape(path.trim());
    return this.isValidPath(cleanPath) ? cleanPath : null;
  }

  sanitizePaths(paths) {
    if (!Array.isArray(paths)) return null;
    return paths
      .map(path => this.sanitizePath(path))
      .filter(path => path !== null);
  }

  sanitizeString(str) {
    if (typeof str !== 'string') return null;
    return validator.escape(str.trim());
  }

  sanitizeArray(arr) {
    if (!Array.isArray(arr)) return null;
    return arr
      .filter(item => typeof item === 'string')
      .map(item => validator.escape(item.trim()));
  }

  // ============= REACT METHODS =============

  /**
   * Active le support React
   * @param {Object} options - Configuration React
   */
  async enableReact(options = {}) {
    // Try to load React support
    let reactModule = loadReactSupport();
    
    if (!reactModule) {
      // Check if React is installed in node_modules
      const reactPath = path.join(process.cwd(), 'node_modules', 'react');
      const reactInstalled = fs.existsSync(reactPath);
      
      if (!reactInstalled) {
        // Auto-install React dependencies
        const reactDeps = ['react', 'react-dom', 'esbuild'];
        
        console.log('\x1b[33m ○ Installing React dependencies...\x1b[0m');
        
        try {
          execSync(`npm install ${reactDeps.join(' ')} --save --silent`, {
            cwd: process.cwd(),
            stdio: ['ignore', 'ignore', 'inherit']
          });
          
          console.log('\x1b[32m ✓ React installed. Restarting...\x1b[0m\n');
          
          // Restart the process
          const args = process.argv.slice(1);
          const { spawn } = require('child_process');
          spawn(process.argv[0], args, {
            cwd: process.cwd(),
            stdio: 'inherit',
            shell: true
          });
          
          // Exit current process
          process.exit(0);
          
        } catch (installError) {
          throw new Error(`Failed to install React: ${installError.message}\nRun manually: npm install ${reactDeps.join(' ')}`);
        }
      }
      
      // Try loading again after confirming installation
      // Clear all caches
      Object.keys(require.cache).forEach(key => {
        if (key.includes('react') || key.includes('lib/react')) {
          delete require.cache[key];
        }
      });
      
      reactModule = loadReactSupport();
      
      if (!reactModule) {
        throw new Error('React module failed to load. Please restart the application.');
      }
    }
    
    this.options.react = {
      ...this.options.react,
      enabled: true,
      ...options
    };
    
    this.react = reactModule.initReact(this, this.options.react);
    this.app.use(reactModule.reactMiddleware(this.options.react));
    
    // Activer le HMR pour React en mode dev
    if (this.options.isDev && this.options.react.hmr) {
      await this.react.setupHMR();
    }
    
    return this;
  }

  /**
   * Vérifie si React est activé
   */
  isReactEnabled() {
    return this.options.react?.enabled && this.react !== null;
  }

  /**
   * Crée une route React avec SSR/CSR/Hybrid
   * @param {string} path - Chemin de la route
   * @param {string|Function} component - Composant React ou chemin
   * @param {Object} options - Options
   */
  reactRoute(routePath, component, options = {}) {
    if (!this.isReactEnabled()) {
      throw new Error('React n\'est pas activé. Appelez enableReact() d\'abord.');
    }
    
    const route = ReactSupport.createReactRoute(routePath, component, {
      mode: options.mode || this.options.react.mode,
      layout: options.layout,
      getInitialProps: options.getInitialProps,
      defaultProps: options.defaultProps,
      routeOptions: options.routeOptions
    });
    
    return this.createRoute(route.method, route.path, route.handler, route);
  }

  /**
   * Enregistre un composant React
   * @param {string} name - Nom du composant
   * @param {string} filePath - Chemin vers le fichier
   */
  async registerComponent(name, filePath) {
    if (!this.isReactEnabled()) {
      throw new Error('React n\'est pas activé. Appelez enableReact() d\'abord.');
    }
    
    return await this.react.registerComponent(name, filePath);
  }

  /**
   * Render un composant React
   * @param {string} component - Nom ou chemin du composant
   * @param {Object} props - Props du composant
   * @param {Object} options - Options de rendu
   */
  async renderReact(component, props = {}, options = {}) {
    if (!this.isReactEnabled()) {
      throw new Error('React n\'est pas activé. Appelez enableReact() d\'abord.');
    }
    
    const mode = options.mode || this.options.react.mode;
    
    switch (mode) {
      case 'ssr':
        return await this.react.renderSSR(component, props);
      case 'csr':
        return await this.react.renderCSR(component, props);
      case 'streaming':
        throw new Error('Le mode streaming nécessite un objet response');
      case 'hybrid':
      default:
        return await this.react.renderHybrid(component, props, options);
    }
  }

  /**
   * Compile les composants React pour la production
   */
  async buildReact(options = {}) {
    if (!this.isReactEnabled()) {
      throw new Error('React n\'est pas activé. Appelez enableReact() d\'abord.');
    }
    
    this.log('info', 'Build React en cours...', '📦');
    
    const buildConfig = ReactSupport.createBuildConfig({
      ...this.options.react,
      ...options
    });
    
    try {
      const result = await this.react.build(buildConfig);
      this.log('success', 'Build React terminé', '✅');
      return result;
    } catch (error) {
      this.log('error', 'Erreur build React', error.message);
      throw error;
    }
  }

  // ============= VSV (VEKO SERVER VIEWS) METHODS =============

  /**
   * Active le support VSV
   * @param {Object} options - Configuration VSV
   */
  async enableVSV(options = {}) {
    const VSV = require('./vsv');
    
    this.vsv = new VSV(this, {
      componentsDir: options.componentsDir || 'components',
      pagesDir: options.pagesDir || 'pages',
      ssr: options.ssr !== false,
      hydrate: options.hydrate !== false,
      minify: options.minify !== false,
      precompile: options.precompile !== false,
      ...options
    });
    
    await this.vsv.init();
    
    return this;
  }

  /**
   * Vérifie si VSV est activé
   */
  isVSVEnabled() {
    return this.vsv !== null && this.vsv !== undefined;
  }

  /**
   * Crée une route VSV
   * @param {string} routePath - Chemin de la route
   * @param {string} component - Nom du composant
   * @param {Object} options - Options
   */
  vsvRoute(routePath, component, options = {}) {
    if (!this.isVSVEnabled()) {
      throw new Error('VSV n\'est pas activé. Appelez enableVSV() d\'abord.');
    }

    this.app.get(routePath, async (req, res, next) => {
      try {
        const props = {
          ...options.props,
          params: req.params,
          query: req.query,
          path: req.path
        };

        // Data fetching
        if (options.getProps) {
          const fetchedProps = await options.getProps(req);
          Object.assign(props, fetchedProps);
        }

        const html = await this.vsv.renderPage(component, props, {
          title: options.title || component,
          seo: options.seo,
          ...options
        });

        res.type('html').send(html);
      } catch (error) {
        next(error);
      }
    });

    return this;
  }

  /**
   * Rend un composant VSV
   * @param {string} component - Nom du composant
   * @param {Object} props - Props du composant
   */
  async renderVSV(component, props = {}, options = {}) {
    if (!this.isVSVEnabled()) {
      throw new Error('VSV n\'est pas activé. Appelez enableVSV() d\'abord.');
    }
    
    return this.vsv.render(component, props, options);
  }

  /**
   * Rend une page VSV complète
   * @param {string} page - Nom de la page
   * @param {Object} props - Props
   */
  async renderVSVPage(page, props = {}, options = {}) {
    if (!this.isVSVEnabled()) {
      throw new Error('VSV n\'est pas activé. Appelez enableVSV() d\'abord.');
    }
    
    return this.vsv.renderPage(page, props, options);
  }

  /**
   * Crée un composant VSV programmatiquement
   * @param {string} name - Nom du composant
   * @param {Object} definition - Définition du composant
   */
  vsvComponent(name, definition) {
    if (!this.isVSVEnabled()) {
      throw new Error('VSV n\'est pas activé. Appelez enableVSV() d\'abord.');
    }
    
    return this.vsv.component(name, definition);
  }
}

module.exports = App;
