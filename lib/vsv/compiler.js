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
    // Parse source
    const ast = this.parser.parse(source, options);
    
    // Transform AST
    const transformed = this.transform(ast);
    
    // Generate code
    const serverCode = this.generateServer(transformed, options);
    const clientCode = this.generateClient(transformed, options);
    
    // Optimize if minify enabled
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
  }

  /**
   * Compile component definition (programmatic)
   */
  compileDefinition(name, definition) {
    const { props = [], render, state = {}, computed = {}, effects = [] } = definition;
    
    // Build component
    const component = {
      name,
      props,
      state,
      computed,
      effects,
      render: typeof render === 'function' ? render : () => render
    };
    
    // Generate server render function
    const serverRender = this.generateServerRender(component);
    
    // Generate client hydration
    const clientHydrate = this.generateClientHydrate(component);
    
    return {
      name,
      server: serverRender,
      client: clientHydrate,
      component,
      metadata: {
        hasState: Object.keys(state).length > 0,
        hasEffects: effects.length > 0
      }
    };
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
    return this.parseJSXElement(jsx);
  }

  /**
   * Parse JSX element
   */
  parseJSXElement(jsx) {
    jsx = jsx.trim();
    
    // Handle fragments
    if (jsx.startsWith('<>')) {
      const content = jsx.slice(2, jsx.lastIndexOf('</')).trim();
      const children = this.parseJSXChildren(content);
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
    const attrs = this.parseJSXAttributes(jsx);
    
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
    const children = this.parseJSXChildren(childrenContent);
    
    const tag = isComponent ? tagName : JSON.stringify(tagName);
    return `VSV.h(${tag}, ${attrs}${children.length > 0 ? ', ' + children.join(', ') : ''})`;
  }

  /**
   * Parse JSX attributes
   */
  parseJSXAttributes(jsx) {
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
   * Parse JSX children
   */
  parseJSXChildren(content) {
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
        children.push(this.parseJSXElement(elem.value));
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
