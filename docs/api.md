# 📚 API Reference - Veko.js

Référence complète de l'API Veko.js.

## Table des Matières

- [App](#app)
- [RouteManager](#routemanager)
- [LayoutManager](#layoutmanager)
- [AuthManager](#authmanager)
- [PluginManager](#pluginmanager)
- [ReactManager](#reactmanager)
- [DevServer](#devserver)
- [Logger](#logger)

---

## App

Classe principale de l'application Veko.

### Création

```javascript
const { createApp, App } = require('veko');

// Méthode raccourcie
const app = createApp(options);

// Ou instanciation directe
const app = new App(options);
```

### Options

```typescript
interface AppOptions {
  // Serveur
  port?: number;              // Port du serveur (défaut: 3000)
  wsPort?: number;            // Port WebSocket (défaut: 3008)
  isDev?: boolean;            // Mode développement
  
  // Répertoires
  viewsDir?: string;          // Dossier des vues (défaut: 'views')
  staticDir?: string;         // Dossier statique (défaut: 'public')
  routesDir?: string;         // Dossier des routes (défaut: 'routes')
  
  // Sécurité
  security?: {
    helmet?: boolean;         // Activer Helmet (défaut: true)
    rateLimit?: {
      windowMs?: number;      // Fenêtre en ms
      max?: number;           // Requêtes max
    };
    cors?: {
      origin?: string | string[];
      credentials?: boolean;
    };
  };
  
  // Layouts
  layouts?: {
    enabled?: boolean;
    layoutsDir?: string;
    defaultLayout?: string;
    extension?: string;
  };
  
  // Plugins
  plugins?: {
    enabled?: boolean;
    autoLoad?: boolean;
    pluginsDir?: string;
  };
  
  // React
  react?: {
    enabled?: boolean;
    mode?: 'ssr' | 'csr' | 'hybrid' | 'streaming';
    componentsDir?: string;
    hydration?: boolean;
    hmr?: boolean;
  };
  
  // Auto-updater
  autoUpdater?: {
    enabled?: boolean;
    checkOnStart?: boolean;
    autoUpdate?: boolean;
  };
}
```

### Méthodes

#### `listen(port?, callback?)`

Démarre le serveur HTTP.

```javascript
app.listen(3000, () => {
  console.log('Serveur démarré');
});
```

#### `startDev(port?)`

Démarre en mode développement avec hot reload.

```javascript
app.startDev(3000);
```

#### `stop()`

Arrête le serveur proprement.

```javascript
await app.stop();
```

#### `use(middleware)`

Ajoute un middleware Express.

```javascript
app.use(express.json());
app.use(cors());
```

#### `createRoute(method, path, ...handlers)`

Crée une nouvelle route.

```javascript
app.createRoute('GET', '/users', (req, res) => {
  res.json([]);
});

// Avec middleware
app.createRoute('POST', '/users', 
  validateBody,
  app.requireAuth(),
  createUserHandler
);
```

#### `deleteRoute(method, path)`

Supprime une route existante.

```javascript
app.deleteRoute('GET', '/old-route');
```

#### `loadRoutes(routesDir?)`

Charge les routes depuis un dossier.

```javascript
app.loadRoutes('./routes');
```

#### `listRoutes()`

Liste toutes les routes enregistrées.

```javascript
const routes = app.listRoutes();
// [{ method: 'GET', path: '/', ... }, ...]
```

---

## RouteManager

Gestion des routes de l'application.

### Méthodes

#### `createRoute(method, path, handler, options?)`

```typescript
interface RouteOptions {
  name?: string;              // Nom de la route
  middleware?: Function[];    // Middlewares
  rateLimit?: {
    max?: number;
    windowMs?: number;
  };
  cache?: {
    enabled?: boolean;
    maxAge?: number;
  };
  validation?: {
    body?: object;
    params?: object;
    query?: object;
  };
}
```

```javascript
app.routeManager.createRoute('GET', '/api/users/:id', handler, {
  name: 'getUser',
  rateLimit: { max: 60, windowMs: 60000 },
  validation: {
    params: {
      id: { type: 'number', required: true }
    }
  }
});
```

#### `getRoute(method, path)`

Récupère une route.

```javascript
const route = app.routeManager.getRoute('GET', '/users');
```

#### `updateRoute(method, path, handler)`

Met à jour le handler d'une route.

```javascript
app.routeManager.updateRoute('GET', '/users', newHandler);
```

---

## LayoutManager

Gestion des layouts EJS.

### Méthodes

#### `createLayout(name, content?)`

Crée un nouveau layout.

```javascript
app.layoutManager.createLayout('admin', `
<!DOCTYPE html>
<html>
<head><title><%= title %></title></head>
<body>
  <nav>Admin Nav</nav>
  <%- content %>
</body>
</html>
`);
```

#### `deleteLayout(name)`

Supprime un layout.

```javascript
app.layoutManager.deleteLayout('old-layout');
```

#### `listLayouts()`

Liste les layouts disponibles.

```javascript
const layouts = app.layoutManager.listLayouts();
// ['main', 'admin', 'minimal']
```

#### `setDefaultLayout(name)`

Définit le layout par défaut.

```javascript
app.layoutManager.setDefaultLayout('main');
```

---

## AuthManager

Gestion de l'authentification.

### Initialisation

```javascript
await app.enableAuth({
  strategy: 'jwt',
  jwt: {
    secret: 'my-secret',
    expiresIn: '7d'
  }
});
```

### Méthodes

#### `login(email, password)`

Authentifie un utilisateur.

```javascript
const { token, refreshToken, user } = await app.auth.login(email, password);
```

#### `register(userData)`

Inscrit un nouvel utilisateur.

```javascript
const user = await app.auth.register({
  email: 'user@example.com',
  password: 'securepassword',
  name: 'John Doe'
});
```

#### `verifyToken(token)`

Vérifie un JWT.

```javascript
const payload = await app.auth.verifyToken(token);
```

#### `refresh(refreshToken)`

Rafraîchit un token.

```javascript
const { token, refreshToken } = await app.auth.refresh(oldRefreshToken);
```

#### `logout(userId)`

Déconnecte un utilisateur.

```javascript
await app.auth.logout(userId);
```

#### `requireAuth()`

Middleware de protection.

```javascript
app.createRoute('GET', '/protected', app.requireAuth(), handler);
```

#### `requireRole(role)`

Middleware de vérification de rôle.

```javascript
app.createRoute('GET', '/admin', app.requireRole('admin'), handler);
```

---

## PluginManager

Gestion des plugins.

### Méthodes

#### `load(plugin, config?)`

Charge un plugin.

```javascript
await app.plugins.load(require('./my-plugin'), {
  option1: 'value'
});
```

#### `get(name)`

Récupère un plugin.

```javascript
const plugin = app.plugins.get('analytics');
plugin.api.track('event', data);
```

#### `has(name)`

Vérifie si un plugin existe.

```javascript
if (app.plugins.has('cache')) {
  // ...
}
```

#### `list()`

Liste tous les plugins.

```javascript
const plugins = app.plugins.list();
// [{ name: 'analytics', version: '1.0.0', active: true }, ...]
```

#### `disable(name)`

Désactive un plugin.

```javascript
await app.plugins.disable('analytics');
```

#### `enable(name)`

Réactive un plugin.

```javascript
await app.plugins.enable('analytics');
```

#### `reload(name)`

Recharge un plugin.

```javascript
await app.plugins.reload('analytics');
```

#### `executeHook(hookName, ...args)`

Exécute un hook sur tous les plugins.

```javascript
await app.plugins.executeHook('custom:event', data);
```

---

## ReactManager

Gestion du support React SSR/CSR.

### Initialisation

```javascript
await app.enableReact({
  mode: 'hybrid',
  componentsDir: 'components',
  hmr: true
});
```

### Méthodes

#### `registerComponent(name, path)`

Enregistre un composant.

```javascript
await app.react.registerComponent('Dashboard', './components/Dashboard.jsx');
```

#### `renderSSR(component, props)`

Rendu côté serveur.

```javascript
const html = await app.react.renderSSR('HomePage', { title: 'Accueil' });
```

#### `renderCSR(component, props)`

Rendu côté client.

```javascript
const html = await app.react.renderCSR('App', { user });
```

#### `renderHybrid(component, props, options)`

Rendu hybride (SSR + hydratation).

```javascript
const html = await app.react.renderHybrid('Page', props, {
  layout: 'MainLayout'
});
```

#### `renderStream(component, props, res)`

Streaming SSR.

```javascript
await app.react.renderStream('LargePage', props, res);
```

### Méthodes App

#### `app.reactRoute(path, component, options)`

Crée une route React.

```javascript
app.reactRoute('/dashboard', 'Dashboard', {
  mode: 'ssr',
  getInitialProps: async ({ req }) => {
    return { user: req.user };
  }
});
```

#### `app.renderReact(component, props, options)`

Render manuel d'un composant.

```javascript
const html = await app.renderReact('Widget', { data }, { mode: 'ssr' });
```

#### `app.buildReact(options)`

Build pour production.

```javascript
await app.buildReact({
  minify: true,
  sourcemap: false
});
```

---

## DevServer

Serveur de développement avec hot reload.

### Configuration

```javascript
const app = createApp({
  isDev: true,
  wsPort: 3008,
  watchDirs: ['views', 'routes', 'public']
});
```

### Méthodes

#### `setup()`

Configure le serveur de développement.

```javascript
app.devServer.setup();
```

#### `stop()`

Arrête le serveur de développement.

```javascript
app.devServer.stop();
```

#### `notifyClients(type, data)`

Notifie les clients connectés.

```javascript
app.devServer.notifyClients('custom-event', { message: 'Hello' });
```

---

## Logger

Système de logging.

### Méthodes

#### `log(type, message, details?)`

Log un message.

```javascript
app.log('info', 'Message informatif');
app.log('success', 'Opération réussie', '✓');
app.log('warning', 'Attention', 'Détails...');
app.log('error', 'Erreur', error.message);
app.log('debug', 'Debug info', data);
```

### Types de Log

| Type | Couleur | Usage |
|------|---------|-------|
| `info` | Bleu | Informations générales |
| `success` | Vert | Opérations réussies |
| `warning` | Jaune | Avertissements |
| `error` | Rouge | Erreurs |
| `debug` | Gris | Débogage |
| `server` | Violet | Événements serveur |
| `dev` | Cyan | Mode développement |
| `route` | Vert | Création de routes |

---

## Types TypeScript

```typescript
// types/veko.d.ts
declare module 'veko' {
  import { Express, Request, Response, NextFunction } from 'express';

  export interface VekoApp {
    app: Express;
    express: Express;
    
    // Routing
    createRoute(method: string, path: string, ...handlers: Function[]): void;
    deleteRoute(method: string, path: string): void;
    loadRoutes(dir?: string): void;
    listRoutes(): Route[];
    
    // Layouts
    createLayout(name: string, content?: string): void;
    deleteLayout(name: string): void;
    listLayouts(): string[];
    
    // Auth
    enableAuth(config: AuthConfig): Promise<void>;
    requireAuth(): Function;
    requireRole(role: string): Function;
    
    // React
    enableReact(config: ReactConfig): Promise<void>;
    reactRoute(path: string, component: string, options?: ReactRouteOptions): void;
    renderReact(component: string, props?: object, options?: RenderOptions): Promise<string>;
    
    // Plugins
    plugins: PluginManager;
    
    // Lifecycle
    listen(port?: number, callback?: Function): void;
    startDev(port?: number): void;
    stop(): Promise<void>;
    use(middleware: Function): this;
    
    // Logging
    log(type: string, message: string, details?: string): void;
  }

  export interface Route {
    method: string;
    path: string;
    name?: string;
    handler: Function;
  }

  export interface AuthConfig {
    strategy: 'jwt' | 'session' | 'hybrid';
    jwt?: JWTConfig;
    session?: SessionConfig;
    oauth?: OAuthConfig;
  }

  export interface ReactConfig {
    enabled?: boolean;
    mode?: 'ssr' | 'csr' | 'hybrid' | 'streaming';
    componentsDir?: string;
    hydration?: boolean;
    hmr?: boolean;
  }

  export function createApp(options?: AppOptions): VekoApp;
  export function createReactApp(options?: AppOptions): Promise<VekoApp>;
  export function startDev(options?: AppOptions): void;
  export function start(options?: AppOptions): void;
  
  export class App implements VekoApp { /* ... */ }
}
```

---

<p align="center">
  <a href="plugins.md">← Plugins</a> •
  <a href="security.md">Sécurité →</a>
</p>
