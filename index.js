/**
 * VekoJS - Zero Dependencies Framework
 * @module veko
 * @version 1.2.25
 */

const App = require('./lib/app');

// Import VSV support
let VSVSupport = null;
let VekoPHP = null;
let VekoTailwind = null;
try {
  VSVSupport = require('./lib/vsv');
  VekoPHP = require('./lib/vsv/php');
  VekoTailwind = require('./lib/vsv').VekoTailwind;
} catch (error) {
  // VSV support error
}

// Export principal
module.exports = {
  App,
  
  // Create a new app
  createApp: (options = {}) => new App(options),
  
  // Start in development mode
  startDev: (options = {}) => {
    const app = new App({
      ...options,
      isDev: true
    });
    return app.listen(options.port || 3000);
  },
  
  // Start in production mode
  start: (options = {}) => {
    const app = new App({
      ...options,
      isDev: false
    });
    return app.listen(options.port || 3000);
  },
  
  // VSV Support
  VSV: VSVSupport,
  VekoPHP: VekoPHP,
  VekoTailwind: VekoTailwind,
  
  // Create a VSV app
  createVSVApp: async (options = {}) => {
    const app = new App(options);
    await app.enableVSV(options.vsv || options);
    return app;
  },
  
  // Start a VSV app in development mode
  startVSVDev: async (options = {}) => {
    const app = new App({
      ...options,
      isDev: true
    });
    await app.enableVSV(options.vsv || options);
    return app.listen(options.port || 3000);
  }
};
