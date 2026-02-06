# Securite - Veko.js

Guide des fonctionnalites de securite integrees a Veko.js. Tout est natif, zero dependances externes.

## En-tetes de Securite Automatiques

Veko.js ajoute automatiquement des en-tetes de securite a chaque reponse :

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
```

Ces en-tetes sont ajoutes dans `handleRequest()` avant tout traitement de route.

---

## Rate Limiting Integre

Protection contre les attaques par force brute et DDoS, sans aucune dependance.

### Activation

```javascript
const app = createApp({
  rateLimit: {
    windowMs: 15 * 60 * 1000,  // Fenetre de 15 minutes
    max: 100                    // Max 100 requetes par fenetre
  }
});
```

### Desactivation

```javascript
const app = createApp({
  rateLimit: false
});
```

### Fonctionnement

Le rate limiter utilise un Map en memoire avec nettoyage automatique :
- Cle : IP du client
- Compteur : nombre de requetes dans la fenetre
- Nettoyage toutes les `windowMs` millisecondes

Quand la limite est atteinte, le serveur repond :
```
HTTP 429 Too Many Requests
{ "error": "Too many requests" }
```

---

## Protection contre le Path Traversal

Le serveur de fichiers statiques protege contre les attaques de path traversal :

```javascript
// Bloque automatiquement :
// /../../../etc/passwd
// /..%2F..%2Fetc%2Fpasswd
// /%2e%2e/secret
```

La fonction `serveStatic` normalise les chemins avec `path.normalize()` et verifie que le chemin final reste dans le repertoire statique autorise.

---

## Middleware de Securite Personnalise

### Authentification par Token

```javascript
app.use('/api', (req, res, next) => {
  const token = req.headers.authorization;
  
  if (!token || !isValidToken(token)) {
    res.status(401).json({ error: 'Non autorise' });
    return;
  }
  
  req.user = decodeToken(token);
  next();
});
```

### CORS

```javascript
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://monsite.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  next();
});
```

### Content Security Policy

```javascript
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'"
  ].join('; '));
  next();
});
```

### HSTS

```javascript
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

---

## Validation des Entrees

### Body Parsing Securise

Veko.js parse automatiquement le body des requetes POST/PUT/PATCH avec gestion d erreurs :

```javascript
app.post('/api/data', (req, res) => {
  // req.body est deja parse (JSON ou form-data)
  // Si le body est invalide, une erreur 400 est renvoyee automatiquement
  
  const { name, email } = req.body;
  
  // Validez manuellement
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Nom invalide' });
    return;
  }
  
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Email invalide' });
    return;
  }
  
  res.json({ success: true });
});
```

### Echappement HTML

La methode `escapeHtml()` integree protege contre les injections XSS :

```javascript
// Utilise automatiquement dans les pages d erreur
// Echappe : & < > "
```

---

## Cookies Securises

```javascript
res.setCookie('session', token, {
  httpOnly: true,     // Pas accessible en JavaScript
  secure: true,       // HTTPS uniquement
  sameSite: 'Strict', // Protection CSRF
  maxAge: 86400,      // Expiration en secondes
  path: '/'           // Chemin du cookie
});
```

---

## Bonnes Pratiques

### 1. Variables d environnement

```javascript
const app = createApp({
  port: process.env.PORT || 3000,
  isDev: process.env.NODE_ENV !== 'production'
});

// Ne jamais hardcoder les secrets
const JWT_SECRET = process.env.JWT_SECRET;
```

### 2. Rate limiting specifique

```javascript
// Rate limit global
const app = createApp({
  rateLimit: { windowMs: 15 * 60 * 1000, max: 100 }
});

// Rate limit specifique sur login (middleware personnalise)
let loginAttempts = new Map();

app.use('/api/login', (req, res, next) => {
  const ip = req.socket.remoteAddress;
  const attempts = loginAttempts.get(ip) || 0;
  
  if (attempts >= 5) {
    res.status(429).json({ error: 'Trop de tentatives' });
    return;
  }
  
  loginAttempts.set(ip, attempts + 1);
  setTimeout(() => loginAttempts.delete(ip), 15 * 60 * 1000);
  next();
});
```

### 3. En production

```javascript
const app = createApp({
  isDev: false,
  rateLimit: { windowMs: 60000, max: 30 }
});

// En-tetes de securite supplementaires
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
```

---

## Resume des Protections

| Protection | Type | Status |
|-----------|------|--------|
| X-Content-Type-Options | En-tete | Automatique |
| X-Frame-Options | En-tete | Automatique |
| X-XSS-Protection | En-tete | Automatique |
| Rate Limiting | Middleware | Integre (configurable) |
| Path Traversal | Serveur statique | Automatique |
| Body Parsing | Middleware | Automatique (avec erreur 400) |
| HTML Escaping | Pages erreur | Automatique |
| CORS | Middleware | Manuel (exemple fourni) |
| CSP | Middleware | Manuel (exemple fourni) |
| HSTS | Middleware | Manuel (exemple fourni) |
| Cookie Security | API | Manuel (options disponibles) |

---

<p align="center">
  <a href="api.md">API Reference</a> |
  <a href="getting-started.md">Guide de Demarrage</a>
</p>
