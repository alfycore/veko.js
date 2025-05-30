const path = require('path');
const fs = require('fs');

class LayoutManager {
  constructor(app, options) {
    this.app = app;
    this.options = options;
    this.layoutCache = new Map();
    this.layoutSections = new Map();
  }

  middleware() {
    return (req, res, next) => {
      const originalRender = res.render;
      
      res.render = (view, options = {}, callback) => {
        if (options.layout === false) {
          return originalRender.call(res, view, options, callback);
        }
        
        const layoutName = options.layout || this.options.defaultLayout;
        const layoutData = this.prepareLayoutData(view, options, req);
        
        this.renderWithLayout(res, view, layoutName, layoutData, originalRender, callback);
      };
      
      res.locals.layout = this.createLayoutHelpers(req, res);
      next();
    };
  }

  prepareLayoutData(view, options, req) {
    return {
      ...options,
      view,
      sections: options.sections || {},
      meta: {
        title: options.title || 'Veko.js App',
        description: options.description || '',
        keywords: options.keywords || '',
        ...options.meta
      },
      layout: {
        css: options.css || [],
        js: options.js || [],
        bodyClass: options.bodyClass || '',
        ...options.layout
      },
      request: {
        url: req.url,
        path: req.path,
        method: req.method,
        query: req.query,
        params: req.params
      }
    };
  }

  async renderWithLayout(res, view, layoutName, data, originalRender, callback) {
    try {
      const content = await this.renderViewToString(view, data);
      data.sections.content = content;
      
      const layoutPath = this.getLayoutPath(layoutName);
      
      if (fs.existsSync(layoutPath)) {
        originalRender.call(res, layoutPath, data, callback);
      } else {
        this.createDefaultLayout(layoutName);
        originalRender.call(res, layoutPath, data, callback);
      }
    } catch (error) {
      this.app.logger.log('error', 'Layout render error', error.message);
      originalRender.call(res, view, data, callback);
    }
  }

  renderViewToString(view, data) {
    return new Promise((resolve, reject) => {
      const viewPath = this.resolveViewPath(view);
      
      if (!fs.existsSync(viewPath)) {
        reject(new Error(`View not found: ${view}`));
        return;
      }
      
      try {
        const ejs = require('ejs');
        const template = fs.readFileSync(viewPath, 'utf8');
        const html = ejs.render(template, data);
        resolve(html);
      } catch (error) {
        reject(error);
      }
    });
  }

  resolveViewPath(view) {
    const viewsDir = path.join(process.cwd(), this.app.options.viewsDir);
    let viewPath = path.join(viewsDir, view);
    
    if (!viewPath.endsWith('.ejs')) {
      viewPath += '.ejs';
    }
    
    return viewPath;
  }

  getLayoutPath(layoutName) {
    const layoutsDir = path.join(process.cwd(), this.options.layoutsDir);
    let layoutPath = path.join(layoutsDir, layoutName);
    
    if (!layoutPath.endsWith(this.options.extension)) {
      layoutPath += this.options.extension;
    }
    
    return layoutPath;
  }

  createLayoutHelpers(req, res) {
    return {
      section: (name, content) => {
        if (!res.locals.sections) res.locals.sections = {};
        res.locals.sections[name] = content;
        return '';
      },
      
      css: (href) => {
        if (!res.locals.css) res.locals.css = [];
        res.locals.css.push(href);
        return '';
      },
      
      js: (src) => {
        if (!res.locals.js) res.locals.js = [];
        res.locals.js.push(src);
        return '';
      },
      
      title: (title) => {
        res.locals.title = title;
        return '';
      },
      
      meta: (name, content) => {
        if (!res.locals.meta) res.locals.meta = {};
        res.locals.meta[name] = content;
        return '';
      }
    };
  }

  createDefaultLayout(layoutName) {
    const layoutsDir = path.join(process.cwd(), this.options.layoutsDir);
    
    if (!fs.existsSync(layoutsDir)) {
      fs.mkdirSync(layoutsDir, { recursive: true });
      this.app.logger.log('create', 'Layouts directory created', `📁 ${path.relative(process.cwd(), layoutsDir)}`);
    }
    
    const layoutPath = this.getLayoutPath(layoutName);
    
    if (!fs.existsSync(layoutPath)) {
      const defaultLayoutContent = this.generateDefaultLayoutContent();
      fs.writeFileSync(layoutPath, defaultLayoutContent, 'utf8');
      
      const relativePath = path.relative(process.cwd(), layoutPath);
      this.app.logger.log('create', 'Default layout created', `📄 ${relativePath}`);
    }
  }

  generateDefaultLayoutContent() {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= meta.title || 'Veko.js App' %></title>
    
    <% if (meta.description) { %>
    <meta name="description" content="<%= meta.description %>">
    <% } %>
    
    <% if (meta.keywords) { %>
    <meta name="keywords" content="<%= meta.keywords %>">
    <% } %>
    
    <!-- CSS par défaut -->
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            line-height: 1.6;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem 0;
        }
        footer {
            background: #333;
            color: white;
            text-align: center;
            padding: 1rem 0;
            margin-top: 2rem;
        }
    </style>
    
    <!-- CSS personnalisé -->
    <% if (layout && layout.css) { %>
        <% layout.css.forEach(href => { %>
        <link rel="stylesheet" href="<%= href %>">
        <% }); %>
    <% } %>
    
    <!-- Section head personnalisée -->
    <% if (sections && sections.head) { %>
    <%- sections.head %>
    <% } %>
</head>
<body class="<%= layout && layout.bodyClass || '' %>">
    <!-- Header -->
    <% if (sections && sections.header) { %>
    <header>
        <%- sections.header %>
    </header>
    <% } else { %>
    <header>
        <div class="container">
            <h1>🚀 Veko.js</h1>
            <p>Ultra modern Node.js framework</p>
        </div>
    </header>
    <% } %>
    
    <!-- Contenu principal -->
    <main class="container">
        <%- sections.content %>
    </main>
    
    <!-- Footer -->
    <% if (sections && sections.footer) { %>
    <footer>
        <%- sections.footer %>
    </footer>
    <% } else { %>
    <footer>
        <div class="container">
            <p>Powered by Veko.js ⚡</p>
        </div>
    </footer>
    <% } %>
    
    <!-- JavaScript -->
    <% if (layout && layout.js) { %>
        <% layout.js.forEach(src => { %>
        <script src="<%= src %>"></script>
        <% }); %>
    <% } %>
    
    <!-- Section scripts personnalisée -->
    <% if (sections && sections.scripts) { %>
    <%- sections.scripts %>
    <% } %>
</body>
</html>`;
  }

  createLayout(layoutName, content = null) {
    try {
      const layoutPath = this.getLayoutPath(layoutName);
      const layoutsDir = path.dirname(layoutPath);
      
      if (!fs.existsSync(layoutsDir)) {
        fs.mkdirSync(layoutsDir, { recursive: true });
      }
      
      const layoutContent = content || this.generateDefaultLayoutContent();
      fs.writeFileSync(layoutPath, layoutContent, 'utf8');
      
      const relativePath = path.relative(process.cwd(), layoutPath);
      this.app.logger.log('create', 'Layout created', `📄 ${relativePath}`);
      
      return this.app;
    } catch (error) {
      this.app.logger.log('error', 'Error creating layout', error.message);
      return this.app;
    }
  }

  deleteLayout(layoutName) {
    try {
      const layoutPath = this.getLayoutPath(layoutName);
      
      if (fs.existsSync(layoutPath)) {
        fs.unlinkSync(layoutPath);
        
        const relativePath = path.relative(process.cwd(), layoutPath);
        this.app.logger.log('delete', 'Layout deleted', `📄 ${relativePath}`);
      } else {
        this.app.logger.log('warning', 'Layout not found', `📄 ${layoutName}`);
      }
      
      return this.app;
    } catch (error) {
      this.app.logger.log('error', 'Error deleting layout', error.message);
      return this.app;
    }
  }

  listLayouts() {
    const layoutsDir = path.join(process.cwd(), this.options.layoutsDir);
    
    if (!fs.existsSync(layoutsDir)) {
      return [];
    }
    
    return fs.readdirSync(layoutsDir)
      .filter(file => file.endsWith(this.options.extension))
      .map(file => file.replace(this.options.extension, ''));
  }

  reloadLayouts() {
    this.layoutCache.clear();
    this.app.logger.log('reload', 'Layout cache cleared', '🎨 All layouts refreshed');
  }
}

module.exports = LayoutManager;