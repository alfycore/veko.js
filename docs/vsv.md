# VSV - Veko Server Views

**VSV** (.jsv / .tsv) est un format de composants ultra-rapide créé par VekoJS pour remplacer React/JSX avec une performance maximale et un SEO optimal.

## Pourquoi VSV ?

| Feature | React | VSV |
|---------|-------|-----|
| Bundle Size | ~40KB | ~3KB |
| SSR | Nécessite config | Natif |
| Hydration | Full page | Sélective |
| Dependencies | react, react-dom | Aucune |
| SEO | Moyen | Excellent |
| First Paint | ~200ms | ~50ms |

## Installation

```bash
npm install veko
```

## Quick Start

### 1. Créer une app VSV

```javascript
// app.js
const { createVSVApp } = require('veko');

async function main() {
  const app = await createVSVApp({
    port: 3000
  });

  // Route VSV
  app.vsvRoute('/', 'Home', {
    title: 'Accueil',
    seo: {
      description: 'Ma super app VSV',
      keywords: ['veko', 'vsv', 'fast']
    }
  });

  app.listen(3000);
}

main();
```

### 2. Créer un composant (.jsv)

```jsx
// components/Home.jsv

export default function Home({ title, items = [] }) {
  const [count, setCount] = $state(0);
  
  $effect(() => {
    console.log('Count changed:', count());
  }, [count]);

  return (
    <div class="home">
      <h1>{title}</h1>
      
      <button @click={() => setCount(c => c + 1)}>
        Clicks: {count()}
      </button>
      
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 3. TypeScript (.tsv)

```tsx
// components/Button.tsv

interface ButtonProps {
  text: string;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

export default function Button({ text, variant = 'primary', onClick }: ButtonProps) {
  return (
    <button 
      class={`btn btn-${variant}`}
      @click={onClick}
    >
      {text}
    </button>
  );
}
```

## Syntaxe VSV

### État réactif ($state)

```jsx
// Déclarer un état
const [value, setValue] = $state(initialValue);

// Lire la valeur
console.log(value());

// Mettre à jour
setValue(newValue);
setValue(prev => prev + 1);
```

### Computed ($computed)

```jsx
const [firstName] = $state('John');
const [lastName] = $state('Doe');

const fullName = $computed(() => {
  return `${firstName()} ${lastName()}`;
});

// Utilisation
<p>{fullName()}</p>
```

### Effects ($effect)

```jsx
const [count] = $state(0);

// Exécuté quand count change
$effect(() => {
  document.title = `Count: ${count()}`;
  
  // Cleanup (optionnel)
  return () => {
    console.log('Cleanup');
  };
}, [count]);
```

### Références ($ref)

```jsx
const inputRef = $ref(null);

$effect(() => {
  inputRef.current?.focus();
}, []);

return <input ref={inputRef} />;
```

### Memo ($memo)

```jsx
const expensiveValue = $memo(() => {
  return heavyComputation(data);
}, [data]);
```

## Events

VSV utilise `@event` au lieu de `onEvent` :

```jsx
<button @click={handleClick}>Click</button>
<input @change={handleChange} @focus={handleFocus} />
<form @submit={handleSubmit}>...</form>
```

## Rendering

### SSR (Server-Side Rendering)

```javascript
app.vsvRoute('/about', 'About', {
  ssr: true,        // Activé par défaut
  hydrate: true,    // Hydratation client
  seo: {
    title: 'À propos',
    description: 'Page à propos'
  }
});
```

### Static (Pas d'hydratation)

```javascript
app.vsvRoute('/static', 'StaticPage', {
  hydrate: false   // Pas de JS client
});
```

### Data Fetching

```javascript
app.vsvRoute('/users', 'UserList', {
  async getProps(req) {
    const users = await db.users.findAll();
    return { users };
  }
});
```

## SEO

### Meta tags

```javascript
app.vsvRoute('/', 'Home', {
  seo: {
    title: 'Mon Site',
    description: 'Description pour Google',
    keywords: ['mot', 'clé'],
    robots: 'index, follow',
    canonical: 'https://monsite.com/',
    
    // Open Graph
    og: {
      title: 'Mon Site',
      description: 'Description Facebook',
      image: 'https://monsite.com/og.jpg',
      type: 'website'
    },
    
    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      site: '@monsite',
      title: 'Mon Site',
      image: 'https://monsite.com/twitter.jpg'
    },
    
    // JSON-LD Structured Data
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Mon Site',
      description: 'Description'
    }
  }
});
```

## Importer des Assets

Comme dans React, vous pouvez importer des fichiers CSS, images, fonts et scripts directement dans vos composants VSV.

### Importer du CSS

```jsx
// components/Home.jsv
import './styles/home.css';

export default function Home({ title }) {
  return <h1 class="home-title">{title}</h1>;
}
```

Le CSS est automatiquement injecté dans la page HTML via une balise `<link>`.

### Importer des Images

```jsx
// components/Header.jsv
import logo from './images/logo.png';
import avatar from '../images/avatar.jpg';

export default function Header() {
  return (
    <header class="header">
      <img src={logo} alt="Logo" />
      <img src={avatar} alt="Avatar" class="avatar" />
    </header>
  );
}
```

L'import est résolu en une URL servie par `/_vsv/assets/<hash>.<ext>` avec cache immutable.

### Importer du JavaScript

```jsx
// components/Page.jsv
import './scripts/analytics.js';

export default function Page() {
  return <div>Content</div>;
}
```

Le script est injecté automatiquement dans la page.

### Formats Supportés

| Type | Extensions |
|------|-----------|
| CSS | `.css`, `.scss`, `.sass`, `.less` |
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.webp`, `.avif` |
| Fonts | `.woff`, `.woff2`, `.ttf`, `.eot`, `.otf` |
| Scripts | `.js`, `.mjs` |

### Fonctionnement

1. Le compilateur extrait les imports d'assets du code source
2. Les fichiers sont lus et hashés (MD5) pour le cache-busting
3. Les variables d'import (ex: `logo`) sont remplacées par l'URL du fichier
4. Les fichiers sont servis via `/_vsv/assets/<hash>.<ext>` avec header `Cache-Control: immutable`
5. Les balises `<link>` (CSS) et `<script>` (JS) sont injectées automatiquement dans le HTML

---

## Tailwind CSS Intégré

Veko.js inclut un moteur Tailwind CSS intégré sans aucune dépendance. Il scanne les composants et génère uniquement le CSS des classes utilisées.

### Activation

```javascript
const app = await createVSVApp({
  port: 3000,
  tailwind: true
});
```

### Utilisation

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

### Configuration

```javascript
const app = await createVSVApp({
  tailwind: {
    prefix: '',           // Préfixe de classe (ex: 'tw-')
    darkMode: 'class',    // 'class' ou 'media'
    theme: {
      colors: {
        brand: { 500: '#6366f1', 600: '#4f46e5' }
      },
      spacing: {
        '128': '32rem'
      }
    }
  }
});
```

### Directive @apply

```css
/* styles/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

.btn-primary {
  @apply px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition;
}

.card {
  @apply bg-white rounded-lg shadow-md p-6;
}
```

### Variantes Responsives

```jsx
<div class="flex flex-col md:flex-row lg:grid lg:grid-cols-3 gap-4">
  <div class="w-full md:w-1/2 lg:w-auto">...</div>
</div>
```

Breakpoints : `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px), `2xl:` (1536px)

### Dark Mode

```jsx
<div class="bg-white dark:bg-gray-900 text-black dark:text-white">
  <h1 class="text-gray-900 dark:text-gray-100">Hello</h1>
</div>
```

### Variantes d'État

```jsx
<button class="bg-blue-500 hover:bg-blue-600 focus:ring-2 active:scale-95 disabled:opacity-50 transition">
  Click me
</button>
```

États supportés : `hover:`, `focus:`, `active:`, `visited:`, `disabled:`, `first:`, `last:`, `odd:`, `even:`, `focus-within:`, `focus-visible:`, `placeholder:`, `group-hover:`

### Classes Supportées

| Catégorie | Exemples |
|-----------|----------|
| Display | `flex`, `grid`, `block`, `hidden`, `inline-flex` |
| Flexbox | `flex-col`, `items-center`, `justify-between`, `flex-1` |
| Grid | `grid-cols-3`, `gap-4`, `col-span-2` |
| Spacing | `p-4`, `mx-auto`, `mt-8`, `space-x-2` |
| Sizing | `w-full`, `h-screen`, `max-w-7xl`, `min-h-screen` |
| Typography | `text-xl`, `font-bold`, `text-gray-500`, `uppercase`, `truncate` |
| Background | `bg-white`, `bg-blue-500` |
| Border | `border`, `rounded-lg`, `border-gray-200`, `divide-y` |
| Shadow | `shadow`, `shadow-lg`, `shadow-xl` |
| Transform | `scale-75`, `rotate-45`, `translate-x-4` |
| Transition | `transition`, `duration-300`, `ease-in-out` |
| Layout | `container`, `aspect-video`, `columns-3` |
| Interactivity | `cursor-pointer`, `select-none`, `pointer-events-none` |

---

## Composants Programmatiques

```javascript
// Créer un composant sans fichier
app.vsvComponent('Counter', {
  props: ['initial'],
  state: { count: 0 },
  
  computed: {
    doubled: (state) => state.count * 2
  },
  
  effects: [
    (state) => console.log('Count:', state.count)
  ],
  
  render({ count, doubled, setCount }) {
    return VSV.h('div', null,
      VSV.h('p', null, `Count: ${count}, Doubled: ${doubled}`),
      VSV.h('button', { onClick: () => setCount(c => c + 1) }, '+1')
    );
  }
});
```

## API Complète

### App Methods

```javascript
// Activer VSV
await app.enableVSV(options);

// Route VSV
app.vsvRoute(path, component, options);

// Render manuel
const html = await app.renderVSV('Component', props);

// Render page complète
const page = await app.renderVSVPage('Page', props, options);

// Créer composant
app.vsvComponent('Name', definition);
```

### VSV Options

```javascript
await app.enableVSV({
  componentsDir: 'components',  // Dossier composants
  pagesDir: 'pages',           // Dossier pages
  cacheDir: '.veko/vsv-cache', // Cache compilation
  ssr: true,                   // SSR activé
  hydrate: true,               // Hydratation activée
  minify: true,                // Minification
  precompile: true,            // Précompiler au démarrage
  tailwind: true               // Tailwind CSS intégré
});
```

## Performance Tips

### 1. Utilisez des composants statiques quand possible

```jsx
// ❌ Inutile d'hydrater du contenu statique
<footer>© 2024 Mon Site</footer>

// ✅ Marquer comme statique
// components/Footer.jsv avec hydrate: false
```

### 2. Lazy loading

```javascript
// Charger composants à la demande
const HeavyChart = VSV.lazy(() => import('./HeavyChart.jsv'));
```

### 3. Memoization

```jsx
const items = $memo(() => {
  return bigArray.filter(x => x.active).map(x => x.name);
}, [bigArray]);
```

### 4. Évitez les re-renders inutiles

```jsx
// ❌ Crée une nouvelle fonction à chaque render
<button @click={() => handleClick(id)}>

// ✅ Memoize la callback
const handleItemClick = $memo(() => () => handleClick(id), [id]);
<button @click={handleItemClick()}>
```

## Migration depuis React

| React | VSV |
|-------|-----|
| `useState` | `$state` |
| `useEffect` | `$effect` |
| `useMemo` | `$memo` |
| `useRef` | `$ref` |
| `useCallback` | `$memo(() => fn)` |
| `onClick` | `@click` |
| `onChange` | `@change` |
| `className` | `class` |
| `.jsx` | `.jsv` |
| `.tsx` | `.tsv` |

## Structure Projet Recommandée

```
my-app/
├── app.js
├── components/
│   ├── Button.jsv
│   ├── Card.jsv
│   ├── Nav.jsv
│   ├── styles/
│   │   ├── global.css
│   │   └── card.css
│   └── images/
│       ├── logo.png
│       └── hero.jpg
├── pages/
│   ├── Home.jsv
│   ├── About.jsv
│   └── Contact.jsv
├── public/
│   ├── css/
│   └── images/
└── package.json
```

## License

MIT - VekoJS Team
