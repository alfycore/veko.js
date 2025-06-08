const Application = require('./lib/application');
const Router = require('./lib/router');
const { Logger, logger, createLogger } = require('./lib/utils/logger');

function createApplication() {
  return new Application();
}

// Exports statiques
createApplication.Router = Router;
createApplication.static = require('./lib/static');
createApplication.json = require('./lib/middleware/json');
createApplication.urlencoded = require('./lib/middleware/urlencoded');
createApplication.cors = require('./lib/middleware/cors');
createApplication.helmet = require('./lib/middleware/helmet');
createApplication.compression = require('./lib/middleware/compression');
createApplication.rateLimit = require('./lib/middleware/rate-limit');
createApplication.morgan = require('./lib/middleware/morgan');

// Système de logs
createApplication.Logger = Logger;
createApplication.logger = logger;
createApplication.createLogger = createLogger;

// Page d'erreur personnalisée
createApplication.errorPage = function(error, req, statusCode = 500) {
  const app = new Application();
  return app.generateErrorPage(error, req, statusCode);
};

module.exports = createApplication;