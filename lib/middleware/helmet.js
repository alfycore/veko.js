function helmet(options = {}) {
  const opts = {
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: true,
    frameguard: true,
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: false,
    permittedCrossDomainPolicies: false,
    referrerPolicy: true,
    xssFilter: true,
    ...options
  };

  return (req, res, next) => {
    // Content Security Policy
    if (opts.contentSecurityPolicy) {
      const csp = opts.contentSecurityPolicy === true ? 
        "default-src 'self'" : opts.contentSecurityPolicy;
      res.setHeader('Content-Security-Policy', csp);
    }

    // DNS Prefetch Control
    if (opts.dnsPrefetchControl) {
      res.setHeader('X-DNS-Prefetch-Control', 'off');
    }

    // Frameguard
    if (opts.frameguard) {
      const frameOptions = opts.frameguard === true ? 'DENY' : opts.frameguard;
      res.setHeader('X-Frame-Options', frameOptions);
    }

    // Hide Powered By
    if (opts.hidePoweredBy) {
      res.removeHeader('X-Powered-By');
    }

    // HTTP Strict Transport Security
    if (opts.hsts) {
      const hstsValue = opts.hsts === true ? 
        'max-age=31536000; includeSubDomains' : opts.hsts;
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // IE No Open
    if (opts.ieNoOpen) {
      res.setHeader('X-Download-Options', 'noopen');
    }

    // No Sniff
    if (opts.noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // Referrer Policy
    if (opts.referrerPolicy) {
      const policy = opts.referrerPolicy === true ? 
        'no-referrer' : opts.referrerPolicy;
      res.setHeader('Referrer-Policy', policy);
    }

    // XSS Filter
    if (opts.xssFilter) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Cross Origin Embedder Policy
    if (opts.crossOriginEmbedderPolicy) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    // Cross Origin Opener Policy
    if (opts.crossOriginOpenerPolicy) {
      const policy = opts.crossOriginOpenerPolicy === true ? 
        'same-origin' : opts.crossOriginOpenerPolicy;
      res.setHeader('Cross-Origin-Opener-Policy', policy);
    }

    // Cross Origin Resource Policy
    if (opts.crossOriginResourcePolicy) {
      const policy = opts.crossOriginResourcePolicy === true ? 
        'same-origin' : opts.crossOriginResourcePolicy;
      res.setHeader('Cross-Origin-Resource-Policy', policy);
    }

    next();
  };
}

module.exports = helmet;