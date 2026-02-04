/**
 * Template File Generators
 * Generates all project files based on template type
 */

const fs = require('fs');
const path = require('path');

class TemplateGenerator {
  constructor(config) {
    this.config = config;
    this.baseDir = config.srcDir 
      ? path.join(config.projectPath, 'src') 
      : config.projectPath;
    this.ext = config.typescript ? 'ts' : 'js';
    this.extx = config.typescript ? 'tsx' : 'jsx';
  }

  // ==========================================
  // MAIN ENTRY FILE
  // ==========================================
  generateMainFile() {
    const { template, typescript, react, api } = this.config;
    let content = '';

    if (api || template === 'api' || template === 'api-typescript') {
      content = this.getApiMainFile();
    } else if (react || template === 'react' || template === 'react-typescript') {
      content = this.getReactMainFile();
    } else if (template === 'realtime') {
      content = this.getRealtimeMainFile();
    } else if (template === 'blog') {
      content = this.getBlogMainFile();
    } else if (template === 'ecommerce') {
      content = this.getEcommerceMainFile();
    } else if (template === 'dashboard') {
      content = this.getDashboardMainFile();
    } else {
      content = this.getDefaultMainFile();
    }

    fs.writeFileSync(path.join(this.baseDir, `index.${this.ext}`), content);
  }

  getDefaultMainFile() {
    const ts = this.config.typescript;
    return ts ? `
import express${ts ? ', { Request, Response, NextFunction }' : ''} from 'express';
import path from 'path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
import indexRouter from './routes/index';
import apiRouter from './routes/api';

app.use('/', indexRouter);
app.use('/api', apiRouter);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).render('error', {
    title: '404 - Page Not Found',
    message: 'The page you are looking for does not exist.',
    status: 404
  });
});

// Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: '500 - Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    status: 500
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running at http://localhost:\${PORT}\`);
  console.log(\`📁 Environment: \${process.env.NODE_ENV || 'development'}\`);
});

export default app;
`.trim() : `
const express = require('express');
const path = require('path');
const compression = require('compression');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const indexRouter = require('./routes/index');
const apiRouter = require('./routes/api');

app.use('/', indexRouter);
app.use('/api', apiRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Page Not Found',
    message: 'The page you are looking for does not exist.',
    status: 404
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: '500 - Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    status: 500
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running at http://localhost:\${PORT}\`);
  console.log(\`📁 Environment: \${process.env.NODE_ENV || 'development'}\`);
});

module.exports = app;
`.trim();
  }

  getApiMainFile() {
    const ts = this.config.typescript;
    return ts ? `
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// API Routes
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import healthRouter from './routes/health';

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/health', healthRouter);

// API Documentation
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: '${this.config.projectName} API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        me: 'GET /api/auth/me'
      },
      users: {
        list: 'GET /api/users',
        get: 'GET /api/users/:id',
        create: 'POST /api/users',
        update: 'PUT /api/users/:id',
        delete: 'DELETE /api/users/:id'
      }
    }
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: \`Route \${req.method} \${req.path} not found\`,
    status: 404
  });
});

// Error Handler
interface ApiError extends Error {
  status?: number;
  code?: string;
}

app.use((err: ApiError, req: Request, res: Response, next: NextFunction) => {
  console.error(\`[ERROR] \${err.message}\`);
  
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 API Server running at http://localhost:\${PORT}\`);
  console.log(\`📚 API Docs: http://localhost:\${PORT}/api\`);
  console.log(\`🔒 Environment: \${process.env.NODE_ENV || 'development'}\`);
});

export default app;
`.trim() : `
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// API Routes
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const healthRouter = require('./routes/health');

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/health', healthRouter);

// API Documentation
app.get('/api', (req, res) => {
  res.json({
    name: '${this.config.projectName} API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        me: 'GET /api/auth/me'
      },
      users: {
        list: 'GET /api/users',
        get: 'GET /api/users/:id',
        create: 'POST /api/users',
        update: 'PUT /api/users/:id',
        delete: 'DELETE /api/users/:id'
      }
    }
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: \`Route \${req.method} \${req.path} not found\`,
    status: 404
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(\`[ERROR] \${err.message}\`);
  
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 API Server running at http://localhost:\${PORT}\`);
  console.log(\`📚 API Docs: http://localhost:\${PORT}/api\`);
  console.log(\`🔒 Environment: \${process.env.NODE_ENV || 'development'}\`);
});

module.exports = app;
`.trim();
  }

  getReactMainFile() {
    const ts = this.config.typescript;
    return ts ? `
import express, { Request, Response } from 'express';
import path from 'path';
import compression from 'compression';
import dotenv from 'dotenv';
import React from 'react';
import { renderToString } from 'react-dom/server';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// React SSR Middleware
const renderPage = (Component: React.ComponentType<any>, props: any = {}) => {
  const html = renderToString(React.createElement(Component, props));
  return \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${props.title || '${this.config.projectName}'}</title>
  <link rel="stylesheet" href="/css/style.css">
  ${this.config.tailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}
</head>
<body>
  <div id="root">\${html}</div>
  <script>window.__INITIAL_STATE__ = \${JSON.stringify(props)}</script>
  <script src="/js/bundle.js"></script>
</body>
</html>
  \`;
};

// Import pages
import Home from './pages/Home';
import About from './pages/About';

// Routes
app.get('/', (req: Request, res: Response) => {
  res.send(renderPage(Home, { title: 'Home', message: 'Welcome!' }));
});

app.get('/about', (req: Request, res: Response) => {
  res.send(renderPage(About, { title: 'About' }));
});

// API routes
app.get('/api/data', (req: Request, res: Response) => {
  res.json({ message: 'Hello from API', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(\`🚀 React SSR running at http://localhost:\${PORT}\`);
});

export default app;
`.trim() : `
const express = require('express');
const path = require('path');
const compression = require('compression');
require('dotenv').config();
const React = require('react');
const { renderToString } = require('react-dom/server');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// React SSR Middleware
const renderPage = (Component, props = {}) => {
  const html = renderToString(React.createElement(Component, props));
  return \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${props.title || '${this.config.projectName}'}</title>
  <link rel="stylesheet" href="/css/style.css">
  ${this.config.tailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}
</head>
<body>
  <div id="root">\${html}</div>
  <script>window.__INITIAL_STATE__ = \${JSON.stringify(props)}</script>
  <script src="/js/bundle.js"></script>
</body>
</html>
  \`;
};

// Import pages
const Home = require('./pages/Home');
const About = require('./pages/About');

// Routes
app.get('/', (req, res) => {
  res.send(renderPage(Home, { title: 'Home', message: 'Welcome!' }));
});

app.get('/about', (req, res) => {
  res.send(renderPage(About, { title: 'About' }));
});

// API routes
app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from API', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(\`🚀 React SSR running at http://localhost:\${PORT}\`);
});

module.exports = app;
`.trim();
  }

  getRealtimeMainFile() {
    return `
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const session = require('express-session');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Store connected users
const users = new Map();

// Socket.io events
io.on('connection', (socket) => {
  console.log(\`🔌 User connected: \${socket.id}\`);
  
  // User joins
  socket.on('join', (username) => {
    users.set(socket.id, { username, joinedAt: new Date() });
    io.emit('userJoined', { 
      username, 
      users: Array.from(users.values()).map(u => u.username),
      count: users.size 
    });
    console.log(\`👤 \${username} joined\`);
  });
  
  // Chat message
  socket.on('message', (data) => {
    const user = users.get(socket.id);
    if (user) {
      io.emit('message', {
        username: user.username,
        message: data.message,
        timestamp: new Date()
      });
    }
  });
  
  // Typing indicator
  socket.on('typing', (isTyping) => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('typing', { username: user.username, isTyping });
    }
  });
  
  // User disconnects
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      io.emit('userLeft', { 
        username: user.username, 
        users: Array.from(users.values()).map(u => u.username),
        count: users.size 
      });
      console.log(\`👋 \${user.username} left\`);
    }
  });
});

// Routes
app.get('/', (req, res) => {
  res.render('index', { title: 'Real-time Chat' });
});

app.get('/api/users', (req, res) => {
  res.json({
    users: Array.from(users.values()),
    count: users.size
  });
});

server.listen(PORT, () => {
  console.log(\`🚀 Real-time server running at http://localhost:\${PORT}\`);
  console.log(\`⚡ WebSocket ready\`);
});

module.exports = { app, io };
`.trim();
  }

  getBlogMainFile() {
    return `
const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const matter = require('gray-matter');
const { marked } = require('marked');
const hljs = require('highlight.js');
const readingTime = require('reading-time');
const { Feed } = require('feed');
const slugify = require('slugify');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure marked with syntax highlighting
marked.setOptions({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true
});

// Middleware
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Get all posts
const postsDir = path.join(__dirname, 'content', 'posts');
const getPosts = () => {
  if (!fs.existsSync(postsDir)) return [];
  
  return fs.readdirSync(postsDir)
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const content = fs.readFileSync(path.join(postsDir, file), 'utf-8');
      const { data, content: body } = matter(content);
      const slug = file.replace('.md', '');
      const stats = readingTime(body);
      
      return {
        slug,
        title: data.title || slug,
        date: data.date || new Date(),
        author: data.author || 'Anonymous',
        excerpt: data.excerpt || body.slice(0, 200) + '...',
        tags: data.tags || [],
        coverImage: data.coverImage || null,
        readingTime: stats.text,
        content: marked(body)
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
};

// Routes
app.get('/', (req, res) => {
  const posts = getPosts();
  res.render('index', { 
    title: '${this.config.projectName}',
    posts 
  });
});

app.get('/post/:slug', (req, res) => {
  const posts = getPosts();
  const post = posts.find(p => p.slug === req.params.slug);
  
  if (!post) {
    return res.status(404).render('error', { 
      title: 'Post Not Found',
      message: 'The post you are looking for does not exist.'
    });
  }
  
  res.render('post', { title: post.title, post });
});

app.get('/tag/:tag', (req, res) => {
  const posts = getPosts().filter(p => p.tags.includes(req.params.tag));
  res.render('index', { 
    title: \`Posts tagged "\${req.params.tag}"\`,
    posts 
  });
});

app.get('/rss.xml', (req, res) => {
  const posts = getPosts();
  const feed = new Feed({
    title: '${this.config.projectName}',
    description: 'Blog RSS Feed',
    id: process.env.SITE_URL || 'http://localhost:3000',
    link: process.env.SITE_URL || 'http://localhost:3000',
    language: 'en',
    copyright: \`© \${new Date().getFullYear()}\`
  });
  
  posts.forEach(post => {
    feed.addItem({
      title: post.title,
      id: post.slug,
      link: \`\${process.env.SITE_URL || 'http://localhost:3000'}/post/\${post.slug}\`,
      description: post.excerpt,
      date: new Date(post.date),
      author: [{ name: post.author }]
    });
  });
  
  res.type('application/xml');
  res.send(feed.rss2());
});

app.listen(PORT, () => {
  console.log(\`📝 Blog running at http://localhost:\${PORT}\`);
});

module.exports = app;
`.trim();
  }

  getEcommerceMainFile() {
    return `
const express = require('express');
const path = require('path');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const helmet = require('helmet');
const Stripe = require('stripe');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_xxx');

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Cart middleware
app.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = [];
  }
  res.locals.cart = req.session.cart;
  res.locals.cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
  res.locals.cartTotal = req.session.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  next();
});

// Sample products
const products = require('./data/products.json');

// Routes
app.get('/', (req, res) => {
  res.render('index', { title: '${this.config.projectName}', products });
});

app.get('/product/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).render('error', { title: 'Product Not Found' });
  }
  res.render('product', { title: product.name, product });
});

app.post('/cart/add', (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  const existingItem = req.session.cart.find(item => item.id === productId);
  if (existingItem) {
    existingItem.quantity += parseInt(quantity);
  } else {
    req.session.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: parseInt(quantity)
    });
  }
  
  res.json({ 
    success: true, 
    cart: req.session.cart,
    cartCount: req.session.cart.reduce((sum, item) => sum + item.quantity, 0)
  });
});

app.get('/cart', (req, res) => {
  res.render('cart', { title: 'Shopping Cart' });
});

app.post('/cart/remove', (req, res) => {
  const { productId } = req.body;
  req.session.cart = req.session.cart.filter(item => item.id !== productId);
  res.json({ success: true, cart: req.session.cart });
});

app.get('/checkout', (req, res) => {
  if (req.session.cart.length === 0) {
    return res.redirect('/cart');
  }
  res.render('checkout', { 
    title: 'Checkout',
    stripePublicKey: process.env.STRIPE_PUBLIC_KEY || 'pk_test_xxx'
  });
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const amount = req.session.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd'
    });
    
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/order/complete', (req, res) => {
  // Clear cart after successful order
  req.session.cart = [];
  res.json({ success: true, message: 'Order completed!' });
});

app.listen(PORT, () => {
  console.log(\`🛒 E-commerce running at http://localhost:\${PORT}\`);
});

module.exports = app;
`.trim();
  }

  getDashboardMainFile() {
    return `
const express = require('express');
const path = require('path');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Demo users database
const users = [
  { id: 1, email: 'admin@example.com', password: bcrypt.hashSync('admin123', 10), role: 'admin', name: 'Admin User' }
];

// Auth middleware
const requireAuth = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    if (req.accepts('html')) {
      return res.redirect('/login');
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    res.locals.user = decoded;
    next();
  } catch (error) {
    res.clearCookie('token');
    if (req.accepts('html')) {
      return res.redirect('/login');
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Public routes
app.get('/login', (req, res) => {
  if (req.cookies.token) {
    return res.redirect('/dashboard');
  }
  res.render('login', { title: 'Login', error: null });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { title: 'Login', error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.cookie('token', token, { httpOnly: true, maxAge: 86400000 });
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// Protected routes
app.get('/', requireAuth, (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', requireAuth, (req, res) => {
  const stats = {
    users: 1234,
    revenue: 45678,
    orders: 567,
    visitors: 8901
  };
  res.render('dashboard/index', { title: 'Dashboard', stats });
});

app.get('/dashboard/users', requireAuth, (req, res) => {
  res.render('dashboard/users', { title: 'Users', users });
});

app.get('/dashboard/analytics', requireAuth, (req, res) => {
  res.render('dashboard/analytics', { title: 'Analytics' });
});

app.get('/dashboard/settings', requireAuth, (req, res) => {
  res.render('dashboard/settings', { title: 'Settings' });
});

// API routes
app.get('/api/stats', requireAuth, (req, res) => {
  res.json({
    users: 1234,
    revenue: 45678,
    orders: 567,
    visitors: 8901,
    chart: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      data: [65, 59, 80, 81, 56, 55]
    }
  });
});

app.listen(PORT, () => {
  console.log(\`📊 Dashboard running at http://localhost:\${PORT}\`);
  console.log(\`👤 Login: admin@example.com / admin123\`);
});

module.exports = app;
`.trim();
  }

  // ==========================================
  // ROUTES
  // ==========================================
  generateRoutes() {
    const { template, api } = this.config;
    const routesDir = path.join(this.baseDir, 'routes');
    fs.mkdirSync(routesDir, { recursive: true });

    if (api || template === 'api' || template === 'api-typescript') {
      this.generateApiRoutes(routesDir);
    } else {
      this.generateWebRoutes(routesDir);
    }
  }

  generateWebRoutes(routesDir) {
    const ts = this.config.typescript;
    
    // Index routes
    const indexRoute = ts ? `
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.render('index', {
    title: 'Home',
    message: 'Welcome to ${this.config.projectName}!'
  });
});

router.get('/about', (req: Request, res: Response) => {
  res.render('about', { title: 'About' });
});

router.get('/contact', (req: Request, res: Response) => {
  res.render('contact', { title: 'Contact' });
});

router.post('/contact', (req: Request, res: Response) => {
  const { name, email, message } = req.body;
  // Handle contact form submission
  console.log('Contact form:', { name, email, message });
  res.redirect('/contact?success=true');
});

export default router;
`.trim() : `
const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => {
  res.render('index', {
    title: 'Home',
    message: 'Welcome to ${this.config.projectName}!'
  });
});

router.get('/about', (req, res) => {
  res.render('about', { title: 'About' });
});

router.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact' });
});

router.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  console.log('Contact form:', { name, email, message });
  res.redirect('/contact?success=true');
});

module.exports = router;
`.trim();
    
    fs.writeFileSync(path.join(routesDir, `index.${this.ext}`), indexRoute);
    
    // API routes
    const apiRoute = ts ? `
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

router.get('/info', (req: Request, res: Response) => {
  res.json({
    name: '${this.config.projectName}',
    version: '1.0.0',
    node: process.version
  });
});

export default router;
`.trim() : `
const { Router } = require('express');

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

router.get('/info', (req, res) => {
  res.json({
    name: '${this.config.projectName}',
    version: '1.0.0',
    node: process.version
  });
});

module.exports = router;
`.trim();
    
    fs.writeFileSync(path.join(routesDir, `api.${this.ext}`), apiRoute);
  }

  generateApiRoutes(routesDir) {
    const ts = this.config.typescript;
    
    // Health route
    const healthRoute = ts ? `
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

export default router;
`.trim() : `
const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

module.exports = router;
`.trim();
    
    fs.writeFileSync(path.join(routesDir, `health.${this.ext}`), healthRoute);
    
    // Auth route
    const authRoute = ts ? `
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Demo users (replace with database)
const users: Array<{ id: number; email: string; password: string; name: string }> = [];

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const exists = users.find(u => u.email === email);
    if (exists) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: users.length + 1,
      email,
      password: hashedPassword,
      name
    };
    
    users.push(user);
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
    const user = users.find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
`.trim() : `
const { Router } = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Demo users (replace with database)
const users = [];

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const exists = users.find(u => u.email === email);
    if (exists) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: users.length + 1,
      email,
      password: hashedPassword,
      name
    };
    
    users.push(user);
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
`.trim();
    
    fs.writeFileSync(path.join(routesDir, `auth.${this.ext}`), authRoute);
    
    // Users route
    const usersRoute = ts ? `
import { Router, Request, Response } from 'express';

const router = Router();

// Demo data
let users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin', createdAt: new Date() },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user', createdAt: new Date() }
];

// Get all users
router.get('/', (req: Request, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  
  let result = [...users];
  
  if (search) {
    const s = String(search).toLowerCase();
    result = result.filter(u => 
      u.name.toLowerCase().includes(s) || 
      u.email.toLowerCase().includes(s)
    );
  }
  
  const start = (Number(page) - 1) * Number(limit);
  const paginated = result.slice(start, start + Number(limit));
  
  res.json({
    data: paginated,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: result.length,
      pages: Math.ceil(result.length / Number(limit))
    }
  });
});

// Get user by ID
router.get('/:id', (req: Request, res: Response) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ data: user });
});

// Create user
router.post('/', (req: Request, res: Response) => {
  const { name, email, role = 'user' } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const user = {
    id: users.length + 1,
    name,
    email,
    role,
    createdAt: new Date()
  };
  
  users.push(user);
  res.status(201).json({ data: user, message: 'User created' });
});

// Update user
router.put('/:id', (req: Request, res: Response) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  users[index] = { ...users[index], ...req.body };
  res.json({ data: users[index], message: 'User updated' });
});

// Delete user
router.delete('/:id', (req: Request, res: Response) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  users.splice(index, 1);
  res.json({ message: 'User deleted' });
});

export default router;
`.trim() : `
const { Router } = require('express');

const router = Router();

// Demo data
let users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin', createdAt: new Date() },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user', createdAt: new Date() }
];

// Get all users
router.get('/', (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  
  let result = [...users];
  
  if (search) {
    const s = String(search).toLowerCase();
    result = result.filter(u => 
      u.name.toLowerCase().includes(s) || 
      u.email.toLowerCase().includes(s)
    );
  }
  
  const start = (Number(page) - 1) * Number(limit);
  const paginated = result.slice(start, start + Number(limit));
  
  res.json({
    data: paginated,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: result.length,
      pages: Math.ceil(result.length / Number(limit))
    }
  });
});

// Get user by ID
router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ data: user });
});

// Create user
router.post('/', (req, res) => {
  const { name, email, role = 'user' } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const user = {
    id: users.length + 1,
    name,
    email,
    role,
    createdAt: new Date()
  };
  
  users.push(user);
  res.status(201).json({ data: user, message: 'User created' });
});

// Update user
router.put('/:id', (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  users[index] = { ...users[index], ...req.body };
  res.json({ data: users[index], message: 'User updated' });
});

// Delete user
router.delete('/:id', (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  users.splice(index, 1);
  res.json({ message: 'User deleted' });
});

module.exports = router;
`.trim();
    
    fs.writeFileSync(path.join(routesDir, `users.${this.ext}`), usersRoute);
  }
}

module.exports = TemplateGenerator;
