# API Reference - Veko.js

Reference complete de l API Veko.js - Zero dependances.

## Table des Matieres

- [App](#app)
- [Router](#router)
- [VSV](#vsv)
- [VekoTailwind](#vekotailwind)
- [VekoPHP](#vekophp)
- [Logger](#logger)
- [Types TypeScript](#types-typescript)

---

## App

Classe principale de l application Veko. Serveur HTTP pur Node.js (aucune dependance).

### Creation

```javascript
const { createApp, App } = require('veko');

// Methode raccourcie
const app = createApp(options);

// Ou instanciation directe
const app = new App(options);

// Avec VSV + Tailwind
const app = await createVSVApp(options);
```

### Options

```javascript
{
  // Serveur
  port: 3000,              // Port du serveur
  host: '0.0.0.0',        // Adresse d ecoute
  isDev: false,            // Mode developpement

  // Repertoires
  staticDir: 'public',    // Dossier fichiers statiques

  // Rate Limiting (integre)
  rateLimit: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100                    // Requetes max par fenetre
  },

  // VSV (via createVSVApp)
  componentsDir: 'components',
  pagesDir: 'pages',
  cacheDir: '.veko/vsv-cache',
  ssr: true,
  hydrate: true,
  minify: true,
  precompile: true,
  tailwind: true           // Active Tailwind CSS integre
}
```

### Methodes HTTP

```javascript
app.get(path, ...handlers)
app.post(path, ...handlers)
app.put(path, ...handlers)
app.delete(path, ...handlers)
app.patch(path, ...handlers)
app.all(path, ...handlers)
```

Exemple :
```javascript
app.get('/api/users', async (req, res) => {
  res.json({ users: [] });
});

app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;
  res.status(201).json({ user: { name, email } });
});

// Route avec parametres
app.get('/users/:id', (req, res) => {
  res.json({ userId: req.params.id });
});
```

### Middleware

```javascript
app.use(handler)           // Middleware global
app.use(path, handler)     // Middleware sur un chemin
```

```javascript
// Middleware global
app.use((req, res, next) => {
  console.log(`${req.method} ${req.pathname}`);
  next();
});

// Middleware API
app.use('/api', (req, res, next) => {
  if (!req.headers.authorization) {
    res.status(401).json({ error: 'Non autorise' });
    return;
  }
  next();
});
```

### Objet Request (req)

```javascript
req.method       // GET, POST, etc.
req.pathname     // /users/123
req.query        // { page: '1', limit: '10' }
req.params       // { id: '123' } (parametres de route)
req.body         // Corps de la requete (POST/PUT/PATCH)
req.cookies      // { session: 'abc' }
req.headers      // En-tetes HTTP
```

### Objet Response (res)

```javascript
res.json(data)                          // Reponse JSON
res.html(htmlString)                    // Reponse HTML
res.send(data)                          // Auto (string -> text, object -> JSON)
res.redirect(url, statusCode?)          // Redirection (302 par defaut)
res.status(code)                        // Setter status (chainable)
res.setCookie(name, value, options)     // Definir un cookie
res.setHeader(name, value)              // Definir un en-tete
```

Options cookie :
```javascript
res.setCookie('session', 'token123', {
  maxAge: 86400,
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Strict'
});
```

### VSV Methods

```javascript
// Activer VSV
await app.enableVSV(options)

// Route VSV (rendu composant avec SSR)
app.vsvRoute(path, component, {
  title: 'Page Title',
  props: { static: 'data' },
  getProps: async (req) => ({ dynamic: 'data' }),
  seo: {
    description: 'Meta description',
    keywords: ['mot', 'cle'],
    og: { title: 'OG Title', image: 'url' },
    twitter: { card: 'summary_large_image' },
    jsonLd: { '@type': 'WebPage' }
  },
  hydrate: true,
  ssr: true
})

// Render manuel
const html = await app.renderVSV(component, props, options)
```

### PHP-like Template Methods

```javascript
// Route PHP template
app.phpRoute(path, template, {
  title: 'Page',
  data: { key: 'value' },
  getData: async (req, res) => ({ users: [] })
})

// Render template string
const html = await app.renderPHP(templateString, data, req, res)

// Globals PHP
app.phpGlobal('siteName', 'Mon Site')

// Custom function
app.phpFunction('formatDate', (d) => new Date(d).toLocaleDateString())
```

### Serveur

```javascript
// Demarrer
app.listen(port?, callback?)

// Fermer
app.close()
```

### Events

App herite de EventEmitter :

```javascript
app.on('listening', (port) => {
  console.log(`Server on port ${port}`);
});
```

---

## Router

Le router interne supporte les parametres dynamiques et les middleware par chemin.

### Parametres

```javascript
app.get('/users/:id', (req, res) => {
  // req.params.id
});

app.get('/posts/:year/:month', (req, res) => {
  // req.params.year, req.params.month
});
```

### Wildcard

```javascript
app.get('/api/*', (req, res) => {
  // Catch-all API route
});
```

---

## VSV

Le systeme VSV gere la compilation et le rendu des composants .jsv/.tsv.

### Options VSV

```javascript
await app.enableVSV({
  componentsDir: 'components',   // Dossier composants
  pagesDir: 'pages',            // Dossier pages
  cacheDir: '.veko/vsv-cache',  // Cache compilation
  ssr: true,                    // SSR active
  hydrate: true,                // Hydratation client
  minify: true,                 // Minification
  precompile: true,             // Precompiler au demarrage
  tailwind: true                // Tailwind CSS integre
});
```

### Composant VSV (.jsv)

```jsx
import './styles.css';
import logo from './logo.png';

export default function Home({ title }) {
  const [count, setCount] = $state(0);

  return (
    <div class="home">
      <img src={logo} alt="Logo" />
      <h1>{title}</h1>
      <button $click={() => setCount(c => c + 1)}>
        Clicks: {count()}
      </button>
    </div>
  );
}
```

### API Reactive

| Hook | Usage |
|------|-------|
| `$state(initial)` | Etat reactif, retourne `[getter, setter]` |
| `$computed(fn)` | Valeur calculee |
| `$effect(fn, deps)` | Effet de bord |
| `$ref(initial)` | Reference DOM |
| `$memo(fn, deps)` | Memoisation |

### Asset Imports

Les composants supportent l import de fichiers statiques :

```jsx
import './styles.css';           // CSS -> injecte <link> dans la page
import logo from './logo.png';   // Image -> URL /_vsv/assets/<hash>.png
import './script.js';            // JS -> injecte <script> dans la page
```

Types supportes : `.css`, `.scss`, `.sass`, `.less`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.webp`, `.avif`, `.woff`, `.woff2`, `.ttf`, `.eot`, `.otf`, `.js`, `.mjs`

### Routes internes

| Route | Description |
|-------|-------------|
| `/_vsv/runtime.js` | Runtime client VSV |
| `/_vsv/component/:name` | Code client du composant |
| `/_vsv/assets/:hash` | Fichiers assets (cache immutable) |
| `/_vsv/tailwind.css` | CSS Tailwind genere |

---

## VekoTailwind

Moteur Tailwind CSS integre a zero dependances. Scanne les composants et genere uniquement le CSS utilise.

### Activation

```javascript
// Simple
const app = await createVSVApp({ tailwind: true });

// Avec config
const app = await createVSVApp({
  tailwind: {
    prefix: '',
    darkMode: 'class',     // 'class' ou 'media'
    theme: {
      colors: { brand: { 500: '#6366f1' } },
      spacing: { '128': '32rem' }
    }
  }
});
```

### CSS servi

Le CSS genere est servi a `/_vsv/tailwind.css` et automatiquement injecte dans le document HTML.

### Directive @apply

```css
.btn {
  @apply px-4 py-2 bg-blue-500 text-white rounded;
}
```

### Directives @tailwind

```css
@tailwind base;        /* CSS reset (Preflight) */
@tailwind components;  /* Placeholder */
@tailwind utilities;   /* Placeholder */
```

### Couleurs

Palette complete : `slate`, `gray`, `zinc`, `neutral`, `stone`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`

Chaque couleur : 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950

### Breakpoints

| Prefix | Min-width |
|--------|-----------|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |
| `2xl:` | 1536px |

### Variantes d etat

`hover:`, `focus:`, `active:`, `visited:`, `disabled:`, `first:`, `last:`, `odd:`, `even:`, `focus-within:`, `focus-visible:`, `placeholder:`, `group-hover:`

---

## VekoPHP

Support de templates PHP-like cote serveur.

```javascript
app.phpRoute('/page', 'template.php', {
  data: { title: 'Hello' }
});
```

Voir [documentation VekoPHP](vsv.md) pour plus de details.

---

## Logger

Systeme de logging integre.

### Methodes

```javascript
app.logger.log(type, message, details?)
```

### Types de Log

| Type | Couleur | Usage |
|------|---------|-------|
| `info` | Bleu | Informations generales |
| `success` | Vert | Operations reussies |
| `warning` | Jaune | Avertissements |
| `error` | Rouge | Erreurs |
| `debug` | Gris | Debogage |
| `server` | Violet | Evenements serveur |
| `route` | Vert | Creation de routes |

---

## Types TypeScript

```typescript
declare module 'veko' {
  import { EventEmitter } from 'events';

  export interface AppOptions {
    port?: number;
    host?: string;
    staticDir?: string;
    isDev?: boolean;
    rateLimit?: {
      windowMs?: number;
      max?: number;
    } | false;
  }

  export interface VSVOptions {
    componentsDir?: string;
    pagesDir?: string;
    cacheDir?: string;
    ssr?: boolean;
    hydrate?: boolean;
    minify?: boolean;
    precompile?: boolean;
    tailwind?: boolean | TailwindOptions;
  }

  export interface TailwindOptions {
    prefix?: string;
    darkMode?: 'class' | 'media';
    theme?: {
      colors?: Record<string, Record<string, string>>;
      spacing?: Record<string, string>;
    };
  }

  export interface SEOOptions {
    title?: string;
    description?: string;
    keywords?: string[];
    robots?: string;
    canonical?: string;
    og?: {
      title?: string;
      description?: string;
      image?: string;
      type?: string;
    };
    twitter?: {
      card?: string;
      site?: string;
      title?: string;
      image?: string;
    };
    jsonLd?: object;
  }

  export interface VSVRouteOptions {
    title?: string;
    props?: Record<string, any>;
    getProps?: (req: VekoRequest) => Promise<Record<string, any>>;
    seo?: SEOOptions;
    hydrate?: boolean;
    ssr?: boolean;
  }

  export interface VekoRequest {
    method: string;
    pathname: string;
    query: Record<string, string>;
    params: Record<string, string>;
    body: any;
    cookies: Record<string, string>;
    headers: Record<string, string>;
  }

  export interface VekoResponse {
    json(data: any): void;
    html(html: string): void;
    send(data: any): void;
    redirect(url: string, code?: number): void;
    status(code: number): VekoResponse;
    setCookie(name: string, value: string, options?: CookieOptions): void;
    setHeader(name: string, value: string): void;
  }

  export interface CookieOptions {
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }

  export class App extends EventEmitter {
    constructor(options?: AppOptions);

    // Routes
    get(path: string, ...handlers: Function[]): this;
    post(path: string, ...handlers: Function[]): this;
    put(path: string, ...handlers: Function[]): this;
    delete(path: string, ...handlers: Function[]): this;
    patch(path: string, ...handlers: Function[]): this;
    all(path: string, ...handlers: Function[]): this;

    // Middleware
    use(handler: Function): this;
    use(path: string, handler: Function): this;

    // VSV
    enableVSV(options?: VSVOptions): Promise<this>;
    vsvRoute(path: string, component: string, options?: VSVRouteOptions): this;
    renderVSV(component: string, props?: object, options?: object): Promise<string>;

    // PHP Templates
    phpRoute(path: string, template: string, options?: object): this;
    renderPHP(template: string, data?: object): Promise<string>;
    phpGlobal(name: string, value: any): this;
    phpFunction(name: string, fn: Function): this;

    // Server
    listen(port?: number, callback?: Function): any;
    close(): void;
  }

  export function createApp(options?: AppOptions): App;
  export function createVSVApp(options?: AppOptions & VSVOptions): Promise<App>;
  export function startDev(options?: AppOptions): void;
  export function start(options?: AppOptions): void;

  export const VSV: any;
  export const VekoPHP: any;
  export const VekoTailwind: any;
}
```

---

## En-tetes de Securite

Veko.js ajoute automatiquement les en-tetes de securite suivants :

| En-tete | Valeur |
|---------|--------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-XSS-Protection` | `1; mode=block` |

---

<p align="center">
  <a href="plugins.md">Plugins</a> |
  <a href="security.md">Securite</a> |
  <a href="vsv.md">VSV</a>
</p>
