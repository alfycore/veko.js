function cors(options = {}) {
  const opts = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: false,
    maxAge: 86400,
    optionsSuccessStatus: 204,
    preflightContinue: false,
    ...options
  };

  return (req, res, next) => {
    // Origine
    if (opts.origin) {
      if (typeof opts.origin === 'function') {
        const origin = opts.origin(req.get('origin'));
        if (origin) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      } else if (opts.origin === true) {
        res.setHeader('Access-Control-Allow-Origin', req.get('origin') || '*');
      } else {
        res.setHeader('Access-Control-Allow-Origin', opts.origin);
      }
    }

    // Credentials
    if (opts.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Exposed headers
    if (opts.exposedHeaders) {
      res.setHeader('Access-Control-Expose-Headers', opts.exposedHeaders);
    }

    // Preflight request
    if (req.method === 'OPTIONS') {
      // Methods
      if (opts.methods) {
        res.setHeader('Access-Control-Allow-Methods', opts.methods);
      }

      // Headers
      if (opts.allowedHeaders) {
        res.setHeader('Access-Control-Allow-Headers', opts.allowedHeaders);
      } else {
        const requestHeaders = req.get('Access-Control-Request-Headers');
        if (requestHeaders) {
          res.setHeader('Access-Control-Allow-Headers', requestHeaders);
        }
      }

      // Max age
      if (opts.maxAge) {
        res.setHeader('Access-Control-Max-Age', opts.maxAge);
      }

      if (opts.preflightContinue) {
        return next();
      }

      res.status(opts.optionsSuccessStatus).end();
      return;
    }

    next();
  };
}

module.exports = cors;