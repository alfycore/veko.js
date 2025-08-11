/**
 * File use for the framework veko.js
 * CORS middleware
 */

class Cors {
    constructor() {
        this.allowedOrigins = ['*'];
        this.allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
        this.allowedHeaders = ['Content-Type', 'Authorization'];
        this.maxAge = 86400;
        this.credentials = false;
    }

    setAllowedOrigins(origins) {
        this.allowedOrigins = Array.isArray(origins) ? origins : [origins];
        return this;
    }

    setAllowedMethods(methods) {
        this.allowedMethods = Array.isArray(methods) ? methods : [methods];
        return this;
    }

    setAllowedHeaders(headers) {
        this.allowedHeaders = Array.isArray(headers) ? headers : [headers];
        return this;
    }

    setMaxAge(seconds) {
        this.maxAge = seconds;
        return this;
    }

    setCredentials(allow) {
        this.credentials = allow;
        return this;
    }

    isOriginAllowed(origin) {
        if (this.allowedOrigins.includes('*')) return true;
        return this.allowedOrigins.includes(origin);
    }

    middleware() {
        return (req, res, next) => {
            const origin = req.getHeader('origin');
            
            if (this.isOriginAllowed(origin)) {
                res.setHeader('Access-Control-Allow-Origin', origin || '*');
            }
            
            res.setHeader('Access-Control-Allow-Methods', this.allowedMethods.join(', '));
            res.setHeader('Access-Control-Allow-Headers', this.allowedHeaders.join(', '));
            res.setHeader('Access-Control-Max-Age', this.maxAge);
            
            if (this.credentials) {
                res.setHeader('Access-Control-Allow-Credentials', 'true');
            }
            
            if (req.isMethod('OPTIONS')) {
                res.status(204).send();
                return;
            }
            
            next();
        };
    }

    enable(req, res, next) {
        this.middleware()(req, res, next);
    }
}

export default Cors;