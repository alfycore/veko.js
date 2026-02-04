/**
 * VekoJS React Module
 * Point d'entrée pour le support React complet
 * @module veko/react
 */

'use strict';

const ReactManager = require('./react-manager');
const hooks = require('./hooks');

// Instance singleton du ReactManager
let reactManager = null;

/**
 * Initialise le support React pour une application Veko
 * @param {Object} app - Instance de l'application Veko
 * @param {Object} options - Options de configuration
 * @returns {ReactManager} Instance du gestionnaire React
 */
function initReact(app, options = {}) {
  if (!reactManager) {
    reactManager = new ReactManager(app, options);
  }
  return reactManager;
}

/**
 * Récupère l'instance du ReactManager
 * @returns {ReactManager|null}
 */
function getReactManager() {
  return reactManager;
}

/**
 * Middleware Express pour le support React
 * @param {Object} options - Options
 * @returns {Function} Middleware Express
 */
function reactMiddleware(options = {}) {
  return (req, res, next) => {
    // Ajouter les helpers React à la réponse
    res.renderReact = async (component, props = {}, renderOptions = {}) => {
      if (!reactManager) {
        throw new Error('React not initialized. Call initReact first.');
      }
      
      const mode = renderOptions.mode || 'hybrid';
      let html;
      
      switch (mode) {
        case 'ssr':
          html = await reactManager.renderSSR(component, props);
          break;
        case 'csr':
          html = await reactManager.renderCSR(component, props);
          break;
        case 'hybrid':
        default:
          html = await reactManager.renderHybrid(component, props, {
            layout: renderOptions.layout
          });
      }
      
      res.type('html').send(html);
    };
    
    // Streaming SSR
    res.streamReact = async (component, props = {}) => {
      if (!reactManager) {
        throw new Error('React not initialized. Call initReact first.');
      }
      
      await reactManager.renderStream(component, props, res);
    };
    
    next();
  };
}

/**
 * Configuration du build React pour production
 * @param {Object} options - Options de build
 * @returns {Object} Configuration
 */
function createBuildConfig(options = {}) {
  const {
    entry = './src/index.jsx',
    outdir = './dist',
    minify = true,
    sourcemap = false,
    target = ['es2020'],
    splitting = true,
    format = 'esm'
  } = options;
  
  return {
    entryPoints: [entry],
    bundle: true,
    outdir,
    minify,
    sourcemap,
    target,
    splitting,
    format,
    loader: {
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.ts': 'ts',
      '.css': 'css',
      '.png': 'file',
      '.jpg': 'file',
      '.svg': 'file',
      '.gif': 'file',
      '.woff': 'file',
      '.woff2': 'file'
    },
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    external: ['react', 'react-dom']
  };
}

/**
 * Helper pour créer une route React avec SSR
 * @param {string} path - Chemin de la route
 * @param {string|Function} component - Composant React
 * @param {Object} options - Options
 * @returns {Object} Configuration de route
 */
function createReactRoute(path, component, options = {}) {
  return {
    path,
    method: 'GET',
    handler: async (req, res) => {
      const props = {
        ...options.defaultProps,
        params: req.params,
        query: req.query,
        user: req.user
      };
      
      // Récupérer les données si getInitialProps est défini
      if (options.getInitialProps) {
        const initialProps = await options.getInitialProps({ req, res, params: req.params });
        Object.assign(props, initialProps);
      }
      
      res.renderReact(component, props, {
        mode: options.mode || 'hybrid',
        layout: options.layout
      });
    },
    ...options.routeOptions
  };
}

/**
 * Template HTML par défaut pour React
 * @param {Object} options - Options
 * @returns {string} HTML
 */
function defaultHtmlTemplate(options = {}) {
  const {
    title = 'Veko React App',
    description = '',
    content = '',
    scripts = [],
    styles = [],
    head = '',
    bodyAttrs = '',
    htmlAttrs = 'lang="fr"'
  } = options;
  
  return `<!DOCTYPE html>
<html ${htmlAttrs}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description}">
  <title>${title}</title>
  ${styles.map(s => `<link rel="stylesheet" href="${s}">`).join('\n  ')}
  ${head}
</head>
<body ${bodyAttrs}>
  <div id="root">${content}</div>
  ${scripts.map(s => `<script src="${s}"></script>`).join('\n  ')}
</body>
</html>`;
}

// Exports
module.exports = {
  // Manager
  ReactManager,
  initReact,
  getReactManager,
  
  // Middleware
  reactMiddleware,
  
  // Build
  createBuildConfig,
  
  // Routing
  createReactRoute,
  
  // Templates
  defaultHtmlTemplate,
  
  // Hooks (re-export pour faciliter l'import)
  hooks,
  
  // Constantes
  RENDER_MODES: {
    SSR: 'ssr',
    CSR: 'csr',
    HYBRID: 'hybrid',
    STREAMING: 'streaming'
  }
};
