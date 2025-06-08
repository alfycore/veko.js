const { createServer } = require('http');
const { createServer: createHttpsServer } = require('https');
const EventEmitter = require('events');
const Request = require('./request');
const Response = require('./response');
const Router = require('./router');
const { createLogger } = require('./utils/logger');
const { parseBody } = require('./utils/body-parser');
const { parseCookies } = require('./utils/cookie-parser');
const path = require('path');
const fs = require('fs');
const ErrorHandler = require('./error-handler');

class Application extends EventEmitter {
  constructor() {
    super();
    
    // Configuration de base
    this.settings = new Map();
    this.middlewares = [];
    this.router = new Router();
    this.logger = createLogger();
    this.errorHandler = new ErrorHandler(this); // ✅ Nouveau gestionnaire d'erreurs
    
    // Moteur de rendu
    this.engines = new Map();
    this.viewCache = new Map();
    
    // Sessions et cache
    this.sessionStore = new Map();
    this.cache = new Map();
    
    // Configuration par défaut - ORDRE IMPORTANT
    this.settings.set('env', process.env.NODE_ENV || 'development');
    this.settings.set('port', process.env.PORT || 3000);
    this.settings.set('views', path.join(process.cwd(), 'views'));
    this.settings.set('view engine', 'html');
    this.settings.set('view cache', this.get('env') === 'production');
    this.settings.set('trust proxy', false);
    this.settings.set('jsonp callback name', 'callback');
    this.settings.set('json spaces', this.get('env') === 'production' ? 0 : 2);
    
    this.logger.info('🚀 Veko.js Application initialized');
  }

  // Configuration
  set(setting, value) {
    this.settings.set(setting, value);
    this.logger.debug(`⚙️  Setting: ${setting} = ${value}`);
    return this;
  }

  get(setting) {
    return this.settings.get(setting);
  }

  enabled(setting) {
    return Boolean(this.get(setting));
  }

  disabled(setting) {
    return !this.enabled(setting);
  }

  enable(setting) {
    return this.set(setting, true);
  }

  disable(setting) {
    return this.set(setting, false);
  }

  // Moteur de rendu
  engine(ext, fn) {
    if (typeof ext !== 'string') {
      throw new TypeError('Extension must be a string');
    }
    if (typeof fn !== 'function') {
      throw new TypeError('Engine must be a function');
    }
    
    const extension = ext.startsWith('.') ? ext : `.${ext}`;
    this.engines.set(extension, fn);
    this.logger.debug(`🎨 Template engine registered: ${extension}`);
    return this;
  }

  render(view, data = {}, callback) {
    const startTime = process.hrtime.bigint();

    if (typeof data === 'function') {
      callback = data;
      data = {};
    }

    const viewEngine = this.get('view engine');
    const viewsPath = this.get('views');
    const useCache = this.get('view cache');

    const actualViewsPath = typeof viewsPath === 'string' ? viewsPath : path.join(process.cwd(), 'views');

    let viewPath = view;
    if (!path.isAbsolute(view)) {
      // Correction ici : s'assurer que viewEngine est une string
      const ext = path.extname(view) || (typeof viewEngine === 'string' ? `.${viewEngine}` : '.html');
      viewPath = path.join(actualViewsPath, view + (path.extname(view) ? '' : ext));
    }

    const cacheKey = `view:${viewPath}`;

    try {
      if (useCache && this.viewCache.has(cacheKey)) {
        const template = this.viewCache.get(cacheKey);
        const result = this.renderTemplate(template, data);
        const renderTime = Number(process.hrtime.bigint() - startTime) / 1000000;

        this.logger.debug(`✅ View rendered from cache: ${view} (${renderTime.toFixed(2)}ms)`);

        if (callback) return callback(null, result);
        return result;
      }

      if (!fs.existsSync(viewPath)) {
        const error = new Error(`Template not found: ${viewPath}`);
        error.code = 'ENOENT';
        if (callback) return callback(error);
        throw error;
      }

      const template = fs.readFileSync(viewPath, 'utf8');

      if (useCache) {
        this.viewCache.set(cacheKey, template);
      }

      const result = this.renderTemplate(template, data);
      const renderTime = Number(process.hrtime.bigint() - startTime) / 1000000;

      this.logger.debug(`✅ View rendered: ${view} (${renderTime.toFixed(2)}ms)`);

      if (callback) return callback(null, result);
      return result;

    } catch (error) {
      const renderTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.logger.error(`❌ View rendering failed: ${view} (${renderTime.toFixed(2)}ms)`, {
        error: error.message,
        viewPath
      });

      if (callback) return callback(error);
      throw error;
    }
  }

  renderTemplate(template, data = {}) {
    // Moteur de template simple mais puissant
    return template
      .replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return this.escapeHtml(data[key] || '');
      })
      .replace(/\{\{\{(\w+)\}\}\}/g, (match, key) => {
        return data[key] || '';
      })
      .replace(/\{\{#if (\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, key, content) => {
        return data[key] ? content : '';
      })
      .replace(/\{\{#each (\w+)\}\}(.*?)\{\{\/each\}\}/gs, (match, key, content) => {
        const items = data[key];
        if (!Array.isArray(items)) return '';
        return items.map(item => this.renderTemplate(content, { ...data, ...item })).join('');
      });
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Middleware
  use(path, ...handlers) {
    if (typeof path === 'function') {
      handlers.unshift(path);
      path = '/';
    }
    
    handlers.forEach(handler => {
      if (typeof handler !== 'function') {
        throw new TypeError('Middleware must be a function');
      }
      this.middlewares.push({ path, handler });
    });
    
    this.logger.debug(`🔧 Middleware registered for path: ${path}`);
    return this;
  }

  // Méthodes HTTP - CORRECTION DU BUG
  get(path, ...handlers) { 
    this.router.get(path, ...handlers);
    return this;
  }
  
  post(path, ...handlers) { 
    this.router.post(path, ...handlers);
    return this;
  }
  
  put(path, ...handlers) { 
    this.router.put(path, ...handlers);
    return this;
  }
  
  delete(path, ...handlers) { 
    this.router.delete(path, ...handlers);
    return this;
  }
  
  patch(path, ...handlers) { 
    this.router.patch(path, ...handlers);
    return this;
  }
  
  options(path, ...handlers) { 
    this.router.options(path, ...handlers);
    return this;
  }
  
  head(path, ...handlers) { 
    this.router.head(path, ...handlers);
    return this;
  }
  
  all(path, ...handlers) { 
    this.router.all(path, ...handlers);
    return this;
  }

  // Gestionnaire principal des requêtes
  async handleRequest(req, res) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Créer les objets Request et Response améliorés
      const request = new Request(req, this);
      const response = new Response(res, this);
      
      // Parser les cookies - FIX POUR UNDEFINED
      request.cookies = parseCookies(req.headers.cookie || '');
      
      // Parser le body si nécessaire
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          request.body = await parseBody(req);
        } catch (error) {
          request.body = {};
          this.logger.warn('Failed to parse request body', { error: error.message });
        }
      } else {
        request.body = {};
      }

      // Assurer que headers existe
      if (!request.headers) {
        request.headers = req.headers || {};
      }

      // Exécuter les middlewares
      await this.executeMiddlewares(request, response);
      
      // Exécuter le routeur si la réponse n'a pas été envoyée
      if (!response.headersSent) {
        await this.executeRouter(request, response);
      }
      
      const responseTime = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.logger.request(request, response, responseTime);
      
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  async executeMiddlewares(req, res) {
    for (const middleware of this.middlewares) {
      if (req.path && req.path.startsWith(middleware.path)) {
        await new Promise((resolve, reject) => {
          try {
            middleware.handler(req, res, (error) => {
              if (error) return reject(error);
              resolve();
            });
          } catch (error) {
            reject(error);
          }
        });
        
        // Si la réponse a été envoyée, arrêter
        if (res.headersSent) break;
      }
    }
  }

  async executeRouter(req, res) {
    return new Promise((resolve, reject) => {
      this.router.handle(req, res, (error) => {
        if (error) return reject(error);
        
        // Route non trouvée seulement si aucune réponse n'a été envoyée
        if (!res.headersSent) {
          const error404 = new Error('Not Found');
          error404.status = 404;
          return reject(error404);
        }
        
        resolve();
      });
    });
  }

  handleError(error, req, res) {
    const statusCode = error.status || error.statusCode || 500;
    
    this.logger.error('Application error', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      statusCode
    });

    // Ne pas essayer d'envoyer une réponse si les headers sont déjà envoyés
    if (res.headersSent) return;

    try {
      // Déterminer le format de réponse
      const accept = req.headers.accept || '';
      const wantsJSON = accept.includes('application/json');
      
      if (wantsJSON) {
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: error.message,
          statusCode,
          ...(this.get('env') === 'development' && { stack: error.stack })
        }));
      } else {
        // ✅ Utiliser le gestionnaire d'erreurs amélioré
        try {
          const errorPage = this.errorHandler.generateErrorPage(error, req, statusCode);
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(errorPage);
        } catch (templateError) {
          // Si le template EJS échoue, utiliser un fallback simple
          console.error('Template error:', templateError);
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(`
            <h1>Erreur ${statusCode}</h1>
            <p>${error.message}</p>
            <pre>${this.get('env') === 'development' ? error.stack : ''}</pre>
          `);
        }
      }
    } catch (secondaryError) {
      // Fallback si même la gestion d'erreur échoue
      console.error('Secondary error in error handler:', secondaryError);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  }

  // ✅ Ajouter la méthode listen manquante
  listen(port, hostname, backlog, callback) {
    // Gérer les différentes signatures de la méthode listen
    if (typeof port === 'function') {
      callback = port;
      port = this.get('port');
      hostname = undefined;
    } else if (typeof hostname === 'function') {
      callback = hostname;
      hostname = undefined;
    } else if (typeof backlog === 'function') {
      callback = backlog;
      backlog = undefined;
    }

    // Définir le port par défaut
    port = port || this.get('port') || 3000;
    
    // Créer le serveur HTTP
    const server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Stocker la référence du serveur
    this.server = server;

    // Écouter les événements du serveur
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        this.logger.error(`❌ Port ${port} is already in use`);
      } else if (error.code === 'EACCES') {
        this.logger.error(`❌ Permission denied to bind to port ${port}`);
      } else {
        this.logger.error('❌ Server error:', error);
      }
      this.emit('error', error);
    });

    server.on('listening', () => {
      const addr = server.address();
      const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
      
      this.logger.info(`🚀 Veko.js server listening on ${bind}`);
      this.logger.info(`🌐 Environment: ${this.get('env')}`);
      this.logger.info(`📁 Views directory: ${this.get('views')}`);
      
      this.emit('listening');
      
      if (callback) callback();
    });

    // Démarrer le serveur
    if (hostname) {
      return server.listen(port, hostname, backlog);
    } else {
      return server.listen(port, backlog);
    }
  }

  // ✅ Ajouter une méthode pour créer un serveur HTTPS
  createHttpsServer(options, port, hostname, callback) {
    if (!options || !options.key || !options.cert) {
      throw new Error('HTTPS options must include key and cert');
    }

    if (typeof port === 'function') {
      callback = port;
      port = this.get('port') || 3443;
      hostname = undefined;
    } else if (typeof hostname === 'function') {
      callback = hostname;
      hostname = undefined;
    }

    const server = createHttpsServer(options, (req, res) => {
      this.handleRequest(req, res);
    });

    this.httpsServer = server;

    server.on('error', (error) => {
      this.logger.error('❌ HTTPS Server error:', error);
      this.emit('error', error);
    });

    server.on('listening', () => {
      const addr = server.address();
      const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
      
      this.logger.info(`🔒 Veko.js HTTPS server listening on ${bind}`);
      this.emit('https-listening');
      
      if (callback) callback();
    });

    if (hostname) {
      return server.listen(port, hostname);
    } else {
      return server.listen(port);
    }
  }

  // ✅ Méthode pour arrêter le serveur proprement
  close(callback) {
    const servers = [];
    
    if (this.server) {
      servers.push(this.server);
    }
    if (this.httpsServer) {
      servers.push(this.httpsServer);
    }

    if (servers.length === 0) {
      if (callback) callback();
      return;
    }

    let closed = 0;
    const total = servers.length;

    servers.forEach(server => {
      server.close((error) => {
        closed++;
        if (error) {
          this.logger.error('Error closing server:', error);
        }
        
        if (closed === total) {
          this.logger.info('🛑 All servers closed');
          this.emit('close');
          if (callback) callback(error);
        }
      });
    });
  }

  // ✅ Méthode pour obtenir l'adresse du serveur
  address() {
    if (this.server) {
      return this.server.address();
    }
    return null;
  }

  // ✅ Méthode pour vérifier si le serveur écoute
  listening() {
    return this.server ? this.server.listening : false;
  }
}

module.exports = Application;