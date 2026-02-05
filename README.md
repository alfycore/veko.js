<p align="center">
  <img src="https://raw.githubusercontent.com/wiltark/veko.js/main/assets/logo.png" alt="Veko.js Logo" width="200"/>
</p>

<h1 align="center">🚀 Veko.js</h1>

<p align="center">
  <strong>Framework Node.js ultra-moderne avec VSV (Veko Server Views), hot reload intelligent et sécurité avancée</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/veko"><img src="https://img.shields.io/npm/v/veko.svg?style=flat-square" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/veko"><img src="https://img.shields.io/npm/dm/veko.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/wiltark/veko.js/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license"></a>
  <a href="https://github.com/wiltark/veko.js"><img src="https://img.shields.io/github/stars/wiltark/veko.js?style=flat-square" alt="github stars"></a>
</p>

<p align="center">
  <a href="#-installation">Installation</a> •
  <a href="#-démarrage-rapide">Démarrage</a> •
  <a href="#-fonctionnalités">Fonctionnalités</a> •
  <a href="#-vsv-components">VSV Components</a> •
  <a href="#-documentation">Documentation</a>
</p>

---

## ✨ Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| ⚛️ **VSV Components** | Veko Server Views - Composants JSX-like avec SSR natif, zéro dépendance externe |
| 🔥 **Hot Reload Intelligent** | Rechargement sélectif des routes modifiées sans redémarrage |
| 🔒 **Sécurité Avancée** | Helmet, rate limiting, validation XSS, protection CSRF |
| 🔌 **Système de Plugins** | Architecture extensible avec hooks et API complète |
| 🔐 **Authentification** | JWT, sessions, OAuth (Google, GitHub, Facebook) |
| 📁 **Auto-loading** | Routes, vues et middlewares auto-configurés |
| 🎨 **Layouts VSV** | Système de templates puissant avec sections |
| 📦 **Auto-installation** | Gestion automatique des dépendances |
| 🔄 **Auto-updater** | Mises à jour automatiques avec rollback |

## 📦 Installation

```bash
# Installation globale (recommandée)
npm install -g veko

# Créer un nouveau projet
create-veko-app mon-projet
cd mon-projet
npm run dev

# Ou installation locale
npm install veko
```

## 🚀 Démarrage Rapide

### Application Express classique

```javascript
const { createApp } = require('veko');

const app = createApp({
  port: 3000,
  isDev: true
});

// Créer une route
app.createRoute('GET', '/', (req, res) => {
  res.render('index', { title: 'Bienvenue sur Veko.js!' });
});

// Démarrer le serveur
app.listen();
```

### Application avec VSV Components

```javascript
const { createVSVApp } = require('veko');

async function main() {
  const app = await createVSVApp({
    port: 3000,
    vsv: {
      componentsDir: 'components',
      pagesDir: 'pages',
      ssr: true,
      hydrate: true
    }
  });

  // Route VSV avec SSR
  app.vsvRoute('/', 'Home', {
    getProps: async (req) => {
      return { user: req.user, title: 'Accueil' };
    }
  });

  app.listen();
}

main();
```

## ⚛️ VSV Components

Veko.js offre VSV (Veko Server Views), un système de composants moderne avec syntaxe JSX, zéro dépendance externe et SSR natif.

### Syntaxe VSV (.jsv / .tsv)

```jsx
// components/Counter.jsv
export default function Counter(props) {
  const [count, setCount] = $state(0);
  
  return (
    <div class="counter">
      <h1>{props.title}</h1>
      <p>Count: {count()}</p>
      <button @click={() => setCount(c => c + 1)}>+</button>
      <button @click={() => setCount(c => c - 1)}>-</button>
    </div>
  );
}
```

### Directives Réactives

| Directive | Description | Exemple |
|-----------|-------------|---------|
| `$state` | État réactif | `const [val, setVal] = $state(0)` |
| `$computed` | Valeur dérivée | `const double = $computed(() => val() * 2)` |
| `$effect` | Effets de bord | `$effect(() => console.log(val()))` |
| `$ref` | Référence DOM | `const el = $ref(null)` |
| `$memo` | Mémoïsation | `const cached = $memo(() => heavy())` |

### Événements

```jsx
<button @click={handleClick}>Click</button>
<input @change={handleChange} />
<form @submit={handleSubmit}>...</form>
```

### Exemple Complet

```javascript
const { createApp } = require('veko');

const app = createApp({ port: 3000 });

// Activer VSV
await app.enableVSV({
  componentsDir: 'components',
  pagesDir: 'pages'
});

// Route VSV
app.vsvRoute('/dashboard', 'Dashboard', {
  getProps: async (req) => {
    const data = await fetchDashboardData(req.params.id);
    return { data };
  }
});

app.listen();
```

## 🔐 Authentification

```javascript
const app = createApp({ port: 3000 });

// Activer l'authentification
await app.enableAuth({
  strategy: 'jwt',
  secret: process.env.JWT_SECRET,
  expiresIn: '7d',
  
  // OAuth (optionnel)
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  }
});

// Route protégée
app.createRoute('GET', '/profile', app.requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

// Route avec rôle
app.createRoute('GET', '/admin', app.requireRole('admin'), (req, res) => {
  res.render('admin/dashboard');
});
```

## 🔌 Plugins

```javascript
// plugins/analytics.js
module.exports = {
  name: 'analytics',
  version: '1.0.0',
  
  hooks: {
    'app:init': (app) => {
      console.log('Analytics plugin initialized');
    },
    'route:before': (req, res, route) => {
      trackPageView(req.path);
    }
  },
  
  api: {
    track: (event, data) => {
      // Logique de tracking
    }
  }
};

// Utilisation
app.plugins.get('analytics').api.track('click', { button: 'signup' });
```

## 📁 Structure du Projet

```
mon-projet/
├── components/          # Composants React
│   ├── Layout.jsx
│   └── HomePage.jsx
├── pages/              # Pages React (routing automatique)
│   ├── index.jsx
│   └── about.jsx
├── views/              # Templates EJS
│   └── layouts/
│       └── main.ejs
├── routes/             # Routes Express
│   └── api.js
├── public/             # Fichiers statiques
│   ├── css/
│   └── js/
├── plugins/            # Plugins personnalisés
├── app.js              # Point d'entrée
└── package.json
```

## 🛠️ CLI

```bash
# Développement
veko dev                    # Démarrer en mode développement
veko dev --port 8080        # Port personnalisé

# Production
veko start                  # Démarrer en production
veko build                  # Build pour production
veko build --react          # Build React pour production

# Mises à jour
veko update check           # Vérifier les mises à jour
veko update                 # Mettre à jour

# Utilitaires
veko routes                 # Lister les routes
veko plugins                # Lister les plugins
```

## 📚 Documentation

Documentation complète disponible dans le dossier `/docs` :

| Document | Description |
|----------|-------------|
| [Guide de Démarrage](docs/getting-started.md) | Installation et premier projet |
| [React SSR](docs/react.md) | Guide complet React SSR/CSR |
| [Authentification](docs/auth.md) | Configuration auth et OAuth |
| [Plugins](docs/plugins.md) | Créer et utiliser des plugins |
| [API Reference](docs/api.md) | Référence complète de l'API |
| [Sécurité](docs/security.md) | Bonnes pratiques sécurité |
| [Déploiement](docs/deployment.md) | Déployer en production |

## ⚡ Performances

Veko.js est optimisé pour les performances :

- **Compilation JSX** avec esbuild (100x plus rapide que Babel)
- **Cache intelligent** des composants compilés
- **Streaming SSR** pour les grands composants
- **Prefetching** automatique des routes
- **Compression** gzip/brotli automatique
- **Static file caching** optimisé

## 🔒 Sécurité

Sécurité intégrée par défaut :

- ✅ Headers sécurisés (Helmet)
- ✅ Rate limiting
- ✅ Protection XSS
- ✅ Validation des entrées
- ✅ Protection CSRF
- ✅ Sanitisation des chemins
- ✅ Content Security Policy

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines.

```bash
# Cloner le repo
git clone https://github.com/wiltark/veko.js.git
cd veko.js

# Installer les dépendances
npm install

# Lancer les tests
npm test

# Mode développement
npm run dev
```

## 📄 Licence

MIT © [Wiltark](https://github.com/wiltark)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/wiltark">Wiltark</a>
</p>
