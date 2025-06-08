const { RateLimiter } = require('../utils/security');

function rateLimit(options = {}) {
  const opts = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests',
    statusCode: 429,
    headers: true,
    keyGenerator: (req) => req.ip,
    skip: () => false,
    onLimitReached: () => {},
    ...options
  };

  const limiter = new RateLimiter(opts.max, opts.windowMs);

  return (req, res, next) => {
    if (opts.skip(req, res)) {
      return next();
    }

    const key = opts.keyGenerator(req);
    const allowed = limiter.isAllowed(key);

    if (opts.headers) {
      const remaining = limiter.getRemainingRequests(key);
      res.setHeader('X-RateLimit-Limit', opts.max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + opts.windowMs));
    }

    if (!allowed) {
      opts.onLimitReached(req, res);
      
      if (typeof opts.message === 'function') {
        return res.status(opts.statusCode).json({ error: opts.message(req, res) });
      }
      
      return res.status(opts.statusCode).json({ error: opts.message });
    }

    next();
  };
}

module.exports = rateLimit;