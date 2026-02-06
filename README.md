<p align="center">
  <img src="https://raw.githubusercontent.com/wiltark/veko.js/main/assets/logo.png" alt="Veko.js Logo" width="200"/>
</p>

<h1 align="center">Veko.js</h1>

<p align="center">
  <strong>Framework Node.js ultra-leger avec zero dependances - VSV Components, Tailwind CSS integre, SSR natif</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/veko"><img src="https://img.shields.io/npm/v/veko.svg?style=flat-square" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/veko"><img src="https://img.shields.io/npm/dm/veko.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/wiltark/veko.js/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license"></a>
  <a href="https://github.com/wiltark/veko.js"><img src="https://img.shields.io/github/stars/wiltark/veko.js?style=flat-square" alt="github stars"></a>
</p>

<p align="center">
  <a href="#installation">Installation</a> -
  <a href="#demarrage-rapide">Demarrage</a> -
  <a href="#fonctionnalites">Fonctionnalites</a> -
  <a href="#vsv-components">VSV Components</a> -
  <a href="#documentation">Documentation</a>
</p>

---

## Fonctionnalites

| Fonctionnalite | Description |
|----------------|-------------|
| **Zero Dependances** | Aucun package npm requis - Node.js pur |
| **VSV Components** | Composants .jsv/.tsv avec JSX, SSR natif, hydratation selective |
| **Asset Imports** | Import CSS, images, JS, fonts dans les composants (comme React) |
| **Tailwind CSS** | Moteur Tailwind integre, zero config, genere uniquement le CSS utilise |
| **SSR Natif** | Server-Side Rendering sans configuration |
| **Securite** | Headers securises, rate limiting, protection XSS integres |
| **PHP Templates** | Support de templates PHP-like pour le prototypage rapide |
| **Serveur HTTP Pur** | Node.js http natif, pas d Express |

## Installation

```bash
npm install veko
```

C est tout. **Zero dependances** a installer.

Prerequis : Node.js >= 18.0.0

## Demarrage Rapide

### API Simple

```javascript
const { createApp } = require('veko');

const app = createApp({ port: 3000 });

app.get('/', (req, res) => {
  res.json({ message: 'Hello Veko!' });
});

app.post('/api/users', (req, res) => {
  res.status(201).json({ user: req.body });
});

app.listen();
```

### Application VSV Avec Tailwind

```javascript
const { createVSVApp } = require('veko');

async function main() {
  const app = await createVSVApp({
    port: 3000,
    tailwind: true
  });

  app.vsvRoute('/', 'Home', {
    title: 'Accueil',
    getProps: async (req) => ({
      message: 'Hello World!'
    })
  });

  app.listen();
}

main();
```

## VSV Components

### Composant .jsv

```jsx
// components/Home.jsv
import './styles/home.css';
import logo from './images/logo.png';

export default function Home({ title, message }) {
  const [count, setCount] = $state(0);

  return (
    <div class="flex flex-col items-center p-8">
      <img src={logo} alt="Logo" class="w-32 mb-4" />
      <h1 class="text-3xl font-bold text-gray-900">{title}</h1>
      <p class="text-gray-500 mt-2">{message}</p>
      <button
        class="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
        $click={() => setCount(c => c + 1)}
      >
        Clicks: {count()}
      </button>
    </div>
  );
}
```

### Composant TypeScript .tsv

```tsx
// components/Card.tsv
interface CardProps {
  title: string;
  description: string;
  image?: string;
}

export default function Card({ title, description, image }: CardProps) {
  return (
    <div class="max-w-sm rounded-xl shadow-lg overflow-hidden bg-white">
      {image && <img src={image} alt={title} class="w-full h-48 object-cover" />}
      <div class="p-6">
        <h2 class="text-xl font-bold mb-2">{title}</h2>
        <p class="text-gray-600">{description}</p>
      </div>
    </div>
  );
}
```

### Directives Reactives

| Directive | Description | Exemple |
|-----------|-------------|---------|
| `$state` | Etat reactif | `const [val, setVal] = $state(0)` |
| `$computed` | Valeur derivee | `const double = $computed(() => val() * 2)` |
| `$effect` | Effets de bord | `$effect(() => console.log(val()))` |
| `$ref` | Reference DOM | `const el = $ref(null)` |
| `$memo` | Memoisation | `const cached = $memo(() => heavy())` |

## Asset Imports

Importez des fichiers directement dans vos composants comme dans React :

```jsx
import './styles.css';           // CSS injecte automatiquement
import logo from './logo.png';   // Image -> URL servie
import './analytics.js';         // Script injecte
```

| Type | Extensions |
|------|-----------|
| CSS | `.css`, `.scss`, `.sass`, `.less` |
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.webp`, `.avif` |
| Fonts | `.woff`, `.woff2`, `.ttf`, `.eot`, `.otf` |
| Scripts | `.js`, `.mjs` |

## Tailwind CSS Integre

Activez Tailwind CSS sans aucune installation supplementaire :

```javascript
const app = await createVSVApp({ tailwind: true });
```

Supporte : toutes les classes utilitaires, responsive (`sm:`, `md:`, `lg:`, `xl:`), dark mode (`dark:`), etats (`hover:`, `focus:`, `active:`), directive `@apply`.

## Structure du Projet

```
mon-projet/
+-- app.js                 # Point d entree
+-- package.json
+-- components/            # Composants VSV
|   +-- Home.jsv
|   +-- Header.jsv
|   +-- styles/
|   |   +-- global.css
|   +-- images/
|       +-- logo.png
+-- pages/                 # Pages VSV
|   +-- Home.jsv
|   +-- About.jsv
+-- public/                # Fichiers statiques
|   +-- css/
|   +-- js/
|   +-- images/
+-- plugins/               # Plugins custom
+-- .veko/                 # Cache (auto)
```

## Securite

Securite integree par defaut, sans dependances :

- Headers securises automatiques (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- Rate limiting integre
- Body parsing securise avec erreurs 400
- Protection path traversal sur les fichiers statiques
- HTML escaping dans les pages d erreur

## Documentation

| Document | Description |
|----------|-------------|
| [Guide de Demarrage](docs/getting-started.md) | Installation et premier projet |
| [VSV Components](docs/vsv.md) | Composants, assets, Tailwind |
| [API Reference](docs/api.md) | Reference complete de l API |
| [Securite](docs/security.md) | Bonnes pratiques securite |
| [Plugins](docs/plugins.md) | Creer et utiliser des plugins |
| [Authentification](docs/auth.md) | JWT, sessions, auth patterns |

## Contribution

```bash
git clone https://github.com/wiltark/veko.js.git
cd veko.js
npm test
```

## Licence

MIT - Wiltark

---

<p align="center">
  Made with <3 by <a href="https://github.com/wiltark">Wiltark</a>
</p>
