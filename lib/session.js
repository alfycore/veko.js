// filepath: c:\Users\wiltark\Documents\git\veko.js-1\lib\session.js
const crypto = require('crypto');

class Session {
  constructor(req, res, app) {
    this.req = req;
    this.res = res;
    this.app = app;
    this.data = {};
    this.id = null;
    this.isNew = true;
    this.touched = false;
    
    this.load();
  }

  load() {
    const sessionId = this.req.cookies['veko-session'];
    
    if (sessionId && this.app.sessionStore.has(sessionId)) {
      this.id = sessionId;
      this.data = { ...this.app.sessionStore.get(sessionId) };
      this.isNew = false;
    } else {
      this.regenerate();
    }
  }

  save() {
    if (!this.id) this.regenerate();
    
    this.app.sessionStore.set(this.id, this.data);
    
    this.res.cookie('veko-session', this.id, {
      maxAge: this.app.sessionOptions.maxAge,
      httpOnly: this.app.sessionOptions.httpOnly,
      secure: this.app.sessionOptions.secure,
      sameSite: this.app.sessionOptions.sameSite
    });
    
    this.touched = false;
  }

  touch() {
    this.touched = true;
  }

  regenerate() {
    this.id = this.generateId();
    this.data = {};
    this.isNew = true;
    this.touched = true;
  }

  destroy() {
    if (this.id) {
      this.app.sessionStore.delete(this.id);
      this.res.clearCookie('veko-session');
    }
    this.data = {};
    this.id = null;
    this.isNew = true;
  }

  generateId() {
    return crypto.randomBytes(24).toString('hex');
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.touched = true;
    this.save();
  }

  has(key) {
    return key in this.data;
  }

  delete(key) {
    delete this.data[key];
    this.touched = true;
    this.save();
  }

  clear() {
    this.data = {};
    this.touched = true;
    this.save();
  }
}

module.exports = Session;