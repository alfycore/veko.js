/**
 * VekoPHP - PHP-like Template Engine for Node.js
 * Supports: <?veko ?>, <?= ?>, loops, includes, layouts, sessions, etc.
 * Zero dependencies - complete PHP-like experience in JavaScript
 */

class VekoPHP {
  constructor(vsv) {
    this.vsv = vsv;
    this.cache = new Map();
    this.globals = {};
    this.functions = {};
    this.sessions = new Map();
    this.includes = new Map();

    // Register built-in functions (PHP equivalents)
    this._registerBuiltins();
  }

  /**
   * Register PHP-equivalent built-in functions
   */
  _registerBuiltins() {
    const self = this;

    // ---- String functions ----
    this.functions.strlen = (s) => String(s).length;
    this.functions.strtolower = (s) => String(s).toLowerCase();
    this.functions.strtoupper = (s) => String(s).toUpperCase();
    this.functions.trim = (s) => String(s).trim();
    this.functions.ltrim = (s) => String(s).trimStart();
    this.functions.rtrim = (s) => String(s).trimEnd();
    this.functions.substr = (s, start, len) => len !== undefined ? String(s).substr(start, len) : String(s).substr(start);
    this.functions.str_replace = (search, replace, subject) => String(subject).split(search).join(replace);
    this.functions.str_repeat = (s, n) => String(s).repeat(n);
    this.functions.str_contains = (haystack, needle) => String(haystack).includes(needle);
    this.functions.str_starts_with = (haystack, needle) => String(haystack).startsWith(needle);
    this.functions.str_ends_with = (haystack, needle) => String(haystack).endsWith(needle);
    this.functions.str_pad = (s, len, pad, type) => {
      s = String(s); pad = pad || ' ';
      if (type === 'left' || type === 'STR_PAD_LEFT') return s.padStart(len, pad);
      if (type === 'both' || type === 'STR_PAD_BOTH') {
        const need = len - s.length;
        const left = Math.floor(need / 2);
        return s.padStart(s.length + left, pad).padEnd(len, pad);
      }
      return s.padEnd(len, pad);
    };
    this.functions.strpos = (haystack, needle) => { const i = String(haystack).indexOf(needle); return i === -1 ? false : i; };
    this.functions.strrpos = (haystack, needle) => { const i = String(haystack).lastIndexOf(needle); return i === -1 ? false : i; };
    this.functions.str_word_count = (s) => String(s).split(/\s+/).filter(Boolean).length;
    this.functions.str_split = (s, len) => { len = len || 1; const r = []; for (let i = 0; i < s.length; i += len) r.push(s.slice(i, i + len)); return r; };
    this.functions.ucfirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    this.functions.lcfirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
    this.functions.ucwords = (s) => s.replace(/\b\w/g, c => c.toUpperCase());
    this.functions.nl2br = (s) => String(s).replace(/\n/g, '<br>\n');
    this.functions.htmlspecialchars = (s) => this._escapeHtml(String(s));
    this.functions.htmlentities = (s) => this._escapeHtml(String(s));
    this.functions.htmlspecialchars_decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    this.functions.urlencode = (s) => encodeURIComponent(s);
    this.functions.urldecode = (s) => decodeURIComponent(s);
    this.functions.base64_encode = (s) => Buffer.from(String(s)).toString('base64');
    this.functions.base64_decode = (s) => Buffer.from(String(s), 'base64').toString('utf-8');
    this.functions.md5 = (s) => require('crypto').createHash('md5').update(String(s)).digest('hex');
    this.functions.sha1 = (s) => require('crypto').createHash('sha1').update(String(s)).digest('hex');
    this.functions.number_format = (n, dec, sep, thou) => {
      dec = dec || 0; sep = sep || '.'; thou = thou || ',';
      const parts = Number(n).toFixed(dec).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thou);
      return parts.join(sep);
    };
    this.functions.sprintf = function() {
      const args = Array.from(arguments);
      let fmt = args.shift();
      let i = 0;
      return fmt.replace(/%([sdf%])/g, (m, t) => {
        if (t === '%') return '%';
        if (t === 's') return String(args[i++]);
        if (t === 'd') return parseInt(args[i++]);
        if (t === 'f') return parseFloat(args[i++]);
        return m;
      });
    };
    this.functions.implode = (glue, arr) => { if (Array.isArray(glue)) { arr = glue; glue = ''; } return arr.join(glue); };
    this.functions.explode = (delim, str) => String(str).split(delim);
    this.functions.wordwrap = (s, width, br) => { width = width || 75; br = br || '\n'; return s.replace(new RegExp(`(.{1,${width}})(\\s|$)`, 'g'), '$1' + br).trim(); };

    // ---- Array functions ----
    this.functions.count = (a) => Array.isArray(a) ? a.length : (typeof a === 'object' && a ? Object.keys(a).length : 0);
    this.functions.array_push = (a, ...items) => { a.push(...items); return a.length; };
    this.functions.array_pop = (a) => a.pop();
    this.functions.array_shift = (a) => a.shift();
    this.functions.array_unshift = (a, ...items) => { a.unshift(...items); return a.length; };
    this.functions.array_merge = (...arrays) => [].concat(...arrays);
    this.functions.array_keys = (o) => Object.keys(o);
    this.functions.array_values = (o) => Array.isArray(o) ? o : Object.values(o);
    this.functions.array_unique = (a) => [...new Set(a)];
    this.functions.array_reverse = (a) => [...a].reverse();
    this.functions.array_slice = (a, s, l) => a.slice(s, l !== undefined ? s + l : undefined);
    this.functions.array_splice = (a, s, l, ...r) => { a.splice(s, l, ...r); return a; };
    this.functions.array_map = (fn, a) => a.map(fn);
    this.functions.array_filter = (a, fn) => fn ? a.filter(fn) : a.filter(Boolean);
    this.functions.array_reduce = (a, fn, init) => a.reduce(fn, init);
    this.functions.array_search = (needle, a) => { const i = a.indexOf(needle); return i === -1 ? false : i; };
    this.functions.in_array = (needle, haystack) => haystack.includes(needle);
    this.functions.array_key_exists = (key, obj) => key in obj;
    this.functions.sort = (a) => { a.sort(); return a; };
    this.functions.rsort = (a) => { a.sort().reverse(); return a; };
    this.functions.array_rand = (a, n) => { n = n || 1; const shuffled = [...a].sort(() => Math.random() - 0.5); return n === 1 ? shuffled[0] : shuffled.slice(0, n); };
    this.functions.array_chunk = (a, size) => { const r = []; for (let i = 0; i < a.length; i += size) r.push(a.slice(i, i + size)); return r; };
    this.functions.array_fill = (start, num, val) => Array(num).fill(val);
    this.functions.array_combine = (keys, values) => { const r = {}; keys.forEach((k, i) => { r[k] = values[i]; }); return r; };
    this.functions.array_flip = (o) => { const r = {}; for (const k in o) r[o[k]] = k; return r; };
    this.functions.array_sum = (a) => a.reduce((s, v) => s + Number(v), 0);
    this.functions.compact = function() { /* needs scope - handled in compile */ };
    this.functions.range = (start, end, step) => {
      step = step || 1;
      const r = [];
      if (typeof start === 'string') {
        for (let i = start.charCodeAt(0); i <= end.charCodeAt(0); i += step) r.push(String.fromCharCode(i));
      } else {
        for (let i = start; i <= end; i += step) r.push(i);
      }
      return r;
    };

    // ---- Math functions ----
    this.functions.abs = Math.abs;
    this.functions.ceil = Math.ceil;
    this.functions.floor = Math.floor;
    this.functions.round = (n, d) => { d = d || 0; const m = Math.pow(10, d); return Math.round(n * m) / m; };
    this.functions.max = Math.max;
    this.functions.min = Math.min;
    this.functions.pow = Math.pow;
    this.functions.sqrt = Math.sqrt;
    this.functions.rand = (min, max) => { min = min || 0; max = max || 2147483647; return Math.floor(Math.random() * (max - min + 1)) + min; };
    this.functions.mt_rand = this.functions.rand;
    this.functions.pi = () => Math.PI;
    this.functions.intval = (v) => parseInt(v) || 0;
    this.functions.floatval = (v) => parseFloat(v) || 0;

    // ---- Type functions ----
    this.functions.isset = (v) => v !== undefined && v !== null;
    this.functions.empty = (v) => !v || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && Object.keys(v).length === 0);
    this.functions.is_null = (v) => v === null || v === undefined;
    this.functions.is_array = (v) => Array.isArray(v);
    this.functions.is_string = (v) => typeof v === 'string';
    this.functions.is_numeric = (v) => !isNaN(parseFloat(v)) && isFinite(v);
    this.functions.is_int = (v) => Number.isInteger(v);
    this.functions.is_float = (v) => typeof v === 'number' && !Number.isInteger(v);
    this.functions.is_bool = (v) => typeof v === 'boolean';
    this.functions.is_object = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
    this.functions.gettype = (v) => {
      if (v === null) return 'NULL';
      if (Array.isArray(v)) return 'array';
      return typeof v;
    };
    this.functions.settype = (v, type) => {
      switch (type) {
        case 'int': case 'integer': return parseInt(v);
        case 'float': case 'double': return parseFloat(v);
        case 'string': return String(v);
        case 'bool': case 'boolean': return Boolean(v);
        case 'array': return Array.isArray(v) ? v : [v];
        default: return v;
      }
    };
    this.functions.var_dump = (v) => JSON.stringify(v, null, 2);
    this.functions.print_r = (v) => typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);

    // ---- Date functions ----
    this.functions.time = () => Math.floor(Date.now() / 1000);
    this.functions.microtime = (asFloat) => asFloat ? Date.now() / 1000 : `0.${Date.now() % 1000} ${Math.floor(Date.now() / 1000)}`;
    this.functions.date = (format, timestamp) => {
      const d = timestamp ? new Date(timestamp * 1000) : new Date();
      const map = {
        Y: d.getFullYear(), m: String(d.getMonth() + 1).padStart(2, '0'),
        d: String(d.getDate()).padStart(2, '0'), H: String(d.getHours()).padStart(2, '0'),
        i: String(d.getMinutes()).padStart(2, '0'), s: String(d.getSeconds()).padStart(2, '0'),
        D: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
        l: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()],
        F: ['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()],
        M: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()],
        N: d.getDay() || 7, j: d.getDate(), G: d.getHours(), g: d.getHours() % 12 || 12,
        A: d.getHours() >= 12 ? 'PM' : 'AM', a: d.getHours() >= 12 ? 'pm' : 'am',
        U: Math.floor(d.getTime() / 1000), n: d.getMonth() + 1
      };
      return format.replace(/[YmdHisDlFMNjGgAaUn]/g, m => map[m] !== undefined ? map[m] : m);
    };
    this.functions.strtotime = (s) => Math.floor(new Date(s).getTime() / 1000);
    this.functions.mktime = (h, m, s, mo, d, y) => Math.floor(new Date(y, mo - 1, d, h, m, s).getTime() / 1000);

    // ---- JSON functions ----
    this.functions.json_encode = (v) => JSON.stringify(v);
    this.functions.json_decode = (s, assoc) => { try { return JSON.parse(s); } catch { return null; } };

    // ---- File functions (server-side) ----
    this.functions.file_get_contents = (p) => { try { return require('fs').readFileSync(p, 'utf-8'); } catch { return false; } };
    this.functions.file_put_contents = (p, d) => { try { require('fs').writeFileSync(p, d); return d.length; } catch { return false; } };
    this.functions.file_exists = (p) => require('fs').existsSync(p);
    this.functions.is_file = (p) => { try { return require('fs').statSync(p).isFile(); } catch { return false; } };
    this.functions.is_dir = (p) => { try { return require('fs').statSync(p).isDirectory(); } catch { return false; } };
    this.functions.unlink = (p) => { try { require('fs').unlinkSync(p); return true; } catch { return false; } };
    this.functions.mkdir = (p, mode, recursive) => { try { require('fs').mkdirSync(p, { recursive: !!recursive }); return true; } catch { return false; } };
    this.functions.scandir = (p) => { try { return require('fs').readdirSync(p); } catch { return false; } };
    this.functions.realpath = (p) => { try { return require('fs').realpathSync(p); } catch { return false; } };
    this.functions.basename = (p) => require('path').basename(p);
    this.functions.dirname = (p) => require('path').dirname(p);
    this.functions.pathinfo = (p) => ({ dirname: require('path').dirname(p), basename: require('path').basename(p), extension: require('path').extname(p).slice(1), filename: require('path').basename(p, require('path').extname(p)) });

    // ---- Header/Output ----
    this.functions.header = () => {}; // handled in render context
    this.functions.echo = (s) => s; // handled in compile
    this.functions.print = (s) => s;
    this.functions.die = (s) => { throw { __die: true, message: s || '' }; };
    this.functions.exit = this.functions.die;

    // ---- Misc ----
    this.functions.sleep = (s) => new Promise(r => setTimeout(r, s * 1000));
    this.functions.usleep = (us) => new Promise(r => setTimeout(r, us / 1000));
    this.functions.uniqid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Compile PHP-like template to JavaScript function
   */
  compile(source, options = {}) {
    const filename = options.filename || 'template.php';

    // Check cache
    if (!options.noCache && this.cache.has(filename)) {
      const cached = this.cache.get(filename);
      if (cached.source === source) return cached.fn;
    }

    const jsCode = this._parse(source, options);

    // Create the render function
    const fn = this._createFunction(jsCode, options);

    // Cache
    this.cache.set(filename, { source, fn, js: jsCode });

    return fn;
  }

  /**
   * Parse PHP-like template into JavaScript code
   */
  _parse(source, options = {}) {
    const segments = [];
    let pos = 0;
    let code = '';

    // Support: <?veko ?>, <?= ?>, <? ?>, <?php ?> (all map to JS)
    const openTags = ['<?veko', '<?=', '<?php', '<?'];
    const closeTag = '?>';

    while (pos < source.length) {
      // Find nearest open tag
      let nearest = -1;
      let nearestTag = null;
      for (const tag of openTags) {
        const idx = source.indexOf(tag, pos);
        if (idx !== -1 && (nearest === -1 || idx < nearest)) {
          nearest = idx;
          nearestTag = tag;
        }
      }

      if (nearest === -1) {
        // Rest is HTML
        const html = source.slice(pos);
        if (html) code += `__out += ${JSON.stringify(html)};\n`;
        break;
      }

      // HTML before the tag
      const html = source.slice(pos, nearest);
      if (html) code += `__out += ${JSON.stringify(html)};\n`;

      // Find close tag
      const codeStart = nearest + nearestTag.length;
      const closeIdx = source.indexOf(closeTag, codeStart);
      if (closeIdx === -1) {
        throw new Error(`Unclosed ${nearestTag} tag at position ${nearest} in ${options.filename || 'template'}`);
      }

      let innerCode = source.slice(codeStart, closeIdx).trim();

      if (nearestTag === '<?=') {
        // Echo expression - auto-escape HTML
        code += `__out += __esc(${innerCode});\n`;
      } else {
        // Full code block
        // Transform PHP-like syntax to JS
        innerCode = this._transformPHP(innerCode);
        code += innerCode + '\n';
      }

      pos = closeIdx + closeTag.length;
    }

    return code;
  }

  /**
   * Transform PHP-like syntax into valid JavaScript
   */
  _transformPHP(code) {
    let js = code;

    // echo "..."  =>  __out += "..."
    js = js.replace(/\becho\s+(.+?)\s*;/g, '__out += __esc($1);');

    // print(...)  =>  __out += ...
    js = js.replace(/\bprint\s*\((.+?)\)\s*;/g, '__out += __esc($1);');

    // echo_raw / echo! => no escape
    js = js.replace(/\becho_raw\s+(.+?)\s*;/g, '__out += ($1);');

    // $variable => stays as is (JS supports $)
    // foreach ($arr as $val) => for (const $val of $arr)
    js = js.replace(/\bforeach\s*\(\s*(\S+)\s+as\s+(\$\w+)\s*=>\s*(\$\w+)\s*\)/g,
      'for (const [$2, $3] of Object.entries($1))');
    js = js.replace(/\bforeach\s*\(\s*(\S+)\s+as\s+(\$\w+)\s*\)/g,
      'for (const $2 of $1)');

    // endforeach => }
    js = js.replace(/\bendforeach\s*;?/g, '}');
    // endif => }
    js = js.replace(/\bendif\s*;?/g, '}');
    // endfor => }
    js = js.replace(/\bendfor\s*;?/g, '}');
    // endwhile => }
    js = js.replace(/\bendwhile\s*;?/g, '}');
    // endswitch => }
    js = js.replace(/\bendswitch\s*;?/g, '}');

    // elseif => } else if
    js = js.replace(/\belseif\s*\(/g, '} else if (');
    // else: => } else {
    js = js.replace(/\belse\s*:/g, '} else {');
    // if (...): => if (...) {
    js = js.replace(/\bif\s*\((.+?)\)\s*:/g, 'if ($1) {');
    // while (...): => while (...) {
    js = js.replace(/\bwhile\s*\((.+?)\)\s*:/g, 'while ($1) {');
    // for (...): => for (...) {
    js = js.replace(/\bfor\s*\((.+?)\)\s*:/g, 'for ($1) {');
    // switch (...): => switch (...) {
    js = js.replace(/\bswitch\s*\((.+?)\)\s*:/g, 'switch ($1) {');

    // . concatenation => + (only for string concat patterns like "str" . $var)
    // Be careful not to break object access
    js = js.replace(/(['"])\s*\.\s*/g, '$1 + ');
    js = js.replace(/\s*\.\s*(['"])/g, ' + $1');
    js = js.replace(/(\$\w+)\s*\.\s*(\$\w+|['"])/g, '$1 + $2');

    // include 'file.php' => __out += await __include('file.php')
    js = js.replace(/\binclude\s+['"](.+?)['"]\s*;/g, '__out += await __include("$1");');
    js = js.replace(/\binclude_once\s+['"](.+?)['"]\s*;/g, '__out += await __include("$1", true);');
    js = js.replace(/\brequire\s+['"](.+?)['"]\s*;/g, '__out += await __include("$1");');
    js = js.replace(/\brequire_once\s+['"](.+?)['"]\s*;/g, '__out += await __include("$1", true);');

    // session_start() => (no-op, always available)
    js = js.replace(/\bsession_start\s*\(\s*\)\s*;?/g, '');

    // $_SESSION['key'] => $SESSION['key'] (we alias it)
    js = js.replace(/\$_SESSION/g, '$SESSION');
    // $_GET => $GET, $_POST => $POST, $_SERVER => $SERVER, $_COOKIE => $COOKIE, $_REQUEST => $REQUEST
    js = js.replace(/\$_GET/g, '$GET');
    js = js.replace(/\$_POST/g, '$POST');
    js = js.replace(/\$_SERVER/g, '$SERVER');
    js = js.replace(/\$_COOKIE/g, '$COOKIE');
    js = js.replace(/\$_REQUEST/g, '$REQUEST');
    js = js.replace(/\$_FILES/g, '$FILES');

    // -> => . (object access) but only for obj->prop patterns
    js = js.replace(/->(?=[a-zA-Z_$])/g, '.');

    // :: => . (static access)
    js = js.replace(/::/g, '.');

    // array(...) => [...]
    js = js.replace(/\barray\s*\(/g, '[');
    // Close matching ) for array( ... ) => ]
    // Simple version: replace standalone array patterns
    // This is tricky - we'll handle simple cases
    js = js.replace(/\[\s*([^[\]]*?)\s*\)/g, '[$1]');

    // new stdClass() => {}
    js = js.replace(/new\s+stdClass\s*\(\s*\)/g, '{}');

    // null => null (already JS)
    // true/false => true/false (already JS)
    // AND => && / OR => ||
    js = js.replace(/\bAND\b/g, '&&');
    js = js.replace(/\bOR\b/g, '||');
    js = js.replace(/\bNOT\b/g, '!');

    // === and !== already work in JS
    // == in PHP is loose like JS ==

    return js;
  }

  /**
   * Create render function from compiled code
   */
  _createFunction(jsCode, options = {}) {
    const self = this;

    return async function render(data = {}, req = null, res = null) {
      let __out = '';
      const __includedOnce = new Set();

      // Escape helper
      function __esc(val) {
        if (val === null || val === undefined) return '';
        return self._escapeHtml(String(val));
      }

      // Raw output
      function __raw(val) {
        return val === null || val === undefined ? '' : String(val);
      }

      // Include helper
      async function __include(file, once = false) {
        if (once && __includedOnce.has(file)) return '';
        if (once) __includedOnce.add(file);
        return await self.renderFile(file, data, req, res);
      }

      // Build the scope with all variables and functions
      const scope = {};

      // All PHP-like functions
      for (const [name, fn] of Object.entries(self.functions)) {
        scope[name] = fn;
      }

      // Globals
      for (const [name, val] of Object.entries(self.globals)) {
        scope[name] = val;
      }

      // Data/props
      for (const [key, val] of Object.entries(data)) {
        scope[key] = val;
        scope['$' + key] = val; // Also expose as $key
      }

      // Superglobals
      const sessionId = req ? (self._getSessionId(req) || self._createSessionId(res)) : 'default';
      if (!self.sessions.has(sessionId)) self.sessions.set(sessionId, {});
      const session = self.sessions.get(sessionId);

      scope.$SESSION = session;
      scope.$GET = req ? (req.query || {}) : {};
      scope.$POST = req ? (req.body || {}) : {};
      scope.$REQUEST = Object.assign({}, scope.$GET, scope.$POST);
      scope.$SERVER = req ? {
        REQUEST_METHOD: req.method,
        REQUEST_URI: req.url,
        HTTP_HOST: req.headers?.host || 'localhost',
        HTTP_USER_AGENT: req.headers?.['user-agent'] || '',
        REMOTE_ADDR: req.socket?.remoteAddress || '127.0.0.1',
        SERVER_PORT: req.socket?.localPort || 80,
        DOCUMENT_ROOT: process.cwd(),
        SCRIPT_FILENAME: options.filename || '',
        SERVER_PROTOCOL: 'HTTP/1.1',
        QUERY_STRING: req.url?.split('?')[1] || ''
      } : {};
      scope.$COOKIE = req ? (req.cookies || {}) : {};
      scope.$FILES = req ? (req.files || {}) : {};

      // header() function with access to res
      scope.header = function(str) {
        if (!res) return;
        const parts = str.split(':');
        if (parts.length >= 2) {
          res.setHeader(parts[0].trim(), parts.slice(1).join(':').trim());
        } else if (str.startsWith('HTTP/')) {
          const status = parseInt(str.split(' ')[1]);
          if (status) res.statusCode = status;
        }
      };

      scope.setcookie = function(name, value, expire, path, domain, secure, httponly) {
        if (!res) return;
        let cookie = `${name}=${encodeURIComponent(value || '')}`;
        if (expire) cookie += `; Expires=${new Date(expire * 1000).toUTCString()}`;
        if (path) cookie += `; Path=${path}`;
        if (domain) cookie += `; Domain=${domain}`;
        if (secure) cookie += '; Secure';
        if (httponly) cookie += '; HttpOnly';
        res.setHeader('Set-Cookie', cookie);
      };

      scope.http_response_code = function(code) {
        if (res && code) res.statusCode = code;
        return res ? res.statusCode : 200;
      };

      // redirect helper
      scope.redirect = function(url, code) {
        if (!res) return;
        res.statusCode = code || 302;
        res.setHeader('Location', url);
        throw { __redirect: true, url };
      };

      // compact (needs scope)
      scope.compact = function() {
        const result = {};
        for (const key of arguments) {
          if (scope['$' + key] !== undefined) result[key] = scope['$' + key];
          else if (scope[key] !== undefined) result[key] = scope[key];
        }
        return result;
      };

      // Helper scope references
      scope.__out = __out;
      scope.__esc = __esc;
      scope.__raw = __raw;
      scope.__include = __include;

      // Build function body
      const fnBody = `
        var __out = '';
        ${Object.keys(scope).filter(k => !k.startsWith('__')).map(k => `var ${k} = __scope.${k};`).join('\n        ')}
        var __esc = __scope.__esc;
        var __raw = __scope.__raw;
        var __include = __scope.__include;
        
        ${jsCode}
        
        // Sync back session changes
        __scope.$SESSION = $SESSION;
        
        return __out;
      `;

      try {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction('__scope', fnBody);
        const result = await fn(scope);
        
        // Persist session
        self.sessions.set(sessionId, scope.$SESSION);
        
        return result;
      } catch (e) {
        if (e.__die) return __out + (e.message || '');
        if (e.__redirect) return __out;
        throw new Error(`PHP template error in ${options.filename || 'template'}: ${e.message}`);
      }
    };
  }

  /**
   * Render a PHP template file
   */
  async renderFile(filename, data = {}, req = null, res = null) {
    const fs = require('fs');
    const path = require('path');

    // Resolve file path
    let filePath = filename;
    if (!path.isAbsolute(filePath)) {
      const dirs = [
        process.cwd(),
        path.join(process.cwd(), 'views'),
        path.join(process.cwd(), 'pages'),
        path.join(process.cwd(), 'templates'),
        this.vsv ? path.join(process.cwd(), this.vsv.options.pagesDir || 'pages') : null
      ].filter(Boolean);

      for (const dir of dirs) {
        const test = path.join(dir, filename);
        if (fs.existsSync(test)) { filePath = test; break; }
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Template file not found: ${filename}`);
    }

    const source = fs.readFileSync(filePath, 'utf-8');
    const fn = this.compile(source, { filename: filePath });
    return fn(data, req, res);
  }

  /**
   * Render a PHP-like template string
   */
  async renderString(source, data = {}, req = null, res = null) {
    const fn = this.compile(source, { noCache: true });
    return fn(data, req, res);
  }

  // Session helpers
  _getSessionId(req) {
    if (!req || !req.headers) return null;
    const cookies = req.headers.cookie || '';
    const match = cookies.match(/VEKO_SESSION=([^;]+)/);
    return match ? match[1] : null;
  }

  _createSessionId(res) {
    const id = require('crypto').randomBytes(16).toString('hex');
    if (res && !res.headersSent) {
      try { res.setHeader('Set-Cookie', `VEKO_SESSION=${id}; Path=/; HttpOnly`); } catch {}
    }
    return id;
  }

  // HTML escaping
  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Set a global variable available in all templates
   */
  setGlobal(name, value) {
    this.globals[name] = value;
    this.globals['$' + name] = value;
  }

  /**
   * Register a custom function
   */
  registerFunction(name, fn) {
    this.functions[name] = fn;
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = VekoPHP;
