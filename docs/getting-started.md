# Guide de Demarrage - Veko.js

Guide complet pour demarrer avec Veko.js, le framework Node.js ultra-leger avec zero dependances.

## Table des Matieres

- [Prerequis](#prerequis)
- [Installation](#installation)
- [Creer un Projet](#creer-un-projet)
- [Structure du Projet](#structure-du-projet)
- [Premier Serveur](#premier-serveur)
- [Routes](#routes)
- [Composants VSV](#composants-vsv)
- [Importer des Assets](#importer-des-assets)
- [Tailwind CSS](#tailwind-css)
- [Mode Developpement](#mode-developpement)

---

## Prerequis

- **Node.js** version 18.0.0 ou superieure
- **npm** version 8.0.0 ou superieure

```bash
node --version  # v18.0.0+
npm --version   # 8.0.0+
```

---

## Installation

```bash
# Installation globale (CLI)
npm install -g veko

# Ou installation locale
npm install veko
```

Aucune autre dependance n est requise. Veko.js fonctionne avec **zero dependances npm**.

---

## Creer un Projet

### Manuellement

```bash
mkdir mon-projet
cd mon-projet
npm init -y
npm install veko
mkdir -p components pages public/css public/js public/images
```

### Fichier d entree

Creez `app.js` :

```javascript
const { createVSVApp } = require('veko');

async function main() {
  const app = await createVSVApp({
    port: 3000,
    tailwind: true  // Active Tailwind CSS integre
  });

  app.vsvRoute('/', 'Home', {
    title: 'Bienvenue',
    getProps: async (req) => ({
      message: 'Hello World!'
    })
  });

  app.listen();
}

main();
```

---

## Structure du Projet

```
mon-projet/
+-- app.js                 # Point d entree
+-- package.json
+-- components/            # Composants VSV (.jsv / .tsv)
|   +-- Home.jsv
|   +-- Header.jsv
|   +-- Footer.jsv
|   +-- styles/
|   |   +-- main.css
|   |   +-- header.css
|   +-- images/
|       +-- logo.png
+-- pages/                 # Pages VSV (routing)
|   +-- Home.jsv
|   +-- About.jsv
|   +-- Contact.jsv
+-- public/                # Fichiers statiques
|   +-- css/
|   +-- js/
|   +-- images/
+-- .veko/                 # Cache (auto-genere)
    +-- vsv-cache/
```

---

## Premier Serveur

### Configuration Minimale

```javascript
const { createApp } = require('veko');

const app = createApp();

app.get('/', (req, res) => {
  res.json({ message: 'Hello Veko!' });
});

app.listen();
// Server running at http://localhost:3000
```

### Configuration Complete

```javascript
const { createApp } = require('veko');

const app = createApp({
  port: 3000,
  host: '0.0.0.0',
  staticDir: 'public',
  isDev: process.env.NODE_ENV !== 'production',

  // Rate limiting integre
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100
  }
});

app.listen();
```

---

## Routes

### Routes Basiques

```javascript
// GET
app.get('/', (req, res) => {
  res.html('<h1>Accueil</h1>');
});

// POST
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  res.json({ success: true, user: { name, email } });
});

// Route avec parametres
app.get('/users/:id', (req, res) => {
  res.json({ userId: req.params.id });
});

// Route avec query string
app.get('/search', (req, res) => {
  res.json({ query: req.query.q });
});
```

### Middleware

```javascript
// Middleware global
app.use((req, res, next) => {
  console.log(`${req.method} ${req.pathname}`);
  next();
});

// Middleware sur un chemin
app.use('/api', (req, res, next) => {
  if (!req.headers.authorization) {
    res.status(401).json({ error: 'Non autorise' });
    return;
  }
  next();
});
```

### Reponses

```javascript
res.json({ data: 'object' });                        // JSON
res.html('<h1>HTML</h1>');                           // HTML
res.send('text');                                     // Texte
res.redirect('/autre-page');                          // Redirection
res.status(404).json({ error: 'Not found' });        // Status + JSON
res.setCookie('session', 'abc', { httpOnly: true });  // Cookie
```

---

## Composants VSV

### Creer un composant (.jsv)

```jsx
// components/Home.jsv
import './styles/home.css';
import logo from './images/logo.png';

export default function Home({ title, message }) {
  const [count, setCount] = $state(0);

  return (
    <div class="home">
      <img src={logo} alt="Logo" />
      <h1>{title}</h1>
      <p>{message}</p>
      <button $click={() => setCount(c => c + 1)}>
        Clicks: {count()}
      </button>
    </div>
  );
}
```

### Route VSV

```javascript
app.vsvRoute('/', 'Home', {
  title: 'Ma Page',
  getProps: async (req) => ({
    title: 'Bienvenue',
    message: 'Hello World!'
  })
});
```

---

## Importer des Assets

Comme dans React, vous pouvez importer des fichiers directement dans vos composants :

### CSS

```jsx
// Importe et injecte automatiquement le CSS dans la page
import './styles.css';
```

### Images

```jsx
import logo from './logo.png';
import avatar from '../images/avatar.jpg';

export default function Header() {
  return (
    <header>
      <img src={logo} alt="Logo" />
      <img src={avatar} alt="Avatar" />
    </header>
  );
}
```

### JavaScript

```jsx
import './analytics.js';  // Script injecte dans la page
```

### Formats supportes

| Type | Extensions |
|------|-----------|
| CSS | `.css`, `.scss`, `.sass`, `.less` |
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.webp`, `.avif` |
| Fonts | `.woff`, `.woff2`, `.ttf`, `.eot`, `.otf` |
| Scripts | `.js`, `.mjs` |

Les fichiers importes sont servis automatiquement via `/_vsv/assets/` avec cache-busting (hash MD5).

---

## Tailwind CSS

Veko.js inclut un moteur Tailwind CSS integre (zero dependances). Il scanne automatiquement vos composants et genere uniquement le CSS utilise.

### Activation

```javascript
const app = await createVSVApp({
  port: 3000,
  tailwind: true  // Active Tailwind
});
```

### Utilisation dans les composants

```jsx
// components/Card.jsv
export default function Card({ title, description }) {
  return (
    <div class="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl">
      <div class="p-8">
        <h2 class="text-xl font-bold text-gray-900 mb-2">{title}</h2>
        <p class="text-gray-500">{description}</p>
      </div>
    </div>
  );
}
```

### Directive @apply

```css
/* components/styles/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

.btn-primary {
  @apply px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition;
}
```

### Classes supportees

| Categorie | Exemples |
|-----------|----------|
| **Display** | `flex`, `grid`, `block`, `hidden`, `inline-flex` |
| **Flexbox** | `flex-col`, `items-center`, `justify-between`, `flex-1` |
| **Grid** | `grid-cols-3`, `gap-4`, `col-span-2` |
| **Spacing** | `p-4`, `mx-auto`, `mt-8`, `space-x-2` |
| **Sizing** | `w-full`, `h-screen`, `max-w-7xl`, `min-h-screen` |
| **Typography** | `text-xl`, `font-bold`, `text-gray-500`, `uppercase` |
| **Background** | `bg-white`, `bg-blue-500` |
| **Border** | `border`, `rounded-lg`, `border-gray-200` |
| **Shadow** | `shadow`, `shadow-lg`, `shadow-xl` |
| **Transform** | `scale-75`, `rotate-45`, `translate-x-4` |
| **Transition** | `transition`, `duration-300`, `ease-in-out` |
| **Responsive** | `sm:flex`, `md:grid-cols-2`, `lg:text-xl` |
| **Dark mode** | `dark:bg-gray-900`, `dark:text-white` |
| **States** | `hover:bg-blue-600`, `focus:ring`, `active:scale-95` |

---

## Mode Developpement

```javascript
const app = createApp({ isDev: true });
app.listen(3000);
```

En mode developpement :
- Logs colores de chaque requete
- Stack traces detaillees en cas d erreur
- Pas de cache sur les fichiers statiques

---

## Etapes Suivantes

- [Composants VSV](vsv.md) - Guide complet des composants
- [API Reference](api.md) - Toutes les methodes disponibles
- [Securite](security.md) - Bonnes pratiques
- [Plugins](plugins.md) - Etendre Veko.js
