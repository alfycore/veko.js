/**
 * VSV Renderer
 * Server-side rendering engine
 * Optimized for SEO and performance
 */

const VDOM = require('./vdom');
const path = require('path');
const fs = require('fs');

class VSVRenderer {
  constructor(vsv) {
    this.vsv = vsv;
    
    // Template cache
    this.templateCache = new Map();
    
    // SEO presets
    this.seoDefaults = {
      charset: 'UTF-8',
      viewport: 'width=device-width, initial-scale=1.0',
      robots: 'index, follow'
    };
  }

  /**
   * Render compiled component
   */
  async render(compiled, props = {}, options = {}) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Execute server code and get render function
      const renderFn = this.loadServerCode(compiled);
      
      if (typeof renderFn !== 'function') {
        throw new Error(`Component "${compiled.name}" did not export a valid render function`);
      }
      
      // Call render function
      const result = renderFn(props);
      
      // Convert to HTML
      let html;
      
      if (typeof result === 'string') {
        // Already HTML string
        html = result;
      } else if (result && typeof result === 'object') {
        // VDOM node
        if (options.stream) {
          html = await this.renderStream(result, options);
        } else {
          html = VDOM.renderToString(result, { hydrate: options.hydrate !== false });
        }
      } else {
        html = String(result || '');
      }
      
      // Add hydration markers if needed
      if (compiled.metadata?.hasState || compiled.metadata?.hasEffects) {
        html = this.addHydrationMarkers(html, compiled.name, props);
      }
      
      // Track timing
      const endTime = process.hrtime.bigint();
      const renderTime = Number(endTime - startTime) / 1e6;
      
      if (this.vsv.options.debug) {
        console.log(`[VSV] Rendered ${compiled.name} in ${renderTime.toFixed(2)}ms`);
      }
      
      return html;
    } catch (error) {
      return this.renderError(error, compiled.name, compiled.server);
    }
  }

  /**
   * Load and execute server code
   */
  loadServerCode(compiled) {
    // Check cache
    if (this.templateCache.has(compiled.hash)) {
      return this.templateCache.get(compiled.hash);
    }
    
    try {
      // Create module sandbox
      const mod = { exports: {} };
      
      // Create function from compiled code
      const wrappedCode = `
        (function(require, module, exports, __dirname, __filename) {
          ${compiled.server}
        })
      `;
      
      const fn = eval(wrappedCode);
      fn(require, mod, mod.exports, process.cwd(), 'component.js');
      
      // Get the exported function
      let renderFn;
      
      if (typeof mod.exports === 'function') {
        // Direct function export
        renderFn = (props) => {
          const vnode = mod.exports(props);
          return VDOM.renderToString(vnode);
        };
      } else if (typeof mod.exports.render === 'function') {
        // Explicit render export
        renderFn = mod.exports.render;
      } else if (typeof mod.exports.default === 'function') {
        // ES module default export
        renderFn = (props) => {
          const vnode = mod.exports.default(props);
          return VDOM.renderToString(vnode);
        };
      } else {
        throw new Error('No valid component export found');
      }
      
      // Cache
      this.templateCache.set(compiled.hash, renderFn);
      
      return renderFn;
    } catch (error) {
      throw new Error(`Failed to load component: ${error.message}`);
    }
  }

  /**
   * Streaming render
   */
  async renderStream(vnode, options) {
    const chunks = [];
    
    for await (const chunk of VDOM.renderToStream(vnode, options)) {
      chunks.push(chunk);
    }
    
    return chunks.join('');
  }

  /**
   * Add hydration markers
   */
  addHydrationMarkers(html, componentName, props) {
    // Add data attributes for hydration
    const safeProps = JSON.stringify(props).replace(/"/g, '&quot;');
    
    // Find root element and add marker
    const rootMatch = html.match(/^<(\w+)/);
    if (rootMatch) {
      const tag = rootMatch[1];
      return html.replace(
        `<${tag}`,
        `<${tag} data-vsv="${componentName}" data-vsv-props="${safeProps}"`
      );
    }
    
    return html;
  }

  /**
   * Render error - Beautiful error page
   */
  renderError(error, componentName, serverCode = '') {
    if (process.env.NODE_ENV === 'production') {
      return `<div class="vsv-error">Error rendering component</div>`;
    }
    
    // Extract line number from error if possible
    const lineMatch = error.stack?.match(/:(\d+):\d+/);
    const errorLine = lineMatch ? parseInt(lineMatch[1]) : null;
    
    // Format code with line numbers
    let codePreview = '';
    if (serverCode) {
      const lines = serverCode.split('\n');
      const start = Math.max(0, (errorLine || 1) - 5);
      const end = Math.min(lines.length, (errorLine || 1) + 5);
      
      codePreview = lines.slice(start, end).map((line, i) => {
        const lineNum = start + i + 1;
        const isError = lineNum === errorLine;
        return `<div style="display:flex;${isError ? 'background:#ff000022;' : ''}">
          <span style="color:#666;width:40px;text-align:right;padding-right:10px;user-select:none;border-right:1px solid #333;">${lineNum}</span>
          <code style="flex:1;padding-left:10px;${isError ? 'color:#ff6b6b;' : ''}">${this.escapeHtml(line)}</code>
        </div>`;
      }).join('');
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <title>VSV Compile Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e; 
      color: #eee;
      min-height: 100vh;
      padding: 40px;
    }
    .error-container {
      max-width: 900px;
      margin: 0 auto;
    }
    .error-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 30px;
    }
    .error-icon {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
    }
    .error-title {
      font-size: 24px;
      font-weight: 600;
    }
    .error-subtitle {
      color: #888;
      font-size: 14px;
      margin-top: 4px;
    }
    .error-card {
      background: #16213e;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 20px;
      border: 1px solid #0f3460;
    }
    .card-header {
      background: #0f3460;
      padding: 12px 20px;
      font-size: 13px;
      font-weight: 500;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-content {
      padding: 20px;
    }
    .error-message {
      background: #ff6b6b22;
      border-left: 4px solid #ff6b6b;
      padding: 16px 20px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 14px;
      line-height: 1.6;
      color: #ff6b6b;
      border-radius: 0 8px 8px 0;
    }
    .code-block {
      background: #0d1117;
      border-radius: 8px;
      overflow: hidden;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      line-height: 1.8;
    }
    .stack-trace {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      line-height: 1.8;
      color: #888;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .stack-trace .at-line {
      color: #64748b;
    }
    .stack-trace .file-path {
      color: #60a5fa;
    }
    .help-section {
      background: #065f4622;
      border: 1px solid #065f46;
      border-radius: 8px;
      padding: 16px 20px;
    }
    .help-title {
      color: #34d399;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .help-list {
      list-style: none;
      color: #94a3b8;
      font-size: 14px;
    }
    .help-list li {
      padding: 4px 0;
    }
    .help-list li::before {
      content: "→ ";
      color: #34d399;
    }
    .veko-badge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0f3460;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      color: #64748b;
    }
    .veko-badge span {
      color: #60a5fa;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-header">
      <div class="error-icon">✗</div>
      <div>
        <div class="error-title">VSV Compilation Error</div>
        <div class="error-subtitle">Component: ${this.escapeHtml(componentName)}</div>
      </div>
    </div>

    <div class="error-card">
      <div class="card-header">Error Message</div>
      <div class="card-content">
        <div class="error-message">${this.escapeHtml(error.message)}</div>
      </div>
    </div>

    ${codePreview ? `
    <div class="error-card">
      <div class="card-header">Source Code ${errorLine ? `(line ${errorLine})` : ''}</div>
      <div class="card-content">
        <div class="code-block">${codePreview}</div>
      </div>
    </div>
    ` : ''}

    <div class="error-card">
      <div class="card-header">Stack Trace</div>
      <div class="card-content">
        <div class="stack-trace">${this.formatStackTrace(error.stack)}</div>
      </div>
    </div>

    <div class="help-section">
      <div class="help-title">💡 Possible Solutions</div>
      <ul class="help-list">
        <li>Check that your component exports a default function</li>
        <li>Make sure JSX syntax is correct (use class instead of className)</li>
        <li>Verify all variables are defined before use</li>
        <li>Check for missing closing tags in your JSX</li>
        <li>Ensure $state, $effect, $computed are used correctly</li>
      </ul>
    </div>
  </div>
  
  <div class="veko-badge">Powered by <span>VekoJS VSV</span></div>
</body>
</html>`;
  }

  /**
   * Format stack trace with syntax highlighting
   */
  formatStackTrace(stack) {
    if (!stack) return 'No stack trace available';
    
    return this.escapeHtml(stack)
      .split('\n')
      .map(line => {
        // Highlight file paths
        return line.replace(
          /(\s+at\s+)([^\s]+)\s+\(([^)]+)\)/g,
          '<span class="at-line">$1</span>$2 (<span class="file-path">$3</span>)'
        ).replace(
          /(\s+at\s+)([^\s]+):(\d+):(\d+)/g,
          '<span class="at-line">$1</span><span class="file-path">$2:$3:$4</span>'
        );
      })
      .join('\n');
  }

  /**
   * Escape HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Render full page with SEO
   */
  async renderPage(compiled, props = {}, options = {}) {
    const content = await this.render(compiled, props, options);
    
    // Build SEO meta tags
    const seo = this.buildSEO(props.seo || options.seo || {});
    
    // Build page
    return this.buildPage(content, {
      ...options,
      seo,
      title: props.title || options.title,
      scripts: this.buildScripts(compiled, options),
      styles: this.buildStyles(options)
    });
  }

  /**
   * Build SEO meta tags
   */
  buildSEO(seo) {
    const tags = [];
    
    // Charset
    tags.push(`<meta charset="${seo.charset || this.seoDefaults.charset}">`);
    
    // Viewport
    tags.push(`<meta name="viewport" content="${seo.viewport || this.seoDefaults.viewport}">`);
    
    // Title
    if (seo.title) {
      tags.push(`<title>${VDOM.escapeHtml(seo.title)}</title>`);
    }
    
    // Description
    if (seo.description) {
      tags.push(`<meta name="description" content="${VDOM.escapeAttr(seo.description)}">`);
    }
    
    // Keywords
    if (seo.keywords) {
      const kw = Array.isArray(seo.keywords) ? seo.keywords.join(', ') : seo.keywords;
      tags.push(`<meta name="keywords" content="${VDOM.escapeAttr(kw)}">`);
    }
    
    // Robots
    tags.push(`<meta name="robots" content="${seo.robots || this.seoDefaults.robots}">`);
    
    // Open Graph
    if (seo.og) {
      for (const [key, value] of Object.entries(seo.og)) {
        tags.push(`<meta property="og:${key}" content="${VDOM.escapeAttr(value)}">`);
      }
    }
    
    // Twitter Card
    if (seo.twitter) {
      for (const [key, value] of Object.entries(seo.twitter)) {
        tags.push(`<meta name="twitter:${key}" content="${VDOM.escapeAttr(value)}">`);
      }
    }
    
    // Canonical
    if (seo.canonical) {
      tags.push(`<link rel="canonical" href="${VDOM.escapeAttr(seo.canonical)}">`);
    }
    
    // Structured data (JSON-LD)
    if (seo.jsonLd) {
      tags.push(`<script type="application/ld+json">${JSON.stringify(seo.jsonLd)}</script>`);
    }
    
    return tags.join('\n    ');
  }

  /**
   * Build scripts
   */
  buildScripts(compiled, options) {
    const scripts = [];
    
    // Add runtime if hydration needed
    if (compiled.metadata.hasState || compiled.metadata.hasEffects || options.hydrate !== false) {
      scripts.push('<script src="/_vsv/runtime.js" defer></script>');
      scripts.push(`<script src="/_vsv/components/${compiled.name}.js" defer></script>`);
      scripts.push('<script>document.addEventListener("DOMContentLoaded",()=>VSV.hydrate())</script>');
    }
    
    // Custom scripts
    if (options.scripts) {
      if (Array.isArray(options.scripts)) {
        scripts.push(...options.scripts);
      } else {
        scripts.push(options.scripts);
      }
    }
    
    return scripts.join('\n    ');
  }

  /**
   * Build styles
   */
  buildStyles(options) {
    const styles = [];
    
    // Critical CSS
    if (options.criticalCSS) {
      styles.push(`<style>${options.criticalCSS}</style>`);
    }
    
    // Stylesheets
    if (options.stylesheets) {
      for (const href of options.stylesheets) {
        styles.push(`<link rel="stylesheet" href="${VDOM.escapeAttr(href)}">`);
      }
    }
    
    // Inline styles
    if (options.styles) {
      if (typeof options.styles === 'string') {
        styles.push(options.styles);
      } else {
        styles.push(...options.styles);
      }
    }
    
    return styles.join('\n    ');
  }

  /**
   * Build full page
   */
  buildPage(content, options = {}) {
    return `<!DOCTYPE html>
<html lang="${options.lang || 'en'}">
<head>
    ${options.seo || ''}
    ${options.title ? `<title>${VDOM.escapeHtml(options.title)}</title>` : ''}
    ${options.styles || ''}
    ${options.head || ''}
</head>
<body${options.bodyClass ? ` class="${options.bodyClass}"` : ''}>
    <div id="app">${content}</div>
    ${options.scripts || ''}
    ${options.body || ''}
</body>
</html>`;
  }

  /**
   * Render static HTML (no hydration)
   */
  async renderStatic(compiled, props = {}) {
    return this.render(compiled, props, { hydrate: false });
  }

  /**
   * Prerender pages for static generation
   */
  async prerender(pages) {
    const results = [];
    
    for (const page of pages) {
      const { component, props, path, seo } = page;
      
      // Compile if needed
      let compiled = this.vsv.compiledCache.get(component);
      if (!compiled) {
        const filePath = await this.vsv.findComponent(component);
        if (filePath) {
          compiled = await this.vsv.compileFile(filePath);
        }
      }
      
      if (!compiled) {
        results.push({ path, error: `Component "${component}" not found` });
        continue;
      }
      
      // Render
      const html = await this.renderPage(compiled, props, { seo, hydrate: false });
      
      results.push({ path, html });
    }
    
    return results;
  }
}

module.exports = VSVRenderer;
