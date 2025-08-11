/**
 * File for the framework veko.js
 * This file is destined for the request handling
 */

class Request {
    constructor(req) {
        this.headers = req?.headers || {};
        this.body = req?.body || {};
        this.method = req?.method || 'GET';
        this.url = req?.url || '';
        this.params = {};
        this.query = {};
        this.raw = req;
        
        this._parseUrl();
        this._parseQuery();
    }

    _parseUrl() {
        if (this.url.includes('?')) {
            this.url = this.url.split('?')[0];
        }
    }

    _parseQuery() {
        const urlParts = this.raw?.url?.split('?');
        if (urlParts && urlParts[1]) {
            const queryString = urlParts[1];
            queryString.split('&').forEach(param => {
                const [key, value] = param.split('=');
                this.query[decodeURIComponent(key)] = decodeURIComponent(value || '');
            });
        }
    }

    setParams(params) {
        this.params = { ...this.params, ...params };
    }

    getHeaders(name) {
        return this.headers[name.toLowerCase()] || null;
    }

    isMethod(method) {
        return this.method.toUpperCase() === method.toUpperCase();
    }

    isJson() {
        return this.headers['content-type']?.includes('application/json');
    }

    isForm() {
        return this.headers['content-type']?.includes('application/x-www-form-urlencoded');
    }
}