/**
 * VekoJS - Zero Dependencies Framework
 * Pure Node.js HTTP Server with VSV support
 */

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const url = require('url');
const { EventEmitter } = require('events');
const crypto = require('crypto');

/**
 * Simple Logger (no dependencies)
 */
class Logger {
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.verbose = options.verbose || false;
  }

  log(type, message, details = '') {
    if (this.silent) return;
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    const color = colors[type] || colors.info;
    const symbol = { info: 'ℹ', success: '✓', warning: '⚠', error: '✗' }[type] || '●';
    console.log(`${color}${symbol} ${message}${details ? ` ${details}` : ''}${colors.reset}`);
  }
}

/**
 * Simple Rate Limiter (no dependencies)
 */
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000;
    this.max = options.max || 100;
    this.message = options.message || 'Too many requests';
    this.requests = new Map();
  }

  check(ip) {
    const now = Date.now();
    const record = this.requests.get(ip);
    
    if (!record || now - record.start > this.windowMs) {
      this.requests.set(ip, { start: now, count: 1 });
      return true;
    }
    
    if (record.count >= this.max) {
      return false;
    }
    
    record.count++;
    return true;
  }

  middleware() {
    return (req, res, next) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      if (!this.check(ip)) {
        res.statusCode = 429;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: this.message }));
        return;
      }
      next();
    };
  }
}

/**
 * Request/Response Helpers
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      try {
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          resolve(JSON.parse(body || '{}'));
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          resolve(Object.fromEntries(new URLSearchParams(body)));
        } else {
          resolve(body);
        }
      } catch (e) {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    cookies[name] = rest.join('=');
  });
  return cookies;
}

/**
 * Static File Server
 */
const MIME_TYPES = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.vsv': 'text/html',
  '.jsv': 'text/html'
};

function serveStatic(staticDir, maxAge = 0) {
  const root = path.resolve(process.cwd(), staticDir);
  
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const urlPath = decodeURIComponent(url.parse(req.url).pathname);
    
    // Prevent directory traversal
    if (urlPath.includes('..') || urlPath.includes('\0')) {
      return next();
    }

    const filePath = path.join(root, urlPath);
    
    // Make sure we're still in the static directory
    if (!filePath.startsWith(root)) {
      return next();
    }

    try {
      const stat = await fs.promises.stat(filePath);
      
      if (stat.isDirectory()) {
        // Try index.html
        const indexPath = path.join(filePath, 'index.html');
        try {
          await fs.promises.access(indexPath);
          return serveFile(res, indexPath, maxAge);
        } catch {
          return next();
        }
      }
      
      return serveFile(res, filePath, maxAge);
    } catch {
      return next();
    }
  };
}

async function serveFile(res, filePath, maxAge = 0) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  
  const stat = await fs.promises.stat(filePath);
  
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Cache-Control', maxAge > 0 ? `public, max-age=${maxAge}` : 'no-cache');
  
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

/**
 * Router
 */
class Router {
  constructor() {
    this.routes = [];
    this.middlewares = [];
  }

  use(pathOrFn, fn) {
    if (typeof pathOrFn === 'function') {
      this.middlewares.push({ path: '/', handler: pathOrFn });
    } else {
      this.middlewares.push({ path: pathOrFn, handler: fn });
    }
  }

  add(method, path, ...handlers) {
    const pattern = this.pathToRegex(path);
    this.routes.push({ method: method.toUpperCase(), path, pattern, handlers });
  }

  get(path, ...handlers) { this.add('GET', path, ...handlers); }
  post(path, ...handlers) { this.add('POST', path, ...handlers); }
  put(path, ...handlers) { this.add('PUT', path, ...handlers); }
  delete(path, ...handlers) { this.add('DELETE', path, ...handlers); }
  patch(path, ...handlers) { this.add('PATCH', path, ...handlers); }
  all(path, ...handlers) { this.add('ALL', path, ...handlers); }

  pathToRegex(path) {
    if (path instanceof RegExp) return { regex: path, keys: [] };
    
    const keys = [];
    const pattern = path
      .replace(/\*/g, '.*')
      .replace(/:(\w+)/g, (_, key) => {
        keys.push(key);
        return '([^/]+)';
      });
    
    return { regex: new RegExp(`^${pattern}/?$`), keys };
  }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== 'ALL' && route.method !== method) continue;
      
      const match = pathname.match(route.pattern.regex);
      if (match) {
        const params = {};
        route.pattern.keys.forEach((key, i) => {
          params[key] = match[i + 1];
        });
        return { route, params };
      }
    }
    return null;
  }
}

/**
 * Main App Class
 */
class App extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 3000,
      host: options.host || '0.0.0.0',
      staticDir: options.staticDir || 'public',
      viewsDir: options.viewsDir || 'views',
      isDev: options.isDev || process.env.NODE_ENV !== 'production',
      ...options
    };
    
    this.router = new Router();
    this.logger = new Logger({ verbose: this.options.isDev });
    this.server = null;
    this.vsv = null;
    
    // Rate limiter
    if (options.rateLimit !== false) {
      this.rateLimiter = new RateLimiter(options.rateLimit || {});
      this.use(this.rateLimiter.middleware());
    }
    
    // Static files
    if (this.options.staticDir) {
      this.use(serveStatic(this.options.staticDir, this.options.isDev ? 0 : 86400));
    }
  }

  // Middleware
  use(pathOrFn, fn) {
    this.router.use(pathOrFn, fn);
    return this;
  }

  // Routes
  get(path, ...handlers) { this.router.get(path, ...handlers); return this; }
  post(path, ...handlers) { this.router.post(path, ...handlers); return this; }
  put(path, ...handlers) { this.router.put(path, ...handlers); return this; }
  delete(path, ...handlers) { this.router.delete(path, ...handlers); return this; }
  patch(path, ...handlers) { this.router.patch(path, ...handlers); return this; }
  all(path, ...handlers) { this.router.all(path, ...handlers); return this; }

  // Request handler
  async handleRequest(req, res) {
    const startTime = Date.now();
    
    // Parse URL
    const parsedUrl = url.parse(req.url, true);
    req.pathname = parsedUrl.pathname;
    req.query = parsedUrl.query;
    req.cookies = parseCookies(req.headers.cookie);
    
    // Enhanced response methods
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };
    
    res.html = (html) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    };
    
    res.send = (data) => {
      if (typeof data === 'object') {
        res.json(data);
      } else {
        res.setHeader('Content-Type', 'text/plain');
        res.end(String(data));
      }
    };
    
    res.redirect = (location, statusCode = 302) => {
      res.statusCode = statusCode;
      res.setHeader('Location', location);
      res.end();
    };
    
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    
    res.setCookie = (name, value, options = {}) => {
      let cookie = `${name}=${encodeURIComponent(value)}`;
      if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
      if (options.path) cookie += `; Path=${options.path}`;
      if (options.httpOnly) cookie += '; HttpOnly';
      if (options.secure) cookie += '; Secure';
      if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
      res.setHeader('Set-Cookie', cookie);
    };

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Parse body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      try {
        req.body = await parseBody(req);
      } catch (e) {
        res.statusCode = 400;
        res.json({ error: 'Invalid request body' });
        return;
      }
    }

    // Run middlewares
    let middlewareIndex = 0;
    const middlewares = this.router.middlewares;
    
    const runNext = async () => {
      if (middlewareIndex < middlewares.length) {
        const mw = middlewares[middlewareIndex++];
        if (req.pathname.startsWith(mw.path)) {
          await new Promise((resolve, reject) => {
            try {
              const result = mw.handler(req, res, (err) => {
                if (err) reject(err);
                else resolve();
              });
              if (result instanceof Promise) {
                result.then(resolve).catch(reject);
              }
            } catch (e) {
              reject(e);
            }
          });
          if (!res.writableEnded) {
            await runNext();
          }
        } else {
          await runNext();
        }
      }
    };

    try {
      await runNext();
      
      if (res.writableEnded) return;

      // Match route
      const match = this.router.match(req.method, req.pathname);
      
      if (match) {
        req.params = match.params;
        
        for (const handler of match.route.handlers) {
          if (res.writableEnded) break;
          await handler(req, res);
        }
      } else {
        // 404
        res.statusCode = 404;
        res.html(`<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;">
  <div style="text-align: center;">
    <h1 style="font-size: 72px; margin: 0; color: #333;">404</h1>
    <p style="color: #666;">Page not found</p>
  </div>
</body>
</html>`);
      }
    } catch (error) {
      this.handleError(error, req, res);
    }
    
    // Log request
    const duration = Date.now() - startTime;
    if (this.options.isDev) {
      const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
      console.log(`${statusColor}${req.method}\x1b[0m ${req.pathname} ${res.statusCode} ${duration}ms`);
    }
  }

  // Error handler
  handleError(error, req, res) {
    console.error('\x1b[31mError:\x1b[0m', error.message);
    if (this.options.isDev) {
      console.error(error.stack);
    }
    
    res.statusCode = 500;
    res.html(`<!DOCTYPE html>
<html>
<head>
  <title>500 - Server Error</title>
  <style>
    body { font-family: system-ui; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; margin: 0; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
    .container { max-width: 800px; padding: 40px; }
    h1 { color: #ff6b6b; margin-bottom: 20px; }
    .error-box { background: rgba(255,107,107,0.1); border: 1px solid #ff6b6b; border-radius: 8px; padding: 20px; }
    pre { background: #0d1117; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 14px; }
    .stack { color: #8b949e; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Server Error</h1>
    <div class="error-box">
      <strong>${this.escapeHtml(error.message)}</strong>
      ${this.options.isDev ? `<pre class="stack">${this.escapeHtml(error.stack)}</pre>` : ''}
    </div>
  </div>
</body>
</html>`);
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // VSV Support
  async enableVSV(options = {}) {
    const VSV = require('./vsv');
    this.vsv = new VSV(this, options);
    await this.vsv.init();
    return this;
  }

  isVSVEnabled() {
    return this.vsv !== null;
  }

  vsvRoute(routePath, component, options = {}) {
    if (!this.isVSVEnabled()) {
      throw new Error('VSV not enabled. Call enableVSV() first.');
    }

    this.get(routePath, async (req, res) => {
      const props = {
        ...options.props,
        params: req.params,
        query: req.query,
        path: req.pathname
      };

      if (options.getProps) {
        const fetchedProps = await options.getProps(req);
        Object.assign(props, fetchedProps);
      }

      const html = await this.vsv.renderPage(component, props, {
        title: options.title || component,
        seo: options.seo,
        ...options
      });

      res.html(html);
    });

    return this;
  }

  async renderVSV(component, props = {}, options = {}) {
    if (!this.isVSVEnabled()) {
      throw new Error('VSV not enabled. Call enableVSV() first.');
    }
    return this.vsv.render(component, props, options);
  }

  // Listen
  listen(port, callback) {
    const finalPort = port || this.options.port;
    
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(finalPort, this.options.host, () => {
      this.logger.log('success', `Server running at http://localhost:${finalPort}`);
      if (callback) callback();
      this.emit('listening', finalPort);
    });

    return this.server;
  }

  // Close
  close() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = App;
