/**
 * VSV Runtime
 * Client-side runtime for hydration and reactivity
 * Minimal footprint, maximum performance
 */

class VSVRuntime {
  constructor(vsv) {
    this.vsv = vsv;
  }

  /**
   * Get client runtime code
   */
  getClientRuntime() {
    return `/**
 * VSV Client Runtime v1.0
 * Ultra-lightweight reactive framework
 */
(function(global) {
  'use strict';

  // Check if already loaded
  if (global.VSV) return;

  const VSV = {
    version: '1.0.0',
    
    // Component registry
    components: new Map(),
    
    // Instance registry
    instances: new Map(),
    
    // State storage
    state: new WeakMap(),
    
    // Effect queue
    effectQueue: [],
    
    // Update batch
    updateBatch: new Set(),
    batchScheduled: false,

    // ============ Virtual DOM ============
    
    h(tag, props, ...children) {
      return {
        tag,
        props: props || {},
        children: children.flat().filter(c => c != null && c !== false),
        key: props?.key
      };
    },
    
    Fragment: Symbol('Fragment'),

    // ============ DOM Creation ============
    
    createElement(vnode) {
      if (vnode == null || vnode === false) {
        return document.createTextNode('');
      }
      
      if (typeof vnode === 'string' || typeof vnode === 'number') {
        return document.createTextNode(String(vnode));
      }
      
      if (Array.isArray(vnode)) {
        const frag = document.createDocumentFragment();
        vnode.forEach(v => frag.appendChild(this.createElement(v)));
        return frag;
      }
      
      const { tag, props, children } = vnode;
      
      // Fragment
      if (tag === this.Fragment) {
        const frag = document.createDocumentFragment();
        children.forEach(c => frag.appendChild(this.createElement(c)));
        return frag;
      }
      
      // Component
      if (typeof tag === 'function') {
        return this.createElement(tag({ ...props, children }));
      }
      
      // Element
      const el = document.createElement(tag);
      this.setProps(el, props);
      children.forEach(child => el.appendChild(this.createElement(child)));
      
      return el;
    },
    
    setProps(el, props) {
      for (const [key, value] of Object.entries(props)) {
        if (key === 'children' || key === 'key') continue;
        
        if (key.startsWith('on') && typeof value === 'function') {
          const event = key.slice(2).toLowerCase();
          el.addEventListener(event, value);
        } else if (key === 'className') {
          el.className = value;
        } else if (key === 'style') {
          if (typeof value === 'object') {
            Object.assign(el.style, value);
          } else {
            el.style.cssText = value;
          }
        } else if (key === 'ref') {
          if (typeof value === 'function') value(el);
          else if (value && typeof value === 'object') value.current = el;
        } else if (key === 'dangerouslySetInnerHTML') {
          el.innerHTML = value.__html || '';
        } else if (value === true) {
          el.setAttribute(key, '');
        } else if (value !== false && value != null) {
          el.setAttribute(key, String(value));
        }
      }
    },

    // ============ Reactivity ============
    
    // Reactive state
    $state(initial) {
      const state = { value: initial, subscribers: new Set() };
      
      const getter = () => {
        // Track dependency
        if (this.currentEffect) {
          state.subscribers.add(this.currentEffect);
        }
        return state.value;
      };
      
      const setter = (newValue) => {
        const value = typeof newValue === 'function' 
          ? newValue(state.value) 
          : newValue;
        
        if (value !== state.value) {
          state.value = value;
          // Notify subscribers
          state.subscribers.forEach(effect => {
            this.effectQueue.push(effect);
          });
          this.scheduleUpdate();
        }
      };
      
      return [getter, setter];
    },
    
    // Computed values
    $computed(fn) {
      let cached = undefined;
      let dirty = true;
      
      const effect = () => {
        dirty = true;
        this.scheduleUpdate();
      };
      
      return () => {
        if (dirty) {
          const prevEffect = this.currentEffect;
          this.currentEffect = effect;
          cached = fn();
          this.currentEffect = prevEffect;
          dirty = false;
        }
        return cached;
      };
    },
    
    // Side effects
    $effect(fn, deps) {
      const effect = {
        fn,
        deps,
        cleanup: null,
        run: () => {
          if (effect.cleanup) effect.cleanup();
          const prevEffect = this.currentEffect;
          this.currentEffect = effect;
          effect.cleanup = fn();
          this.currentEffect = prevEffect;
        }
      };
      
      // Run immediately
      effect.run();
      
      return () => {
        if (effect.cleanup) effect.cleanup();
      };
    },
    
    // Refs
    $ref(initial = null) {
      return { current: initial };
    },
    
    // Memo
    $memo(fn, deps) {
      let cached = undefined;
      let lastDeps = null;
      
      return () => {
        const depsChanged = !lastDeps || deps.some((d, i) => d !== lastDeps[i]);
        
        if (depsChanged) {
          cached = fn();
          lastDeps = [...deps];
        }
        
        return cached;
      };
    },
    
    currentEffect: null,

    // ============ Update System ============
    
    scheduleUpdate() {
      if (this.batchScheduled) return;
      this.batchScheduled = true;
      
      queueMicrotask(() => {
        this.batchScheduled = false;
        this.flushUpdates();
      });
    },
    
    flushUpdates() {
      // Run effects
      while (this.effectQueue.length > 0) {
        const effect = this.effectQueue.shift();
        if (typeof effect === 'function') {
          effect();
        } else if (effect?.run) {
          effect.run();
        }
      }
      
      // Update components
      this.updateBatch.forEach(instance => {
        this.updateComponent(instance);
      });
      this.updateBatch.clear();
    },
    
    updateComponent(instance) {
      if (!instance || !instance.node) return;
      
      const vnode = instance.render(instance.props);
      this.patch(instance.node, instance.vnode, vnode);
      instance.vnode = vnode;
    },

    // ============ Patching ============
    
    patch(dom, oldVnode, newVnode) {
      // Different types - replace
      if (typeof oldVnode !== typeof newVnode) {
        const newDom = this.createElement(newVnode);
        dom.parentNode?.replaceChild(newDom, dom);
        return newDom;
      }
      
      // Text nodes
      if (typeof newVnode === 'string' || typeof newVnode === 'number') {
        if (oldVnode !== newVnode) {
          dom.textContent = String(newVnode);
        }
        return dom;
      }
      
      // Null
      if (newVnode == null) {
        dom.remove();
        return null;
      }
      
      // Different tags
      if (oldVnode?.tag !== newVnode.tag) {
        const newDom = this.createElement(newVnode);
        dom.parentNode?.replaceChild(newDom, dom);
        return newDom;
      }
      
      // Same tag - update props
      this.patchProps(dom, oldVnode.props || {}, newVnode.props || {});
      
      // Update children
      this.patchChildren(dom, oldVnode.children || [], newVnode.children || []);
      
      return dom;
    },
    
    patchProps(dom, oldProps, newProps) {
      // Remove old props
      for (const key of Object.keys(oldProps)) {
        if (!(key in newProps)) {
          if (key.startsWith('on')) {
            // Can't remove without reference to old handler
          } else if (key === 'className') {
            dom.className = '';
          } else {
            dom.removeAttribute(key);
          }
        }
      }
      
      // Set new props
      for (const [key, value] of Object.entries(newProps)) {
        if (oldProps[key] !== value) {
          if (key.startsWith('on') && typeof value === 'function') {
            const event = key.slice(2).toLowerCase();
            if (oldProps[key]) {
              dom.removeEventListener(event, oldProps[key]);
            }
            dom.addEventListener(event, value);
          } else if (key === 'className') {
            dom.className = value;
          } else if (key === 'style' && typeof value === 'object') {
            Object.assign(dom.style, value);
          } else if (value === true) {
            dom.setAttribute(key, '');
          } else if (value === false || value == null) {
            dom.removeAttribute(key);
          } else {
            dom.setAttribute(key, String(value));
          }
        }
      }
    },
    
    patchChildren(dom, oldChildren, newChildren) {
      const maxLen = Math.max(oldChildren.length, newChildren.length);
      
      for (let i = 0; i < maxLen; i++) {
        const oldChild = oldChildren[i];
        const newChild = newChildren[i];
        
        if (i >= oldChildren.length) {
          // Add new child
          dom.appendChild(this.createElement(newChild));
        } else if (i >= newChildren.length) {
          // Remove extra child
          dom.childNodes[i]?.remove();
        } else {
          // Update existing
          this.patch(dom.childNodes[i], oldChild, newChild);
        }
      }
    },

    // ============ Hydration ============
    
    hydrate() {
      const root = document.getElementById('app');
      if (!root) return;
      
      // Find hydration markers
      const markers = root.querySelectorAll('[data-vsv]');
      
      markers.forEach(node => {
        const name = node.dataset.vsv;
        const propsStr = node.dataset.vsvProps;
        
        let props = {};
        try {
          props = propsStr ? JSON.parse(propsStr.replace(/&quot;/g, '"')) : {};
        } catch (e) {
          console.warn('[VSV] Failed to parse props for', name);
        }
        
        const Component = this.components.get(name);
        if (!Component) {
          console.warn('[VSV] Component not found:', name);
          return;
        }
        
        // Create instance
        const instance = {
          name,
          props,
          node,
          vnode: null,
          render: Component
        };
        
        // Initial render to get vnode
        instance.vnode = Component(props);
        
        // Attach events
        this.attachEvents(node, instance.vnode);
        
        // Store instance
        this.instances.set(node, instance);
      });
      
      console.log('[VSV] Hydration complete');
    },
    
    attachEvents(dom, vnode, index = 0) {
      if (!vnode || typeof vnode !== 'object') return;
      if (typeof vnode === 'string' || typeof vnode === 'number') return;
      
      const props = vnode.props || {};
      
      // Attach event handlers
      for (const [key, value] of Object.entries(props)) {
        if (key.startsWith('on') && typeof value === 'function') {
          const event = key.slice(2).toLowerCase();
          dom.addEventListener(event, value);
        }
      }
      
      // Process children
      const children = vnode.children || [];
      let childIndex = 0;
      
      for (const child of children) {
        if (child && typeof child === 'object' && !Array.isArray(child)) {
          if (dom.childNodes[childIndex]) {
            this.attachEvents(dom.childNodes[childIndex], child);
          }
        }
        childIndex++;
      }
    },

    // ============ Component Registration ============
    
    register(name, Component) {
      this.components.set(name, Component);
    },
    
    define(name, definition) {
      const { props = [], state = {}, computed = {}, effects = [], render } = definition;
      
      const Component = (componentProps = {}) => {
        // Initialize state
        const stateValues = {};
        const stateSetters = {};
        
        for (const [key, initial] of Object.entries(state)) {
          const [get, set] = this.$state(initial);
          stateValues[key] = get;
          stateSetters['set' + key.charAt(0).toUpperCase() + key.slice(1)] = set;
        }
        
        // Initialize computed
        const computedValues = {};
        for (const [key, fn] of Object.entries(computed)) {
          computedValues[key] = this.$computed(() => fn(stateValues));
        }
        
        // Run effects
        for (const effect of effects) {
          this.$effect(() => effect(stateValues, stateSetters));
        }
        
        // Render
        return render({
          ...componentProps,
          ...Object.fromEntries(Object.entries(stateValues).map(([k, v]) => [k, v()])),
          ...computedValues,
          ...stateSetters
        });
      };
      
      this.register(name, Component);
      return Component;
    },

    // ============ Utilities ============
    
    // Create context
    createContext(defaultValue) {
      const context = {
        value: defaultValue,
        Provider: ({ value, children }) => {
          context.value = value;
          return children;
        },
        Consumer: ({ children }) => {
          return children(context.value);
        }
      };
      return context;
    },
    
    // Lazy loading
    lazy(loader) {
      let Component = null;
      let promise = null;
      
      return (props) => {
        if (Component) {
          return Component(props);
        }
        
        if (!promise) {
          promise = loader().then(mod => {
            Component = mod.default || mod;
          });
        }
        
        throw promise;
      };
    },
    
    // Error boundary
    ErrorBoundary: class {
      constructor(props) {
        this.props = props;
        this.state = { error: null };
      }
      
      static getDerivedStateFromError(error) {
        return { error };
      }
      
      render() {
        if (this.state.error) {
          return this.props.fallback || VSV.h('div', null, 'Something went wrong');
        }
        return this.props.children;
      }
    },

    // ============ Mount ============
    
    mount(Component, container, props = {}) {
      if (typeof container === 'string') {
        container = document.querySelector(container);
      }
      
      const vnode = Component(props);
      const dom = this.createElement(vnode);
      
      container.innerHTML = '';
      container.appendChild(dom);
      
      const instance = {
        name: Component.name || 'Anonymous',
        props,
        node: dom,
        vnode,
        render: Component,
        update: () => {
          const newVnode = Component(props);
          this.patch(instance.node, instance.vnode, newVnode);
          instance.vnode = newVnode;
        }
      };
      
      this.instances.set(dom, instance);
      
      return {
        update: (newProps) => {
          instance.props = { ...instance.props, ...newProps };
          instance.update();
        },
        unmount: () => {
          dom.remove();
          this.instances.delete(dom);
        }
      };
    }
  };

  // Expose globally
  global.VSV = VSV;
  
  // Shorthand
  global.$state = VSV.$state.bind(VSV);
  global.$computed = VSV.$computed.bind(VSV);
  global.$effect = VSV.$effect.bind(VSV);
  global.$ref = VSV.$ref.bind(VSV);
  global.$memo = VSV.$memo.bind(VSV);

})(typeof window !== 'undefined' ? window : global);
`;
  }

  /**
   * Get minimal runtime (for production)
   */
  getMinimalRuntime() {
    const full = this.getClientRuntime();
    
    // Minify
    return full
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*/g, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([{};,:=()[\]])\s*/g, '$1') // Remove space around operators
      .trim();
  }
}

module.exports = VSVRuntime;
