const url = require('url');

class Request {
  constructor(req, app) {
    Object.assign(this, req);
    this.app = app;
    this.originalUrl = req.url;
    
    const parsedUrl = url.parse(req.url, true);
    this.path = parsedUrl.pathname;
    this.query = parsedUrl.query;
    this.search = parsedUrl.search;
    
    this.params = {};
    this.body = {};
    this.cookies = {};
    this.signedCookies = {};
    this.session = null;
    this.user = null;
    this.locals = {};
  }

  get(name) {
    const header = name.toLowerCase();
    // ✅ Correction: Vérifier que headers existe
    if (!this.headers) return undefined;
    
    switch (header) {
      case 'referer':
      case 'referrer':
        return this.headers.referrer || this.headers.referer;
      default:
        return this.headers[header];
    }
  }

  header(name) {
    return this.get(name);
  }

  accepts(types) {
    const accept = this.get('accept') || '';
    if (typeof types === 'string') {
      types = [types];
    }
    
    for (const type of types) {
      if (accept.includes(type)) {
        return type;
      }
    }
    return false;
  }

  is(types) {
    const contentType = this.get('content-type') || '';
    if (typeof types === 'string') {
      types = [types];
    }
    
    for (const type of types) {
      if (contentType.includes(type)) {
        return type;
      }
    }
    return false;
  }

  get ip() {
    if (this.app && this.app.trustProxy) {
      return this.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
             this.headers?.['x-real-ip'] ||
             this.connection?.remoteAddress ||
             this.socket?.remoteAddress ||
             '127.0.0.1';
    }
    return this.connection?.remoteAddress ||
           this.socket?.remoteAddress ||
           '127.0.0.1';
  }

  get ips() {
    const forwarded = this.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',').map(ip => ip.trim()) : [this.ip];
  }

  get secure() {
    return this.connection.encrypted || 
           this.headers['x-forwarded-proto'] === 'https';
  }

  get protocol() {
    return this.secure ? 'https' : 'http';
  }

  get hostname() {
    const host = this.get('host');
    return host ? host.split(':')[0] : '';
  }

  get subdomains() {
    const hostname = this.hostname;
    return hostname.split('.').reverse().slice(2);
  }

  get xhr() {
    return this.get('x-requested-with') === 'XMLHttpRequest';
  }

  get acceptsLanguages() {
    const languages = this.get('accept-language') || '';
    return languages.split(',').map(lang => lang.trim().split(';')[0]);
  }

  get acceptsEncodings() {
    const encodings = this.get('accept-encoding') || '';
    return encodings.split(',').map(enc => enc.trim());
  }

  get userAgent() {
    return this.get('user-agent') || '';
  }

  get fresh() {
    const method = this.method;
    const status = this.res && this.res.statusCode;
    
    if ('GET' !== method && 'HEAD' !== method) return false;
    if ((status >= 200 && status < 300) || 304 === status) {
      const etag = this.res && this.res.get('ETag');
      const lastModified = this.res && this.res.get('Last-Modified');
      
      return (this.get('if-none-match') === etag) ||
             (this.get('if-modified-since') === lastModified);
    }
    
    return false;
  }

  get stale() {
    return !this.fresh;
  }
}

module.exports = Request;