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
const VekoPHP = require('./php');

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
      tailwind: options.tailwind || false,
      ...options
    };
    
    this.compiler = new VSVCompiler(this);
    this.parser = new VSVParser(this);
    this.renderer = new VSVRenderer(this);
    this.runtime = new VSVRuntime(this);
    this.php = new VekoPHP(this);
    this.vdom = VDOM;
    
    // Component cache
    this.componentCache = new Map();
    this.compiledCache = new Map();
    
    // Asset tracking
    this.assetCache = new Map(); // hash -> { content, mimeType }
    this.componentAssets = new Map(); // componentName -> { css: [], js: [], images: [] }
    
    // Tailwind CSS support
    this.tailwind = null;
    if (this.options.tailwind) {
      this.tailwind = new VekoTailwind(
        typeof this.options.tailwind === 'object' ? this.options.tailwind : {}
      );
    }
    
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
    const fs = require('fs');
    const path = require('path');
    
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
    
    // Serve component assets (CSS, JS, images, fonts)
    this.app.get('/_vsv/assets/:hash', (req, res) => {
      const asset = this.assetCache.get(req.params.hash);
      if (asset) {
        res.setHeader('Content-Type', asset.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        if (Buffer.isBuffer(asset.content)) {
          res.end(asset.content);
        } else {
          res.end(asset.content);
        }
      } else {
        res.statusCode = 404;
        res.end('Asset not found');
      }
    });
    
    // Serve Tailwind CSS (generated on-the-fly or cached)
    if (this.tailwind) {
      this.app.get('/_vsv/tailwind.css', (req, res) => {
        res.setHeader('Content-Type', 'text/css');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(this.tailwind.getCSS());
      });
    }
  }

  /**
   * Process and register assets from a compiled component
   */
  processAssets(componentName, assets, filePath) {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    
    if (!assets) return;
    
    const MIME_MAP = {
      '.css': 'text/css',
      '.scss': 'text/css',
      '.sass': 'text/css',
      '.less': 'text/css',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.bmp': 'image/bmp',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'font/otf'
    };
    
    const componentAssetInfo = { css: [], js: [], images: [], fonts: [] };
    
    const processAssetList = (assetList, type) => {
      for (const asset of assetList) {
        try {
          const resolvedPath = asset.resolvedPath || 
            path.resolve(path.dirname(filePath), asset.path);
          
          if (!fs.existsSync(resolvedPath)) {
            console.warn(`[VSV] Asset not found: ${asset.path} (resolved: ${resolvedPath})`);
            continue;
          }
          
          // Read binary for images/fonts, text for CSS/JS
          const isBinary = ['images', 'fonts'].includes(type);
          const content = fs.readFileSync(resolvedPath, isBinary ? null : 'utf-8');
          
          // Generate hash for cache-busting
          const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 12);
          const ext = path.extname(resolvedPath).toLowerCase();
          const assetHash = `${hash}${ext}`;
          
          // Cache the asset
          this.assetCache.set(assetHash, {
            content,
            mimeType: MIME_MAP[ext] || 'application/octet-stream',
            originalPath: asset.path,
            resolvedPath
          });
          
          // Track for the component
          const url = `/_vsv/assets/${assetHash}`;
          componentAssetInfo[type].push({
            url,
            hash: assetHash,
            varName: asset.varName,
            originalPath: asset.path
          });
          
          // If Tailwind enabled and it's a CSS file, scan for @tailwind directives
          if (this.tailwind && type === 'css' && typeof content === 'string') {
            if (content.includes('@tailwind') || content.includes('@apply')) {
              this.tailwind.processCSS(content);
            }
          }
        } catch (e) {
          console.warn(`[VSV] Failed to process asset ${asset.path}: ${e.message}`);
        }
      }
    };
    
    processAssetList(assets.css || [], 'css');
    processAssetList(assets.js || [], 'js');
    processAssetList(assets.images || [], 'images');
    processAssetList(assets.fonts || [], 'fonts');
    
    // Also process "other" assets
    if (assets.other) {
      for (const asset of assets.other) {
        try {
          const resolvedPath = asset.resolvedPath || 
            path.resolve(path.dirname(filePath), asset.path);
          if (!fs.existsSync(resolvedPath)) continue;
          
          const content = fs.readFileSync(resolvedPath);
          const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 12);
          const ext = path.extname(resolvedPath).toLowerCase();
          const assetHash = `${hash}${ext}`;
          
          this.assetCache.set(assetHash, {
            content,
            mimeType: MIME_MAP[ext] || 'application/octet-stream',
            originalPath: asset.path,
            resolvedPath
          });
        } catch (e) {
          console.warn(`[VSV] Failed to process asset ${asset.path}: ${e.message}`);
        }
      }
    }
    
    this.componentAssets.set(componentName, componentAssetInfo);
    return componentAssetInfo;
  }

  /**
   * Get asset tags (CSS links, JS scripts) for a component
   */
  getAssetTags(componentName) {
    const assets = this.componentAssets.get(componentName);
    if (!assets) return { styles: '', scripts: '' };
    
    let styles = '';
    let scripts = '';
    
    // CSS link tags
    for (const css of assets.css) {
      styles += `  <link rel="stylesheet" href="${css.url}">\n`;
    }
    
    // JS script tags
    for (const js of assets.js) {
      scripts += `  <script src="${js.url}"></script>\n`;
    }
    
    return { styles, scripts };
  }

  /**
   * Get image URL for an imported image
   * Used when resolving `import logo from './logo.png'` -> url
   */
  getAssetUrl(componentName, varName) {
    const assets = this.componentAssets.get(componentName);
    if (!assets) return null;
    
    for (const type of ['images', 'fonts', 'css', 'js']) {
      for (const asset of assets[type]) {
        if (asset.varName === varName) {
          return asset.url;
        }
      }
    }
    return null;
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
      } else if (item.endsWith('.jsv') || item.endsWith('.tsv') || item.endsWith('.php')) {
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
    const ext = path.extname(filePath);
    
    // PHP files use the PHP engine
    if (ext === '.php') {
      const fn = this.php.compile(source, { filename: filePath });
      const compiled = {
        type: 'php',
        server: fn,
        client: '',
        name,
        render: fn
      };
      this.compiledCache.set(name, compiled);
      this.metrics.compilations++;
      return compiled;
    }
    
    const isTypeScript = filePath.endsWith('.tsv');
    
    const compiled = await this.compiler.compile(source, {
      filename: filePath,
      name,
      typescript: isTypeScript
    });
    
    // Process imported assets (CSS, JS, images, fonts)
    if (compiled.assets) {
      this.processAssets(name, compiled.assets, filePath);
    }
    
    // If Tailwind enabled, scan component source for utility classes
    if (this.tailwind) {
      this.tailwind.scan(source);
    }
    
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
    if (compiled.type === 'php') {
      // PHP template - run the compiled function directly
      const html = await compiled.render(props, options._req || null, options._res || null);
      this.metrics.renders++;
      const renderTime = Date.now() - startTime;
      this.metrics.avgRenderTime = 
        (this.metrics.avgRenderTime * (this.metrics.renders - 1) + renderTime) / this.metrics.renders;
      return html;
    }
    
    // JSV/TSV - use VSV renderer
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
    
    const extensions = ['.jsv', '.tsv', '.php'];
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
      // Get asset tags for this component
      const assetTags = this.getAssetTags(pageName);
      
      return this.wrapDocument(html, {
        title: props.title || pageName,
        componentName: pageName,
        ...options,
        // Merge component assets with any user-provided styles/scripts
        styles: (options.styles || '') + assetTags.styles,
        scripts: (options.scripts || '') + assetTags.scripts
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
    
    // Tailwind CSS
    const tailwindLink = this.tailwind 
      ? '  <link rel="stylesheet" href="/_vsv/tailwind.css">\n' 
      : '';
    
    return `<!DOCTYPE html>
<html lang="${options.lang || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title || 'VSV App'}</title>
  ${options.meta || ''}
${tailwindLink}${options.styles || ''}
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

/**
 * VekoTailwind - Zero-dependency Tailwind CSS utility class generator
 * Scans component source for utility classes and generates CSS on-the-fly
 */
class VekoTailwind {
  constructor(options = {}) {
    this.options = {
      prefix: options.prefix || '',
      darkMode: options.darkMode || 'class',
      theme: {
        colors: {
          transparent: 'transparent',
          current: 'currentColor',
          black: '#000',
          white: '#fff',
          slate: { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a',950:'#020617' },
          gray: { 50:'#f9fafb',100:'#f3f4f6',200:'#e5e7eb',300:'#d1d5db',400:'#9ca3af',500:'#6b7280',600:'#4b5563',700:'#374151',800:'#1f2937',900:'#111827',950:'#030712' },
          zinc: { 50:'#fafafa',100:'#f4f4f5',200:'#e4e4e7',300:'#d4d4d8',400:'#a1a1aa',500:'#71717a',600:'#52525b',700:'#3f3f46',800:'#27272a',900:'#18181b',950:'#09090b' },
          red: { 50:'#fef2f2',100:'#fee2e2',200:'#fecaca',300:'#fca5a5',400:'#f87171',500:'#ef4444',600:'#dc2626',700:'#b91c1c',800:'#991b1b',900:'#7f1d1d',950:'#450a0a' },
          orange: { 50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',500:'#f97316',600:'#ea580c',700:'#c2410c',800:'#9a3412',900:'#7c2d12',950:'#431407' },
          amber: { 50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f',950:'#451a03' },
          yellow: { 50:'#fefce8',100:'#fef9c3',200:'#fef08a',300:'#fde047',400:'#facc15',500:'#eab308',600:'#ca8a04',700:'#a16207',800:'#854d0e',900:'#713f12',950:'#422006' },
          lime: { 50:'#f7fee7',100:'#ecfccb',200:'#d9f99d',300:'#bef264',400:'#a3e635',500:'#84cc16',600:'#65a30d',700:'#4d7c0f',800:'#3f6212',900:'#365314',950:'#1a2e05' },
          green: { 50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d',950:'#052e16' },
          emerald: { 50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b',950:'#022c22' },
          teal: { 50:'#f0fdfa',100:'#ccfbf1',200:'#99f6e4',300:'#5eead4',400:'#2dd4bf',500:'#14b8a6',600:'#0d9488',700:'#0f766e',800:'#115e59',900:'#134e4a',950:'#042f2e' },
          cyan: { 50:'#ecfeff',100:'#cffafe',200:'#a5f3fc',300:'#67e8f9',400:'#22d3ee',500:'#06b6d4',600:'#0891b2',700:'#0e7490',800:'#155e75',900:'#164e63',950:'#083344' },
          sky: { 50:'#f0f9ff',100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',400:'#38bdf8',500:'#0ea5e9',600:'#0284c7',700:'#0369a1',800:'#075985',900:'#0c4a6e',950:'#082f49' },
          blue: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a',950:'#172554' },
          indigo: { 50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81',950:'#1e1b4b' },
          violet: { 50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95',950:'#2e1065' },
          purple: { 50:'#faf5ff',100:'#f3e8ff',200:'#e9d5ff',300:'#d8b4fe',400:'#c084fc',500:'#a855f7',600:'#9333ea',700:'#7e22ce',800:'#6b21a8',900:'#581c87',950:'#3b0764' },
          fuchsia: { 50:'#fdf4ff',100:'#fae8ff',200:'#f5d0fe',300:'#f0abfc',400:'#e879f9',500:'#d946ef',600:'#c026d3',700:'#a21caf',800:'#86198f',900:'#701a75',950:'#4a044e' },
          pink: { 50:'#fdf2f8',100:'#fce7f3',200:'#fbcfe8',300:'#f9a8d4',400:'#f472b6',500:'#ec4899',600:'#db2777',700:'#be185d',800:'#9d174d',900:'#831843',950:'#500724' },
          rose: { 50:'#fff1f2',100:'#ffe4e6',200:'#fecdd3',300:'#fda4af',400:'#fb7185',500:'#f43f5e',600:'#e11d48',700:'#be123c',800:'#9f1239',900:'#881337',950:'#4c0519' },
          ...(options.theme?.colors || {})
        },
        spacing: {
          0:'0px', px:'1px', 0.5:'0.125rem', 1:'0.25rem', 1.5:'0.375rem', 2:'0.5rem', 2.5:'0.625rem',
          3:'0.75rem', 3.5:'0.875rem', 4:'1rem', 5:'1.25rem', 6:'1.5rem', 7:'1.75rem', 8:'2rem',
          9:'2.25rem', 10:'2.5rem', 11:'2.75rem', 12:'3rem', 14:'3.5rem', 16:'4rem', 20:'5rem',
          24:'6rem', 28:'7rem', 32:'8rem', 36:'9rem', 40:'10rem', 44:'11rem', 48:'12rem',
          52:'13rem', 56:'14rem', 60:'15rem', 64:'16rem', 72:'18rem', 80:'20rem', 96:'24rem',
          ...(options.theme?.spacing || {})
        },
        borderRadius: {
          none:'0px', sm:'0.125rem', '':'0.25rem', md:'0.375rem', lg:'0.5rem', 
          xl:'0.75rem', '2xl':'1rem', '3xl':'1.5rem', full:'9999px',
          ...(options.theme?.borderRadius || {})
        },
        fontSize: {
          xs:['0.75rem',{lineHeight:'1rem'}], sm:['0.875rem',{lineHeight:'1.25rem'}],
          base:['1rem',{lineHeight:'1.5rem'}], lg:['1.125rem',{lineHeight:'1.75rem'}],
          xl:['1.25rem',{lineHeight:'1.75rem'}], '2xl':['1.5rem',{lineHeight:'2rem'}],
          '3xl':['1.875rem',{lineHeight:'2.25rem'}], '4xl':['2.25rem',{lineHeight:'2.5rem'}],
          '5xl':['3rem',{lineHeight:'1'}], '6xl':['3.75rem',{lineHeight:'1'}],
          '7xl':['4.5rem',{lineHeight:'1'}], '8xl':['6rem',{lineHeight:'1'}],
          '9xl':['8rem',{lineHeight:'1'}],
          ...(options.theme?.fontSize || {})
        },
        fontWeight: {
          thin:'100', extralight:'200', light:'300', normal:'400', medium:'500',
          semibold:'600', bold:'700', extrabold:'800', black:'900',
          ...(options.theme?.fontWeight || {})
        },
        screens: {
          sm:'640px', md:'768px', lg:'1024px', xl:'1280px', '2xl':'1536px',
          ...(options.theme?.screens || {})
        },
        ...(options.theme || {})
      },
      ...options
    };
    
    this.usedClasses = new Set();
    this.cssCache = null;
    this.customCSS = [];
  }

  /**
   * Scan source code for Tailwind utility classes
   */
  scan(source) {
    // Find class="..." and className="..." attributes
    const classRegex = /(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{[`'"]([^`'"]*)[`'"]\})/g;
    let match;
    
    while ((match = classRegex.exec(source)) !== null) {
      const classes = (match[1] || match[2] || match[3] || '').trim();
      if (classes) {
        classes.split(/\s+/).forEach(cls => {
          if (cls) this.usedClasses.add(cls);
        });
      }
    }
    
    // Also scan for dynamic class patterns like `bg-${color}-500`
    // and template strings with class-like patterns
    const templateRegex = /`[^`]*`/g;
    while ((match = templateRegex.exec(source)) !== null) {
      const content = match[0];
      const staticParts = content.replace(/\$\{[^}]*\}/g, ' ').replace(/`/g, '');
      staticParts.split(/\s+/).forEach(cls => {
        if (cls && /^[a-z]/.test(cls)) this.usedClasses.add(cls);
      });
    }
    
    // Invalidate cache when new classes are found
    this.cssCache = null;
  }

  /**
   * Process a CSS file that may contain @tailwind or @apply directives
   */
  processCSS(content) {
    // Handle @apply directives
    const processed = content.replace(/@apply\s+([^;]+);/g, (_, classes) => {
      const decls = [];
      classes.trim().split(/\s+/).forEach(cls => {
        const css = this.generateClassCSS(cls);
        if (css) {
          // Extract just the declarations from the CSS rule
          const declMatch = css.match(/\{([^}]*)\}/);
          if (declMatch) {
            decls.push(declMatch[1].trim());
          }
        }
      });
      return decls.join(' ');
    });
    
    // Remove @tailwind directives (they just signal Tailwind should be included)
    const cleaned = processed.replace(/@tailwind\s+[^;]+;/g, '');
    
    if (cleaned.trim()) {
      this.customCSS.push(cleaned);
    }
    this.cssCache = null;
  }

  /**
   * Get the full generated CSS
   */
  getCSS() {
    if (this.cssCache) return this.cssCache;
    
    let css = this.generateBaseCSS();
    
    // Generate utility classes
    for (const cls of this.usedClasses) {
      const rule = this.generateClassCSS(cls);
      if (rule) css += rule + '\n';
    }
    
    // Append custom CSS
    if (this.customCSS.length > 0) {
      css += '\n/* Custom CSS */\n' + this.customCSS.join('\n');
    }
    
    this.cssCache = css;
    return css;
  }

  /**
   * Generate base/reset CSS (Tailwind Preflight-lite)
   */
  generateBaseCSS() {
    return `/* VekoTailwind - Generated CSS */
*, ::before, ::after { box-sizing: border-box; border-width: 0; border-style: solid; border-color: #e5e7eb; }
html { line-height: 1.5; -webkit-text-size-adjust: 100%; tab-size: 4; font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"; }
body { margin: 0; line-height: inherit; }
hr { height: 0; color: inherit; border-top-width: 1px; }
h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
a { color: inherit; text-decoration: inherit; }
b, strong { font-weight: bolder; }
code, kbd, samp, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 1em; }
small { font-size: 80%; }
button, input, optgroup, select, textarea { font-family: inherit; font-size: 100%; line-height: inherit; color: inherit; margin: 0; padding: 0; }
button, select { text-transform: none; }
button, [type='button'], [type='reset'], [type='submit'] { -webkit-appearance: button; background-color: transparent; background-image: none; }
img, svg, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle; }
img, video { max-width: 100%; height: auto; }
[hidden] { display: none; }
`;
  }

  /**
   * Resolve a color value from the theme
   */
  resolveColor(name) {
    const parts = name.split('-');
    const colors = this.options.theme.colors;
    
    if (colors[name]) return colors[name];
    
    // e.g. 'blue-500' -> colors.blue[500]
    if (parts.length >= 2) {
      const shade = parts.pop();
      const colorName = parts.join('-');
      if (colors[colorName] && typeof colors[colorName] === 'object') {
        return colors[colorName][shade];
      }
    }
    
    return null;
  }

  /**
   * Generate CSS for a single utility class
   */
  generateClassCSS(className) {
    const p = this.options.prefix;
    const cls = className.startsWith(p) ? className.slice(p.length) : className;
    
    // Check for responsive prefix
    let mediaPrefix = '';
    let effectiveCls = cls;
    const screens = this.options.theme.screens;
    for (const [bp, size] of Object.entries(screens)) {
      if (cls.startsWith(bp + ':')) {
        mediaPrefix = `@media (min-width: ${size}) { `;
        effectiveCls = cls.slice(bp.length + 1);
        break;
      }
    }
    
    // Check for state prefix (hover, focus, active, etc.)
    let pseudo = '';
    const states = ['hover','focus','active','visited','disabled','first','last','odd','even','focus-within','focus-visible','placeholder','group-hover'];
    for (const state of states) {
      if (effectiveCls.startsWith(state + ':')) {
        pseudo = state === 'group-hover' ? '.group:hover ' : `:${state}`;
        effectiveCls = effectiveCls.slice(state.length + 1);
        break;
      }
    }
    
    // Check for dark mode prefix
    let darkWrap = '';
    if (effectiveCls.startsWith('dark:')) {
      effectiveCls = effectiveCls.slice(5);
      if (this.options.darkMode === 'class') {
        darkWrap = '.dark ';
      } else {
        darkWrap = '@media (prefers-color-scheme: dark) { ';
      }
    }
    
    // Negative values
    let neg = '';
    if (effectiveCls.startsWith('-')) {
      neg = '-';
      effectiveCls = effectiveCls.slice(1);
    }
    
    const esc = this.escapeClass(className);
    const decl = this.resolveUtility(effectiveCls, neg);
    
    if (!decl) return null;
    
    let selector = darkWrap ? `${darkWrap}.${esc}` : `.${esc}`;
    if (pseudo) {
      if (pseudo.startsWith('.')) {
        selector = `${pseudo}.${esc}`;
      } else {
        selector = `.${esc}${pseudo}`;
      }
    }
    
    let rule = `${selector} { ${decl} }`;
    if (mediaPrefix) rule = `${mediaPrefix}${rule} }`;
    if (darkWrap && this.options.darkMode !== 'class') rule += ' }';
    
    return rule;
  }

  /**
   * Escape a class name for use in CSS selectors
   */
  escapeClass(cls) {
    return cls.replace(/[/:.\[\]#%(),!@]/g, '\\$&');
  }

  /**
   * Resolve a utility class to CSS declarations
   */
  resolveUtility(cls, neg = '') {
    const sp = this.options.theme.spacing;
    const colors = this.options.theme.colors;
    const fs = this.options.theme.fontSize;
    const fw = this.options.theme.fontWeight;
    const br = this.options.theme.borderRadius;

    // --- DISPLAY ---
    const displays = { block:'block', inline:'inline', 'inline-block':'inline-block', flex:'flex', 'inline-flex':'inline-flex', grid:'grid', 'inline-grid':'inline-grid', hidden:'none', table:'table', 'table-row':'table-row', 'table-cell':'table-cell', contents:'contents', 'flow-root':'flow-root' };
    if (displays[cls]) return `display: ${displays[cls]}`;

    // --- POSITION ---
    const positions = { static:'static', fixed:'fixed', absolute:'absolute', relative:'relative', sticky:'sticky' };
    if (positions[cls]) return `position: ${positions[cls]}`;

    // --- FLEX ---
    if (cls === 'flex-row') return 'flex-direction: row';
    if (cls === 'flex-col') return 'flex-direction: column';
    if (cls === 'flex-row-reverse') return 'flex-direction: row-reverse';
    if (cls === 'flex-col-reverse') return 'flex-direction: column-reverse';
    if (cls === 'flex-wrap') return 'flex-wrap: wrap';
    if (cls === 'flex-nowrap') return 'flex-wrap: nowrap';
    if (cls === 'flex-wrap-reverse') return 'flex-wrap: wrap-reverse';
    if (cls === 'flex-1') return 'flex: 1 1 0%';
    if (cls === 'flex-auto') return 'flex: 1 1 auto';
    if (cls === 'flex-initial') return 'flex: 0 1 auto';
    if (cls === 'flex-none') return 'flex: none';
    if (cls === 'flex-grow') return 'flex-grow: 1';
    if (cls === 'flex-grow-0') return 'flex-grow: 0';
    if (cls === 'flex-shrink') return 'flex-shrink: 1';
    if (cls === 'flex-shrink-0') return 'flex-shrink: 0';
    
    // --- GRID ---
    const gridColsMatch = cls.match(/^grid-cols-(\d+)$/);
    if (gridColsMatch) return `grid-template-columns: repeat(${gridColsMatch[1]}, minmax(0, 1fr))`;
    const gridRowsMatch = cls.match(/^grid-rows-(\d+)$/);
    if (gridRowsMatch) return `grid-template-rows: repeat(${gridRowsMatch[1]}, minmax(0, 1fr))`;
    const colSpanMatch = cls.match(/^col-span-(\d+)$/);
    if (colSpanMatch) return `grid-column: span ${colSpanMatch[1]} / span ${colSpanMatch[1]}`;
    const rowSpanMatch = cls.match(/^row-span-(\d+)$/);
    if (rowSpanMatch) return `grid-row: span ${rowSpanMatch[1]} / span ${rowSpanMatch[1]}`;
    if (cls === 'col-auto') return 'grid-column: auto';
    
    // --- GAP ---
    const gapMatch = cls.match(/^gap-(.+)$/);
    if (gapMatch && sp[gapMatch[1]]) return `gap: ${sp[gapMatch[1]]}`;
    const gapXMatch = cls.match(/^gap-x-(.+)$/);
    if (gapXMatch && sp[gapXMatch[1]]) return `column-gap: ${sp[gapXMatch[1]]}`;
    const gapYMatch = cls.match(/^gap-y-(.+)$/);
    if (gapYMatch && sp[gapYMatch[1]]) return `row-gap: ${sp[gapYMatch[1]]}`;

    // --- JUSTIFY / ALIGN ---
    const justify = { 'justify-start':'flex-start', 'justify-end':'flex-end', 'justify-center':'center', 'justify-between':'space-between', 'justify-around':'space-around', 'justify-evenly':'space-evenly' };
    if (justify[cls]) return `justify-content: ${justify[cls]}`;
    const items = { 'items-start':'flex-start', 'items-end':'flex-end', 'items-center':'center', 'items-baseline':'baseline', 'items-stretch':'stretch' };
    if (items[cls]) return `align-items: ${items[cls]}`;
    const self = { 'self-auto':'auto', 'self-start':'flex-start', 'self-end':'flex-end', 'self-center':'center', 'self-stretch':'stretch' };
    if (self[cls]) return `align-self: ${self[cls]}`;
    const content = { 'content-start':'flex-start', 'content-end':'flex-end', 'content-center':'center', 'content-between':'space-between', 'content-around':'space-around', 'content-evenly':'space-evenly' };
    if (content[cls]) return `align-content: ${content[cls]}`;
    const place = { 'place-items-center':'center', 'place-items-start':'start', 'place-items-end':'end', 'place-content-center':'center', 'place-content-between':'space-between' };
    if (place[cls]) return cls.startsWith('place-items') ? `place-items: ${place[cls]}` : `place-content: ${place[cls]}`;

    // --- SPACING (padding, margin) ---
    const spacingDirs = { p:'padding', px:['padding-left','padding-right'], py:['padding-top','padding-bottom'], pt:'padding-top', pr:'padding-right', pb:'padding-bottom', pl:'padding-left', m:'margin', mx:['margin-left','margin-right'], my:['margin-top','margin-bottom'], mt:'margin-top', mr:'margin-right', mb:'margin-bottom', ml:'margin-left' };
    for (const [prefix, prop] of Object.entries(spacingDirs)) {
      const re = new RegExp(`^${prefix}-(.+)$`);
      const m = cls.match(re);
      if (m) {
        const val = m[1] === 'auto' ? 'auto' : (sp[m[1]] ? `${neg}${sp[m[1]]}` : null);
        if (val) {
          if (Array.isArray(prop)) return prop.map(p => `${p}: ${val}`).join('; ');
          return `${prop}: ${val}`;
        }
      }
    }
    // space-x, space-y
    const spaceXMatch = cls.match(/^space-x-(.+)$/);
    if (spaceXMatch && sp[spaceXMatch[1]]) return `column-gap: ${sp[spaceXMatch[1]]}`;
    const spaceYMatch = cls.match(/^space-y-(.+)$/);
    if (spaceYMatch && sp[spaceYMatch[1]]) return `row-gap: ${sp[spaceYMatch[1]]}`;

    // --- WIDTH / HEIGHT ---
    const whMap = { w:'width', 'min-w':'min-width', 'max-w':'max-width', h:'height', 'min-h':'min-height', 'max-h':'max-height' };
    for (const [prefix, prop] of Object.entries(whMap)) {
      const re = new RegExp(`^${prefix.replace('-', '\\-')}-(.+)$`);
      const m = cls.match(re);
      if (m) {
        const v = m[1];
        if (v === 'full') return `${prop}: 100%`;
        if (v === 'screen') return `${prop}: 100${prop.includes('width') ? 'vw' : 'vh'}`;
        if (v === 'min') return `${prop}: min-content`;
        if (v === 'max') return `${prop}: max-content`;
        if (v === 'fit') return `${prop}: fit-content`;
        if (v === 'auto') return `${prop}: auto`;
        if (v === '0') return `${prop}: 0px`;
        if (sp[v]) return `${prop}: ${sp[v]}`;
        const fracMatch = v.match(/^(\d+)\/(\d+)$/);
        if (fracMatch) return `${prop}: ${(parseInt(fracMatch[1]) / parseInt(fracMatch[2]) * 100).toFixed(6)}%`;
        if (v.match(/^\d+$/)) return `${prop}: ${v}rem`;
        if (v === 'xs') return `${prop}: 20rem`;
        if (v === 'sm') return `${prop}: 24rem`;
        if (v === 'md') return `${prop}: 28rem`;
        if (v === 'lg') return `${prop}: 32rem`;
        if (v === 'xl') return `${prop}: 36rem`;
        if (v === '2xl') return `${prop}: 42rem`;
        if (v === '3xl') return `${prop}: 48rem`;
        if (v === '4xl') return `${prop}: 56rem`;
        if (v === '5xl') return `${prop}: 64rem`;
        if (v === '6xl') return `${prop}: 72rem`;
        if (v === '7xl') return `${prop}: 80rem`;
        if (v === 'prose') return `${prop}: 65ch`;
        if (v.match(/^\[.+\]$/)) return `${prop}: ${v.slice(1, -1)}`;
      }
    }

    // --- INSET (top, right, bottom, left) ---
    const insetDirs = { inset:['top','right','bottom','left'], 'inset-x':['left','right'], 'inset-y':['top','bottom'], top:['top'], right:['right'], bottom:['bottom'], left:['left'] };
    for (const [prefix, props] of Object.entries(insetDirs)) {
      const re = new RegExp(`^${prefix}-(.+)$`);
      const m = cls.match(re);
      if (m) {
        const v = m[1] === 'auto' ? 'auto' : (sp[m[1]] ? `${neg}${sp[m[1]]}` : null);
        if (v) return props.map(p => `${p}: ${v}`).join('; ');
      }
    }

    // --- TYPOGRAPHY ---
    const textSizeMatch = cls.match(/^text-(.+)$/);
    if (textSizeMatch) {
      const val = textSizeMatch[1];
      if (fs[val]) {
        const [size, opts] = Array.isArray(fs[val]) ? fs[val] : [fs[val], {}];
        let decls = `font-size: ${size}`;
        if (opts.lineHeight) decls += `; line-height: ${opts.lineHeight}`;
        return decls;
      }
      // text-color
      const color = this.resolveColor(val);
      if (color) return `color: ${color}`;
      // text-left, text-center, etc.
      const aligns = { left:'left', center:'center', right:'right', justify:'justify', start:'start', end:'end' };
      if (aligns[val]) return `text-align: ${aligns[val]}`;
    }
    
    const fontMatch = cls.match(/^font-(.+)$/);
    if (fontMatch && fw[fontMatch[1]]) return `font-weight: ${fw[fontMatch[1]]}`;
    if (cls === 'italic') return 'font-style: italic';
    if (cls === 'not-italic') return 'font-style: normal';
    if (cls === 'uppercase') return 'text-transform: uppercase';
    if (cls === 'lowercase') return 'text-transform: lowercase';
    if (cls === 'capitalize') return 'text-transform: capitalize';
    if (cls === 'normal-case') return 'text-transform: none';
    if (cls === 'truncate') return 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap';
    if (cls === 'underline') return 'text-decoration-line: underline';
    if (cls === 'overline') return 'text-decoration-line: overline';
    if (cls === 'line-through') return 'text-decoration-line: line-through';
    if (cls === 'no-underline') return 'text-decoration-line: none';
    if (cls === 'antialiased') return '-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale';
    if (cls === 'subpixel-antialiased') return '-webkit-font-smoothing: auto; -moz-osx-font-smoothing: auto';
    
    const leadingMatch = cls.match(/^leading-(.+)$/);
    if (leadingMatch) {
      const v = leadingMatch[1];
      const lineHeights = { none:'1', tight:'1.25', snug:'1.375', normal:'1.5', relaxed:'1.625', loose:'2' };
      if (lineHeights[v]) return `line-height: ${lineHeights[v]}`;
      if (sp[v]) return `line-height: ${sp[v]}`;
    }
    
    const trackingMatch = cls.match(/^tracking-(.+)$/);
    if (trackingMatch) {
      const tracks = { tighter:'-0.05em', tight:'-0.025em', normal:'0em', wide:'0.025em', wider:'0.05em', widest:'0.1em' };
      if (tracks[trackingMatch[1]]) return `letter-spacing: ${tracks[trackingMatch[1]]}`;
    }

    // --- BACKGROUND ---
    const bgMatch = cls.match(/^bg-(.+)$/);
    if (bgMatch) {
      const v = bgMatch[1];
      if (v === 'transparent') return 'background-color: transparent';
      if (v === 'current') return 'background-color: currentColor';
      const color = this.resolveColor(v);
      if (color) return `background-color: ${color}`;
      // bg-gradient, bg-none, bg-cover, etc
      if (v === 'none') return 'background-image: none';
      if (v === 'cover') return 'background-size: cover';
      if (v === 'contain') return 'background-size: contain';
      if (v === 'center') return 'background-position: center';
      if (v === 'no-repeat') return 'background-repeat: no-repeat';
      if (v === 'repeat') return 'background-repeat: repeat';
      if (v.startsWith('gradient')) return this.resolveGradient(v);
    }

    // --- BORDER ---
    const borderMatch = cls.match(/^border(?:-(.+))?$/);
    if (borderMatch) {
      const v = borderMatch[1];
      if (!v) return 'border-width: 1px';
      if (v === '0') return 'border-width: 0px';
      if (v === '2') return 'border-width: 2px';
      if (v === '4') return 'border-width: 4px';
      if (v === '8') return 'border-width: 8px';
      if (v === 't') return 'border-top-width: 1px';
      if (v === 'r') return 'border-right-width: 1px';
      if (v === 'b') return 'border-bottom-width: 1px';
      if (v === 'l') return 'border-left-width: 1px';
      if (v === 'solid') return 'border-style: solid';
      if (v === 'dashed') return 'border-style: dashed';
      if (v === 'dotted') return 'border-style: dotted';
      if (v === 'none') return 'border-style: none';
      if (v === 'collapse') return 'border-collapse: collapse';
      const color = this.resolveColor(v);
      if (color) return `border-color: ${color}`;
    }
    
    const roundedMatch = cls.match(/^rounded(?:-(.+))?$/);
    if (roundedMatch) {
      const v = roundedMatch[1] || '';
      if (br[v] !== undefined) return `border-radius: ${br[v]}`;
      const sides = { t:['border-top-left-radius','border-top-right-radius'], r:['border-top-right-radius','border-bottom-right-radius'], b:['border-bottom-left-radius','border-bottom-right-radius'], l:['border-top-left-radius','border-bottom-left-radius'], tl:['border-top-left-radius'], tr:['border-top-right-radius'], br:['border-bottom-right-radius'], bl:['border-bottom-left-radius'] };
      for (const [side, props] of Object.entries(sides)) {
        if (v === side) return props.map(p => `${p}: 0.25rem`).join('; ');
        if (v.startsWith(side + '-')) {
          const size = v.slice(side.length + 1);
          if (br[size] !== undefined) return props.map(p => `${p}: ${br[size]}`).join('; ');
        }
      }
    }

    // --- SHADOW ---
    if (cls === 'shadow') return 'box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)';
    if (cls === 'shadow-sm') return 'box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)';
    if (cls === 'shadow-md') return 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)';
    if (cls === 'shadow-lg') return 'box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)';
    if (cls === 'shadow-xl') return 'box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)';
    if (cls === 'shadow-2xl') return 'box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25)';
    if (cls === 'shadow-inner') return 'box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05)';
    if (cls === 'shadow-none') return 'box-shadow: 0 0 #0000';

    // --- OPACITY ---
    const opacityMatch = cls.match(/^opacity-(\d+)$/);
    if (opacityMatch) return `opacity: ${parseInt(opacityMatch[1]) / 100}`;

    // --- OVERFLOW ---
    const overflows = { 'overflow-auto':'overflow: auto', 'overflow-hidden':'overflow: hidden', 'overflow-visible':'overflow: visible', 'overflow-scroll':'overflow: scroll', 'overflow-x-auto':'overflow-x: auto', 'overflow-y-auto':'overflow-y: auto', 'overflow-x-hidden':'overflow-x: hidden', 'overflow-y-hidden':'overflow-y: hidden' };
    if (overflows[cls]) return overflows[cls];

    // --- Z-INDEX ---
    const zMatch = cls.match(/^z-(.+)$/);
    if (zMatch) {
      if (zMatch[1] === 'auto') return 'z-index: auto';
      return `z-index: ${zMatch[1]}`;
    }

    // --- CURSOR ---
    const cursorMatch = cls.match(/^cursor-(.+)$/);
    if (cursorMatch) return `cursor: ${cursorMatch[1]}`;

    // --- TRANSITION ---
    if (cls === 'transition') return 'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms';
    if (cls === 'transition-all') return 'transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms';
    if (cls === 'transition-colors') return 'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms';
    if (cls === 'transition-none') return 'transition-property: none';
    const durationMatch = cls.match(/^duration-(\d+)$/);
    if (durationMatch) return `transition-duration: ${durationMatch[1]}ms`;
    const delayMatch = cls.match(/^delay-(\d+)$/);
    if (delayMatch) return `transition-delay: ${delayMatch[1]}ms`;
    const easeMap = { 'ease-linear':'linear', 'ease-in':'cubic-bezier(0.4, 0, 1, 1)', 'ease-out':'cubic-bezier(0, 0, 0.2, 1)', 'ease-in-out':'cubic-bezier(0.4, 0, 0.2, 1)' };
    if (easeMap[cls]) return `transition-timing-function: ${easeMap[cls]}`;

    // --- TRANSFORM ---
    if (cls === 'transform') return 'transform: translateX(var(--tw-translate-x,0)) translateY(var(--tw-translate-y,0)) rotate(var(--tw-rotate,0)) skewX(var(--tw-skew-x,0)) skewY(var(--tw-skew-y,0)) scaleX(var(--tw-scale-x,1)) scaleY(var(--tw-scale-y,1))';
    if (cls === 'transform-none') return 'transform: none';
    const scaleMatch = cls.match(/^scale-(\d+)$/);
    if (scaleMatch) return `transform: scale(${parseInt(scaleMatch[1]) / 100})`;
    const rotateMatch = cls.match(/^rotate-(\d+)$/);
    if (rotateMatch) return `transform: rotate(${neg}${rotateMatch[1]}deg)`;
    const translateXMatch = cls.match(/^translate-x-(.+)$/);
    if (translateXMatch && sp[translateXMatch[1]]) return `transform: translateX(${neg}${sp[translateXMatch[1]]})`;
    const translateYMatch = cls.match(/^translate-y-(.+)$/);
    if (translateYMatch && sp[translateYMatch[1]]) return `transform: translateY(${neg}${sp[translateYMatch[1]]})`;

    // --- RING ---
    if (cls === 'ring') return 'box-shadow: 0 0 0 3px rgb(59 130 246 / 0.5)';
    const ringMatch = cls.match(/^ring-(\d+)$/);
    if (ringMatch) return `box-shadow: 0 0 0 ${ringMatch[1]}px rgb(59 130 246 / 0.5)`;
    const ringColorMatch = cls.match(/^ring-(.+)$/);
    if (ringColorMatch) {
      const color = this.resolveColor(ringColorMatch[1]);
      if (color) return `--tw-ring-color: ${color}`;
    }

    // --- OUTLINE ---
    if (cls === 'outline-none') return 'outline: 2px solid transparent; outline-offset: 2px';
    if (cls === 'outline') return 'outline-style: solid';

    // --- LIST ---
    if (cls === 'list-none') return 'list-style-type: none';
    if (cls === 'list-disc') return 'list-style-type: disc';
    if (cls === 'list-decimal') return 'list-style-type: decimal';
    if (cls === 'list-inside') return 'list-style-position: inside';
    if (cls === 'list-outside') return 'list-style-position: outside';

    // --- OBJECT ---
    if (cls === 'object-cover') return 'object-fit: cover';
    if (cls === 'object-contain') return 'object-fit: contain';
    if (cls === 'object-fill') return 'object-fit: fill';
    if (cls === 'object-none') return 'object-fit: none';
    if (cls === 'object-center') return 'object-position: center';

    // --- POINTER EVENTS ---
    if (cls === 'pointer-events-none') return 'pointer-events: none';
    if (cls === 'pointer-events-auto') return 'pointer-events: auto';

    // --- SELECT ---
    if (cls === 'select-none') return 'user-select: none';
    if (cls === 'select-text') return 'user-select: text';
    if (cls === 'select-all') return 'user-select: all';
    if (cls === 'select-auto') return 'user-select: auto';

    // --- WHITESPACE ---
    const wsMatch = cls.match(/^whitespace-(.+)$/);
    if (wsMatch) return `white-space: ${wsMatch[1]}`;

    // --- WORD BREAK ---
    if (cls === 'break-normal') return 'overflow-wrap: normal; word-break: normal';
    if (cls === 'break-words') return 'overflow-wrap: break-word';
    if (cls === 'break-all') return 'word-break: break-all';

    // --- VISIBILITY ---
    if (cls === 'visible') return 'visibility: visible';
    if (cls === 'invisible') return 'visibility: hidden';

    // --- SR ONLY ---
    if (cls === 'sr-only') return 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border-width: 0';
    if (cls === 'not-sr-only') return 'position: static; width: auto; height: auto; padding: 0; margin: 0; overflow: visible; clip: auto; white-space: normal';

    // --- CONTAINER ---
    if (cls === 'container') return 'width: 100%; max-width: 100%';
    if (cls === 'mx-auto') return 'margin-left: auto; margin-right: auto';

    // --- ASPECT RATIO ---
    if (cls === 'aspect-auto') return 'aspect-ratio: auto';
    if (cls === 'aspect-square') return 'aspect-ratio: 1 / 1';
    if (cls === 'aspect-video') return 'aspect-ratio: 16 / 9';

    // --- COLUMNS ---
    const colsMatch = cls.match(/^columns-(\d+)$/);
    if (colsMatch) return `columns: ${colsMatch[1]}`;

    // --- ARBITRARY values [value] ---
    const arbitraryMatch = cls.match(/^\[(.+)\]$/);
    if (arbitraryMatch) {
      const val = arbitraryMatch[1].replace(/_/g, ' ');
      if (val.includes(':')) {
        const [prop, v] = val.split(':');
        return `${prop}: ${v}`;
      }
    }

    // --- FILL / STROKE ---
    const fillMatch = cls.match(/^fill-(.+)$/);
    if (fillMatch) {
      if (fillMatch[1] === 'current') return 'fill: currentColor';
      const color = this.resolveColor(fillMatch[1]);
      if (color) return `fill: ${color}`;
    }
    const strokeMatch = cls.match(/^stroke-(.+)$/);
    if (strokeMatch) {
      if (strokeMatch[1] === 'current') return 'stroke: currentColor';
      const color = this.resolveColor(strokeMatch[1]);
      if (color) return `stroke: ${color}`;
    }

    // --- PLACEHOLDER ---
    // handled via pseudo prefix

    // --- DIVIDE ---
    const divideXMatch = cls.match(/^divide-x(?:-(\d+))?$/);
    if (divideXMatch) return `border-left-width: ${divideXMatch[1] || '1'}px`;
    const divideYMatch = cls.match(/^divide-y(?:-(\d+))?$/);
    if (divideYMatch) return `border-top-width: ${divideYMatch[1] || '1'}px`;

    return null;
  }

  /**
   * Resolve gradient utility
   */
  resolveGradient(v) {
    if (v === 'gradient-to-t') return 'background-image: linear-gradient(to top, var(--tw-gradient-stops))';
    if (v === 'gradient-to-tr') return 'background-image: linear-gradient(to top right, var(--tw-gradient-stops))';
    if (v === 'gradient-to-r') return 'background-image: linear-gradient(to right, var(--tw-gradient-stops))';
    if (v === 'gradient-to-br') return 'background-image: linear-gradient(to bottom right, var(--tw-gradient-stops))';
    if (v === 'gradient-to-b') return 'background-image: linear-gradient(to bottom, var(--tw-gradient-stops))';
    if (v === 'gradient-to-bl') return 'background-image: linear-gradient(to bottom left, var(--tw-gradient-stops))';
    if (v === 'gradient-to-l') return 'background-image: linear-gradient(to left, var(--tw-gradient-stops))';
    if (v === 'gradient-to-tl') return 'background-image: linear-gradient(to top left, var(--tw-gradient-stops))';
    return null;
  }
}

// Export
module.exports = VSV;
module.exports.VSV = VSV;
module.exports.VDOM = VDOM;
module.exports.VekoPHP = VekoPHP;
module.exports.VekoTailwind = VekoTailwind;
