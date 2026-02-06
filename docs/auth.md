# Authentification - Veko.js

Veko.js n inclut pas de systeme d authentification integre pour rester a zero dependances, mais fournit tous les outils necessaires pour implementer votre propre auth.

## Authentification par JWT

### Plugin JWT Zero Dependance

```javascript
// plugins/auth.js
const crypto = require('crypto');

module.exports = function authPlugin(app, options = {}) {
  const secret = options.secret || process.env.JWT_SECRET;
  const expiresIn = options.expiresIn || 7 * 24 * 60 * 60 * 1000; // 7 jours

  function sign(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
      ...payload,
      iat: Date.now(),
      exp: Date.now() + expiresIn
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret)
      .update(header + '.' + body).digest('base64url');
    return header + '.' + body + '.' + signature;
  }

  function verify(token) {
    try {
      const [header, body, sig] = token.split('.');
      const expected = crypto.createHmac('sha256', secret)
        .update(header + '.' + body).digest('base64url');
      if (sig !== expected) return null;

      const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
      if (payload.exp && payload.exp < Date.now()) return null;
      return payload;
    } catch (e) {
      return null;
    }
  }

  function requireAuth() {
    return (req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token manquant' });
        return;
      }
      const payload = verify(auth.slice(7));
      if (!payload) {
        res.status(401).json({ error: 'Token invalide ou expire' });
        return;
      }
      req.user = payload;
      next();
    };
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        res.status(403).json({ error: 'Acces interdit' });
        return;
      }
      next();
    };
  }

  app.auth = { sign, verify, requireAuth, requireRole };
};
```

### Utilisation

```javascript
const { createApp } = require('veko');
const authPlugin = require('./plugins/auth');

const app = createApp({ port: 3000 });
authPlugin(app, { secret: process.env.JWT_SECRET });

// Route de login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // Verifiez les credentials (votre logique)
  const user = await findUser(email);
  if (!user || !verifyPassword(password, user.hash)) {
    res.status(401).json({ error: 'Identifiants invalides' });
    return;
  }

  const token = app.auth.sign({ userId: user.id, email, role: user.role });
  res.json({ token, user: { id: user.id, email: user.email } });
});

// Route protegee
app.get('/api/profile', app.auth.requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

// Route avec role
app.get('/api/admin', app.auth.requireAuth(), app.auth.requireRole('admin'), (req, res) => {
  res.json({ admin: true });
});

app.listen();
```

## Authentification par Session (Cookie)

```javascript
const crypto = require('crypto');

module.exports = function sessionPlugin(app) {
  const sessions = new Map();

  function createSession(userId, data = {}) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionId, { userId, ...data, createdAt: Date.now() });
    return sessionId;
  }

  function getSession(sessionId) {
    return sessions.get(sessionId) || null;
  }

  function destroySession(sessionId) {
    sessions.delete(sessionId);
  }

  // Middleware - charge la session depuis le cookie
  app.use((req, res, next) => {
    const sessionId = req.cookies.session;
    if (sessionId) {
      req.session = getSession(sessionId);
    }
    next();
  });

  app.session = { create: createSession, get: getSession, destroy: destroySession };

  // Nettoyage des sessions expirees (24h)
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.createdAt > 24 * 60 * 60 * 1000) {
        sessions.delete(id);
      }
    }
  }, 60 * 60 * 1000);
};
```

### Utilisation Sessions

```javascript
const sessionPlugin = require('./plugins/session');
sessionPlugin(app);

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await findUser(email);

  if (!user || !verifyPassword(password, user.hash)) {
    res.status(401).json({ error: 'Erreur' });
    return;
  }

  const sessionId = app.session.create(user.id, { email: user.email });
  res.setCookie('session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 86400
  });

  res.json({ success: true });
});

app.get('/profile', (req, res) => {
  if (!req.session) {
    res.status(401).json({ error: 'Non connecte' });
    return;
  }
  res.json({ user: req.session });
});

app.post('/logout', (req, res) => {
  if (req.cookies.session) {
    app.session.destroy(req.cookies.session);
  }
  res.setCookie('session', '', { maxAge: 0 });
  res.json({ success: true });
});
```

## Hash de Mot de Passe

Avec Node.js natif (zero dependance) :

```javascript
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(derived));
}
```

## Protection des Routes VSV

```javascript
// Middleware sur les routes VSV
app.use('/dashboard', (req, res, next) => {
  const token = req.cookies.token;
  if (!token || !app.auth.verify(token)) {
    res.redirect('/login');
    return;
  }
  next();
});

app.vsvRoute('/dashboard', 'Dashboard', {
  getProps: async (req) => ({
    user: req.user
  })
});

app.vsvRoute('/login', 'Login', {
  title: 'Connexion'
});
```

## Bonnes Pratiques

1. **Ne jamais stocker les mots de passe en clair** - Utilisez `crypto.scrypt`
2. **Tokens secrets en variables d environnement** - `process.env.JWT_SECRET`
3. **HttpOnly cookies** - Empeche l acces JS aux tokens de session
4. **SameSite cookies** - Protege contre CSRF
5. **Rate limit sur /login** - Empeche le brute force
6. **Expiration des tokens** - Toujours definir un `exp`
7. **timingSafeEqual** - Evite les timing attacks sur la verification

---

<p align="center">
  <a href="api.md">API Reference</a> |
  <a href="security.md">Securite</a>
</p>
