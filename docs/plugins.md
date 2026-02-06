# Plugins - Veko.js

Veko.js utilise un systeme de plugins base sur les middleware et les événements natifs de Node.js.

## Creer un Plugin

Un plugin Veko.js est simplement un module qui recoit l instance de l app et l etend :

```javascript
// plugins/analytics.js
module.exports = function analyticsPlugin(app, options = {}) {
  const endpoint = options.endpoint || '/analytics';

  // Ajouter un middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[Analytics] ${req.method} ${req.pathname} ${Date.now() - start}ms`);
    });
    next();
  });

  // Ajouter des routes
  app.get(endpoint, (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  return {
    name: 'analytics',
    version: '1.0.0'
  };
};
```

## Utiliser un Plugin

```javascript
const { createApp } = require('veko');
const analyticsPlugin = require('./plugins/analytics');

const app = createApp({ port: 3000 });

// Charger le plugin
analyticsPlugin(app, { endpoint: '/stats' });

app.listen();
```

## Exemples de Plugins

### Plugin Logger Avance

```javascript
module.exports = function loggerPlugin(app) {
  app.use((req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const color = status >= 400 ? '\x1b[31m' : '\x1b[32m';
      console.log(`${timestamp} ${color}${status}\x1b[0m ${req.method} ${req.pathname} ${duration}ms`);
    });

    next();
  });
};
```

### Plugin CORS

```javascript
module.exports = function corsPlugin(app, options = {}) {
  const origin = options.origin || '*';
  const methods = options.methods || 'GET,POST,PUT,DELETE,PATCH';
  const headers = options.headers || 'Content-Type,Authorization';

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', headers);

    if (options.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    next();
  });
};
```

### Plugin Cache

```javascript
module.exports = function cachePlugin(app, options = {}) {
  const cache = new Map();
  const maxAge = options.maxAge || 60000; // 1 minute

  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = req.pathname + JSON.stringify(req.query);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.time < maxAge) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Content-Type', cached.contentType);
      res.end(cached.body);
      return;
    }

    // Intercepter la reponse
    const originalEnd = res.end.bind(res);
    res.end = (body) => {
      cache.set(key, {
        body,
        contentType: res.getHeader('Content-Type') || 'text/html',
        time: Date.now()
      });
      res.setHeader('X-Cache', 'MISS');
      originalEnd(body);
    };

    next();
  });

  // Nettoyage periodique
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of cache) {
      if (now - val.time > maxAge) cache.delete(key);
    }
  }, maxAge);
};
```

### Plugin Auth JWT Basique

```javascript
const crypto = require('crypto');

module.exports = function authPlugin(app, options = {}) {
  const secret = options.secret || 'change-me';

  function sign(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  function verify(token) {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  }

  // Middleware d authentification
  function requireAuth() {
    return (req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token manquant' });
        return;
      }
      const payload = verify(auth.slice(7));
      if (!payload) {
        res.status(401).json({ error: 'Token invalide' });
        return;
      }
      req.user = payload;
      next();
    };
  }

  // Exposer les fonctions sur l app
  app.auth = { sign, verify, requireAuth };
};
```

Utilisation :

```javascript
const authPlugin = require('./plugins/auth');
authPlugin(app, { secret: process.env.JWT_SECRET });

// Route de login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  // Verifier les credentials...
  const token = app.auth.sign({ userId: 1, email });
  res.json({ token });
});

// Route protegee
app.get('/profile', app.auth.requireAuth(), (req, res) => {
  res.json({ user: req.user });
});
```

## Bonnes Pratiques

1. **Un plugin = une responsabilite** - Gardez les plugins focus
2. **Options par defaut** - Fournissez toujours des valeurs par defaut
3. **Zero dependances** - Privilegiez Node.js natif
4. **Retourner un objet** - Incluez `name` et `version` pour le debugging
5. **Nettoyage** - Si le plugin cree des timers, fournissez une methode `destroy()`

---

<p align="center">
  <a href="api.md">API Reference</a> |
  <a href="security.md">Securite</a>
</p>
