/**
 * VSV - Veko Server Views
 * Ultra-fast component system with .jsv and .tsv files
 * Zero dependencies, built for SEO and performance
 * @module veko/vsv
 */

const VSVCompiler = require('./compiler');
const VSVParser = require('./parser');
const VSVRuntime = require('./runtime');
const VSVRenderer = require('./renderer');
const VDOM = require('./vdom');

class VSV {
  constructor(app, options = {}) {
    this.app = app;
    this.options = {
      componentsDir: options.componentsDir || 'components',
      pagesDir: options.pagesDir || 'pages',
      cacheDir: options.cacheDir || '.veko/vsv-cache',
      ssr: options.ssr !== false,
      hydrate: options.hydrate !== false,
      minify: options.minify !== false,
      precompile: options.precompile !== false,
      ...options
    };
    
    this.compiler = new VSVCompiler(this);
    this.parser = new VSVParser(this);
    this.renderer = new VSVRenderer(this);
    this.runtime = new VSVRuntime(this);
    this.vdom = VDOM;
    
    // Component cache
    this.componentCache = new Map();
    this.compiledCache = new Map();
    
    // Performance metrics
    this.metrics = {
      compilations: 0,
      renders: 0,
      cacheHits: 0,
      avgRenderTime: 0
    };
  }

  /**
   * Initialize VSV system
   */
  async init() {
    const fs = require('fs');
    const path = require('path');
    
    // Create cache directory
    const cacheDir = path.join(process.cwd(), this.options.cacheDir);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Precompile components if enabled
    if (this.options.precompile) {
      await this.precompileAll();
    }
    
    // Register middleware
    this.registerMiddleware();
    
    return this;
  }

  /**
   * Register VSV middleware
   */
  registerMiddleware() {
    // Serve client runtime
    this.app.get('/_vsv/runtime.js', (req, res) => {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(this.runtime.getClientRuntime());
    });
    
    // Serve compiled components
    this.app.get('/_vsv/components/:name.js', (req, res) => {
      const compiled = this.compiledCache.get(req.params.name);
      if (compiled) {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(compiled.client);
      } else {
        res.statusCode = 404;
        res.end('Component not found');
      }
    });
  }

  /**
   * Precompile all components
   */
  async precompileAll() {
    const fs = require('fs');
    const path = require('path');
    
    const componentsPath = path.join(process.cwd(), this.options.componentsDir);
    if (!fs.existsSync(componentsPath)) return;
    
    const files = this.findVSVFiles(componentsPath);
    for (const file of files) {
      await this.compileFile(file);
    }
  }

  /**
   * Find all .jsv and .tsv files
   */
  findVSVFiles(dir, files = []) {
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(dir)) return files;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        this.findVSVFiles(fullPath, files);
      } else if (item.endsWith('.jsv') || item.endsWith('.tsv')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Compile a VSV file
   */
  async compileFile(filePath) {
    const fs = require('fs');
    const path = require('path');
    
    const source = fs.readFileSync(filePath, 'utf-8');
    const name = path.basename(filePath, path.extname(filePath));
    const isTypeScript = filePath.endsWith('.tsv');
    
    const compiled = await this.compiler.compile(source, {
      filename: filePath,
      name,
      typescript: isTypeScript
    });
    
    this.compiledCache.set(name, compiled);
    this.metrics.compilations++;
    
    return compiled;
  }

  /**
   * Render a component to HTML (SSR)
   */
  async render(componentName, props = {}, options = {}) {
    const startTime = Date.now();
    
    // Check cache
    let compiled = this.compiledCache.get(componentName);
    if (!compiled) {
      // Try to find and compile
      const filePath = await this.findComponent(componentName);
      if (filePath) {
        compiled = await this.compileFile(filePath);
      } else {
        throw new Error(`Component "${componentName}" not found`);
      }
    } else {
      this.metrics.cacheHits++;
    }
    
    // Render
    const html = await this.renderer.render(compiled, props, options);
    
    // Update metrics
    this.metrics.renders++;
    const renderTime = Date.now() - startTime;
    this.metrics.avgRenderTime = 
      (this.metrics.avgRenderTime * (this.metrics.renders - 1) + renderTime) / this.metrics.renders;
    
    return html;
  }

  /**
   * Find component file
   */
  async findComponent(name) {
    const fs = require('fs');
    const path = require('path');
    
    const extensions = ['.jsv', '.tsv'];
    const dirs = [
      path.join(process.cwd(), this.options.componentsDir),
      path.join(process.cwd(), this.options.pagesDir)
    ];
    
    for (const dir of dirs) {
      for (const ext of extensions) {
        const filePath = path.join(dir, name + ext);
        if (fs.existsSync(filePath)) {
          return filePath;
        }
        
        // Check subdirectories
        const indexPath = path.join(dir, name, 'index' + ext);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
    }
    
    return null;
  }

  /**
   * Create a component programmatically
   */
  component(name, definition) {
    const compiled = this.compiler.compileDefinition(name, definition);
    this.compiledCache.set(name, compiled);
    return compiled;
  }

  /**
   * Render page with layout
   */
  async renderPage(pageName, props = {}, options = {}) {
    const html = await this.render(pageName, props, {
      ...options,
      isPage: true
    });
    
    // Wrap with HTML document if needed
    if (options.fullDocument !== false) {
      return this.wrapDocument(html, {
        title: props.title || pageName,
        ...options
      });
    }
    
    return html;
  }

  /**
   * Wrap content in HTML document
   */
  wrapDocument(content, options = {}) {
    const scripts = options.hydrate !== false ? `
    <script src="/_vsv/runtime.js"></script>
    <script>VSV.hydrate()</script>
    ` : '';
    
    return `<!DOCTYPE html>
<html lang="${options.lang || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title || 'VSV App'}</title>
  ${options.meta || ''}
  ${options.styles || ''}
</head>
<body>
  <div id="app">${content}</div>
  ${scripts}
  ${options.scripts || ''}
</body>
</html>`;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }
}

// Export
module.exports = VSV;
module.exports.VSV = VSV;
module.exports.VDOM = VDOM;
