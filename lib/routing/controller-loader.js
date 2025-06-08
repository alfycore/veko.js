const fs = require('fs');
const path = require('path');
const { getRouteMetadata } = require('./decorators');

class ControllerLoader {
  constructor(app, routeManager) {
    this.app = app;
    this.routeManager = routeManager;
    this.controllers = new Map();
  }

  async loadControllers(controllersDir = './controllers') {
    const controllersPath = path.resolve(process.cwd(), controllersDir);
    
    if (!fs.existsSync(controllersPath)) {
      this.app.logger.log('warning', 'Controllers directory not found', controllersPath);
      return;
    }

    await this.scanDirectory(controllersPath);
    this.app.logger.log('success', 'Controllers loaded', `${this.controllers.size} found`);
  }

  async scanDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        await this.scanDirectory(filePath);
      } else if (this.isControllerFile(file)) {
        await this.loadController(filePath);
      }
    }
  }

  isControllerFile(filename) {
    return (filename.endsWith('.controller.js') || 
            filename.endsWith('.controller.ts')) && 
           !filename.startsWith('.');
  }

  async loadController(filePath) {
    try {
      // Support TypeScript
      if (filePath.endsWith('.ts') && !this.routeManager.tsSupport) {
        this.app.logger.log('warning', 'TypeScript file found but TS support disabled', filePath);
        return;
      }

      delete require.cache[require.resolve(filePath)];
      const controllerModule = require(filePath);
      
      // Support pour export default et named exports
      const ControllerClass = controllerModule.default || 
                             Object.values(controllerModule).find(exp => 
                               typeof exp === 'function' && exp.prototype
                             );

      if (!ControllerClass) {
        throw new Error('No controller class found in file');
      }

      // Créer une instance du contrôleur
      const controllerInstance = new ControllerClass();
      
      // Extraire les métadonnées de route
      const routes = getRouteMetadata(ControllerClass);
      
      // Enregistrer les routes
      for (const route of routes) {
        await this.routeManager.createAdvancedRoute({
          method: route.method,
          path: route.path,
          handler: route.handler.bind(controllerInstance),
          middleware: route.middleware,
          guards: route.guards,
          ...route.config
        });
      }

      this.controllers.set(filePath, {
        instance: controllerInstance,
        class: ControllerClass,
        routes: routes.length
      });

      this.app.logger.log('create', 'Controller loaded', 
        `${path.basename(filePath)} (${routes.length} routes)`);

    } catch (error) {
      this.app.logger.log('error', 'Failed to load controller', 
        `${filePath}: ${error.message}`);
    }
  }

  getControllers() {
    return Array.from(this.controllers.entries()).map(([path, controller]) => ({
      path,
      routes: controller.routes,
      className: controller.class.name
    }));
  }
}

module.exports = ControllerLoader;