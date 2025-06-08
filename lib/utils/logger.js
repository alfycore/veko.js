const util = require('util');

// Couleurs ANSI
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Couleurs de base
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Couleurs de fond
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  
  // Couleurs brillantes
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m'
};

// Niveaux de log
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  HTTP: 3,
  DEBUG: 4,
  TRACE: 5
};

// Configuration des niveaux
const levelConfig = {
  ERROR: { color: colors.brightRed, icon: '❌', bg: colors.bgRed },
  WARN: { color: colors.brightYellow, icon: '⚠️ ', bg: colors.bgYellow },
  INFO: { color: colors.brightBlue, icon: 'ℹ️ ', bg: colors.bgBlue },
  HTTP: { color: colors.brightGreen, icon: '🌐', bg: colors.bgGreen },
  DEBUG: { color: colors.brightMagenta, icon: '🐛', bg: colors.bgMagenta },
  TRACE: { color: colors.brightCyan, icon: '🔍', bg: colors.bgCyan }
};

// Codes de statut HTTP avec couleurs
const statusColors = {
  1: colors.brightCyan,    // 1xx Informational
  2: colors.brightGreen,   // 2xx Success
  3: colors.brightYellow,  // 3xx Redirection
  4: colors.brightRed,     // 4xx Client Error
  5: colors.red            // 5xx Server Error
};

class Logger {
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level] || LOG_LEVELS.INFO;
    this.enableColors = options.colors !== false;
    this.enableTimestamp = options.timestamp !== false;
    this.enablePretty = options.pretty !== false;
    this.prefix = options.prefix || '';
    this.stream = options.stream || process.stdout;
  }

  colorize(text, color) {
    return this.enableColors ? `${color}${text}${colors.reset}` : text;
  }

  formatTimestamp() {
    const now = new Date();
    const time = now.toLocaleTimeString('fr-FR', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    return this.colorize(`[${time}]`, colors.dim);
  }

  formatLevel(level) {
    const config = levelConfig[level];
    if (this.enablePretty) {
      return `${config.icon} ${this.colorize(level.padEnd(5), config.color)}`;
    }
    return this.colorize(`[${level}]`, config.color);
  }

  formatMessage(level, message, meta = {}) {
    const parts = [];
    
    if (this.enableTimestamp) {
      parts.push(this.formatTimestamp());
    }
    
    parts.push(this.formatLevel(level));
    
    if (this.prefix) {
      parts.push(this.colorize(`[${this.prefix}]`, colors.cyan));
    }
    
    parts.push(message);
    
    let formatted = parts.join(' ');
    
    // Ajouter les métadonnées si présentes
    if (Object.keys(meta).length > 0) {
      formatted += '\n' + this.colorize(util.inspect(meta, { 
        colors: this.enableColors,
        depth: 3,
        compact: false
      }), colors.dim);
    }
    
    return formatted;
  }

  log(level, message, meta = {}) {
    if (LOG_LEVELS[level] > this.level) return;
    
    const formatted = this.formatMessage(level, message, meta);
    this.stream.write(formatted + '\n');
  }

  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }

  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  http(message, meta = {}) {
    this.log('HTTP', message, meta);
  }

  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }

  trace(message, meta = {}) {
    this.log('TRACE', message, meta);
  }

  // Fonction utilitaire pour obtenir un header de façon sécurisée
  getHeader(req, headerName) {
    if (req.get && typeof req.get === 'function') {
      return req.get(headerName);
    }
    return req.headers && req.headers[headerName.toLowerCase()];
  }

  // Méthodes spéciales pour les requêtes HTTP
  request(req, res, responseTime) {
    const method = this.colorize(req.method.padEnd(7), this.getMethodColor(req.method));
    const status = this.colorize(res.statusCode, this.getStatusColor(res.statusCode));
    const path = this.colorize(req.path || req.url, colors.white);
    const time = this.colorize(`${responseTime}ms`, colors.dim);
    
    // Obtenir l'IP de façon sécurisée
    let ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
    ip = this.colorize(ip, colors.cyan);
    
    // Déterminer le type de réponse
    let responseType = '';
    const contentType = res.getHeader ? res.getHeader('Content-Type') : '';
    if (contentType) {
      if (contentType.includes('text/html')) responseType = '🌐 HTML';
      else if (contentType.includes('application/json')) responseType = '📋 JSON';
      else if (contentType.includes('text/css')) responseType = '🎨 CSS';
      else if (contentType.includes('application/javascript')) responseType = '⚡ JS';
      else if (contentType.includes('image/')) responseType = '🖼️  IMG';
      else responseType = '📄 FILE';
    }
    
    let userAgent = '';
    const ua = this.getHeader(req, 'user-agent');
    if (ua) {
      if (ua.includes('Chrome')) userAgent = '🌐 Chrome';
      else if (ua.includes('Firefox')) userAgent = '🦊 Firefox';
      else if (ua.includes('Safari')) userAgent = '🧭 Safari';
      else if (ua.includes('Edge')) userAgent = '🔷 Edge';
      else if (ua.includes('curl')) userAgent = '⚡ curl';
      else if (ua.includes('Postman')) userAgent = '📮 Postman';
      else userAgent = '🔧 Other';
    }
    
    const message = `${method} ${status} ${path} - ${time} - ${ip} ${responseType} ${userAgent}`;
    this.http(message);
  }

  getMethodColor(method) {
    const colorMap = {
      'GET': colors.brightGreen,
      'POST': colors.brightBlue,
      'PUT': colors.brightYellow,
      'DELETE': colors.brightRed,
      'PATCH': colors.brightMagenta,
      'HEAD': colors.cyan,
      'OPTIONS': colors.white
    };
    return colorMap[method] || colors.white;
  }

  getStatusColor(status) {
    const firstDigit = Math.floor(status / 100);
    return statusColors[firstDigit] || colors.white;
  }

  // Banner de démarrage
  banner(appName = 'Veko.js', version = '1.0.0', port = 3000) {
  const banner = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  ${this.colorize('🚀 ' + appName.padEnd(20), colors.brightCyan)}  ${this.colorize('v' + version.padStart(20), colors.dim)}   ║
║                                                              ║
║  ${this.colorize('🌐 Server running on:', colors.brightGreen)} ${this.colorize(`http://localhost:${port}`, colors.brightWhite)}      ║
║  ${this.colorize('📝 Environment:', colors.brightBlue)}       ${this.colorize((process.env.NODE_ENV || 'development').padEnd(20), colors.brightYellow)}   ║
║  ${this.colorize('⏰ Started at:', colors.brightMagenta)}       ${this.colorize(new Date().toLocaleString('fr-FR').padEnd(20), colors.white)}   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `;
    
    console.log(banner);
    this.info('🎉 Application started successfully!');
  }

  // Logs de performance
  performance(operation, duration, details = {}) {
    let color = colors.brightGreen;
    let icon = '⚡';
    
    if (duration > 1000) {
      color = colors.brightRed;
      icon = '🐌';
    } else if (duration > 500) {
      color = colors.brightYellow;
      icon = '⚠️';
    }
    
    const message = `${icon} ${operation} completed in ${this.colorize(duration + 'ms', color)}`;
    this.debug(message, details);
  }

  // Logs de sécurité
  security(event, details = {}) {
    const securityIcon = '🔒';
    const message = `${securityIcon} Security event: ${event}`;
    this.warn(message, details);
  }

  // Logs de base de données (si utilisée)
  database(query, duration, params = {}) {
    const dbIcon = '🗄️';
    const time = this.colorize(`${duration}ms`, colors.dim);
    const message = `${dbIcon} Database query completed in ${time}`;
    this.debug(message, { query, params });
  }
}

// Instance globale
const defaultLogger = new Logger({
  level: process.env.LOG_LEVEL || 'INFO',
  colors: process.env.NO_COLOR !== 'true',
  timestamp: true,
  pretty: true
});

module.exports = {
  Logger,
  logger: defaultLogger,
  createLogger: (options) => new Logger(options)
};