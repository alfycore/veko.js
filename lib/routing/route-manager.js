const path = require('path');
const fs = require('fs');
const validator = require('validator');
const crypto = require('crypto');

class RouteManager {
  constructor(app, options) {
    this.app = app;
    this.options = options;
    this.routeMap = new Map();
    this.dynamicRoutes = new Map();
    
    // Limite le nombre de routes dynamiques pour éviter les attaques
    this.maxDynamicRoutes = options.maxDynamicRoutes || 1000;
    this.rateLimitCache = new Map();
    this.allowedMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
    
    // Cache pour optimisation
    this.methodsCache = new Map();
    this.pathValidationCache = new Map();
    
    // Configuration de sécurité
    this.securityConfig = {
      maxParamLength: options.maxParamLength || 1000,
      maxPathLength: options.maxPathLength || 500,
      rateLimitWindow: options.rateLimitWindow || 60000,
      rateLimitMax: options.rateLimitMax || 100,
      enableSecurityHeaders: options.enableSecurityHeaders !== false,
      contentSecurityPolicy: options.contentSecurityPolicy || "default-src 'self'"
    };
    
    // Démarrer le nettoyage périodique
    this.startCacheCleanup();
  }

  // Validation sécurisée et optimisée des paramètres
  validateRouteInput(method, path, handler) {
    // Cache key pour éviter les revalidations
    const cacheKey = `${method}:${path}:${typeof handler}`;
    if (this.pathValidationCache.has(cacheKey)) {
      const cached = this.pathValidationCache.get(cacheKey);
      return { ...cached, handler }; // Handler peut changer
    }

    // Validation de la méthode HTTP
    if (!method || typeof method !== 'string') {
      throw new Error('Méthode HTTP invalide');
    }
    
    const normalizedMethod = method.toLowerCase();
    if (!this.allowedMethods.includes(normalizedMethod)) {
      throw new Error(`Méthode HTTP non autorisée: ${method}`);
    }

    // Validation du chemin
    if (!path || typeof path !== 'string') {
      throw new Error('Chemin de route invalide');
    }

    // Validation contre les attaques par traversée de chemin et injections
    if (this.containsDangerousPatterns(path)) {
      throw new Error('Chemin de route contient des caractères dangereux');
    }

    // Limite la longueur du chemin
    if (path.length > this.securityConfig.maxPathLength) {
      throw new Error(`Chemin de route trop long (max: ${this.securityConfig.maxPathLength})`);
    }

    // Validation du handler
    if (!handler || (typeof handler !== 'function' && !Array.isArray(handler))) {
      throw new Error('Handler de route invalide');
    }

    if (Array.isArray(handler)) {
      handler.forEach((h, index) => {
        if (typeof h !== 'function') {
          throw new Error(`Handler ${index} n'est pas une fonction`);
        }
      });
    }

    const result = { method: normalizedMethod, path: this.sanitizePath(path) };
    
    // Cache le résultat (sans le handler)
    this.pathValidationCache.set(cacheKey, result);
    
    return { ...result, handler };
  }

  // Détection optimisée de patterns dangereux
  containsDangerousPatterns(path) {
    const dangerousPatterns = [
      /\.\./,                    // Path traversal
      /[\\]/,                    // Backslashes
      /[<>\"'`]/,               // HTML/JS injection
      /javascript:/i,            // JavaScript protocol
      /data:/i,                  // Data URLs
      /vbscript:/i,             // VBScript
      /on\w+=/i,                // Event handlers
      /eval\s*\(/i,             // eval calls
      /expression\s*\(/i,       // CSS expressions
      /url\s*\(/i               // CSS URLs
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(path));
  }

  // Nettoyage sécurisé et optimisé du chemin
  sanitizePath(routePath) {
    // Normalise et nettoie le chemin
    let cleaned = routePath.trim();
    
    // Supprime les caractères de contrôle
    cleaned = cleaned.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
    
    // Décode les entités HTML/URL
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch (e) {
      // Si le décodage échoue, utiliser la chaîne originale
    }
    
    // Assure que le chemin commence par /
    if (!cleaned.startsWith('/')) {
      cleaned = '/' + cleaned;
    }
    
    // Normalise les slashes multiples
    cleaned = cleaned.replace(/\/+/g, '/');
    
    // Retire les trailing slashes sauf pour la racine
    if (cleaned.length > 1 && cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    
    return cleaned;
  }

  // Rate limiting amélioré avec sliding window
  checkRateLimit(clientId = 'default', customLimits = {}) {
    const now = Date.now();
    const windowMs = customLimits.window || this.securityConfig.rateLimitWindow;
    const maxRequests = customLimits.max || this.securityConfig.rateLimitMax;
    
    if (!this.rateLimitCache.has(clientId)) {
      this.rateLimitCache.set(clientId, { 
        count: 1, 
        resetTime: now + windowMs,
        requests: [now]
      });
      return true;
    }
    
    const limit = this.rateLimitCache.get(clientId);
    
    // Nettoyage des anciennes requêtes (sliding window)
    limit.requests = limit.requests.filter(time => time > now - windowMs);
    
    if (limit.requests.length >= maxRequests) {
      return false;
    }
    
    limit.requests.push(now);
    limit.count = limit.requests.length;
    
    return true;
  }

  // Méthode async corrigée
  async createRoute(method, path, handler, options = {}) {
    try {
      // Validation sécurisée des entrées
      const validated = this.validateRouteInput(method, path, handler);
      method = validated.method;
      path = validated.path;
      handler = validated.handler;

      // Vérifie les limites de création de routes
      if (this.dynamicRoutes.size >= this.maxDynamicRoutes) {
        throw new Error('Limite de routes dynamiques atteinte');
      }

      // Rate limiting pour la création de routes
      const clientId = options.clientId || 'route-creation';
      if (!this.checkRateLimit(clientId)) {
        throw new Error('Trop de tentatives de création de routes');
      }

      // Hook de sécurité avant création
      if (this.app.plugins) {
        await this.app.plugins.executeHook('route:security-check', method, path, handler, options);
      }

      if (this.routeExists(method, path)) {
        this.app.logger.log('warning', 'Route already exists', `${method.toUpperCase()} ${path}`);
        return this.app;
      }

      // Wrapper sécurisé pour le handler
      const secureHandler = this.createSecureHandler(handler, method, path, options);

      if (Array.isArray(secureHandler)) {
        this.app.app[method](path, ...secureHandler);
      } else {
        this.app.app[method](path, secureHandler);
      }

      const routeKey = `${method}:${path}`;
      this.dynamicRoutes.set(routeKey, {
        method,
        path,
        handler: secureHandler,
        options: this.sanitizeOptions(options),
        createdAt: new Date().toISOString(),
        createdBy: options.createdBy || 'system',
        routeId: this.generateRouteId(method, path)
      });

      this.app.logger.log('create', 'Route created dynamically', `${method.toUpperCase()} ${path}`);
      
      if (this.app.plugins) {
        await this.app.plugins.executeHook('route:created', method, path, secureHandler, options);
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
      throw error;
    }
  }

  // Crée un wrapper sécurisé amélioré pour les handlers
  createSecureHandler(handler, method, path, options = {}) {
    const wrapHandler = (originalHandler) => {
      return async (req, res, next) => {
        const startTime = Date.now();
        
        try {
          // Headers de sécurité configurables
          if (this.securityConfig.enableSecurityHeaders) {
            this.setSecurityHeaders(res);
          }
          
          // Validation des paramètres d'entrée
          this.validateRequestInput(req);
          
          // Rate limiting par route si configuré
          if (options.rateLimit) {
            const clientKey = `${req.ip}:${method}:${path}`;
            if (!this.checkRateLimit(clientKey, options.rateLimit)) {
              return res.status(429).json({ error: 'Trop de requêtes' });
            }
          }
          
          // Log de sécurité avec plus de détails
          this.app.logger.log('security', 'Route accessed', 
            `${method.toUpperCase()} ${path} from ${req.ip} (${req.get('User-Agent') || 'Unknown'})`
          );
          
          // Exécute le handler original avec timeout
          const timeoutMs = options.timeout || 30000;
          const handlerPromise = Promise.resolve(originalHandler(req, res, next));
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Handler timeout')), timeoutMs)
          );
          
          await Promise.race([handlerPromise, timeoutPromise]);
          
          // Log de performance
          const duration = Date.now() - startTime;
          if (duration > 1000) {
            this.app.logger.log('performance', 'Slow route', 
              `${method.toUpperCase()} ${path} took ${duration}ms`
            );
          }
          
        } catch (error) {
          const duration = Date.now() - startTime;
          
          this.app.logger.log('error', 'Handler error', 
            `${method.toUpperCase()} ${path} → ${error.message} (${duration}ms)`
          );
          
          // Réponse d'erreur sécurisée
          if (!res.headersSent) {
            this.sendSecureErrorResponse(res, error);
          }
        }
      };
    };

    if (Array.isArray(handler)) {
      return handler.map(h => wrapHandler(h));
    } else {
      return wrapHandler(handler);
    }
  }

  // Headers de sécurité configurables
  setSecurityHeaders(res) {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': this.securityConfig.contentSecurityPolicy
    };
    
    Object.entries(headers).forEach(([name, value]) => {
      if (!res.getHeader(name)) {
        res.setHeader(name, value);
      }
    });
  }

  // Réponse d'erreur sécurisée
  sendSecureErrorResponse(res, error) {
    const isDev = process.env.NODE_ENV !== 'production';
    const errorId = this.generateErrorId();
    
    // Log l'erreur avec un ID unique
    this.app.logger.log('error', 'Request error', `ID: ${errorId} - ${error.message}`);
    
    const response = {
      error: 'Une erreur est survenue',
      errorId,
      timestamp: new Date().toISOString()
    };
    
    if (isDev) {
      response.details = error.message;
      response.stack = error.stack;
    }
    
    const statusCode = error.statusCode || error.status || 500;
    res.status(statusCode).json(response);
  }

  // Validation améliorée des données de requête
  validateRequestInput(req) {
    const maxParamLength = this.securityConfig.maxParamLength;
    
    // Validation avec limite de profondeur pour éviter les attaques par récursion
    if (req.body) {
      this.validateObject(req.body, 'body', maxParamLength, 0, 5);
    }
    
    if (req.query) {
      this.validateObject(req.query, 'query', maxParamLength, 0, 3);
    }
    
    if (req.params) {
      this.validateObject(req.params, 'params', maxParamLength, 0, 2);
    }
    
    // Validation des headers sensibles
    this.validateHeaders(req);
  }

  // Validation récursive avec protection contre les attaques
  validateObject(obj, type, maxLength, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) {
      throw new Error(`Objet ${type} trop profond`);
    }
    
    const keys = Object.keys(obj);
    if (keys.length > 100) {
      throw new Error(`Trop de propriétés dans ${type}`);
    }
    
    for (const [key, value] of Object.entries(obj)) {
      // Validation de la clé
      if (key.length > 100) {
        throw new Error(`Nom de propriété ${type}.${key} trop long`);
      }
      
      if (typeof value === 'string') {
        if (value.length > maxLength) {
          throw new Error(`Paramètre ${type}.${key} trop long`);
        }
        
        // Détection améliorée de tentatives d'injection
        if (this.containsDangerousPatterns(value)) {
          throw new Error(`Paramètre ${type}.${key} contient du contenu suspect`);
        }
      } else if (value && typeof value === 'object') {
        this.validateObject(value, `${type}.${key}`, maxLength, depth + 1, maxDepth);
      }
    }
  }

  // Validation des headers
  validateHeaders(req) {
    const dangerousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
    
    dangerousHeaders.forEach(header => {
      const value = req.get(header);
      if (value && this.containsDangerousPatterns(value)) {
        this.app.logger.log('security', 'Dangerous header detected', `${header}: ${value}`);
        throw new Error('En-tête de requête suspect');
      }
    });
  }

  // Génération d'ID unique pour les routes
  generateRouteId(method, path) {
    return crypto.createHash('md5').update(`${method}:${path}:${Date.now()}`).digest('hex').substring(0, 8);
  }

  // Génération d'ID unique pour les erreurs
  generateErrorId() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  // Nettoyage des options amélioré
  sanitizeOptions(options) {
    const sanitized = {};
    const allowedKeys = [
      'description', 'middleware', 'rateLimit', 'auth', 'createdBy', 
      'timeout', 'clientId', 'security', 'cache'
    ];
    
    allowedKeys.forEach(key => {
      if (options[key] !== undefined) {
        // Validation spécifique par type d'option
        switch (key) {
          case 'timeout':
            sanitized[key] = Math.min(Math.max(parseInt(options[key]) || 30000, 1000), 300000);
            break;
          case 'rateLimit':
            if (typeof options[key] === 'object') {
              sanitized[key] = {
                window: Math.min(options[key].window || 60000, 3600000),
                max: Math.min(options[key].max || 100, 10000)
              };
            }
            break;
          default:
            sanitized[key] = options[key];
        }
      }
    });
    
    return sanitized;
  }

  // Nettoyage périodique optimisé
  startCacheCleanup() {
    // Nettoyage toutes les 5 minutes
    setInterval(() => {
      this.cleanupCache();
    }, 300000);
  }

  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
    
    // Nettoyage du cache rate limiting
    if (this.rateLimitCache) {
      for (const [key, value] of this.rateLimitCache.entries()) {
        if (value.resetTime && now > value.resetTime) {
          this.rateLimitCache.delete(key);
          cleaned++;
        }
      }
    }
    
    // Nettoyage du cache de validation des chemins
    if (this.pathValidationCache && this.pathValidationCache.size > 1000) {
      this.pathValidationCache.clear();
      cleaned += 1000;
    }
    
    // Nettoyage du cache des méthodes
    if (this.methodsCache && this.methodsCache.size > 1000) {
      this.methodsCache.clear();
      cleaned += 1000;
    }
    
    if (cleaned > 0) {
      this.app.logger.log('maintenance', 'Cache cleaned', `${cleaned} entries removed`);
    }
  }

  async createRoute(method, path, handler, options = {}) {

    try {
      // Validation sécurisée des entrées
      const validated = this.validateRouteInput(method, path, handler);
      method = validated.method;
      path = validated.path;
      handler = validated.handler;

      // Vérifie les limites de création de routes
      if (this.dynamicRoutes.size >= this.maxDynamicRoutes) {
        throw new Error('Limite de routes dynamiques atteinte');
      }

      // Rate limiting pour la création de routes
      if (!this.checkRateLimit()) {
        throw new Error('Trop de tentatives de création de routes');
      }

      // Hook de sécurité avant création
      if (this.app.plugins) {
        await this.app.plugins.executeHook('route:security-check', method, path, handler, options);
      }

      if (this.routeExists(method, path)) {
        this.app.logger.log('warning', 'Route already exists', `${method.toUpperCase()} ${path}`);
        return this.app;
      }

      // Wrapper sécurisé pour le handler
      const secureHandler = this.createSecureHandler(handler, method, path);

      if (Array.isArray(secureHandler)) {
        this.app.app[method](path, ...secureHandler);
      } else {
        this.app.app[method](path, secureHandler);
      }

      const routeKey = `${method}:${path}`;
      this.dynamicRoutes.set(routeKey, {
        method,
        path,
        handler: secureHandler,
        options: this.sanitizeOptions(options),
        createdAt: new Date().toISOString(),
        createdBy: options.createdBy || 'system'
      });

      this.app.logger.log('create', 'Route created dynamically', `${method.toUpperCase()} ${path}`);
      
      if (this.app.plugins) {
        await this.app.plugins.executeHook('route:created', method, path, secureHandler, options);
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
      throw error; // Re-throw pour une meilleure gestion d'erreur
    }
  }

  // Crée un wrapper sécurisé pour les handlers
  createSecureHandler(handler, method, path) {
    const wrapHandler = (originalHandler) => {
      return async (req, res, next) => {
        try {
          // Ajoute des headers de sécurité
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('X-Frame-Options', 'DENY');
          
          // Validation des paramètres d'entrée
          this.validateRequestInput(req);
          
          // Log de sécurité
          this.app.logger.log('security', 'Route accessed', `${method.toUpperCase()} ${path} from ${req.ip}`);
          
          // Exécute le handler original
          await originalHandler(req, res, next);
        } catch (error) {
          this.app.logger.log('error', 'Handler error', `${method.toUpperCase()} ${path} → ${error.message}`);
          
          // Ne pas exposer les détails d'erreur en production
          if (process.env.NODE_ENV === 'production') {
            res.status(500).json({ error: 'Erreur serveur interne' });
          } else {
            res.status(500).json({ error: error.message, stack: error.stack });
          }
        }
      };
    };

    if (Array.isArray(handler)) {
      return handler.map(h => wrapHandler(h));
    } else {
      return wrapHandler(handler);
    }
  }

  // Validation des données de requête
  validateRequestInput(req) {
    // Limite la taille des paramètres
    const maxParamLength = 1000;
    
    if (req.body) {
      this.validateObject(req.body, 'body', maxParamLength);
    }
    
    if (req.query) {
      this.validateObject(req.query, 'query', maxParamLength);
    }
    
    if (req.params) {
      this.validateObject(req.params, 'params', maxParamLength);
    }
  }

  validateObject(obj, type, maxLength) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        if (value.length > maxLength) {
          throw new Error(`Paramètre ${type}.${key} trop long`);
        }
        
        // Détection de tentatives d'injection
        if (/[<>\"'`]|javascript:|data:|vbscript:|onload|onerror/i.test(value)) {
          throw new Error(`Paramètre ${type}.${key} contient du contenu suspect`);
        }
      }
    }
  }

  // Nettoyage des options
  sanitizeOptions(options) {
    const sanitized = {};
    
    const allowedKeys = ['description', 'middleware', 'rateLimit', 'auth', 'createdBy'];
    
    for (const key of allowedKeys) {
      if (options[key] !== undefined) {
        sanitized[key] = options[key];
      }
    }
    
    return sanitized;
  }

  async deleteRoute(method, path) {
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

  async updateRoute(method, path, newHandler) {
    try {
      await this.deleteRoute(method, path);
      await this.createRoute(method, path, newHandler);
      
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
      this.createRoutesDirectory(routesPath);
      return this.app;
    }

    this.app.logger.log('info', 'Scanning routes...', `📂 ${routesDir}`);
    this.scanDirectory(routesPath, routesPath);
    
    // Vérifier si la route / existe
    if (!this.routeExists('get', '/')) {
      this.app.logger.log('warning', 'No root route found', 'Create routes/index.js to define the home page');
    }
    
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
      // Validation du chemin de fichier pour éviter les attaques par traversée
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(basePath);
      
      if (!resolvedPath.startsWith(resolvedBase)) {
        throw new Error('Tentative d\'accès à un fichier en dehors du répertoire autorisé');
      }

      // Vérifie l'extension du fichier
      if (!filePath.endsWith('.js')) {
        throw new Error('Seuls les fichiers .js sont autorisés');
      }

      delete require.cache[require.resolve(filePath)];
      const routeModule = require(filePath);
      
      const relativePath = path.relative(basePath, filePath);
      const routePath = this.filePathToRoute(relativePath);
      
      this.routeMap.set(filePath, routePath);
      
      if (typeof routeModule === 'function') {
        // Wrapper sécurisé pour les fonctions de route
        const secureModule = (app) => {
          try {
            routeModule(app);
          } catch (error) {
            this.app.logger.log('error', 'Route module error', error.message);
          }
        };
        secureModule(this.app.app);
      } else if (routeModule.router) {
        this.app.app.use(routePath, routeModule.router);
      } else if (routeModule.get || routeModule.post || routeModule.put || routeModule.delete || routeModule.patch) {
        this.setupRouteHandlers(routePath, routeModule);
      } else {
        this.app.logger.log('warning', 'Invalid route module', `${path.basename(filePath)} - No valid exports found`);
        return;
      }
      
      const fileName = path.basename(filePath);
      this.app.logger.log('route', 'Route loaded', `${fileName} → ${routePath}`);
    } catch (error) {
      const fileName = path.basename(filePath);
      this.app.logger.log('error', 'Failed to load', `${fileName} → ${error.message}`);
      // En production, ne pas arrêter l'application pour un fichier de route défaillant
      if (process.env.NODE_ENV !== 'production') {
        throw error;
      }
    }
  }

  createRoutesDirectory(routesPath) {
    try {
      // Créer le dossier routes
      fs.mkdirSync(routesPath, { recursive: true });
      this.app.logger.log('create', 'Routes directory created', `📁 ${path.relative(process.cwd(), routesPath)}`);
      
      // Créer le fichier index.js avec une route par défaut
      const indexPath = path.join(routesPath, 'index.js');
      const defaultIndexContent = `// Route principale de l'application
module.exports = {
  get: (req, res) => {
    res.render('index', { 
      title: 'Veko.js - Ultra modern framework',
      message: 'Welcome to Veko.js! 🚀',
      description: 'Your application is running successfully.'
    });
  }
};`;

      fs.writeFileSync(indexPath, defaultIndexContent, 'utf8');
      this.app.logger.log('create', 'Default index route created', `📄 ${path.relative(process.cwd(), indexPath)}`);
      
      // Créer également une vue index.ejs par défaut si elle n'existe pas
      this.createDefaultIndexView();
      
    } catch (error) {
      this.app.logger.log('error', 'Error creating routes directory', error.message);
    }
  }

  createDefaultIndexView() {
    const viewsPath = path.join(process.cwd(), this.app.options.viewsDir);
    const indexViewPath = path.join(viewsPath, 'index.ejs');
    
    if (!fs.existsSync(indexViewPath)) {
      // Créer le dossier views s'il n'existe pas
      if (!fs.existsSync(viewsPath)) {
        fs.mkdirSync(viewsPath, { recursive: true });
        this.app.logger.log('create', 'Views directory created', `📁 ${path.relative(process.cwd(), viewsPath)}`);
      }
      
      const defaultViewContent = `<% layout.css = ['/css/home.css'] %>
<% layout.js = ['/js/home.js'] %>

<div class="hero">
    <div class="hero-content">
        <h1><%= title %></h1>
        <p class="lead"><%= message %></p>
        <p><%= description %></p>
        
        <div class="features">
            <div class="feature">
                <h3>🚀 Ultra Rapide</h3>
                <p>Framework optimisé pour les performances</p>
            </div>
            <div class="feature">
                <h3>🔥 Hot Reload</h3>
                <p>Rechargement automatique en développement</p>
            </div>
            <div class="feature">
                <h3>🎨 Layouts</h3>
                <p>Système de mise en page intégré</p>
            </div>
            <div class="feature">
                <h3>🔌 Plugins</h3>
                <p>Architecture extensible avec plugins</p>
            </div>
        </div>
        
        <div class="actions">
            <a href="/docs" class="btn btn-primary">Documentation</a>
            <a href="/examples" class="btn btn-secondary">Exemples</a>
        </div>
    </div>
</div>

<% layout.section('scripts', \`
<script>
    console.log('🎉 Veko.js app loaded successfully!');
</script>
\`) %>`;

      fs.writeFileSync(indexViewPath, defaultViewContent, 'utf8');
      this.app.logger.log('create', 'Default index view created', `📄 ${path.relative(process.cwd(), indexViewPath)}`);
    }
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
    
    // Si le fichier est index.js à la racine, la route devient '/'
    if (route === '' || route === '/') {
      route = '/';
    }
    
    return route;
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

  // Optimisation: cache des méthodes de route
  getRouteMethods(routePath) {
    const cacheKey = `methods:${routePath}`;
    
    if (this.methodsCache && this.methodsCache.has(cacheKey)) {
      return this.methodsCache.get(cacheKey);
    }
    
    if (!this.app.app._router) return [];
    
    const methods = new Set();
    this.app.app._router.stack.forEach(layer => {
      if (layer.route && layer.route.path === routePath) {
        Object.keys(layer.route.methods).forEach(method => {
          methods.add(method.toUpperCase());
        });
      }
    });
    
    const result = Array.from(methods);
    
    // Cache le résultat
    if (!this.methodsCache) {
      this.methodsCache = new Map();
    }
    this.methodsCache.set(cacheKey, result);
    
    return result;
  }

  // Nettoyage périodique du cache
  cleanupCache() {
    if (this.rateLimitCache) {
      const now = Date.now();
      for (const [key, value] of this.rateLimitCache.entries()) {
        if (now > value.resetTime) {
          this.rateLimitCache.delete(key);
        }
      }
    }
    
    if (this.methodsCache && this.methodsCache.size > 1000) {
      this.methodsCache.clear();
    }
  }
}

module.exports = RouteManager;