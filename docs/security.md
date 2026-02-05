# 🔒 Sécurité - Guide Complet

Veko.js intègre de nombreuses fonctionnalités de sécurité par défaut. Ce guide détaille les meilleures pratiques.

## Table des Matières

- [Sécurité par Défaut](#sécurité-par-défaut)
- [Configuration Helmet](#configuration-helmet)
- [Rate Limiting](#rate-limiting)
- [Protection XSS](#protection-xss)
- [Validation des Entrées](#validation-des-entrées)
- [CORS](#cors)
- [CSRF Protection](#csrf-protection)
- [Authentification Sécurisée](#authentification-sécurisée)
- [Sécurité des Fichiers](#sécurité-des-fichiers)
- [Audit et Logging](#audit-et-logging)
- [Checklist Production](#checklist-production)

---

## Sécurité par Défaut

Veko.js active automatiquement plusieurs protections :

| Protection | Activée par défaut | Description |
|------------|-------------------|-------------|
| Helmet | ✅ Oui | Headers de sécurité HTTP |
| Rate Limiting | ✅ Oui | Protection contre les abus |
| XSS Protection | ✅ Oui | Filtrage des scripts |
| Path Traversal | ✅ Oui | Protection des chemins |
| Body Parser Limits | ✅ Oui | Limite de taille des requêtes |
| HTTPS Redirect | ⚠️ Production | Redirection vers HTTPS |

---

## Configuration Helmet

Helmet configure les headers HTTP de sécurité.

### Configuration par Défaut

```javascript
const app = createApp({
  security: {
    helmet: true  // Activé par défaut
  }
});
```

### Configuration Personnalisée

```javascript
const app = createApp({
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'", "https://cdn.example.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.example.com"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      originAgentCluster: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xssFilter: true
    }
  }
});
```

### Headers Générés

```http
Content-Security-Policy: default-src 'self'; script-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
```

---

## Rate Limiting

Protection contre les attaques par force brute et DDoS.

### Configuration Globale

```javascript
const app = createApp({
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 100,                   // 100 requêtes max
      message: 'Trop de requêtes, veuillez réessayer plus tard.',
      standardHeaders: true,
      legacyHeaders: false
    }
  }
});
```

### Rate Limiting par Route

```javascript
app.createRoute('POST', '/api/login', handler, {
  rateLimit: {
    windowMs: 60 * 1000,  // 1 minute
    max: 5,               // 5 tentatives max
    message: 'Trop de tentatives de connexion'
  }
});
```

### Rate Limiting Avancé

```javascript
const slowDown = require('express-slow-down');

// Ralentir les requêtes au lieu de les bloquer
app.use('/api/', slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,           // Commencer à ralentir après 50 requêtes
  delayMs: (hits) => hits * 100  // Ajouter 100ms par requête supplémentaire
}));
```

### Rate Limiting par IP

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

app.use(rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args)
  }),
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'];
  }
}));
```

---

## Protection XSS

### Sanitisation Automatique

Veko.js sanitise automatiquement les entrées utilisateur.

```javascript
// Le middleware de sécurité inclus
app.use((req, res, next) => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

### Échappement dans les Templates

```html
<!-- EJS - Échappé automatiquement -->
<p><%= userInput %></p>

<!-- Si vous devez afficher du HTML (dangereux) -->
<div><%- trustedHtml %></div>
```

### Validation avec DOMPurify

```javascript
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

app.createRoute('POST', '/api/content', (req, res) => {
  const cleanHtml = DOMPurify.sanitize(req.body.html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'title']
  });
  
  res.json({ html: cleanHtml });
});
```

---

## Validation des Entrées

### Validation avec express-validator

```javascript
const { body, param, query, validationResult } = require('express-validator');

const validateUser = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  
  body('password')
    .isLength({ min: 12 })
    .withMessage('Le mot de passe doit contenir au moins 12 caractères')
    .matches(/[A-Z]/)
    .withMessage('Le mot de passe doit contenir une majuscule')
    .matches(/[0-9]/)
    .withMessage('Le mot de passe doit contenir un chiffre')
    .matches(/[!@#$%^&*]/)
    .withMessage('Le mot de passe doit contenir un caractère spécial'),
  
  body('name')
    .trim()
    .escape()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nom entre 2 et 100 caractères')
];

app.createRoute('POST', '/api/users', validateUser, (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  // Créer l'utilisateur...
});
```

### Validation Personnalisée

```javascript
const validator = require('validator');

function validateInput(data, schema) {
  const errors = {};
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    if (rules.required && !value) {
      errors[field] = `${field} est requis`;
      continue;
    }
    
    if (value) {
      if (rules.type === 'email' && !validator.isEmail(value)) {
        errors[field] = 'Email invalide';
      }
      
      if (rules.type === 'url' && !validator.isURL(value)) {
        errors[field] = 'URL invalide';
      }
      
      if (rules.minLength && value.length < rules.minLength) {
        errors[field] = `Minimum ${rules.minLength} caractères`;
      }
      
      if (rules.maxLength && value.length > rules.maxLength) {
        errors[field] = `Maximum ${rules.maxLength} caractères`;
      }
      
      if (rules.pattern && !rules.pattern.test(value)) {
        errors[field] = rules.message || 'Format invalide';
      }
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}
```

---

## CORS

### Configuration CORS

```javascript
const app = createApp({
  security: {
    cors: {
      origin: ['https://example.com', 'https://app.example.com'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['X-Total-Count'],
      credentials: true,
      maxAge: 86400  // 24 heures
    }
  }
});
```

### CORS Dynamique

```javascript
const cors = require('cors');

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (apps mobiles, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true
}));
```

---

## CSRF Protection

### Configuration CSRF

```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: true }));

// Middleware pour ajouter le token aux réponses
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});
```

### Utilisation dans les Templates

```html
<form method="POST" action="/submit">
  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
  <button type="submit">Envoyer</button>
</form>
```

### CSRF pour les API (Double Submit Cookie)

```javascript
// Générer le token
app.createRoute('GET', '/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Vérifier dans les requêtes
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const headerToken = req.headers['x-csrf-token'];
    const cookieToken = req.cookies['csrf-token'];
    
    if (!headerToken || headerToken !== cookieToken) {
      return res.status(403).json({ error: 'Token CSRF invalide' });
    }
  }
  next();
});
```

---

## Authentification Sécurisée

### Hashage des Mots de Passe

```javascript
const bcrypt = require('bcryptjs');

// Hashage (12 rounds minimum)
const hashedPassword = await bcrypt.hash(password, 12);

// Vérification
const isValid = await bcrypt.compare(password, hashedPassword);
```

### Tokens JWT Sécurisés

```javascript
await app.enableAuth({
  jwt: {
    secret: process.env.JWT_SECRET,  // Min 256 bits
    expiresIn: '15m',                // Courte durée
    algorithm: 'HS256',
    
    // Options avancées
    issuer: 'my-app',
    audience: 'my-app-users',
    notBefore: 0
  }
});
```

### Protection Contre la Force Brute

```javascript
const loginAttempts = new Map();

app.createRoute('POST', '/login', async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;
  const key = `${ip}:${email}`;
  
  // Vérifier les tentatives
  const attempts = loginAttempts.get(key) || { count: 0, lockUntil: 0 };
  
  if (Date.now() < attempts.lockUntil) {
    const waitTime = Math.ceil((attempts.lockUntil - Date.now()) / 1000);
    return res.status(429).json({
      error: `Compte temporairement bloqué. Réessayez dans ${waitTime}s`
    });
  }
  
  try {
    const { token, user } = await app.auth.login(email, password);
    
    // Reset en cas de succès
    loginAttempts.delete(key);
    
    res.json({ token, user });
  } catch (error) {
    // Incrémenter les tentatives
    attempts.count++;
    
    if (attempts.count >= 5) {
      attempts.lockUntil = Date.now() + (15 * 60 * 1000);  // 15 min
      attempts.count = 0;
    }
    
    loginAttempts.set(key, attempts);
    
    res.status(401).json({ error: 'Identifiants invalides' });
  }
});
```

---

## Sécurité des Fichiers

### Upload Sécurisé

```javascript
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    // Nom aléatoire pour éviter les collisions
    const uniqueName = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Types MIME autorisés
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5MB max
    files: 5                     // 5 fichiers max
  }
});

app.createRoute('POST', '/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier' });
  }
  
  res.json({ 
    filename: req.file.filename,
    size: req.file.size
  });
});
```

### Protection Path Traversal

```javascript
// Veko.js protège automatiquement contre le path traversal

// Vérification manuelle
const safePath = (basePath, userPath) => {
  const resolved = path.resolve(basePath, userPath);
  
  if (!resolved.startsWith(path.resolve(basePath))) {
    throw new Error('Chemin invalide');
  }
  
  return resolved;
};

app.createRoute('GET', '/files/:filename', (req, res) => {
  try {
    const filePath = safePath('./uploads', req.params.filename);
    res.sendFile(filePath);
  } catch (error) {
    res.status(403).json({ error: 'Accès refusé' });
  }
});
```

---

## Audit et Logging

### Logger de Sécurité

```javascript
const securityLogger = {
  log(event, data) {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      ...data
    };
    
    console.log(JSON.stringify(entry));
    // Envoyer à un service de logging (Sentry, LogDNA, etc.)
  },
  
  loginAttempt(email, success, ip) {
    this.log('login_attempt', { email, success, ip });
  },
  
  accessDenied(userId, resource, ip) {
    this.log('access_denied', { userId, resource, ip });
  },
  
  suspiciousActivity(type, details, ip) {
    this.log('suspicious_activity', { type, details, ip });
  }
};

// Utilisation
app.createRoute('POST', '/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await app.auth.login(email, password);
    securityLogger.loginAttempt(email, true, req.ip);
    res.json(result);
  } catch (error) {
    securityLogger.loginAttempt(email, false, req.ip);
    res.status(401).json({ error: 'Échec de connexion' });
  }
});
```

---

## Checklist Production

### Avant le Déploiement

- [ ] **HTTPS activé** - Certificat SSL/TLS valide
- [ ] **Variables d'environnement** - Pas de secrets dans le code
- [ ] **JWT Secret** - Secret fort (256+ bits)
- [ ] **Rate Limiting** - Configuré et testé
- [ ] **CORS** - Origins strictement définies
- [ ] **Helmet** - Tous les headers activés
- [ ] **Validation** - Toutes les entrées validées
- [ ] **Logs** - Audit logging en place
- [ ] **Dépendances** - `npm audit` sans vulnérabilités
- [ ] **Erreurs** - Messages génériques en production

### Configuration Production

```javascript
const app = createApp({
  port: process.env.PORT || 3000,
  isDev: false,
  
  security: {
    helmet: {
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS.split(','),
      credentials: true
    }
  }
});

// Forcer HTTPS
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.hostname}${req.url}`);
  }
  next();
});

// Masquer les erreurs en production
app.use((err, req, res, next) => {
  console.error(err);  // Log complet
  
  res.status(err.status || 500).json({
    error: 'Une erreur est survenue'  // Message générique
  });
});
```

---

<p align="center">
  <a href="api.md">← API Reference</a> •
  <a href="deployment.md">Déploiement →</a>
</p>
