class Controller {
  constructor() {
    this.middleware = [];
  }
  
  addMiddleware(middleware) {
    this.middleware.push(middleware);
    return this;
  }
  
  render(view, data = {}) {
    return (req, res) => {
      res.render(view, { ...data, req, res });
    };
  }
  
  json(data) {
    return (req, res) => {
      res.json(data);
    };
  }
  
  redirect(url, status = 302) {
    return (req, res) => {
      res.redirect(status, url);
    };
  }
  
  error(message, status = 500) {
    return (req, res) => {
      res.status(status).render('error', { message, status });
    };
  }
}

module.exports = Controller;