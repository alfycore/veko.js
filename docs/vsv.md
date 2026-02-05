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
  precompile: true             // Précompiler au démarrage
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
│   └── Nav.jsv
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
