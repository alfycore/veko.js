const chokidar = require('chokidar');
const WebSocket = require('ws');
const path = require('path');
const chalk = require('chalk');
const express = require('express');
const fs = require('fs');

class DevServer {
  constructor(options = {}) {
    this.options = {
      port: 3000,
      wsPort: 3008,
      watchDirs: ['views', 'routes', 'public'],
      projectRoot: process.cwd(),
      customEntryFile: null, // Nouveau paramètre pour le fichier de démarrage
      prefetch: {
        enabled: true,
        prefetchDelay: 1000
      },
      ...options
    };
    
    this.app = express();
    this.wss = null;
    this.watchers = [];
    this.setupErrorHandling();
  }
  
  setupErrorHandling() {
    process.on('uncaughtException', (error) => {
      console.error(chalk.red('💥 Erreur non gérée:'), error);
      this.broadcast({ type: 'error', message: error.message, stack: error.stack });
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error(chalk.red('💥 Promise rejetée:'), reason);
      this.broadcast({ type: 'error', message: reason.toString() });
    });
  }
  
  async start() {
    try {
      await this.setupWebSocketServer();
      await this.setupFileWatching();
      await this.setupExpressApp();
      await this.startServer();
      
      console.log(chalk.green(`✅ Serveur de développement démarré sur http://localhost:${this.options.port}`));
      console.log(chalk.blue(`🔄 Auto-refresh activé sur le port ${this.options.wsPort}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Erreur lors du démarrage:'), error);
      process.exit(1);
    }
  }
  
  setupWebSocketServer() {
    return new Promise((resolve) => {
      this.wss = new WebSocket.Server({ port: this.options.wsPort });
      
      this.wss.on('connection', (ws) => {
        console.log(chalk.cyan('🔗 Client connecté pour l\'auto-refresh'));
        
        // Envoyer la liste des routes disponibles au client pour préchargement
        if (this.options.prefetch && this.options.prefetch.enabled) {
          this.sendAvailableRoutes(ws);
        }
        
        ws.on('close', () => {
          console.log(chalk.cyan('🔌 Client déconnecté'));
        });
      });
      
      resolve();
    });
  }
  
  // Nouvelle méthode pour collecter et envoyer les routes
  sendAvailableRoutes(ws) {
    try {
      const routes = this.collectAvailableRoutes();
      
      // Attendre un petit délai avant d'envoyer les routes
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'routes',
          routes: routes,
          config: this.options.prefetch
        }));
        console.log(chalk.blue(`📋 Liste des routes envoyée pour préchargement (${routes.length} routes)`));
      }, this.options.prefetch?.prefetchDelay || 1000);
      
    } catch (error) {
      console.error(chalk.red('❌ Erreur lors de l\'envoi des routes:'), error);
    }
  }
  
  // Méthode pour collecter les routes disponibles
  collectAvailableRoutes() {
    const routes = [];
    
    // Ajouter la page d'accueil par défaut
    routes.push('/');
    
    // Essayer de collecter les routes Express enregistrées
    try {
      // Récupérer les routes de l'application Express
      const stack = this.app._router?.stack || [];
      
      // Parcourir la pile des middleware pour trouver les routes
      stack.forEach(layer => {
        if (layer.route) {
          const path = layer.route.path;
          if (path && !routes.includes(path)) {
            routes.push(path);
          }
        } else if (layer.name === 'router' && layer.handle.stack) {
          // Parcourir les sous-routeurs
          layer.handle.stack.forEach(routerLayer => {
            if (routerLayer.route) {
              const path = routerLayer.route.path;
              if (path && !routes.includes(path)) {
                routes.push(path);
              }
            }
          });
        }
      });
    } catch (error) {
      console.log(chalk.yellow('⚠️ Impossible de scanner automatiquement les routes'));
    }
    
    // Essayer de collecter les routes depuis un fichier de routes personnalisé
    try {
      const routesPath = path.join(this.options.projectRoot, 'routes', 'index.js');
      if (fs.existsSync(routesPath)) {
        // Le fichier existe, on peut l'importer
        delete require.cache[require.resolve(routesPath)]; // Vider le cache pour recharger
        const routesModule = require(routesPath);
        
        if (routesModule && routesModule.prefetchRoutes && Array.isArray(routesModule.prefetchRoutes)) {
          routes.push(...routesModule.prefetchRoutes);
        }
      }
    } catch (error) {
      // Ignorer les erreurs, on utilise juste les routes qu'on connaît
    }
    
    // Éliminer les doublons et retourner les routes uniques
    return [...new Set(routes)];
  }
  
  async setupFileWatching() {
    const watchPaths = this.options.watchDirs.map(dir => 
      path.join(this.options.projectRoot, dir)
    );
    
    watchPaths.forEach(watchPath => {
      const watcher = chokidar.watch(watchPath, {
        ignored: /node_modules/,
        persistent: true,
        ignoreInitial: true
      });
      
      watcher.on('change', (filePath) => {
        console.log(chalk.yellow(`📝 Fichier modifié: ${path.relative(this.options.projectRoot, filePath)}`));
        this.broadcast({ type: 'reload' });
      });
      
      watcher.on('add', (filePath) => {
        console.log(chalk.green(`➕ Fichier ajouté: ${path.relative(this.options.projectRoot, filePath)}`));
        this.broadcast({ type: 'reload' });
      });
      
      watcher.on('unlink', (filePath) => {
        console.log(chalk.red(`🗑️ Fichier supprimé: ${path.relative(this.options.projectRoot, filePath)}`));
        this.broadcast({ type: 'reload' });
      });
      
      this.watchers.push(watcher);
    });
  }
  
  setupExpressApp() {
    // Configuration Express + EJS simplifiée
    this.app.set('view engine', 'ejs');
    this.app.set('views', [
      path.join(this.options.projectRoot, 'views'),
      path.join(__dirname, '..', 'views'),
      path.join(__dirname, '..', 'error')
    ]);
    
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(this.options.projectRoot, 'public')));
    
    // Middleware de développement
    this.app.use(this.devMiddleware());
    this.app.use(this.injectReloadScript());
    
    // Chargement automatique des routes
    this.loadRoutes();
    
    // Gestionnaire d'erreurs
    this.setupErrorHandling();
  }
  
  loadRoutes() {
    // Si un fichier personnalisé est spécifié
    if (this.options.customEntryFile) {
      try {
        delete require.cache[require.resolve(this.options.customEntryFile)];
        const customModule = require(this.options.customEntryFile);
        
        if (typeof customModule === 'function') {
          customModule(this.app);
          console.log(chalk.green(`📁 Routes chargées depuis ${path.basename(this.options.customEntryFile)}`));
        }
      } catch (error) {
        console.error(chalk.red(`❌ Erreur lors du chargement du fichier ${path.basename(this.options.customEntryFile)}:`), error);
        this.createDefaultRoute();
      }
    } else {
      // Chargement automatique du dossier routes
      this.autoLoadRoutes();
    }
  }
  
  autoLoadRoutes() {
    const routesPath = path.join(this.options.projectRoot, 'routes');
    
    if (!fs.existsSync(routesPath)) {
      console.log(chalk.yellow('⚠️ Dossier routes non trouvé, création de la route par défaut'));
      this.createDefaultRoute();
      return;
    }

    try {
      this.scanRoutesDirectory(routesPath, routesPath);
      console.log(chalk.green('📁 Routes chargées automatiquement depuis le dossier routes/'));
    } catch (error) {
      console.error(chalk.red('❌ Erreur lors du chargement automatique des routes:'), error);
      this.createDefaultRoute();
    }
  }
  
  scanRoutesDirectory(dirPath, basePath) {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Scanner récursivement les sous-dossiers
        this.scanRoutesDirectory(filePath, basePath);
      } else if (file.endsWith('.js')) {
        this.loadRouteFile(filePath, basePath);
      }
    });
  }
  
  loadRouteFile(filePath, basePath) {
    try {
      // Vider le cache pour permettre le rechargement
      delete require.cache[require.resolve(filePath)];
      
      const routeModule = require(filePath);
      
      // Calculer le chemin de la route basé sur la structure des dossiers
      const relativePath = path.relative(basePath, filePath);
      const routePath = this.filePathToRoute(relativePath);
      
      if (typeof routeModule === 'function') {
        // Si c'est une fonction, l'appeler avec l'app
        routeModule(this.app);
      } else if (routeModule.get || routeModule.post || routeModule.put || routeModule.delete) {
        // Si c'est un objet avec des méthodes HTTP
        this.setupRouteHandlers(routePath, routeModule);
      }
      
      console.log(chalk.cyan(`🔗 Route: ${filePath} -> ${routePath}`));
    } catch (error) {
      console.error(chalk.red(`❌ Erreur route ${filePath}:`), error.message);
    }
  }
  
  filePathToRoute(filePath) {
    // Convertir le chemin de fichier en route
    let route = filePath
      .replace(/\\/g, '/') // Remplacer les backslashes par des slashes
      .replace(/\.js$/, '') // Enlever l'extension .js
      .replace(/\/index$/, '') // Enlever /index à la fin
      .replace(/\[([^\]]+)\]/g, ':$1'); // Convertir [param] en :param
    
    // Ajouter le slash initial si nécessaire
    if (!route.startsWith('/')) {
      route = '/' + route;
    }
    
    // Si la route est vide, utiliser '/'
    if (route === '/' || route === '') {
      return '/';
    }
    
    return route;
  }
  
  setupRouteHandlers(routePath, handlers) {
    // Configurer les handlers pour chaque méthode HTTP
    if (handlers.get) this.app.get(routePath, handlers.get);
    if (handlers.post) this.app.post(routePath, handlers.post);
    if (handlers.put) this.app.put(routePath, handlers.put);
    if (handlers.delete) this.app.delete(routePath, handlers.delete);
    if (handlers.patch) this.app.patch(routePath, handlers.patch);
  }
  
  devMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const color = status >= 400 ? 'red' : status >= 300 ? 'yellow' : 'green';
        
        console.log(
          chalk[color](`${req.method} ${req.url} - ${status} - ${duration}ms`)
        );
      });
      
      next();
    };
  }
  
  injectReloadScript() {
    const wsPort = this.options.wsPort;
    
    return (req, res, next) => {
      const originalRender = res.render;
      const originalSend = res.send;
      
      // First, handle the case where res.render is used
      res.render = function(view, locals, callback) {
        const reloadScript = `
          <script src="https://cdn.tailwindcss.com"></script>
          <script>
            (function() {
              let reconnectTimer;
              let reconnectAttempts = 0;
              let ws;
              let prefetchedPages = new Set();
              let pageCache = new Map();
              let prefetchConfig = null;
              
              function connectWebSocket() {
                ws = new WebSocket('ws://localhost:${wsPort}');
                
                // Créer le conteneur des notifications
                function ensureNotificationContainer() {
                  let container = document.getElementById('veko-notification-container');
                  if (!container) {
                    container = document.createElement('div');
                    container.id = 'veko-notification-container';
                    container.className = 'fixed top-4 right-4 z-50 space-y-3 max-w-md w-full pointer-events-none';
                    document.body.appendChild(container);
                  }
                  return container;
                }
                
                // Afficher une notification stylisée  
                function showNotification(options) {
                  const { title, message, type = 'info', duration = 5000, progress = true } = options;
                  const container = ensureNotificationContainer();
                  
                  // Définir les couleurs et icônes selon le type
                  const styles = {
                    info: { bg: 'bg-blue-500', icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' },
                    success: { bg: 'bg-emerald-500', icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' },
                    warning: { bg: 'bg-amber-500', icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>' },
                    error: { bg: 'bg-red-500', icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' },
                    loading: { bg: 'bg-indigo-500', icon: '<svg class="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' }
                  };
                  
                  const style = styles[type] || styles.info;
                  
                  // Créer l'élément de notification
                  const notification = document.createElement('div');
                  notification.className = \`transform translate-x-full transition-all duration-300 backdrop-blur-md \${style.bg} text-white rounded-xl shadow-xl overflow-hidden pointer-events-auto flex flex-col max-w-md\`;
                  
                  // Contenu de la notification
                  notification.innerHTML = \`
                    <div class="flex p-4">
                      <div class="flex-shrink-0">
                        \${style.icon}
                      </div>
                      <div class="ml-3 flex-1">
                        \${title ? \`<p class="font-medium">\${title}</p>\` : ''}
                        \${message ? \`<p class="text-sm \${title ? 'mt-1 opacity-90' : ''}">\${message}</p>\` : ''}
                      </div>
                      <div class="ml-4 flex-shrink-0 flex">
                        <button class="inline-flex text-white focus:outline-none hover:text-white/70">
                          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    \${progress ? \`<div class="h-1 w-full bg-white/20"><div class="h-1 bg-white/60 progress-bar"></div></div>\` : ''}
                  \`;
                  
                  container.appendChild(notification);
                  
                  // Animation d'entrée
                  setTimeout(() => {
                    notification.style.transform = 'translateX(0)';
                  }, 10);
                  
                  // Fermeture au clic
                  const closeButton = notification.querySelector('button');
                  closeButton.addEventListener('click', () => {
                    closeNotification(notification);
                  });
                  
                  // Animation de la barre de progression
                  if (progress && duration > 0) {
                    const progressBar = notification.querySelector('.progress-bar');
                    if (progressBar) {
                      progressBar.style.transition = \`width \${duration}ms linear\`;
                      setTimeout(() => {
                        progressBar.style.width = '0%';
                      }, 10);
                    }
                    
                    // Auto-fermeture après le délai
                    setTimeout(() => {
                      closeNotification(notification);
                    }, duration);
                  }
                  
                  return notification;
                }
                
                // Animation de fermeture
                function closeNotification(notification) {
                  notification.style.opacity = '0';
                  notification.style.transform = 'translateX(100%)';
                  setTimeout(() => {
                    notification.remove();
                  }, 300);
                }
                
                // Fonction pour précharger les routes
                function prefetchRoutes(routes, config) {
                  prefetchConfig = config;
                  
                  // Si le préchargement est désactivé, on s'arrête là
                  if (!config.enabled) return;
                  
                  if (config.notifyUser) {
                    showNotification({
                      title: 'Préchargement',
                      message: 'Optimisation de la navigation...',
                      type: 'loading',
                      duration: 3000
                    });
                  }
                  
                  console.log('🚀 Préchargement des routes:', routes);
                  
                  // Limiter le nombre de préchargements simultanés
                  const MAX_CONCURRENT = config.maxConcurrent || 3;
                  let active = 0;
                  let queue = [...routes];
                  let successCount = 0;
                  
                  function loadNext() {
                    if (queue.length === 0 || active >= MAX_CONCURRENT) return;
                    
                    const route = queue.shift();
                    if (prefetchedPages.has(route)) return loadNext();
                    
                    active++;
                    prefetchedPages.add(route);
                    
                    fetch(route)
                      .then(response => {
                        if (!response.ok) {
                          throw new Error('Erreur HTTP: ' + response.status);
                        }
                        return response.text();
                      })
                      .then(html => {
                        if (config.cacheRoutes) {
                          pageCache.set(route, html);
                        }
                        successCount++;
                        console.log(\`✅ Page préchargée: \${route}\`);
                      })
                      .catch(error => {
                        console.error(\`❌ Erreur de préchargement pour \${route}:\`, error);
                        prefetchedPages.delete(route);
                      })
                      .finally(() => {
                        active--;
                        setTimeout(loadNext, 50); // Petit délai pour ne pas surcharger le serveur
                      });
                    
                    // Lancer le prochain préchargement
                    loadNext();
                  }
                  
                  // Démarrer le préchargement après un court délai
                  setTimeout(() => {
                    // Démarrer le préchargement
                    for (let i = 0; i < MAX_CONCURRENT; i++) {
                      loadNext();
                    }
                    
                    // Attendre que tout soit préchargé et afficher une notification
                    const checkInterval = setInterval(() => {
                      if (active === 0 && queue.length === 0) {
                        clearInterval(checkInterval);
                        
                        if (config.notifyUser && successCount > 0) {
                          showNotification({
                            title: 'Navigation optimisée',
                            message: \`\${successCount} pages préchargées\`,
                            type: 'success',
                            duration: 3000
                          });
                        }
                        
                        // Ajouter l'interception des clics sur les liens si le cache est activé
                        if (config.cacheRoutes) {
                          interceptClicks();
                        }
                      }
                    }, 500);
                  }, 100);
                }
                
                // Intercepter les clics sur les liens pour utiliser le cache
                function interceptClicks() {
                  if (document.vekoPrefetchInitialized) return;
                  document.vekoPrefetchInitialized = true;
                  
                  document.addEventListener('click', function(event) {
                    // Vérifier si c'est un clic sur un lien
                    const link = event.target.closest('a');
                    if (!link) return;
                    
                    const href = link.getAttribute('href');
                    if (!href || 
                        href.startsWith('#') || 
                        href.startsWith('http') || 
                        href.startsWith('mailto:') ||
                        href.startsWith('tel:')) return;
                    
                    // Vérifier si la page est dans le cache
                    if (pageCache.has(href)) {
                      event.preventDefault();
                      
                      // Mettre à jour l'historique
                      history.pushState({}, '', href);
                      
                      // Remplacer le contenu de la page
                      setTimeout(() => {
                        const cachedHtml = pageCache.get(href);
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(cachedHtml, 'text/html');
                        
                        // Remplacer uniquement le contenu principal pour éviter de recharger les scripts
                        const currentMain = document.querySelector('main') || document.body;
                        const newMain = doc.querySelector('main') || doc.body;
                        
                        if (currentMain && newMain) {
                          // Animation de transition
                          currentMain.style.opacity = '0.5';
                          setTimeout(() => {
                            currentMain.innerHTML = newMain.innerHTML;
                            document.title = doc.title;
                            currentMain.style.opacity = '1';
                            
                            // Afficher une notification subtile
                            showNotification({
                              title: 'Navigation instantanée',
                              message: 'Chargé depuis le cache local',
                              type: 'info',
                              duration: 1500
                            });
                          }, 100);
                        } else {
                          // Si on ne peut pas identifier le contenu principal, recharger normalement
                          window.location.href = href;
                        }
                      }, 10);
                    }
                  });
                  
                  // Gérer l'historique de navigation
                  window.addEventListener('popstate', () => {
                    if (pageCache.has(window.location.pathname)) {
                      const cachedHtml = pageCache.get(window.location.pathname);
                      const parser = new DOMParser();
                      const doc = parser.parseFromString(cachedHtml, 'text/html');
                      
                      const currentMain = document.querySelector('main') || document.body;
                      const newMain = doc.querySelector('main') || doc.body;
                      
                      if (currentMain && newMain) {
                        currentMain.style.opacity = '0.5';
                        setTimeout(() => {
                          currentMain.innerHTML = newMain.innerHTML;
                          document.title = doc.title;
                          currentMain.style.opacity = '1';
                        }, 100);
                      } else {
                        window.location.reload();
                      }
                    } else {
                      window.location.reload();
                    }
                  });
                }
                
                // Afficher l'état de connexion
                function updateConnectionStatus(status) {
                  let container = document.getElementById('veko-connection-status');
                  
                  if (!container) {
                    container = document.createElement('div');
                    container.id = 'veko-connection-status';
                    container.className = 'fixed bottom-4 right-4 z-50 transition-all duration-300 opacity-0 transform translate-y-2';
                    document.body.appendChild(container);
                  }
                  
                  const statusStyles = {
                    connected: 'bg-emerald-500 text-white',
                    disconnected: 'bg-red-500 text-white',
                    connecting: 'bg-amber-500 text-white'
                  };
                  
                  const statusIcons = {
                    connected: '<svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>',
                    disconnected: '<svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>',
                    connecting: '<svg class="w-4 h-4 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>'
                  };
                  
                  const statusMessages = {
                    connected: 'Connecté au serveur',
                    disconnected: 'Déconnecté',
                    connecting: 'Reconnexion...'
                  };
                  
                  container.className = \`fixed bottom-4 right-4 z-50 px-3 py-2 rounded-full text-xs font-medium flex items-center shadow-lg backdrop-blur-sm transition-all duration-300 \${statusStyles[status]}\`;
                  
                  container.innerHTML = \`\${statusIcons[status]} \${statusMessages[status]}\`;
                  
                  // Afficher avec animation
                  setTimeout(() => {
                    container.style.opacity = '1';
                    container.style.transform = 'translateY(0)';
                  }, 10);
                  
                  // Cacher après un délai si connecté
                  if (status === 'connected') {
                    setTimeout(() => {
                      container.style.opacity = '0.7';
                      container.style.transform = 'translateY(5px)';
                    }, 3000);
                    
                    setTimeout(() => {
                      container.style.opacity = '0';
                    }, 4000);
                  }
                }
                
                // Gestion des événements WebSocket
                ws.onopen = function() {
                  console.log('🔗 Auto-refresh connecté');
                  updateConnectionStatus('connected');
                  reconnectAttempts = 0;
                };
                
                ws.onclose = function() {
                  console.log('🔌 Auto-refresh déconnecté');
                  updateConnectionStatus('disconnected');
                  
                  // Tentative de reconnexion
                  clearTimeout(reconnectTimer);
                  reconnectTimer = setTimeout(() => {
                    reconnectAttempts++;
                    const delay = Math.min(reconnectAttempts * 1000, 5000);
                    console.log(\`🔄 Tentative de reconnexion dans \${delay/1000}s...\`);
                    updateConnectionStatus('connecting');
                    connectWebSocket();
                  }, Math.min(reconnectAttempts * 1000, 5000));
                };
                
                ws.onmessage = function(event) {
                  const data = JSON.parse(event.data);
                  
                  if (data.type === 'reload') {
                    console.log('🔄 Rechargement automatique...');
                    showNotification({
                      title: 'Rechargement',
                      message: 'Mise à jour du code détectée',
                      type: 'loading',
                      duration: 1000
                    });
                    
                    setTimeout(() => {
                      window.location.reload();
                    }, 800);
                  } 
                  else if (data.type === 'error') {
                    console.error('❌ Erreur serveur:', data.message);
                    showNotification({
                      title: 'Erreur Serveur',
                      message: data.message,
                      type: 'error',
                      duration: 8000
                    });
                  }
                  else if (data.type === 'connected') {
                    console.log('✅ WebSocket connecté:', data.message);
                    showNotification({
                      title: 'Serveur Veko.js',
                      message: data.message,
                      type: 'success',
                      duration: 3000
                    });
                  }
                  else if (data.type === 'routes') {
                    console.log('📋 Liste des routes reçue:', data.routes);
                    prefetchRoutes(data.routes, data.config);
                  }
                };
                
                ws.onerror = function(error) {
                  console.error('❌ Erreur WebSocket:', error);
                };
              }
              
              // Démarrer la connexion WebSocket
              connectWebSocket();
              
              // S'assurer que la connexion est fermée quand la page est déchargée
              window.addEventListener('beforeunload', () => {
                if (ws) ws.close();
              });
              
              // Ajouter des styles globaux pour les notifications
              const styleElement = document.createElement('style');
              styleElement.textContent = \`
                @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.5; }
                }
                
                @keyframes float {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-10px); }
                }
                
                @keyframes shrink {
                  from { width: 100%; }
                  to { width: 0%; }
                }
                
                .animate-pulse-slow {
                  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                
                .animate-float {
                  animation: float 3s ease-in-out infinite;
                }
                
                .progress-bar {
                  width: 100%;
                }
              \`;
              document.head.appendChild(styleElement);
            })();
          </script>
        `;
        
        if (typeof locals === 'function') {
          callback = locals;
          locals = {};
        }
        
        locals = locals || {};
        locals.reloadScript = reloadScript;
        
        originalRender.call(this, view, locals, callback);
      };
      
      // Second, intercept res.send to inject the script into HTML responses
      res.send = function(body) {
        if (body && typeof body === 'string' && body.indexOf('<!DOCTYPE html>') !== -1) {
          // Only modify HTML responses
          const reloadScript = `
            <script src="https://cdn.tailwindcss.com"></script>
            <script>
              (function() {
                let reconnectTimer;
                let reconnectAttempts = 0;
                let ws;
                let prefetchedPages = new Set();
                let pageCache = new Map();
                let prefetchConfig = null;
                
                function connectWebSocket() {
                  ws = new WebSocket('ws://localhost:${wsPort}');
                  
                  // Créer le conteneur des notifications
                  function ensureNotificationContainer() {
                    let container = document.getElementById('veko-notification-container');
                    if (!container) {
                      container = document.createElement('div');
                      container.id = 'veko-notification-container';
                      container.className = 'fixed top-4 right-4 z-50 space-y-3 max-w-md w-full pointer-events-none';
                      document.body.appendChild(container);
                    }
                    return container;
                  }
                  
                  // Afficher une notification stylisée  
                  function showNotification(options) {
                    const { title, message, type = 'info', duration = 5000, progress = true } = options;
                    const container = ensureNotificationContainer();
                    
                    // Définir les couleurs et icônes selon le type
                    const styles = {
                      info: { bg: 'bg-blue-500', icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' },
                      success: { bg: 'bg-emerald-500', icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' },
                      warning: { bg: 'bg-amber-500', icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>' },
                      error: { bg: 'bg-red-500', icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' },
                      loading: { bg: 'bg-indigo-500', icon: '<svg class="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' }
                    };
                    
                    const style = styles[type] || styles.info;
                    
                    // Créer l'élément de notification
                    const notification = document.createElement('div');
                    notification.className = \`transform translate-x-full transition-all duration-300 backdrop-blur-md \${style.bg} text-white rounded-xl shadow-xl overflow-hidden pointer-events-auto flex flex-col max-w-md\`;
                    
                    // Contenu de la notification
                    notification.innerHTML = \`
                      <div class="flex p-4">
                        <div class="flex-shrink-0">
                          \${style.icon}
                        </div>
                        <div class="ml-3 flex-1">
                            \${title ? \`<p class="font-medium">\${title}</p>\` : ''}
                            \${message ? \`<p class="text-sm \${title ? 'mt-1 opacity-90' : ''}">\${message}</p>\` : ''}
                        </div>
                        <div class="ml-4 flex-shrink-0 flex">
                          <button class="inline-flex text-white focus:outline-none hover:text-white/70">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      \${progress ? \`<div class="h-1 w-full bg-white/20"><div class="h-1 bg-white/60 progress-bar"></div></div>\` : ''}
                    \`;
                    
                    container.appendChild(notification);
                    
                    // Animation d'entrée
                    setTimeout(() => {
                      notification.style.transform = 'translateX(0)';
                    }, 10);
                    
                    // Fermeture au clic
                    const closeButton = notification.querySelector('button');
                    closeButton.addEventListener('click', () => {
                      closeNotification(notification);
                    });
                    
                    // Animation de la barre de progression
                    if (progress && duration > 0) {
                      const progressBar = notification.querySelector('.progress-bar');
                      if (progressBar) {
                        progressBar.style.transition = \`width \${duration}ms linear\`;
                        setTimeout(() => {
                          progressBar.style.width = '0%';
                        }, 10);
                      }
                      
                      // Auto-fermeture après le délai
                      setTimeout(() => {
                        closeNotification(notification);
                      }, duration);
                    }
                    
                    return notification;
                  }
                  
                  // Animation de fermeture
                  function closeNotification(notification) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                      notification.remove();
                    }, 300);
                  }
                  
                  // Fonction pour précharger les routes
                  function prefetchRoutes(routes, config) {
                    prefetchConfig = config;
                    
                    // Si le préchargement est désactivé, on s'arrête là
                    if (!config.enabled) return;
                    
                    if (config.notifyUser) {
                      showNotification({
                        title: 'Préchargement',
                        message: 'Optimisation de la navigation...',
                        type: 'loading',
                        duration: 3000
                      });
                    }
                    
                    console.log('🚀 Préchargement des routes:', routes);
                    
                    // Limiter le nombre de préchargements simultanés
                    const MAX_CONCURRENT = config.maxConcurrent || 3;
                    let active = 0;
                    let queue = [...routes];
                    let successCount = 0;
                    
                    function loadNext() {
                      if (queue.length === 0 || active >= MAX_CONCURRENT) return;
                      
                      const route = queue.shift();
                      if (prefetchedPages.has(route)) return loadNext();
                      
                      active++;
                      prefetchedPages.add(route);
                      
                      fetch(route)
                        .then(response => {
                          if (!response.ok) {
                            throw new Error('Erreur HTTP: ' + response.status);
                          }
                          return response.text();
                        })
                        .then(html => {
                          if (config.cacheRoutes) {
                            pageCache.set(route, html);
                          }
                          successCount++;
                          console.log(\`✅ Page préchargée: \${route}\`);
                        })
                        .catch(error => {
                          console.error(\`❌ Erreur de préchargement pour \${route}:\`, error);
                          prefetchedPages.delete(route);
                        })
                        .finally(() => {
                          active--;
                          setTimeout(loadNext, 50); // Petit délai pour ne pas surcharger le serveur
                        });
                      
                      // Lancer le prochain préchargement
                      loadNext();
                    }
                    
                    // Démarrer le préchargement après un court délai
                    setTimeout(() => {
                      // Démarrer le préchargement
                      for (let i = 0; i < MAX_CONCURRENT; i++) {
                        loadNext();
                      }
                      
                      // Attendre que tout soit préchargé et afficher une notification
                      const checkInterval = setInterval(() => {
                        if (active === 0 && queue.length === 0) {
                          clearInterval(checkInterval);
                          
                          if (config.notifyUser && successCount > 0) {
                            showNotification({
                              title: 'Navigation optimisée',
                              message: \`\${successCount} pages préchargées\`,
                              type: 'success',
                              duration: 3000
                            });
                          }
                          
                          // Ajouter l'interception des clics sur les liens si le cache est activé
                          if (config.cacheRoutes) {
                            interceptClicks();
                          }
                        }
                      }, 500);
                    }, 100);
                  }
                  
                  // Intercepter les clics sur les liens pour utiliser le cache
                  function interceptClicks() {
                    if (document.vekoPrefetchInitialized) return;
                    document.vekoPrefetchInitialized = true;
                    
                    document.addEventListener('click', function(event) {
                      // Vérifier si c'est un clic sur un lien
                      const link = event.target.closest('a');
                      if (!link) return;
                      
                      const href = link.getAttribute('href');
                      if (!href || 
                          href.startsWith('#') || 
                          href.startsWith('http') || 
                          href.startsWith('mailto:') ||
                          href.startsWith('tel:')) return;
                      
                      // Vérifier si la page est dans le cache
                      if (pageCache.has(href)) {
                        event.preventDefault();
                        
                        // Mettre à jour l'historique
                        history.pushState({}, '', href);
                        
                        // Remplacer le contenu de la page
                        setTimeout(() => {
                          const cachedHtml = pageCache.get(href);
                          const parser = new DOMParser();
                          const doc = parser.parseFromString(cachedHtml, 'text/html');
                          
                          // Remplacer uniquement le contenu principal pour éviter de recharger les scripts
                          const currentMain = document.querySelector('main') || document.body;
                          const newMain = doc.querySelector('main') || doc.body;
                          
                          if (currentMain && newMain) {
                            // Animation de transition
                            currentMain.style.opacity = '0.5';
                            setTimeout(() => {
                              currentMain.innerHTML = newMain.innerHTML;
                              document.title = doc.title;
                              currentMain.style.opacity = '1';
                              
                              // Afficher une notification subtile
                              showNotification({
                                title: 'Navigation instantanée',
                                message: 'Chargé depuis le cache local',
                                type: 'info',
                                duration: 1500
                              });
                            }, 100);
                          } else {
                            // Si on ne peut pas identifier le contenu principal, recharger normalement
                            window.location.href = href;
                          }
                        }, 10);
                      }
                    });
                    
                    // Gérer l'historique de navigation
                    window.addEventListener('popstate', () => {
                      if (pageCache.has(window.location.pathname)) {
                        const cachedHtml = pageCache.get(window.location.pathname);
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(cachedHtml, 'text/html');
                        
                        const currentMain = document.querySelector('main') || document.body;
                        const newMain = doc.querySelector('main') || doc.body;
                        
                        if (currentMain && newMain) {
                          currentMain.style.opacity = '0.5';
                          setTimeout(() => {
                            currentMain.innerHTML = newMain.innerHTML;
                            document.title = doc.title;
                            currentMain.style.opacity = '1';
                          }, 100);
                        } else {
                          window.location.reload();
                        }
                      } else {
                        window.location.reload();
                      }
                    });
                  }
                  
                  // Afficher l'état de connexion
                  function updateConnectionStatus(status) {
                    let container = document.getElementById('veko-connection-status');
                    
                    if (!container) {
                      container = document.createElement('div');
                      container.id = 'veko-connection-status';
                      container.className = 'fixed bottom-4 right-4 z-50 transition-all duration-300 opacity-0 transform translate-y-2';
                      document.body.appendChild(container);
                    }
                    
                    const statusStyles = {
                      connected: 'bg-emerald-500 text-white',
                      disconnected: 'bg-red-500 text-white',
                      connecting: 'bg-amber-500 text-white'
                    };
                    
                    const statusIcons = {
                      connected: '<svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>',
                      disconnected: '<svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>',
                      connecting: '<svg class="w-4 h-4 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>'
                    };
                    
                    const statusMessages = {
                      connected: 'Connecté au serveur',
                      disconnected: 'Déconnecté',
                      connecting: 'Reconnexion...'
                    };
                    
                    container.className = \`fixed bottom-4 right-4 z-50 px-3 py-2 rounded-full text-xs font-medium flex items-center shadow-lg backdrop-blur-sm transition-all duration-300 \${statusStyles[status]}\`;
                    
                    container.innerHTML = \`\${statusIcons[status]} \${statusMessages[status]}\`;
                    
                    // Afficher avec animation
                    setTimeout(() => {
                      container.style.opacity = '1';
                      container.style.transform = 'translateY(0)';
                    }, 10);
                    
                    // Cacher après un délai si connecté
                    if (status === 'connected') {
                      setTimeout(() => {
                        container.style.opacity = '0.7';
                        container.style.transform = 'translateY(5px)';
                      }, 3000);
                      
                      setTimeout(() => {
                        container.style.opacity = '0';
                      }, 4000);
                    }
                  }
                  
                  // Gestion des événements WebSocket
                  ws.onopen = function() {
                    console.log('🔗 Auto-refresh connecté');
                    updateConnectionStatus('connected');
                    reconnectAttempts = 0;
                  };
                  
                  ws.onclose = function() {
                    console.log('🔌 Auto-refresh déconnecté');
                    updateConnectionStatus('disconnected');
                    
                    // Tentative de reconnexion
                    clearTimeout(reconnectTimer);
                    reconnectTimer = setTimeout(() => {
                      reconnectAttempts++;
                      const delay = Math.min(reconnectAttempts * 1000, 5000);
                      console.log(\`🔄 Tentative de reconnexion dans \${delay/1000}s...\`);
                      updateConnectionStatus('connecting');
                      connectWebSocket();
                    }, Math.min(reconnectAttempts * 1000, 5000));
                  };
                  
                  ws.onmessage = function(event) {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'reload') {
                      console.log('🔄 Rechargement automatique...');
                      showNotification({
                        title: 'Rechargement',
                        message: 'Mise à jour du code détectée',
                        type: 'loading',
                        duration: 1000
                      });
                      
                      setTimeout(() => {
                        window.location.reload();
                      }, 800);
                    } 
                    else if (data.type === 'error') {
                      console.error('❌ Erreur serveur:', data.message);
                      showNotification({
                        title: 'Erreur Serveur',
                        message: data.message,
                        type: 'error',
                        duration: 8000
                      });
                    }
                    else if (data.type === 'connected') {
                      console.log('✅ WebSocket connecté:', data.message);
                      showNotification({
                        title: 'Serveur Veko.js',
                        message: data.message,
                        type: 'success',
                        duration: 3000
                      });
                    }
                    else if (data.type === 'routes') {
                      console.log('📋 Liste des routes reçue:', data.routes);
                      prefetchRoutes(data.routes, data.config);
                    }
                  };
                  
                  ws.onerror = function(error) {
                    console.error('❌ Erreur WebSocket:', error);
                  };
                }
                
                // Démarrer la connexion WebSocket
                connectWebSocket();
                
                // S'assurer que la connexion est fermée quand la page est déchargée
                window.addEventListener('beforeunload', () => {
                  if (ws) ws.close();
                });
              })();
            </script>
                `;
                
                // Find the closing </body> tag and insert the script before it
                if (body.includes('</body>')) {
                  body = body.replace('</body>', `${reloadScript}</body>`);
                } else {
                  body += reloadScript;
                }
                return originalSend.call(this, body);
              }
              return originalSend.call(this, body);
            };
            next();
          };
        }
        
        loadRoutes() {
          // Si un fichier personnalisé est spécifié, l'utiliser au lieu de routes/index.js
          if (this.options.customEntryFile) {
            try {
              // Vider le cache pour recharger le module
              delete require.cache[require.resolve(this.options.customEntryFile)];
              
              const customModule = require(this.options.customEntryFile);
              
              if (typeof customModule === 'function') {
                customModule(this.app);
                console.log(chalk.green(`📁 Routes chargées depuis ${path.basename(this.options.customEntryFile)}`));
              } else if (customModule && typeof customModule.setup === 'function') {
                customModule.setup(this.app);
                console.log(chalk.green(`📁 Routes chargées depuis ${path.basename(this.options.customEntryFile)} (méthode setup)`));
              } else {
                console.log(chalk.yellow(`⚠️ Le fichier ${path.basename(this.options.customEntryFile)} a été chargé mais ne définit pas de routes`));
                this.createDefaultRoute();
              }
            } catch (error) {
              console.error(chalk.red(`❌ Erreur lors du chargement du fichier ${path.basename(this.options.customEntryFile)}:`), error);
              this.createDefaultRoute();
            }
          } 
          // Sinon, utiliser le comportement par défaut
          else {
            const routesPath = path.join(this.options.projectRoot, 'routes', 'index.js');
            
            if (fs.existsSync(routesPath)) {
              try {
                delete require.cache[require.resolve(routesPath)];
                const routes = require(routesPath);
                
                if (typeof routes === 'function') {
                  routes(this.app);
                } else if (routes && typeof routes.setup === 'function') {
                  routes.setup(this.app);
                }
                
                console.log(chalk.green('📁 Routes chargées depuis routes/index.js'));
              } catch (error) {
                console.error(chalk.red('❌ Erreur lors du chargement des routes:'), error);
                this.createDefaultRoute();
              }
            } else {
              this.createDefaultRoute();
            }
          }
        }
        
        // Extraire la création de la route par défaut dans une méthode séparée
        createDefaultRoute() {
          this.app.get('/', (req, res) => {
            res.render('index', { 
              title: 'Veko.js - Serveur de développement',
              message: 'Bienvenue dans Veko.js!' 
            });
          });
          
          console.log(chalk.yellow('⚠️ Route par défaut créée'));
        }
        
        startServer() {
          return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.options.port, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
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
        
        stop() {
          // Fermer les watchers
          this.watchers.forEach(watcher => {
            watcher.close();
          });
          
          // Fermer le serveur WebSocket
          if (this.wss) {
            this.wss.close();
          }
          
          // Fermer le serveur Express
          if (this.server) {
            this.server.close();
          }
          
          console.log(chalk.red('🛑 Serveur de développement arrêté'));
        }
      }
      
      module.exports = DevServer;