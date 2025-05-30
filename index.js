const App = require('./lib/app');

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
  }
};