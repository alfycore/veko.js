const crypto = require('crypto');

// Échapper les caractères HTML
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Générer un token CSRF
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Valider un token CSRF
function validateCSRFToken(token, sessionToken) {
  if (!token || !sessionToken) return false;
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(sessionToken, 'hex')
    );
  } catch (e) {
    return false;
  }
}

// Nettoyer une URL pour éviter les redirections malveillantes
function sanitizeRedirectUrl(url, allowedHosts = []) {
  if (!url) return '/';
  
  try {
    const parsed = new URL(url, 'http://localhost');
    
    // Vérifier si l'URL est relative
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    
    // Vérifier si l'host est autorisé
    if (allowedHosts.includes(parsed.hostname)) {
      return url;
    }
    
    return '/';
  } catch (e) {
    return '/';
  }
}

// Valider une adresse email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Générer un hash sécurisé
function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
  return {
    hash: hash.toString('hex'),
    salt: salt
  };
}

// Vérifier un mot de passe
function verifyPassword(password, hash, salt) {
  const computed = hashPassword(password, salt);
  return computed.hash === hash;
}

// Rate limiting simple en mémoire
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }
  
  isAllowed(identifier) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }
    
    const requests = this.requests.get(identifier);
    
    // Nettoyer les anciennes requêtes
    const validRequests = requests.filter(time => time > windowStart);
    this.requests.set(identifier, validRequests);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    return true;
  }
  
  reset(identifier) {
    this.requests.delete(identifier);
  }
  
  getRemainingRequests(identifier) {
    const requests = this.requests.get(identifier) || [];
    return Math.max(0, this.maxRequests - requests.length);
  }
}

module.exports = {
  escapeHtml,
  generateCSRFToken,
  validateCSRFToken,
  sanitizeRedirectUrl,
  isValidEmail,
  hashPassword,
  verifyPassword,
  RateLimiter
};