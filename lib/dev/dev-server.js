const path = require('path');
const fs = require('fs');
const net = require('net');

let chokidar, WebSocket;

try {
  chokidar = require('chokidar');
  WebSocket = require('ws');
} catch (error) {
  console.warn('Dev dependencies not available');
}

class DevServer {
  constructor(app, options) {
    this.app = app;
    this.options = options;
    this.wss = null;
    this.watchers = [];
  }

  async setup() {
    this.setupErrorHandling();
    await this.setupWebSocketServer();
    this.setupFileWatching();
  }

  setupErrorHandling() {
    process.on('uncaughtException', (error) => {
      this.app.logger.log('error', 'Uncaught exception', error.message);
      if (this.wss) {
        this.broadcast({ type: 'error', message: error.message, stack: error.stack });
      }
    });
    
    process.on('unhandledRejection', (reason) => {
      this.app.logger.log('error', 'Unhandled rejection', reason.toString());
      if (this.wss) {
        this.broadcast({ type: 'error', message: reason.toString() });
      }
    });
  }

  /**
   * Check if a port is available
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
   * Find an available port
   */
  async findAvailablePort(startPort, maxAttempts = 50) {
    let port = startPort;
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
      port++;
    }
    throw new Error(`No available WebSocket port found after ${maxAttempts} attempts`);
  }

  async setupWebSocketServer() {
    if (!WebSocket) {
      this.app.logger.log('warning', 'WebSocket module not available', 'Hot reload disabled');
      return;
    }

    // Find available wsPort
    let wsPort = this.options.wsPort;
    try {
      wsPort = await this.findAvailablePort(this.options.wsPort);
      if (wsPort !== this.options.wsPort) {
        this.app.logger.log('info', `WS Port ${this.options.wsPort} occupé`, `✅ Utilisation du port ${wsPort}`);
        this.options.wsPort = wsPort;
      }
    } catch (portError) {
      this.app.logger.log('error', 'Erreur WS port', portError.message);
      return;
    }

    this.wss = new WebSocket.Server({ port: wsPort });
    
    this.wss.on('connection', (ws) => {
      this.app.logger.log('dev', 'Client connected', `WebSocket on port ${wsPort}`);
      
      ws.send(JSON.stringify({ 
        type: 'connected', 
        message: 'Connected to Veko.js server ✨' 
      }));

      if (this.options.prefetch.enabled) {
        this.sendAvailableRoutes(ws);
      }
    });
  }

  setupFileWatching() {
    if (!chokidar) {
      this.app.logger.log('warning', 'Chokidar module not available', 'File watching disabled');
      return;
    }

    const watchPaths = [
      ...this.options.watchDirs.map(dir => path.join(process.cwd(), dir)),
      path.join(process.cwd(), this.options.layouts.layoutsDir)
    ];
    
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
          this.app.logger.log('file', 'File added', `➕ ${path.relative(process.cwd(), filePath)}`);
          this.handleFileChange(filePath);
        });
        
        watcher.on('unlink', (filePath) => {
          this.app.logger.log('file', 'File deleted', `🗑️ ${path.relative(process.cwd(), filePath)}`);
          this.handleFileChange(filePath);
        });
        
        this.watchers.push(watcher);
      }
    });
  }

  handleFileChange(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    this.app.logger.log('file', 'File modified', `📝 ${relativePath}`);
    
    if (this.isRouteFile(filePath)) {
      this.reloadSpecificRoute(filePath);
    } else if (this.isViewFile(filePath)) {
      this.broadcast({ 
        type: 'view-reload', 
        file: relativePath 
      });
      this.app.logger.log('reload', 'View reloaded', `🎨 ${relativePath}`);
    } else if (this.isLayoutFile(filePath)) {
      this.app.layoutManager.reloadLayouts();
      this.broadcast({ 
        type: 'layout-reload', 
        file: relativePath 
      });
      this.app.logger.log('reload', 'Layout reloaded', `🎨 ${relativePath}`);
    } else {
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

  isLayoutFile(filePath) {
    const layoutsPath = path.join(process.cwd(), this.options.layouts.layoutsDir);
    return filePath.startsWith(layoutsPath) && filePath.endsWith(this.options.layouts.extension);
  }

  reloadSpecificRoute(filePath) {
    try {
      delete require.cache[require.resolve(filePath)];
      
      this.removeRouteFromExpress(filePath);
      
      const routesPath = path.join(process.cwd(), this.options.routesDir);
      this.app.routeManager.loadRouteFile(filePath, routesPath);
      
      const relativePath = path.relative(process.cwd(), filePath);
      this.app.logger.log('reload', 'Route reloaded', `🔄 ${relativePath}`);
      
      this.broadcast({ 
        type: 'route-reload', 
        file: relativePath,
        route: this.app.routeManager.routeMap.get(filePath)
      });
      
    } catch (error) {
      this.app.logger.log('error', 'Error reloading route', error.message);
      this.broadcast({ type: 'reload' });
    }
  }

  removeRouteFromExpress(filePath) {
    const routePath = this.app.routeManager.routeMap.get(filePath);
    
    if (routePath && this.app.app._router) {
      this.app.app._router.stack = this.app.app._router.stack.filter(layer => {
        if (layer.route && layer.route.path === routePath) {
          this.app.logger.log('dev', 'Route removed from router', `🗑️ ${routePath}`);
          return false;
        }
        return true;
      });
    }
  }

  sendAvailableRoutes(ws) {
    const routes = this.collectAvailableRoutes();
    
    // Vérifier que le WebSocket est toujours ouvert avant d'envoyer
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'routes',
            routes: routes,
            config: this.options.prefetch
          }));
          this.app.logger.log('dev', 'Routes sent for prefetching', `📋 ${routes.length} routes`);
        } catch (error) {
          this.app.logger.log('error', 'Error sending routes', error.message);
        }
      }
    }, this.options.prefetch.prefetchDelay);
  }

  collectAvailableRoutes() {
    const routes = ['/'];
    
    try {
      const stack = this.app.app._router?.stack || [];
      stack.forEach(layer => {
        if (layer.route) {
          const path = layer.route.path;
          if (path && !routes.includes(path) && typeof path === 'string') {
            // Filtrer les routes internes
            if (!path.startsWith('/_veko')) {
              routes.push(path);
            }
          }
        }
      });
    } catch (error) {
      this.app.logger.log('error', 'Error collecting routes', error.message);
    }
    
    return [...new Set(routes)];
  }

  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        
        let logType = 'info';
        if (status >= 500) logType = 'error';
        else if (status >= 400) logType = 'warning';
        else if (status >= 300) logType = 'info';
        else logType = 'success';
        
        // Éviter le spam de logs pour les assets statiques
        if (!req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i)) {
          this.app.logger.log(logType, `${req.method} ${req.url}`, `${status} - ${duration}ms`);
        }
      });

      // Inject reload script seulement pour les réponses HTML
      const originalSend = res.send;
      const wsPort = this.options.wsPort || 3008;
      
      res.send = function(body) {
        if (typeof body === 'string' && body.includes('</body>') && 
            res.get('Content-Type')?.includes('text/html')) {
          const reloadScript = `
            <script>
              (function() {
                let reconnectAttempts = 0;
                const maxReconnectAttempts = 10;
                
                function connect() {
                  const ws = new WebSocket('ws://localhost:${wsPort}');
                  
                  ws.onopen = () => {
                    console.log('🔗 Veko.js connected');
                    reconnectAttempts = 0;
                  };
                  
                  ws.onmessage = (event) => {
                    try {
                      const data = JSON.parse(event.data);
                      
                      switch(data.type) {
                        case 'reload':
                          console.log('🔄 Full reload...');
                          setTimeout(() => window.location.reload(), 300);
                          break;
                          
                        case 'route-reload':
                          console.log('🔄 Route reloaded:', data.route);
                          if (window.location.pathname === data.route) {
                            setTimeout(() => window.location.reload(), 300);
                          }
                          break;
                          
                        case 'view-reload':
                        case 'layout-reload':
                          console.log('🎨 View/Layout reloaded:', data.file);
                          setTimeout(() => window.location.reload(), 300);
                          break;
                          
                        case 'error':
                          console.error('🚨 Server error:', data.message);
                          break;
                      }
                    } catch (e) {
                      console.error('Failed to parse WebSocket message:', e);
                    }
                  };
                  
                  ws.onclose = () => {
                    console.log('🔌 Veko.js disconnected');
                    if (reconnectAttempts < maxReconnectAttempts) {
                      reconnectAttempts++;
                      setTimeout(connect, 2000);
                    }
                  };
                  
                  ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                  };
                }
                
                connect();
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

  broadcast(data) {
    if (this.wss && WebSocket) {
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify(data));
          } catch (error) {
            this.app.logger.log('error', 'Error broadcasting', error.message);
          }
        }
      });
    }
  }

  stop() {
    // Fermer tous les watchers proprement
    this.watchers.forEach(watcher => {
      try {
        watcher.close();
      } catch (e) {
        // Ignorer les erreurs de fermeture
      }
    });
    this.watchers = [];
    
    // Fermer le serveur WebSocket
    if (this.wss) {
      try {
        this.wss.clients.forEach(client => {
          client.close();
        });
        this.wss.close();
      } catch (e) {
        // Ignorer les erreurs de fermeture
      }
      this.wss = null;
    }
    
    this.app.logger.log('dev', 'Development server stopped', '🛑');
  }
}

module.exports = DevServer;