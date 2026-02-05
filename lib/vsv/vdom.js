/**
 * VSV Virtual DOM
 * Minimal, high-performance virtual DOM implementation
 * Zero dependencies
 */

/**
 * Create virtual node
 */
function h(tag, props, ...children) {
  return {
    tag,
    props: props || {},
    children: children.flat().filter(c => c != null && c !== false),
    key: props?.key
  };
}

/**
 * Fragment symbol
 */
const Fragment = Symbol('Fragment');

/**
 * Create DOM element from virtual node
 */
function createElement(vnode) {
  if (vnode == null || vnode === false) {
    return document.createTextNode('');
  }
  
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return document.createTextNode(String(vnode));
  }
  
  if (Array.isArray(vnode)) {
    const frag = document.createDocumentFragment();
    vnode.forEach(v => frag.appendChild(createElement(v)));
    return frag;
  }
  
  const { tag, props, children } = vnode;
  
  // Fragment
  if (tag === Fragment) {
    const frag = document.createDocumentFragment();
    children.forEach(c => frag.appendChild(createElement(c)));
    return frag;
  }
  
  // Component
  if (typeof tag === 'function') {
    return createElement(tag({ ...props, children }));
  }
  
  // Element
  const el = document.createElement(tag);
  
  // Set attributes
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'key') continue;
    
    if (key.startsWith('on') && typeof value === 'function') {
      // Event handler
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'className') {
      el.className = value;
    } else if (key === 'style') {
      if (typeof value === 'object') {
        Object.assign(el.style, value);
      } else {
        el.style.cssText = value;
      }
    } else if (key === 'ref' && typeof value === 'function') {
      value(el);
    } else if (key === 'dangerouslySetInnerHTML') {
      el.innerHTML = value.__html || '';
    } else if (value === true) {
      el.setAttribute(key, '');
    } else if (value !== false && value != null) {
      el.setAttribute(key, String(value));
    }
  }
  
  // Append children
  children.forEach(child => {
    el.appendChild(createElement(child));
  });
  
  return el;
}

/**
 * Render to string (SSR)
 */
function renderToString(vnode, options = {}) {
  if (vnode == null || vnode === false) return '';
  
  if (typeof vnode === 'string') {
    return escapeHtml(vnode);
  }
  
  if (typeof vnode === 'number') {
    return String(vnode);
  }
  
  if (Array.isArray(vnode)) {
    return vnode.map(v => renderToString(v, options)).join('');
  }
  
  const { tag, props, children } = vnode;
  
  // Fragment
  if (tag === Fragment) {
    return children.map(c => renderToString(c, options)).join('');
  }
  
  // Component
  if (typeof tag === 'function') {
    const result = tag({ ...props, children });
    return renderToString(result, options);
  }
  
  // Build attributes
  let attrs = '';
  
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'key') continue;
    if (key.startsWith('on')) continue; // Skip event handlers for SSR
    if (key === 'ref') continue;
    if (key === 'dangerouslySetInnerHTML') continue;
    
    if (key === 'className') {
      attrs += ` class="${escapeAttr(value)}"`;
    } else if (key === 'style' && typeof value === 'object') {
      const css = Object.entries(value)
        .map(([k, v]) => `${kebabCase(k)}:${v}`)
        .join(';');
      attrs += ` style="${escapeAttr(css)}"`;
    } else if (value === true) {
      attrs += ` ${key}`;
    } else if (value !== false && value != null) {
      attrs += ` ${key}="${escapeAttr(String(value))}"`;
    }
  }
  
  // Add hydration marker if needed
  if (options.hydrate && typeof tag === 'string' && props['data-vsv']) {
    attrs += ` data-vsv-props="${escapeAttr(JSON.stringify(props))}"`;
  }
  
  // Self-closing tags
  const selfClosing = [
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ];
  
  if (selfClosing.includes(tag)) {
    return `<${tag}${attrs}/>`;
  }
  
  // Handle innerHTML
  if (props.dangerouslySetInnerHTML) {
    return `<${tag}${attrs}>${props.dangerouslySetInnerHTML.__html || ''}</${tag}>`;
  }
  
  // Render children
  const childrenStr = children.map(c => renderToString(c, options)).join('');
  
  return `<${tag}${attrs}>${childrenStr}</${tag}>`;
}

/**
 * Render to stream (for large pages)
 */
async function* renderToStream(vnode, options = {}) {
  if (vnode == null || vnode === false) {
    yield '';
    return;
  }
  
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    yield String(vnode);
    return;
  }
  
  if (Array.isArray(vnode)) {
    for (const v of vnode) {
      yield* renderToStream(v, options);
    }
    return;
  }
  
  const { tag, props, children } = vnode;
  
  // Fragment
  if (tag === Fragment) {
    for (const child of children) {
      yield* renderToStream(child, options);
    }
    return;
  }
  
  // Component
  if (typeof tag === 'function') {
    const result = tag({ ...props, children });
    yield* renderToStream(result, options);
    return;
  }
  
  // Build attributes
  let attrs = '';
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'key' || key.startsWith('on') || key === 'ref') continue;
    
    if (key === 'className') {
      attrs += ` class="${escapeAttr(value)}"`;
    } else if (value === true) {
      attrs += ` ${key}`;
    } else if (value !== false && value != null) {
      attrs += ` ${key}="${escapeAttr(String(value))}"`;
    }
  }
  
  // Self-closing tags
  const selfClosing = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
  
  if (selfClosing.includes(tag)) {
    yield `<${tag}${attrs}/>`;
    return;
  }
  
  yield `<${tag}${attrs}>`;
  
  // Stream children
  for (const child of children) {
    yield* renderToStream(child, options);
  }
  
  yield `</${tag}>`;
}

/**
 * Diff two virtual nodes
 */
function diff(oldVnode, newVnode) {
  const patches = [];
  
  diffNode(oldVnode, newVnode, patches, []);
  
  return patches;
}

/**
 * Diff single node
 */
function diffNode(oldVnode, newVnode, patches, path) {
  // Both null
  if (oldVnode == null && newVnode == null) {
    return;
  }
  
  // New node
  if (oldVnode == null) {
    patches.push({ type: 'CREATE', path, vnode: newVnode });
    return;
  }
  
  // Remove node
  if (newVnode == null) {
    patches.push({ type: 'REMOVE', path });
    return;
  }
  
  // Different types
  if (typeof oldVnode !== typeof newVnode) {
    patches.push({ type: 'REPLACE', path, vnode: newVnode });
    return;
  }
  
  // Text nodes
  if (typeof oldVnode === 'string' || typeof oldVnode === 'number') {
    if (oldVnode !== newVnode) {
      patches.push({ type: 'TEXT', path, value: newVnode });
    }
    return;
  }
  
  // Different tags
  if (oldVnode.tag !== newVnode.tag) {
    patches.push({ type: 'REPLACE', path, vnode: newVnode });
    return;
  }
  
  // Diff props
  const propPatches = diffProps(oldVnode.props, newVnode.props);
  if (propPatches.length > 0) {
    patches.push({ type: 'PROPS', path, patches: propPatches });
  }
  
  // Diff children
  const oldChildren = oldVnode.children || [];
  const newChildren = newVnode.children || [];
  
  // Use keys if available
  const oldKeyed = new Map();
  const newKeyed = new Map();
  
  oldChildren.forEach((c, i) => {
    if (c?.key != null) oldKeyed.set(c.key, { vnode: c, index: i });
  });
  
  newChildren.forEach((c, i) => {
    if (c?.key != null) newKeyed.set(c.key, { vnode: c, index: i });
  });
  
  if (oldKeyed.size > 0 || newKeyed.size > 0) {
    // Keyed diff
    diffKeyedChildren(oldChildren, newChildren, oldKeyed, newKeyed, patches, path);
  } else {
    // Simple diff
    const maxLen = Math.max(oldChildren.length, newChildren.length);
    for (let i = 0; i < maxLen; i++) {
      diffNode(oldChildren[i], newChildren[i], patches, [...path, i]);
    }
  }
}

/**
 * Diff props
 */
function diffProps(oldProps, newProps) {
  const patches = [];
  const allKeys = new Set([...Object.keys(oldProps || {}), ...Object.keys(newProps || {})]);
  
  for (const key of allKeys) {
    if (key === 'children' || key === 'key') continue;
    
    const oldValue = oldProps?.[key];
    const newValue = newProps?.[key];
    
    if (oldValue !== newValue) {
      patches.push({ key, value: newValue });
    }
  }
  
  return patches;
}

/**
 * Diff keyed children
 */
function diffKeyedChildren(oldChildren, newChildren, oldKeyed, newKeyed, patches, path) {
  // Find moves, additions, removals
  const moves = [];
  
  // Remove old keys not in new
  for (const [key, { index }] of oldKeyed) {
    if (!newKeyed.has(key)) {
      patches.push({ type: 'REMOVE', path: [...path, index] });
    }
  }
  
  // Add/move new keys
  newChildren.forEach((child, newIndex) => {
    if (child?.key != null) {
      const old = oldKeyed.get(child.key);
      if (old) {
        if (old.index !== newIndex) {
          moves.push({ type: 'MOVE', from: [...path, old.index], to: [...path, newIndex] });
        }
        diffNode(old.vnode, child, patches, [...path, newIndex]);
      } else {
        patches.push({ type: 'CREATE', path: [...path, newIndex], vnode: child });
      }
    } else {
      diffNode(oldChildren[newIndex], child, patches, [...path, newIndex]);
    }
  });
  
  if (moves.length > 0) {
    patches.push({ type: 'REORDER', path, moves });
  }
}

/**
 * Apply patches to DOM
 */
function patch(root, patches) {
  for (const p of patches) {
    applyPatch(root, p);
  }
}

/**
 * Apply single patch
 */
function applyPatch(root, p) {
  const node = getNodeAtPath(root, p.path);
  
  switch (p.type) {
    case 'CREATE':
      const parent = getNodeAtPath(root, p.path.slice(0, -1));
      const index = p.path[p.path.length - 1];
      const newNode = createElement(p.vnode);
      if (parent.childNodes[index]) {
        parent.insertBefore(newNode, parent.childNodes[index]);
      } else {
        parent.appendChild(newNode);
      }
      break;
      
    case 'REMOVE':
      node?.remove();
      break;
      
    case 'REPLACE':
      const replacement = createElement(p.vnode);
      node?.parentNode?.replaceChild(replacement, node);
      break;
      
    case 'TEXT':
      node.textContent = p.value;
      break;
      
    case 'PROPS':
      for (const { key, value } of p.patches) {
        if (key.startsWith('on')) {
          // Event handlers need special handling
          continue;
        }
        if (value == null || value === false) {
          node.removeAttribute(key);
        } else if (key === 'className') {
          node.className = value;
        } else if (key === 'style' && typeof value === 'object') {
          Object.assign(node.style, value);
        } else {
          node.setAttribute(key, value === true ? '' : value);
        }
      }
      break;
      
    case 'REORDER':
      // Handle moves
      for (const move of p.moves) {
        const fromNode = getNodeAtPath(root, move.from);
        const parent = getNodeAtPath(root, p.path);
        const toIndex = move.to[move.to.length - 1];
        
        if (parent.childNodes[toIndex]) {
          parent.insertBefore(fromNode, parent.childNodes[toIndex]);
        } else {
          parent.appendChild(fromNode);
        }
      }
      break;
  }
}

/**
 * Get node at path
 */
function getNodeAtPath(root, path) {
  let node = root;
  
  for (const index of path) {
    if (!node || !node.childNodes) return null;
    node = node.childNodes[index];
  }
  
  return node;
}

/**
 * Escape HTML
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape attribute value
 */
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convert camelCase to kebab-case
 */
function kebabCase(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// Export
module.exports = {
  h,
  Fragment,
  createElement,
  renderToString,
  renderToStream,
  diff,
  patch,
  escapeHtml,
  escapeAttr
};
