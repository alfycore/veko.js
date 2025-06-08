const { pathToRegexp } = require('./utils/path-to-regexp');

class Layer {
  constructor(path, method, handler) {
    this.path = path;
    this.method = method;
    this.handler = handler;
    this.keys = [];
    this.regexp = pathToRegexp(path, this.keys);
  }

  match(path, method) {
    if (this.method !== 'ALL' && this.method !== method) {
      return false;
    }
    return this.regexp.test(path);
  }

  extractParams(path) {
    const matches = this.regexp.exec(path);
    if (!matches) return {};
    
    const params = {};
    this.keys.forEach((key, index) => {
      params[key.name] = decodeURIComponent(matches[index + 1] || '');
    });
    return params;
  }
}

class Router {
  constructor() {
    this.stack = [];
    this.params = new Map();
  }

  get(path, ...handlers) {
    this.addRoute('GET', path, handlers);
    return this;
  }

  post(path, ...handlers) {
    this.addRoute('POST', path, handlers);
    return this;
  }

  put(path, ...handlers) {
    this.addRoute('PUT', path, handlers);
    return this;
  }

  delete(path, ...handlers) {
    this.addRoute('DELETE', path, handlers);
    return this;
  }

  patch(path, ...handlers) {
    this.addRoute('PATCH', path, handlers);
    return this;
  }

  options(path, ...handlers) {
    this.addRoute('OPTIONS', path, handlers);
    return this;
  }

  head(path, ...handlers) {
    this.addRoute('HEAD', path, handlers);
    return this;
  }

  all(path, ...handlers) {
    this.addRoute('ALL', path, handlers);
    return this;
  }

  param(name, handler) {
    this.params.set(name, handler);
    return this;
  }

  use(path, router) {
    if (typeof path === 'object' && path.stack) {
      router = path;
      path = '/';
    }

    if (router && router.stack) {
      router.stack.forEach(layer => {
        const newPath = path === '/' ? layer.path : path + layer.path;
        this.stack.push(new Layer(newPath, layer.method, layer.handler));
      });
    }
    return this;
  }

  addRoute(method, path, handlers) {
    handlers.forEach(handler => {
      this.stack.push(new Layer(path, method, handler));
    });
  }

  handle(req, res, done) {
    let index = 0;
    const stack = this.stack;

    console.log(`🔍 Router handling: ${req.method} ${req.path}`);
    console.log(`📚 Available routes: ${stack.length}`);
    stack.forEach((layer, i) => {
      console.log(`  ${i}: ${layer.method} ${layer.path}`);
    });

    const next = (error) => {
      if (error) {
        return done(error);
      }

      if (index >= stack.length) {
        console.log('❌ No more routes to try');
        return done();
      }

      const layer = stack[index++];
      console.log(`🧪 Testing route ${index-1}: ${layer.method} ${layer.path}`);
      
      if (!layer.match(req.path, req.method)) {
        console.log(`❌ Route doesn't match`);
        return next();
      }

      console.log(`✅ Route matched!`);
      req.params = { ...req.params, ...layer.extractParams(req.path) };

      this.processParams(req, res, layer, () => {
        try {
          layer.handler(req, res, next);
        } catch (err) {
          next(err);
        }
      });
    };

    next();
  }

  processParams(req, res, layer, callback) {
    const keys = layer.keys;
    let index = 0;

    const processParam = () => {
      if (index >= keys.length) {
        return callback();
      }

      const key = keys[index++];
      const paramHandler = this.params.get(key.name);

      if (!paramHandler) {
        return processParam();
      }

      try {
        paramHandler(req, res, processParam, req.params[key.name], key.name);
      } catch (err) {
        callback(err);
      }
    };

    processParam();
  }
}

module.exports = Router;