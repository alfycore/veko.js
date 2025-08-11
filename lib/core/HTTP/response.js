/**
 * File for the framework veko.js
 * This file is destined for the response handling
 */

class Response {
    constructor(res) {
        this.res = res;
        this.statusCode = 200;
        this.headers = {};
        this.body = '';
        this.sent = false;
    }

    status(code) {
        this.statusCode = code;
        return this;
    }

    setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
        return this;
    }

    getHeader(name) {
        return this.headers[name.toLowerCase()] || null;
    }

    json(data) {
        this.setHeader('content-type', 'application/json');
        this.body = JSON.stringify(data);
        return this.send();
    }

    text(data) {
        this.setHeader('content-type', 'text/plain');
        this.body = data;
        return this.send();
    }

    html(data) {
        this.setHeader('content-type', 'text/html');
        this.body = data;
        return this.send();
    }

    redirect(url, code = 302) {
        this.status(code);
        this.setHeader('location', url);
        return this.send();
    }

    send(data) {
        if (this.sent) return this;
        
        if (data !== undefined) {
            this.body = data;
        }

        if (this.res) {
            this.res.statusCode = this.statusCode;
            
            Object.keys(this.headers).forEach(key => {
                this.res.setHeader(key, this.headers[key]);
            });
            
            this.res.end(this.body);
        }
        
        this.sent = true;
        return this;
    }
}

export default Response;