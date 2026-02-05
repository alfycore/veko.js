# 🔐 Authentification - Guide Complet

Veko.js intègre un système d'authentification complet avec support JWT, sessions, et OAuth.

## Table des Matières

- [Introduction](#introduction)
- [Configuration de Base](#configuration-de-base)
- [Stratégies d'Authentification](#stratégies-dauthentification)
- [Routes Protégées](#routes-protégées)
- [OAuth Providers](#oauth-providers)
- [Gestion des Utilisateurs](#gestion-des-utilisateurs)
- [Tokens et Sessions](#tokens-et-sessions)
- [Middleware Personnalisé](#middleware-personnalisé)
- [Intégration React](#intégration-react)

---

## Introduction

Le système d'authentification de Veko.js supporte :

| Fonctionnalité | Description |
|----------------|-------------|
| **JWT** | JSON Web Tokens pour API stateless |
| **Sessions** | Sessions serveur avec Redis/Memory |
| **OAuth 2.0** | Google, GitHub, Facebook, Twitter |
| **Rôles** | Gestion des permissions par rôle |
| **2FA** | Authentification à deux facteurs |
| **Refresh Tokens** | Renouvellement automatique |

---

## Configuration de Base

### Activation Rapide

```javascript
const { createApp } = require('veko');

const app = createApp({ port: 3000 });

// Activer l'authentification
await app.enableAuth({
  strategy: 'jwt',
  secret: process.env.JWT_SECRET
});

app.listen();
```

### Configuration Complète

```javascript
await app.enableAuth({
  // Stratégie principale
  strategy: 'jwt',  // 'jwt' | 'session' | 'hybrid'
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '7d',              // Durée du token
    refreshExpiresIn: '30d',      // Durée du refresh token
    algorithm: 'HS256',           // Algorithme de signature
    issuer: 'veko-app',           // Émetteur
    audience: 'veko-users'        // Audience
  },
  
  // Session Configuration (si strategy: 'session')
  session: {
    secret: process.env.SESSION_SECRET,
    name: 'veko.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7 jours
    },
    store: 'redis'  // 'memory' | 'redis' | 'mongodb'
  },
  
  // Base de données utilisateurs
  database: {
    type: 'mongodb',  // 'mongodb' | 'postgresql' | 'mysql' | 'sqlite'
    uri: process.env.DATABASE_URL
  },
  
  // Modèle utilisateur
  userModel: {
    tableName: 'users',
    fields: {
      id: 'id',
      email: 'email',
      password: 'password',
      role: 'role'
    }
  },
  
  // Callbacks
  callbacks: {
    onLogin: async (user) => {
      console.log(`User ${user.email} logged in`);
    },
    onLogout: async (user) => {
      console.log(`User ${user.email} logged out`);
    },
    onRegister: async (user) => {
      await sendWelcomeEmail(user.email);
    }
  }
});
```

---

## Stratégies d'Authentification

### JWT (JSON Web Tokens)

Idéal pour les API REST et les applications mobiles.

```javascript
await app.enableAuth({
  strategy: 'jwt',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '1h',
    refreshExpiresIn: '7d'
  }
});

// Login - retourne un token
app.createRoute('POST', '/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const { token, refreshToken, user } = await app.auth.login(email, password);
    
    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Refresh token
app.createRoute('POST', '/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    const { token, newRefreshToken } = await app.auth.refresh(refreshToken);
    res.json({ token, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});
```

### Sessions

Pour les applications web traditionnelles.

```javascript
await app.enableAuth({
  strategy: 'session',
  session: {
    secret: process.env.SESSION_SECRET,
    store: 'redis',
    redis: {
      host: 'localhost',
      port: 6379
    }
  }
});

// Login avec session
app.createRoute('POST', '/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await app.auth.login(email, password);
    req.session.user = user;
    
    res.redirect('/dashboard');
  } catch (error) {
    res.render('login', { error: error.message });
  }
});

// Logout
app.createRoute('POST', '/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});
```

### Mode Hybride

JWT pour l'API + Sessions pour le web.

```javascript
await app.enableAuth({
  strategy: 'hybrid',
  jwt: { /* config JWT */ },
  session: { /* config Session */ }
});

// Route web (utilise session)
app.createRoute('GET', '/dashboard', app.requireAuth('session'), (req, res) => {
  res.render('dashboard', { user: req.session.user });
});

// Route API (utilise JWT)
app.createRoute('GET', '/api/profile', app.requireAuth('jwt'), (req, res) => {
  res.json({ user: req.user });
});
```

---

## Routes Protégées

### Protection Simple

```javascript
// Route nécessitant une authentification
app.createRoute('GET', '/profile', app.requireAuth(), (req, res) => {
  res.json({ user: req.user });
});
```

### Protection par Rôle

```javascript
// Admin uniquement
app.createRoute('GET', '/admin', app.requireRole('admin'), (req, res) => {
  res.render('admin/dashboard');
});

// Multiples rôles
app.createRoute('GET', '/manage', app.requireRole(['admin', 'manager']), (req, res) => {
  res.render('management');
});
```

### Protection par Permission

```javascript
// Permission spécifique
app.createRoute('DELETE', '/users/:id', 
  app.requirePermission('users:delete'), 
  async (req, res) => {
    await User.delete(req.params.id);
    res.json({ success: true });
  }
);
```

### Middleware Chaîné

```javascript
app.createRoute('POST', '/admin/users', 
  app.requireAuth(),
  app.requireRole('admin'),
  app.requirePermission('users:create'),
  async (req, res) => {
    const user = await User.create(req.body);
    res.json(user);
  }
);
```

---

## OAuth Providers

### Google

```javascript
await app.enableAuth({
  strategy: 'jwt',
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
      scope: ['profile', 'email']
    }
  }
});

// Routes OAuth sont créées automatiquement :
// GET /auth/google          - Initie le flow OAuth
// GET /auth/google/callback - Callback après auth
```

### GitHub

```javascript
await app.enableAuth({
  oauth: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: '/auth/github/callback',
      scope: ['user:email']
    }
  }
});
```

### Facebook

```javascript
await app.enableAuth({
  oauth: {
    facebook: {
      appId: process.env.FACEBOOK_APP_ID,
      appSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: '/auth/facebook/callback',
      scope: ['email', 'public_profile']
    }
  }
});
```

### Configuration Multi-Provider

```javascript
await app.enableAuth({
  strategy: 'jwt',
  jwt: { secret: process.env.JWT_SECRET },
  
  oauth: {
    google: { /* ... */ },
    github: { /* ... */ },
    facebook: { /* ... */ }
  },
  
  // Callback après OAuth réussi
  callbacks: {
    onOAuthSuccess: async (provider, profile, tokens) => {
      // Créer ou mettre à jour l'utilisateur
      let user = await User.findOne({ [`oauth.${provider}.id`]: profile.id });
      
      if (!user) {
        user = await User.create({
          email: profile.email,
          name: profile.displayName,
          oauth: {
            [provider]: {
              id: profile.id,
              accessToken: tokens.accessToken
            }
          }
        });
      }
      
      return user;
    }
  }
});
```

---

## Gestion des Utilisateurs

### Inscription

```javascript
app.createRoute('POST', '/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  try {
    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    
    // Créer l'utilisateur
    const user = await app.auth.register({
      email,
      password,
      name,
      role: 'user'
    });
    
    // Générer le token
    const { token } = await app.auth.generateTokens(user);
    
    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Mot de Passe Oublié

```javascript
// Demande de reset
app.createRoute('POST', '/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  try {
    const resetToken = await app.auth.createResetToken(email);
    
    // Envoyer l'email
    await sendEmail({
      to: email,
      subject: 'Réinitialisation de mot de passe',
      html: `
        <p>Cliquez sur le lien pour réinitialiser votre mot de passe :</p>
        <a href="${process.env.APP_URL}/reset-password?token=${resetToken}">
          Réinitialiser
        </a>
      `
    });
    
    res.json({ message: 'Email envoyé' });
  } catch (error) {
    // Ne pas révéler si l'email existe
    res.json({ message: 'Si cet email existe, un lien a été envoyé' });
  }
});

// Reset du mot de passe
app.createRoute('POST', '/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  try {
    await app.auth.resetPassword(token, newPassword);
    res.json({ message: 'Mot de passe mis à jour' });
  } catch (error) {
    res.status(400).json({ error: 'Token invalide ou expiré' });
  }
});
```

### Changement de Mot de Passe

```javascript
app.createRoute('POST', '/auth/change-password', 
  app.requireAuth(), 
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    try {
      await app.auth.changePassword(req.user.id, currentPassword, newPassword);
      res.json({ message: 'Mot de passe modifié' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);
```

---

## Tokens et Sessions

### Vérifier un Token

```javascript
// Manuellement
const payload = await app.auth.verifyToken(token);

// Dans un middleware
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    try {
      req.user = await app.auth.verifyToken(token);
    } catch (error) {
      // Token invalide, continuer sans user
    }
  }
  
  next();
});
```

### Révoquer un Token

```javascript
// Révoquer un token spécifique
await app.auth.revokeToken(token);

// Révoquer tous les tokens d'un utilisateur
await app.auth.revokeAllTokens(userId);
```

### Blacklist de Tokens

```javascript
await app.enableAuth({
  jwt: {
    secret: process.env.JWT_SECRET,
    blacklist: {
      enabled: true,
      store: 'redis'  // 'memory' | 'redis'
    }
  }
});
```

---

## Middleware Personnalisé

### Middleware d'Authentification Custom

```javascript
const customAuthMiddleware = async (req, res, next) => {
  // Vérifier le header API Key
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey) {
    const client = await ApiClient.findByKey(apiKey);
    if (client) {
      req.client = client;
      return next();
    }
  }
  
  // Fallback sur JWT
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    try {
      req.user = await app.auth.verifyToken(token);
      return next();
    } catch (error) {
      // Token invalide
    }
  }
  
  res.status(401).json({ error: 'Non autorisé' });
};

app.createRoute('GET', '/api/data', customAuthMiddleware, (req, res) => {
  res.json({ user: req.user, client: req.client });
});
```

### Middleware de Permissions

```javascript
const checkPermission = (permission) => {
  return async (req, res, next) => {
    const userPermissions = await Permission.findByUser(req.user.id);
    
    if (userPermissions.includes(permission) || userPermissions.includes('*')) {
      return next();
    }
    
    res.status(403).json({ error: 'Permission refusée' });
  };
};

app.createRoute('DELETE', '/users/:id', 
  app.requireAuth(),
  checkPermission('users:delete'),
  async (req, res) => {
    // ...
  }
);
```

---

## Intégration React

### Hook useAuth

```jsx
import { useAuth } from 'veko/react/hooks';

function LoginForm() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login({ email, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mot de passe"
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Connexion...' : 'Se connecter'}
      </button>
    </form>
  );
}
```

### Composant AuthGuard

```jsx
import { useAuth } from 'veko/react/hooks';
import { Navigate } from 'react-router-dom';

function AuthGuard({ children, role }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
}

// Utilisation
<AuthGuard role="admin">
  <AdminDashboard />
</AuthGuard>
```

### Provider d'Authentification

```jsx
import { VekoProvider } from 'veko/react/hooks';

function App() {
  return (
    <VekoProvider
      config={{
        apiUrl: '/api',
        authEndpoint: '/auth'
      }}
    >
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/dashboard" 
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            } 
          />
        </Routes>
      </Router>
    </VekoProvider>
  );
}
```

---

## Bonnes Pratiques de Sécurité

1. **Utilisez des secrets forts** : Minimum 256 bits pour JWT
2. **Tokens courts** : Préférez des tokens de courte durée + refresh tokens
3. **HTTPS obligatoire** : En production, toujours HTTPS
4. **Rate limiting** : Limitez les tentatives de connexion
5. **Hashage sécurisé** : bcrypt avec 12+ rounds
6. **Validation stricte** : Validez toutes les entrées
7. **Cookies sécurisés** : httpOnly, secure, sameSite
8. **Audit des connexions** : Loggez toutes les tentatives

```javascript
await app.enableAuth({
  security: {
    passwordMinLength: 12,
    passwordRequireSpecial: true,
    passwordRequireNumber: true,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000,  // 15 minutes
    auditLog: true
  }
});
```

---

<p align="center">
  <a href="react.md">← React SSR</a> •
  <a href="plugins.md">Plugins →</a>
</p>
