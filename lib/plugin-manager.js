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
      ...options
    };
    
    this.plugins = new Map();
    this.hooks = new Map();
    this.middleware = [];
    this.routes = [];
    this.commands = new Map();
    this.loadOrder = [];
    
    this.init();
  }

  // ============= INITIALISATION =============
  init() {
    this.setupHooks();
    
    if (this.options.autoLoad) {
      this.loadAllPlugins();
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
      'plugin:unload'
    ];

    defaultHooks.forEach(hookName => {
      this.hooks.set(hookName, []);
    });
  }

  // ============= GESTION DES PLUGINS =============
  
  /**
   * Charge un plugin
   * @param {string|Object} plugin - Nom du plugin ou objet plugin
   * @param {Object} config - Configuration du plugin
   */
  async loadPlugin(plugin, config = {}) {
    try {
      let pluginModule;
      let pluginName;

      if (typeof plugin === 'string') {
        pluginName = plugin;
        
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
      }

      // Vérifier si le plugin est déjà chargé
      if (this.plugins.has(pluginName)) {
        this.log('warning', 'Plugin déjà chargé', pluginName);
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
        active: false
      };

      // Vérifier les dépendances
      await this.checkDependencies(pluginInstance);

      // Charger le plugin
      await this.executePluginLoad(pluginInstance);

      // Enregistrer le plugin
      this.plugins.set(pluginName, pluginInstance);
      this.loadOrder.push(pluginName);

      this.log('success', 'Plugin chargé', `${pluginName} v${pluginInstance.version}`);
      this.emit('plugin:loaded', pluginName, pluginInstance);
      
      return this;
    } catch (error) {
      this.log('error', 'Erreur lors du chargement du plugin', error.message);
      throw error;
    }
  }

  /**
   * Décharge un plugin
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
        await plugin.module.unload(this.app, plugin.config);
      }

      // Nettoyer les hooks du plugin
      this.cleanupPluginHooks(pluginName);

      // Nettoyer le cache require
      const pluginPath = require.resolve(plugin.module);
      delete require.cache[pluginPath];

      // Supprimer de la liste
      this.plugins.delete(pluginName);
      this.loadOrder = this.loadOrder.filter(name => name !== pluginName);

      this.log('success', 'Plugin déchargé', pluginName);
      this.emit('plugin:unloaded', pluginName);
      
      return this;
    } catch (error) {
      this.log('error', 'Erreur lors du déchargement du plugin', error.message);
      throw error;
    }
  }

  /**
   * Recharge un plugin
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
   * Charge tous les plugins du dossier plugins
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
      file.endsWith('.js') || fs.statSync(path.join(pluginsPath, file)).isDirectory()
    );

    if (pluginFiles.length === 0) {
      this.log('info', 'Aucun plugin trouvé', `📁 ${this.options.pluginsDir}`);
      return this;
    }

    this.log('info', 'Chargement des plugins...', `📦 ${pluginFiles.length} trouvés`);

    for (const file of pluginFiles) {
      try {
        const pluginName = file.replace('.js', '');
        await this.loadPlugin(pluginName);
      } catch (error) {
        this.log('error', `Échec du chargement`, `${file} → ${error.message}`);
      }
    }

    return this;
  }

  // ============= VALIDATION ET DÉPENDANCES =============
  
  validatePlugin(pluginModule, pluginName) {
    if (!pluginModule || typeof pluginModule !== 'object') {
      throw new Error(`Plugin "${pluginName}" doit exporter un objet`);
    }

    if (!pluginModule.load || typeof pluginModule.load !== 'function') {
      throw new Error(`Plugin "${pluginName}" doit avoir une méthode load()`);
    }

    // Validation optionnelle des autres méthodes
    const optionalMethods = ['unload', 'activate', 'deactivate'];
    optionalMethods.forEach(method => {
      if (pluginModule[method] && typeof pluginModule[method] !== 'function') {
        throw new Error(`Plugin "${pluginName}": ${method} doit être une fonction`);
      }
    });
  }

  async checkDependencies(plugin) {
    if (!plugin.dependencies || plugin.dependencies.length === 0) {
      return;
    }

    for (const dep of plugin.dependencies) {
      if (!this.plugins.has(dep)) {
        throw new Error(`Plugin "${plugin.name}" nécessite "${dep}"`);
      }
    }
  }

  async executePluginLoad(plugin) {
    // Créer un contexte sécurisé pour le plugin
    const pluginContext = this.createPluginContext(plugin);

    // Charger le plugin
    await plugin.module.load(this.app, plugin.config, pluginContext);
    
    plugin.loaded = true;
    plugin.active = true;
  }

  // ============= CONTEXTE ET API POUR PLUGINS =============
  
  createPluginContext(plugin) {
    return {
      // Accès au système de hooks
      hook: (hookName, callback) => this.addHook(hookName, callback, plugin.name),
      removeHook: (hookName, callback) => this.removeHook(hookName, callback, plugin.name),
      
      // Ajout de middleware
      addMiddleware: (middleware) => this.addPluginMiddleware(middleware, plugin.name),
      
      // Ajout de routes
      addRoute: (method, path, handler) => this.addPluginRoute(method, path, handler, plugin.name),
      
      // Ajout de commandes CLI
      addCommand: (name, handler, description) => this.addPluginCommand(name, handler, description, plugin.name),
      
      // Logs avec nom du plugin
      log: (type, message, details = '') => this.log(type, `[${plugin.name}] ${message}`, details),
      
      // Accès aux autres plugins
      getPlugin: (name) => this.getPlugin(name),
      listPlugins: () => this.listPlugins(),
      
      // Configuration
      getConfig: () => plugin.config,
      updateConfig: (newConfig) => this.updatePluginConfig(plugin.name, newConfig),
      
      // Stockage persistant pour le plugin
      storage: this.createPluginStorage(plugin.name)
    };
  }

  createPluginStorage(pluginName) {
    const storageFile = path.join(process.cwd(), 'data', 'plugins', `${pluginName}.json`);
    
    return {
      get: (key, defaultValue = null) => {
        try {
          if (!fs.existsSync(storageFile)) return defaultValue;
          const data = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
          return key ? data[key] : data;
        } catch {
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
            data = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
          }
          
          if (typeof key === 'object') {
            data = { ...data, ...key };
          } else {
            data[key] = value;
          }
          
          fs.writeFileSync(storageFile, JSON.stringify(data, null, 2));
          return true;
        } catch {
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
        } catch {
          return false;
        }
      },
      
      clear: () => {
        try {
          if (fs.existsSync(storageFile)) {
            fs.unlinkSync(storageFile);
          }
          return true;
        } catch {
          return false;
        }
      }
    };
  }

  // ============= SYSTÈME DE HOOKS =============
  
  /**
   * Ajoute un hook
   * @param {string} hookName - Nom du hook
   * @param {Function} callback - Fonction à exécuter
   * @param {string} pluginName - Nom du plugin
   */
  addHook(hookName, callback, pluginName = 'core') {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    
    this.hooks.get(hookName).push({
      callback,
      plugin: pluginName,
      priority: 10 // Priorité par défaut
    });
    
    // Trier par priorité
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
      hook.callback !== callback || hook.plugin !== pluginName
    ));
  }

  /**
   * Execute un hook
   * @param {string} hookName - Nom du hook
   * @param {...any} args - Arguments à passer aux callbacks
   */
  async executeHook(hookName, ...args) {
    if (!this.hooks.has(hookName)) return args;
    
    const hooks = this.hooks.get(hookName);
    let result = args;
    
    for (const hook of hooks) {
      try {
        const hookResult = await hook.callback(...result);
        if (hookResult !== undefined) {
          result = Array.isArray(hookResult) ? hookResult : [hookResult];
        }
      } catch (error) {
        this.log('error', `Erreur dans le hook ${hookName}`, `Plugin: ${hook.plugin} → ${error.message}`);
      }
    }
    
    return result;
  }

  // ============= GESTION DES ÉLÉMENTS AJOUTÉS PAR LES PLUGINS =============
  
  addPluginMiddleware(middleware, pluginName) {
    this.middleware.push({ middleware, plugin: pluginName });
    this.app.use(middleware);
  }

  addPluginRoute(method, path, handler, pluginName) {
    const route = { method, path, handler, plugin: pluginName };
    this.routes.push(route);
    this.app.createRoute(method, path, handler);
  }

  addPluginCommand(name, handler, description, pluginName) {
    this.commands.set(name, {
      handler,
      description,
      plugin: pluginName
    });
  }

  cleanupPluginHooks(pluginName) {
    this.hooks.forEach((hooks, hookName) => {
      this.hooks.set(hookName, hooks.filter(hook => hook.plugin !== pluginName));
    });
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
      active: plugin.active
    }));
  }

  /**
   * Met à jour la configuration d'un plugin
   */
  updatePluginConfig(pluginName, newConfig) {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.config = { ...plugin.config, ...newConfig };
    }
  }

  /**
   * Active/désactive un plugin
   */
  async togglePlugin(pluginName, active = null) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return false;

    const newState = active !== null ? active : !plugin.active;
    
    if (newState && !plugin.active) {
      // Activer
      if (plugin.module.activate) {
        await plugin.module.activate(this.app, plugin.config);
      }
      plugin.active = true;
      this.log('success', 'Plugin activé', pluginName);
    } else if (!newState && plugin.active) {
      // Désactiver
      if (plugin.module.deactivate) {
        await plugin.module.deactivate(this.app, plugin.config);
      }
      plugin.active = false;
      this.log('warning', 'Plugin désactivé', pluginName);
    }

    return plugin.active;
  }

  // ============= LOGS =============
  
  log(type, message, details = '') {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    const prefix = `${colors.gray}[${timestamp}]${colors.reset}`;
    
    const logStyles = {
      success: { badge: `${colors.bgGreen}${colors.white} 🔌 `, text: `${colors.green}${colors.bright}` },
      error: { badge: `${colors.bgRed}${colors.white} ❌ `, text: `${colors.red}${colors.bright}` },
      warning: { badge: `${colors.bgYellow}${colors.white} ⚠️ `, text: `${colors.yellow}${colors.bright}` },
      info: { badge: `${colors.bgBlue}${colors.white} 💎 `, text: `${colors.blue}${colors.bright}` }
    };

    const style = logStyles[type] || logStyles.info;
    
    console.log(
      `${prefix} ${style.badge}${colors.reset} ${style.text}${message}${colors.reset} ${colors.gray}${details}${colors.reset}`
    );
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
      load: loadFunction,
      unload: options.unload,
      ...options
    };
  }

  /**
   * Statistiques des plugins
   */
  getStats() {
    const plugins = Array.from(this.plugins.values());
    
    return {
      total: plugins.length,
      active: plugins.filter(p => p.active).length,
      loaded: plugins.filter(p => p.loaded).length,
      hooks: this.hooks.size,
      middleware: this.middleware.length,
      routes: this.routes.length,
      commands: this.commands.size
    };
  }
}

module.exports = PluginManager;