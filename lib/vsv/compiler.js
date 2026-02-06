/**
 * VSV Compiler
 * Compiles .jsv and .tsv files to optimized JavaScript
 * Zero dependencies - generates both server and client code
 */

const VSVParser = require('./parser');

class VSVCompiler {
  constructor(vsv) {
    this.vsv = vsv;
    this.parser = new VSVParser(vsv);
  }

  /**
   * Compile VSV source code
   */
  async compile(source, options = {}) {
    try {
      // Try simple compilation first for basic JSV files
      const simpleResult = this.compileSimple(source, options);
      if (simpleResult) {
        return simpleResult;
      }
      
      // Fall back to full AST parsing
      const ast = this.parser.parse(source, options);
      const transformed = this.transform(ast);
      
      const serverCode = this.generateServer(transformed, options);
      const clientCode = this.generateClient(transformed, options);
      
      const finalServer = options.minify ? this.minify(serverCode) : serverCode;
      const finalClient = options.minify ? this.minify(clientCode) : clientCode;
      
      return {
        ast: transformed,
        server: finalServer,
        client: finalClient,
        name: options.name,
        hash: this.hash(source),
        dependencies: this.extractDependencies(ast),
        metadata: {
          components: ast.components.map(c => c.name),
          hasState: this.hasState(ast),
          hasEffects: this.hasEffects(ast),
          isSSR: true
        }
      };
    } catch (error) {
      throw new Error(`Compilation failed: ${error.message}`);
    }
  }

  /**
   * Simple compilation for standard JSV files
   * Handles: export default function Name(props) { return <jsx> }
   */
  compileSimple(source, options = {}) {
    const name = options.name || 'Component';
    
    // Detect if this is a simple component file
    const hasExportDefault = /export\s+default\s+function/.test(source);
    const hasFunctionDecl = /function\s+\w+\s*\(/.test(source);
    const hasArrowExport = /export\s+default\s+(\(|[a-zA-Z])/.test(source);
    
    if (!hasExportDefault && !hasFunctionDecl && !hasArrowExport) {
      return null; // Not a simple component, use full parser
    }
    
    // Extract component name from source FIRST
    const nameMatch = source.match(/export\s+default\s+function\s+(\w+)/) || 
                      source.match(/function\s+(\w+)\s*\(/);
    const componentName = nameMatch ? nameMatch[1] : name;
    
    // Step 0: Extract asset imports (CSS, JS, images, fonts, etc.)
    const assets = this.extractAssetImports(source, options.filename);
    
    // Step 1: Remove all export/import statements
    let code = source;
    
    // Remove import statements
    code = code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*/g, '');
    code = code.replace(/import\s+['"][^'"]+['"];?\s*/g, '');
    
    // Transform "export default function Name" -> "function Name"
    code = code.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');
    
    // Transform "export default (props) => " -> "function ComponentName(props)"
    code = code.replace(/export\s+default\s+\(([^)]*)\)\s*=>\s*/, `function ${componentName}($1) { return `);
    
    // Transform "export default Name" at end of file -> remove
    code = code.replace(/export\s+default\s+\w+\s*;?\s*$/g, '');
    
    // Transform "export function" -> "function"
    code = code.replace(/export\s+function/g, 'function');
    
    // Transform "export const/let/var" -> "const/let/var"
    code = code.replace(/export\s+(const|let|var)/g, '$1');
    
    // Remove any remaining "export" keywords
    code = code.replace(/export\s*\{[^}]*\}\s*;?/g, '');
    
    // Remove any remaining stray "export" keywords that might remain
    code = code.replace(/^export\s+/gm, '');
    
    // Step 2: Transform JSX to VSV.h() calls
    code = this.transformJSX(code);
    
    // Step 3: Generate asset variable declarations
    // For imports like `import logo from './logo.png'`, inject `var logo = "/_vsv/assets/hash.png"`
    const assetVarDecls = this.generateAssetVarDeclarations(assets);
    
    // Generate server code with the cleaned and transformed code
    const serverCode = this.wrapServerCode(assetVarDecls + code, componentName);
    
    // Generate client code with cleaned code (no exports, transformed JSX)
    const clientCode = this.wrapClientCode(assetVarDecls + code, componentName);
    
    // Detect state/effects
    const hasState = /\$state\s*\(/.test(source);
    const hasEffects = /\$effect\s*\(/.test(source);
    
    return {
      ast: { source, name: componentName },
      server: serverCode,
      client: clientCode,
      name: componentName,
      hash: this.hash(source),
      dependencies: [],
      assets,
      metadata: {
        components: [componentName],
        hasState,
        hasEffects,
        isSSR: true
      }
    };
  }

  /**
   * Extract asset imports from source code (CSS, JS, images, fonts, etc.)
   * Supports: import './style.css', import styles from './module.css',
   *           import logo from './logo.png', import script from './utils.js'
   */
  extractAssetImports(source, filename) {
    const assets = { css: [], js: [], images: [], fonts: [], other: [] };
    
    // Asset file extensions map
    const assetTypes = {
      css: ['.css', '.scss', '.sass', '.less'],
      js: ['.js', '.mjs'],
      images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif', '.bmp'],
      fonts: ['.woff', '.woff2', '.ttf', '.eot', '.otf']
    };
    
    // Match: import './file.css'  or  import styles from './file.css'
    // Match: import name from './file.ext'
    const importRegex = /import\s+(?:(\w+)\s+from\s+)?['"]([^'"]+)['"]\s*;?/g;
    let match;
    
    while ((match = importRegex.exec(source)) !== null) {
      const varName = match[1] || null;
      const importPath = match[2];
      
      // Skip node module imports (no ./ or ../ prefix and no file extension)
      if (!importPath.startsWith('.') && !importPath.startsWith('/') && !importPath.includes('.')) {
        continue;
      }
      
      // Determine file extension
      const ext = importPath.includes('.') ? '.' + importPath.split('.').pop().toLowerCase() : '';
      
      // Resolve actual file path
      let resolvedPath = importPath;
      if (filename) {
        const path = require('path');
        const dir = path.dirname(filename);
        resolvedPath = path.resolve(dir, importPath);
      }
      
      // Classify the asset
      let classified = false;
      for (const [type, extensions] of Object.entries(assetTypes)) {
        if (extensions.includes(ext)) {
          assets[type].push({
            path: importPath,
            resolvedPath,
            varName,
            ext
          });
          classified = true;
          break;
        }
      }
      
      if (!classified && ext) {
        assets.other.push({
          path: importPath,
          resolvedPath,
          varName,
          ext
        });
      }
    }
    
    return assets;
  }

  /**
   * Generate variable declarations for imported assets
   * Converts: import logo from './logo.png' -> var logo = "/_vsv/assets/hash.png"
   * For CSS with varName: import styles from './module.css' -> var styles = "/_vsv/assets/hash.css"
   */
  generateAssetVarDeclarations(assets) {
    const crypto = require('crypto');
    const fs = require('fs');
    let declarations = '';
    
    const allAssets = [
      ...(assets.css || []),
      ...(assets.js || []),
      ...(assets.images || []),
      ...(assets.fonts || []),
      ...(assets.other || [])
    ];
    
    for (const asset of allAssets) {
      if (!asset.varName) continue;
      
      // Generate a deterministic hash from the file path
      let content;
      try {
        if (fs.existsSync(asset.resolvedPath)) {
          content = fs.readFileSync(asset.resolvedPath);
        }
      } catch (e) {
        // File not accessible yet, use path-based hash
      }
      
      const hashSource = content || asset.resolvedPath || asset.path;
      const hash = crypto.createHash('md5').update(hashSource).digest('hex').slice(0, 12);
      const ext = asset.ext || '';
      const url = `/_vsv/assets/${hash}${ext}`;
      
      declarations += `var ${asset.varName} = ${JSON.stringify(url)};\n`;
    }
    
    return declarations;
  }

  /**
   * Transform ES6 exports to CommonJS compatible code
   */
  transformExports(code) {
    let result = code;
    
    // export default function Name -> function Name
    result = result.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');
    
    // export default Name -> (handled at end)
    result = result.replace(/export\s+default\s+(\w+)\s*;?/g, '');
    
    // export function Name -> function Name
    result = result.replace(/export\s+function\s+(\w+)/g, 'function $1');
    
    // export const/let/var Name -> const/let/var Name
    result = result.replace(/export\s+(const|let|var)\s+/g, '$1 ');
    
    // export { ... } -> remove
    result = result.replace(/export\s*\{[^}]*\}\s*;?/g, '');
    
    // import statements -> remove (not supported in simple mode)
    result = result.replace(/import\s+.*?from\s+['"][^'"]+['"];?/g, '');
    result = result.replace(/import\s+['"][^'"]+['"];?/g, '');
    
    return result;
  }

  /**
   * Transform JSX to VSV.h() calls using a proper recursive parser
   */
  transformJSX(code) {
    return this.parseJSXInCode(code);
  }

  /**
   * Find and transform all JSX in code while preserving non-JSX parts
   */
  parseJSXInCode(code) {
    let result = '';
    let i = 0;
    
    while (i < code.length) {
      // Look for return statement or assignment with JSX
      if (code[i] === '<' && this.isJSXStart(code, i)) {
        const jsxResult = this.parseJSXElement(code, i);
        if (jsxResult) {
          result += jsxResult.code;
          i = jsxResult.end;
          continue;
        }
      }
      result += code[i];
      i++;
    }
    
    return result;
  }

  /**
   * Check if this is the start of a JSX element (not a comparison operator)
   */
  isJSXStart(code, pos) {
    // Must be followed by a letter (tag name) or > (fragment) or /
    if (pos + 1 >= code.length) return false;
    const next = code[pos + 1];
    return /[a-zA-Z>\/]/.test(next);
  }

  /**
   * Parse a complete JSX element starting at position
   * Returns { code: string, end: number } or null
   */
  parseJSXElement(code, start) {
    let i = start;
    
    // Skip <
    if (code[i] !== '<') return null;
    i++;
    
    // Handle fragments: <>...</>
    if (code[i] === '>') {
      return this.parseFragment(code, start);
    }
    
    // Handle closing tag - shouldn't happen at top level
    if (code[i] === '/') return null;
    
    // Get tag name
    let tagName = '';
    while (i < code.length && /[a-zA-Z0-9_]/.test(code[i])) {
      tagName += code[i];
      i++;
    }
    
    if (!tagName) return null;
    
    // Parse attributes
    const attrResult = this.parseJSXAttributes(code, i);
    i = attrResult.end;
    
    // Skip whitespace
    while (i < code.length && /\s/.test(code[i])) i++;
    
    // Self-closing tag?
    if (code[i] === '/' && code[i + 1] === '>') {
      const isComponent = /^[A-Z]/.test(tagName);
      const tagStr = isComponent ? tagName : `"${tagName}"`;
      return {
        code: `VSV.h(${tagStr}, ${attrResult.props})`,
        end: i + 2
      };
    }
    
    // Must be >
    if (code[i] !== '>') return null;
    i++;
    
    // Parse children
    const childResult = this.parseJSXChildren(code, i, tagName);
    i = childResult.end;
    
    // Build the VSV.h() call
    const isComponent = /^[A-Z]/.test(tagName);
    const tagStr = isComponent ? tagName : `"${tagName}"`;
    
    if (childResult.children.length === 0) {
      return {
        code: `VSV.h(${tagStr}, ${attrResult.props})`,
        end: i
      };
    }
    
    return {
      code: `VSV.h(${tagStr}, ${attrResult.props}, ${childResult.children.join(', ')})`,
      end: i
    };
  }

  /**
   * Parse JSX attributes: key="value" key={expr} @event={handler}
   */
  parseJSXAttributes(code, start) {
    let i = start;
    const props = [];
    
    while (i < code.length) {
      // Skip whitespace
      while (i < code.length && /\s/.test(code[i])) i++;
      
      // End of attributes?
      if (code[i] === '>' || code[i] === '/') break;
      
      // Event handler: @click={handler}
      if (code[i] === '@') {
        i++;
        let eventName = '';
        while (i < code.length && /[a-zA-Z0-9_]/.test(code[i])) {
          eventName += code[i];
          i++;
        }
        
        // Skip =
        if (code[i] === '=') i++;
        
        // Get value
        if (code[i] === '{') {
          const exprResult = this.parseJSXExpression(code, i);
          const propName = 'on' + eventName.charAt(0).toUpperCase() + eventName.slice(1);
          props.push(`"${propName}": ${exprResult.expr}`);
          i = exprResult.end;
        }
        continue;
      }
      
      // Regular attribute
      let attrName = '';
      while (i < code.length && /[a-zA-Z0-9_-]/.test(code[i])) {
        attrName += code[i];
        i++;
      }
      
      if (!attrName) break;
      
      // Convert class to className
      const propName = attrName === 'class' ? 'className' : attrName;
      
      // Skip whitespace
      while (i < code.length && /\s/.test(code[i])) i++;
      
      // Boolean attribute (no = sign)
      if (code[i] !== '=') {
        props.push(`"${propName}": true`);
        continue;
      }
      
      i++; // Skip =
      
      // Skip whitespace
      while (i < code.length && /\s/.test(code[i])) i++;
      
      // String value: "..."
      if (code[i] === '"') {
        i++;
        let value = '';
        while (i < code.length && code[i] !== '"') {
          if (code[i] === '\\' && i + 1 < code.length) {
            value += code[i] + code[i + 1];
            i += 2;
          } else {
            value += code[i];
            i++;
          }
        }
        i++; // Skip closing "
        props.push(`"${propName}": "${value}"`);
        continue;
      }
      
      // Single quote value: '...'
      if (code[i] === "'") {
        i++;
        let value = '';
        while (i < code.length && code[i] !== "'") {
          if (code[i] === '\\' && i + 1 < code.length) {
            value += code[i] + code[i + 1];
            i += 2;
          } else {
            value += code[i];
            i++;
          }
        }
        i++; // Skip closing '
        props.push(`"${propName}": "${value}"`);
        continue;
      }
      
      // Expression value: {...}
      if (code[i] === '{') {
        const exprResult = this.parseJSXExpression(code, i);
        props.push(`"${propName}": ${exprResult.expr}`);
        i = exprResult.end;
        continue;
      }
    }
    
    return {
      props: props.length > 0 ? `{ ${props.join(', ')} }` : 'null',
      end: i
    };
  }

  /**
   * Parse a JSX expression: { ... }
   */
  parseJSXExpression(code, start) {
    let i = start;
    if (code[i] !== '{') return { expr: '', end: i };
    
    i++; // Skip {
    let depth = 1;
    let expr = '';
    
    while (i < code.length && depth > 0) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') depth--;
      
      if (depth > 0) {
        expr += code[i];
      }
      i++;
    }
    
    return { expr: expr.trim(), end: i };
  }

  /**
   * Parse JSX children until closing tag
   */
  parseJSXChildren(code, start, parentTag) {
    let i = start;
    const children = [];
    let textBuffer = '';
    
    const flushText = () => {
      if (!textBuffer) return;
      
      const lines = textBuffer.split('\n');
      
      // Find the last line with non-whitespace content
      let lastNonEmptyLine = -1;
      for (let l = lines.length - 1; l >= 0; l--) {
        if (lines[l].trim()) {
          lastNonEmptyLine = l;
          break;
        }
      }
      
      if (lastNonEmptyLine === -1) {
        textBuffer = '';
        return;
      }
      
      const parts = [];
      for (let l = 0; l < lines.length; l++) {
        let line = lines[l].replace(/\t/g, ' ');
        
        // Trim start for non-first lines (removes indentation)
        if (l !== 0) {
          line = line.trimStart();
        }
        
        // Trim end for non-last-non-empty lines
        if (l !== lastNonEmptyLine) {
          line = line.trimEnd();
        }
        
        if (line) {
          if (parts.length > 0) {
            parts.push(' ');
          }
          parts.push(line);
        }
      }
      
      const text = parts.join('');
      if (text) {
        children.push(JSON.stringify(text));
      }
      textBuffer = '';
    };
    
    while (i < code.length) {
      // Check for closing tag
      if (code[i] === '<' && code[i + 1] === '/') {
        flushText();
        
        // Verify it's our closing tag
        let closeTag = '';
        let j = i + 2;
        while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) {
          closeTag += code[j];
          j++;
        }
        
        if (closeTag === parentTag) {
          // Skip to after >
          while (j < code.length && code[j] !== '>') j++;
          return { children, end: j + 1 };
        }
        
        // Not our closing tag - this shouldn't happen in valid JSX
        textBuffer += code[i];
        i++;
        continue;
      }
      
      // Check for nested element
      if (code[i] === '<' && this.isJSXStart(code, i)) {
        flushText();
        
        const childResult = this.parseJSXElement(code, i);
        if (childResult) {
          children.push(childResult.code);
          i = childResult.end;
          continue;
        }
      }
      
      // Check for expression: { ... }
      if (code[i] === '{') {
        flushText();
        
        const exprResult = this.parseJSXExpression(code, i);
        if (exprResult.expr) {
          children.push(exprResult.expr);
        }
        i = exprResult.end;
        continue;
      }
      
      // Regular text
      textBuffer += code[i];
      i++;
    }
    
    flushText();
    return { children, end: i };
  }

  /**
   * Parse a fragment: <>...</>
   */
  parseFragment(code, start) {
    let i = start + 2; // Skip <>
    const children = [];
    let textBuffer = '';
    
    const flushText = () => {
      if (!textBuffer) return;
      
      const lines = textBuffer.split('\n');
      
      let lastNonEmptyLine = -1;
      for (let l = lines.length - 1; l >= 0; l--) {
        if (lines[l].trim()) {
          lastNonEmptyLine = l;
          break;
        }
      }
      
      if (lastNonEmptyLine === -1) {
        textBuffer = '';
        return;
      }
      
      const parts = [];
      for (let l = 0; l < lines.length; l++) {
        let line = lines[l].replace(/\t/g, ' ');
        
        if (l !== 0) {
          line = line.trimStart();
        }
        
        if (l !== lastNonEmptyLine) {
          line = line.trimEnd();
        }
        
        if (line) {
          if (parts.length > 0) {
            parts.push(' ');
          }
          parts.push(line);
        }
      }
      
      const text = parts.join('');
      if (text) {
        children.push(JSON.stringify(text));
      }
      textBuffer = '';
    };
    
    while (i < code.length) {
      // Check for closing fragment: </>
      if (code[i] === '<' && code[i + 1] === '/' && code[i + 2] === '>') {
        flushText();
        return {
          code: `VSV.h(VSV.Fragment, null${children.length > 0 ? ', ' + children.join(', ') : ''})`,
          end: i + 3
        };
      }
      
      // Check for nested element
      if (code[i] === '<' && this.isJSXStart(code, i)) {
        flushText();
        
        const childResult = this.parseJSXElement(code, i);
        if (childResult) {
          children.push(childResult.code);
          i = childResult.end;
          continue;
        }
      }
      
      // Check for expression
      if (code[i] === '{') {
        flushText();
        
        const exprResult = this.parseJSXExpression(code, i);
        if (exprResult.expr) {
          children.push(exprResult.expr);
        }
        i = exprResult.end;
        continue;
      }
      
      textBuffer += code[i];
      i++;
    }
    
    flushText();
    return { code: `VSV.h(VSV.Fragment, null${children.length > 0 ? ', ' + children.join(', ') : ''})`, end: i };
  }

  /**
   * Transform VSV directives
   */
  transformDirectives(code) {
    let result = code;
    
    // $state(value) stays as is - handled by runtime
    // $computed(() => ...) stays as is
    // $effect(() => ...) stays as is  
    // $ref(initial) stays as is
    // $memo(() => ..., deps) stays as is
    
    return result;
  }

  /**
   * Transform event handlers
   */
  transformEvents(code) {
    // @click -> onClick (already handled in parseJSXAttributes)
    return code;
  }

  /**
   * Wrap code for server execution
   */
  wrapServerCode(code, name) {
    return `
// VSV Server Component: ${name}
// Auto-generated - do not edit

const VSV = {
  h: function(tag, props) {
    var children = Array.prototype.slice.call(arguments, 2);
    return { tag: tag, props: props || {}, children: children.flat().filter(function(c) { return c != null && c !== false; }) };
  },
  Fragment: Symbol('Fragment'),
  renderToString: function(vnode) {
    if (vnode == null || vnode === false) return '';
    if (typeof vnode === 'string' || typeof vnode === 'number') return String(vnode);
    if (Array.isArray(vnode)) return vnode.map(function(v) { return VSV.renderToString(v); }).join('');
    
    var tag = vnode.tag, props = vnode.props, children = vnode.children;
    
    if (tag === VSV.Fragment) {
      return children.map(function(c) { return VSV.renderToString(c); }).join('');
    }
    
    if (typeof tag === 'function') {
      return VSV.renderToString(tag(props));
    }
    
    var attrs = '';
    for (var key in props) {
      if (key === 'children' || key.indexOf('on') === 0) continue;
      var value = props[key];
      if (key === 'className') key = 'class';
      if (value === true) attrs += ' ' + key;
      else if (value !== false && value != null) {
        attrs += ' ' + key + '="' + String(value).replace(/"/g, '&quot;') + '"';
      }
    }
    
    var selfClosing = ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'];
    if (selfClosing.indexOf(tag) !== -1) {
      return '<' + tag + attrs + '/>';
    }
    
    var childrenStr = children.map(function(c) { return VSV.renderToString(c); }).join('');
    return '<' + tag + attrs + '>' + childrenStr + '</' + tag + '>';
  }
};

// Server-side hooks (static for SSR)
function $state(initial) {
  var value = typeof initial === 'function' ? initial() : initial;
  return [function() { return value; }, function(v) { value = typeof v === 'function' ? v(value) : v; }];
}
function $computed(fn) { return fn; }
function $effect(fn) { /* No-op on server */ }
function $layoutEffect(fn) { /* No-op on server */ }
function $ref(initial) { return { current: initial !== undefined ? initial : null }; }
function $memo(fn) { return fn(); }
function $callback(fn) { return fn; }
function $reducer(reducer, init, initFn) { var s = initFn ? initFn(init) : init; return [s, function(a) { s = reducer(s, a); }]; }
function $id() { return '_vsv_ssr_' + Math.random().toString(36).slice(2, 8); }
function $transition() { return [false, function(fn) { fn(); }]; }
function $deferred(v) { return v; }
function $context(ctx) { return ctx._defaultValue || ctx._currentValue; }
function $imperativeHandle() {}
function $debugValue() {}
function $syncExternalStore(sub, snap) { return snap(); }
function $form(config) {
  var v = config.initialValues || {};
  return { values: function() { return v; }, errors: function() { return {}; }, touched: function() { return {}; }, submitting: function() { return false; }, handleChange: function(){}, handleBlur: function(){}, handleSubmit: function(e){ if(e&&e.preventDefault)e.preventDefault(); if(config.onSubmit)config.onSubmit(v); }, setFieldValue: function(){}, setFieldError: function(){}, reset: function(){}, isValid: function(){return true;} };
}
function $fetch() { return { data: function(){ return null; }, loading: function(){ return true; }, error: function(){ return null; }, refetch: function(){} }; }
function $location() { return { pathname: '/', params: {}, query: {}, navigate: function(){} }; }
function $params() { return {}; }
function $query() { return {}; }
function $navigate() { return function(){}; }
function $animation() { return { ref: { current: null }, start: function(){}, running: function(){ return false; } }; }

// Server-side components
function Show(props) { return props.when ? props.children : (props.fallback || null); }
function For(props) { var items = props.each || []; return typeof props.children === 'function' ? items.map(props.children) : null; }
function Switch(props) { var ch = Array.isArray(props.children) ? props.children : [props.children]; for(var i=0;i<ch.length;i++){ if(ch[i]&&ch[i].props&&ch[i].props.when) return ch[i].props.children||ch[i]; } return props.fallback||null; }
function Match(props) { return props.children; }
function Head() { return null; }

function createContext(defaultValue) {
  return { _defaultValue: defaultValue, _currentValue: defaultValue, Provider: function(p){ return p.children; }, Consumer: function(p){ return typeof p.children==='function'?p.children(defaultValue):p.children; } };
}
function createStore(initialState) {
  var s = Object.assign({}, initialState);
  return { getState: function(){ return s; }, setState: function(p){ s = Object.assign({}, s, typeof p==='function'?p(s):p); }, subscribe: function(){ return function(){}; }, use: function(sel){ return sel?sel(s):s; } };
}

// Server-side PropTypes (validation stubs for SSR)
var PropTypes = (function() {
  function noop() { return null; }
  function mk() { var f = noop; f.isRequired = noop; return f; }
  return { string: mk(), number: mk(), bool: mk(), func: mk(), object: mk(), array: mk(), symbol: mk(), node: mk(), element: mk(), any: mk(), arrayOf: mk, objectOf: mk, oneOf: mk, oneOfType: mk, shape: mk, exact: mk, instanceOf: mk, custom: mk };
})();

function forwardRef(fn) { return function(props) { return fn(props, props.ref); }; }
function memo(Comp) { return Comp; }
function lazy(loader) { return function(props) { return VSV.h('div', null, 'Loading...'); }; }
var Children = {
  map: function(ch, fn) { return (Array.isArray(ch)?ch:[ch]).filter(function(c){return c!=null;}).map(fn); },
  forEach: function(ch, fn) { Children.map(ch, fn); },
  count: function(ch) { return ch ? (Array.isArray(ch)?ch.filter(function(c){return c!=null;}).length:1) : 0; },
  toArray: function(ch) { return ch ? (Array.isArray(ch)?ch.filter(function(c){return c!=null;}):[ch]) : []; },
  only: function(ch) { if(Children.count(ch)!==1) throw new Error('Children.only expects one child'); return Array.isArray(ch)?ch[0]:ch; }
};

${code}

// Export the component
module.exports = typeof ${name} === 'function' ? ${name} : function(props) { return VSV.h('div', null, 'Component ${name} not found'); };
module.exports.render = function(props) {
  var Component = typeof ${name} === 'function' ? ${name} : null;
  if (Component) {
    return VSV.renderToString(Component(props || {}));
  }
  return '<div>Component ${name} not found</div>';
};
`;
  }

  /**
   * Wrap code for client execution
   */
  wrapClientCode(code, name) {
    return `
// VSV Client Component: ${name}
(function() {
  'use strict';
  
  var VSV = window.VSV;
  if (!VSV) return;
  
  // Client-side hooks
  var h = VSV.h;
  var Fragment = VSV.Fragment;
  var $state = VSV.$state;
  var $computed = VSV.$computed;
  var $effect = VSV.$effect;
  var $layoutEffect = VSV.$layoutEffect;
  var $ref = VSV.$ref;
  var $memo = VSV.$memo;
  var $callback = VSV.$callback;
  var $reducer = VSV.$reducer;
  var $id = VSV.$id;
  var $transition = VSV.$transition;
  var $deferred = VSV.$deferred;
  var $context = VSV.$context;
  var $imperativeHandle = VSV.$imperativeHandle;
  var $debugValue = VSV.$debugValue;
  var $syncExternalStore = VSV.$syncExternalStore;
  var $form = VSV.$form;
  var $fetch = VSV.$fetch;
  var $location = VSV.$location;
  var $params = VSV.$params;
  var $query = VSV.$query;
  var $navigate = VSV.$navigate;
  var $animation = VSV.$animation;
  
  // Components
  var Show = VSV.Show;
  var For = VSV.For;
  var Switch = VSV.Switch;
  var Match = VSV.Match;
  var Head = VSV.Head;
  var Router = VSV.Router;
  var Route = VSV.Route;
  var Link = VSV.Link;
  var NavLink = VSV.NavLink;
  var Redirect = VSV.Redirect;
  var Suspense = VSV.Suspense;
  var ErrorBoundary = VSV.ErrorBoundary;
  
  // Utilities
  var createContext = VSV.createContext;
  var createStore = VSV.createStore;
  var createPortal = VSV.createPortal;
  var forwardRef = VSV.forwardRef;
  var memo = VSV.memo;
  var lazy = VSV.lazy;
  var Children = VSV.Children;
  var css = VSV.css;
  var styled = VSV.styled;
  var navigate = VSV.navigate;
  var PropTypes = VSV.PropTypes;
  var resolveProps = VSV.resolveProps;
  
  ${code}
  
  // Register component
  var Component = typeof ${name} !== 'undefined' ? ${name} : (typeof __default__ !== 'undefined' ? __default__ : null);
  if (Component) {
    VSV.register('${name}', Component);
  }
})();
`;
  }

  /**
   * Transform AST for optimization
   */
  transform(ast) {
    // Clone AST
    const transformed = JSON.parse(JSON.stringify(ast));
    
    // Apply transformations
    for (const component of transformed.components) {
      // Extract reactive declarations
      this.extractReactivity(component);
      
      // Optimize JSX
      this.optimizeJSX(component);
      
      // Static analysis for partial hydration
      this.analyzeHydration(component);
    }
    
    return transformed;
  }

  /**
   * Extract reactive declarations ($state, $computed, $effect)
   */
  extractReactivity(component) {
    if (!component.body) return;
    
    component.reactivity = {
      state: [],
      computed: [],
      effects: [],
      refs: []
    };
    
    const processTokens = (tokens) => {
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        if (token.type === 'VSV_DIRECTIVE') {
          switch (token.value) {
            case '$state':
              component.reactivity.state.push({
                name: tokens[i - 2]?.value,
                initialValue: this.extractValue(tokens, i + 2)
              });
              break;
            case '$computed':
              component.reactivity.computed.push({
                name: tokens[i - 2]?.value,
                dependencies: this.extractDeps(tokens, i),
                compute: this.extractFunction(tokens, i + 2)
              });
              break;
            case '$effect':
              component.reactivity.effects.push({
                dependencies: this.extractDeps(tokens, i),
                callback: this.extractFunction(tokens, i + 2)
              });
              break;
            case '$ref':
              component.reactivity.refs.push({
                name: tokens[i - 2]?.value
              });
              break;
          }
        }
      }
    };
    
    if (Array.isArray(component.body)) {
      processTokens(component.body);
    }
  }

  /**
   * Extract value from tokens
   */
  extractValue(tokens, start) {
    if (!tokens[start]) return null;
    
    const token = tokens[start];
    if (token.type === 'NUMBER') return token.value;
    if (token.type === 'STRING') return token.value;
    if (token.value === 'true') return true;
    if (token.value === 'false') return false;
    if (token.value === 'null') return null;
    if (token.value === '[') return this.extractArray(tokens, start);
    if (token.value === '{') return this.extractObject(tokens, start);
    
    return token.value;
  }

  /**
   * Extract array from tokens
   */
  extractArray(tokens, start) {
    const arr = [];
    let i = start + 1;
    
    while (tokens[i]?.value !== ']') {
      if (tokens[i]?.type !== 'PUNCT' || tokens[i].value !== ',') {
        arr.push(this.extractValue(tokens, i));
      }
      i++;
    }
    
    return arr;
  }

  /**
   * Extract object from tokens
   */
  extractObject(tokens, start) {
    const obj = {};
    let i = start + 1;
    
    while (tokens[i]?.value !== '}') {
      if (tokens[i]?.type === 'IDENTIFIER' || tokens[i]?.type === 'STRING') {
        const key = tokens[i].value;
        if (tokens[i + 1]?.value === ':') {
          obj[key] = this.extractValue(tokens, i + 2);
          i += 2;
        }
      }
      i++;
    }
    
    return obj;
  }

  /**
   * Extract dependencies
   */
  extractDeps(tokens, start) {
    // Look for dependency array
    for (let i = start; i < Math.min(start + 20, tokens.length); i++) {
      if (tokens[i]?.value === '[') {
        return this.extractArray(tokens, i);
      }
    }
    return [];
  }

  /**
   * Extract function body
   */
  extractFunction(tokens, start) {
    let i = start;
    
    // Skip to function body
    while (i < tokens.length && tokens[i].value !== '{' && tokens[i].value !== '=>') {
      i++;
    }
    
    if (tokens[i].value === '=>') {
      i++;
    }
    
    if (tokens[i]?.value === '{') {
      let depth = 1;
      let body = '';
      i++;
      
      while (i < tokens.length && depth > 0) {
        if (tokens[i].value === '{') depth++;
        else if (tokens[i].value === '}') depth--;
        
        if (depth > 0) {
          body += tokens[i].value + ' ';
        }
        i++;
      }
      
      return body.trim();
    }
    
    return tokens[i]?.value || '';
  }

  /**
   * Optimize JSX in component
   */
  optimizeJSX(component) {
    if (!component.body) return;
    
    // Find JSX tokens and analyze
    const jsxTokens = component.body.filter(t => t.type === 'JSX');
    
    for (const jsx of jsxTokens) {
      jsx.optimized = this.analyzeJSX(jsx.value);
    }
  }

  /**
   * Analyze JSX for optimization
   */
  analyzeJSX(jsx) {
    const analysis = {
      static: true,
      bindings: [],
      events: [],
      conditionals: [],
      loops: []
    };
    
    // Find dynamic expressions
    const exprRegex = /\{([^}]+)\}/g;
    let match;
    
    while ((match = exprRegex.exec(jsx)) !== null) {
      const expr = match[1].trim();
      analysis.static = false;
      
      if (expr.includes('&&') || expr.includes('?')) {
        analysis.conditionals.push(expr);
      } else if (expr.includes('.map(') || expr.includes('.filter(')) {
        analysis.loops.push(expr);
      } else {
        analysis.bindings.push(expr);
      }
    }
    
    // Find event handlers
    const eventRegex = /@(\w+)=\{([^}]+)\}/g;
    while ((match = eventRegex.exec(jsx)) !== null) {
      analysis.events.push({
        name: match[1],
        handler: match[2]
      });
    }
    
    return analysis;
  }

  /**
   * Analyze for partial hydration
   */
  analyzeHydration(component) {
    component.hydration = {
      needed: false,
      islands: []
    };
    
    // Check if hydration is needed
    if (component.reactivity) {
      const { state, effects, refs } = component.reactivity;
      
      if (state.length > 0 || effects.length > 0 || refs.length > 0) {
        component.hydration.needed = true;
      }
    }
    
    // Find interactive islands
    if (component.body) {
      const jsxTokens = component.body.filter(t => t.type === 'JSX');
      
      for (const jsx of jsxTokens) {
        if (jsx.optimized?.events.length > 0) {
          component.hydration.needed = true;
          component.hydration.islands.push({
            events: jsx.optimized.events,
            jsx: jsx.value
          });
        }
      }
    }
  }

  /**
   * Generate server-side code
   */
  generateServer(ast, options = {}) {
    let code = `
// VSV Server Component - Generated
// ${options.name || 'Component'}

const VSV = {
  h: (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat() }),
  Fragment: Symbol('Fragment'),
  
  renderToString(vnode) {
    if (vnode == null || vnode === false) return '';
    if (typeof vnode === 'string' || typeof vnode === 'number') return String(vnode);
    if (Array.isArray(vnode)) return vnode.map(v => VSV.renderToString(v)).join('');
    
    const { tag, props, children } = vnode;
    
    if (tag === VSV.Fragment) {
      return children.map(c => VSV.renderToString(c)).join('');
    }
    
    if (typeof tag === 'function') {
      return VSV.renderToString(tag(props));
    }
    
    // Build attributes
    let attrs = '';
    for (const [key, value] of Object.entries(props)) {
      if (key === 'children') continue;
      if (key.startsWith('@')) continue; // Skip event handlers for SSR
      if (value === true) attrs += \` \${key}\`;
      else if (value !== false && value != null) {
        attrs += \` \${key}="\${String(value).replace(/"/g, '&quot;')}"\`;
      }
    }
    
    // Self-closing tags
    const selfClosing = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
    if (selfClosing.includes(tag)) {
      return \`<\${tag}\${attrs}/>\`;
    }
    
    // Render children
    const childrenStr = children.map(c => VSV.renderToString(c)).join('');
    return \`<\${tag}\${attrs}>\${childrenStr}</\${tag}>\`;
  }
};

`;

    // Add imports
    for (const imp of ast.imports) {
      code += this.generateImport(imp) + '\n';
    }
    
    // Add components
    for (const component of ast.components) {
      code += this.generateServerComponent(component) + '\n\n';
    }
    
    // Export default component
    if (ast.components.length > 0) {
      const mainComponent = ast.components.find(c => 
        ast.exports.some(e => e.default && e.declaration?.name === c.name)
      ) || ast.components[0];
      
      code += `module.exports = ${mainComponent.name};\n`;
      code += `module.exports.render = (props) => VSV.renderToString(${mainComponent.name}(props));\n`;
    }
    
    return code;
  }

  /**
   * Generate import statement
   */
  generateImport(imp) {
    const specs = imp.specifiers.map(s => {
      if (s.type === 'ImportDefaultSpecifier') return s.local;
      if (s.type === 'ImportNamespaceSpecifier') return `* as ${s.local}`;
      if (s.imported === s.local) return s.local;
      return `${s.imported} as ${s.local}`;
    });
    
    if (specs.length === 1 && imp.specifiers[0].type === 'ImportDefaultSpecifier') {
      return `const ${specs[0]} = require('${imp.source}');`;
    }
    
    return `const { ${specs.join(', ')} } = require('${imp.source}');`;
  }

  /**
   * Generate server component
   */
  generateServerComponent(component) {
    const name = component.name || 'Component';
    const params = this.generateParams(component);
    
    let code = `function ${name}(${params}) {\n`;
    
    // Add state initialization
    if (component.reactivity?.state) {
      for (const s of component.reactivity.state) {
        code += `  let ${s.name} = ${JSON.stringify(s.initialValue)};\n`;
      }
    }
    
    // Add computed
    if (component.reactivity?.computed) {
      for (const c of component.reactivity.computed) {
        code += `  const ${c.name} = (() => { ${c.compute} })();\n`;
      }
    }
    
    // Generate render
    code += this.generateRenderBody(component);
    
    code += `}\n`;
    
    return code;
  }

  /**
   * Generate parameters
   */
  generateParams(component) {
    if (component.params) {
      const params = component.params.map(p => {
        if (p.type === 'destructure') {
          return `{ ${p.properties.join(', ')} }`;
        }
        return p.default ? `${p.name} = ${JSON.stringify(p.default)}` : p.name;
      });
      return params.join(', ');
    }
    
    if (component.props?.length > 0) {
      return `{ ${component.props.map(p => p.name).join(', ')} }`;
    }
    
    return 'props = {}';
  }

  /**
   * Generate render body
   */
  generateRenderBody(component) {
    if (!component.body) {
      return '  return null;\n';
    }
    
    // Find JSX in body
    let hasReturn = false;
    let code = '';
    
    for (const token of component.body) {
      if (token.type === 'JSX') {
        hasReturn = true;
        code += `  return ${this.compileJSX(token.value)};\n`;
        break;
      }
      
      if (token.type === 'KEYWORD' && token.value === 'return') {
        hasReturn = true;
      }
    }
    
    if (!hasReturn) {
      // Reconstruct body
      code += this.tokensToCode(component.body);
    }
    
    return code;
  }

  /**
   * Compile JSX to h() calls
   */
  compileJSX(jsx) {
    // Parse JSX
    return this._legacyParseJSXElement(jsx);
  }

  /**
   * Legacy Parse JSX element (used by full parser path)
   */
  _legacyParseJSXElement(jsx) {
    jsx = jsx.trim();
    
    // Handle fragments
    if (jsx.startsWith('<>')) {
      const content = jsx.slice(2, jsx.lastIndexOf('</')).trim();
      const children = this._legacyParseJSXChildren(content);
      return `VSV.h(VSV.Fragment, null, ${children.join(', ')})`;
    }
    
    // Parse opening tag
    const tagMatch = jsx.match(/^<(\w+)/);
    if (!tagMatch) {
      // Expression or text
      if (jsx.startsWith('{') && jsx.endsWith('}')) {
        return jsx.slice(1, -1);
      }
      return JSON.stringify(jsx);
    }
    
    const tagName = tagMatch[1];
    const isComponent = /^[A-Z]/.test(tagName);
    
    // Parse attributes
    const attrs = this._legacyParseJSXAttributes(jsx);
    
    // Check self-closing
    if (jsx.endsWith('/>')) {
      const tag = isComponent ? tagName : JSON.stringify(tagName);
      return `VSV.h(${tag}, ${attrs})`;
    }
    
    // Find children
    const openTagEnd = jsx.indexOf('>');
    const closeTagStart = jsx.lastIndexOf('</');
    
    if (closeTagStart === -1) {
      const tag = isComponent ? tagName : JSON.stringify(tagName);
      return `VSV.h(${tag}, ${attrs})`;
    }
    
    const childrenContent = jsx.slice(openTagEnd + 1, closeTagStart).trim();
    const children = this._legacyParseJSXChildren(childrenContent);
    
    const tag = isComponent ? tagName : JSON.stringify(tagName);
    return `VSV.h(${tag}, ${attrs}${children.length > 0 ? ', ' + children.join(', ') : ''})`;
  }

  /**
   * Legacy Parse JSX attributes (used by full parser path)
   */
  _legacyParseJSXAttributes(jsx) {
    const attrRegex = /(\w+|@\w+)=(?:\{([^}]+)\}|"([^"]*)")|(\w+)(?=[\s/>])/g;
    const attrs = {};
    let match;
    
    // Get attribute section
    const tagEnd = jsx.indexOf('>');
    const attrSection = jsx.slice(jsx.indexOf(' '), tagEnd === -1 ? undefined : tagEnd);
    
    while ((match = attrRegex.exec(attrSection)) !== null) {
      const name = match[1] || match[4];
      if (!name) continue;
      
      // Convert @event to onClick style
      const attrName = name.startsWith('@') 
        ? 'on' + name[1].toUpperCase() + name.slice(2)
        : name;
      
      if (match[2]) {
        // Expression
        attrs[attrName] = match[2];
      } else if (match[3] !== undefined) {
        // String
        attrs[attrName] = JSON.stringify(match[3]);
      } else {
        // Boolean
        attrs[attrName] = 'true';
      }
    }
    
    if (Object.keys(attrs).length === 0) {
      return 'null';
    }
    
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => `"${k}": ${v}`)
      .join(', ');
    
    return `{ ${attrStr} }`;
  }

  /**
   * Legacy Parse JSX children (used by full parser path)
   */
  _legacyParseJSXChildren(content) {
    if (!content) return [];
    
    const children = [];
    let i = 0;
    let current = '';
    
    while (i < content.length) {
      const char = content[i];
      
      if (char === '<') {
        // Save current text
        if (current.trim()) {
          children.push(JSON.stringify(current.trim()));
        }
        current = '';
        
        // Parse nested element
        const elem = this.extractJSXElement(content, i);
        children.push(this._legacyParseJSXElement(elem.value));
        i = elem.end;
        continue;
      }
      
      if (char === '{') {
        // Save current text
        if (current.trim()) {
          children.push(JSON.stringify(current.trim()));
        }
        current = '';
        
        // Parse expression
        const expr = this.extractExpression(content, i);
        children.push(expr.value);
        i = expr.end;
        continue;
      }
      
      current += char;
      i++;
    }
    
    if (current.trim()) {
      children.push(JSON.stringify(current.trim()));
    }
    
    return children;
  }

  /**
   * Extract JSX element from string
   */
  extractJSXElement(str, start) {
    let i = start;
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    while (i < str.length) {
      const char = str[i];
      
      if ((char === '"' || char === "'" || char === '`') && !inString) {
        inString = true;
        stringChar = char;
        i++;
        continue;
      }
      
      if (inString && char === stringChar && str[i - 1] !== '\\') {
        inString = false;
        i++;
        continue;
      }
      
      if (!inString) {
        if (char === '<' && str[i + 1] !== '/') {
          depth++;
        } else if (str.slice(i, i + 2) === '/>') {
          depth--;
          i += 2;
          if (depth === 0) break;
          continue;
        } else if (char === '<' && str[i + 1] === '/') {
          while (i < str.length && str[i] !== '>') i++;
          depth--;
          i++;
          if (depth === 0) break;
          continue;
        }
      }
      
      i++;
    }
    
    return {
      value: str.slice(start, i),
      end: i
    };
  }

  /**
   * Extract expression from string
   */
  extractExpression(str, start) {
    let i = start + 1;
    let depth = 1;
    
    while (i < str.length && depth > 0) {
      if (str[i] === '{') depth++;
      else if (str[i] === '}') depth--;
      i++;
    }
    
    return {
      value: str.slice(start + 1, i - 1),
      end: i
    };
  }

  /**
   * Convert tokens back to code
   */
  tokensToCode(tokens) {
    let code = '  ';
    
    for (const token of tokens) {
      if (token.type === 'JSX') {
        code += this.compileJSX(token.value);
      } else {
        code += token.value + ' ';
      }
    }
    
    return code + '\n';
  }

  /**
   * Generate client-side code
   */
  generateClient(ast, options = {}) {
    let code = `
// VSV Client - Generated
// ${options.name || 'Component'}
(function() {
  'use strict';
  
  const VSV = window.VSV || (window.VSV = {
    components: new Map(),
    state: new Map(),
    effects: [],
    
    // Virtual DOM
    h(tag, props, ...children) {
      return { tag, props: props || {}, children: children.flat() };
    },
    
    Fragment: Symbol('Fragment'),
    
    // Render to DOM
    render(vnode, container) {
      container.innerHTML = '';
      container.appendChild(this.createElement(vnode));
    },
    
    // Create DOM element
    createElement(vnode) {
      if (vnode == null || vnode === false) return document.createTextNode('');
      if (typeof vnode === 'string' || typeof vnode === 'number') {
        return document.createTextNode(String(vnode));
      }
      if (Array.isArray(vnode)) {
        const frag = document.createDocumentFragment();
        vnode.forEach(v => frag.appendChild(this.createElement(v)));
        return frag;
      }
      
      const { tag, props, children } = vnode;
      
      if (tag === this.Fragment) {
        const frag = document.createDocumentFragment();
        children.forEach(c => frag.appendChild(this.createElement(c)));
        return frag;
      }
      
      if (typeof tag === 'function') {
        return this.createElement(tag(props));
      }
      
      const el = document.createElement(tag);
      
      for (const [key, value] of Object.entries(props)) {
        if (key === 'children') continue;
        if (key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'className') {
          el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
          Object.assign(el.style, value);
        } else if (value !== false && value != null) {
          el.setAttribute(key, value === true ? '' : value);
        }
      }
      
      children.forEach(child => {
        el.appendChild(this.createElement(child));
      });
      
      return el;
    },
    
    // State management
    $state(initial) {
      const id = 'state_' + Math.random().toString(36).slice(2);
      this.state.set(id, initial);
      
      return [
        () => this.state.get(id),
        (newValue) => {
          const old = this.state.get(id);
          const value = typeof newValue === 'function' ? newValue(old) : newValue;
          this.state.set(id, value);
          this.scheduleUpdate();
        }
      ];
    },
    
    // Computed values
    $computed(fn, deps) {
      let cached = null;
      let lastDeps = null;
      
      return () => {
        const currentDeps = deps.map(d => typeof d === 'function' ? d() : d);
        const changed = !lastDeps || currentDeps.some((d, i) => d !== lastDeps[i]);
        
        if (changed) {
          cached = fn();
          lastDeps = currentDeps;
        }
        
        return cached;
      };
    },
    
    // Effects
    $effect(fn, deps) {
      this.effects.push({ fn, deps, lastDeps: null });
    },
    
    // Run effects
    runEffects() {
      for (const effect of this.effects) {
        const currentDeps = effect.deps?.map(d => typeof d === 'function' ? d() : d);
        const changed = !effect.lastDeps || !currentDeps || 
          currentDeps.some((d, i) => d !== effect.lastDeps[i]);
        
        if (changed) {
          effect.fn();
          effect.lastDeps = currentDeps;
        }
      }
    },
    
    // Update scheduling
    updateScheduled: false,
    currentComponent: null,
    
    scheduleUpdate() {
      if (this.updateScheduled) return;
      this.updateScheduled = true;
      
      requestAnimationFrame(() => {
        this.updateScheduled = false;
        if (this.currentComponent) {
          this.currentComponent.update();
        }
        this.runEffects();
      });
    },
    
    // Hydrate server-rendered content
    hydrate() {
      const root = document.getElementById('app');
      if (!root) return;
      
      // Find hydration markers
      const markers = root.querySelectorAll('[data-vsv]');
      
      markers.forEach(marker => {
        const componentName = marker.dataset.vsv;
        const props = JSON.parse(marker.dataset.vsvProps || '{}');
        const Component = this.components.get(componentName);
        
        if (Component) {
          this.hydrateNode(marker, Component, props);
        }
      });
      
      this.runEffects();
    },
    
    // Hydrate single node
    hydrateNode(node, Component, props) {
      const instance = {
        props,
        node,
        update: () => {
          const vnode = Component(props);
          this.patch(node, vnode);
        }
      };
      
      this.currentComponent = instance;
      
      // Attach event listeners
      this.attachEvents(node, Component, props);
    },
    
    // Attach event listeners
    attachEvents(node, Component, props) {
      // Re-render to get event handlers
      const vnode = Component(props);
      this.walkAndAttach(node, vnode);
    },
    
    // Walk DOM and VDOM to attach events
    walkAndAttach(dom, vnode) {
      if (!vnode || typeof vnode !== 'object') return;
      
      const props = vnode.props || {};
      
      for (const [key, value] of Object.entries(props)) {
        if (key.startsWith('on') && typeof value === 'function') {
          const event = key.slice(2).toLowerCase();
          dom.addEventListener(event, value);
        }
      }
      
      // Process children
      if (vnode.children && dom.childNodes) {
        vnode.children.forEach((child, i) => {
          if (dom.childNodes[i] && typeof child === 'object') {
            this.walkAndAttach(dom.childNodes[i], child);
          }
        });
      }
    },
    
    // Patch DOM
    patch(dom, vnode) {
      const newDom = this.createElement(vnode);
      dom.parentNode.replaceChild(newDom, dom);
    },
    
    // Register component
    register(name, Component) {
      this.components.set(name, Component);
    }
  });
  
`;

    // Add components
    for (const component of ast.components) {
      code += this.generateClientComponent(component) + '\n';
    }
    
    code += '\n})();\n';
    
    return code;
  }

  /**
   * Generate client component
   */
  generateClientComponent(component) {
    const name = component.name || 'Component';
    const params = this.generateParams(component);
    
    let code = `
  function ${name}(${params}) {
`;
    
    // Add state
    if (component.reactivity?.state) {
      for (const s of component.reactivity.state) {
        code += `    const [${s.name}, set${s.name.charAt(0).toUpperCase() + s.name.slice(1)}] = VSV.$state(${JSON.stringify(s.initialValue)});\n`;
      }
    }
    
    // Add computed
    if (component.reactivity?.computed) {
      for (const c of component.reactivity.computed) {
        code += `    const ${c.name} = VSV.$computed(() => { ${c.compute} }, [${c.dependencies.join(', ')}]);\n`;
      }
    }
    
    // Add effects
    if (component.reactivity?.effects) {
      for (const e of component.reactivity.effects) {
        code += `    VSV.$effect(() => { ${e.callback} }, [${e.dependencies.join(', ')}]);\n`;
      }
    }
    
    // Generate render
    code += this.generateRenderBody(component);
    
    code += `  }
  VSV.register('${name}', ${name});
`;
    
    return code;
  }

  /**
   * Generate server render function (programmatic)
   */
  generateServerRender(component) {
    return function(props = {}) {
      // Merge props with defaults
      const finalProps = { ...props };
      
      for (const prop of component.props) {
        if (!(prop.name in finalProps) && prop.default !== undefined) {
          finalProps[prop.name] = prop.default;
        }
      }
      
      // Initialize state
      const state = { ...component.state };
      
      // Compute computed values
      const computed = {};
      for (const [key, fn] of Object.entries(component.computed)) {
        computed[key] = fn(finalProps, state);
      }
      
      // Render
      return component.render({ ...finalProps, ...state, ...computed });
    };
  }

  /**
   * Generate client hydration (programmatic)
   */
  generateClientHydrate(component) {
    return `
(function() {
  VSV.register('${component.name}', function(props) {
    ${Object.entries(component.state).map(([k, v]) => 
      `const [${k}, set${k.charAt(0).toUpperCase() + k.slice(1)}] = VSV.$state(${JSON.stringify(v)});`
    ).join('\n    ')}
    
    ${component.effects.map(e => `VSV.$effect(${e.toString()});`).join('\n    ')}
    
    return (${component.render.toString()})(props);
  });
})();
`;
  }

  /**
   * Minify code
   */
  minify(code) {
    return code
      // Remove comments
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .replace(/\s*([{};,:=()[\]])\s*/g, '$1')
      // Remove empty lines
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  /**
   * Generate hash
   */
  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Extract dependencies from AST
   */
  extractDependencies(ast) {
    return ast.imports.map(i => i.source);
  }

  /**
   * Check if AST has state
   */
  hasState(ast) {
    return ast.components.some(c => 
      c.reactivity?.state?.length > 0 ||
      (c.body && c.body.some(t => t.type === 'VSV_DIRECTIVE' && t.value === '$state'))
    );
  }

  /**
   * Check if AST has effects
   */
  hasEffects(ast) {
    return ast.components.some(c =>
      c.reactivity?.effects?.length > 0 ||
      (c.body && c.body.some(t => t.type === 'VSV_DIRECTIVE' && t.value === '$effect'))
    );
  }
}

module.exports = VSVCompiler;
