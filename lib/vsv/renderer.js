/**
 * VSV Renderer
 * Server-side rendering engine
 * Optimized for SEO and performance
 */

const VDOM = require('./vdom');

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
      // Execute server code
      const serverFn = this.loadServerCode(compiled);
      
      // Render component
      const vnode = serverFn(props);
      
      // Convert to HTML
      let html;
      
      if (options.stream) {
        // Streaming render
        html = await this.renderStream(vnode, options);
      } else {
        // Standard render
        html = VDOM.renderToString(vnode, { hydrate: options.hydrate !== false });
      }
      
      // Add hydration markers if needed
      if (compiled.metadata.hasState || compiled.metadata.hasEffects) {
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
      return this.renderError(error, compiled.name);
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
    
    // Create function from compiled code
    const fn = new Function('require', 'module', 'exports', compiled.server + '\nreturn module.exports;');
    
    // Execute
    const mod = { exports: {} };
    const result = fn(require, mod, mod.exports);
    
    // Get render function
    const renderFn = result.render || result;
    
    // Cache
    this.templateCache.set(compiled.hash, renderFn);
    
    return renderFn;
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
   * Render error
   */
  renderError(error, componentName) {
    if (process.env.NODE_ENV === 'production') {
      return `<div class="vsv-error">Error rendering component</div>`;
    }
    
    return `
<div class="vsv-error" style="background:#fee;border:1px solid #f00;padding:1rem;margin:1rem 0;font-family:monospace">
  <h3 style="color:#c00;margin:0 0 0.5rem">VSV Render Error: ${componentName}</h3>
  <pre style="margin:0;white-space:pre-wrap">${VDOM.escapeHtml(error.message)}</pre>
  <details style="margin-top:0.5rem">
    <summary>Stack trace</summary>
    <pre style="font-size:0.8em">${VDOM.escapeHtml(error.stack)}</pre>
  </details>
</div>`;
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
