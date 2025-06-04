const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
  white: '\x1b[37m'
};

class PluginManager extends EventEmitter {
  constructor(app, options = {}) {
    super();
    
    this.app = app;
    this.options = {
      pluginsDir: 'plugins',
      autoLoad: true,
      enableHooks: true,
      enableAPI: true,
      maxRetries: 3,
      timeout: 30000,
      supportTypeScript: true,
      devMode: process.env.NODE_ENV === 'development',
      watchMode: false,
      enableMetrics: true,
      enableValidation: true,
      allowHotReload: true,
      enableSandbox: false,
      ...options
    };
    
    this.plugins = new Map();
    this.hooks = new Map();
    this.middleware = [];
    this.routes = [];
    this.commands = new Map();
    this.loadOrder = [];
    this.loadingQueue = new Set();
    this.errorCount = new Map();
    this.metrics = new Map();
    this.watchers = new Map();
    this.schemas = new Map();
    this.devTools = new Map();
    
    // Support TypeScript
    this.tsSupport = this.initTypeScriptSupport();
    
    this.init();
  }

  // ============= SUPPORT TYPESCRIPT =============
  
  initTypeScriptSupport() {
    if (!this.options.supportTypeScript) return null;
    
    try {
      // Essayer de charger ts-node pour l'exécution directe de TS
      const tsNode = require('ts-node');
      tsNode.register({
        transpileOnly: true,
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true
        }
      });
      
      this.log('info', 'Support TypeScript activé', '🔷 ts-node configuré');
      return { enabled: true, runtime: 'ts-node' };
    } catch (error) {
      // Fallback: support de la compilation à la volée
      this.log('warning', 'ts-node non trouvé', 'compilation à la volée activée');
      return { enabled: true, runtime: 'compile' };
    }
  }

  async loadTypeScriptPlugin(pluginPath) {
    if (!this.tsSupport?.enabled) {
      throw new Error('Support TypeScript non activé');
    }

    if (this.tsSupport.runtime === 'ts-node') {
      // Chargement direct avec ts-node
      return require(pluginPath);
    } else {
      // Compilation à la volée
      const typescript = require('typescript');
      const tsContent = fs.readFileSync(pluginPath, 'utf8');
      
      const result = typescript.transpile(tsContent, {
        module: typescript.ModuleKind.CommonJS,
        target: typescript.ScriptTarget.ES2020,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      });
      
      // Écrire le fichier JS temporaire
      const jsPath = pluginPath.replace('.ts', '.js');
      fs.writeFileSync(jsPath, result);
      
      try {
        const plugin = require(jsPath);
        fs.unlinkSync(jsPath); // Nettoyer le fichier temporaire
        return plugin;
      } catch (error) {
        if (fs.existsSync(jsPath)) fs.unlinkSync(jsPath);
        throw error;
      }
    }
  }

  // ============= INITIALISATION AVANCÉE =============
  
  init() {
    this.setupHooks();
    this.setupDevTools();
    this.setupMetrics();
    this.setupWatcher();
    
    if (this.options.autoLoad) {
      this.loadAllPlugins().catch(error => {
        this.log('error', 'Erreur lors du chargement automatique', error.message);
      });
    }
  }

  setupHooks() {
    const defaultHooks = [
      'app:init', 'app:start', 'app:stop', 'app:restart',
      'route:load', 'route:create', 'route:delete', 'route:update',
      'request:start', 'request:end', 'request:error',
      'response:start', 'response:end', 'response:error',
      'middleware:add', 'middleware:remove',
      'error:handle', 'error:critical',
      'websocket:connect', 'websocket:disconnect', 'websocket:message',
      'file:change', 'file:add', 'file:delete',
      'plugin:load', 'plugin:unload', 'plugin:error', 'plugin:timeout',
      'plugin:activate', 'plugin:deactivate', 'plugin:reload',
      'config:change', 'config:validate',
      'database:connect', 'database:disconnect', 'database:query',
      'cache:set', 'cache:get', 'cache:delete', 'cache:clear',
      'auth:login', 'auth:logout', 'auth:register',
      'dev:hotreload', 'dev:debug', 'dev:profile'
    ];

    defaultHooks.forEach(hookName => {
      this.hooks.set(hookName, []);
    });
  }

  setupDevTools() {
    if (!this.options.devMode) return;
    
    this.devTools.set('profiler', {
      start: (name) => {
        const start = process.hrtime.bigint();
        return {
          end: () => {
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1000000; // ms
            this.log('debug', `Profil: ${name}`, `${duration.toFixed(2)}ms`);
            return duration;
          }
        };
      }
    });

    this.devTools.set('debugger', {
      breakpoint: (message, data = {}) => {
        if (this.options.devMode) {
          console.log(`🔴 BREAKPOINT: ${message}`, data);
          debugger; // eslint-disable-line no-debugger
        }
      },
      inspect: (obj, label = 'Object') => {
        console.log(`🔍 ${label}:`, require('util').inspect(obj, { colors: true, depth: 3 }));
      }
    });

    this.devTools.set('hotreload', {
      enable: () => this.enableHotReload(),
      disable: () => this.disableHotReload(),
      trigger: (pluginName) => this.triggerHotReload(pluginName)
    });
  }

  setupMetrics() {
    if (!this.options.enableMetrics) return;
    
    setInterval(() => {
      this.collectMetrics();
    }, 30000); // Collecte toutes les 30 secondes
  }

  setupWatcher() {
    if (!this.options.watchMode && !this.options.allowHotReload) return;
    
    const chokidar = require('chokidar');
    const pluginsPath = path.join(process.cwd(), this.options.pluginsDir);
    
    const watcher = chokidar.watch([
      `${pluginsPath}/**/*.js`,
      `${pluginsPath}/**/*.ts`,
      `${pluginsPath}/**/package.json`
    ], {
      ignored: /node_modules/,
      persistent: true
    });

    watcher.on('change', async (filePath) => {
      const pluginName = this.getPluginNameFromFile(filePath);
      if (pluginName && this.plugins.has(pluginName)) {
        this.log('info', 'Fichier modifié détecté', `${pluginName} → rechargement`);
        try {
          await this.reloadPlugin(pluginName);
          this.emit('dev:hotreload', pluginName, filePath);
        } catch (error) {
          this.log('error', 'Erreur hot reload', error.message);
        }
      }
    });

    this.watchers.set('files', watcher);
  }

  // ============= CHARGEMENT AVANCÉ DES PLUGINS =============
  
  async loadPlugin(plugin, config = {}) {
    let pluginName;
    
    try {
      let pluginModule;

      if (typeof plugin === 'string') {
        pluginName = plugin;
        
        if (this.loadingQueue.has(pluginName)) {
          throw new Error(`Plugin "${pluginName}" déjà en cours de chargement`);
        }
        
        this.loadingQueue.add(pluginName);
        pluginModule = await this.resolvePlugin(plugin);
      } else {
        pluginModule = plugin;
        pluginName = plugin.name || 'anonymous';
        this.loadingQueue.add(pluginName);
      }

      if (this.plugins.has(pluginName)) {
        this.log('warning', 'Plugin déjà chargé', pluginName);
        this.loadingQueue.delete(pluginName);
        return this;
      }

      // Validation avancée
      await this.validatePluginAdvanced(pluginModule, pluginName);

      const pluginInstance = {
        name: pluginName,
        version: pluginModule.version || '1.0.0',
        description: pluginModule.description || '',
        author: pluginModule.author || '',
        dependencies: pluginModule.dependencies || [],
        peerDependencies: pluginModule.peerDependencies || [],
        config: { ...pluginModule.defaultConfig, ...config },
        module: pluginModule,
        loaded: false,
        active: false,
        loadTime: Date.now(),
        errorCount: 0,
        metrics: {
          loadTime: 0,
          executeCount: 0,
          errorCount: 0,
          lastError: null,
          performance: {}
        },
        type: this.detectPluginType(pluginModule),
        priority: pluginModule.priority || 10,
        sandbox: this.options.enableSandbox ? this.createSandbox(pluginName) : null
      };

      await this.checkDependenciesAdvanced(pluginInstance);
      await this.executePluginLoadWithTimeout(pluginInstance);

      this.plugins.set(pluginName, pluginInstance);
      this.loadOrder.push(pluginName);
      this.loadingQueue.delete(pluginName);

      this.log('success', 'Plugin chargé', `${pluginName} v${pluginInstance.version}`);
      this.emit('plugin:loaded', pluginName, pluginInstance);
      await this.executeHook('plugin:load', pluginName, pluginInstance);
      
      return this;
    } catch (error) {
      if (pluginName) {
        this.loadingQueue.delete(pluginName);
        this.errorCount.set(pluginName, (this.errorCount.get(pluginName) || 0) + 1);
      }
      this.log('error', 'Erreur lors du chargement du plugin', error.message);
      this.emit('plugin:error', pluginName, error);
      throw error;
    }
  }

  async resolvePlugin(pluginName) {
    const pluginsPath = path.join(process.cwd(), this.options.pluginsDir);
    
    // Essayer différentes extensions et structures
    const possiblePaths = [
      path.join(pluginsPath, `${pluginName}.js`),
      path.join(pluginsPath, `${pluginName}.ts`),
      path.join(pluginsPath, pluginName, 'index.js'),
      path.join(pluginsPath, pluginName, 'index.ts'),
      path.join(pluginsPath, pluginName, 'main.js'),
      path.join(pluginsPath, pluginName, 'main.ts'),
      path.join(pluginsPath, pluginName, 'plugin.js'),
      path.join(pluginsPath, pluginName, 'plugin.ts')
    ];

    for (const pluginPath of possiblePaths) {
      if (fs.existsSync(pluginPath)) {
        if (pluginPath.endsWith('.ts')) {
          return await this.loadTypeScriptPlugin(pluginPath);
        } else {
          return require(pluginPath);
        }
      }
    }

    // Essayer depuis node_modules
    try {
      return require(pluginName);
    } catch (e) {
      throw new Error(`Plugin "${pluginName}" introuvable`);
    }
  }

  detectPluginType(pluginModule) {
    if (pluginModule.type) return pluginModule.type;
    
    // Détecter automatiquement le type
    if (pluginModule.middleware) return 'middleware';
    if (pluginModule.routes) return 'router';
    if (pluginModule.commands) return 'cli';
    if (pluginModule.websocket) return 'websocket';
    if (pluginModule.database) return 'database';
    if (pluginModule.auth) return 'auth';
    if (pluginModule.theme) return 'theme';
    
    return 'generic';
  }

  async validatePluginAdvanced(pluginModule, pluginName) {
    if (!this.options.enableValidation) return;
    
    // Validation de base
    if (!pluginModule || typeof pluginModule !== 'object') {
      throw new Error(`Plugin "${pluginName}" doit exporter un objet`);
    }

    if (!pluginModule.load || typeof pluginModule.load !== 'function') {
      throw new Error(`Plugin "${pluginName}" doit avoir une méthode load()`);
    }

    // Validation des métadonnées
    const requiredFields = ['name', 'version'];
    const optionalFields = ['description', 'author', 'license', 'homepage', 'repository'];
    
    for (const field of requiredFields) {
      if (!pluginModule[field]) {
        this.log('warning', `Plugin ${pluginName}`, `Champ requis manquant: ${field}`);
      }
    }

    // Validation sémantique de version
    if (pluginModule.version && !this.isValidVersion(pluginModule.version)) {
      throw new Error(`Plugin "${pluginName}": version invalide "${pluginModule.version}"`);
    }

    // Validation des dépendances
    if (pluginModule.dependencies && !Array.isArray(pluginModule.dependencies)) {
      throw new Error(`Plugin "${pluginName}": dependencies doit être un tableau`);
    }

    // Validation du schéma de configuration
    if (pluginModule.configSchema) {
      this.schemas.set(pluginName, pluginModule.configSchema);
    }

    // Validation des hooks déclarés
    if (pluginModule.hooks && Array.isArray(pluginModule.hooks)) {
      for (const hookName of pluginModule.hooks) {
        if (!this.hooks.has(hookName)) {
          this.log('warning', `Plugin ${pluginName}`, `Hook inconnu: ${hookName}`);
        }
      }
    }

    // Validation des permissions
    if (pluginModule.permissions && Array.isArray(pluginModule.permissions)) {
      await this.validatePermissions(pluginName, pluginModule.permissions);
    }
  }

  async checkDependenciesAdvanced(plugin) {
    // Vérifier les dépendances normales
    if (plugin.dependencies && plugin.dependencies.length > 0) {
      const missing = [];
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          missing.push(dep);
        }
      }
      
      if (missing.length > 0) {
        throw new Error(`Plugin "${plugin.name}" nécessite: ${missing.join(', ')}`);
      }
    }

    // Vérifier les peer dependencies
    if (plugin.peerDependencies && plugin.peerDependencies.length > 0) {
      const missingPeers = [];
      for (const peerDep of plugin.peerDependencies) {
        try {
          require.resolve(peerDep);
        } catch (error) {
          missingPeers.push(peerDep);
        }
      }
      
      if (missingPeers.length > 0) {
        this.log('warning', `Plugin ${plugin.name}`, `Peer dependencies manquantes: ${missingPeers.join(', ')}`);
      }
    }

    // Vérifier les versions compatibles
    if (plugin.module.engines) {
      await this.checkEngineCompatibility(plugin.name, plugin.module.engines);
    }
  }

  // ============= FONCTIONS UTILITAIRES POUR DÉVELOPPEURS =============
  
  /**
   * Crée un plugin de développement rapide
   */
  createDevPlugin(name, options = {}) {
    const plugin = {
      name,
      version: '1.0.0-dev',
      description: `Plugin de développement: ${name}`,
      author: 'Développeur',
      type: 'dev',
      load: async (app, config, context) => {
        context.log('info', `Plugin de dev ${name} chargé`);
        
        // Auto-setup des fonctionnalités courantes
        if (options.routes) {
          Object.entries(options.routes).forEach(([path, handler]) => {
            context.addRoute('GET', path, handler);
          });
        }
        
        if (options.middleware) {
          options.middleware.forEach(mw => context.addMiddleware(mw));
        }
        
        if (options.hooks) {
          Object.entries(options.hooks).forEach(([hookName, callback]) => {
            context.hook(hookName, callback);
          });
        }
        
        if (options.commands) {
          Object.entries(options.commands).forEach(([cmdName, cmd]) => {
            context.addCommand(cmdName, cmd.handler, cmd.description);
          });
        }
        
        // Exécuter le code personnalisé
        if (options.load && typeof options.load === 'function') {
          await options.load(app, config, context);
        }
      },
      unload: options.unload,
      ...options
    };

    return plugin;
  }

  /**
   * Plugin factory avec builder pattern
   */
  createPluginBuilder() {
    return new PluginBuilder();
  }

  /**
   * Injecte du code dans un plugin existant (dev uniquement)
   */
  async injectCode(pluginName, code, type = 'before-load') {
    if (!this.options.devMode) {
      throw new Error('Injection de code disponible uniquement en mode développement');
    }

    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} non trouvé`);
    }

    if (!plugin.injections) plugin.injections = [];
    
    plugin.injections.push({
      code,
      type,
      timestamp: Date.now(),
      active: true
    });

    this.log('debug', `Code injecté dans ${pluginName}`, `Type: ${type}`);
    this.emit('dev:inject', pluginName, code, type);
  }

  /**
   * Monitore les performances d'un plugin
   */
  profilePlugin(pluginName, duration = 60000) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return null;

    const profiler = {
      start: Date.now(),
      end: Date.now() + duration,
      data: {
        hookCalls: 0,
        executionTime: 0,
        memoryUsage: process.memoryUsage(),
        errors: 0
      }
    };

    // Wrapper les méthodes du plugin pour collecter les métriques
    this.wrapPluginMethods(plugin, profiler);

    setTimeout(() => {
      this.log('info', `Profil de ${pluginName}`, JSON.stringify(profiler.data, null, 2));
      this.emit('dev:profile', pluginName, profiler.data);
    }, duration);

    return profiler;
  }

  /**
   * Débogueur interactif pour plugin
   */
  debugPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return null;

    const debugInterface = {
      inspect: () => this.devTools.get('debugger').inspect(plugin, `Plugin ${pluginName}`),
      config: () => console.log('Configuration:', plugin.config),
      metrics: () => console.log('Métriques:', plugin.metrics),
      hooks: () => this.listPluginHooks(pluginName),
      reload: () => this.reloadPlugin(pluginName),
      toggle: () => this.togglePlugin(pluginName),
      breakpoint: (message) => this.devTools.get('debugger').breakpoint(`${pluginName}: ${message}`, plugin)
    };

    global[`debug_${pluginName}`] = debugInterface;
    this.log('debug', `Interface de debug créée`, `Utilisez global.debug_${pluginName}`);

    return debugInterface;
  }

  /**
   * Teste un plugin avec différents scénarios
   */
  async testPlugin(pluginName, tests = {}) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) throw new Error(`Plugin ${pluginName} non trouvé`);

    const results = {
      passed: 0,
      failed: 0,
      errors: [],
      details: {}
    };

    // Tests par défaut
    const defaultTests = {
      'load': () => plugin.loaded === true,
      'active': () => plugin.active === true,
      'config': () => plugin.config !== null,
      'version': () => plugin.version && this.isValidVersion(plugin.version)
    };

    const allTests = { ...defaultTests, ...tests };

    for (const [testName, testFn] of Object.entries(allTests)) {
      try {
        const result = await testFn(plugin);
        if (result) {
          results.passed++;
          results.details[testName] = 'PASS';
        } else {
          results.failed++;
          results.details[testName] = 'FAIL';
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ test: testName, error: error.message });
        results.details[testName] = `ERROR: ${error.message}`;
      }
    }

    this.log('info', `Tests pour ${pluginName}`, `${results.passed} réussis, ${results.failed} échoués`);
    return results;
  }

  /**
   * Générateur de plugin depuis template
   */
  async generatePlugin(name, template = 'basic', options = {}) {
    const templates = {
      basic: this.getBasicTemplate(),
      middleware: this.getMiddlewareTemplate(),
      api: this.getApiTemplate(),
      websocket: this.getWebSocketTemplate(),
      database: this.getDatabaseTemplate(),
      auth: this.getAuthTemplate()
    };

    const pluginTemplate = templates[template];
    if (!pluginTemplate) {
      throw new Error(`Template ${template} non trouvé`);
    }

    const pluginCode = this.renderTemplate(pluginTemplate, { name, ...options });
    const pluginPath = path.join(process.cwd(), this.options.pluginsDir, `${name}.js`);

    fs.writeFileSync(pluginPath, pluginCode);
    this.log('success', 'Plugin généré', `${name} → ${pluginPath}`);

    return pluginPath;
  }

  /**
   * Backup et restore des plugins
   */
  async backupPlugins(backupPath = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = path.join(process.cwd(), 'backups', `plugins-${timestamp}.json`);
    const outputPath = backupPath || defaultPath;

    const backup = {
      timestamp: Date.now(),
      plugins: Array.from(this.plugins.entries()).map(([name, plugin]) => ({
        name,
        version: plugin.version,
        config: plugin.config,
        active: plugin.active,
        loadOrder: this.loadOrder.indexOf(name)
      })),
      loadOrder: this.loadOrder,
      options: this.options
    };

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2));
    this.log('success', 'Plugins sauvegardés', outputPath);

    return outputPath;
  }

  async restorePlugins(backupPath) {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Fichier de sauvegarde non trouvé: ${backupPath}`);
    }

    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    // Décharger tous les plugins actuels
    for (const pluginName of Array.from(this.plugins.keys())) {
      await this.unloadPlugin(pluginName);
    }

    // Charger les plugins dans l'ordre de la sauvegarde
    const sortedPlugins = backup.plugins.sort((a, b) => a.loadOrder - b.loadOrder);
    
    for (const pluginData of sortedPlugins) {
      try {
        await this.loadPlugin(pluginData.name, pluginData.config);
        if (!pluginData.active) {
          await this.togglePlugin(pluginData.name, false);
        }
      } catch (error) {
        this.log('error', `Erreur restauration ${pluginData.name}`, error.message);
      }
    }

    this.log('success', 'Plugins restaurés', `${sortedPlugins.length} plugins`);
  }

  // ============= TEMPLATES DE PLUGINS =============
  
  getBasicTemplate() {
    return `
/**
 * Plugin {{name}}
 * Généré automatiquement par Veko.js PluginManager
 */

module.exports = {
  name: '{{name}}',
  version: '1.0.0',
  description: 'Description du plugin {{name}}',
  author: 'Votre nom',
  
  // Configuration par défaut
  defaultConfig: {
    enabled: true
  },
  
  // Méthode de chargement (obligatoire)
  async load(app, config, context) {
    context.log('info', 'Plugin {{name}} chargé !');
    
    // Votre code ici
  },
  
  // Méthode de déchargement (optionnelle)
  async unload(app, config) {
    console.log('Plugin {{name}} déchargé');
  },
  
  // Activation/désactivation (optionnelles)
  async activate(app, config) {
    console.log('Plugin {{name}} activé');
  },
  
  async deactivate(app, config) {
    console.log('Plugin {{name}} désactivé');
  }
};
`;
  }

  getMiddlewareTemplate() {
    return `
module.exports = {
  name: '{{name}}',
  version: '1.0.0',
  description: 'Plugin middleware {{name}}',
  type: 'middleware',
  
  async load(app, config, context) {
    // Middleware personnalisé
    const middleware = (req, res, next) => {
      context.log('info', 'Middleware {{name}} exécuté');
      // Votre logique ici
      next();
    };
    
    context.addMiddleware(middleware);
    context.log('success', 'Middleware {{name}} ajouté');
  }
};
`;
  }

  getApiTemplate() {
    return `
module.exports = {
  name: '{{name}}',
  version: '1.0.0',
  description: 'Plugin API {{name}}',
  type: 'api',
  
  async load(app, config, context) {
    // Routes API
    context.addRoute('GET', '/api/{{name}}', (req, res) => {
      res.json({ message: 'Hello from {{name}} API!' });
    });
    
    context.addRoute('POST', '/api/{{name}}', (req, res) => {
      res.json({ received: req.body });
    });
    
    context.log('success', 'API {{name}} configurée');
  }
};
`;
  }

  renderTemplate(template, variables) {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return rendered;
  }

  // ============= FONCTIONS UTILITAIRES =============
  
  isValidVersion(version) {
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/.test(version);
  }

  getPluginNameFromFile(filePath) {
    const pluginsPath = path.join(process.cwd(), this.options.pluginsDir);
    const relativePath = path.relative(pluginsPath, filePath);
    const parts = relativePath.split(path.sep);
    
    if (parts[0].endsWith('.js') || parts[0].endsWith('.ts')) {
      return path.parse(parts[0]).name;
    } else {
      return parts[0];
    }
  }

  listPluginHooks(pluginName) {
    const hooks = [];
    this.hooks.forEach((hookList, hookName) => {
      const pluginHooks = hookList.filter(h => h.plugin === pluginName);
      if (pluginHooks.length > 0) {
        hooks.push({ hook: hookName, count: pluginHooks.length });
      }
    });
    return hooks;
  }

  wrapPluginMethods(plugin, profiler) {
    // Wrapper pour mesurer les performances
    const originalLoad = plugin.module.load;
    plugin.module.load = async (...args) => {
      const start = process.hrtime.bigint();
      try {
        const result = await originalLoad.call(plugin.module, ...args);
        profiler.data.executionTime += Number(process.hrtime.bigint() - start) / 1000000;
        return result;
      } catch (error) {
        profiler.data.errors++;
        throw error;
      }
    };
  }

  collectMetrics() {
    for (const [name, plugin] of this.plugins.entries()) {
      const memUsage = process.memoryUsage();
      const errorCount = this.errorCount.get(name) || 0;
      
      this.metrics.set(name, {
        uptime: Date.now() - plugin.loadTime,
        memoryUsage: memUsage,
        errorCount,
        lastCheck: Date.now(),
        health: errorCount === 0 ? 'healthy' : errorCount < 5 ? 'warning' : 'critical'
      });
    }
  }

  // ============= INITIALISATION =============
  init() {
    this.setupHooks();
    
    if (this.options.autoLoad) {
      this.loadAllPlugins().catch(error => {
        this.log('error', 'Erreur lors du chargement automatique', error.message);
      });
    }
  }

  setupHooks() {
    // Hooks prédéfinis de Veko.js
    const defaultHooks = [
      'app:init',
      'app:start',
      'app:stop',
      'route:load',
      'route:create',
      'route:delete',
      'request:start',
      'request:end',
      'error:handle',
      'websocket:connect',
      'websocket:disconnect',
      'file:change',
      'plugin:load',
      'plugin:unload',
      'plugin:error',
      'plugin:timeout'
    ];

    defaultHooks.forEach(hookName => {
      this.hooks.set(hookName, []);
    });
  }

  // ============= GESTION DES PLUGINS =============
  
  /**
   * Charge un plugin avec gestion d'erreurs améliorée
   * @param {string|Object} plugin - Nom du plugin ou objet plugin
   * @param {Object} config - Configuration du plugin
   */
  async loadPlugin(plugin, config = {}) {
    let pluginName;
    
    try {
      let pluginModule;

      if (typeof plugin === 'string') {
        pluginName = plugin;
        
        // Vérifier si déjà en cours de chargement
        if (this.loadingQueue.has(pluginName)) {
          throw new Error(`Plugin "${pluginName}" déjà en cours de chargement`);
        }
        
        this.loadingQueue.add(pluginName);
        
        // Essayer de charger depuis le dossier plugins
        const pluginPath = path.join(process.cwd(), this.options.pluginsDir, plugin);
        
        if (fs.existsSync(`${pluginPath}.js`)) {
          pluginModule = require(`${pluginPath}.js`);
        } else if (fs.existsSync(path.join(pluginPath, 'index.js'))) {
          pluginModule = require(path.join(pluginPath, 'index.js'));
        } else {
          // Essayer depuis node_modules
          try {
            pluginModule = require(plugin);
          } catch (e) {
            throw new Error(`Plugin "${plugin}" introuvable`);
          }
        }
      } else {
        pluginModule = plugin;
        pluginName = plugin.name || 'anonymous';
        this.loadingQueue.add(pluginName);
      }

      // Vérifier si le plugin est déjà chargé
      if (this.plugins.has(pluginName)) {
        this.log('warning', 'Plugin déjà chargé', pluginName);
        this.loadingQueue.delete(pluginName);
        return this;
      }

      // Valider la structure du plugin
      this.validatePlugin(pluginModule, pluginName);

      // Créer l'instance du plugin
      const pluginInstance = {
        name: pluginName,
        version: pluginModule.version || '1.0.0',
        description: pluginModule.description || '',
        author: pluginModule.author || '',
        dependencies: pluginModule.dependencies || [],
        config: { ...pluginModule.defaultConfig, ...config },
        module: pluginModule,
        loaded: false,
        active: false,
        loadTime: Date.now(),
        errorCount: 0
      };

      // Vérifier les dépendances
      await this.checkDependencies(pluginInstance);

      // Charger le plugin avec timeout
      await this.executePluginLoadWithTimeout(pluginInstance);

      // Enregistrer le plugin
      this.plugins.set(pluginName, pluginInstance);
      this.loadOrder.push(pluginName);
      this.loadingQueue.delete(pluginName);

      this.log('success', 'Plugin chargé', `${pluginName} v${pluginInstance.version}`);
      this.emit('plugin:loaded', pluginName, pluginInstance);
      await this.executeHook('plugin:load', pluginName, pluginInstance);
      
      return this;
    } catch (error) {
      if (pluginName) {
        this.loadingQueue.delete(pluginName);
        this.errorCount.set(pluginName, (this.errorCount.get(pluginName) || 0) + 1);
      }
      this.log('error', 'Erreur lors du chargement du plugin', error.message);
      this.emit('plugin:error', pluginName, error);
      throw error;
    }
  }

  /**
   * Décharge un plugin avec nettoyage complet
   * @param {string} pluginName - Nom du plugin
   */
  async unloadPlugin(pluginName) {
    try {
      const plugin = this.plugins.get(pluginName);
      
      if (!plugin) {
        this.log('warning', 'Plugin introuvable', pluginName);
        return this;
      }

      // Exécuter la méthode unload si elle existe
      if (plugin.module.unload && typeof plugin.module.unload === 'function') {
        try {
          await Promise.race([
            plugin.module.unload(this.app, plugin.config),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), this.options.timeout)
            )
          ]);
        } catch (error) {
          this.log('warning', `Erreur lors du déchargement de ${pluginName}`, error.message);
        }
      }

      // Nettoyer les hooks du plugin
      this.cleanupPluginHooks(pluginName);
      
      // Nettoyer les middlewares du plugin
      this.cleanupPluginMiddleware(pluginName);
      
      // Nettoyer les routes du plugin
      this.cleanupPluginRoutes(pluginName);
      
      // Nettoyer les commandes du plugin
      this.cleanupPluginCommands(pluginName);

      // Nettoyer le cache require si possible
      try {
        const pluginModule = plugin.module;
        if (pluginModule && pluginModule.__filename) {
          delete require.cache[pluginModule.__filename];
        }
      } catch (error) {
        // Ignore cache cleanup errors
      }

      // Supprimer de la liste
      this.plugins.delete(pluginName);
      this.loadOrder = this.loadOrder.filter(name => name !== pluginName);
      this.errorCount.delete(pluginName);

      this.log('success', 'Plugin déchargé', pluginName);
      this.emit('plugin:unloaded', pluginName);
      await this.executeHook('plugin:unload', pluginName);
      
      return this;
    } catch (error) {
      this.log('error', 'Erreur lors du déchargement du plugin', error.message);
      throw error;
    }
  }

  /**
   * Recharge un plugin avec nouvelle configuration
   * @param {string} pluginName - Nom du plugin
   * @param {Object} newConfig - Nouvelle configuration
   */
  async reloadPlugin(pluginName, newConfig = {}) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" introuvable`);
    }

    const config = { ...plugin.config, ...newConfig };
    
    await this.unloadPlugin(pluginName);
    await this.loadPlugin(pluginName, config);
    
    this.log('success', 'Plugin rechargé', pluginName);
    return this;
  }

  /**
   * Charge tous les plugins du dossier plugins avec gestion des dépendances
   */
  async loadAllPlugins() {
    const pluginsPath = path.join(process.cwd(), this.options.pluginsDir);
    
    if (!fs.existsSync(pluginsPath)) {
      this.log('info', 'Dossier plugins créé', `📁 ${this.options.pluginsDir}`);
      fs.mkdirSync(pluginsPath, { recursive: true });
      return this;
    }

    const files = fs.readdirSync(pluginsPath);
    const pluginFiles = files.filter(file => 
      file.endsWith('.js') || file.endsWith('.ts') || 
      (fs.statSync(path.join(pluginsPath, file)).isDirectory() && 
       (fs.existsSync(path.join(pluginsPath, file, 'index.js')) ||
        fs.existsSync(path.join(pluginsPath, file, 'index.ts'))))
    );

    if (pluginFiles.length === 0) {
      this.log('info', 'Aucun plugin trouvé', `📁 ${this.options.pluginsDir}`);
      return this;
    }

    this.log('info', 'Chargement des plugins...', `📦 ${pluginFiles.length} trouvés`);

    // Collect plugin information and dependencies
    const pluginsInfo = [];
    for (const file of pluginFiles) {
      try {
        const pluginName = file.replace(/\.(js|ts)$/, '');
        const pluginModule = await this.resolvePlugin(pluginName);
        
        // Log dependencies for debugging
        this.log('info', `Analyse du plugin ${pluginName}`, 
                 `Dépendances: ${JSON.stringify(pluginModule.dependencies || [])}`);
        
        pluginsInfo.push({
          name: pluginName,
          dependencies: pluginModule.dependencies || [],
          module: pluginModule
        });
      } catch (error) {
        this.log('warning', `Problème d'analyse`, `${file} → ${error.message}`);
      }
    }

    // Sort plugins by dependencies
    const loadOrder = this.sortPluginsByDependencies(pluginsInfo);
    
    // Log the calculated load order
    this.log('info', 'Ordre de chargement des plugins', loadOrder.join(' → '));

    // Load plugins in dependency order with retry mechanism
    const results = { success: 0, failed: 0, errors: [] };
    
    for (const pluginName of loadOrder) {
      let retries = 0;
      let loaded = false;
      
      while (retries < this.options.maxRetries && !loaded) {
        try {
          await this.loadPlugin(pluginName);
          loaded = true;
          results.success++;
        } catch (error) {
          retries++;
          results.errors.push({ plugin: pluginName, error: error.message, attempt: retries });
          
          if (retries < this.options.maxRetries) {
            this.log('warning', `Tentative ${retries + 1}/${this.options.maxRetries}`, 
                     `${pluginName} → ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          } else {
            this.log('error', `Échec définitif`, `${pluginName} → ${error.message}`);
            results.failed++;
          }
        }
      }
    }

    // Log final results
    this.log('success', 'Chargement terminé', 
             `✅ ${results.success} réussis, ❌ ${results.failed} échoués`);
    
    if (results.errors.length > 0) {
      this.log('warning', 'Erreurs détaillées', 
               results.errors.map(e => `${e.plugin}: ${e.error}`).join('; '));
    }

    return this;
  }

  /**
   * Trie les plugins par ordre de dépendances
   */
  sortPluginsByDependencies(pluginsInfo) {
    const loadOrder = [];
    const loaded = new Set();
    const loading = new Set();
    
    const loadPlugin = (plugin) => {
      // Skip if already loaded
      if (loaded.has(plugin.name)) return;
      
      // Detect circular dependencies
      if (loading.has(plugin.name)) {
        this.log('warning', 'Dépendance circulaire détectée', plugin.name);
        return;
      }
      
      loading.add(plugin.name);
      
      // Load dependencies first
      for (const depName of plugin.dependencies) {
        const depPlugin = pluginsInfo.find(p => p.name === depName);
        if (depPlugin) {
          loadPlugin(depPlugin);
        } else {
          this.log('warning', `Dépendance manquante`, `${plugin.name} → ${depName}`);
        }
      }
      
      // Then load the plugin itself
      loadOrder.push(plugin.name);
      loaded.add(plugin.name);
      loading.delete(plugin.name);
    };
    
    // Process all plugins
    for (const plugin of pluginsInfo) {
      loadPlugin(plugin);
    }
    
    return loadOrder;
  }

  // ============= VALIDATION ET DÉPENDANCES =============
  
  validatePlugin(pluginModule, pluginName) {
    if (!pluginModule || typeof pluginModule !== 'object') {
      throw new Error(`Plugin "${pluginName}" doit exporter un objet`);
    }

    if (!pluginModule.load || typeof pluginModule.load !== 'function') {
      throw new Error(`Plugin "${pluginName}" doit avoir une méthode load()`);
    }

    // Validation des métadonnées
    if (pluginModule.name && typeof pluginModule.name !== 'string') {
      throw new Error(`Plugin "${pluginName}": name doit être une chaîne`);
    }
    
    if (pluginModule.version && typeof pluginModule.version !== 'string') {
      throw new Error(`Plugin "${pluginName}": version doit être une chaîne`);
    }

    // Validation optionnelle des autres méthodes
    const optionalMethods = ['unload', 'activate', 'deactivate'];
    optionalMethods.forEach(method => {
      if (pluginModule[method] && typeof pluginModule[method] !== 'function') {
        throw new Error(`Plugin "${pluginName}": ${method} doit être une fonction`);
      }
    });

    // Validation des dépendances
    if (pluginModule.dependencies && !Array.isArray(pluginModule.dependencies)) {
      throw new Error(`Plugin "${pluginName}": dependencies doit être un tableau`);
    }
  }

  async checkDependencies(plugin) {
    if (!plugin.dependencies || plugin.dependencies.length === 0) {
      return;
    }

    const missing = [];
    for (const dep of plugin.dependencies) {
      if (!this.plugins.has(dep)) {
        missing.push(dep);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(`Plugin "${plugin.name}" nécessite: ${missing.join(', ')}`);
    }
  }

  async executePluginLoadWithTimeout(plugin) {
    const pluginContext = this.createPluginContext(plugin);

    try {
      // Charger le plugin avec timeout
      await Promise.race([
        plugin.module.load(this.app, plugin.config, pluginContext),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout de chargement dépassé')), this.options.timeout)
        )
      ]);
      
      plugin.loaded = true;
      plugin.active = true;
    } catch (error) {
      if (error.message.includes('Timeout')) {
        this.emit('plugin:timeout', plugin.name);
      }
      throw error;
    }
  }

  // ============= CONTEXTE ET API POUR PLUGINS =============
  
  createPluginContext(plugin) {
    return {
      // Accès au système de hooks
      hook: (hookName, callback, priority = 10) => 
        this.addHook(hookName, callback, plugin.name, priority),
      removeHook: (hookName, callback) => 
        this.removeHook(hookName, callback, plugin.name),
      
      // Ajout de middleware
      addMiddleware: (middleware) => 
        this.addPluginMiddleware(middleware, plugin.name),
      
      // Ajout de routes
      addRoute: (method, path, handler) => 
        this.addPluginRoute(method, path, handler, plugin.name),
      
      // Ajout de commandes CLI
      addCommand: (name, handler, description) => 
        this.addPluginCommand(name, handler, description, plugin.name),
      
      // Logs avec nom du plugin
      log: (type, message, details = '') => 
        this.log(type, `[${plugin.name}] ${message}`, details),
      
      // Accès aux autres plugins
      getPlugin: (name) => this.getPlugin(name),
      listPlugins: () => this.listPlugins(),
      
      // Configuration
      getConfig: () => ({ ...plugin.config }),
      updateConfig: (newConfig) => 
        this.updatePluginConfig(plugin.name, newConfig),
      
      // Stockage persistant pour le plugin
      storage: this.createPluginStorage(plugin.name),
      
      // Émission d'événements
      emit: (eventName, ...args) => 
        this.emit(`plugin:${plugin.name}:${eventName}`, ...args),
      
      // Accès à l'application
      app: this.app
    };
  }

  createPluginStorage(pluginName) {
    const storageFile = path.join(process.cwd(), 'data', 'plugins', `${pluginName}.json`);
    
    return {
      get: (key, defaultValue = null) => {
        try {
          if (!fs.existsSync(storageFile)) return defaultValue;
          const data = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
          return key ? (data[key] !== undefined ? data[key] : defaultValue) : data;
        } catch (error) {
          this.log('warning', `Erreur lecture storage pour ${pluginName}`, error.message);
          return defaultValue;
        }
      },
      
      set: (key, value) => {
        try {
          const dir = path.dirname(storageFile);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          let data = {};
          if (fs.existsSync(storageFile)) {
            try {
              data = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
            } catch (error) {
              this.log('warning', `Fichier storage corrompu pour ${pluginName}`, 'réinitialisation');
            }
          }
          
          if (typeof key === 'object') {
            data = { ...data, ...key };
          } else {
            data[key] = value;
          }
          
          fs.writeFileSync(storageFile, JSON.stringify(data, null, 2));
          return true;
        } catch (error) {
          this.log('error', `Erreur écriture storage pour ${pluginName}`, error.message);
          return false;
        }
      },
      
      delete: (key) => {
        try {
          if (!fs.existsSync(storageFile)) return true;
          const data = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
          delete data[key];
          fs.writeFileSync(storageFile, JSON.stringify(data, null, 2));
          return true;
        } catch (error) {
          this.log('error', `Erreur suppression storage pour ${pluginName}`, error.message);
          return false;
        }
      },
      
      clear: () => {
        try {
          if (fs.existsSync(storageFile)) {
            fs.unlinkSync(storageFile);
          }
          return true;
        } catch (error) {
          this.log('error', `Erreur nettoyage storage pour ${pluginName}`, error.message);
          return false;
        }
      }
    };
  }

  // ============= SYSTÈME DE HOOKS =============
  
  /**
   * Ajoute un hook avec priorité
   * @param {string} hookName - Nom du hook
   * @param {Function} callback - Fonction à exécuter
   * @param {string} pluginName - Nom du plugin
   * @param {number} priority - Priorité (plus élevé = exécuté en premier)
   */
  addHook(hookName, callback, pluginName = 'core', priority = 10) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    
    if (typeof callback !== 'function') {
      throw new Error(`Hook callback doit être une fonction pour ${hookName}`);
    }
    
    this.hooks.get(hookName).push({
      callback,
      plugin: pluginName,
      priority: Number(priority) || 10
    });
    
    // Trier par priorité (plus élevé en premier)
    this.hooks.get(hookName).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Supprime un hook
   * @param {string} hookName - Nom du hook
   * @param {Function} callback - Fonction à supprimer
   * @param {string} pluginName - Nom du plugin
   */
  removeHook(hookName, callback, pluginName) {
    if (!this.hooks.has(hookName)) return;
    
    const hooks = this.hooks.get(hookName);
    this.hooks.set(hookName, hooks.filter(hook => 
      !(hook.callback === callback && hook.plugin === pluginName)
    ));
  }

  /**
   * Execute un hook avec gestion d'erreur améliorée
   * @param {string} hookName - Nom du hook
   * @param {...any} args - Arguments à passer aux callbacks
   */
  async executeHook(hookName, ...args) {
    if (!this.hooks.has(hookName)) return args;
    
    const hooks = this.hooks.get(hookName);
    let result = args;
    
    for (const hook of hooks) {
      try {
        const hookResult = await Promise.race([
          hook.callback(...result),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Hook timeout')), 5000)
          )
        ]);
        
        if (hookResult !== undefined) {
          result = Array.isArray(hookResult) ? hookResult : [hookResult];
        }
      } catch (error) {
        this.log('error', `Erreur dans le hook ${hookName}`, 
                 `Plugin: ${hook.plugin} → ${error.message}`);
        this.emit('hook:error', hookName, hook.plugin, error);
      }
    }
    
    return result;
  }

  // ============= GESTION DES ÉLÉMENTS AJOUTÉS PAR LES PLUGINS =============
  
  addPluginMiddleware(middleware, pluginName) {
    if (typeof middleware !== 'function') {
      throw new Error('Le middleware doit être une fonction');
    }
    
    this.middleware.push({ middleware, plugin: pluginName });
    
    if (this.app && this.app.use) {
      this.app.use(middleware);
    }
  }

  addPluginRoute(method, path, handler, pluginName) {
    if (!method || !path || !handler) {
      throw new Error('Méthode, chemin et handler requis pour une route');
    }
    
    const route = { method, path, handler, plugin: pluginName };
    this.routes.push(route);
    
    if (this.app && this.app.createRoute) {
      this.app.createRoute(method, path, handler);
    }
  }

  addPluginCommand(name, handler, description, pluginName) {
    if (!name || !handler) {
      throw new Error('Nom et handler requis pour une commande');
    }
    
    this.commands.set(name, {
      handler,
      description: description || '',
      plugin: pluginName
    });
  }

  // ============= NETTOYAGE =============
  
  cleanupPluginHooks(pluginName) {
    this.hooks.forEach((hooks, hookName) => {
      this.hooks.set(hookName, hooks.filter(hook => hook.plugin !== pluginName));
    });
  }

  cleanupPluginMiddleware(pluginName) {
    this.middleware = this.middleware.filter(item => item.plugin !== pluginName);
  }

  cleanupPluginRoutes(pluginName) {
    this.routes = this.routes.filter(route => route.plugin !== pluginName);
  }

  cleanupPluginCommands(pluginName) {
    for (const [name, command] of this.commands.entries()) {
      if (command.plugin === pluginName) {
        this.commands.delete(name);
      }
    }
  }

  // ============= UTILITAIRES =============
  
  /**
   * Obtient un plugin
   * @param {string} pluginName - Nom du plugin
   */
  getPlugin(pluginName) {
    return this.plugins.get(pluginName) || null;
  }

  /**
   * Liste tous les plugins
   */
  listPlugins() {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      loaded: plugin.loaded,
      active: plugin.active,
      loadTime: plugin.loadTime,
      errorCount: plugin.errorCount
    }));
  }

  /**
   * Met à jour la configuration d'un plugin
   */
  updatePluginConfig(pluginName, newConfig) {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.config = { ...plugin.config, ...newConfig };
      return true;
    }
    return false;
  }

  /**
   * Active/désactive un plugin
   */
  async togglePlugin(pluginName, active = null) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return false;

    const newState = active !== null ? active : !plugin.active;
    
    try {
      if (newState && !plugin.active) {
        // Activer
        if (plugin.module.activate) {
          await plugin.module.activate(this.app, plugin.config);
        }
        plugin.active = true;
        this.log('success', 'Plugin activé', pluginName);
        this.emit('plugin:activated', pluginName);
      } else if (!newState && plugin.active) {
        // Désactiver
        if (plugin.module.deactivate) {
          await plugin.module.deactivate(this.app, plugin.config);
        }
        plugin.active = false;
        this.log('warning', 'Plugin désactivé', pluginName);
        this.emit('plugin:deactivated', pluginName);
      }
    } catch (error) {
      this.log('error', `Erreur lors du changement d'état de ${pluginName}`, error.message);
      throw error;
    }

    return plugin.active;
  }

  /**
   * Vérifie la santé d'un plugin
   */
  checkPluginHealth(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return null;

    const errorCount = this.errorCount.get(pluginName) || 0;
    const uptime = Date.now() - plugin.loadTime;
    
    return {
      name: pluginName,
      loaded: plugin.loaded,
      active: plugin.active,
      errorCount,
      uptime,
      health: errorCount === 0 ? 'healthy' : errorCount < 5 ? 'warning' : 'critical'
    };
  }

  // ============= LOGS =============
  
  log(type, message, details = '') {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    const prefix = `${colors.gray}[${timestamp}]${colors.reset}`;
    
    const logStyles = {
      success: { badge: `${colors.bgGreen}${colors.white} 🔌 `, text: `${colors.green}${colors.bright}` },
      error: { badge: `${colors.bgRed}${colors.white} ❌ `, text: `${colors.red}${colors.bright}` },
      warning: { badge: `${colors.bgYellow}${colors.white} ⚠️ `, text: `${colors.yellow}${colors.bright}` },
      info: { badge: `${colors.bgBlue}${colors.white} 💎 `, text: `${colors.blue}${colors.bright}` },
      debug: { badge: `${colors.bgMagenta}${colors.white} 🐛 `, text: `${colors.magenta}${colors.bright}` }
    };

    const style = logStyles[type] || logStyles.info;
    
    const logMessage = `${prefix} ${style.badge}${colors.reset} ${style.text}${message}${colors.reset} ${colors.gray}${details}${colors.reset}`;
    console.log(logMessage);
    
    // Émettre l'événement de log pour les plugins
    this.emit('log', { type, message, details, timestamp: new Date() });
  }

  // ============= API PUBLIQUE =============
  
  /**
   * Crée un plugin simple depuis une fonction
   */
  createSimplePlugin(name, loadFunction, options = {}) {
    return {
      name,
      version: options.version || '1.0.0',
      description: options.description || '',
      dependencies: options.dependencies || [],
      load: loadFunction,
      unload: options.unload,
      activate: options.activate,
      deactivate: options.deactivate,
      ...options
    };
  }

  /**
   * Statistiques détaillées des plugins
   */
  getStats() {
    const plugins = Array.from(this.plugins.values());
    
    return {
      total: plugins.length,
      active: plugins.filter(p => p.active).length,
      loaded: plugins.filter(p => p.loaded).length,
      loading: this.loadingQueue.size,
      hooks: this.hooks.size,
      totalHookCallbacks: Array.from(this.hooks.values()).reduce((sum, hooks) => sum + hooks.length, 0),
      middleware: this.middleware.length,
      routes: this.routes.length,
      commands: this.commands.size,
      errors: Array.from(this.errorCount.values()).reduce((sum, count) => sum + count, 0),
      uptime: plugins.length > 0 ? Date.now() - Math.min(...plugins.map(p => p.loadTime)) : 0
    };
  }

  /**
   * Sauvegarde l'état des plugins
   */
  saveState() {
    const state = {
      loadOrder: this.loadOrder,
      pluginConfigs: Array.from(this.plugins.entries()).map(([name, plugin]) => ({
        name,
        config: plugin.config,
        active: plugin.active
      })),
      timestamp: Date.now()
    };
    
    try {
      const stateFile = path.join(process.cwd(), 'data', 'plugin-state.json');
      const dir = path.dirname(stateFile);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
      return true;
    } catch (error) {
      this.log('error', 'Erreur sauvegarde état plugins', error.message);
      return false;
    }
  }

  /**
   * Restaure l'état des plugins
   */
  async restoreState() {
    try {
      const stateFile = path.join(process.cwd(), 'data', 'plugin-state.json');
      
      if (!fs.existsSync(stateFile)) {
        return false;
      }
      
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      
      // Charger les plugins dans l'ordre sauvegardé
      for (const pluginConfig of state.pluginConfigs) {
        try {
          await this.loadPlugin(pluginConfig.name, pluginConfig.config);
          if (!pluginConfig.active) {
            await this.togglePlugin(pluginConfig.name, false);
          }
        } catch (error) {
          this.log('warning', `Impossible de restaurer ${pluginConfig.name}`, error.message);
        }
      }
      
      this.log('success', 'État des plugins restauré', `${state.pluginConfigs.length} plugins`);
      return true;
    } catch (error) {
      this.log('error', 'Erreur restauration état plugins', error.message);
      return false;
    }
  }
}

module.exports = PluginManager;
