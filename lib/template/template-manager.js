const EJSEngine = require('./ejs-engine');
const path = require('path');

class TemplateManager {
  constructor(app, options = {}) {
    this.app = app;
    this.options = {
      engine: 'ejs',
      viewsDir: options.viewsDir || 'views',
      cache: process.env.NODE_ENV === 'production',
      watch: process.env.NODE_ENV !== 'production',
      ...options
    };

    this.engines = new Map();
    this.setupEngines();
  }

  /**
   * Configure les moteurs de template
   */
  setupEngines() {
    // Moteur EJS personnalisé
    const ejsEngine = new EJSEngine(this.options);
    this.engines.set('ejs', ejsEngine);

    // Enregistrement avec Express
    this.app.app.engine('ejs', (filePath, options, callback) => {
      ejsEngine.render(filePath, options, callback);
    });

    this.app.app.set('view engine', 'ejs');
    this.app.app.set('views', this.options.viewsDir);
  }

  /**
   * Rend un template
   */
  async render(templateName, locals = {}, options = {}) {
    const engine = this.engines.get(this.options.engine);
    if (!engine) {
      throw new Error(`Template engine not found: ${this.options.engine}`);
    }

    return await engine.render(templateName, locals);
  }

  /**
   * Compile un template
   */
  async compile(templateName) {
    const engine = this.engines.get(this.options.engine);
    if (!engine) {
      throw new Error(`Template engine not found: ${this.options.engine}`);
    }

    return await engine.compileTemplate(templateName);
  }

  /**
   * Crée un template de base
   */
  async createTemplate(name, content, dir = '') {
    const fs = require('fs').promises;
    const templatePath = path.join(this.options.viewsDir, dir, name + '.ejs');
    
    // Créer le répertoire si nécessaire
    await fs.mkdir(path.dirname(templatePath), { recursive: true });
    
    // Écrire le template
    await fs.writeFile(templatePath, content, 'utf8');
    
    return templatePath;
  }

  /**
   * Template de base par défaut
   */
  getDefaultTemplate() {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title || 'Veko.js App' %></title>
    
    <% if (locals.css && Array.isArray(locals.css)) { %>
        <% locals.css.forEach(href => { %>
        <link rel="stylesheet" href="<%= href %>">
        <% }); %>
    <% } %>
</head>
<body>
    <header>
        <h1><%= title || 'Welcome to Veko.js' %></h1>
    </header>
    
    <main>
        <%- content || '<p>Welcome to your Veko.js application!</p>' %>
    </main>
    
    <footer>
        <p>Powered by Veko.js ⚡</p>
    </footer>
    
    <% if (locals.js && Array.isArray(locals.js)) { %>
        <% locals.js.forEach(src => { %>
        <script src="<%= src %>"></script>
        <% }); %>
    <% } %>
</body>
</html>`;
  }

  /**
   * Crée les templates par défaut
   */
  async createDefaultTemplates() {
    const templates = [
      {
        name: 'layout',
        content: this.getDefaultTemplate(),
        dir: 'layouts'
      },
      {
        name: 'index',
        content: `<% layout('layouts/layout') %>
<h2>Home Page</h2>
<p>This is the home page of your Veko.js application.</p>`,
        dir: ''
      },
      {
        name: '404',
        content: `<% layout('layouts/layout') %>
<h2>Page Not Found</h2>
<p>The page you requested could not be found.</p>`,
        dir: 'errors'
      }
    ];

    for (const template of templates) {
      try {
        await this.createTemplate(template.name, template.content, template.dir);
        this.app.logger?.log('info', `Created template: ${template.name}.ejs`);
      } catch (error) {
        this.app.logger?.log('error', `Failed to create template: ${template.name}`, error.message);
      }
    }
  }

  /**
   * Nettoie les caches
   */
  clearCache() {
    for (const [name, engine] of this.engines) {
      if (engine.clearCache) {
        engine.clearCache();
      }
    }
  }

  /**
   * Ferme le gestionnaire
   */
  close() {
    for (const [name, engine] of this.engines) {
      if (engine.close) {
        engine.close();
      }
    }
  }

  /**
   * Statistiques du gestionnaire
   */
  getStats() {
    const stats = {};
    for (const [name, engine] of this.engines) {
      if (engine.getStats) {
        stats[name] = engine.getStats();
      }
    }
    return stats;
  }
}

module.exports = TemplateManager;