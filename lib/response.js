const fs = require('fs');
const path = require('path');

class Response {
  constructor(res, app) {
    this.res = res;
    this.app = app;
    this.locals = {};
  }

  // Delegate all unknown properties/methods to the original res
  get headersSent() { return this.res.headersSent; }
  get finished() { return this.res.finished; }
  get destroyed() { return this.res.destroyed; }

  status(code) {
    this.res.statusCode = code;
    return this;
  }

  json(obj) {
    this.res.setHeader('Content-Type', 'application/json');
    this.res.end(JSON.stringify(obj));
    return this;
  }

  send(body) {
    if (typeof body === 'object' && body !== null) {
      return this.json(body);
    }
    if (typeof body === 'number') {
      this.status(body);
      body = String(body);
    }
    if (!this.res.getHeader('Content-Type')) {
      this.res.setHeader('Content-Type', 'text/html');
    }
    this.res.end(body);
    return this;
  }

  cookie(name, value, options = {}) {
    const cookie = require('./utils/cookie-parser').serializeCookie(name, value, options);
    const existing = this.res.getHeader('Set-Cookie') || [];
    const cookies = Array.isArray(existing) ? existing : [existing];
    cookies.push(cookie);
    this.res.setHeader('Set-Cookie', cookies);
    return this;
  }

  clearCookie(name, options = {}) {
    return this.cookie(name, '', {
      ...options,
      expires: new Date(1),
      maxAge: 0
    });
  }

  redirect(url, status = 302) {
    this.status(status);
    this.set('Location', url);
    this.end();
    return this;
  }

  // Méthode render pour les templates
  render(view, data = {}, callback) {
    if (typeof data === 'function') {
      callback = data;
      data = {};
    }

    try {
      // Utiliser le moteur de rendu de l'application
      const html = this.app.render(view, data);
      
      this.setHeader('Content-Type', 'text/html; charset=utf-8');
      
      if (callback) {
        callback(null, html);
        this.send(html);
      } else {
        this.send(html);
      }
    } catch (error) {
      if (callback) {
        callback(error);
      } else {
        // Utiliser la gestion d'erreur de l'application
        this.status(500);
        const errorPage = this.app.generateErrorPage(error, this.req, 500);
        this.setHeader('Content-Type', 'text/html; charset=utf-8');
        this.send(errorPage);
      }
    }
  }

  createBasicTemplate(view, data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title || 'Veko App'}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 2rem; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { color: #333; }
        .data { background: #f5f5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
        pre { background: #2d3748; color: #e2e8f0; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${data.title || view}</h1>
        <p>${data.message || 'Template rendu par Veko.js'}</p>
        <div class="data">
            <h3>Données:</h3>
            <pre>${JSON.stringify(data, null, 2)}</pre>
        </div>
    </div>
</body>
</html>`;
  }

  sendFile(filePath, options = {}) {
    const fs = require('fs');
    const path = require('path');
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          return reject(err);
        }
        if (!this.res.getHeader('Content-Type')) {
          const { getMimeType } = require('./utils/mime-types');
          const contentType = getMimeType(path.extname(filePath));
          this.res.setHeader('Content-Type', contentType);
        }
        this.res.end(data);
        resolve();
      });
    });
  }

  type(type) {
    const { getMimeType } = require('./utils/mime-types');
    const contentType = type.includes('/') ? type : getMimeType(`.${type}`);
    this.res.setHeader('Content-Type', contentType);
    return this;
  }

  get(field) {
    return this.res.getHeader(field);
  }

  set(field, value) {
    if (typeof field === 'object') {
      Object.keys(field).forEach(key => {
        this.res.setHeader(key, field[key]);
      });
    } else {
      this.res.setHeader(field, value);
    }
    return this;
  }

  // Proxy methods to maintain compatibility
  setHeader(name, value) {
    return this.res.setHeader(name, value);
  }

  getHeader(name) {
    return this.res.getHeader(name);
  }

  removeHeader(name) {
    return this.res.removeHeader(name);
  }

  write(chunk, encoding) {
    return this.res.write(chunk, encoding);
  }

  end(data, encoding) {
    return this.res.end(data, encoding);
  }
}

module.exports = Response;