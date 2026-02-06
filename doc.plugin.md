# Plugins - Veko.js

Voir la documentation complete : [docs/plugins.md](docs/plugins.md)

## Quick Start

```javascript
// plugins/my-plugin.js
module.exports = function myPlugin(app, options = {}) {
  app.use((req, res, next) => {
    // Votre middleware
    next();
  });

  app.get('/plugin-route', (req, res) => {
    res.json({ plugin: true });
  });
};
```

```javascript
// app.js
const myPlugin = require('./plugins/my-plugin');
myPlugin(app, { option: 'value' });
```
