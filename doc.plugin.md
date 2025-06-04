# 🔌 Documentation Plugin Manager - Veko.js

Le système de plugins de Veko.js permet d'étendre facilement les fonctionnalités de votre application avec un système modulaire, robuste et flexible.

## 📋 Table des matières

- [Installation et Configuration](#installation-et-configuration)
- [Création de Plugins](#création-de-plugins)
- [API du Plugin Manager](#api-du-plugin-manager)
- [Support TypeScript](#support-typescript)
- [Outils de Développement](#outils-de-développement)
- [Templates de Plugins](#templates-de-plugins)
- [Hooks et Événements](#hooks-et-événements)
- [Gestion des Dépendances](#gestion-des-dépendances)
- [Métriques et Monitoring](#métriques-et-monitoring)
- [Exemples Pratiques](#exemples-pratiques)
- [Dépannage](#dépannage)

## 🚀 Installation et Configuration

### Initialisation basique

```javascript
const { PluginManager } = require('veko.js');

const app = new Veko();
const pluginManager = new PluginManager(app, {
  pluginsDir: 'plugins',           // Dossier des plugins
  autoLoad: true,                  // Chargement automatique
  supportTypeScript: true,         // Support TypeScript
  devMode: true,                   // Mode développement
  watchMode: true,                 // Surveillance des fichiers
  enableMetrics: true,             // Métriques activées
  enableValidation: true,          // Validation des plugins
  allowHotReload: true,            // Rechargement à chaud
  maxRetries: 3,                   // Tentatives de chargement
  timeout: 30000                   // Timeout en ms
});
```

### Configuration avancée

```javascript
const pluginManager = new PluginManager(app, {
  pluginsDir: 'my-plugins',
  
  // Sécurité
  enableSandbox: true,             // Sandbox pour l'isolation
  enableValidation: true,          // Validation stricte
  
  // Développement
  devMode: process.env.NODE_ENV === 'development',
  watchMode: true,                 // Hot reload automatique
  enableMetrics: true,             // Collecte de métriques
  
  // Performance
  maxRetries: 5,                   // Plus de tentatives
  timeout: 60000,                  // Timeout plus long
  
  // TypeScript
  supportTypeScript: true,
  
  // Hooks
  enableHooks: true,
  enableAPI: true
});
```

## 🔧 Création de Plugins

### Structure de base d'un plugin

```javascript
// plugins/mon-plugin.js
module.exports = {
  // Métadonnées obligatoires
  name: 'mon-plugin',
  version: '1.0.0',
  description: 'Description de mon plugin',
  author: 'Votre nom',
  
  // Métadonnées optionnelles
  license: 'MIT',
  homepage: 'https://github.com/user/plugin',
  repository: 'https://github.com/user/plugin.git',
  
  // Dépendances
  dependencies: ['autre-plugin'],           // Plugins requis
  peerDependencies: ['express', 'lodash'],  // Packages npm requis
  
  // Configuration par défaut
  defaultConfig: {
    enabled: true,
    option1: 'valeur1',
    option2: 42
  },
  
  // Schéma de validation de la config (optionnel)
  configSchema: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean' },
      option1: { type: 'string' },
      option2: { type: 'number', minimum: 0 }
    }
  },
  
  // Hooks utilisés par ce plugin
  hooks: ['app:start', 'request:start'],
  
  // Permissions requises
  permissions: ['read:files', 'write:database'],
  
  // Type de plugin (auto-détecté si omis)
  type: 'middleware', // ou 'router', 'cli', 'websocket', etc.
  
  // Priorité de chargement (plus élevé = chargé en premier)
  priority: 10,
  
  // ========== MÉTHODES ==========
  
  /**
   * Chargement du plugin (OBLIGATOIRE)
   * @param {Object} app - Instance de l'application Veko
   * @param {Object} config - Configuration du plugin
   * @param {Object} context - Contexte et utilitaires
   */
  async load(app, config, context) {
    context.log('info', 'Mon plugin se charge...');
    
    // Ajouter un middleware
    context.addMiddleware((req, res, next) => {
      req.monPlugin = { active: true };
      next();
    });
    
    // Ajouter une route
    context.addRoute('GET', '/mon-plugin', (req, res) => {
      res.json({ message: 'Hello from mon-plugin!' });
    });
    
    // Ajouter un hook
    context.hook('request:start', async (req) => {
      context.log('debug', 'Requête interceptée par mon-plugin');
      return req;
    });
    
    // Ajouter une commande CLI
    context.addCommand('mon-plugin:test', () => {
      console.log('Commande de test exécutée !');
    }, 'Commande de test pour mon plugin');
    
    // Utiliser le stockage persistant
    context.storage.set('initialized', Date.now());
    
    context.log('success', 'Mon plugin chargé avec succès !');
  },
  
  /**
   * Déchargement du plugin (OPTIONNEL)
   */
  async unload(app, config) {
    console.log('Mon plugin se décharge...');
    // Nettoyage des ressources
  },
  
  /**
   * Activation du plugin (OPTIONNEL)
   */
  async activate(app, config) {
    console.log('Mon plugin s\'active...');
  },
  
  /**
   * Désactivation du plugin (OPTIONNEL)
   */
  async deactivate(app, config) {
    console.log('Mon plugin se désactive...');
  }
};
```

### Plugin TypeScript

```typescript
// plugins/mon-plugin.ts
interface PluginConfig {
  enabled: boolean;
  apiKey?: string;
  retries: number;
}

interface PluginContext {
  log: (type: string, message: string, details?: string) => void;
  addRoute: (method: string, path: string, handler: Function) => void;
  addMiddleware: (middleware: Function) => void;
  hook: (hookName: string, callback: Function, priority?: number) => void;
  storage: {
    get: (key: string, defaultValue?: any) => any;
    set: (key: string, value: any) => boolean;
  };
}

export = {
  name: 'mon-plugin-ts',
  version: '1.0.0',
  description: 'Plugin TypeScript',
  
  async load(app: any, config: PluginConfig, context: PluginContext) {
    context.log('info', 'Plugin TypeScript chargé !');
    
    context.addRoute('GET', '/ts-plugin', (req: any, res: any) => {
      res.json({ typescript: true, config });
    });
  }
};
```

## 📖 API du Plugin Manager

### Chargement et gestion des plugins

```javascript
// Charger un plugin spécifique
await pluginManager.loadPlugin('mon-plugin', { option: 'valeur' });

// Charger un plugin depuis un objet
const plugin = require('./my-plugin');
await pluginManager.loadPlugin(plugin);

// Charger tous les plugins du dossier
await pluginManager.loadAllPlugins();

// Décharger un plugin
await pluginManager.unloadPlugin('mon-plugin');

// Recharger un plugin
await pluginManager.reloadPlugin('mon-plugin', { nouvelleConfig: true });

// Activer/désactiver un plugin
await pluginManager.togglePlugin('mon-plugin', true);  // activer
await pluginManager.togglePlugin('mon-plugin', false); // désactiver
await pluginManager.togglePlugin('mon-plugin');        // basculer
```

### Informations sur les plugins

```javascript
// Obtenir un plugin
const plugin = pluginManager.getPlugin('mon-plugin');

// Lister tous les plugins
const plugins = pluginManager.listPlugins();
console.log(plugins);
// [
//   {
//     name: 'mon-plugin',
//     version: '1.0.0',
//     description: '...',
//     loaded: true,
//     active: true,
//     loadTime: 1234567890,
//     errorCount: 0
//   }
// ]

// Vérifier la santé d'un plugin
const health = pluginManager.checkPluginHealth('mon-plugin');
console.log(health);
// {
//   name: 'mon-plugin',
//   loaded: true,
//   active: true,
//   errorCount: 0,
//   uptime: 300000,
//   health: 'healthy' // 'healthy' | 'warning' | 'critical'
// }

// Statistiques globales
const stats = pluginManager.getStats();
console.log(stats);
// {
//   total: 5,
//   active: 4,
//   loaded: 5,
//   loading: 0,
//   hooks: 15,
//   totalHookCallbacks: 23,
//   middleware: 8,
//   routes: 12,
//   commands: 6,
//   errors: 0,
//   uptime: 600000
// }
```

### Sauvegarde et restauration

```javascript
// Sauvegarder l'état des plugins
const backupPath = await pluginManager.backupPlugins();
console.log('Sauvegarde créée:', backupPath);

// Sauvegarder à un emplacement spécifique
await pluginManager.backupPlugins('./my-backup.json');

// Restaurer depuis une sauvegarde
await pluginManager.restorePlugins('./my-backup.json');

// Sauvegarder/restaurer l'état automatiquement
pluginManager.saveState();
await pluginManager.restoreState();
```

## 🔷 Support TypeScript

### Configuration automatique

Le PluginManager détecte et configure automatiquement TypeScript :

```javascript
const pluginManager = new PluginManager(app, {
  supportTypeScript: true  // Active la détection automatique
});
```

### Chargement des plugins TypeScript

```javascript
// Le manager charge automatiquement les fichiers .ts
// plugins/
//   ├── plugin1.js      ← Chargé avec require()
//   ├── plugin2.ts      ← Compilé et chargé automatiquement
//   └── plugin3/
//       ├── index.ts    ← Détecté et compilé
//       └── package.json
```

### Compilation à la volée

Si `ts-node` n'est pas disponible, le système compile automatiquement :

```javascript
// Compile automatiquement le TypeScript en JavaScript temporaire
// puis nettoie les fichiers temporaires après chargement
```

## 🛠️ Outils de Développement

### Création rapide de plugins

```javascript
// Plugin de développement rapide
const devPlugin = pluginManager.createDevPlugin('test-plugin', {
  routes: {
    '/test': (req, res) => res.json({ test: true }),
    '/hello': (req, res) => res.json({ message: 'Hello!' })
  },
  
  middleware: [
    (req, res, next) => {
      console.log('Middleware de test');
      next();
    }
  ],
  
  hooks: {
    'request:start': (req) => {
      console.log('Hook de test:', req.url);
      return req;
    }
  },
  
  commands: {
    'test:command': {
      handler: () => console.log('Commande de test !'),
      description: 'Commande de test'
    }
  },
  
  load: async (app, config, context) => {
    context.log('info', 'Code personnalisé exécuté !');
  }
});

await pluginManager.loadPlugin(devPlugin);
```

### Builder Pattern

```javascript
// Créer un plugin avec le pattern builder
const plugin = pluginManager.createPluginBuilder()
  .name('mon-builder-plugin')
  .version('2.0.0')
  .description('Plugin créé avec le builder')
  .author('Mon nom')
  .depends(['autre-plugin'])
  .config({ option1: true, option2: 'valeur' })
  .route('GET', '/builder', (req, res) => {
    res.json({ builder: true });
  })
  .middleware((req, res, next) => {
    req.builder = true;
    next();
  })
  .hook('app:start', () => {
    console.log('Hook du builder !');
  })
  .command('builder:test', () => {
    console.log('Commande du builder !');
  }, 'Test du builder')
  .load(async (app, config, context) => {
    context.log('success', 'Plugin builder chargé !');
  })
  .build();

await pluginManager.loadPlugin(plugin);
```

### Génération depuis templates

```javascript
// Générer un plugin depuis un template
await pluginManager.generatePlugin('nouveau-plugin', 'basic', {
  author: 'Mon nom',
  description: 'Plugin généré automatiquement'
});

// Templates disponibles
await pluginManager.generatePlugin('api-plugin', 'api');
await pluginManager.generatePlugin('middleware-plugin', 'middleware');
await pluginManager.generatePlugin('ws-plugin', 'websocket');
await pluginManager.generatePlugin('db-plugin', 'database');
await pluginManager.generatePlugin('auth-plugin', 'auth');
```

### Debug et profiling

```javascript
// Interface de debug pour un plugin
const debugInterface = pluginManager.debugPlugin('mon-plugin');
// Crée global.debug_mon_plugin avec :
// - inspect() : Inspecter le plugin
// - config() : Voir la configuration
// - metrics() : Voir les métriques
// - hooks() : Lister les hooks
// - reload() : Recharger le plugin
// - toggle() : Activer/désactiver
// - breakpoint(message) : Point d'arrêt

// Profiler un plugin pendant 60 secondes
const profiler = pluginManager.profilePlugin('mon-plugin', 60000);
// Collecte automatiquement :
// - Nombre d'appels de hooks
// - Temps d'exécution
// - Usage mémoire
// - Erreurs

// Injection de code (dev uniquement)
await pluginManager.injectCode('mon-plugin', `
  console.log('Code injecté !');
`, 'before-load');
```

### Tests automatisés

```javascript
// Tester un plugin
const results = await pluginManager.testPlugin('mon-plugin', {
  // Tests personnalisés
  'custom-test': (plugin) => plugin.config.enabled === true,
  'async-test': async (plugin) => {
    const result = await someAsyncCheck(plugin);
    return result.isValid;
  }
});

console.log(results);
// {
//   passed: 5,
//   failed: 1,
//   errors: [],
//   details: {
//     'load': 'PASS',
//     'active': 'PASS',
//     'config': 'PASS',
//     'version': 'PASS',
//     'custom-test': 'PASS',
//     'async-test': 'FAIL'
//   }
// }
```

## 📝 Templates de Plugins

### Template Basic

```javascript
// Généré avec : generatePlugin('mon-plugin', 'basic')
module.exports = {
  name: 'mon-plugin',
  version: '1.0.0',
  description: 'Description du plugin mon-plugin',
  author: 'Votre nom',
  
  defaultConfig: {
    enabled: true
  },
  
  async load(app, config, context) {
    context.log('info', 'Plugin mon-plugin chargé !');
    // Votre code ici
  },
  
  async unload(app, config) {
    console.log('Plugin mon-plugin déchargé');
  }
};
```

### Template Middleware

```javascript
// Généré avec : generatePlugin('middleware-plugin', 'middleware')
module.exports = {
  name: 'middleware-plugin',
  version: '1.0.0',
  description: 'Plugin middleware middleware-plugin',
  type: 'middleware',
  
  async load(app, config, context) {
    const middleware = (req, res, next) => {
      context.log('info', 'Middleware middleware-plugin exécuté');
      // Votre logique ici
      next();
    };
    
    context.addMiddleware(middleware);
    context.log('success', 'Middleware middleware-plugin ajouté');
  }
};
```

### Template API

```javascript
// Généré avec : generatePlugin('api-plugin', 'api')
module.exports = {
  name: 'api-plugin',
  version: '1.0.0',
  description: 'Plugin API api-plugin',
  type: 'api',
  
  async load(app, config, context) {
    context.addRoute('GET', '/api/api-plugin', (req, res) => {
      res.json({ message: 'Hello from api-plugin API!' });
    });
    
    context.addRoute('POST', '/api/api-plugin', (req, res) => {
      res.json({ received: req.body });
    });
    
    context.log('success', 'API api-plugin configurée');
  }
};
```

## 🔗 Hooks et Événements

### Hooks système disponibles

```javascript
// Hooks d'application
'app:init'          // Initialisation de l'app
'app:start'         // Démarrage de l'app
'app:stop'          // Arrêt de l'app
'app:restart'       // Redémarrage de l'app

// Hooks de routes
'route:load'        // Chargement d'une route
'route:create'      // Création d'une route
'route:delete'      // Suppression d'une route
'route:update'      // Mise à jour d'une route

// Hooks de requêtes
'request:start'     // Début de requête
'request:end'       // Fin de requête
'request:error'     // Erreur de requête

// Hooks de réponses
'response:start'    // Début de réponse
'response:end'      // Fin de réponse
'response:error'    // Erreur de réponse

// Hooks de middleware
'middleware:add'    // Ajout de middleware
'middleware:remove' // Suppression de middleware

// Hooks d'erreurs
'error:handle'      // Gestion d'erreur
'error:critical'    // Erreur critique

// Hooks WebSocket
'websocket:connect'    // Connexion WebSocket
'websocket:disconnect' // Déconnexion WebSocket
'websocket:message'    // Message WebSocket

// Hooks de fichiers
'file:change'       // Modification de fichier
'file:add'          // Ajout de fichier
'file:delete'       // Suppression de fichier

// Hooks de plugins
'plugin:load'       // Chargement de plugin
'plugin:unload'     // Déchargement de plugin
'plugin:error'      // Erreur de plugin
'plugin:timeout'    // Timeout de plugin
'plugin:activate'   // Activation de plugin
'plugin:deactivate' // Désactivation de plugin
'plugin:reload'     // Rechargement de plugin

// Hooks de configuration
'config:change'     // Changement de config
'config:validate'   // Validation de config

// Hooks de base de données
'database:connect'    // Connexion DB
'database:disconnect' // Déconnexion DB
'database:query'      // Requête DB

// Hooks de cache
'cache:set'         // Écriture cache
'cache:get'         // Lecture cache
'cache:delete'      // Suppression cache
'cache:clear'       // Vidage cache

// Hooks d'authentification
'auth:login'        // Connexion utilisateur
'auth:logout'       // Déconnexion utilisateur
'auth:register'     // Inscription utilisateur

// Hooks de développement
'dev:hotreload'     // Hot reload
'dev:debug'         // Debug
'dev:profile'       // Profiling
```

### Utilisation des hooks

```javascript
// Dans un plugin
async load(app, config, context) {
  // Hook simple
  context.hook('request:start', (req) => {
    console.log('Requête:', req.url);
    return req; // Retourner la valeur modifiée
  });
  
  // Hook avec priorité (plus élevé = exécuté en premier)
  context.hook('app:start', () => {
    console.log('Démarrage prioritaire !');
  }, 100);
  
  // Hook asynchrone
  context.hook('database:query', async (query) => {
    const start = Date.now();
    const result = await query;
    const duration = Date.now() - start;
    console.log(`Requête DB: ${duration}ms`);
    return result;
  });
  
  // Supprimer un hook
  const hookFn = () => console.log('Hook à supprimer');
  context.hook('some:hook', hookFn);
  context.removeHook('some:hook', hookFn);
}
```

### Événements du Plugin Manager

```javascript
// Écouter les événements du plugin manager
pluginManager.on('plugin:loaded', (pluginName, plugin) => {
  console.log(`Plugin ${pluginName} chargé !`);
});

pluginManager.on('plugin:error', (pluginName, error) => {
  console.error(`Erreur dans ${pluginName}:`, error);
});

pluginManager.on('plugin:unloaded', (pluginName) => {
  console.log(`Plugin ${pluginName} déchargé`);
});

pluginManager.on('log', ({ type, message, details, timestamp }) => {
  // Tous les logs des plugins passent par ici
});

pluginManager.on('dev:hotreload', (pluginName, filePath) => {
  console.log(`Hot reload: ${pluginName} (${filePath})`);
});
```

## 🔄 Gestion des Dépendances

### Dépendances entre plugins

```javascript
// Plugin qui dépend d'autres plugins
module.exports = {
  name: 'plugin-dependant',
  dependencies: ['plugin-base', 'plugin-utils'],
  
  async load(app, config, context) {
    // Les plugins 'plugin-base' et 'plugin-utils' sont garantis être chargés
    const basePlugin = context.getPlugin('plugin-base');
    const utils = context.getPlugin('plugin-utils');
    
    // Utiliser les fonctionnalités des plugins dépendants
    basePlugin.module.someFunction();
  }
};
```

### Peer Dependencies (packages npm)

```javascript
module.exports = {
  name: 'plugin-avec-peers',
  peerDependencies: ['express', 'lodash', 'axios'],
  
  async load(app, config, context) {
    // Ces packages sont requis mais pas automatiquement installés
    const _ = require('lodash');
    const axios = require('axios');
    
    // Le plugin manager avertit si ces packages manquent
  }
};
```

### Compatibilité des versions

```javascript
module.exports = {
  name: 'plugin-strict',
  engines: {
    node: '>=14.0.0',
    veko: '^2.0.0'
  },
  
  async load(app, config, context) {
    // Le plugin manager vérifie la compatibilité automatiquement
  }
};
```

### Ordre de chargement automatique

```javascript
// Le plugin manager trie automatiquement par dépendances
// plugins/
//   ├── plugin-a.js    (dependencies: ['plugin-c'])
//   ├── plugin-b.js    (dependencies: ['plugin-a', 'plugin-c'])
//   └── plugin-c.js    (no dependencies)
//
// Ordre de chargement automatique : plugin-c → plugin-a → plugin-b
```

## 📊 Métriques et Monitoring

### Métriques automatiques

```javascript
// Métriques collectées automatiquement
const metrics = pluginManager.metrics.get('mon-plugin');
console.log(metrics);
// {
//   uptime: 300000,           // Temps depuis le chargement (ms)
//   memoryUsage: {...},       // Usage mémoire
//   errorCount: 0,            // Nombre d'erreurs
//   lastCheck: 1234567890,    // Dernière vérification
//   health: 'healthy'         // État de santé
// }
```

### Monitoring personnalisé

```javascript
// Dans un plugin
async load(app, config, context) {
  // Compter les appels d'API
  let apiCalls = 0;
  
  context.addRoute('GET', '/api/count', (req, res) => {
    apiCalls++;
    context.storage.set('apiCalls', apiCalls);
    res.json({ calls: apiCalls });
  });
  
  // Métrique personnalisée
  setInterval(() => {
    const memUsage = process.memoryUsage();
    context.storage.set('lastMemoryCheck', {
      timestamp: Date.now(),
      memory: memUsage
    });
  }, 60000);
}
```

### Alertes et seuils

```javascript
// Surveiller la santé des plugins
pluginManager.on('plugin:error', (pluginName, error) => {
  const errorCount = pluginManager.errorCount.get(pluginName) || 0;
  
  if (errorCount > 5) {
    console.warn(`⚠️  Plugin ${pluginName} a ${errorCount} erreurs !`);
    
    // Désactiver automatiquement si trop d'erreurs
    if (errorCount > 10) {
      pluginManager.togglePlugin(pluginName, false);
      console.error(`❌ Plugin ${pluginName} désactivé automatiquement`);
    }
  }
});

// Surveiller les métriques
setInterval(() => {
  const stats = pluginManager.getStats();
  
  if (stats.errors > 20) {
    console.warn('⚠️  Beaucoup d\'erreurs détectées dans les plugins !');
  }
  
  if (stats.loading > 0) {
    console.info(`🔄 ${stats.loading} plugins en cours de chargement...`);
  }
}, 30000);
```

## 💡 Exemples Pratiques

### Plugin d'authentification

```javascript
// plugins/auth.js
module.exports = {
  name: 'auth',
  version: '1.0.0',
  description: 'Plugin d\'authentification JWT',
  
  defaultConfig: {
    secret: 'default-secret',
    expiresIn: '1h',
    refreshToken: true
  },
  
  async load(app, config, context) {
    const jwt = require('jsonwebtoken');
    
    // Middleware d'authentification
    const authMiddleware = (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
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
    context.addRoute('POST', '/auth/login', async (req, res) => {
      const { username, password } = req.body;
      
      // Validation utilisateur (à adapter)
      if (username === 'admin' && password === 'password') {
        const token = jwt.sign({ username }, config.secret, {
          expiresIn: config.expiresIn
        });
        
        res.json({ token, user: { username } });
      } else {
        res.status(401).json({ error: 'Identifiants invalides' });
      }
    });
    
    context.addRoute('POST', '/auth/verify', authMiddleware, (req, res) => {
      res.json({ valid: true, user: req.user });
    });
    
    // Hook pour protéger automatiquement certaines routes
    context.hook('route:create', (method, path, handler) => {
      if (path.startsWith('/api/protected/')) {
        return [method, path, authMiddleware, handler];
      }
      return [method, path, handler];
    });
    
    // Exposer le middleware pour d'autres plugins
    context.storage.set('authMiddleware', authMiddleware);
    
    context.log('success', 'Plugin d\'authentification configuré');
  }
};
```

### Plugin de cache Redis

```javascript
// plugins/redis-cache.js
module.exports = {
  name: 'redis-cache',
  version: '1.0.0',
  description: 'Plugin de cache Redis',
  
  peerDependencies: ['redis'],
  
  defaultConfig: {
    host: 'localhost',
    port: 6379,
    db: 0,
    ttl: 3600
  },
  
  async load(app, config, context) {
    const redis = require('redis');
    
    // Connexion Redis
    const client = redis.createClient({
      host: config.host,
      port: config.port,
      db: config.db
    });
    
    await client.connect();
    context.log('success', 'Connexion Redis établie');
    
    // API de cache
    const cache = {
      async get(key) {
        const value = await client.get(key);
        return value ? JSON.parse(value) : null;
      },
      
      async set(key, value, ttl = config.ttl) {
        await client.setEx(key, ttl, JSON.stringify(value));
      },
      
      async del(key) {
        await client.del(key);
      },
      
      async clear() {
        await client.flushDb();
      }
    };
    
    // Middleware de cache automatique
    const cacheMiddleware = (ttl = config.ttl) => {
      return async (req, res, next) => {
        if (req.method !== 'GET') return next();
        
        const cacheKey = `cache:${req.originalUrl}`;
        const cached = await cache.get(cacheKey);
        
        if (cached) {
          return res.json(cached);
        }
        
        // Intercepter la réponse
        const originalJson = res.json;
        res.json = function(data) {
          cache.set(cacheKey, data, ttl);
          originalJson.call(this, data);
        };
        
        next();
      };
    };
    
    // Routes de gestion du cache
    context.addRoute('GET', '/cache/stats', async (req, res) => {
      const info = await client.info('memory');
      res.json({ redis: info });
    });
    
    context.addRoute('DELETE', '/cache/clear', async (req, res) => {
      await cache.clear();
      res.json({ message: 'Cache vidé' });
    });
    
    // Hooks de cache
    context.hook('cache:get', cache.get);
    context.hook('cache:set', cache.set);
    context.hook('cache:delete', cache.del);
    context.hook('cache:clear', cache.clear);
    
    // Exposer l'API pour d'autres plugins
    context.storage.set('cacheAPI', cache);
    context.storage.set('cacheMiddleware', cacheMiddleware);
    
    // Nettoyage à la décharge
    context.storage.set('redisClient', client);
  },
  
  async unload(app, config) {
    const client = context.storage.get('redisClient');
    if (client) {
      await client.quit();
    }
  }
};
```

### Plugin de logging avancé

```javascript
// plugins/logger.js
module.exports = {
  name: 'logger',
  version: '1.0.0',
  description: 'Plugin de logging avancé',
  
  defaultConfig: {
    level: 'info',
    file: 'app.log',
    maxSize: '10m',
    maxFiles: 5,
    format: 'json'
  },
  
  async load(app, config, context) {
    const winston = require('winston');
    
    // Configuration Winston
    const logger = winston.createLogger({
      level: config.level,
      format: config.format === 'json' 
        ? winston.format.json()
        : winston.format.simple(),
      transports: [
        new winston.transports.File({
          filename: config.file,
          maxsize: config.maxSize,
          maxFiles: config.maxFiles
        }),
        new winston.transports.Console({
          format: winston.format.colorize()
        })
      ]
    });
    
    // Hook sur toutes les requêtes
    context.hook('request:start', (req) => {
      logger.info('Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      return req;
    });
    
    // Hook sur les erreurs
    context.hook('error:handle', (error, req) => {
      logger.error('Error', {
        message: error.message,
        stack: error.stack,
        url: req?.url,
        method: req?.method,
        timestamp: new Date().toISOString()
      });
      return error;
    });
    
    // API de logging pour d'autres plugins
    context.addRoute('GET', '/logs', (req, res) => {
      // Lire les derniers logs (simplification)
      res.json({ message: 'Logs endpoint' });
    });
    
    // Exposer le logger
    context.storage.set('logger', logger);
    
    context.log('success', 'Logger configuré');
  }
};
```

## 🚨 Dépannage

### Problèmes courants

#### Plugin ne se charge pas

```javascript
// Vérifier les erreurs
pluginManager.on('plugin:error', (pluginName, error) => {
  console.error(`Erreur ${pluginName}:`, error.message);
  console.error('Stack:', error.stack);
});

// Vérifier les dépendances manquantes
const plugin = pluginManager.getPlugin('mon-plugin');
if (!plugin) {
  console.log('Plugin non trouvé, vérifier :');
  console.log('1. Le nom du plugin');
  console.log('2. Le chemin du fichier');
  console.log('3. La syntaxe du module.exports');
  console.log('4. Les dépendances');
}
```

#### Dépendances circulaires

```javascript
// Éviter les dépendances circulaires
// ❌ MAUVAIS
// plugin-a.js: dependencies: ['plugin-b']
// plugin-b.js: dependencies: ['plugin-a']

// ✅ BON
// plugin-base.js: (pas de dépendances)
// plugin-a.js: dependencies: ['plugin-base']
// plugin-b.js: dependencies: ['plugin-base']
```

#### Plugin en timeout

```javascript
// Augmenter le timeout si nécessaire
const pluginManager = new PluginManager(app, {
  timeout: 60000 // 60 secondes au lieu de 30
});

// Optimiser le chargement du plugin
module.exports = {
  async load(app, config, context) {
    // ❌ Éviter les opérations longues dans load()
    // await longAsyncOperation();
    
    // ✅ Différer les opérations longues
    setTimeout(async () => {
      await longAsyncOperation();
    }, 0);
    
    context.log('success', 'Plugin chargé rapidement');
  }
};
```

#### Problèmes de hot reload

```javascript
// Activer le mode debug pour hot reload
const pluginManager = new PluginManager(app, {
  devMode: true,
  watchMode: true,
  allowHotReload: true
});

// Exclure des fichiers du watch
const chokidar = require('chokidar');
pluginManager.watchers.get('files').unwatch([
  'node_modules/**',
  'logs/**',
  'tmp/**'
]);
```

### Debug avancé

```javascript
// Activer tous les logs en mode debug
const pluginManager = new PluginManager(app, {
  devMode: true,
  enableMetrics: true,
  enableValidation: true
});

// Listener global pour debug
pluginManager.on('log', ({ type, message, details }) => {
  if (type === 'debug') {
    console.log(`🐛 DEBUG: ${message}`, details);
  }
});

// Interface de debug globale
global.debugPluginManager = {
  stats: () => pluginManager.getStats(),
  plugins: () => pluginManager.listPlugins(),
  hooks: () => Array.from(pluginManager.hooks.keys()),
  reload: (name) => pluginManager.reloadPlugin(name),
  test: (name) => pluginManager.testPlugin(name)
};
```

### Validation manuelle

```javascript
// Valider un plugin avant chargement
async function validatePlugin(pluginPath) {
  try {
    const plugin = require(pluginPath);
    
    // Vérifications de base
    if (!plugin.name) throw new Error('Nom manquant');
    if (!plugin.load) throw new Error('Méthode load() manquante');
    if (plugin.dependencies && !Array.isArray(plugin.dependencies)) {
      throw new Error('dependencies doit être un tableau');
    }
    
    console.log('✅ Plugin valide');
    return true;
  } catch (error) {
    console.error('❌ Plugin invalide:', error.message);
    return false;
  }
}

// Utilisation
await validatePlugin('./plugins/mon-plugin.js');
```

---

## 🎉 Conclusion

Le système de plugins de Veko.js offre une solution complète et flexible pour étendre votre application. Avec son support TypeScript, ses outils de développement avancés, et sa gestion robuste des dépendances, vous pouvez créer des applications modulaires et maintenables.

### Ressources utiles

- [Examples de plugins](./examples/plugins/)
- [Templates avancés](./templates/)
- [Guide de contribution](./CONTRIBUTING.md)
- [API Reference](./api-reference.md)

### Support

- 📧 Email : support@veko.js
- 💬 Discord : [Serveur Veko.js](https://discord.gg/veko)
- 🐛 Issues : [GitHub Issues](https://github.com/veko-js/veko/issues)
- 📖 Wiki : [GitHub Wiki](https://github.com/veko-js/veko/wiki)