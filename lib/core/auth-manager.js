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
        secret: 'veko-auth-secret-change-me',
        maxAge: 24 * 60 * 60 * 1000,
        secure: false
      },
      routes: {
        // Routes API (toujours activées)
        api: {
          login: '/api/auth/login',
          logout: '/api/auth/logout',
          register: '/api/auth/register',
          check: '/api/auth/check',
          profile: '/api/auth/profile'
        },
        // Routes EJS (optionnelles)
        web: {
          enabled: true, // Peut être désactivé
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
        minLength: 6,
        requireSpecial: false,
        requireNumbers: false
      },
      views: {
        enabled: true, // Peut être désactivé pour utiliser ses propres vues
        autoCreate: true // Créer automatiquement les vues par défaut
      }
    };
    this.db = null;
    this.isEnabled = false;
  }

  async init(config = {}) {
    try {
      // Fusionner la configuration
      this.config = this.mergeConfig(this.config, config);
      
      // Installer les dépendances
      await this.installDependencies();
      
      // Initialiser la base de données
      await this.initDatabase();
      
      // Configurer les sessions
      this.setupSessions();
      
      // Ajouter les routes API (toujours activées)
      this.setupApiRoutes();
      
      // Ajouter les routes web EJS si activées
      if (this.config.routes.web.enabled) {
        this.setupWebRoutes();
      }
      
      // Ajouter les middlewares
      this.setupMiddlewares();
      
      // Créer les vues si activées
      if (this.config.views.enabled && this.config.views.autoCreate) {
        this.setupViews();
      }
      
      this.isEnabled = true;
      console.log('✅ Système d\'authentification initialisé');
      console.log(`📊 Base de données: ${this.config.database.type}`);
      console.log(`🌐 Routes web EJS: ${this.config.routes.web.enabled ? 'Activées' : 'Désactivées'}`);
      console.log(`👁️ Vues automatiques: ${this.config.views.enabled ? 'Activées' : 'Désactivées'}`);
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de l\'authentification:', error.message);
      throw error;
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
      'bcryptjs': '^2.4.3'
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    ` : `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    if (this.config.database.type === 'mysql') {
      await this.db.execute(usersTable);
    } else {
      await new Promise((resolve, reject) => {
        this.db.run(usersTable, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    console.log('✅ Tables de base de données créées');
  }

  setupSessions() {
    const session = require('express-session');
    
    this.app.use(session({
      secret: this.config.session.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: this.config.session.maxAge,
        secure: this.config.session.secure
      }
    }));
    
    console.log('✅ Sessions configurées');
  }

  setupApiRoutes() {
    // API - Connexion
    this.app.createRoute('post', this.config.routes.api.login, async (req, res) => {
      try {
        const { username, password } = req.body;
        const user = await this.authenticateUser(username, password);
        
        if (user) {
          req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          };
          
          res.json({
            success: true,
            message: 'Connexion réussie',
            user: req.session.user
          });
        } else {
          res.status(401).json({
            success: false,
            message: 'Nom d\'utilisateur ou mot de passe incorrect'
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

    // API - Inscription
    this.app.createRoute('post', this.config.routes.api.register, async (req, res) => {
      try {
        const { username, email, password, confirmPassword } = req.body;
        
        // Validation
        if (password !== confirmPassword) {
          return res.status(400).json({
            success: false,
            message: 'Les mots de passe ne correspondent pas'
          });
        }
        
        if (password.length < this.config.password.minLength) {
          return res.status(400).json({
            success: false,
            message: `Le mot de passe doit contenir au moins ${this.config.password.minLength} caractères`
          });
        }
        
        const user = await this.createUser(username, email, password);
        
        req.session.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        };
        
        res.json({
          success: true,
          message: 'Inscription réussie',
          user: req.session.user
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

    // API - Déconnexion
    this.app.createRoute('post', this.config.routes.api.logout, (req, res) => {
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

    // API - Vérifier l'authentification
    this.app.createRoute('get', this.config.routes.api.check, (req, res) => {
      res.json({
        authenticated: this.isAuthenticated(req),
        user: this.getCurrentUser(req)
      });
    });

    // API - Profil utilisateur
    this.app.createRoute('get', this.config.routes.api.profile, this.requireAuth.bind(this), (req, res) => {
      res.json({
        success: true,
        user: req.session.user
      });
    });

    // API - Mise à jour du profil
    this.app.createRoute('put', this.config.routes.api.profile, this.requireAuth.bind(this), async (req, res) => {
      try {
        const { email } = req.body;
        const userId = req.session.user.id;
        
        await this.updateUser(userId, { email });
        
        // Mettre à jour la session
        req.session.user.email = email;
        
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
    });
    
    console.log('✅ Routes API d\'authentification configurées');
  }

  setupWebRoutes() {
    // Routes EJS - Connexion (GET)
    this.app.createRoute('get', this.config.routes.web.login, async (req, res) => {
      if (req.session.user) {
        return res.redirect(this.config.redirects.afterLogin);
      }
      
      res.render('auth/login', {
        title: 'Connexion',
        error: req.query.error,
        layout: false
      });
    });

    // Routes EJS - Connexion (POST)
    this.app.createRoute('post', this.config.routes.web.login, async (req, res) => {
      try {
        const { username, password } = req.body;
        const user = await this.authenticateUser(username, password);
        
        if (user) {
          req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          };
          
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
      
      res.render('auth/register', {
        title: 'Inscription',
        error: req.query.error,
        layout: false
      });
    });

    // Routes EJS - Inscription (POST)
    this.app.createRoute('post', this.config.routes.web.register, async (req, res) => {
      try {
        const { username, email, password, confirmPassword } = req.body;
        
        if (password !== confirmPassword) {
          return res.redirect(`${this.config.routes.web.register}?error=password_mismatch`);
        }
        
        if (password.length < this.config.password.minLength) {
          return res.redirect(`${this.config.routes.web.register}?error=password_too_short`);
        }
        
        const user = await this.createUser(username, email, password);
        
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

    // Routes EJS - Déconnexion
    this.app.createRoute('get', this.config.routes.web.logout, (req, res) => {
      req.session.destroy();
      res.redirect(this.config.redirects.afterLogout);
    });

    // Routes EJS - Dashboard
    this.app.createRoute('get', this.config.routes.web.dashboard, this.requireAuth.bind(this), (req, res) => {
      res.render('auth/dashboard', {
        title: 'Dashboard',
        user: req.session.user,
        layout: false
      });
    });
    
    console.log('✅ Routes web EJS d\'authentification configurées');
  }

  setupMiddlewares() {
    this.app.use((req, res, next) => {
      res.locals.user = req.session.user || null;
      res.locals.isAuthenticated = !!req.session.user;
      next();
    });
  }

  setupViews() {
    const viewsDir = path.join(__dirname, '..', '..', 'views', 'auth');
    
    if (!fs.existsSync(viewsDir)) {
      fs.mkdirSync(viewsDir, { recursive: true });
    }

    this.createLoginView(viewsDir);
    this.createRegisterView(viewsDir);
    this.createDashboardView(viewsDir);
    
    // Ajouter le dossier de vues à Express
    const currentViews = this.app.express.get('views');
    const newViewsPath = path.dirname(viewsDir);
    
    if (Array.isArray(currentViews)) {
      if (!currentViews.includes(newViewsPath)) {
        currentViews.unshift(newViewsPath);
      }
    } else {
      this.app.express.set('views', [currentViews, newViewsPath]);
    }
    
    console.log('✅ Vues d\'authentification créées');
  }

  createLoginView(viewsDir) {
    const loginView = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %> - Veko.js</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .auth-card { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); }
    </style>
</head>
<body class="d-flex align-items-center">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-6 col-lg-4">
                <div class="card auth-card shadow">
                    <div class="card-body p-4">
                        <div class="text-center mb-4">
                            <h1 class="h3">🚀 Veko.js</h1>
                            <p class="text-muted">Connexion à votre compte</p>
                        </div>
                        
                        <% if (error) { %>
                        <div class="alert alert-danger">
                            <% if (error === 'invalid_credentials') { %>
                                Nom d'utilisateur ou mot de passe incorrect
                            <% } else if (error === 'server_error') { %>
                                Erreur serveur, veuillez réessayer
                            <% } else { %>
                                Une erreur est survenue
                            <% } %>
                        </div>
                        <% } %>
                        
                        <form method="POST">
                            <div class="mb-3">
                                <label for="username" class="form-label">Nom d'utilisateur</label>
                                <input type="text" class="form-control" id="username" name="username" required>
                            </div>
                            
                            <div class="mb-3">
                                <label for="password" class="form-label">Mot de passe</label>
                                <input type="password" class="form-control" id="password" name="password" required>
                            </div>
                            
                            <button type="submit" class="btn btn-primary w-100">Se connecter</button>
                        </form>
                        
                        <div class="text-center mt-3">
                            <small>
                                Pas de compte ? 
                                <a href="${this.config.routes.register}" class="text-decoration-none">S'inscrire</a>
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
    
    fs.writeFileSync(path.join(viewsDir, 'login.ejs'), loginView);
  }

  createRegisterView(viewsDir) {
    const registerView = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %> - Veko.js</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .auth-card { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); }
    </style>
</head>
<body class="d-flex align-items-center">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-6 col-lg-4">
                <div class="card auth-card shadow">
                    <div class="card-body p-4">
                        <div class="text-center mb-4">
                            <h1 class="h3">🚀 Veko.js</h1>
                            <p class="text-muted">Créer un nouveau compte</p>
                        </div>
                        
                        <% if (error) { %>
                        <div class="alert alert-danger">
                            <% if (error === 'password_mismatch') { %>
                                Les mots de passe ne correspondent pas
                            <% } else if (error === 'password_too_short') { %>
                                Le mot de passe est trop court
                            <% } else if (error === 'user_exists') { %>
                                Cet utilisateur existe déjà
                            <% } else if (error === 'server_error') { %>
                                Erreur serveur, veuillez réessayer
                            <% } else { %>
                                Une erreur est survenue
                            <% } %>
                        </div>
                        <% } %>
                        
                        <form method="POST">
                            <div class="mb-3">
                                <label for="username" class="form-label">Nom d'utilisateur</label>
                                <input type="text" class="form-control" id="username" name="username" required>
                            </div>
                            
                            <div class="mb-3">
                                <label for="email" class="form-label">Email</label>
                                <input type="email" class="form-control" id="email" name="email" required>
                            </div>
                            
                            <div class="mb-3">
                                <label for="password" class="form-label">Mot de passe</label>
                                <input type="password" class="form-control" id="password" name="password" required>
                            </div>
                            
                            <div class="mb-3">
                                <label for="confirmPassword" class="form-label">Confirmer le mot de passe</label>
                                <input type="password" class="form-control" id="confirmPassword" name="confirmPassword" required>
                            </div>
                            
                            <button type="submit" class="btn btn-primary w-100">S'inscrire</button>
                        </form>
                        
                        <div class="text-center mt-3">
                            <small>
                                Déjà un compte ? 
                                <a href="${this.config.routes.login}" class="text-decoration-none">Se connecter</a>
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
    
    fs.writeFileSync(path.join(viewsDir, 'register.ejs'), registerView);
  }

  createDashboardView(viewsDir) {
    const dashboardView = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %> - Veko.js</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="#">🚀 Veko.js</a>
            <div class="navbar-nav ms-auto">
                <span class="navbar-text me-3">
                    Bonjour, <strong><%= user.username %></strong>
                </span>
                <a class="btn btn-outline-light btn-sm" href="${this.config.routes.logout}">Déconnexion</a>
            </div>
        </div>
    </nav>
    
    <div class="container mt-4">
        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-body">
                        <h1 class="card-title">Dashboard</h1>
                        <p class="card-text">Bienvenue dans votre espace personnel !</p>
                        
                        <div class="row mt-4">
                            <div class="col-md-4">
                                <div class="card bg-light">
                                    <div class="card-body text-center">
                                        <h5 class="card-title">👤 Profil</h5>
                                        <p class="card-text">
                                            <strong>Utilisateur:</strong> <%= user.username %><br>
                                            <strong>Email:</strong> <%= user.email %><br>
                                            <strong>Rôle:</strong> <%= user.role %>
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="col-md-4">
                                <div class="card bg-light">
                                    <div class="card-body text-center">
                                        <h5 class="card-title">📊 Statistiques</h5>
                                        <p class="card-text">
                                            Votre compte est actif et fonctionnel.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="col-md-4">
                                <div class="card bg-light">
                                    <div class="card-body text-center">
                                        <h5 class="card-title">⚡ Actions</h5>
                                        <p class="card-text">
                                            <a href="/" class="btn btn-primary btn-sm">Accueil</a>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
    
    fs.writeFileSync(path.join(viewsDir, 'dashboard.ejs'), dashboardView);
  }

  // Méthodes utilitaires
  async authenticateUser(username, password) {
    const bcrypt = require('bcryptjs');
    
    const query = this.config.database.type === 'mysql' ? 
      'SELECT * FROM users WHERE username = ? OR email = ?' :
      'SELECT * FROM users WHERE username = ? OR email = ?';
    
    let user;
    
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
    
    if (user && await bcrypt.compare(password, user.password)) {
      return user;
    }
    
    return null;
  }

  async createUser(username, email, password) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const query = this.config.database.type === 'mysql' ?
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)' :
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
    
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
    if (!req.session.user) {
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
}

module.exports = AuthManager;