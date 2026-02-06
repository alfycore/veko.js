/**
 * VSV Runtime - Complete React-equivalent for .jsv/.tsv
 * All React features reimplemented with zero dependencies
 * Client-side runtime for hydration, reactivity, routing, etc.
 */

class VSVRuntime {
  constructor(vsv) {
    this.vsv = vsv;
  }

  getClientRuntime() {
    return `/**
 * VSV Client Runtime v2.0
 * Complete React-equivalent - Zero Dependencies
 * Supports: Hooks, Context, Router, Suspense, Portals, ErrorBoundary, CSS-in-JS, Forms
 */
(function(global) {
  'use strict';
  if (global.VSV) return;

  // UID generator
  let _uid = 0;
  function uid() { return '_vsv_' + (++_uid); }

  // ========================
  //  VIRTUAL DOM
  // ========================
  const Fragment = Symbol('Fragment');
  const Portal = Symbol('Portal');

  function h(tag, props) {
    var children = [];
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (Array.isArray(c)) children = children.concat(c);
      else if (c != null && c !== false && c !== true) children.push(c);
    }
    return { tag: tag, props: props || {}, children: children, key: props && props.key };
  }

  // ========================
  //  HOOKS SYSTEM
  // ========================
  var currentComponent = null;
  var hookIndex = 0;

  function getHook() {
    if (!currentComponent) throw new Error('Hooks can only be used inside components');
    if (!currentComponent._hooks) currentComponent._hooks = [];
    var idx = hookIndex++;
    return { component: currentComponent, index: idx };
  }

  // --- $state (useState) ---
  function $state(initial) {
    var h = getHook();
    var comp = h.component;
    if (comp._hooks[h.index] === undefined) {
      comp._hooks[h.index] = { value: typeof initial === 'function' ? initial() : initial };
    }
    var hook = comp._hooks[h.index];
    var getter = function() { return hook.value; };
    var setter = function(v) {
      var next = typeof v === 'function' ? v(hook.value) : v;
      if (next !== hook.value) {
        hook.value = next;
        scheduleRerender(comp);
      }
    };
    return [getter, setter];
  }

  // --- $effect (useEffect) ---
  function $effect(fn, deps) {
    var h = getHook();
    var comp = h.component;
    if (!comp._hooks[h.index]) {
      comp._hooks[h.index] = { deps: undefined, cleanup: null, fn: fn };
    }
    var hook = comp._hooks[h.index];
    hook.fn = fn;
    var prevDeps = hook.deps;
    var changed = !prevDeps || !deps || deps.length !== prevDeps.length || deps.some(function(d, i) { return d !== prevDeps[i]; });
    if (changed) {
      hook.deps = deps ? deps.slice() : undefined;
      queueEffect(function() {
        if (hook.cleanup) hook.cleanup();
        hook.cleanup = fn() || null;
      });
    }
  }

  // --- $computed (useMemo with getter) ---
  function $computed(fn, deps) {
    var h = getHook();
    var comp = h.component;
    if (!comp._hooks[h.index]) {
      comp._hooks[h.index] = { value: undefined, deps: undefined };
    }
    var hook = comp._hooks[h.index];
    var prevDeps = hook.deps;
    var changed = !prevDeps || !deps || deps.length !== prevDeps.length || deps.some(function(d, i) { return d !== prevDeps[i]; });
    if (changed || hook.deps === undefined) {
      hook.value = fn();
      hook.deps = deps ? deps.slice() : undefined;
    }
    return function() { return hook.value; };
  }

  // --- $ref (useRef) ---
  function $ref(initial) {
    var h = getHook();
    var comp = h.component;
    if (!comp._hooks[h.index]) {
      comp._hooks[h.index] = { current: initial !== undefined ? initial : null };
    }
    return comp._hooks[h.index];
  }

  // --- $memo (useMemo) ---
  function $memo(fn, deps) {
    var h = getHook();
    var comp = h.component;
    if (!comp._hooks[h.index]) {
      comp._hooks[h.index] = { value: undefined, deps: undefined };
    }
    var hook = comp._hooks[h.index];
    var prevDeps = hook.deps;
    var changed = !prevDeps || !deps || deps.length !== prevDeps.length || deps.some(function(d, i) { return d !== prevDeps[i]; });
    if (changed || hook.deps === undefined) {
      hook.value = fn();
      hook.deps = deps ? deps.slice() : undefined;
    }
    return hook.value;
  }

  // --- $callback (useCallback) ---
  function $callback(fn, deps) {
    return $memo(function() { return fn; }, deps);
  }

  // --- $reducer (useReducer) ---
  function $reducer(reducer, initialState, init) {
    var h = getHook();
    var comp = h.component;
    if (!comp._hooks[h.index]) {
      comp._hooks[h.index] = { state: init ? init(initialState) : initialState };
    }
    var hook = comp._hooks[h.index];
    var dispatch = function(action) {
      var next = reducer(hook.state, action);
      if (next !== hook.state) {
        hook.state = next;
        scheduleRerender(comp);
      }
    };
    return [hook.state, dispatch];
  }

  // --- $id (useId) ---
  function $id() {
    var h = getHook();
    var comp = h.component;
    if (!comp._hooks[h.index]) {
      comp._hooks[h.index] = uid();
    }
    return comp._hooks[h.index];
  }

  // --- $transition (useTransition) ---
  function $transition() {
    var h = getHook();
    var comp = h.component;
    if (!comp._hooks[h.index]) {
      comp._hooks[h.index] = { pending: false };
    }
    var hook = comp._hooks[h.index];
    var startTransition = function(fn) {
      hook.pending = true;
      scheduleRerender(comp);
      requestIdleCallback(function() {
        fn();
        hook.pending = false;
        scheduleRerender(comp);
      });
    };
    return [hook.pending, startTransition];
  }

  // --- $deferred (useDeferredValue) ---
  function $deferred(value, options) {
    var h = getHook();
    var comp = h.component;
    if (!comp._hooks[h.index]) {
      comp._hooks[h.index] = { value: value };
    }
    var hook = comp._hooks[h.index];
    if (hook.value !== value) {
      if (hook.timer) clearTimeout(hook.timer);
      hook.timer = setTimeout(function() {
        hook.value = value;
        scheduleRerender(comp);
      }, (options && options.timeoutMs) || 200);
    }
    return hook.value;
  }

  // --- $context (useContext) ---
  function $context(ctx) {
    var h = getHook();
    var comp = h.component;
    if (!comp._hooks[h.index]) {
      comp._hooks[h.index] = {};
    }
    // Walk up to find provider
    var node = comp;
    while (node) {
      if (node._contextValues && node._contextValues.has(ctx)) {
        return node._contextValues.get(ctx);
      }
      node = node._parent;
    }
    return ctx._defaultValue;
  }

  // --- $layoutEffect (useLayoutEffect) ---
  function $layoutEffect(fn, deps) {
    var h = getHook();
    var comp = h.component;
    if (!comp._hooks[h.index]) {
      comp._hooks[h.index] = { deps: undefined, cleanup: null };
    }
    var hook = comp._hooks[h.index];
    var prevDeps = hook.deps;
    var changed = !prevDeps || !deps || deps.length !== prevDeps.length || deps.some(function(d, i) { return d !== prevDeps[i]; });
    if (changed) {
      hook.deps = deps ? deps.slice() : undefined;
      // Layout effects run synchronously after DOM mutations
      if (hook.cleanup) hook.cleanup();
      hook.cleanup = fn() || null;
    }
  }

  // --- $imperativeHandle (useImperativeHandle) ---
  function $imperativeHandle(ref, create, deps) {
    $layoutEffect(function() {
      var value = create();
      if (typeof ref === 'function') ref(value);
      else if (ref) ref.current = value;
    }, deps);
  }

  // --- $debugValue (useDebugValue) ---
  function $debugValue(value, formatter) {
    // Only used in dev tools - no-op in production
  }

  // --- $syncExternalStore (useSyncExternalStore) ---
  function $syncExternalStore(subscribe, getSnapshot) {
    var _state = $state(getSnapshot);
    var value = _state[0]; var setValue = _state[1];
    $effect(function() {
      return subscribe(function() {
        setValue(getSnapshot());
      });
    }, [subscribe, getSnapshot]);
    return value();
  }

  // ========================
  //  CONTEXT API
  // ========================
  function createContext(defaultValue) {
    var ctx = {
      _defaultValue: defaultValue,
      _currentValue: defaultValue,
      Provider: function(props) {
        ctx._currentValue = props.value !== undefined ? props.value : defaultValue;
        // Mark component context
        if (currentComponent) {
          if (!currentComponent._contextValues) currentComponent._contextValues = new Map();
          currentComponent._contextValues.set(ctx, ctx._currentValue);
        }
        return props.children;
      },
      Consumer: function(props) {
        var value = ctx._currentValue;
        return typeof props.children === 'function' ? props.children(value) : props.children;
      }
    };
    return ctx;
  }

  // ========================
  //  ROUTER (SPA)
  // ========================
  var routerListeners = [];
  var currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  var routerParams = {};
  var routerQuery = {};

  function RouterContext() {
    return { path: currentPath, params: routerParams, query: routerQuery };
  }

  function navigate(to, options) {
    if (typeof window === 'undefined') return;
    if (options && options.replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }
    currentPath = to;
    routerQuery = parseQuery(window.location.search);
    notifyRouterListeners();
  }

  function parseQuery(search) {
    var q = {};
    if (!search || search.length < 2) return q;
    search.slice(1).split('&').forEach(function(p) {
      var kv = p.split('=');
      q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return q;
  }

  function notifyRouterListeners() {
    routerListeners.forEach(function(fn) { fn(currentPath); });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', function() {
      currentPath = window.location.pathname;
      routerQuery = parseQuery(window.location.search);
      notifyRouterListeners();
    });
  }

  // Router component
  function Router(props) {
    var _state = $state(currentPath);
    var path = _state[0]; var setPath = _state[1];
    $effect(function() {
      var listener = function(p) { setPath(p); };
      routerListeners.push(listener);
      return function() {
        routerListeners = routerListeners.filter(function(l) { return l !== listener; });
      };
    }, []);

    var currentRoute = path();
    var routes = Array.isArray(props.children) ? props.children : [props.children];
    var matched = null;
    var fallback = null;

    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      if (!route || !route.props) continue;
      if (route.props.path === '*') { fallback = route; continue; }
      var m = matchRoute(route.props.path, currentRoute);
      if (m) { routerParams = m; matched = route; break; }
    }

    if (matched && matched.props.component) {
      return h(matched.props.component, Object.assign({}, matched.props, { params: routerParams, query: routerQuery }));
    }
    if (fallback && fallback.props.component) {
      return h(fallback.props.component, { params: {}, query: routerQuery });
    }
    return null;
  }

  function Route(props) { return null; }

  function matchRoute(pattern, pathname) {
    if (!pattern) return null;
    var keys = [];
    var re = pattern.replace(/:([\\w]+)/g, function(_, k) { keys.push(k); return '([^/]+)'; });
    var m = pathname.match(new RegExp('^' + re + '/?$'));
    if (!m) return null;
    var params = {};
    keys.forEach(function(k, i) { params[k] = m[i + 1]; });
    return params;
  }

  // Link component
  function Link(props) {
    return h('a', {
      href: props.to || props.href,
      className: props.className || props.class,
      style: props.style,
      onClick: function(e) {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !props.external) {
          e.preventDefault();
          navigate(props.to || props.href, props);
        }
        if (props.onClick) props.onClick(e);
      }
    }, props.children);
  }

  // NavLink - active-aware Link
  function NavLink(props) {
    var isActive = currentPath === (props.to || props.href);
    var cls = props.className || '';
    if (isActive && props.activeClass) cls += ' ' + props.activeClass;
    return h(Link, Object.assign({}, props, { className: cls.trim() }));
  }

  // Redirect component
  function Redirect(props) {
    $effect(function() { navigate(props.to, { replace: true }); }, []);
    return null;
  }

  // Router hooks
  function $location() {
    var _s = $state(currentPath);
    var path = _s[0]; var setPath = _s[1];
    $effect(function() {
      var fn = function(p) { setPath(p); };
      routerListeners.push(fn);
      return function() { routerListeners = routerListeners.filter(function(l) { return l !== fn; }); };
    }, []);
    return { pathname: path(), params: routerParams, query: routerQuery, navigate: navigate };
  }

  function $params() { return routerParams; }
  function $query() { return routerQuery; }
  function $navigate() { return navigate; }

  // ========================
  //  SUSPENSE & LAZY
  // ========================
  function Suspense(props) {
    try {
      return props.children;
    } catch (promise) {
      if (promise && typeof promise.then === 'function') {
        var _s = $state(false);
        var resolved = _s[0]; var setResolved = _s[1];
        promise.then(function() { setResolved(true); });
        return resolved() ? props.children : (props.fallback || h('div', null, 'Loading...'));
      }
      throw promise;
    }
  }

  function lazy(loader) {
    var Component = null;
    var promise = null;
    var error = null;
    return function LazyComponent(props) {
      if (error) throw error;
      if (Component) return h(Component, props);
      if (!promise) {
        promise = loader().then(function(mod) {
          Component = mod.default || mod;
        }).catch(function(e) { error = e; });
      }
      throw promise;
    };
  }

  // ========================
  //  ERROR BOUNDARY
  // ========================
  function ErrorBoundary(props) {
    var _s = $state(null);
    var error = _s[0]; var setError = _s[1];
    if (error()) {
      if (props.fallback) {
        return typeof props.fallback === 'function'
          ? props.fallback({ error: error(), reset: function() { setError(null); } })
          : props.fallback;
      }
      return h('div', { style: 'color:red;padding:20px;' }, 'Error: ' + error().message);
    }
    try {
      return props.children;
    } catch (e) {
      setError(e);
      return null;
    }
  }

  // ========================
  //  PORTAL
  // ========================
  function createPortal(children, container) {
    return { tag: Portal, props: { container: container }, children: Array.isArray(children) ? children : [children] };
  }

  // ========================
  //  FORWARD REF
  // ========================
  function forwardRef(renderFn) {
    return function ForwardRefComponent(props) {
      return renderFn(props, props.ref);
    };
  }

  // ========================
  //  CHILDREN API
  // ========================
  var Children = {
    map: function(children, fn) {
      if (!children) return [];
      var arr = Array.isArray(children) ? children : [children];
      return arr.filter(function(c) { return c != null; }).map(fn);
    },
    forEach: function(children, fn) {
      Children.map(children, fn);
    },
    count: function(children) {
      if (!children) return 0;
      return Array.isArray(children) ? children.filter(function(c) { return c != null; }).length : 1;
    },
    toArray: function(children) {
      if (!children) return [];
      return Array.isArray(children) ? children.filter(function(c) { return c != null; }) : [children];
    },
    only: function(children) {
      if (Children.count(children) !== 1) throw new Error('Children.only expects exactly one child');
      return Array.isArray(children) ? children[0] : children;
    }
  };

  // ========================
  //  CONDITIONAL HELPERS
  // ========================
  // <Show when={condition}> ... </Show>
  function Show(props) {
    return props.when ? props.children : (props.fallback || null);
  }

  // <For each={items}>{(item, i) => <div>{item}</div>}</For>
  function For(props) {
    var items = props.each || [];
    var fn = props.children;
    if (typeof fn !== 'function') return null;
    return items.map(function(item, i) { return fn(item, i); });
  }

  // <Switch> <Match when={...}>...</Match> </Switch>
  function Switch(props) {
    var children = Array.isArray(props.children) ? props.children : [props.children];
    for (var i = 0; i < children.length; i++) {
      if (children[i] && children[i].props && children[i].props.when) {
        return children[i].props.children || children[i];
      }
    }
    return props.fallback || null;
  }
  function Match(props) { return props.children; }

  // ========================
  //  HEAD MANAGEMENT
  // ========================
  function Head(props) {
    $effect(function() {
      // Update document title
      var children = Array.isArray(props.children) ? props.children : [props.children];
      children.forEach(function(child) {
        if (!child || !child.tag) return;
        if (child.tag === 'title') {
          document.title = child.children.join('');
        } else if (child.tag === 'meta') {
          var existing = document.querySelector('meta[name="' + child.props.name + '"]') ||
                        document.querySelector('meta[property="' + child.props.property + '"]');
          if (existing) {
            existing.setAttribute('content', child.props.content || '');
          } else {
            var meta = document.createElement('meta');
            Object.keys(child.props).forEach(function(k) { meta.setAttribute(k, child.props[k]); });
            document.head.appendChild(meta);
          }
        } else if (child.tag === 'link') {
          var link = document.createElement('link');
          Object.keys(child.props).forEach(function(k) { link.setAttribute(k, child.props[k]); });
          document.head.appendChild(link);
        }
      });
    }, [props.children]);
    return null;
  }

  // ========================
  //  CSS-IN-JS
  // ========================
  var styleSheet = null;
  var styleCache = new Map();

  function css(strings) {
    var args = [];
    for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
    var raw = strings.reduce(function(acc, str, j) {
      return acc + str + (args[j] || '');
    }, '');
    if (styleCache.has(raw)) return styleCache.get(raw);
    var className = 'vsv-' + hashStr(raw);
    if (typeof document !== 'undefined') {
      if (!styleSheet) {
        var style = document.createElement('style');
        style.id = 'vsv-styles';
        document.head.appendChild(style);
        styleSheet = style.sheet;
      }
      try { styleSheet.insertRule('.' + className + '{' + raw + '}', styleSheet.cssRules.length); } catch(e) {}
    }
    styleCache.set(raw, className);
    return className;
  }

  function styled(tag) {
    return function(strings) {
      var args = [];
      for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
      return function StyledComponent(props) {
        var resolved = strings.reduce(function(acc, str, j) {
          var arg = args[j];
          return acc + str + (typeof arg === 'function' ? arg(props) : (arg || ''));
        }, '');
        var className = css([resolved]);
        var newProps = Object.assign({}, props, { className: (props.className || '') + ' ' + className });
        delete newProps.children;
        return h(tag, newProps, props.children);
      };
    };
  }

  // ========================
  //  FORM HANDLING
  // ========================
  function $form(config) {
    var initialValues = config.initialValues || {};
    var _values = $state(Object.assign({}, initialValues));
    var values = _values[0]; var setValues = _values[1];
    var _errors = $state({});
    var errors = _errors[0]; var setErrors = _errors[1];
    var _touched = $state({});
    var touched = _touched[0]; var setTouched = _touched[1];
    var _submitting = $state(false);
    var submitting = _submitting[0]; var setSubmitting = _submitting[1];

    return {
      values: values,
      errors: errors,
      touched: touched,
      submitting: submitting,
      handleChange: function(e) {
        var name = e.target.name;
        var value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setValues(function(prev) { var next = Object.assign({}, prev); next[name] = value; return next; });
        setTouched(function(prev) { var next = Object.assign({}, prev); next[name] = true; return next; });
        if (config.validate) {
          var errs = config.validate(Object.assign({}, values(), ( function() { var o = {}; o[name] = value; return o; } )()));
          setErrors(errs || {});
        }
      },
      handleBlur: function(e) {
        var name = e.target.name;
        setTouched(function(prev) { var next = Object.assign({}, prev); next[name] = true; return next; });
      },
      handleSubmit: function(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (config.validate) {
          var errs = config.validate(values());
          setErrors(errs || {});
          if (Object.keys(errs || {}).length > 0) return;
        }
        setSubmitting(true);
        var result = config.onSubmit ? config.onSubmit(values()) : null;
        if (result && typeof result.then === 'function') {
          result.then(function() { setSubmitting(false); }).catch(function() { setSubmitting(false); });
        } else {
          setSubmitting(false);
        }
      },
      setFieldValue: function(name, value) {
        setValues(function(prev) { var next = Object.assign({}, prev); next[name] = value; return next; });
      },
      setFieldError: function(name, error) {
        setErrors(function(prev) { var next = Object.assign({}, prev); next[name] = error; return next; });
      },
      reset: function() {
        setValues(Object.assign({}, initialValues));
        setErrors({});
        setTouched({});
        setSubmitting(false);
      },
      isValid: function() { return Object.keys(errors()).length === 0; }
    };
  }

  // ========================
  //  FETCH / API HOOK
  // ========================
  function $fetch(urlOrFn, options) {
    var _data = $state(null);
    var data = _data[0]; var setData = _data[1];
    var _loading = $state(true);
    var loading = _loading[0]; var setLoading = _loading[1];
    var _error = $state(null);
    var error = _error[0]; var setError = _error[1];

    var fetchData = function() {
      setLoading(true);
      setError(null);
      var url = typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn;
      fetch(url, options)
        .then(function(res) { return res.json(); })
        .then(function(d) { setData(d); setLoading(false); })
        .catch(function(e) { setError(e); setLoading(false); });
    };

    $effect(fetchData, [typeof urlOrFn === 'function' ? urlOrFn() : urlOrFn]);

    return { data: data, loading: loading, error: error, refetch: fetchData };
  }

  // ========================
  //  STORE (like Redux/Zustand)
  // ========================
  function createStore(initialState) {
    var state = Object.assign({}, initialState);
    var listeners = [];
    return {
      getState: function() { return state; },
      setState: function(partial) {
        state = Object.assign({}, state, typeof partial === 'function' ? partial(state) : partial);
        listeners.forEach(function(fn) { fn(state); });
      },
      subscribe: function(fn) {
        listeners.push(fn);
        return function() { listeners = listeners.filter(function(l) { return l !== fn; }); };
      },
      use: function(selector) {
        var sel = selector || function(s) { return s; };
        return $syncExternalStore(
          function(cb) { return listeners.push(cb) && function() { listeners = listeners.filter(function(l) { return l !== cb; }); }; },
          function() { return sel(state); }
        );
      }
    };
  }

  // ========================
  //  ANIMATION
  // ========================
  function $animation(config) {
    var _ref = $ref(null);
    var _running = $state(false);
    var running = _running[0]; var setRunning = _running[1];

    var start = function() {
      if (!_ref.current) return;
      setRunning(true);
      var el = _ref.current;
      var from = config.from || {};
      var to = config.to || {};
      var duration = config.duration || 300;
      var startTime = performance.now();
      
      Object.keys(from).forEach(function(k) { el.style[k] = from[k]; });
      
      function tick(now) {
        var progress = Math.min((now - startTime) / duration, 1);
        var eased = config.easing ? config.easing(progress) : progress;
        Object.keys(to).forEach(function(k) {
          var fromVal = parseFloat(from[k]) || 0;
          var toVal = parseFloat(to[k]) || 0;
          var unit = (to[k] + '').replace(/[0-9.-]/g, '') || '';
          el.style[k] = (fromVal + (toVal - fromVal) * eased) + unit;
        });
        if (progress < 1) requestAnimationFrame(tick);
        else { setRunning(false); if (config.onComplete) config.onComplete(); }
      }
      requestAnimationFrame(tick);
    };

    return { ref: _ref, start: start, running: running };
  }

  // ========================
  //  DOM CREATION
  // ========================
  function createElement(vnode) {
    if (vnode == null || vnode === false || vnode === true) return document.createTextNode('');
    if (typeof vnode === 'string' || typeof vnode === 'number') return document.createTextNode(String(vnode));
    if (Array.isArray(vnode)) {
      var frag = document.createDocumentFragment();
      vnode.forEach(function(v) { frag.appendChild(createElement(v)); });
      return frag;
    }
    var tag = vnode.tag, props = vnode.props || {}, children = vnode.children || [];

    // Fragment
    if (tag === Fragment) {
      var frag = document.createDocumentFragment();
      children.forEach(function(c) { frag.appendChild(createElement(c)); });
      return frag;
    }

    // Portal
    if (tag === Portal) {
      var container = typeof props.container === 'string' ? document.querySelector(props.container) : props.container;
      if (container) children.forEach(function(c) { container.appendChild(createElement(c)); });
      return document.createTextNode('');
    }

    // Component
    if (typeof tag === 'function') {
      var resolvedProps = resolveProps(tag, Object.assign({}, props, { children: children }));
      var comp = { _hooks: [], _parent: currentComponent, _contextValues: null, render: tag, props: resolvedProps };
      var prev = currentComponent;
      currentComponent = comp;
      hookIndex = 0;
      var result = tag(resolvedProps);
      currentComponent = prev;
      return createElement(result);
    }

    // Element
    var el = document.createElement(tag);
    setProps(el, props);
    children.forEach(function(c) { el.appendChild(createElement(c)); });
    return el;
  }

  function setProps(el, props) {
    for (var key in props) {
      if (key === 'children' || key === 'key') continue;
      var value = props[key];
      if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'className' || key === 'class') {
        el.className = value;
      } else if (key === 'style') {
        if (typeof value === 'object') Object.assign(el.style, value);
        else el.style.cssText = value;
      } else if (key === 'ref') {
        if (typeof value === 'function') value(el);
        else if (value && typeof value === 'object') value.current = el;
      } else if (key === 'dangerouslySetInnerHTML') {
        el.innerHTML = (value && value.__html) || '';
      } else if (value === true) {
        el.setAttribute(key, '');
      } else if (value !== false && value != null) {
        el.setAttribute(key, String(value));
      }
    }
  }

  // ========================
  //  PATCHING (RECONCILER)
  // ========================
  function patch(dom, oldVnode, newVnode) {
    if (typeof oldVnode !== typeof newVnode) {
      var n = createElement(newVnode);
      if (dom.parentNode) dom.parentNode.replaceChild(n, dom);
      return n;
    }
    if (typeof newVnode === 'string' || typeof newVnode === 'number') {
      if (String(oldVnode) !== String(newVnode)) dom.textContent = String(newVnode);
      return dom;
    }
    if (newVnode == null) { if (dom.parentNode) dom.remove(); return null; }
    if (oldVnode && oldVnode.tag !== newVnode.tag) {
      var n = createElement(newVnode);
      if (dom.parentNode) dom.parentNode.replaceChild(n, dom);
      return n;
    }
    patchProps(dom, (oldVnode && oldVnode.props) || {}, newVnode.props || {});
    patchChildren(dom, (oldVnode && oldVnode.children) || [], newVnode.children || []);
    return dom;
  }

  function patchProps(dom, oldP, newP) {
    for (var k in oldP) {
      if (!(k in newP)) {
        if (k === 'className') dom.className = '';
        else if (!k.startsWith('on')) dom.removeAttribute(k);
      }
    }
    for (var k in newP) {
      if (oldP[k] !== newP[k]) {
        var v = newP[k];
        if (k.startsWith('on') && typeof v === 'function') {
          var ev = k.slice(2).toLowerCase();
          if (oldP[k]) dom.removeEventListener(ev, oldP[k]);
          dom.addEventListener(ev, v);
        } else if (k === 'className' || k === 'class') {
          dom.className = v;
        } else if (k === 'style' && typeof v === 'object') {
          Object.assign(dom.style, v);
        } else if (v === true) {
          dom.setAttribute(k, '');
        } else if (v === false || v == null) {
          dom.removeAttribute(k);
        } else {
          dom.setAttribute(k, String(v));
        }
      }
    }
  }

  function patchChildren(dom, oldC, newC) {
    var max = Math.max(oldC.length, newC.length);
    for (var i = 0; i < max; i++) {
      if (i >= oldC.length) {
        dom.appendChild(createElement(newC[i]));
      } else if (i >= newC.length) {
        if (dom.childNodes[i]) dom.childNodes[i].remove();
      } else {
        patch(dom.childNodes[i], oldC[i], newC[i]);
      }
    }
  }

  // ========================
  //  RENDER / HYDRATE
  // ========================
  var effects = [];
  var rerenderQueue = new Set();
  var batchScheduled = false;

  function queueEffect(fn) { effects.push(fn); }

  function flushEffects() {
    var pending = effects.splice(0);
    pending.forEach(function(fn) { fn(); });
  }

  function scheduleRerender(comp) {
    rerenderQueue.add(comp);
    if (!batchScheduled) {
      batchScheduled = true;
      queueMicrotask(function() {
        batchScheduled = false;
        rerenderQueue.forEach(function(c) {
          if (c._dom && c.render) {
            var prev = currentComponent;
            currentComponent = c;
            hookIndex = 0;
            var newVnode = c.render(c.props);
            patch(c._dom, c._vnode, newVnode);
            c._vnode = newVnode;
            currentComponent = prev;
          }
        });
        rerenderQueue.clear();
        flushEffects();
      });
    }
  }

  function render(vnode, container) {
    if (typeof container === 'string') container = document.querySelector(container);
    container.innerHTML = '';
    container.appendChild(createElement(vnode));
    flushEffects();
  }

  function hydrate() {
    var root = document.getElementById('app');
    if (!root) return;
    var markers = root.querySelectorAll('[data-vsv]');
    markers.forEach(function(node) {
      var name = node.dataset.vsv;
      var propsStr = node.dataset.vsvProps;
      var props = {};
      try { props = propsStr ? JSON.parse(propsStr.replace(/&quot;/g, '"')) : {}; } catch(e) {}
      var Component = VSV.components.get(name);
      if (!Component) return;
      var comp = { _hooks: [], _dom: node, _vnode: null, render: Component, props: props, _parent: null };
      var prev = currentComponent;
      currentComponent = comp;
      hookIndex = 0;
      comp._vnode = Component(props);
      currentComponent = prev;
      flushEffects();
      VSV.instances.set(node, comp);
    });
  }

  // ========================
  //  UTILITIES
  // ========================
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  }

  function cloneElement(element, newProps) {
    return h(element.tag, Object.assign({}, element.props, newProps), element.children);
  }

  function isValidElement(obj) {
    return obj != null && typeof obj === 'object' && 'tag' in obj;
  }

  function memo(Component, compare) {
    var lastProps = null;
    var lastResult = null;
    return function MemoComponent(props) {
      var eq = compare ? compare(lastProps, props) : shallowEqual(lastProps, props);
      if (eq && lastResult) return lastResult;
      lastProps = props;
      lastResult = Component(props);
      return lastResult;
    };
  }

  function shallowEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    var keysA = Object.keys(a);
    var keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(function(k) { return a[k] === b[k]; });
  }

  // ========================
  //  PROP TYPES
  // ========================
  function createChecker(check, typeName) {
    var fn = function(props, propName, componentName) {
      var value = props[propName];
      if (value == null) return fn.isRequired ? new Error(componentName + ': prop "' + propName + '" is required') : null;
      return check(value, propName, componentName);
    };
    fn.isRequired = false;
    fn.typeName = typeName;
    var required = function(props, propName, componentName) {
      if (props[propName] == null) return new Error(componentName + ': prop "' + propName + '" is required');
      return check(props[propName], propName, componentName);
    };
    required.isRequired = true;
    required.typeName = typeName;
    Object.defineProperty(fn, 'isRequired', { get: function() { return required; } });
    return fn;
  }

  var PropTypes = {
    string: createChecker(function(v, p, c) { return typeof v !== 'string' ? new Error(c + ': prop "' + p + '" expected string, got ' + typeof v) : null; }, 'string'),
    number: createChecker(function(v, p, c) { return typeof v !== 'number' ? new Error(c + ': prop "' + p + '" expected number, got ' + typeof v) : null; }, 'number'),
    bool: createChecker(function(v, p, c) { return typeof v !== 'boolean' ? new Error(c + ': prop "' + p + '" expected boolean, got ' + typeof v) : null; }, 'boolean'),
    func: createChecker(function(v, p, c) { return typeof v !== 'function' ? new Error(c + ': prop "' + p + '" expected function, got ' + typeof v) : null; }, 'function'),
    object: createChecker(function(v, p, c) { return typeof v !== 'object' || Array.isArray(v) ? new Error(c + ': prop "' + p + '" expected object') : null; }, 'object'),
    array: createChecker(function(v, p, c) { return !Array.isArray(v) ? new Error(c + ': prop "' + p + '" expected array, got ' + typeof v) : null; }, 'array'),
    symbol: createChecker(function(v, p, c) { return typeof v !== 'symbol' ? new Error(c + ': prop "' + p + '" expected symbol') : null; }, 'symbol'),
    node: createChecker(function(v) { return null; }, 'node'),
    element: createChecker(function(v, p, c) { return !isValidElement(v) ? new Error(c + ': prop "' + p + '" expected VSV element') : null; }, 'element'),
    any: createChecker(function() { return null; }, 'any'),

    arrayOf: function(typeChecker) {
      return createChecker(function(v, p, c) {
        if (!Array.isArray(v)) return new Error(c + ': prop "' + p + '" expected array');
        for (var i = 0; i < v.length; i++) {
          var err = typeChecker({ item: v[i] }, 'item', c + '.' + p + '[' + i + ']');
          if (err) return err;
        }
        return null;
      }, 'arrayOf');
    },

    objectOf: function(typeChecker) {
      return createChecker(function(v, p, c) {
        if (typeof v !== 'object' || Array.isArray(v)) return new Error(c + ': prop "' + p + '" expected object');
        for (var k in v) {
          var err = typeChecker({ item: v[k] }, 'item', c + '.' + p + '.' + k);
          if (err) return err;
        }
        return null;
      }, 'objectOf');
    },

    oneOf: function(values) {
      return createChecker(function(v, p, c) {
        return values.indexOf(v) === -1 ? new Error(c + ': prop "' + p + '" expected one of [' + values.join(', ') + '], got ' + v) : null;
      }, 'oneOf');
    },

    oneOfType: function(types) {
      return createChecker(function(v, p, c) {
        for (var i = 0; i < types.length; i++) {
          if (!types[i]({ val: v }, 'val', c)) return null;
        }
        return new Error(c + ': prop "' + p + '" did not match any of the expected types');
      }, 'oneOfType');
    },

    shape: function(shapeTypes) {
      return createChecker(function(v, p, c) {
        if (typeof v !== 'object') return new Error(c + ': prop "' + p + '" expected object');
        for (var k in shapeTypes) {
          var err = shapeTypes[k](v, k, c + '.' + p);
          if (err) return err;
        }
        return null;
      }, 'shape');
    },

    exact: function(shapeTypes) {
      return createChecker(function(v, p, c) {
        if (typeof v !== 'object') return new Error(c + ': prop "' + p + '" expected object');
        var keys = Object.keys(v);
        var expected = Object.keys(shapeTypes);
        for (var i = 0; i < keys.length; i++) {
          if (expected.indexOf(keys[i]) === -1) return new Error(c + ': prop "' + p + '" has unexpected key "' + keys[i] + '"');
        }
        for (var k in shapeTypes) {
          var err = shapeTypes[k](v, k, c + '.' + p);
          if (err) return err;
        }
        return null;
      }, 'exact');
    },

    instanceOf: function(cls) {
      return createChecker(function(v, p, c) {
        return !(v instanceof cls) ? new Error(c + ': prop "' + p + '" expected instance of ' + (cls.name || 'Class')) : null;
      }, 'instanceOf');
    },

    custom: function(validator) {
      return createChecker(validator, 'custom');
    }
  };

  // Apply defaultProps and validate propTypes
  function resolveProps(Component, rawProps) {
    var props = Object.assign({}, rawProps);
    // Apply defaultProps
    if (Component.defaultProps) {
      for (var k in Component.defaultProps) {
        if (props[k] === undefined) props[k] = Component.defaultProps[k];
      }
    }
    // Validate propTypes (dev only)
    if (Component.propTypes) {
      var name = Component.displayName || Component.name || 'Component';
      for (var p in Component.propTypes) {
        var err = Component.propTypes[p](props, p, name);
        if (err) console.warn('[VSV PropTypes] ' + err.message);
      }
    }
    return props;
  }

  // ========================
  //  BUILD VSV OBJECT
  // ========================
  var VSV = {
    version: '2.0.0',

    // VDOM
    h: h, Fragment: Fragment, Portal: Portal,

    // Hooks
    $state: $state, $effect: $effect, $computed: $computed, $ref: $ref, $memo: $memo,
    $callback: $callback, $reducer: $reducer, $id: $id,
    $transition: $transition, $deferred: $deferred, $context: $context,
    $layoutEffect: $layoutEffect, $imperativeHandle: $imperativeHandle,
    $debugValue: $debugValue, $syncExternalStore: $syncExternalStore,

    // Context
    createContext: createContext,

    // Router
    Router: Router, Route: Route, Link: Link, NavLink: NavLink, Redirect: Redirect,
    navigate: navigate,
    $location: $location, $params: $params, $query: $query, $navigate: $navigate,

    // Suspense / Lazy
    Suspense: Suspense, lazy: lazy,

    // Error Boundary
    ErrorBoundary: ErrorBoundary,

    // Portal
    createPortal: createPortal,

    // Ref
    forwardRef: forwardRef,

    // Children
    Children: Children,

    // Conditional
    Show: Show, For: For, Switch: Switch, Match: Match,

    // Head
    Head: Head,

    // CSS-in-JS
    css: css, styled: styled,

    // Forms
    $form: $form,

    // Fetch
    $fetch: $fetch,

    // Store
    createStore: createStore,

    // Animation
    $animation: $animation,

    // Props
    PropTypes: PropTypes, resolveProps: resolveProps,

    // Utils
    cloneElement: cloneElement, isValidElement: isValidElement, memo: memo,

    // Render
    render: render, hydrate: hydrate, createElement: createElement,

    // Registry
    components: new Map(),
    instances: new Map(),

    register: function(name, Component) {
      this.components.set(name, Component);
    },

    mount: function(Component, container, props) {
      var vnode = h(Component, props || {});
      render(vnode, container);
    }
  };

  // Expose globally
  global.VSV = VSV;

  // Global shortcuts
  global.$state = $state;
  global.$effect = $effect;
  global.$computed = $computed;
  global.$ref = $ref;
  global.$memo = $memo;
  global.$callback = $callback;
  global.$reducer = $reducer;
  global.$id = $id;
  global.$transition = $transition;
  global.$deferred = $deferred;
  global.$context = $context;
  global.$layoutEffect = $layoutEffect;
  global.$imperativeHandle = $imperativeHandle;
  global.$form = $form;
  global.$fetch = $fetch;
  global.$location = $location;
  global.$params = $params;
  global.$query = $query;
  global.$navigate = $navigate;
  global.$animation = $animation;

  // Global component utilities
  global.PropTypes = PropTypes;
  global.createContext = createContext;
  global.createStore = createStore;
  global.createPortal = createPortal;
  global.forwardRef = forwardRef;
  global.memo = memo;
  global.lazy = lazy;
  global.css = css;
  global.styled = styled;
  global.Children = Children;
  global.Fragment = Fragment;
  global.h = h;

})(typeof window !== 'undefined' ? window : global);
`;
  }

  /**
   * Get minimal runtime (production)
   */
  getMinimalRuntime() {
    const full = this.getClientRuntime();
    return full
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{};,:=()\[\]])\s*/g, '$1')
      .trim();
  }
}

module.exports = VSVRuntime;
