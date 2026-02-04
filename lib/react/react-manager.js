/**
 * VekoJS React Manager
 * Support complet pour React avec SSR, CSR, et Hydration
 * @module veko/react
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class ReactManager {
  constructor(app, options = {}) {
    this.app = app;
    this.options = {
      // Répertoires
      componentsDir: options.componentsDir || 'components',
      pagesDir: options.pagesDir || 'pages',
      publicDir: options.publicDir || 'public',
      buildDir: options.buildDir || '.veko/react-build',
      
      // Mode de rendu
      renderMode: options.renderMode || 'hybrid', // 'ssr', 'csr', 'hybrid', 'static'
      
      // Configuration SSR
      ssr: {
        enabled: options.ssr?.enabled !== false,
        streaming: options.ssr?.streaming || false,
        cache: options.ssr?.cache !== false,
        cacheMaxAge: options.ssr?.cacheMaxAge || 60000, // 1 minute
        ...options.ssr
      },
      
      // Configuration du bundler
      bundler: {
        type: options.bundler?.type || 'esbuild', // 'esbuild', 'webpack', 'vite'
        minify: process.env.NODE_ENV === 'production',
        sourceMaps: process.env.NODE_ENV !== 'production',
        target: options.bundler?.target || 'es2020',
        ...options.bundler
      },
      
      // Configuration HMR
      hmr: {
        enabled: options.hmr?.enabled !== false,
        overlay: options.hmr?.overlay !== false,
        ...options.hmr
      },
      
      // Configuration TypeScript
      typescript: {
        enabled: options.typescript?.enabled || false,
        strict: options.typescript?.strict || true,
        ...options.typescript
      },
      
      // Configuration de l'hydration
      hydration: {
        mode: options.hydration?.mode || 'full', // 'full', 'partial', 'progressive'
        islands: options.hydration?.islands || false,
        ...options.hydration
      },
      
      // Sécurité
      security: {
        xssProtection: true,
        sanitizeProps: true,
        csp: options.security?.csp || null,
        ...options.security
      }
    };
    
    // État interne
    this.isEnabled = false;
    this.ssrCache = new Map();
    this.componentRegistry = new Map();
    this.buildCache = new Map();
    this.hmrClients = new Set();
    
    // Dépendances React
    this.React = null;
    this.ReactDOM = null;
    this.ReactDOMServer = null;
    
    // Bundler
    this.bundler = null;
  }

  /**
   * Initialise le support React
   */
  async init() {
    try {
      this.app.logger.log('info', 'Initialisation du support React', '⚛️');
      
      // Installer les dépendances si nécessaires
      await this.installDependencies();
      
      // Charger React
      await this.loadReact();
      
      // Initialiser le bundler
      await this.initBundler();
      
      // Scanner les composants
      await this.scanComponents();
      
      // Configurer les middlewares
      this.setupMiddleware();
      
      // Configurer les routes React
      this.setupRoutes();
      
      // Configurer HMR si en développement
      if (this.app.options.isDev && this.options.hmr.enabled) {
        this.setupHMR();
      }
      
      this.isEnabled = true;
      this.app.logger.log('success', 'Support React activé', '⚛️ Prêt');
      
      return this;
    } catch (error) {
      this.app.logger.log('error', 'Erreur initialisation React', error.message);
      throw error;
    }
  }

  /**
   * Installe les dépendances React nécessaires
   */
  async installDependencies() {
    const requiredModules = {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'esbuild': '^0.19.0'
    };
    
    if (this.options.typescript.enabled) {
      requiredModules['@types/react'] = '^18.2.0';
      requiredModules['@types/react-dom'] = '^18.2.0';
      requiredModules['typescript'] = '^5.0.0';
    }
    
    if (this.options.bundler.type === 'webpack') {
      requiredModules['webpack'] = '^5.0.0';
      requiredModules['babel-loader'] = '^9.0.0';
      requiredModules['@babel/core'] = '^7.0.0';
      requiredModules['@babel/preset-react'] = '^7.0.0';
    }

    for (const [moduleName, version] of Object.entries(requiredModules)) {
      try {
        require.resolve(moduleName);
      } catch (error) {
        this.app.logger.log('install', `Installation de ${moduleName}...`, '📦');
        await this.app.installModule(moduleName, version);
      }
    }
  }

  /**
   * Charge les modules React
   */
  async loadReact() {
    try {
      this.React = require('react');
      this.ReactDOM = require('react-dom');
      this.ReactDOMServer = require('react-dom/server');
      
      this.app.logger.log('info', 'React chargé', `v${this.React.version}`);
    } catch (error) {
      throw new Error(`Impossible de charger React: ${error.message}`);
    }
  }

  /**
   * Initialise le bundler (esbuild par défaut)
   */
  async initBundler() {
    const bundlerType = this.options.bundler.type;
    
    switch (bundlerType) {
      case 'esbuild':
        await this.initEsbuild();
        break;
      case 'webpack':
        await this.initWebpack();
        break;
      case 'vite':
        await this.initVite();
        break;
      default:
        await this.initEsbuild();
    }
  }

  /**
   * Initialise esbuild
   */
  async initEsbuild() {
    try {
      const esbuild = require('esbuild');
      
      this.bundler = {
        type: 'esbuild',
        instance: esbuild,
        
        // Compiler un fichier
        compile: async (inputPath, options = {}) => {
          const result = await esbuild.build({
            entryPoints: [inputPath],
            bundle: true,
            write: false,
            format: 'esm',
            platform: 'browser',
            target: this.options.bundler.target,
            minify: options.minify ?? this.options.bundler.minify,
            sourcemap: options.sourcemap ?? this.options.bundler.sourceMaps,
            jsx: 'automatic',
            jsxImportSource: 'react',
            loader: {
              '.js': 'jsx',
              '.jsx': 'jsx',
              '.ts': 'tsx',
              '.tsx': 'tsx',
              '.css': 'css',
              '.svg': 'dataurl',
              '.png': 'dataurl',
              '.jpg': 'dataurl',
              '.gif': 'dataurl'
            },
            define: {
              'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
            },
            external: options.external || []
          });
          
          return result.outputFiles[0]?.text || '';
        },
        
        // Compiler du code source
        compileCode: async (code, options = {}) => {
          const result = await esbuild.transform(code, {
            loader: options.loader || 'jsx',
            jsx: 'automatic',
            jsxImportSource: 'react',
            format: 'esm',
            target: this.options.bundler.target,
            minify: options.minify ?? this.options.bundler.minify,
            sourcemap: options.sourcemap ?? this.options.bundler.sourceMaps
          });
          
          return result.code;
        }
      };
      
      this.app.logger.log('info', 'Bundler esbuild initialisé', '📦');
    } catch (error) {
      throw new Error(`Erreur initialisation esbuild: ${error.message}`);
    }
  }

  /**
   * Initialise Webpack (optionnel)
   */
  async initWebpack() {
    try {
      const webpack = require('webpack');
      
      this.bundler = {
        type: 'webpack',
        instance: webpack,
        config: {
          mode: process.env.NODE_ENV || 'development',
          module: {
            rules: [
              {
                test: /\.(js|jsx|ts|tsx)$/,
                exclude: /node_modules/,
                use: {
                  loader: 'babel-loader',
                  options: {
                    presets: [
                      '@babel/preset-react',
                      '@babel/preset-typescript'
                    ]
                  }
                }
              }
            ]
          },
          resolve: {
            extensions: ['.js', '.jsx', '.ts', '.tsx']
          }
        }
      };
      
      this.app.logger.log('info', 'Bundler Webpack initialisé', '📦');
    } catch (error) {
      this.app.logger.log('warning', 'Webpack non disponible, utilisation de esbuild', error.message);
      await this.initEsbuild();
    }
  }

  /**
   * Initialise Vite (optionnel)
   */
  async initVite() {
    try {
      const vite = require('vite');
      
      this.bundler = {
        type: 'vite',
        instance: vite,
        config: {
          plugins: [],
          build: {
            target: this.options.bundler.target
          }
        }
      };
      
      this.app.logger.log('info', 'Bundler Vite initialisé', '📦');
    } catch (error) {
      this.app.logger.log('warning', 'Vite non disponible, utilisation de esbuild', error.message);
      await this.initEsbuild();
    }
  }

  /**
   * Scanne les composants React
   */
  async scanComponents() {
    const componentsPath = path.join(process.cwd(), this.options.componentsDir);
    const pagesPath = path.join(process.cwd(), this.options.pagesDir);
    
    // Scanner le dossier components
    if (fs.existsSync(componentsPath)) {
      await this.scanDirectory(componentsPath, 'component');
    }
    
    // Scanner le dossier pages
    if (fs.existsSync(pagesPath)) {
      await this.scanDirectory(pagesPath, 'page');
    }
    
    this.app.logger.log('info', 'Composants scannés', `${this.componentRegistry.size} trouvés`);
  }

  /**
   * Scanne un répertoire pour les composants React
   */
  async scanDirectory(dirPath, type = 'component') {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, type);
      } else if (this.isReactFile(entry.name)) {
        await this.registerComponent(fullPath, type);
      }
    }
  }

  /**
   * Vérifie si un fichier est un fichier React
   */
  isReactFile(filename) {
    return /\.(jsx?|tsx?)$/.test(filename);
  }

  /**
   * Enregistre un composant
   */
  async registerComponent(filePath, type) {
    const relativePath = path.relative(process.cwd(), filePath);
    const componentName = this.getComponentName(filePath);
    
    this.componentRegistry.set(componentName, {
      name: componentName,
      path: filePath,
      relativePath,
      type,
      hash: this.hashFile(filePath),
      compiledCode: null,
      lastCompiled: null
    });
  }

  /**
   * Obtient le nom du composant à partir du chemin
   */
  getComponentName(filePath) {
    const basename = path.basename(filePath);
    return basename.replace(/\.(jsx?|tsx?)$/, '');
  }

  /**
   * Hash un fichier pour détecter les changements
   */
  hashFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      return null;
    }
  }

  /**
   * Configure les middlewares React
   */
  setupMiddleware() {
    // Middleware pour servir les assets React compilés
    this.app.app.use('/_veko/react', (req, res, next) => {
      this.handleReactAsset(req, res, next);
    });
    
    // Middleware pour injecter le script HMR
    if (this.app.options.isDev && this.options.hmr.enabled) {
      this.app.app.use((req, res, next) => {
        this.injectHMRScript(req, res, next);
      });
    }
  }

  /**
   * Gère les requêtes pour les assets React
   */
  async handleReactAsset(req, res, next) {
    try {
      const assetPath = req.path.replace(/^\//, '');
      
      // Vérifier si c'est un composant enregistré
      const componentName = assetPath.replace(/\.js$/, '');
      const component = this.componentRegistry.get(componentName);
      
      if (component) {
        const compiledCode = await this.compileComponent(component);
        
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', this.app.options.isDev ? 'no-cache' : 'max-age=31536000');
        return res.send(compiledCode);
      }
      
      next();
    } catch (error) {
      this.app.logger.log('error', 'Erreur asset React', error.message);
      res.status(500).json({ error: 'Erreur de compilation' });
    }
  }

  /**
   * Compile un composant React
   */
  async compileComponent(component) {
    // Vérifier le cache
    const currentHash = this.hashFile(component.path);
    
    if (component.compiledCode && component.hash === currentHash) {
      return component.compiledCode;
    }
    
    // Compiler le composant
    const compiledCode = await this.bundler.compile(component.path, {
      minify: !this.app.options.isDev
    });
    
    // Mettre à jour le cache
    component.compiledCode = compiledCode;
    component.hash = currentHash;
    component.lastCompiled = Date.now();
    
    return compiledCode;
  }

  /**
   * Configure les routes React (pages)
   */
  setupRoutes() {
    // Route API pour le rendu SSR
    this.app.app.get('/_veko/react/ssr/:component', async (req, res) => {
      await this.handleSSRRequest(req, res);
    });
    
    // Créer les routes pour les pages React
    for (const [name, component] of this.componentRegistry) {
      if (component.type === 'page') {
        this.createPageRoute(component);
      }
    }
  }

  /**
   * Crée une route pour une page React
   */
  createPageRoute(component) {
    const routePath = this.componentToRoute(component);
    
    this.app.createRoute('get', routePath, async (req, res) => {
      await this.renderPage(component, req, res);
    });
    
    this.app.logger.log('route', 'Route React créée', `${routePath} → ${component.name}`);
  }

  /**
   * Convertit un composant en chemin de route
   */
  componentToRoute(component) {
    const pagesDir = this.options.pagesDir;
    let routePath = component.relativePath
      .replace(new RegExp(`^${pagesDir}[\\/\\\\]?`), '/')
      .replace(/\.(jsx?|tsx?)$/, '')
      .replace(/[\\/]/g, '/')
      .replace(/\/index$/, '/');
    
    // Gérer les paramètres dynamiques [id] → :id
    routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1');
    
    return routePath || '/';
  }

  /**
   * Rend une page React
   */
  async renderPage(component, req, res) {
    try {
      const renderMode = this.options.renderMode;
      
      switch (renderMode) {
        case 'ssr':
          return await this.renderSSR(component, req, res);
        case 'csr':
          return await this.renderCSR(component, req, res);
        case 'hybrid':
          return await this.renderHybrid(component, req, res);
        case 'static':
          return await this.renderStatic(component, req, res);
        default:
          return await this.renderHybrid(component, req, res);
      }
    } catch (error) {
      this.app.logger.log('error', 'Erreur rendu React', error.message);
      res.status(500).send(this.getErrorPage(error));
    }
  }

  /**
   * Rendu côté serveur (SSR)
   */
  async renderSSR(component, req, res) {
    // Vérifier le cache SSR
    const cacheKey = `${component.name}:${req.url}`;
    
    if (this.options.ssr.cache && this.ssrCache.has(cacheKey)) {
      const cached = this.ssrCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.options.ssr.cacheMaxAge) {
        return res.send(cached.html);
      }
    }
    
    // Compiler le composant pour Node.js
    const serverCode = await this.compileForServer(component);
    
    // Évaluer le composant (avec sandbox sécurisé)
    const Component = this.evaluateComponent(serverCode, component.path);
    
    // Récupérer les props initiales
    const props = await this.getInitialProps(Component, req);
    
    // Rendre le composant
    let html;
    if (this.options.ssr.streaming) {
      return this.renderSSRStreaming(Component, props, req, res);
    } else {
      const element = this.React.createElement(Component, props);
      html = this.ReactDOMServer.renderToString(element);
    }
    
    // Construire la page complète
    const fullHtml = this.buildFullPage(html, component, props);
    
    // Mettre en cache
    if (this.options.ssr.cache) {
      this.ssrCache.set(cacheKey, {
        html: fullHtml,
        timestamp: Date.now()
      });
    }
    
    res.send(fullHtml);
  }

  /**
   * Rendu SSR en streaming
   */
  async renderSSRStreaming(Component, props, req, res) {
    const { renderToPipeableStream } = this.ReactDOMServer;
    
    const element = this.React.createElement(Component, props);
    
    const { pipe } = renderToPipeableStream(element, {
      bootstrapScripts: [`/_veko/react/${Component.name || 'app'}.js`],
      onShellReady() {
        res.setHeader('Content-Type', 'text/html');
        pipe(res);
      },
      onError(error) {
        console.error('SSR Streaming Error:', error);
        res.status(500).send('Erreur de rendu');
      }
    });
  }

  /**
   * Rendu côté client (CSR)
   */
  async renderCSR(component, req, res) {
    const html = this.buildCSRPage(component);
    res.send(html);
  }

  /**
   * Rendu hybride (SSR + Hydration)
   */
  async renderHybrid(component, req, res) {
    // Compiler le composant pour Node.js
    const serverCode = await this.compileForServer(component);
    
    // Évaluer le composant
    const Component = this.evaluateComponent(serverCode, component.path);
    
    // Récupérer les props initiales
    const props = await this.getInitialProps(Component, req);
    
    // Rendre côté serveur
    const element = this.React.createElement(Component, props);
    const html = this.ReactDOMServer.renderToString(element);
    
    // Construire la page avec hydration
    const fullHtml = this.buildHydrationPage(html, component, props);
    
    res.send(fullHtml);
  }

  /**
   * Rendu statique
   */
  async renderStatic(component, req, res) {
    const staticPath = path.join(
      process.cwd(),
      this.options.buildDir,
      'static',
      `${component.name}.html`
    );
    
    if (fs.existsSync(staticPath)) {
      return res.sendFile(staticPath);
    }
    
    // Fallback sur SSR
    return this.renderSSR(component, req, res);
  }

  /**
   * Compile un composant pour le serveur
   */
  async compileForServer(component) {
    const cacheKey = `server:${component.name}`;
    
    if (this.buildCache.has(cacheKey)) {
      const cached = this.buildCache.get(cacheKey);
      if (cached.hash === component.hash) {
        return cached.code;
      }
    }
    
    const esbuild = require('esbuild');
    
    const result = await esbuild.build({
      entryPoints: [component.path],
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'node',
      target: 'node16',
      jsx: 'automatic',
      jsxImportSource: 'react',
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx',
        '.ts': 'tsx',
        '.tsx': 'tsx'
      },
      external: ['react', 'react-dom'],
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
      }
    });
    
    const code = result.outputFiles[0]?.text || '';
    
    this.buildCache.set(cacheKey, {
      code,
      hash: component.hash
    });
    
    return code;
  }

  /**
   * Évalue un composant compilé de manière sécurisée
   */
  evaluateComponent(code, filePath) {
    const Module = require('module');
    const vm = require('vm');
    
    // Créer un module virtuel
    const m = new Module(filePath);
    m.filename = filePath;
    m.paths = Module._nodeModulePaths(path.dirname(filePath));
    
    // Contexte sécurisé
    const sandbox = {
      module: m,
      exports: m.exports,
      require: (id) => {
        // Whitelist des modules autorisés
        const allowedModules = ['react', 'react-dom', 'react-dom/server'];
        if (allowedModules.includes(id) || id.startsWith('.')) {
          return m.require(id);
        }
        throw new Error(`Module non autorisé: ${id}`);
      },
      __filename: filePath,
      __dirname: path.dirname(filePath),
      process: { env: { NODE_ENV: process.env.NODE_ENV } },
      console
    };
    
    vm.runInNewContext(code, sandbox);
    
    return m.exports.default || m.exports;
  }

  /**
   * Récupère les props initiales d'un composant
   */
  async getInitialProps(Component, req) {
    if (typeof Component.getInitialProps === 'function') {
      try {
        return await Component.getInitialProps({
          req,
          query: req.query,
          params: req.params
        });
      } catch (error) {
        this.app.logger.log('warning', 'Erreur getInitialProps', error.message);
        return {};
      }
    }
    
    if (typeof Component.getServerSideProps === 'function') {
      try {
        const result = await Component.getServerSideProps({
          req,
          query: req.query,
          params: req.params
        });
        return result.props || {};
      } catch (error) {
        this.app.logger.log('warning', 'Erreur getServerSideProps', error.message);
        return {};
      }
    }
    
    return {};
  }

  /**
   * Construit la page HTML complète
   */
  buildFullPage(html, component, props) {
    const propsJson = this.sanitizeJSON(props);
    
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${component.name} - Veko.js</title>
  <script>window.__VEKO_PROPS__ = ${propsJson};</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div id="root">${html}</div>
  <script type="module" src="/_veko/react/${component.name}.js"></script>
  ${this.app.options.isDev && this.options.hmr.enabled ? this.getHMRScript() : ''}
</body>
</html>`;
  }

  /**
   * Construit la page CSR
   */
  buildCSRPage(component) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${component.name} - Veko.js</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #root { min-height: 100vh; }
    .loading { display: flex; justify-content: center; align-items: center; height: 100vh; }
  </style>
</head>
<body>
  <div id="root"><div class="loading">Chargement...</div></div>
  <script type="module" src="/_veko/react/${component.name}.js"></script>
  ${this.app.options.isDev && this.options.hmr.enabled ? this.getHMRScript() : ''}
</body>
</html>`;
  }

  /**
   * Construit la page avec hydration
   */
  buildHydrationPage(html, component, props) {
    const propsJson = this.sanitizeJSON(props);
    
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${component.name} - Veko.js</title>
  <script>window.__VEKO_PROPS__ = ${propsJson};</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div id="root">${html}</div>
  <script type="module">
    import { hydrateRoot } from 'react-dom/client';
    import Component from '/_veko/react/${component.name}.js';
    
    const props = window.__VEKO_PROPS__ || {};
    const root = document.getElementById('root');
    
    hydrateRoot(root, React.createElement(Component, props));
  </script>
  ${this.app.options.isDev && this.options.hmr.enabled ? this.getHMRScript() : ''}
</body>
</html>`;
  }

  /**
   * Sanitize JSON pour éviter les injections XSS
   */
  sanitizeJSON(obj) {
    return JSON.stringify(obj)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/'/g, '\\u0027');
  }

  /**
   * Configure le HMR (Hot Module Replacement)
   */
  setupHMR() {
    // WebSocket pour HMR
    if (this.app.devServer?.wss) {
      this.app.devServer.wss.on('connection', (ws) => {
        this.hmrClients.add(ws);
        
        ws.on('close', () => {
          this.hmrClients.delete(ws);
        });
      });
    }
    
    // Surveiller les changements de fichiers React
    const chokidar = require('chokidar');
    const watchPaths = [
      path.join(process.cwd(), this.options.componentsDir),
      path.join(process.cwd(), this.options.pagesDir)
    ].filter(p => fs.existsSync(p));
    
    if (watchPaths.length > 0) {
      const watcher = chokidar.watch(watchPaths, {
        ignored: /node_modules/,
        persistent: true
      });
      
      watcher.on('change', async (filePath) => {
        await this.handleHMRUpdate(filePath);
      });
    }
    
    this.app.logger.log('dev', 'HMR React activé', '🔥');
  }

  /**
   * Gère une mise à jour HMR
   */
  async handleHMRUpdate(filePath) {
    const componentName = this.getComponentName(filePath);
    const component = this.componentRegistry.get(componentName);
    
    if (component) {
      // Invalider le cache
      component.hash = null;
      component.compiledCode = null;
      this.ssrCache.clear();
      this.buildCache.clear();
      
      // Notifier les clients
      this.broadcastHMR({
        type: 'react-hmr',
        component: componentName,
        path: filePath,
        timestamp: Date.now()
      });
      
      this.app.logger.log('reload', 'Composant React mis à jour', `⚛️ ${componentName}`);
    }
  }

  /**
   * Diffuse un message HMR
   */
  broadcastHMR(data) {
    const message = JSON.stringify(data);
    
    this.hmrClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  /**
   * Script HMR injecté
   */
  getHMRScript() {
    const wsPort = this.app.options.wsPort || 3008;
    
    return `
    <script>
      (function() {
        const ws = new WebSocket('ws://localhost:${wsPort}');
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'react-hmr') {
              console.log('⚛️ HMR: Mise à jour du composant', data.component);
              window.location.reload();
            }
          } catch (e) {
            console.error('HMR Error:', e);
          }
        };
        
        ws.onerror = () => console.log('⚛️ HMR: Déconnecté');
      })();
    </script>`;
  }

  /**
   * Injecte le script HMR dans les réponses HTML
   */
  injectHMRScript(req, res, next) {
    const originalSend = res.send.bind(res);
    
    res.send = (body) => {
      if (typeof body === 'string' && 
          body.includes('</body>') && 
          res.get('Content-Type')?.includes('text/html') &&
          !body.includes('react-hmr')) {
        body = body.replace('</body>', `${this.getHMRScript()}</body>`);
      }
      return originalSend(body);
    };
    
    next();
  }

  /**
   * Gère une requête SSR
   */
  async handleSSRRequest(req, res) {
    try {
      const componentName = req.params.component;
      const component = this.componentRegistry.get(componentName);
      
      if (!component) {
        return res.status(404).json({ error: 'Composant non trouvé' });
      }
      
      const serverCode = await this.compileForServer(component);
      const Component = this.evaluateComponent(serverCode, component.path);
      const props = req.query.props ? JSON.parse(req.query.props) : {};
      
      const element = this.React.createElement(Component, props);
      const html = this.ReactDOMServer.renderToString(element);
      
      res.json({ html, props });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Page d'erreur
   */
  getErrorPage(error) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erreur - Veko.js React</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 40px; background: #1a1a2e; color: #fff; }
    .error { background: #ff4757; padding: 20px; border-radius: 8px; }
    pre { background: #0d0d1a; padding: 20px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>⚛️ Erreur React</h1>
  <div class="error">
    <strong>${error.message}</strong>
  </div>
  ${this.app.options.isDev ? `<pre>${error.stack}</pre>` : ''}
</body>
</html>`;
  }

  /**
   * Génère la build de production
   */
  async build() {
    this.app.logger.log('info', 'Build React en cours...', '🔨');
    
    const buildDir = path.join(process.cwd(), this.options.buildDir);
    
    // Créer le dossier de build
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }
    
    // Compiler tous les composants
    for (const [name, component] of this.componentRegistry) {
      const outputPath = path.join(buildDir, `${name}.js`);
      const compiledCode = await this.compileComponent(component);
      fs.writeFileSync(outputPath, compiledCode);
      
      // Générer le HTML statique pour les pages
      if (component.type === 'page') {
        const staticDir = path.join(buildDir, 'static');
        if (!fs.existsSync(staticDir)) {
          fs.mkdirSync(staticDir, { recursive: true });
        }
        
        const htmlPath = path.join(staticDir, `${name}.html`);
        const html = this.buildCSRPage(component);
        fs.writeFileSync(htmlPath, html);
      }
    }
    
    this.app.logger.log('success', 'Build React terminée', `📦 ${buildDir}`);
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    this.ssrCache.clear();
    this.buildCache.clear();
    this.componentRegistry.clear();
    this.hmrClients.clear();
    this.isEnabled = false;
  }
}

module.exports = ReactManager;
