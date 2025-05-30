const express = require('express');

class Router {
  constructor() {
    this.router = express.Router();
    this.routes = [];
  }
  
  get(path, ...handlers) {
    this.routes.push({ method: 'GET', path, handlers });
    this.router.get(path, ...handlers);
    return this;
  }
  
  post(path, ...handlers) {
    this.routes.push({ method: 'POST', path, handlers });
    this.router.post(path, ...handlers);
    return this;
  }
  
  put(path, ...handlers) {
    this.routes.push({ method: 'PUT', path, handlers });
    this.router.put(path, ...handlers);
    return this;
  }
  
  delete(path, ...handlers) {
    this.routes.push({ method: 'DELETE', path, handlers });
    this.router.delete(path, ...handlers);
    return this;
  }
  
  use(...handlers) {
    this.router.use(...handlers);
    return this;
  }
  
  group(prefix, callback) {
    const groupRouter = new Router();
    callback(groupRouter);
    this.router.use(prefix, groupRouter.router);
    return this;
  }
  
  getRoutes() {
    return this.routes;
  }
  
  getExpressRouter() {
    return this.router;
  }
}

module.exports = Router;