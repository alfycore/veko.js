const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class AuthManager {
  constructor(app) {
    this.app = app;
    this.config = {
      database: {
        type: 'sqlite',
        sqlite: {
          path: './data/auth.db'
        },
        mysql: {
          host: 'localhost',
          port: 3306,
          database: 'veko_auth',
          username: 'root',
          password: ''
        }
      },
      session: {
        secret: this.generateSecretKey(),
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict'
      },
      security: {
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000,
        sessionRotation: true,
        csrfProtection: true,
        rateLimit: {
          windowMs: 15 * 60 * 1000,
          max: 10
        }
      },
      routes: {
        api: {
          login: '/api/auth/login',
          logout: '/api/auth/logout',
          register: '/api/auth/register',
          check: '/api/auth/check',
          profile: '/api/auth/profile'
        },
        web: {
          enabled: true,
          login: '/auth/login',
          logout: '/auth/logout',
          register: '/auth/register',
          dashboard: '/auth/dashboard'
        }
      },
      redirects: {
        afterLogin: '/auth/dashboard',
        afterLogout: '/auth/login',
        loginRequired: '/auth/login'
      },
      password: {
        minLength: 8,
        requireSpecial: true,
        requireNumbers: true,
        requireUppercase: true,
        requireLowercase: true
      },
      views: {
        enabled: true,
        autoCreate: true
      }
    };
    this.db = null;
    this.isEnabled = false;
    this.loginAttempts = new Map();
    this.rateLimitStore = new Map();
  }

  generateSecretKey() {
    return crypto.randomBytes(64).toString('hex');
  }

  // Validation stricte des entrées
  validateInput(data, schema) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      if (rules.required && (!value || value.toString().trim() === '')) {
        errors.push(`Le champ ${field} est requis`);
        continue;
      }
      
      if (value) {
        // Validation de type
        if (rules.type && typeof value !== rules.type) {
          errors.push(`Le champ ${field} doit être de type ${rules.type}`);
          continue;
        }
        
        // Validation de longueur
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`Le champ ${field} doit contenir au moins ${rules.minLength} caractères`);
        }
        
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`Le champ ${field} ne peut pas dépasser ${rules.maxLength} caractères`);
        }
        
        // Validation par regex
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Le format du champ ${field} est invalide`);
        }
        
        // Validation personnalisée
        if (rules.custom && !rules.custom(value)) {
          errors.push(rules.customMessage || `Le champ ${field} est invalide`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Nettoyage sécurisé des entrées
  sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>\"'&]/g, (match) => {
        const entities = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return entities[match];
      })
      .slice(0, 1000); // Limite de longueur
  }

  // Protection CSRF
  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  validateCSRFToken(req) {
    const token = req.body._csrf || req.headers['x-csrf-token'];
    const sessionToken = req.session.csrfToken;
    
    return token && sessionToken && crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(sessionToken)
    );
  }

  async init(config = {}) {
    try {
      this.config = this.mergeConfig(this.config, config);
      
      // Validation de la configuration
      this.validateConfig();
      
      await this.installDependencies();
      await this.initDatabase();
      this.setupSessions();
      this.setupSecurity();
      this.setupApiRoutes();
      
      if (this.config.routes.web.enabled) {
        this.setupWebRoutes();
      }
      
      this.setupMiddlewares();
      
      if (this.config.views.enabled && this.config.views.autoCreate) {
        this.setupViews();
      }
      
      this.isEnabled = true;
      this.logSystemInfo();
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de l\'authentification:', error.message);
      throw error;
    }
  }

  validateConfig() {
    // Validation des paramètres critiques
    if (this.config.password.minLength < 8) {
      throw new Error('La longueur minimale du mot de passe doit être d\'au moins 8 caractères');
    }
    
    if (!this.config.session.secret || this.config.session.secret.length < 32) {
      this.config.session.secret = this.generateSecretKey();
    }
  }

  mergeConfig(defaultConfig, userConfig) {
    const result = { ...defaultConfig };
    
    for (const key in userConfig) {
      if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
        result[key] = this.mergeConfig(defaultConfig[key] || {}, userConfig[key]);
      } else {
        result[key] = userConfig[key];
      }
    }
    
    return result;
  }

  async installDependencies() {
    const requiredModules = {
      'express-session': '^1.17.3',
      'bcryptjs': '^2.4.3',
      'express-rate-limit': '^6.7.0',
      'helmet': '^6.1.5',
      'csurf': '^1.11.0'
    };

    if (this.config.database.type === 'mysql') {
      requiredModules['mysql2'] = '^3.6.0';
    } else if (this.config.database.type === 'sqlite') {
      requiredModules['sqlite3'] = '^5.1.6';
    }

    for (const [moduleName, version] of Object.entries(requiredModules)) {
      try {
        require.resolve(moduleName);
      } catch (error) {
        console.log(`📦 Installation de ${moduleName}...`);
        await this.app.installModule(moduleName, version);
      }
    }
  }

  async initDatabase() {
    if (this.config.database.type === 'mysql') {
      await this.initMySQL();
    } else if (this.config.database.type === 'sqlite') {
      await this.initSQLite();
    } else {
      throw new Error(`Type de base de données non supporté: ${this.config.database.type}`);
    }
    
    await this.createTables();
  }

  async initMySQL() {
    const mysql = require('mysql2/promise');
    const config = this.config.database.mysql;
    
    this.db = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database
    });
    
    console.log('✅ Connexion MySQL établie');
  }

  async initSQLite() {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(this.config.database.sqlite.path);
    
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new sqlite3.Database(dbPath);
    console.log(`✅ Base SQLite créée: ${dbPath}`);
  }

  async createTables() {
    const usersTable = this.config.database.type === 'mysql' ? `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        login_attempts INT DEFAULT 0,
        locked_until TIMESTAMP NULL,
        last_login TIMESTAMP NULL,
        password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_email (email)
      )
    ` : `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME NULL,
        last_login DATETIME NULL,
        password_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const sessionsTable = this.config.database.type === 'mysql' ? `
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) PRIMARY KEY,
        expires TIMESTAMP NOT NULL,
        data TEXT,
        INDEX idx_expires (expires)
      )
    ` : `
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        expires DATETIME NOT NULL,
        data TEXT
      )
    `;

    if (this.config.database.type === 'mysql') {
      await this.db.execute(usersTable);
      await this.db.execute(sessionsTable);
    } else {
      await new Promise((resolve, reject) => {
        this.db.run(usersTable, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      await new Promise((resolve, reject) => {
        this.db.run(sessionsTable, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    console.log('✅ Tables de base de données créées');
  }

  setupSessions() {
    const session = require('express-session');
    
    // Configuration sécurisée des sessions
    this.app.use(session({
      secret: this.config.session.secret,
      resave: false,
      saveUninitialized: false,
      name: 'veko.sid', // Nom personnalisé pour masquer l'usage d'Express
      cookie: {
        maxAge: this.config.session.maxAge,
        secure: this.config.session.secure,
        httpOnly: this.config.session.httpOnly,
        sameSite: this.config.session.sameSite
      },
      genid: () => {
        return crypto.randomUUID(); // Génération sécurisée des IDs de session
      }
    }));
    
    console.log('✅ Sessions configurées avec sécurité renforcée');
  }

  setupSecurity() {
    const helmet = require('helmet');
    const rateLimit = require('express-rate-limit');
    
    // Configuration Helmet pour la sécurité des headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // Rate limiting global
    const limiter = rateLimit({
      windowMs: this.config.security.rateLimit.windowMs,
      max: this.config.security.rateLimit.max,
      message: { 
        success: false, 
        message: 'Trop de tentatives, veuillez réessayer plus tard' 
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    // Rate limiting spécifique pour l'authentification
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 tentatives max
      skipSuccessfulRequests: true,
      message: { 
        success: false, 
        message: 'Trop de tentatives de connexion, compte temporairement bloqué' 
      }
    });

    this.app.use('/api/auth', authLimiter);
    this.app.use('/auth', authLimiter);
    
    console.log('✅ Sécurité renforcée configurée');
  }

  setupApiRoutes() {
    // Middleware de validation CSRF pour les routes sensibles
    const csrfMiddleware = (req, res, next) => {
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        if (!this.validateCSRFToken(req)) {
          return res.status(403).json({
            success: false,
            message: 'Token CSRF invalide'
          });
        }
      }
      next();
    };

    // Schéma de validation pour la connexion
    const loginSchema = {
      username: {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9._@-]+$/,
        customMessage: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et . _ @ -'
      },
      password: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 128
      }
    };

    // API - Connexion sécurisée
    this.app.createRoute('post', this.config.routes.api.login, async (req, res) => {
      try {
        // Validation des entrées
        const validation = this.validateInput(req.body, loginSchema);
        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            message: validation.errors[0],
            errors: validation.errors
          });
        }

        const { username, password } = req.body;
        const cleanUsername = this.sanitizeInput(username);
        
        // Vérification du rate limiting
        if (this.isRateLimited(req.ip)) {
          return res.status(429).json({
            success: false,
            message: 'Trop de tentatives, veuillez réessayer plus tard'
          });
        }

        const user = await this.authenticateUser(cleanUsername, password, req.ip);
        
        if (user) {
          await this.resetLoginAttempts(user.id);
          
          if (this.config.security.sessionRotation) {
            await this.regenerateSession(req);
          }
          
          // Génération du token CSRF
          req.session.csrfToken = this.generateCSRFToken();
          
          req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          };
          
          await this.updateLastLogin(user.id);
          
          res.json({
            success: true,
            message: 'Connexion réussie',
            user: req.session.user,
            csrfToken: req.session.csrfToken
          });
        } else {
          this.recordFailedAttempt(req.ip);
          
          res.status(401).json({
            success: false,
            message: 'Identifiants incorrects'
          });
        }
      } catch (error) {
        console.error('Erreur lors de la connexion:', error.message);
        res.status(500).json({
          success: false,
          message: 'Erreur serveur'
        });
      }
    });

    // Schéma de validation pour l'inscription
    const registerSchema = {
      username: {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9._-]+$/,
        customMessage: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et . _ -'
      },
      email: {
        required: true,
        type: 'string',
        maxLength: 254,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        customMessage: 'Format d\'email invalide'
      },
      password: {
        required: true,
        type: 'string',
        minLength: this.config.password.minLength,
        maxLength: 128,
        custom: (value) => this.validatePassword(value).isValid,
        customMessage: 'Le mot de passe ne respecte pas les critères de sécurité'
      },
      confirmPassword: {
        required: true,
        type: 'string'
      }
    };

    // API - Inscription sécurisée
    this.app.createRoute('post', this.config.routes.api.register, async (req, res) => {
      try {
        // Validation des entrées
        const validation = this.validateInput(req.body, registerSchema);
        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            message: validation.errors[0],
            errors: validation.errors
          });
        }

        const { username, email, password, confirmPassword } = req.body;
        
        // Vérification que les mots de passe correspondent
        if (password !== confirmPassword) {
          return res.status(400).json({
            success: false,
            message: 'Les mots de passe ne correspondent pas'
          });
        }
        
        const cleanUsername = this.sanitizeInput(username);
        const cleanEmail = this.sanitizeInput(email);
        
        const user = await this.createUser(cleanUsername, cleanEmail, password);
        
        if (this.config.security.sessionRotation) {
          await this.regenerateSession(req);
        }
        
        req.session.csrfToken = this.generateCSRFToken();
        
        req.session.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        };
        
        res.json({
          success: true,
          message: 'Inscription réussie',
          user: req.session.user,
          csrfToken: req.session.csrfToken
        });
        
      } catch (error) {
        if (error.message.includes('UNIQUE constraint') || error.code === 'ER_DUP_ENTRY') {
          res.status(409).json({
            success: false,
            message: 'Cet utilisateur existe déjà'
          });
        } else {
          console.error('Erreur lors de l\'inscription:', error.message);
          res.status(500).json({
            success: false,
            message: 'Erreur serveur'
          });
        }
      }
    });

    // API - Déconnexion sécurisée
    this.app.createRoute('post', this.config.routes.api.logout, csrfMiddleware, (req, res) => {
      if (!req.session.user) {
        return res.status(401).json({
          success: false,
          message: 'Non authentifié'
        });
      }

      req.session.destroy((err) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: 'Erreur lors de la déconnexion'
          });
        } else {
          res.json({
            success: true,
            message: 'Déconnexion réussie'
          });
        }
      });
    });

    // API - Vérification d'authentification sécurisée
    this.app.createRoute('get', this.config.routes.api.check, (req, res) => {
      // Validation de session
      if (req.session && req.session.user) {
        // Vérification de l'intégrité de la session
        if (this.isValidSessionUser(req.session.user)) {
          res.json({
            authenticated: true,
            user: req.session.user,
            csrfToken: req.session.csrfToken
          });
        } else {
          req.session.destroy();
          res.json({
            authenticated: false,
            user: null
          });
        }
      } else {
        res.json({
          authenticated: false,
          user: null
        });
      }
    });

    // API - Profil utilisateur sécurisé
    this.app.createRoute('get', this.config.routes.api.profile, this.requireAuth.bind(this), (req, res) => {
      res.json({
        success: true,
        user: req.session.user
      });
    });

    // Schéma de validation pour la mise à jour du profil
    const profileUpdateSchema = {
      email: {
        required: false,
        type: 'string',
        maxLength: 254,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        customMessage: 'Format d\'email invalide'
      }
    };

    // API - Mise à jour du profil sécurisée
    this.app.createRoute('put', this.config.routes.api.profile, 
      this.requireAuth.bind(this), 
      csrfMiddleware, 
      async (req, res) => {
        try {
          // Validation des entrées
          const validation = this.validateInput(req.body, profileUpdateSchema);
          if (!validation.isValid) {
            return res.status(400).json({
              success: false,
              message: validation.errors[0],
              errors: validation.errors
            });
          }

          const { email } = req.body;
          const userId = req.session.user.id;
          
          if (email) {
            const cleanEmail = this.sanitizeInput(email);
            await this.updateUser(userId, { email: cleanEmail });
            req.session.user.email = cleanEmail;
          }
          
          res.json({
            success: true,
            message: 'Profil mis à jour',
            user: req.session.user
          });
        } catch (error) {
          console.error('Erreur lors de la mise à jour:', error.message);
          res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour'
          });
        }
      }
    );
    
    console.log('✅ Routes API d\'authentification sécurisées configurées');
  }

  // Ajout d'une méthode de validation pour les paramètres de requête GET
  validateQueryParams(query, schema) {
    const errors = [];
    const sanitized = {};
    for (const [field, rules] of Object.entries(schema)) {
      let value = query[field];
      if (rules.required && (!value || value.toString().trim() === '')) {
        errors.push(`Le paramètre ${field} est requis`);
        continue;
      }
      if (value) {
        value = this.sanitizeInput(value);
        if (rules.type && typeof value !== rules.type) {
          errors.push(`Le paramètre ${field} doit être de type ${rules.type}`);
          continue;
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`Le paramètre ${field} ne peut pas dépasser ${rules.maxLength} caractères`);
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Le format du paramètre ${field} est invalide`);
        }
        sanitized[field] = value;
      }
    }
    return { isValid: errors.length === 0, errors, sanitized };
  }

  setupWebRoutes() {
    // Validation pour les routes web
    const webLoginSchema = {
      username: {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 50
      },
      password: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 128
      }
    };

    // Routes EJS - Connexion (GET)
    this.app.createRoute('get', this.config.routes.web.login, async (req, res) => {
      // Validation des query params (ex: error)
      const querySchema = {
        error: { required: false, type: 'string', maxLength: 50, pattern: /^[a-z_]+$/ }
      };
      const validation = this.validateQueryParams(req.query, querySchema);
      if (!validation.isValid) {
        return res.status(400).render('auth/login', {
          title: 'Connexion',
          error: 'invalid_query',
          csrfToken: req.session.csrfToken,
          layout: false
        });
      }

      if (req.session.user) {
        return res.redirect(this.config.redirects.afterLogin);
      }
      
      // Génération du token CSRF pour les vues
      if (!req.session.csrfToken) {
        req.session.csrfToken = this.generateCSRFToken();
      }
      
      res.render('auth/login', {
        title: 'Connexion',
        error: validation.sanitized.error,
        csrfToken: req.session.csrfToken,
        layout: false
      });
    });

    // Routes EJS - Connexion (POST)
    this.app.createRoute('post', this.config.routes.web.login, async (req, res) => {
      try {
        // Validation CSRF
        if (!this.validateCSRFToken(req)) {
          return res.redirect(`${this.config.routes.web.login}?error=csrf_invalid`);
        }

        // Validation des entrées
        const validation = this.validateInput(req.body, webLoginSchema);
        if (!validation.isValid) {
          return res.redirect(`${this.config.routes.web.login}?error=invalid_input`);
        }

        const { username, password } = req.body;
        const cleanUsername = this.sanitizeInput(username);
        
        const user = await this.authenticateUser(cleanUsername, password);
        
        if (user) {
          await this.resetLoginAttempts(user.id);
          
          if (this.config.security.sessionRotation) {
            await this.regenerateSession(req);
          }
          
          req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          };
          
          await this.updateLastLogin(user.id);
          res.redirect(this.config.redirects.afterLogin);
        } else {
          res.redirect(`${this.config.routes.web.login}?error=invalid_credentials`);
        }
      } catch (error) {
        console.error('Erreur lors de la connexion:', error.message);
        res.redirect(`${this.config.routes.web.login}?error=server_error`);
      }
    });

    // Routes EJS - Inscription (GET)
    this.app.createRoute('get', this.config.routes.web.register, async (req, res) => {
      if (req.session.user) {
        return res.redirect(this.config.redirects.afterLogin);
      }
      
      if (!req.session.csrfToken) {
        req.session.csrfToken = this.generateCSRFToken();
      }
      
      res.render('auth/register', {
        title: 'Inscription',
        error: req.query.error,
        csrfToken: req.session.csrfToken,
        layout: false
      });
    });

    // Schéma pour l'inscription web
    const webRegisterSchema = {
      username: {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 50
      },
      email: {
        required: true,
        type: 'string',
        maxLength: 254,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      },
      password: {
        required: true,
        type: 'string',
        minLength: this.config.password.minLength,
        maxLength: 128
      },
      confirmPassword: {
        required: true,
        type: 'string'
      }
    };

    // Routes EJS - Inscription (POST)
    this.app.createRoute('post', this.config.routes.web.register, async (req, res) => {
      try {
        // Validation CSRF
        if (!this.validateCSRFToken(req)) {
          return res.redirect(`${this.config.routes.web.register}?error=csrf_invalid`);
        }

        // Validation des entrées
        const validation = this.validateInput(req.body, webRegisterSchema);
        if (!validation.isValid) {
          return res.redirect(`${this.config.routes.web.register}?error=invalid_input`);
        }

        const { username, email, password, confirmPassword } = req.body;
        
        if (password !== confirmPassword) {
          return res.redirect(`${this.config.routes.web.register}?error=password_mismatch`);
        }
        
        const passwordValidation = this.validatePassword(password);
        if (!passwordValidation.isValid) {
          return res.redirect(`${this.config.routes.web.register}?error=password_weak`);
        }
        
        const cleanUsername = this.sanitizeInput(username);
        const cleanEmail = this.sanitizeInput(email);
        
        const user = await this.createUser(cleanUsername, cleanEmail, password);
        
        if (this.config.security.sessionRotation) {
          await this.regenerateSession(req);
        }
        
        req.session.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        };
        
        res.redirect(this.config.redirects.afterLogin);
        
      } catch (error) {
        if (error.message.includes('UNIQUE constraint') || error.code === 'ER_DUP_ENTRY') {
          res.redirect(`${this.config.routes.web.register}?error=user_exists`);
        } else {
          console.error('Erreur lors de l\'inscription:', error.message);
          res.redirect(`${this.config.routes.web.register}?error=server_error`);
        }
      }
    });

    // Routes EJS - Déconnexion sécurisée
    this.app.createRoute('get', this.config.routes.web.logout, (req, res) => {
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Erreur lors de la déconnexion:', err);
          }
          res.redirect(this.config.redirects.afterLogout);
        });
      } else {
        res.redirect(this.config.redirects.afterLogout);
      }
    });

    // Routes EJS - Dashboard sécurisé
    this.app.createRoute('get', this.config.routes.web.dashboard, this.requireAuth.bind(this), (req, res) => {
      res.render('auth/dashboard', {
        title: 'Dashboard',
        user: req.session.user,
        layout: false
      });
    });
    
    console.log('✅ Routes web EJS d\'authentification sécurisées configurées');
  }

  // Validation d'intégrité de session
  isValidSessionUser(user) {
    return user && 
           typeof user.id === 'number' && 
           typeof user.username === 'string' && 
           typeof user.email === 'string' && 
           typeof user.role === 'string' &&
           user.username.length > 0 &&
           user.email.includes('@');
  }

  async authenticateUser(username, password, ip) {
    const bcrypt = require('bcryptjs');
    
    // Validation préventive
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return null;
    }
    
    const query = this.config.database.type === 'mysql' ? 
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND (locked_until IS NULL OR locked_until < NOW())' :
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND (locked_until IS NULL OR locked_until < datetime("now"))';
    
    let user;
    
    try {
      if (this.config.database.type === 'mysql') {
        const [rows] = await this.db.execute(query, [username, username]);
        user = rows[0];
      } else {
        user = await new Promise((resolve, reject) => {
          this.db.get(query, [username, username], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      }
      
      if (!user) {
        return null;
      }
      
      // Vérifier si le compte est verrouillé
      if (user.login_attempts >= this.config.security.maxLoginAttempts) {
        await this.lockAccount(user.id);
        return null;
      }
      
      // Vérification sécurisée du mot de passe
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        await this.incrementLoginAttempts(user.id);
        return null;
      }
      
      return user;
    } catch (error) {
      console.error('Erreur lors de l\'authentification:', error.message);
      return null;
    }
  }

  async createUser(username, email, password) {
    const bcrypt = require('bcryptjs');
    
    // Validation du mot de passe
    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors[0]);
    }
    
    const hashedPassword = await bcrypt.hash(password, 12); // Augmentation du salt rounds
    
    const query = this.config.database.type === 'mysql' ?
      'INSERT INTO users (username, email, password, password_changed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)' :
      'INSERT INTO users (username, email, password, password_changed_at) VALUES (?, ?, ?, datetime("now"))';
    
    if (this.config.database.type === 'mysql') {
      const [result] = await this.db.execute(query, [username, email, hashedPassword]);
      return {
        id: result.insertId,
        username,
        email,
        role: 'user'
      };
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(query, [username, email, hashedPassword], function(err) {
          if (err) reject(err);
          else resolve({
            id: this.lastID,
            username,
            email,
            role: 'user'
          });
        });
      });
    }
  }

  // Middlewares d'authentification
  requireAuth(req, res, next) {
    if (!req.session || !req.session.user || !this.isValidSessionUser(req.session.user)) {
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({
          success: false,
          message: 'Authentification requise'
        });
      }
      return res.redirect(this.config.redirects.loginRequired);
    }
    next();
  }

  requireRole(role) {
    return (req, res, next) => {
      if (!req.session.user) {
        return res.redirect(this.config.redirects.loginRequired);
      }
      
      if (req.session.user.role !== role && req.session.user.role !== 'admin') {
        return res.status(403).send('Accès refusé - Permissions insuffisantes');
      }
      
      next();
    };
  }

  // API publique
  isAuthenticated(req) {
    return !!req.session.user;
  }

  getCurrentUser(req) {
    return req.session.user || null;
  }

  async logout(req) {
    return new Promise((resolve) => {
      req.session.destroy((err) => {
        resolve(!err);
      });
    });
  }

  async destroy() {
    if (this.db) {
      if (this.config.database.type === 'mysql') {
        await this.db.end();
      } else {
        this.db.close();
      }
    }
    this.isEnabled = false;
    console.log('🔐 Système d\'authentification fermé');
  }

  // Nouvelle méthode pour mettre à jour un utilisateur
  async updateUser(userId, updates) {
    const allowedFields = ['email'];
    const setClause = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (setClause.length === 0) {
      throw new Error('Aucun champ valide à mettre à jour');
    }
    
    values.push(userId);
    const query = `UPDATE users SET ${setClause.join(', ')} WHERE id = ?`;
    
    if (this.config.database.type === 'mysql') {
      await this.db.execute(query, values);
    } else {
      await new Promise((resolve, reject) => {
        this.db.run(query, values, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  // Méthode pour désactiver/activer les routes web
  toggleWebRoutes(enabled) {
    this.config.routes.web.enabled = enabled;
    
    if (enabled && this.isEnabled) {
      this.setupWebRoutes();
      console.log('✅ Routes web EJS activées');
    } else {
      console.log('❌ Routes web EJS désactivées');
    }
  }

  // Méthode pour désactiver/activer les vues automatiques
  toggleAutoViews(enabled) {
    this.config.views.enabled = enabled;
    
    if (enabled && this.isEnabled) {
      this.setupViews();
      console.log('✅ Vues automatiques activées');
    } else {
      console.log('❌ Vues automatiques désactivées');
    }
  }

  // Méthodes de sécurité
  sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>\"']/g, '');
  }

  validatePassword(password) {
    const config = this.config.password;
    const errors = [];
    
    if (password.length < config.minLength) {
      errors.push(`Le mot de passe doit contenir au moins ${config.minLength} caractères`);
    }
    
    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins une majuscule');
    }
    
    if (config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins une minuscule');
    }
    
    if (config.requireNumbers && !/\d/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins un chiffre');
    }
    
    if (config.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Le mot de passe doit contenir au moins un caractère spécial');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateRegistrationData({ username, email, password, confirmPassword }) {
    if (!username || !email || !password || !confirmPassword) {
      return { isValid: false, message: 'Tous les champs sont requis' };
    }
    
    if (password !== confirmPassword) {
      return { isValid: false, message: 'Les mots de passe ne correspondent pas' };
    }
    
    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.isValid) {
      return { isValid: false, message: passwordValidation.errors[0] };
    }
    
    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, message: 'Format d\'email invalide' };
    }
    
    // Validation username
    if (username.length < 3 || username.length > 50) {
      return { isValid: false, message: 'Le nom d\'utilisateur doit contenir entre 3 et 50 caractères' };
    }
    
    return { isValid: true };
  }

  isRateLimited(ip) {
    const now = Date.now();
    const attempts = this.rateLimitStore.get(ip) || { count: 0, resetTime: now + this.config.security.rateLimit.windowMs };
    
    if (now > attempts.resetTime) {
      this.rateLimitStore.set(ip, { count: 1, resetTime: now + this.config.security.rateLimit.windowMs });
      return false;
    }
    
    if (attempts.count >= this.config.security.rateLimit.max) {
      return true;
    }
    
    attempts.count++;
    this.rateLimitStore.set(ip, attempts);
    return false;
  }

  recordFailedAttempt(ip) {
    const now = Date.now();
    const attempts = this.loginAttempts.get(ip) || { count: 0, resetTime: now + this.config.security.lockoutDuration };
    
    if (now > attempts.resetTime) {
      this.loginAttempts.set(ip, { count: 1, resetTime: now + this.config.security.lockoutDuration });
    } else {
      attempts.count++;
      this.loginAttempts.set(ip, attempts);
    }
  }

  async regenerateSession(req) {
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async resetLoginAttempts(userId) {
    const query = this.config.database.type === 'mysql' ?
      'UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?' :
      'UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?';
    
    if (this.config.database.type === 'mysql') {
      await this.db.execute(query, [userId]);
    } else {
      await new Promise((resolve, reject) => {
        this.db.run(query, [userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  async updateLastLogin(userId) {
    const query = this.config.database.type === 'mysql' ?
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?' :
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?';
    
    if (this.config.database.type === 'mysql') {
      await this.db.execute(query, [userId]);
    } else {
      await new Promise((resolve, reject) => {
        this.db.run(query, [userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  // Méthode pour verrouiller un compte après trop de tentatives de connexion
  async lockAccount(userId) {
    const lockUntil = new Date(Date.now() + this.config.security.lockoutDuration);
    const query = this.config.database.type === 'mysql' ?
      'UPDATE users SET locked_until = ? WHERE id = ?' :
      'UPDATE users SET locked_until = ? WHERE id = ?';
    
    if (this.config.database.type === 'mysql') {
      await this.db.execute(query, [lockUntil, userId]);
    } else {
      await new Promise((resolve, reject) => {
        this.db.run(query, [lockUntil.toISOString(), userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  logSystemInfo() {
    console.log('✅ Système d\'authentification initialisé avec sécurité renforcée');
    console.log(`📊 Base de données: ${this.config.database.type}`);
    console.log(`🌐 Routes web EJS: ${this.config.routes.web.enabled ? 'Activées' : 'Désactivées'}`);
    console.log(`👁️ Vues automatiques: ${this.config.views.enabled ? 'Activées' : 'Désactivées'}`);
    console.log(`🔒 Sécurité: Rate limiting, Protection CSRF, Headers sécurisés`);
    console.log(`🛡️ Protection des mots de passe: Longueur min ${this.config.password.minLength}, Complexité requise`);
  }
}

module.exports = AuthManager;