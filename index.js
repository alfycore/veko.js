/**
 * VekoJS - Ultra-modern Node.js framework
 * @module veko
 * @version 1.2.4
 */

const App = require('./lib/app');

// Import React support si disponible
let ReactSupport = null;
try {
  ReactSupport = require('./lib/react');
} catch (error) {
  // React support non installé
}

// Export principal
module.exports = {
  App,
  
  // Méthodes de création simplifiées
  createApp: (options = {}) => new App(options),
  
  // Démarrer en mode développement
  startDev: (options = {}) => {
    const app = new App({
      ...options,
      isDev: true
    });
    
    app.loadRoutes();
    return app.listen(options.port || 3000);
  },
  
  // Démarrer en mode production
  start: (options = {}) => {
    const app = new App({
      ...options,
      isDev: false
    });
    
    app.loadRoutes();
    return app.listen(options.port || 3000);
  },
  
  // Support React
  React: ReactSupport,
  
  // Créer une app React SSR
  createReactApp: async (options = {}) => {
    const app = new App({
      ...options,
      react: {
        enabled: true,
        ...options.react
      }
    });
    
    await app.enableReact(options.react);
    app.loadRoutes();
    return app;
  },
  
  // Démarrer une app React en mode développement
  startReactDev: async (options = {}) => {
    const app = new App({
      ...options,
      isDev: true,
      react: {
        enabled: true,
        hmr: true,
        ...options.react
      }
    });
    
    await app.enableReact(options.react);
    app.loadRoutes();
    return app.listen(options.port || 3000);
  }
};
