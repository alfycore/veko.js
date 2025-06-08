function json(options = {}) {
  const opts = {
    limit: '100kb',
    strict: true,
    type: 'application/json',
    ...options
  };

  return (req, res, next) => {
    const contentType = req.get('content-type') || '';
    
    if (!contentType.includes(opts.type)) {
      return next();
    }
    
    // Le body est déjà parsé dans l'application principale
    if (req.body && typeof req.body === 'object') {
      return next();
    }
    
    next();
  };
}

module.exports = json;