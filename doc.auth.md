# 🔐 Système d'Authentification Veko.js

Le système d'authentification de Veko.js est intégré directement dans le core du framework et offre une solution complète et flexible pour gérer l'authentification des utilisateurs.

## Table des matières

- [Installation et Configuration](#installation-et-configuration)
- [Types de Configuration](#types-de-configuration)
- [Base de Données](#base-de-données)
- [Routes API](#routes-api)
- [Routes Web (EJS)](#routes-web-ejs)
- [Middlewares](#middlewares)
- [Vues Automatiques](#vues-automatiques)
- [Exemples Pratiques](#exemples-pratiques)
- [API Reference](#api-reference)

## Installation et Configuration

### Configuration de Base

```javascript
const { createApp } = require('veko.js');

const app = createApp();

// Activer l'authentification avec configuration par défaut
await app.enableAuth();
```

### Configuration Complète

```javascript
await app.enableAuth({
  database: {
    type: 'sqlite', // ou 'mysql'
    sqlite: {
      path: './data/users.db'
    },
    mysql: {
      host: 'localhost',
      port: 3306,
      database: 'my_app',
      username: 'root',
      password: 'password'
    }
  },
  session: {
    secret: 'votre-secret-super-securise',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    secure: false // true en production avec HTTPS
  },
  routes: {
    api: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      register: '/api/auth/register',
      check: '/api/auth/check',
      profile: '/api/auth/profile'
    },
    web: {
      enabled: true,
      login: '/auth/login',
      logout: '/auth/logout',
      register: '/auth/register',
      dashboard: '/auth/dashboard'
    }
  },
  redirects: {
    afterLogin: '/auth/dashboard',
    afterLogout: '/auth/login',
    loginRequired: '/auth/login'
  },
  password: {
    minLength: 8,
    requireSpecial: false,
    requireNumbers: true
  },
  views: {
    enabled: true,
    autoCreate: true
  }
});
```

## Types de Configuration

### 1. API Seulement

Pour les applications qui utilisent leurs propres interfaces utilisateur ou des frameworks frontend :

```javascript
await app.enableAuth({
  routes: {
    web: { enabled: false }
  },
  views: { enabled: false }
});
```

**Avantages :**
- Léger et performant
- Idéal pour les API REST
- Compatible avec React, Vue, Angular, etc.

### 2. Web Complet

Pour les applications traditionnelles avec rendu côté serveur :

```javascript
await app.enableAuth({
  routes: {
    web: { enabled: true }
  },
  views: { enabled: true }
});
```

**Avantages :**
- Interface utilisateur complète fournie
- Vues Bootstrap responsives
- Prêt à l'emploi

### 3. Mixte

Pour les applications hybrides :

```javascript
await app.enableAuth({
  routes: {
    web: { enabled: true }
  },
  views: { enabled: false } // Utiliser ses propres vues
});
```

## Base de Données

### SQLite (par défaut)

```javascript
database: {
  type: 'sqlite',
  sqlite: {
    path: './data/users.db'
  }
}
```

**Avantages :**
- Aucune configuration requise
- Idéal pour le développement
- Fichier unique portable

### MySQL

```javascript
database: {
  type: 'mysql',
  mysql: {
    host: 'localhost',
    port: 3306,
    database: 'my_app',
    username: 'root',
    password: 'password'
  }
}
```

**Avantages :**
- Performance en production
- Gestion avancée des utilisateurs
- Support des transactions

### Structure de la Table Users

```sql
-- SQLite
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MySQL
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Routes API

Les routes API sont **toujours activées** et fournissent une interface RESTful complète.

### POST /api/auth/login

Connecter un utilisateur.

**Requête :**
```json
{
  "username": "john_doe",
  "password": "motdepasse123"
}
```

**Réponse (succès) :**
```json
{
  "success": true,
  "message": "Connexion réussie",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Réponse (erreur) :**
```json
{
  "success": false,
  "message": "Nom d'utilisateur ou mot de passe incorrect"
}
```

### POST /api/auth/register

Créer un nouveau compte utilisateur.

**Requête :**
```json
{
  "username": "jane_doe",
  "email": "jane@example.com",
  "password": "motdepasse123",
  "confirmPassword": "motdepasse123"
}
```

**Réponse (succès) :**
```json
{
  "success": true,
  "message": "Inscription réussie",
  "user": {
    "id": 2,
    "username": "jane_doe",
    "email": "jane@example.com",
    "role": "user"
  }
}
```

### POST /api/auth/logout

Déconnecter l'utilisateur actuel.

**Réponse :**
```json
{
  "success": true,
  "message": "Déconnexion réussie"
}
```

### GET /api/auth/check

Vérifier l'état d'authentification.

**Réponse (connecté) :**
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Réponse (non connecté) :**
```json
{
  "authenticated": false,
  "user": null
}
```

### GET /api/auth/profile

Récupérer le profil de l'utilisateur connecté (authentification requise).

**Réponse :**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### PUT /api/auth/profile

Mettre à jour le profil de l'utilisateur connecté (authentification requise).

**Requête :**
```json
{
  "email": "newemail@example.com"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Profil mis à jour",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "newemail@example.com",
    "role": "user"
  }
}
```

## Routes Web (EJS)

Les routes web fournissent une interface utilisateur complète avec des vues EJS.

### GET /auth/login

Affiche la page de connexion.

### POST /auth/login

Traite le formulaire de connexion et redirige vers le dashboard.

### GET /auth/register

Affiche la page d'inscription.

### POST /auth/register

Traite le formulaire d'inscription et redirige vers le dashboard.

### GET /auth/logout

Déconnecte l'utilisateur et redirige vers la page de connexion.

### GET /auth/dashboard

Affiche le tableau de bord utilisateur (authentification requise).

## Middlewares

### Protection des Routes

```javascript
// Route protégée (authentification requise)
app.createRoute('get', '/profile', app.requireAuth(), (req, res) => {
  res.render('profile', {
    user: req.session.user
  });
});

// Route avec rôle spécifique
app.createRoute('get', '/admin', app.requireRole('admin'), (req, res) => {
  res.render('admin', {
    user: req.session.user
  });
});

// Middleware pour plusieurs routes
app.use('/admin/*', app.requireRole('admin'));
```

### Variables Globales

Les variables suivantes sont automatiquement disponibles dans toutes les vues EJS :

```javascript
// Dans vos templates EJS
<% if (isAuthenticated) { %>
  <p>Bonjour <%= user.username %> !</p>
  <a href="/auth/logout">Déconnexion</a>
<% } else { %>
  <a href="/auth/login">Connexion</a>
<% } %>
```

### API des Middlewares

```javascript
// Vérifier si l'utilisateur est connecté
if (app.auth.isAuthenticated(req)) {
  // L'utilisateur est connecté
}

// Récupérer l'utilisateur actuel
const user = app.auth.getCurrentUser(req);

// Déconnecter l'utilisateur
await app.auth.logout(req);
```

## Vues Automatiques

Le système crée automatiquement des vues Bootstrap responsives si `views.enabled` et `views.autoCreate` sont à `true`.

### Structure des Vues

```
views/
└── auth/
    ├── login.ejs
    ├── register.ejs
    └── dashboard.ejs
```

### Personnalisation des Vues

Vous pouvez créer vos propres vues en désactivant les vues automatiques :

```javascript
await app.enableAuth({
  views: { enabled: false }
});
```

Puis créer vos propres fichiers dans `views/auth/` :

```html
<!-- views/auth/login.ejs -->
<!DOCTYPE html>
<html>
<head>
    <title>Ma Page de Connexion</title>
</head>
<body>
    <h1>Connexion</h1>
    
    <% if (error) { %>
        <div class="error">
            <% if (error === 'invalid_credentials') { %>
                Identifiants incorrects
            <% } else { %>
                Une erreur est survenue
            <% } %>
        </div>
    <% } %>
    
    <form method="POST">
        <input type="text" name="username" placeholder="Nom d'utilisateur" required>
        <input type="password" name="password" placeholder="Mot de passe" required>
        <button type="submit">Se connecter</button>
    </form>
</body>
</html>
```

## Exemples Pratiques

### 1. Application API avec Frontend React

```javascript
// server.js
const { createApp } = require('veko.js');

async function startServer() {
  const app = createApp({ port: 3000 });

  // API seulement
  await app.enableAuth({
    routes: { web: { enabled: false } },
    views: { enabled: false },
    database: { type: 'sqlite' }
  });

  // Route publique
  app.createRoute('get', '/', (req, res) => {
    res.json({ message: 'API prête' });
  });

  // Route protégée
  app.createRoute('get', '/protected', app.requireAuth(), (req, res) => {
    res.json({
      message: 'Données protégées',
      user: req.session.user
    });
  });

  app.loadRoutes();
  app.listen(3000);
}

startServer();
```

```javascript
// Frontend React - Login.js
import React, { useState } from 'react';

function Login() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    const data = await response.json();
    
    if (data.success) {
      // Rediriger vers le dashboard
      window.location.href = '/dashboard';
    } else {
      alert(data.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Nom d'utilisateur"
        value={credentials.username}
        onChange={(e) => setCredentials({...credentials, username: e.target.value})}
      />
      <input
        type="password"
        placeholder="Mot de passe"
        value={credentials.password}
        onChange={(e) => setCredentials({...credentials, password: e.target.value})}
      />
      <button type="submit">Se connecter</button>
    </form>
  );
}
```

### 2. Application Web Traditionnelle

```javascript
// server.js
const { startDevFullAuth } = require('veko.js');

startDevFullAuth({
  port: 3000,
  auth: {
    database: {
      type: 'mysql',
      mysql: {
        host: 'localhost',
        database: 'my_blog',
        username: 'root',
        password: 'password'
      }
    },
    routes: {
      web: {
        login: '/connexion',
        register: '/inscription',
        dashboard: '/tableau-bord'
      }
    }
  }
}).then(() => {
  console.log('Blog démarré sur http://localhost:3000');
});
```

### 3. Application E-commerce

```javascript
// server.js
const { createApp } = require('veko.js');

async function startEcommerce() {
  const app = createApp({ port: 3000 });

  await app.enableAuth({
    database: { type: 'mysql' },
    password: {
      minLength: 8,
      requireNumbers: true,
      requireSpecial: true
    },
    redirects: {
      afterLogin: '/account',
      afterLogout: '/',
      loginRequired: '/login'
    }
  });

  // Page d'accueil publique
  app.createRoute('get', '/', (req, res) => {
    res.render('home', {
      title: 'Boutique en ligne',
      user: res.locals.user
    });
  });

  // Espace client (authentification requise)
  app.createRoute('get', '/account', app.requireAuth(), (req, res) => {
    res.render('account', {
      title: 'Mon compte',
      user: req.session.user
    });
  });

  // Administration (rôle admin requis)
  app.use('/admin/*', app.requireRole('admin'));
  
  app.createRoute('get', '/admin/dashboard', (req, res) => {
    res.render('admin/dashboard', {
      title: 'Administration',
      user: req.session.user
    });
  });

  app.loadRoutes();
  app.listen(3000);
}

startEcommerce();
```

### 4. Application avec Authentification Mixte

```javascript
// server.js
const { createApp } = require('veko.js');

async function startMixedApp() {
  const app = createApp({ port: 3000 });

  // Configuration mixte : API + Web avec vues personnalisées
  await app.enableAuth({
    routes: {
      web: { enabled: true }
    },
    views: { enabled: false }, // Utiliser nos propres vues
    database: { type: 'sqlite' }
  });

  // Les routes API sont disponibles pour l'app mobile
  // Les routes web sont disponibles pour l'interface web
  // Vues personnalisées dans views/auth/

  app.loadRoutes();
  app.listen(3000);
}

startMixedApp();
```

## API Reference

### Classe AuthManager

#### Méthodes

##### `async init(config)`
Initialise le système d'authentification.

##### `isAuthenticated(req)`
Vérifie si l'utilisateur est connecté.
- **Paramètres :** `req` - Objet request Express
- **Retour :** `boolean`

##### `getCurrentUser(req)`
Récupère l'utilisateur actuel.
- **Paramètres :** `req` - Objet request Express
- **Retour :** `Object|null`

##### `requireAuth()`
Middleware d'authentification.
- **Retour :** Middleware Express

##### `requireRole(role)`
Middleware de vérification de rôle.
- **Paramètres :** `role` - Rôle requis ('admin', 'user', etc.)
- **Retour :** Middleware Express

##### `async logout(req)`
Déconnecte l'utilisateur.
- **Paramètres :** `req` - Objet request Express
- **Retour :** `Promise<boolean>`

##### `toggleWebRoutes(enabled)`
Active/désactive les routes web.
- **Paramètres :** `enabled` - Boolean

##### `toggleAutoViews(enabled)`
Active/désactive les vues automatiques.
- **Paramètres :** `enabled` - Boolean

### Configuration par Défaut

```javascript
{
  database: {
    type: 'sqlite',
    sqlite: { path: './data/auth.db' },
    mysql: {
      host: 'localhost',
      port: 3306,
      database: 'veko_auth',
      username: 'root',
      password: ''
    }
  },
  session: {
    secret: 'veko-auth-secret-change-me',
    maxAge: 24 * 60 * 60 * 1000, // 24 heures
    secure: false
  },
  routes: {
    api: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      register: '/api/auth/register',
      check: '/api/auth/check',
      profile: '/api/auth/profile'
    },
    web: {
      enabled: true,
      login: '/auth/login',
      logout: '/auth/logout',
      register: '/auth/register',
      dashboard: '/auth/dashboard'
    }
  },
  redirects: {
    afterLogin: '/auth/dashboard',
    afterLogout: '/auth/login',
    loginRequired: '/auth/login'
  },
  password: {
    minLength: 6,
    requireSpecial: false,
    requireNumbers: false
  },
  views: {
    enabled: true,
    autoCreate: true
  }
}
```

## Sécurité

### Bonnes Pratiques

1. **Secret de session :** Utilisez toujours un secret fort et unique
```javascript
session: {
  secret: process.env.SESSION_SECRET || 'votre-secret-complexe'
}
```

2. **HTTPS en production :**
```javascript
session: {
  secure: process.env.NODE_ENV === 'production'
}
```

3. **Mots de passe sécurisés :**
```javascript
password: {
  minLength: 8,
  requireSpecial: true,
  requireNumbers: true
}
```

4. **Base de données sécurisée :**
```javascript
database: {
  type: 'mysql',
  mysql: {
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  }
}
```

### Hachage des Mots de Passe

Les mots de passe sont automatiquement hachés avec bcrypt avant stockage. Le système utilise un salt automatique pour chaque mot de passe.

### Protection CSRF

Pour les formulaires web, ajoutez une protection CSRF :

```javascript
const csrf = require('csurf');
app.use(csrf());

// Dans vos vues EJS
<form method="POST">
  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
  <!-- ... autres champs ... -->
</form>
```

## Dépannage

### Erreurs Communes

#### Base de données non accessible
```
❌ Erreur lors de l'initialisation de l'authentification: ENOENT: no such file or directory
```
**Solution :** Vérifiez le chemin de la base de données SQLite ou les paramètres MySQL.

#### Module manquant
```
📦 Installation de express-session...
```
**Normal :** Le système installe automatiquement les dépendances nécessaires.

#### Session non persistante
**Cause :** Secret de session changé ou configuration cookie incorrecte.
**Solution :** Utilisez un secret fixe et vérifiez la configuration des cookies.

### Debug Mode

Activez le mode debug pour plus d'informations :

```javascript
const app = createApp({ isDev: true });
```

## Migration et Mise à Jour

### Depuis une version précédente

Si vous migrez depuis une version antérieure, les anciennes configurations restent compatibles :

```javascript
// Ancienne syntaxe (toujours supportée)
await app.enableAuth({
  routes: { web: { enabled: false } },
  views: { enabled: false }
});

// Nouvelle syntaxe équivalente
await app.enableAuth({
  routes: { web: { enabled: false } },
  views: { enabled: false }
});
```

### Backup de la base de données

Avant toute mise à jour, sauvegardez votre base de données :

```bash
# SQLite
cp ./data/auth.db ./data/auth.db.backup

# MySQL
mysqldump -u root -p my_app > backup.sql
```

---

**Veko.js Auth System** - Documentation complète v1.0  
Pour plus d'informations, consultez les exemples dans le dossier `/examples/` du projet.