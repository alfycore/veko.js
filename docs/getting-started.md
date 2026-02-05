# 🚀 Guide de Démarrage - Veko.js

Ce guide vous accompagne dans l'installation et la création de votre premier projet Veko.js.

## Table des Matières

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Créer un Projet](#créer-un-projet)
- [Structure du Projet](#structure-du-projet)
- [Premier Serveur](#premier-serveur)
- [Routes](#routes)
- [Templates EJS](#templates-ejs)
- [Mode Développement](#mode-développement)

---

## Prérequis

- **Node.js** version 16.0.0 ou supérieure
- **npm** version 8.0.0 ou supérieure

Vérifiez vos versions :

```bash
node --version  # v16.0.0+
npm --version   # 8.0.0+
```

---

## Installation

### Installation Globale (Recommandée)

```bash
npm install -g veko
```

Cela vous donne accès aux commandes CLI :
- `veko` - CLI principal
- `create-veko-app` - Créer un nouveau projet
- `veko-update` - Gérer les mises à jour

### Installation Locale

```bash
npm install veko
```

---

## Créer un Projet

### Avec le CLI

```bash
create-veko-app mon-projet
cd mon-projet
npm install
npm run dev
```

### Manuellement

1. Créez un dossier et initialisez le projet :

```bash
mkdir mon-projet
cd mon-projet
npm init -y
npm install veko
```

2. Créez la structure de base :

```bash
mkdir -p views/layouts routes public/css public/js
```

3. Créez le fichier principal `app.js` :

```javascript
const { createApp } = require('veko');

const app = createApp({
  port: 3000,
  isDev: true
});

app.createRoute('GET', '/', (req, res) => {
  res.render('index', { title: 'Mon App Veko' });
});

app.listen();
```

---

## Structure du Projet

```
mon-projet/
├── app.js                 # Point d'entrée
├── package.json
├── views/                 # Templates EJS
│   ├── index.ejs
│   └── layouts/
│       └── main.ejs       # Layout principal
├── routes/                # Fichiers de routes (auto-chargement)
│   ├── api.js
│   └── auth.js
├── public/                # Fichiers statiques
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── main.js
├── components/            # Composants React (si activé)
├── plugins/               # Plugins personnalisés
└── logs/                  # Fichiers de logs
```

---

## Premier Serveur

### Configuration Minimale

```javascript
const { createApp } = require('veko');

const app = createApp();
app.listen();
// Serveur sur http://localhost:3000
```

### Configuration Complète

```javascript
const { createApp } = require('veko');

const app = createApp({
  // Serveur
  port: 3000,
  wsPort: 3008,
  isDev: process.env.NODE_ENV !== 'production',
  
  // Répertoires
  viewsDir: 'views',
  staticDir: 'public',
  routesDir: 'routes',
  
  // Sécurité
  security: {
    helmet: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 100                    // 100 requêtes max
    }
  },
  
  // Layouts
  layouts: {
    enabled: true,
    layoutsDir: 'views/layouts',
    defaultLayout: 'main',
    extension: '.ejs'
  },
  
  // Plugins
  plugins: {
    enabled: true,
    autoLoad: true,
    pluginsDir: 'plugins'
  }
});

app.listen(() => {
  console.log('Serveur démarré!');
});
```

---

## Routes

### Création Manuelle

```javascript
// Routes basiques
app.createRoute('GET', '/', (req, res) => {
  res.render('index');
});

app.createRoute('POST', '/api/users', (req, res) => {
  const { name, email } = req.body;
  res.json({ success: true, user: { name, email } });
});

// Route avec paramètres
app.createRoute('GET', '/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ userId });
});

// Route avec query string
app.createRoute('GET', '/search', (req, res) => {
  const { q, page } = req.query;
  res.json({ query: q, page: page || 1 });
});
```

### Auto-chargement des Routes

Créez des fichiers dans le dossier `routes/` :

```javascript
// routes/api.js
module.exports = (app) => {
  app.createRoute('GET', '/api/status', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });
  
  app.createRoute('GET', '/api/users', async (req, res) => {
    const users = await User.findAll();
    res.json(users);
  });
};
```

Les routes sont automatiquement chargées au démarrage.

---

## Templates EJS

### Layout Principal

```html
<!-- views/layouts/main.ejs -->
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title || 'Mon App' %></title>
  <link rel="stylesheet" href="/css/style.css">
  <%- head || '' %>
</head>
<body>
  <header>
    <%- header || '' %>
  </header>
  
  <main>
    <%- content %>
  </main>
  
  <footer>
    <%- footer || '' %>
  </footer>
  
  <script src="/js/main.js"></script>
  <%- scripts || '' %>
</body>
</html>
```

### Page avec Layout

```html
<!-- views/index.ejs -->
<% layout('main') %>

<% section('head') %>
<meta name="description" content="Page d'accueil">
<% endsection %>

<% section('content') %>
<h1>Bienvenue sur <%= title %>!</h1>
<p>Ceci est ma première page Veko.js</p>
<% endsection %>

<% section('scripts') %>
<script>
  console.log('Page chargée!');
</script>
<% endsection %>
```

### Partials

```html
<!-- views/partials/navbar.ejs -->
<nav class="navbar">
  <a href="/">Accueil</a>
  <a href="/about">À propos</a>
  <a href="/contact">Contact</a>
</nav>

<!-- Utilisation -->
<%- include('partials/navbar') %>
```

---

## Mode Développement

### Démarrer en Mode Dev

```javascript
const app = createApp({ isDev: true });
app.startDev();
```

Ou avec le CLI :

```bash
veko dev
```

### Fonctionnalités du Mode Dev

1. **Hot Reload** - Rechargement automatique des fichiers modifiés
2. **WebSocket** - Actualisation du navigateur en temps réel
3. **Logs détaillés** - Affichage coloré des événements
4. **File watching** - Surveillance des dossiers configurés

### Configuration du Hot Reload

```javascript
const app = createApp({
  isDev: true,
  wsPort: 3008,
  watchDirs: ['views', 'routes', 'public', 'components'],
  showStack: true  // Afficher les stack traces
});
```

---

## Étapes Suivantes

- [Configuration de React SSR](react.md)
- [Système d'authentification](auth.md)
- [Créer des plugins](plugins.md)
- [Référence API complète](api.md)

---

<p align="center">
  <a href="react.md">Suivant : React SSR →</a>
</p>
