# Authentification - Veko.js

Voir la documentation complete : [docs/auth.md](docs/auth.md)

## Quick Start

```javascript
const crypto = require('crypto');

// JWT simple, zero dependance
function signJWT(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}

// Middleware auth
app.use('/api', (req, res, next) => {
  const token = req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ error: 'Non autorise' }); return; }
  // verify token...
  next();
});
```
