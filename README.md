# 🚀 Veko.js

Un framework web **ultra moderne** et **intelligent** pour Node.js avec Express et EJS, conçu pour un développement rapide et efficace avec **hot reload intelligent**, **logs ultra beaux** et **système de plugins extensible**.

## ✨ Caractéristiques

- 🔥 **Hot Reload Intelligent** - Rechargement sélectif des routes modifiées
- 🎨 **Logs Ultra Beaux** - Système de logs colorés avec icônes et timestamps
- ⚡ **WebSocket Intégré** - Communication temps réel pour le développement
- 📁 **Chargement Automatique** - Routes, vues et middleware auto-configurés
- 🛠️ **Mode Développement** - Surveillance avancée des fichiers
- 🌐 **Préchargement Intelligent** - Cache et préchargement des routes
- 🔌 **Système de Plugins** - Architecture extensible avec hooks et API complète
- 🛣️ **Gestion Dynamique des Routes** - Création/suppression de routes à la volée

## 🚀 Installation

```bash
npm install veko
```

## 📦 Démarrage rapide

### 1. Application basique

```javascript
const { App } = require('veko');

const app = new App({
  port: 3000,
  viewsDir: 'views',
  staticDir: 'public',
  routesDir: 'routes',
  plugins: {
    enabled: true,
    autoLoad: true,
    pluginsDir: 'plugins'
  }
});

app.loadRoutes() // Charge automatiquement toutes les routes
   .listen();
```

### 2. Mode développement ultra moderne

```javascript
const { startDev } = require('veko');

// Démarrage simple en mode dev
startDev({ port: 3000 });
```

Ou directement avec la classe App :

```javascript
const { App } = require('veko');

const app = new App({
  port: 3000,
  isDev: true, // Active le mode développement
  wsPort: 3008, // Port WebSocket pour hot reload
  watchDirs: ['views', 'routes', 'public'], // Dossiers surveillés
  plugins: {
    enabled: true,
    autoLoad: true,
    pluginsDir: 'plugins'
  }
});

app.loadRoutes().listen();
```

## 🔌 Système de Plugins

Veko.js inclut un système de plugins puissant et extensible qui permet d'ajouter des fonctionnalités sans modifier le core du framework.

### Configuration des plugins

```javascript
const app = new App({
  plugins: {
    enabled: true,          // Activer le système de plugins
    autoLoad: true,         // Chargement automatique des plugins
    pluginsDir: 'plugins'   // Dossier des plugins
  }
});
```

### Structure d'un plugin

```javascript
// plugins/mon-plugin.js
module.exports = {
  name: 'mon-plugin',
  version: '1.0.0',
  description: 'Description de mon plugin',
  author: 'Mon Nom',
  
  // Dépendances (autres plugins requis)
  dependencies: ['autre-plugin'],
  
  // Configuration par défaut
  defaultConfig: {
    enabled: true,
    option1: 'valeur'
  },

  // Méthode appelée lors du chargement
  async load(app, config, context) {
    // Votre code d'initialisation
    context.log('success', 'Plugin chargé!');
    
    // Ajouter une route
    context.addRoute('get', '/mon-plugin', (req, res) => {
      res.json({ message: 'Hello from plugin!' });
    });
    
    // Ajouter un middleware
    context.addMiddleware((req, res, next) => {
      req.pluginData = { source: 'mon-plugin' };
      next();
    });
    
    // Ajouter des hooks
    context.hook('route:create', (method, path) => {
      context.log('info', `Route créée: ${method} ${path}`);
    });
  },

  // Méthode appelée lors du déchargement
  async unload(app, config) {
    console.log('Plugin déchargé');
  },

  // Activation/désactivation
  async activate(app, config) {
    console.log('Plugin activé');
  },

  async deactivate(app, config) {
    console.log('Plugin désactivé');
  }
};
```

### API du contexte plugin

Chaque plugin reçoit un contexte riche avec de nombreuses fonctionnalités :

```javascript
async load(app, config, context) {
  // === HOOKS ===
  // Ajouter un hook
  context.hook('hookName', callback);
  context.removeHook('hookName', callback);
  
  // === ROUTES ET MIDDLEWARE ===
  // Ajouter une route
  context.addRoute('get', '/path', handler);
  
  // Ajouter un middleware
  context.addMiddleware(middlewareFunction);
  
  // Ajouter une commande CLI
  context.addCommand('name', handler, 'description');
  
  // === LOGS ===
  // Logger avec le nom du plugin automatique
  context.log('success', 'Message', 'détails');
  
  // === ACCÈS AUX AUTRES PLUGINS ===
  // Obtenir un autre plugin
  const otherPlugin = context.getPlugin('autre-plugin');
  
  // Lister tous les plugins
  const plugins = context.listPlugins();
  
  // === CONFIGURATION ===
  // Lire la config
  const config = context.getConfig();
  
  // Modifier la config
  context.updateConfig({ newOption: 'value' });
  
  // === STOCKAGE PERSISTANT ===
  // Sauvegarder des données
  context.storage.set('key', 'value');
  context.storage.set({ key1: 'value1', key2: 'value2' });
  
  // Lire des données
  const value = context.storage.get('key', 'defaultValue');
  const allData = context.storage.get();
  
  // Supprimer des données
  context.storage.delete('key');
  context.storage.clear();
}
```

### Gestion des plugins

```javascript
// Charger un plugin manuellement
await app.loadPlugin('nom-plugin', { option: 'value' });

// Décharger un plugin
await app.unloadPlugin('nom-plugin');

// Recharger un plugin
await app.reloadPlugin('nom-plugin', { newConfig: true });

// Lister les plugins
const plugins = app.listPlugins();

// Activer/désactiver un plugin
await app.plugins.togglePlugin('nom-plugin', true);

// Statistiques
const stats = app.plugins.getStats();
console.log(`${stats.active}/${stats.total} plugins actifs`);
```

### Hooks disponibles

Le système de plugins dispose de nombreux hooks intégrés :

```javascript
// Hooks d'application
app:init          // Initialisation de l'app
app:start         // Démarrage du serveur
app:stop          // Arrêt du serveur

// Hooks de routes
route:load        // Chargement d'une route
route:create      // Création d'une route
route:created     // Route créée (après)
route:delete      // Suppression d'une route

// Hooks de requêtes
request:start     // Début de requête
request:end       // Fin de requête

// Hooks WebSocket
websocket:connect    // Connexion WebSocket
websocket:disconnect // Déconnexion WebSocket

// Hooks de fichiers
file:change       // Modification de fichier

// Hooks de plugins
plugin:load       // Chargement d'un plugin
plugin:unload     // Déchargement d'un plugin

// Hooks d'erreurs
error:handle      // Gestion d'erreur
```

### Exemples de plugins

#### Plugin de base de données

```javascript
// plugins/database.js
const mongoose = require('mongoose');

module.exports = {
  name: 'database',
  version: '1.0.0',
  description: 'Plugin de connexion MongoDB',
  
  defaultConfig: {
    uri: 'mongodb://localhost:27017/myapp',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },

  async load(app, config, context) {
    try {
      await mongoose.connect(config.uri, config.options);
      context.log('success', 'Connexion MongoDB établie');
      
      // Exposer mongoose dans l'app
      app.db = mongoose;
      
      // Hook de fermeture
      context.hook('app:stop', async () => {
        await mongoose.disconnect();
        context.log('info', 'Connexion MongoDB fermée');
      });
      
    } catch (error) {
      context.log('error', 'Erreur connexion MongoDB', error.message);
      throw error;
    }
  },

  async unload() {
    await mongoose.disconnect();
  }
};
```

#### Plugin d'authentification

```javascript
// plugins/auth.js
const jwt = require('jsonwebtoken');

module.exports = {
  name: 'auth',
  version: '1.0.0',
  description: 'Plugin d\'authentification JWT',
  dependencies: ['database'],
  
  defaultConfig: {
    secret: 'your-secret-key',
    expiresIn: '24h'
  },

  async load(app, config, context) {
    // Middleware d'authentification
    const authMiddleware = (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
      }
      
      try {
        const decoded = jwt.verify(token, config.secret);
        req.user = decoded;
        next();
      } catch (error) {
        res.status(401).json({ error: 'Token invalide' });
      }
    };
    
    // Routes d'authentification
    context.addRoute('post', '/auth/login', async (req, res) => {
      const { email, password } = req.body;
      
      // Validation utilisateur (exemple)
      const user = await validateUser(email, password);
      
      if (user) {
        const token = jwt.sign(
          { id: user.id, email: user.email },
          config.secret,
          { expiresIn: config.expiresIn }
        );
        
        res.json({ token, user });
      } else {
        res.status(401).json({ error: 'Identifiants invalides' });
      }
    });
    
    context.addRoute('get', '/auth/profile', authMiddleware, (req, res) => {
      res.json({ user: req.user });
    });
    
    // Exposer le middleware dans l'app
    app.authMiddleware = authMiddleware;
    
    context.log('success', 'Plugin d\'authentification chargé');
  }
};
```

#### Plugin de cache

```javascript
// plugins/cache.js
const NodeCache = require('node-cache');

module.exports = {
  name: 'cache',
  version: '1.0.0',
  description: 'Plugin de cache en mémoire',
  
  defaultConfig: {
    stdTTL: 600, // 10 minutes
    checkperiod: 120
  },

  async load(app, config, context) {
    const cache = new NodeCache(config);
    
    // Middleware de cache
    const cacheMiddleware = (duration = 300) => {
      return (req, res, next) => {
        const key = req.originalUrl;
        const cached = cache.get(key);
        
        if (cached) {
          context.log('info', 'Cache hit', key);
          return res.json(cached);
        }
        
        const originalSend = res.json;
        res.json = function(data) {
          cache.set(key, data, duration);
          context.log('info', 'Cache set', key);
          return originalSend.call(this, data);
        };
        
        next();
      };
    };
    
    // API de cache
    app.cache = {
      get: (key) => cache.get(key),
      set: (key, value, ttl) => cache.set(key, value, ttl),
      del: (key) => cache.del(key),
      flush: () => cache.flushAll(),
      middleware: cacheMiddleware,
      stats: () => cache.getStats()
    };
    
    // Route de stats
    context.addRoute('get', '/cache/stats', (req, res) => {
      res.json(cache.getStats());
    });
    
    context.log('success', 'Plugin de cache chargé');
  }
};
```

### Plugin inline (création à la volée)

```javascript
// Créer un plugin simple directement dans le code
const simplePlugin = app.plugins.createSimplePlugin(
  'logger-plugin',
  (app, config, context) => {
    // Hook pour logger toutes les requêtes
    context.hook('request:start', (req) => {
      context.log('info', `${req.method} ${req.url}`);
    });
    
    // Route de debug
    context.addRoute('get', '/debug/logs', (req, res) => {
      res.json({
        plugin: 'logger-plugin',
        requests: context.storage.get('requestCount', 0)
      });
    });
  },
  {
    version: '1.0.0',
    description: 'Plugin de logging des requêtes'
  }
);

await app.loadPlugin(simplePlugin);
```

## 🛣️ Gestion Dynamique des Routes

Veko.js permet de créer, modifier et supprimer des routes dynamiquement en cours d'exécution.

### Création de routes dynamiques

```javascript
// Créer une route à la volée
app.createRoute('get', '/api/dynamic', (req, res) => {
  res.json({ message: 'Route créée dynamiquement!' });
});

// Avec middleware
app.createRoute('post', '/api/secure', [
  authMiddleware,
  validationMiddleware,
  (req, res) => {
    res.json({ success: true });
  }
]);

// Mettre à jour une route existante
app.updateRoute('get', '/api/dynamic', (req, res) => {
  res.json({ message: 'Route mise à jour!' });
});

// Supprimer une route
app.deleteRoute('get', '/api/dynamic');
```

### Création de fichiers de routes

```javascript
// Créer un fichier de route physique
app.createRouteFile('/users/profile', {
  get: (req, res) => {
    res.render('profile', { user: req.user });
  },
  post: (req, res) => {
    // Mise à jour profil
    res.json({ updated: true });
  }
}, {
  description: 'Gestion du profil utilisateur',
  middleware: [authMiddleware]
});

// Supprimer un fichier de route
app.deleteRouteFile('/users/profile');

// Lister toutes les routes
const routes = app.listRoutes();
console.log(routes);
```

## 🎨 Logs Ultra Beaux

Veko.js propose un système de logs révolutionnaire avec :

- 🕒 **Timestamps français** formatés
- 🎯 **Badges colorés** avec icônes Unicode
- 📊 **Types de logs** spécialisés
- 🌈 **Couleurs ANSI** optimisées

### Types de logs disponibles

```javascript
app.log('success', 'Opération réussie', '✅ Détails supplémentaires');
app.log('error', 'Erreur critique', '❌ Message d\'erreur');
app.log('warning', 'Attention', '⚠️ Avertissement');
app.log('info', 'Information', 'ℹ️ Info générale');
app.log('server', 'Serveur', '🚀 Démarrage serveur');
app.log('route', 'Route', '🌐 Nouvelle route');
app.log('dev', 'Développement', '🛠️ Mode dev');
app.log('file', 'Fichier', '📁 Modification fichier');
app.log('reload', 'Rechargement', '🔄 Hot reload');
app.log('create', 'Création', '➕ Élément créé');
app.log('delete', 'Suppression', '🗑️ Élément supprimé');
```

### Exemple de sortie console

```
[14:32:15] ✨  Serveur démarré avec succès 🌐 http://localhost:3000
[14:32:16] 🛠️  Mode développement actif 🔥 Hot reload intelligent sur port 3008
[14:32:16] 🔌  Plugin database chargé database v1.0.0
[14:32:16] 🔌  Plugin auth chargé auth v1.0.0
[14:32:17] 💎  Système de plugins 🔌 2/2 plugins actifs
[14:32:17] 🌐  Route chargée index.js → /
[14:32:18] ➕  Route créée dynamiquement GET /api/users
[14:32:19] 📁  Fichier modifié 📝 routes/users.js
[14:32:19] 🔄  Route rechargée 🔄 routes/users.js
```

## 🔥 Hot Reload Intelligent

### Rechargement sélectif par type de fichier

- **Routes modifiées** → Rechargement de la route uniquement
- **Vues modifiées** → Rechargement léger des templates
- **Fichiers statiques** → Rechargement complet du navigateur
- **Plugins modifiés** → Rechargement du plugin spécifique

### Configuration du hot reload

```javascript
const app = new App({
  isDev: true,
  wsPort: 3008, // Port WebSocket
  watchDirs: ['views', 'routes', 'public', 'src', 'plugins'], // Dossiers surveillés
  prefetch: {
    enabled: true,
    maxConcurrent: 3,
    notifyUser: true,
    cacheRoutes: true,
    prefetchDelay: 1000
  }
});
```

### Script client automatique

Le script de hot reload est automatiquement injecté dans vos pages :

```javascript
// Injecté automatiquement dans </body>
<script>
(function() {
  const ws = new WebSocket('ws://localhost:3008');
  
  ws.onopen = () => console.log('🔗 Veko.js connecté');
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
      case 'reload':
        console.log('🔄 Rechargement complet...');
        setTimeout(() => window.location.reload(), 300);
        break;
        
      case 'route-reload':
        console.log('🔄 Route rechargée:', data.route);
        if (window.location.pathname === data.route) {
          setTimeout(() => window.location.reload(), 300);
        }
        break;
        
      case 'route-created':
        console.log('➕ Route créée:', data.method, data.path);
        break;
        
      case 'route-deleted':
        console.log('🗑️ Route supprimée:', data.method, data.path);
        break;
        
      case 'view-reload':
        console.log('🎨 Vue rechargée:', data.file);
        setTimeout(() => window.location.reload(), 300);
        break;
        
      case 'plugin-reload':
        console.log('🔌 Plugin rechargé:', data.plugin);
        break;
    }
  };
})();
</script>
```

## 📁 Structure du projet

```
mon-projet/
├── routes/
│   ├── index.js          # Route: /
│   ├── about.js          # Route: /about
│   ├── users/
│   │   ├── index.js      # Route: /users
│   │   └── [id].js       # Route: /users/:id
│   └── api/
│       └── products.js   # Route: /api/products
├── views/
│   ├── index.ejs
│   └── about.ejs
├── public/
│   ├── css/
│   └── js/
├── plugins/              # Plugins personnalisés
│   ├── database.js
│   ├── auth.js
│   └── cache.js
├── data/                 # Données des plugins
│   └── plugins/
│       ├── database.json
│       └── auth.json
└── package.json
```

## 🛣️ Système de routes

### Routes automatiques

Veko.js charge automatiquement toutes les routes depuis le dossier `routes/`. Le nom du fichier détermine l'URL :

- `routes/index.js` → `/`
- `routes/about.js` → `/about`
- `routes/users/profile.js` → `/users/profile`
- `routes/api/users.js` → `/api/users`

### Paramètres dynamiques

Utilisez des crochets pour les paramètres :
- `routes/users/[id].js` → `/users/:id`
- `routes/posts/[slug]/comments.js` → `/posts/:slug/comments`

### Format des fichiers de routes

#### Méthodes HTTP (recommandé)

```javascript
// routes/users.js
module.exports = {
  // GET /users
  get: (req, res) => {
    res.render('users', { users: [] });
  },
  
  // POST /users
  post: (req, res) => {
    const newUser = req.body;
    res.status(201).json({ user: newUser });
  },
  
  // PUT /users
  put: (req, res) => {
    res.json({ message: 'User updated' });
  },
  
  // DELETE /users
  delete: (req, res) => {
    res.json({ message: 'User deleted' });
  }
};
```

#### Fonction personnalisée

```javascript
// routes/custom.js
module.exports = (app) => {
  app.get('/custom', (req, res) => {
    res.json({ message: 'Route personnalisée' });
  });
  
  app.post('/custom/:action', middleware, (req, res) => {
    res.json({ action: req.params.action });
  });
};
```

## ⚡ Mode développement ultra moderne

Le mode développement inclut :

- 🔥 **Hot Reload Intelligent** - Rechargement sélectif par type de fichier
- 📡 **WebSocket** - Communication temps réel serveur ↔ client
- 🎨 **Logs Colorés** - Système de logs avec badges et icônes
- 🔍 **Surveillance Avancée** - Monitoring des fichiers avec chokidar
- ⚡ **Performance** - Rechargement uniquement des parties modifiées
- 🛠️ **Debugging** - Messages d'erreur détaillés avec stack traces
- 🔌 **Hot Plugin Reload** - Rechargement des plugins en temps réel

### Configuration complète

```javascript
const app = new App({
  port: 3000,
  wsPort: 3008,
  viewsDir: 'views',
  staticDir: 'public',
  routesDir: 'routes',
  isDev: true,
  watchDirs: ['views', 'routes', 'public', 'src', 'plugins'],
  errorLog: 'error.log',
  showStack: true,
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
  }
});
```

### Gestion avancée des erreurs

```javascript
// Gestion automatique des erreurs non capturées
process.on('uncaughtException', (error) => {
  app.log('error', 'Erreur non gérée', error.message);
  // Notification WebSocket automatique aux clients
});

process.on('unhandledRejection', (reason) => {
  app.log('error', 'Promise rejetée', reason.toString());
  // Broadcast automatique de l'erreur
});
```

## 🎨 Vues avec EJS

Veko.js utilise EJS comme moteur de template par défaut avec configuration avancée.

### Configuration des vues

```javascript
// Configuration automatique des dossiers de vues
this.express.set('view engine', 'ejs');
this.express.set('views', [
  path.join(process.cwd(), this.options.viewsDir), // Dossier projet
  path.join(__dirname, '..', 'views'),             // Vues Veko.js
  path.join(__dirname, '..', 'error')              // Pages d'erreur
]);
```

### Exemple de vue moderne

```html
<!-- views/index.ejs -->
<!DOCTYPE html>
<html>
<head>
  <title><%= title %></title>
  <link rel="stylesheet" href="/css/style.css">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <header>
    <h1><%= message %></h1>
  </header>
  
  <main>
    <% if (users && users.length > 0) { %>
      <section class="users">
        <% users.forEach(user => { %>
          <article class="user-card">
            <h3><%= user.name %></h3>
            <p><%= user.email %></p>
          </article>
        <% }); %>
      </section>
    <% } else { %>
      <p>Aucun utilisateur trouvé.</p>
    <% } %>
  </main>
  
  <!-- Script hot reload injecté automatiquement en mode dev -->
</body>
</html>
```

## 🔧 API Complete

### Classe App

#### Constructor

```javascript
const app = new App({
  port: 3000,                    // Port d'écoute
  wsPort: 3008,                  // Port WebSocket (mode dev)
  viewsDir: 'views',             // Dossier des vues
  staticDir: 'public',           // Dossier statique
  routesDir: 'routes',           // Dossier des routes
  isDev: false,                  // Mode développement
  watchDirs: ['views', 'routes', 'public'], // Dossiers surveillés
  errorLog: 'error.log',         // Fichier de log d'erreurs
  showStack: true,               // Afficher la stack trace
  plugins: {                     // Configuration des plugins
    enabled: true,
    autoLoad: true,
    pluginsDir: 'plugins'
  },
  prefetch: {                    // Configuration préchargement
    enabled: true,
    maxConcurrent: 3,
    notifyUser: true,
    cacheRoutes: true,
    prefetchDelay: 1000
  }
});
```

#### Méthodes principales

```javascript
// Chargement et démarrage
app.loadRoutes(routesDir)        // Charge les routes automatiquement
app.listen(port)                 // Démarre le serveur
app.startDev(port)              // Démarre en mode développement
app.stop()                      // Arrête le serveur

// Middleware et configuration
app.use(middleware)             // Ajoute un middleware
app.setupExpress()              // Configure Express
app.setupDevMode()              // Active le mode développement

// Logs ultra beaux
app.log(type, message, details) // Système de logs avancé

// Gestion dynamique des routes
app.createRoute(method, path, handler, options)  // Crée une route dynamiquement
app.deleteRoute(method, path)                    // Supprime une route
app.updateRoute(method, path, newHandler)        // Met à jour une route
app.createRouteFile(routePath, handlers, options) // Crée un fichier de route
app.deleteRouteFile(routePath)                   // Supprime un fichier de route
app.listRoutes()                                 // Liste toutes les routes

// Gestion des routes (interne)
app.reloadSpecificRoute(filePath)   // Recharge une route spécifique
app.removeRoute(filePath)           // Supprime une route
app.filePathToRoute(filePath)       // Convertit chemin → route

// WebSocket et broadcast
app.broadcast(data)                 // Diffuse un message WebSocket
app.sendAvailableRoutes(ws)         // Envoie les routes disponibles

// Gestion des plugins
app.loadPlugin(plugin, config)      // Charge un plugin
app.unloadPlugin(pluginName)        // Décharge un plugin
app.reloadPlugin(pluginName, config) // Recharge un plugin
app.listPlugins()                   // Liste les plugins
app.executeHook(hookName, ...args)  // Exécute un hook
```

### Fonctions utilitaires

```javascript
const { createApp, startDev, start } = require('veko');

// Création rapide d'une app
const app = createApp({ port: 3000 });

// Démarrage développement
startDev({ port: 3000, watchDirs: ['src'] });

// Démarrage production
start({ port: 8080 });
```

## 🔍 Exemples avancés

### Application complète avec plugins

```javascript
const { App } = require('veko');

const app = new App({
  port: 3000,
  isDev: process.env.NODE_ENV === 'development',
  plugins: {
    enabled: true,
    autoLoad: true,
    pluginsDir: 'plugins'
  }
});

// Charger des plugins avec configuration spécifique
await app.loadPlugin('database', {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp'
});

await app.loadPlugin('auth', {
  secret: process.env.JWT_SECRET || 'development-secret',
  expiresIn: '7d'
});

await app.loadPlugin('cache', {
  stdTTL: 3600 // 1 heure
});

// Ajouter des hooks globaux
app.plugins.addHook('request:start', (req) => {
  app.log('info', `${req.method} ${req.url}`, `IP: ${req.ip}`);
});

app.plugins.addHook('error:handle', (error, req) => {
  app.log('error', 'Erreur applicative', `${error.message} - ${req.url}`);
});

app.loadRoutes().listen();
```

### API REST moderne avec gestion d'erreurs

```javascript
// routes/api/users.js
const users = [];

module.exports = {
  get: async (req, res) => {
    try {
      // Utiliser le cache du plugin
      const cacheKey = `users:${JSON.stringify(req.query)}`;
      const cached = req.app.cache?.get(cacheKey);
      
      if (cached) {
        return res.json(cached);
      }
      
      // Simulation d'une base de données
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const start = (page - 1) * limit;
      const end = start + limit;
      
      const paginatedUsers = users.slice(start, end);
      
      const result = {
        users: paginatedUsers,
        pagination: {
          page,
          limit,
          total: users.length,
          pages: Math.ceil(users.length / limit)
        }
      };
      
      // Mettre en cache
      req.app.cache?.set(cacheKey, result, 300);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  },
  
  post: [
    // Utiliser le middleware d'auth du plugin
    (req, res, next) => req.app.authMiddleware?.(req, res, next) || next(),
    
    async (req, res) => {
      try {
        const { name, email } = req.body;
        
        if (!name || !email) {
          return res.status(400).json({ 
            error: 'Nom et email requis' 
          });
        }
        
        const newUser = {
          id: users.length + 1,
          name,
          email,
          createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        
        // Invalider le cache
        req.app.cache?.del('users:*');
        
        res.status(201).json({ 
          message: 'Utilisateur créé',
          user: newUser 
        });
      } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
      }
    }
  ]
};
```

### Plugin avancé avec CLI

```javascript
// plugins/admin.js
module.exports = {
  name: 'admin',
  version: '2.0.0',
  description: 'Plugin d\'administration avancé',
  dependencies: ['database', 'auth'],
  
  defaultConfig: {
    adminPath: '/admin',
    secretKey: 'admin-secret'
  },

  async load(app, config, context) {
    // Middleware admin uniquement
    const adminMiddleware = (req, res, next) => {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé' });
      }
      next();
    };

    // Routes d'administration
    context.addRoute('get', `${config.adminPath}/dashboard`, [
      app.authMiddleware,
      adminMiddleware,
      (req, res) => {
        res.render('admin/dashboard', {
          stats: context.storage.get('stats', {}),
          plugins: context.listPlugins()
        });
      }
    ]);

    // API de gestion des plugins
    context.addRoute('post', `${config.adminPath}/plugins/:name/toggle`, [
      app.authMiddleware,
      adminMiddleware,
      async (req, res) => {
        try {
          const { name } = req.params;
          const result = await context.getPlugin('plugins')?.togglePlugin(name);
          res.json({ success: true, active: result });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    ]);

    // Commandes CLI
    context.addCommand('admin:stats', () => {
      console.log('=== Statistiques Admin ===');
      console.log('Plugins:', context.listPlugins().length);
      console.log('Stats:', context.storage.get('stats', {}));
    }, 'Affiche les statistiques d\'administration');

    context.addCommand('admin:reset', () => {
      context.storage.clear();
      console.log('Données admin réinitialisées');
    }, 'Remet à zéro les données d\'administration');

    // Hook pour collecter des stats
    context.hook('request:end', (req, res) => {
      const stats = context.storage.get('stats', { requests: 0, errors: 0 });
      stats.requests++;
      
      if (res.statusCode >= 400) {
        stats.errors++;
      }
      
      context.storage.set('stats', stats);
    });

    context.log('success', 'Plugin admin chargé', `Interface: ${config.adminPath}`);
  }
};
```

## 🚀 Déploiement

### Mode production

```javascript
// app.js
const { App } = require('veko');

const app = new App({
  port: process.env.PORT || 3000,
  isDev: false, // Désactive le mode développement
  errorLog: 'logs/error.log',
  showStack: false, // Cache les stack traces en production
  plugins: {
    enabled: true,
    autoLoad: true,
    pluginsDir: 'plugins'
  }
});

app.loadRoutes().listen();
```

### Variables d'environnement

```bash
# .env
NODE_ENV=production
PORT=8080
LOG_LEVEL=info
MONGODB_URI=mongodb://prod-server:27017/myapp
JWT_SECRET=super-secret-production-key
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
```

## 📊 Performance et optimisation

### Préchargement intelligent

```javascript
const app = new App({
  prefetch: {
    enabled: true,          // Activer le préchargement
    maxConcurrent: 3,       // Requêtes simultanées max
    notifyUser: true,       // Notifier l'utilisateur
    cacheRoutes: true,      // Cache des routes
    prefetchDelay: 1000     // Délai avant préchargement
  }
});
```

### Surveillance des performances

```javascript
// Plugin de monitoring
const monitoringPlugin = {
  name: 'monitoring',
  async load(app, config, context) {
    context.hook('request:start', (req) => {
      req.startTime = process.hrtime.bigint();
    });
    
    context.hook('request:end', (req, res) => {
      const duration = Number(process.hrtime.bigint() - req.startTime) / 1000000;
      
      if (duration > 100) {
        context.log('warning', 'Requête lente détectée', 
          `${req.method} ${req.url} - ${duration.toFixed(2)}ms`);
      }
      
      // Stocker les métriques
      const metrics = context.storage.get('metrics', { slow: 0, total: 0 });
      metrics.total++;
      if (duration > 100) metrics.slow++;
      context.storage.set('metrics', metrics);
    });
  }
};

app.loadPlugin(monitoringPlugin);
```

## 🤝 Contribution

Les contributions sont les bienvenues ! 

### Développement local

```bash
git clone https://github.com/username/veko.js.git
cd veko.js
npm install
npm run dev
```

### Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Créer un plugin

1. Créez un fichier dans `plugins/`
2. Suivez la structure de plugin documentée
3. Testez en mode développement
4. Soumettez une PR

## 📄 License

MIT License - voir le fichier LICENSE pour plus de détails.

---

**Veko.js** - Framework web ultra moderne pour Node.js avec système de plugins extensible 🚀🔌