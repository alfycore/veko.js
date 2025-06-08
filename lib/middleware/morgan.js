const { logger } = require('../utils/logger'); // Correction du chemin

function morgan(format = 'combined', options = {}) {
  const opts = {
    skip: () => false,
    ...options
  };

  return (req, res, next) => {
    if (opts.skip(req, res)) {
      return next();
    }

    const startTime = Date.now();
    
    // Intercepter la fin de la réponse
    const originalEnd = res.end;
    res.end = function(...args) {
      const responseTime = Date.now() - startTime;
      
      // Loguer la requête avec le nouveau système
      logger.request(req, res, responseTime);
      
      // Appeler la méthode originale
      originalEnd.apply(this, args);
    };

    next();
  };
}

module.exports = morgan;