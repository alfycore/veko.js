const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

class AdvancedRouteManager {
  constructor(app, options = {}) {
    this.app = app;
    this.options = options;
    this.routes = new Map();
    this.middlewareStack = new Map();
    this.routeGroups = new Map();
    this.dynamicRoutes = new Map();
    this.routeCache = new Map();
    
    // Configuration avancée
    this.config = {
      maxRoutes: options.maxRoutes || 10000,
      enableCaching: options.enableCaching !== false,
      enableMetrics: options.enableMetrics !== false,
      enableVersioning: options.enableVersioning !== false,
      enableRateLimit: options.enableRateLimit !== false,
      enableCompression: options.enableCompression !== false,
      supportTypeScript: options.supportTypeScript !== false,
      ...options
    };
    
    // Métriques et monitoring
    this.metrics = {
      totalRequests: 0,
      errorCount: 0,
      averageResponseTime: 0,
      routeStats: new Map()
    };
    
    // Rate limiting store
    this.rateLimitStore = new Map();
    
    // Support TypeScript
    this.initTypeScriptSupport();
    
    // Démarrage des services
    this.startServices();
  }

  // 🔥 Support TypeScript personnalisé
  initTypeScriptSupport() {
    if (!this.config.supportTypeScript) return;
    
    try {
      // Vérifier si TypeScript est disponible sans l'importer directement
      const tsPath = path.join(process.cwd(), 'node_modules', 'typescript', 'lib', 'typescript.js');
      if (fs.existsSync(tsPath)) {
        this.app.logger.log('success', 'TypeScript support detected', '🔷');
        this.tsSupport = true;
      } else {
        this.app.logger.log('warning', 'TypeScript not found', 'falling back to JavaScript');
        this.tsSupport = false;
      }
    } catch (error) {
      this.app.logger.log('warning', 'TypeScript support failed', error.message);
      this.tsSupport = false;
    }
  }

  // 🛡️ Validation personnalisée (remplace validator)
  validateInput(input, type) {
    switch (type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input);
      
      case 'url':
        try {
          new URL(input);
          return true;
        } catch {
          return false;
        }
      
      case 'ip':
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        return ipRegex.test(input) && input.split('.').every(octet => 
          parseInt(octet) >= 0 && parseInt(octet) <= 255
        );
      
      case 'alphanumeric':
        return /^[a-zA-Z0-9]+$/.test(input);
      
      case 'slug':
        return /^[a-z0-9-]+$/.test(input);
      
      default:
        return true;
    }
  }

  // 🔐 Headers de sécurité personnalisés (remplace helmet)
  setAdvancedSecurityHeaders(res) {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
      'X-Powered-By': 'Veko.js'
    };

    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  // 🚦 Rate limiting personnalisé
  async checkAdvancedRateLimit(req) {
    if (!this.config.enableRateLimit) {
      return { allowed: true };
    }

    const clientId = this.getClientIdentifier(req);
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;

    if (!this.rateLimitStore.has(clientId)) {
      this.rateLimitStore.set(clientId, { requests: [], blocked: false });
    }

    const clientData = this.rateLimitStore.get(clientId);
    
    // Nettoyer les anciennes requêtes
    clientData.requests = clientData.requests.filter(timestamp => 
      now - timestamp < windowMs
    );

    if (clientData.requests.length >= maxRequests) {
      const retryAfter = Math.ceil((clientData.requests[0] + windowMs - now) / 1000);
      return { 
        allowed: false, 
        retryAfter,
        remaining: 0
      };
    }

    clientData.requests.push(now);
    return { 
      allowed: true, 
      remaining: maxRequests - clientData.requests.length 
    };
  }

  // 🆔 Identification du client
  getClientIdentifier(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           'unknown';
  }

  // 🚀 Création de route ultra avancée
  async createAdvancedRoute(config) {
    const {
      method,
      path,
      handler,
      middleware = [],
      guards = [],
      rateLimit,
      cache,
      version,
      description,
      tags = [],
      deprecated = false,
      auth,
      validation,
      transform,
      hooks = {}
    } = config;

    // Validation des paramètres
    this.validateRouteConfig(config);

    // Génération d'ID unique
    const routeId = this.generateRouteId(method, path, version);
    
    // Construction de la route
    const route = {
      id: routeId,
      method: method.toLowerCase(),
      path: this.normalizePath(path),
      originalPath: path,
      handler,
      middleware: this.buildMiddlewareStack(middleware, guards),
      options: {
        rateLimit,
        cache,
        version,
        description,
        tags,
        deprecated,
        auth,
        validation,
        transform,
        hooks
      },
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: process.env.USER || 'system',
        hits: 0,
        lastAccess: null,
        averageResponseTime: 0,
        errorCount: 0
      }
    };

    // Hooks avant création
    await this.executeHook('before:route:create', route);

    // Enregistrement de la route
    this.registerRoute(route);

    // Configuration Express
    await this.setupExpressRoute(route);

    // Hooks après création
    await this.executeHook('after:route:create', route);

    this.app.logger.log('create', 'Advanced route created', 
      `${method.toUpperCase()} ${path} [${routeId}]`);

    return routeId;
  }

  // 🏗️ Construction du stack middleware
  buildMiddlewareStack(middleware, guards) {
    const stack = [];
    
    // Middleware de sécurité global
    stack.push(this.buildSecurityMiddleware());
    
    // Middleware de métriques
    if (this.config.enableMetrics) {
      stack.push(this.buildMetricsMiddleware());
    }
    
    // Guards (authentification, autorisation)
    guards.forEach(guard => {
      if (typeof guard === 'function') {
        stack.push(guard);
      }
    });
    
    // Middleware personnalisés
    middleware.forEach(mw => {
      if (typeof mw === 'function') {
        stack.push(mw);
      }
    });
    
    return stack;
  }

  // 🛡️ Middleware de sécurité avancé
  buildSecurityMiddleware() {
    return async (req, res, next) => {
      const startTime = Date.now();
      
      try {
        // Headers de sécurité
        this.setAdvancedSecurityHeaders(res);
        
        // Validation de la requête
        this.validateAdvancedRequest(req);
        
        // Rate limiting intelligent
        if (this.config.enableRateLimit) {
          const rateLimitResult = await this.checkAdvancedRateLimit(req);
          if (!rateLimitResult.allowed) {
            return res.status(429).json({
              error: 'Rate limit exceeded',
              retryAfter: rateLimitResult.retryAfter,
              remaining: rateLimitResult.remaining || 0
            });
          }
          
          // Ajouter les headers de rate limit
          res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining || 0);
        }
        
        // Authentification et autorisations
        if (req.route?.auth) {
          const authResult = await this.checkAuthentication(req);
          if (!authResult.success) {
            return res.status(401).json({ error: 'Authentication required' });
          }
        }
        
        // Métriques
        req.startTime = startTime;
        next();
        
      } catch (error) {
        this.handleSecurityError(error, req, res);
      }
    };
  }

  // 📊 Middleware de métriques
  buildMetricsMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Intercepter la fin de la réponse
      const originalEnd = res.end;
      res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        
        // Mettre à jour les métriques
        this.updateMetrics(req, res, responseTime);
        
        return originalEnd.apply(res, args);
      }.bind(this);
      
      next();
    };
  }

  // 📈 Mise à jour des métriques
  updateMetrics(req, res, responseTime) {
    this.metrics.totalRequests++;
    
    if (res.statusCode >= 400) {
      this.metrics.errorCount++;
    }
    
    // Calcul de la moyenne du temps de réponse
    const currentAvg = this.metrics.averageResponseTime;
    const total = this.metrics.totalRequests;
    this.metrics.averageResponseTime = ((currentAvg * (total - 1)) + responseTime) / total;
    
    // Métriques par route
    const routeKey = `${req.method}:${req.path}`;
    if (!this.metrics.routeStats.has(routeKey)) {
      this.metrics.routeStats.set(routeKey, {
        hits: 0,
        averageTime: 0,
        errors: 0
      });
    }
    
    const routeStats = this.metrics.routeStats.get(routeKey);
    routeStats.hits++;
    routeStats.averageTime = ((routeStats.averageTime * (routeStats.hits - 1)) + responseTime) / routeStats.hits;
    
    if (res.statusCode >= 400) {
      routeStats.errors++;
    }
  }

  // 📊 Système de cache intelligent
  createCacheMiddleware(cacheConfig) {
    return async (req, res, next) => {
      if (!cacheConfig || !this.config.enableCaching) {
        return next();
      }

      const cacheKey = this.generateCacheKey(req, cacheConfig);
      const cached = this.routeCache.get(cacheKey);

      if (cached && !this.isCacheExpired(cached, cacheConfig)) {
        // Cache hit
        Object.entries(cached.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.setHeader('X-Cache', 'HIT');
        res.status(cached.status);
        return res.send(cached.data);
      }

      // Cache miss - intercepter la réponse
      const originalSend = res.send;
      res.send = function(data) {
        // Stocker en cache
        if (res.statusCode < 400) {
          this.routeCache.set(cacheKey, {
            data,
            headers: this.getResponseHeaders(res),
            status: res.statusCode,
            timestamp: Date.now()
          });
        }
        
        res.setHeader('X-Cache', 'MISS');
        return originalSend.call(this, data);
      }.bind(this);

      next();
    };
  }

  // 🗝️ Génération de clé de cache
  generateCacheKey(req, cacheConfig) {
    const parts = [
      req.method,
      req.path,
      req.query ? JSON.stringify(req.query) : '',
      cacheConfig.varyBy ? cacheConfig.varyBy.map(header => req.headers[header] || '').join(':') : ''
    ];
    
    return crypto.createHash('md5').update(parts.join('|')).digest('hex');
  }

  // ⏰ Vérification d'expiration du cache
  isCacheExpired(cached, cacheConfig) {
    const maxAge = cacheConfig.maxAge || 300000; // 5 minutes par défaut
    return Date.now() - cached.timestamp > maxAge;
  }

  // 🔗 Extraction des headers de réponse
  getResponseHeaders(res) {
    const headers = {};
    if (res.getHeaders) {
      Object.assign(headers, res.getHeaders());
    }
    return headers;
  }

  // 🔄 Support des groupes de routes
  group(prefix, callback, options = {}) {
    const groupId = crypto.randomUUID();
    const group = {
      id: groupId,
      prefix: this.normalizePath(prefix),
      middleware: options.middleware || [],
      options,
      routes: []
    };

    this.routeGroups.set(groupId, group);
    
    // Context pour les routes du groupe
    const groupContext = {
      get: (path, handler, opts) => this.addToGroup(groupId, 'get', path, handler, opts),
      post: (path, handler, opts) => this.addToGroup(groupId, 'post', path, handler, opts),
      put: (path, handler, opts) => this.addToGroup(groupId, 'put', path, handler, opts),
      delete: (path, handler, opts) => this.addToGroup(groupId, 'delete', path, handler, opts),
      patch: (path, handler, opts) => this.addToGroup(groupId, 'patch', path, handler, opts),
      middleware: (middleware) => this.addGroupMiddleware(groupId, middleware),
      group: (subPrefix, subCallback, subOptions) => {
        return this.group(prefix + subPrefix, subCallback, subOptions);
      }
    };

    callback(groupContext);
    return groupId;
  }

  // ➕ Ajout de route à un groupe
  addToGroup(groupId, method, path, handler, options = {}) {
    const group = this.routeGroups.get(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    const fullPath = group.prefix + this.normalizePath(path);
    const routeConfig = {
      method,
      path: fullPath,
      handler,
      middleware: [...group.middleware, ...(options.middleware || [])],
      ...options
    };

    const routeId = this.createAdvancedRoute(routeConfig);
    group.routes.push(routeId);
    
    return routeId;
  }

  // 🌐 Support des versions d'API
  version(version, callback) {
    const versionPrefix = `/api/v${version}`;
    return this.group(versionPrefix, callback, { version });
  }

  // ✅ Validation avancée des requêtes
  validateAdvancedRequest(req) {
    // Validation de la taille du corps de la requête
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > 10485760) { // 10MB
      throw new Error('Request body too large');
    }

    // Validation des headers dangereux
    const dangerousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
    dangerousHeaders.forEach(header => {
      if (req.headers[header] && this.containsDangerousPatterns(req.headers[header])) {
        throw new Error('Suspicious request header detected');
      }
    });

    // Validation de l'URL
    if (req.url && this.containsDangerousPatterns(req.url)) {
      throw new Error('Suspicious URL pattern detected');
    }
  }

  // 🚨 Détection de patterns dangereux
  containsDangerousPatterns(input) {
    const dangerousPatterns = [
      /\.\.\//,           // Directory traversal
      /<script/i,         // XSS
      /javascript:/i,     // Javascript protocol
      /data:/i,          // Data protocol
      /vbscript:/i,      // VBScript
      /'.*OR.*'/i,       // SQL injection
      /UNION.*SELECT/i,   // SQL injection
      /DROP.*TABLE/i,     // SQL injection
      /exec\(/i,         // Command injection
      /eval\(/i          // Code injection
    ];

    return dangerousPatterns.some(pattern => pattern.test(input));
  }

  // 🔒 Vérification d'authentification
  async checkAuthentication(req) {
    // Implémentation basique d'authentification
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return { success: false, error: 'No authorization header' };
    }

    // Exemple avec Bearer token
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Ici vous ajouteriez votre logique de vérification de token
      return { success: true, user: { token } };
    }

    return { success: false, error: 'Invalid authorization format' };
  }

  // 🚨 Gestion des erreurs de sécurité
  handleSecurityError(error, req, res) {
    this.metrics.errorCount++;
    
    this.app.logger.log('security', 'Security error', {
      error: error.message,
      ip: this.getClientIdentifier(req),
      path: req.path,
      method: req.method
    });

    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid request format'
    });
  }

  // 🔧 Méthodes utilitaires
  validateRouteConfig(config) {
    if (!config.method || !config.path || !config.handler) {
      throw new Error('Method, path, and handler are required');
    }
    
    if (typeof config.handler !== 'function' && !Array.isArray(config.handler)) {
      throw new Error('Handler must be a function or array of functions');
    }
  }

  generateRouteId(method, path, version) {
    const base = `${method}:${path}`;
    const versionSuffix = version ? `:v${version}` : '';
    return crypto.createHash('md5')
      .update(base + versionSuffix + Date.now())
      .digest('hex')
      .substring(0, 12);
  }

  normalizePath(path) {
    if (!path.startsWith('/')) path = '/' + path;
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  registerRoute(route) {
    if (this.routes.size >= this.config.maxRoutes) {
      throw new Error('Maximum number of routes exceeded');
    }
    
    this.routes.set(route.id, route);
  }

  async setupExpressRoute(route) {
    const method = route.method.toLowerCase();
    
    // Créer le handler final avec tous les middlewares
    const finalHandler = async (req, res, next) => {
      try {
        // Exécuter tous les middlewares de la route
        for (const middleware of route.middleware) {
          await new Promise((resolve, reject) => {
            middleware(req, res, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
        
        // Exécuter le handler principal
        await route.handler(req, res, next);
        
      } catch (error) {
        next(error);
      }
    };

    // Enregistrer la route dans Express
    if (this.app.app && this.app.app[method]) {
      this.app.app[method](route.path, finalHandler);
    }
  }

  async executeHook(hookName, ...args) {
    if (this.app.plugins) {
      await this.app.plugins.executeHook(hookName, ...args);
    }
  }

  // 📝 Génération automatique de documentation
  generateDocumentation() {
    const docs = {
      info: {
        title: this.app.options.name || 'Veko.js API',
        version: this.app.options.version || '1.0.0',
        description: 'Auto-generated API documentation',
        generatedAt: new Date().toISOString()
      },
      routes: [],
      groups: [],
      metrics: this.getMetrics()
    };

    // Documentation des routes
    for (const [routeId, route] of this.routes) {
      docs.routes.push({
        id: routeId,
        method: route.method.toUpperCase(),
        path: route.path,
        description: route.options.description,
        tags: route.options.tags,
        deprecated: route.options.deprecated,
        auth: !!route.options.auth,
        rateLimit: route.options.rateLimit,
        cache: route.options.cache,
        metadata: route.metadata
      });
    }

    // Documentation des groupes
    for (const [groupId, group] of this.routeGroups) {
      docs.groups.push({
        id: groupId,
        prefix: group.prefix,
        routes: group.routes.length,
        options: group.options
      });
    }

    return docs;
  }

  // 📈 Métriques et monitoring
  getMetrics() {
    return {
      ...this.metrics,
      routes: {
        total: this.routes.size,
        groups: this.routeGroups.size,
        cached: this.routeCache.size
      },
      performance: {
        averageResponseTime: Math.round(this.metrics.averageResponseTime * 100) / 100,
        totalRequests: this.metrics.totalRequests,
        errorRate: this.metrics.totalRequests > 0 ? 
          Math.round((this.metrics.errorCount / this.metrics.totalRequests) * 10000) / 100 : 0
      },
      cache: {
        hitRate: this.calculateCacheHitRate(),
        size: this.routeCache.size
      }
    };
  }

  calculateCacheHitRate() {
    // Implémentation simplifiée du taux de hit du cache
    return Math.round(Math.random() * 100); // À remplacer par une vraie logique
  }

  // 🔍 Recherche et filtrage de routes
  findRoutes(criteria) {
    const results = [];
    
    for (const [routeId, route] of this.routes) {
      let match = true;
      
      if (criteria.method && route.method !== criteria.method.toLowerCase()) {
        match = false;
      }
      
      if (criteria.path && !route.path.includes(criteria.path)) {
        match = false;
      }
      
      if (criteria.tags && !criteria.tags.some(tag => route.options.tags.includes(tag))) {
        match = false;
      }
      
      if (criteria.deprecated !== undefined && route.options.deprecated !== criteria.deprecated) {
        match = false;
      }
      
      if (match) {
        results.push({ id: routeId, ...route });
      }
    }
    
    return results;
  }

  // 🧹 Services de maintenance
  startServices() {
    // Nettoyage périodique du cache
    setInterval(() => {
      this.cleanupCache();
    }, 300000); // 5 minutes

    // Nettoyage du rate limiting
    setInterval(() => {
      this.cleanupRateLimit();
    }, 60000); // 1 minute

    // Sauvegarde des métriques
    if (this.config.enableMetrics) {
      setInterval(() => {
        this.saveMetrics();
      }, 60000); // 1 minute
    }
  }

  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, cached] of this.routeCache) {
      if (now - cached.timestamp > 3600000) { // 1 heure
        this.routeCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.app.logger.log('maintenance', 'Cache cleaned', `${cleaned} entries removed`);
    }
  }

  cleanupRateLimit() {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    
    for (const [clientId, clientData] of this.rateLimitStore) {
      clientData.requests = clientData.requests.filter(timestamp => 
        now - timestamp < windowMs
      );
      
      if (clientData.requests.length === 0) {
        this.rateLimitStore.delete(clientId);
      }
    }
  }

  saveMetrics() {
    const metricsFile = path.join(process.cwd(), 'metrics.json');
    try {
      fs.writeFileSync(metricsFile, JSON.stringify(this.getMetrics(), null, 2));
    } catch (error) {
      this.app.logger.log('error', 'Failed to save metrics', error.message);
    }
  }

  // 🗑️ Nettoyage et arrêt
  async shutdown() {
    this.app.logger.log('info', 'Shutting down AdvancedRouteManager');
    
    // Sauvegarder les métriques finales
    if (this.config.enableMetrics) {
      this.saveMetrics();
    }
    
    // Nettoyer les caches
    this.routeCache.clear();
    this.rateLimitStore.clear();
    this.routes.clear();
    this.routeGroups.clear();
  }
}

module.exports = AdvancedRouteManager;