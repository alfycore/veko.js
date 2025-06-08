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

  // 🚀 Initialisation de l'auto-updater non bloquante avec meilleure gestion des erreurs
  async initAutoUpdater() {
    if (!this.options.autoUpdater.enabled || !this.autoUpdater) return;
    
    try {
        this.log('info', 'Initialisation de l\'auto-updater', '🔄');
        
        // Tester si l'auto-updater a les méthodes nécessaires
        if (typeof this.autoUpdater.init !== 'function') {
            throw new Error('Module auto-updater invalide ou incomplet');
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
            this.log('success', 'Auto-updater initialisé', '✅');
            
            // Vérification initiale si demandée, mais sans bloquer
            if (this.options.autoUpdater.checkOnStart) {
                // Utiliser setTimeout pour garantir que la vérification n'est pas bloquante
                setTimeout(() => {
                    this.checkForUpdates(true).catch(err => {
                        this.log('error', 'Erreur lors de la vérification initiale', err.message);
                    });
                }, 2000); // Délai pour permettre au serveur de démarrer d'abord
            }
        }).catch(error => {
            this.log('error', 'Erreur lors de l\'initialisation de l\'auto-updater', error.message);
            this.autoUpdaterActive = false;
        });
        
    } catch (error) {
        // Capturer les erreurs mais ne pas bloquer l'application
        this.log('error', 'Erreur lors de la configuration de l\'auto-updater', error.message);
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
    
    this.log('info', 'Routes auto-updater configurées', '🔗 /_veko/updates/*');
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
      
      // Affichage des informations auto-updater seulement si actif
      if (this.autoUpdaterActive) {
        try {
          const autoUpdaterInfo = this.getAutoUpdaterInfo();
          if (autoUpdaterInfo.currentVersion) {
            this.logger.log('info', 'Auto-updater active', `🔄 Version Veko: ${autoUpdaterInfo.currentVersion}`);
            this.logger.log('info', 'Canal de mise à jour', `📢 ${autoUpdaterInfo.config.updateChannel}`);
          }
          
          // Programme les vérifications automatiques de manière sécurisée
          if (this.autoUpdater.config && this.autoUpdater.config.autoCheck) {
            this.scheduleAutoUpdates();
          }
        } catch (err) {
          this.logger.log('warn', 'Auto-updater disponible mais pas complètement initialisé', '⚠️');
        }
      }
      
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
}

module.exports = App;
