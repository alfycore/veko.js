# 🔌 Plugins - Guide Complet

Le système de plugins de Veko.js permet d'étendre les fonctionnalités de votre application de manière modulaire.

## Table des Matières

- [Introduction](#introduction)
- [Structure d'un Plugin](#structure-dun-plugin)
- [Créer un Plugin](#créer-un-plugin)
- [Hooks Disponibles](#hooks-disponibles)
- [API Plugin](#api-plugin)
- [Charger des Plugins](#charger-des-plugins)
- [Plugins Officiels](#plugins-officiels)
- [Bonnes Pratiques](#bonnes-pratiques)

---

## Introduction

Les plugins Veko.js permettent de :

- 🎣 S'accrocher aux événements du cycle de vie
- 🔧 Ajouter des middlewares personnalisés
- 🛠️ Étendre les fonctionnalités de l'application
- 📦 Partager du code entre projets
- 🔌 Intégrer des services tiers

---

## Structure d'un Plugin

### Structure Basique

```javascript
// plugins/mon-plugin.js
module.exports = {
  // Métadonnées (requis)
  name: 'mon-plugin',
  version: '1.0.0',
  
  // Hooks (optionnel)
  hooks: {
    'app:init': (app) => { /* ... */ },
    'app:start': (app, port) => { /* ... */ }
  },
  
  // API publique (optionnel)
  api: {
    maMethode: () => { /* ... */ }
  }
};
```

### Structure Avancée

```javascript
// plugins/analytics/index.js
module.exports = {
  name: 'analytics',
  version: '2.0.0',
  description: 'Plugin d\'analytics pour Veko.js',
  author: 'Votre Nom',
  
  // Dépendances
  dependencies: ['database'],  // Plugins requis
  
  // Configuration par défaut
  defaultConfig: {
    trackPageViews: true,
    trackEvents: true,
    sampleRate: 1.0
  },
  
  // Initialisation
  async init(app, config) {
    this.app = app;
    this.config = { ...this.defaultConfig, ...config };
    this.events = [];
    
    console.log(`[Analytics] Initialized with sample rate: ${this.config.sampleRate}`);
  },
  
  // Destruction
  async destroy() {
    await this.flush();
    console.log('[Analytics] Destroyed');
  },
  
  // Hooks
  hooks: {
    'app:init': function(app) {
      app.use(this.middleware());
    },
    
    'route:before': function(req, res, route) {
      if (this.config.trackPageViews) {
        this.trackPageView(req.path);
      }
    },
    
    'route:after': function(req, res, route, duration) {
      this.trackTiming(route.path, duration);
    }
  },
  
  // Méthodes internes
  middleware() {
    return (req, res, next) => {
      req.analytics = this.api;
      next();
    };
  },
  
  trackPageView(path) {
    if (Math.random() <= this.config.sampleRate) {
      this.events.push({
        type: 'pageview',
        path,
        timestamp: Date.now()
      });
    }
  },
  
  trackTiming(path, duration) {
    this.events.push({
      type: 'timing',
      path,
      duration,
      timestamp: Date.now()
    });
  },
  
  async flush() {
    if (this.events.length > 0) {
      // Envoyer les événements au serveur d'analytics
      console.log(`[Analytics] Flushing ${this.events.length} events`);
      this.events = [];
    }
  },
  
  // API publique
  api: {
    track(event, data) {
      this.events.push({
        type: 'event',
        event,
        data,
        timestamp: Date.now()
      });
    },
    
    identify(userId, traits) {
      this.events.push({
        type: 'identify',
        userId,
        traits,
        timestamp: Date.now()
      });
    },
    
    getStats() {
      return {
        totalEvents: this.events.length,
        byType: this.events.reduce((acc, e) => {
          acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        }, {})
      };
    }
  }
};
```

---

## Créer un Plugin

### Plugin Simple

```javascript
// plugins/logger-plugin.js
module.exports = {
  name: 'request-logger',
  version: '1.0.0',
  
  hooks: {
    'route:before': (req, res, route) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
  }
};
```

### Plugin avec Configuration

```javascript
// plugins/cache-plugin.js
const NodeCache = require('node-cache');

module.exports = {
  name: 'cache',
  version: '1.0.0',
  
  defaultConfig: {
    stdTTL: 300,        // 5 minutes
    checkperiod: 60,    // Vérification toutes les 60s
    maxKeys: 1000
  },
  
  async init(app, config) {
    this.config = { ...this.defaultConfig, ...config };
    this.cache = new NodeCache(this.config);
    
    // Ajouter le cache à l'app
    app.cache = this.api;
  },
  
  async destroy() {
    this.cache.close();
  },
  
  api: {
    get(key) {
      return this.cache.get(key);
    },
    
    set(key, value, ttl) {
      return this.cache.set(key, value, ttl);
    },
    
    del(key) {
      return this.cache.del(key);
    },
    
    flush() {
      return this.cache.flushAll();
    },
    
    stats() {
      return this.cache.getStats();
    }
  }
};
```

### Plugin avec Middleware

```javascript
// plugins/cors-extended.js
module.exports = {
  name: 'cors-extended',
  version: '1.0.0',
  
  defaultConfig: {
    origins: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowCredentials: true
  },
  
  init(app, config) {
    this.config = { ...this.defaultConfig, ...config };
  },
  
  hooks: {
    'app:init': function(app) {
      app.use(this.corsMiddleware());
    }
  },
  
  corsMiddleware() {
    return (req, res, next) => {
      const origin = req.headers.origin;
      
      if (this.config.origins.includes(origin) || this.config.origins.includes('*')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', this.config.methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (this.config.allowCredentials) {
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
      }
      
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
      
      next();
    };
  }
};
```

### Plugin avec Routes

```javascript
// plugins/health-check.js
module.exports = {
  name: 'health-check',
  version: '1.0.0',
  
  defaultConfig: {
    path: '/health',
    detailed: false
  },
  
  init(app, config) {
    this.app = app;
    this.config = { ...this.defaultConfig, ...config };
    this.startTime = Date.now();
  },
  
  hooks: {
    'app:init': function(app) {
      // Route de health check simple
      app.createRoute('GET', this.config.path, (req, res) => {
        const health = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: Date.now() - this.startTime
        };
        
        if (this.config.detailed) {
          health.memory = process.memoryUsage();
          health.cpu = process.cpuUsage();
          health.node = process.version;
        }
        
        res.json(health);
      });
      
      // Route de readiness
      app.createRoute('GET', `${this.config.path}/ready`, async (req, res) => {
        const checks = await this.runChecks();
        const allPassing = checks.every(c => c.status === 'ok');
        
        res.status(allPassing ? 200 : 503).json({
          ready: allPassing,
          checks
        });
      });
    }
  },
  
  async runChecks() {
    const checks = [];
    
    // Vérifier la base de données si disponible
    if (this.app.db) {
      try {
        await this.app.db.query('SELECT 1');
        checks.push({ name: 'database', status: 'ok' });
      } catch (error) {
        checks.push({ name: 'database', status: 'error', message: error.message });
      }
    }
    
    // Vérifier Redis si disponible
    if (this.app.redis) {
      try {
        await this.app.redis.ping();
        checks.push({ name: 'redis', status: 'ok' });
      } catch (error) {
        checks.push({ name: 'redis', status: 'error', message: error.message });
      }
    }
    
    return checks;
  }
};
```

---

## Hooks Disponibles

### Hooks du Cycle de Vie

| Hook | Arguments | Description |
|------|-----------|-------------|
| `app:init` | `(app)` | Application initialisée |
| `app:start` | `(app, port)` | Serveur démarré |
| `app:stop` | `(app)` | Serveur arrêté |
| `app:error` | `(app, error)` | Erreur globale |

### Hooks de Routing

| Hook | Arguments | Description |
|------|-----------|-------------|
| `route:before` | `(req, res, route)` | Avant chaque requête |
| `route:after` | `(req, res, route, duration)` | Après chaque requête |
| `route:error` | `(req, res, route, error)` | Erreur dans une route |
| `route:created` | `(route)` | Route créée |
| `route:deleted` | `(route)` | Route supprimée |

### Hooks d'Authentification

| Hook | Arguments | Description |
|------|-----------|-------------|
| `auth:login` | `(user)` | Utilisateur connecté |
| `auth:logout` | `(user)` | Utilisateur déconnecté |
| `auth:register` | `(user)` | Nouvel utilisateur |
| `auth:failed` | `(email, reason)` | Échec de connexion |

### Hooks de Plugins

| Hook | Arguments | Description |
|------|-----------|-------------|
| `plugin:loaded` | `(plugin)` | Plugin chargé |
| `plugin:unloaded` | `(plugin)` | Plugin déchargé |
| `plugin:error` | `(plugin, error)` | Erreur dans un plugin |

### Hooks de Mise à Jour

| Hook | Arguments | Description |
|------|-----------|-------------|
| `app:before-update` | `(app, updateInfo)` | Avant une mise à jour |
| `app:after-update` | `(app, updateInfo)` | Après une mise à jour |
| `app:update-error` | `(app, error)` | Erreur de mise à jour |

---

## API Plugin

### Accéder à un Plugin

```javascript
// Récupérer un plugin
const analytics = app.plugins.get('analytics');

// Utiliser l'API du plugin
analytics.api.track('button_click', { button: 'signup' });

// Vérifier si un plugin existe
if (app.plugins.has('cache')) {
  const data = app.plugins.get('cache').api.get('myKey');
}
```

### Lister les Plugins

```javascript
// Tous les plugins
const allPlugins = app.plugins.list();

// Statistiques
const stats = app.plugins.getStats();
console.log(stats);
// { total: 5, active: 4, inactive: 1 }
```

### Désactiver/Réactiver un Plugin

```javascript
// Désactiver
await app.plugins.disable('analytics');

// Réactiver
await app.plugins.enable('analytics');

// Recharger
await app.plugins.reload('analytics');
```

---

## Charger des Plugins

### Auto-chargement

```javascript
const app = createApp({
  plugins: {
    enabled: true,
    autoLoad: true,
    pluginsDir: 'plugins'  // Charge tous les plugins du dossier
  }
});
```

### Chargement Manuel

```javascript
// Charger un plugin avec configuration
await app.plugins.load(require('./plugins/analytics'), {
  trackPageViews: true,
  sampleRate: 0.5
});

// Charger depuis npm
await app.plugins.load(require('veko-plugin-sentry'), {
  dsn: process.env.SENTRY_DSN
});
```

### Ordre de Chargement

```javascript
const app = createApp({
  plugins: {
    enabled: true,
    loadOrder: ['database', 'cache', 'analytics']  // Ordre spécifique
  }
});
```

---

## Plugins Officiels

### veko-plugin-sentry

Intégration Sentry pour le monitoring d'erreurs.

```javascript
await app.plugins.load(require('veko-plugin-sentry'), {
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

### veko-plugin-swagger

Documentation API automatique.

```javascript
await app.plugins.load(require('veko-plugin-swagger'), {
  title: 'Mon API',
  version: '1.0.0',
  path: '/api-docs'
});
```

### veko-plugin-i18n

Internationalisation.

```javascript
await app.plugins.load(require('veko-plugin-i18n'), {
  defaultLocale: 'fr',
  locales: ['fr', 'en', 'es'],
  directory: './locales'
});
```

### veko-plugin-graphql

Support GraphQL.

```javascript
await app.plugins.load(require('veko-plugin-graphql'), {
  schema: './schema.graphql',
  resolvers: require('./resolvers'),
  playground: true
});
```

---

## Bonnes Pratiques

### 1. Nommage et Versioning

```javascript
module.exports = {
  name: 'mon-plugin',          // Nom unique en kebab-case
  version: '1.2.3',            // Semantic versioning
  description: 'Description claire',
  author: 'Nom <email>'
};
```

### 2. Gestion des Erreurs

```javascript
hooks: {
  'app:init': async function(app) {
    try {
      await this.connectToService();
    } catch (error) {
      console.error(`[${this.name}] Erreur d'initialisation:`, error);
      // Ne pas bloquer l'app, continuer en mode dégradé
      this.degradedMode = true;
    }
  }
}
```

### 3. Cleanup Propre

```javascript
async destroy() {
  // Fermer les connexions
  await this.db?.close();
  await this.redis?.quit();
  
  // Flush les données en attente
  await this.flush();
  
  // Clear les timers
  clearInterval(this.syncInterval);
  
  console.log(`[${this.name}] Cleaned up`);
}
```

### 4. Configuration Validée

```javascript
init(app, config) {
  // Valider la configuration
  const schema = {
    apiKey: { required: true, type: 'string' },
    timeout: { type: 'number', default: 5000 },
    retries: { type: 'number', min: 0, max: 10, default: 3 }
  };
  
  this.config = this.validateConfig(config, schema);
},

validateConfig(config, schema) {
  const validated = {};
  
  for (const [key, rules] of Object.entries(schema)) {
    const value = config[key] ?? rules.default;
    
    if (rules.required && value === undefined) {
      throw new Error(`[${this.name}] Config '${key}' is required`);
    }
    
    if (value !== undefined && rules.type && typeof value !== rules.type) {
      throw new Error(`[${this.name}] Config '${key}' must be ${rules.type}`);
    }
    
    validated[key] = value;
  }
  
  return validated;
}
```

### 5. Documentation

```javascript
/**
 * Plugin Analytics pour Veko.js
 * 
 * @example
 * await app.plugins.load(require('./analytics'), {
 *   trackPageViews: true,
 *   sampleRate: 0.5
 * });
 * 
 * // Utilisation
 * app.plugins.get('analytics').api.track('event', { data: 'value' });
 */
module.exports = {
  name: 'analytics',
  // ...
};
```

---

<p align="center">
  <a href="auth.md">← Authentification</a> •
  <a href="api.md">API Reference →</a>
</p>
