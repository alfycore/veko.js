/**
 * View Templates Generator
 * Generates EJS views based on template type
 */

const fs = require('fs');
const path = require('path');

class ViewGenerator {
  constructor(config) {
    this.config = config;
    this.baseDir = config.srcDir 
      ? path.join(config.projectPath, 'src') 
      : config.projectPath;
    this.viewsDir = path.join(this.baseDir, 'views');
    this.useTailwind = config.tailwind || config.template === 'tailwind';
  }

  generate() {
    fs.mkdirSync(this.viewsDir, { recursive: true });
    fs.mkdirSync(path.join(this.viewsDir, 'partials'), { recursive: true });
    
    // Generate base layout and partials
    this.generateLayout();
    this.generatePartials();
    this.generateError();
    
    // Generate template-specific views
    switch (this.config.template) {
      case 'blog':
        this.generateBlogViews();
        break;
      case 'ecommerce':
        this.generateEcommerceViews();
        break;
      case 'dashboard':
        this.generateDashboardViews();
        break;
      case 'realtime':
        this.generateRealtimeViews();
        break;
      default:
        this.generateDefaultViews();
    }
  }

  // ==========================================
  // LAYOUT & PARTIALS
  // ==========================================
  generateLayout() {
    const layout = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title + ' | ${this.config.projectName}' : '${this.config.projectName}' %></title>
  <meta name="description" content="<%= typeof description !== 'undefined' ? description : 'Built with VekoJS' %>">
  ${this.useTailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : '<link rel="stylesheet" href="/css/style.css">'}
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <%- typeof head !== 'undefined' ? head : '' %>
</head>
<body${this.useTailwind ? ' class="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen"' : ''}>
  <%- include('partials/header') %>
  
  <main${this.useTailwind ? ' class="container mx-auto px-4 py-8"' : ' class="main-content"'}>
    <%- body %>
  </main>
  
  <%- include('partials/footer') %>
  
  <script src="/js/main.js"></script>
  <%- typeof scripts !== 'undefined' ? scripts : '' %>
</body>
</html>`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'layout.ejs'), layout);
  }

  generatePartials() {
    // Header
    const header = this.useTailwind ? `
<header class="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
  <nav class="container mx-auto px-4">
    <div class="flex items-center justify-between h-16">
      <a href="/" class="text-xl font-bold text-indigo-600 dark:text-indigo-400">
        ${this.config.projectName}
      </a>
      
      <div class="hidden md:flex items-center space-x-8">
        <a href="/" class="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
          Home
        </a>
        <a href="/about" class="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
          About
        </a>
        <a href="/contact" class="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
          Contact
        </a>
      </div>
      
      <button id="mobile-menu-btn" class="md:hidden p-2 text-gray-600 dark:text-gray-300">
        <i class="fas fa-bars text-xl"></i>
      </button>
    </div>
    
    <div id="mobile-menu" class="hidden md:hidden pb-4">
      <a href="/" class="block py-2 text-gray-600 dark:text-gray-300">Home</a>
      <a href="/about" class="block py-2 text-gray-600 dark:text-gray-300">About</a>
      <a href="/contact" class="block py-2 text-gray-600 dark:text-gray-300">Contact</a>
    </div>
  </nav>
</header>
` : `
<header class="header">
  <nav class="nav container">
    <a href="/" class="nav-brand">${this.config.projectName}</a>
    
    <ul class="nav-links">
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
    
    <button id="mobile-menu-btn" class="nav-toggle">
      <i class="fas fa-bars"></i>
    </button>
  </nav>
</header>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'partials', 'header.ejs'), header.trim());

    // Footer
    const footer = this.useTailwind ? `
<footer class="bg-gray-800 text-white mt-auto">
  <div class="container mx-auto px-4 py-12">
    <div class="grid md:grid-cols-4 gap-8">
      <div>
        <h3 class="text-xl font-bold mb-4">${this.config.projectName}</h3>
        <p class="text-gray-400">Built with VekoJS - A modern Node.js framework.</p>
      </div>
      
      <div>
        <h4 class="font-semibold mb-4">Quick Links</h4>
        <ul class="space-y-2 text-gray-400">
          <li><a href="/" class="hover:text-white transition">Home</a></li>
          <li><a href="/about" class="hover:text-white transition">About</a></li>
          <li><a href="/contact" class="hover:text-white transition">Contact</a></li>
        </ul>
      </div>
      
      <div>
        <h4 class="font-semibold mb-4">Resources</h4>
        <ul class="space-y-2 text-gray-400">
          <li><a href="/docs" class="hover:text-white transition">Documentation</a></li>
          <li><a href="/api" class="hover:text-white transition">API</a></li>
          <li><a href="/privacy" class="hover:text-white transition">Privacy</a></li>
        </ul>
      </div>
      
      <div>
        <h4 class="font-semibold mb-4">Connect</h4>
        <div class="flex space-x-4 text-gray-400">
          <a href="#" class="hover:text-white transition"><i class="fab fa-github text-xl"></i></a>
          <a href="#" class="hover:text-white transition"><i class="fab fa-twitter text-xl"></i></a>
          <a href="#" class="hover:text-white transition"><i class="fab fa-linkedin text-xl"></i></a>
        </div>
      </div>
    </div>
    
    <div class="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
      <p>&copy; <%= new Date().getFullYear() %> ${this.config.projectName}. All rights reserved.</p>
    </div>
  </div>
</footer>
` : `
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-section">
        <h3>${this.config.projectName}</h3>
        <p>Built with VekoJS - A modern Node.js framework.</p>
      </div>
      
      <div class="footer-section">
        <h4>Quick Links</h4>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </div>
      
      <div class="footer-section">
        <h4>Connect</h4>
        <div class="social-links">
          <a href="#"><i class="fab fa-github"></i></a>
          <a href="#"><i class="fab fa-twitter"></i></a>
          <a href="#"><i class="fab fa-linkedin"></i></a>
        </div>
      </div>
    </div>
    
    <div class="footer-bottom">
      <p>&copy; <%= new Date().getFullYear() %> ${this.config.projectName}. All rights reserved.</p>
    </div>
  </div>
</footer>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'partials', 'footer.ejs'), footer.trim());
  }

  generateError() {
    const error = this.useTailwind ? `
<%- include('layout', { body: \`
<div class="min-h-[60vh] flex items-center justify-center">
  <div class="text-center">
    <h1 class="text-9xl font-bold text-indigo-600"><%= typeof status !== 'undefined' ? status : 500 %></h1>
    <p class="text-2xl text-gray-600 dark:text-gray-400 mt-4"><%= typeof message !== 'undefined' ? message : 'Something went wrong' %></p>
    <a href="/" class="inline-block mt-8 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
      Go Home
    </a>
  </div>
</div>
\` }) %>
` : `
<%- include('layout', { body: \`
<div class="error-page">
  <h1 class="error-code"><%= typeof status !== 'undefined' ? status : 500 %></h1>
  <p class="error-message"><%= typeof message !== 'undefined' ? message : 'Something went wrong' %></p>
  <a href="/" class="btn btn-primary">Go Home</a>
</div>
\` }) %>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'error.ejs'), error.trim());
  }

  // ==========================================
  // DEFAULT VIEWS
  // ==========================================
  generateDefaultViews() {
    // Index
    const index = this.useTailwind ? `
<%- include('layout', { body: \`
<section class="text-center py-20">
  <h1 class="text-5xl md:text-6xl font-bold mb-6">
    Welcome to <span class="text-indigo-600">${this.config.projectName}</span>
  </h1>
  <p class="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
    \${typeof message !== 'undefined' ? message : 'Start building something amazing with VekoJS.'}
  </p>
  <div class="flex justify-center gap-4">
    <a href="/about" class="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold">
      Get Started
    </a>
    <a href="/api/health" class="px-8 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
      View API
    </a>
  </div>
</section>

<section class="py-20">
  <h2 class="text-3xl font-bold text-center mb-12">Features</h2>
  <div class="grid md:grid-cols-3 gap-8">
    <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
      <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mb-4">
        <i class="fas fa-rocket text-indigo-600 text-xl"></i>
      </div>
      <h3 class="text-xl font-semibold mb-2">Fast & Modern</h3>
      <p class="text-gray-600 dark:text-gray-400">Built on Express with modern best practices and optimizations.</p>
    </div>
    
    <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
      <div class="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
        <i class="fas fa-code text-green-600 text-xl"></i>
      </div>
      <h3 class="text-xl font-semibold mb-2">Developer Friendly</h3>
      <p class="text-gray-600 dark:text-gray-400">Clean architecture with hot reloading and easy configuration.</p>
    </div>
    
    <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
      <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
        <i class="fas fa-plug text-purple-600 text-xl"></i>
      </div>
      <h3 class="text-xl font-semibold mb-2">Extensible</h3>
      <p class="text-gray-600 dark:text-gray-400">Plugin system for easy customization and feature additions.</p>
    </div>
  </div>
</section>
\` }) %>
` : `
<%- include('layout', { body: \`
<section class="hero">
  <h1>Welcome to ${this.config.projectName}</h1>
  <p>\${typeof message !== 'undefined' ? message : 'Start building something amazing with VekoJS.'}</p>
  <div class="hero-buttons">
    <a href="/about" class="btn btn-primary">Get Started</a>
    <a href="/api/health" class="btn btn-secondary">View API</a>
  </div>
</section>

<section class="features">
  <h2>Features</h2>
  <div class="features-grid">
    <div class="feature-card">
      <i class="fas fa-rocket"></i>
      <h3>Fast & Modern</h3>
      <p>Built on Express with modern best practices.</p>
    </div>
    <div class="feature-card">
      <i class="fas fa-code"></i>
      <h3>Developer Friendly</h3>
      <p>Clean architecture with hot reloading.</p>
    </div>
    <div class="feature-card">
      <i class="fas fa-plug"></i>
      <h3>Extensible</h3>
      <p>Plugin system for easy customization.</p>
    </div>
  </div>
</section>
\` }) %>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'index.ejs'), index.trim());
    
    // About
    const about = this.useTailwind ? `
<%- include('layout', { body: \`
<div class="max-w-4xl mx-auto">
  <h1 class="text-4xl font-bold mb-8">About Us</h1>
  
  <div class="prose prose-lg dark:prose-invert">
    <p class="text-xl text-gray-600 dark:text-gray-400 mb-6">
      Welcome to ${this.config.projectName}, built with VekoJS - a modern Node.js framework.
    </p>
    
    <h2 class="text-2xl font-semibold mt-8 mb-4">Our Mission</h2>
    <p class="text-gray-600 dark:text-gray-400 mb-6">
      We're committed to building great web experiences using modern technologies and best practices.
    </p>
    
    <h2 class="text-2xl font-semibold mt-8 mb-4">Technology Stack</h2>
    <ul class="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-2">
      <li>Node.js & Express</li>
      <li>EJS Templates</li>
      ${this.useTailwind ? '<li>Tailwind CSS</li>' : '<li>Custom CSS</li>'}
      <li>Modern JavaScript</li>
    </ul>
  </div>
</div>
\` }) %>
` : `
<%- include('layout', { body: \`
<div class="page">
  <h1>About Us</h1>
  
  <p class="lead">
    Welcome to ${this.config.projectName}, built with VekoJS - a modern Node.js framework.
  </p>
  
  <h2>Our Mission</h2>
  <p>We're committed to building great web experiences using modern technologies.</p>
  
  <h2>Technology Stack</h2>
  <ul>
    <li>Node.js & Express</li>
    <li>EJS Templates</li>
    <li>Modern JavaScript</li>
  </ul>
</div>
\` }) %>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'about.ejs'), about.trim());
    
    // Contact
    const contact = this.useTailwind ? `
<%- include('layout', { body: \`
<div class="max-w-2xl mx-auto">
  <h1 class="text-4xl font-bold mb-8">Contact Us</h1>
  
  <% if (typeof success !== 'undefined') { %>
    <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
      Thank you! Your message has been sent.
    </div>
  <% } %>
  
  <form action="/contact" method="POST" class="space-y-6">
    <div>
      <label for="name" class="block text-sm font-medium mb-2">Name</label>
      <input type="text" id="name" name="name" required
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
    </div>
    
    <div>
      <label for="email" class="block text-sm font-medium mb-2">Email</label>
      <input type="email" id="email" name="email" required
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
    </div>
    
    <div>
      <label for="message" class="block text-sm font-medium mb-2">Message</label>
      <textarea id="message" name="message" rows="5" required
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"></textarea>
    </div>
    
    <button type="submit" class="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold">
      Send Message
    </button>
  </form>
</div>
\` }) %>
` : `
<%- include('layout', { body: \`
<div class="page">
  <h1>Contact Us</h1>
  
  <% if (typeof success !== 'undefined') { %>
    <div class="alert alert-success">Thank you! Your message has been sent.</div>
  <% } %>
  
  <form action="/contact" method="POST" class="form">
    <div class="form-group">
      <label for="name">Name</label>
      <input type="text" id="name" name="name" required>
    </div>
    
    <div class="form-group">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required>
    </div>
    
    <div class="form-group">
      <label for="message">Message</label>
      <textarea id="message" name="message" rows="5" required></textarea>
    </div>
    
    <button type="submit" class="btn btn-primary">Send Message</button>
  </form>
</div>
\` }) %>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'contact.ejs'), contact.trim());
  }

  // ==========================================
  // BLOG VIEWS
  // ==========================================
  generateBlogViews() {
    // Blog index
    const blogIndex = `
<%- include('layout', { 
  head: '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">',
  body: \`
<div class="max-w-4xl mx-auto">
  <header class="mb-12 text-center">
    <h1 class="text-5xl font-bold mb-4">${this.config.projectName}</h1>
    <p class="text-xl text-gray-600 dark:text-gray-400">Thoughts, stories and ideas</p>
  </header>
  
  <div class="space-y-8">
    <% if (posts && posts.length > 0) { %>
      <% posts.forEach(post => { %>
        <article class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition">
          <% if (post.coverImage) { %>
            <img src="<%= post.coverImage %>" alt="<%= post.title %>" class="w-full h-48 object-cover">
          <% } %>
          
          <div class="p-6">
            <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-3">
              <span><%= new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) %></span>
              <span class="mx-2">•</span>
              <span><%= post.readingTime %></span>
            </div>
            
            <h2 class="text-2xl font-bold mb-3">
              <a href="/post/<%= post.slug %>" class="hover:text-indigo-600 transition"><%= post.title %></a>
            </h2>
            
            <p class="text-gray-600 dark:text-gray-400 mb-4"><%= post.excerpt %></p>
            
            <div class="flex items-center justify-between">
              <div class="flex flex-wrap gap-2">
                <% post.tags.forEach(tag => { %>
                  <a href="/tag/<%= tag %>" class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900 transition">
                    #<%= tag %>
                  </a>
                <% }) %>
              </div>
              
              <a href="/post/<%= post.slug %>" class="text-indigo-600 hover:text-indigo-700 font-semibold">
                Read more →
              </a>
            </div>
          </div>
        </article>
      <% }) %>
    <% } else { %>
      <div class="text-center py-12">
        <i class="fas fa-newspaper text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
        <p class="text-xl text-gray-600 dark:text-gray-400">No posts yet. Create your first post in content/posts/</p>
      </div>
    <% } %>
  </div>
</div>
\` }) %>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'index.ejs'), blogIndex.trim());
    
    // Single post
    const post = `
<%- include('layout', { 
  head: '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">',
  body: \`
<article class="max-w-3xl mx-auto">
  <% if (post.coverImage) { %>
    <img src="<%= post.coverImage %>" alt="<%= post.title %>" class="w-full h-64 object-cover rounded-xl mb-8">
  <% } %>
  
  <header class="mb-8">
    <h1 class="text-4xl md:text-5xl font-bold mb-4"><%= post.title %></h1>
    
    <div class="flex items-center text-gray-600 dark:text-gray-400">
      <span class="font-medium"><%= post.author %></span>
      <span class="mx-3">•</span>
      <time><%= new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) %></time>
      <span class="mx-3">•</span>
      <span><%= post.readingTime %></span>
    </div>
    
    <div class="flex flex-wrap gap-2 mt-4">
      <% post.tags.forEach(tag => { %>
        <a href="/tag/<%= tag %>" class="px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-full text-sm">
          #<%= tag %>
        </a>
      <% }) %>
    </div>
  </header>
  
  <div class="prose prose-lg dark:prose-invert max-w-none">
    <%- post.content %>
  </div>
  
  <footer class="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
    <a href="/" class="text-indigo-600 hover:text-indigo-700">
      ← Back to all posts
    </a>
  </footer>
</article>
\` }) %>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'post.ejs'), post.trim());
    
    // Create sample post
    const contentDir = path.join(this.baseDir, 'content', 'posts');
    fs.mkdirSync(contentDir, { recursive: true });
    
    const samplePost = `---
title: Welcome to ${this.config.projectName}
date: ${new Date().toISOString().split('T')[0]}
author: Admin
excerpt: This is your first blog post. Start writing!
tags:
  - welcome
  - getting-started
coverImage: https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200
---

# Welcome to Your New Blog

This is a sample blog post written in Markdown. You can use all standard Markdown features:

## Features

- **Bold text** and *italic text*
- Lists and bullet points
- [Links](https://vekojs.dev)
- And much more!

## Code Highlighting

\`\`\`javascript
const greeting = 'Hello, World!';
console.log(greeting);
\`\`\`

## Next Steps

1. Edit this post in \`content/posts/welcome.md\`
2. Create new posts by adding \`.md\` files
3. Customize the theme in the views folder

Happy blogging! 🎉
`;
    
    fs.writeFileSync(path.join(contentDir, 'welcome.md'), samplePost);
  }

  // ==========================================
  // ECOMMERCE VIEWS
  // ==========================================
  generateEcommerceViews() {
    // Store index
    const storeIndex = `
<%- include('layout', { body: \`
<section class="mb-12">
  <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-12 text-center">
    <h1 class="text-4xl md:text-5xl font-bold mb-4">Welcome to ${this.config.projectName}</h1>
    <p class="text-xl opacity-90 mb-8">Discover amazing products at great prices</p>
    <a href="#products" class="inline-block px-8 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-gray-100 transition">
      Shop Now
    </a>
  </div>
</section>

<section id="products">
  <div class="flex items-center justify-between mb-8">
    <h2 class="text-3xl font-bold">Products</h2>
    <div class="flex gap-2">
      <button class="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">All</button>
      <button class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Electronics</button>
      <button class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Clothing</button>
    </div>
  </div>
  
  <div class="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
    <% products.forEach(product => { %>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden group">
        <div class="relative">
          <img src="<%= product.image %>" alt="<%= product.name %>" class="w-full h-48 object-cover group-hover:scale-105 transition duration-300">
          <button onclick="addToCart('<%= product.id %>')" class="absolute bottom-4 right-4 w-10 h-10 bg-indigo-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition">
            <i class="fas fa-cart-plus"></i>
          </button>
        </div>
        
        <div class="p-4">
          <h3 class="font-semibold mb-1">
            <a href="/product/<%= product.id %>" class="hover:text-indigo-600 transition"><%= product.name %></a>
          </h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm mb-2"><%= product.category %></p>
          <div class="flex items-center justify-between">
            <span class="text-xl font-bold text-indigo-600">$<%= product.price.toFixed(2) %></span>
            <div class="flex text-yellow-400 text-sm">
              <% for (let i = 0; i < 5; i++) { %>
                <i class="fas fa-star<%= i < product.rating ? '' : '-o text-gray-300' %>"></i>
              <% } %>
            </div>
          </div>
        </div>
      </div>
    <% }) %>
  </div>
</section>
\`, scripts: \`
<script>
async function addToCart(productId, quantity = 1) {
  try {
    const res = await fetch('/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });
    const data = await res.json();
    if (data.success) {
      document.querySelector('.cart-count').textContent = data.cartCount;
      showToast('Added to cart!');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
</script>
\` }) %>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'index.ejs'), storeIndex.trim());
    
    // Product detail
    const productView = `
<%- include('layout', { body: \`
<div class="max-w-6xl mx-auto">
  <nav class="mb-6 text-sm">
    <a href="/" class="text-gray-500 hover:text-gray-700">Home</a>
    <span class="mx-2 text-gray-400">/</span>
    <span class="text-gray-900 dark:text-white"><%= product.name %></span>
  </nav>
  
  <div class="grid md:grid-cols-2 gap-12">
    <div>
      <img src="<%= product.image %>" alt="<%= product.name %>" class="w-full rounded-xl shadow-lg">
    </div>
    
    <div>
      <span class="text-indigo-600 font-medium"><%= product.category %></span>
      <h1 class="text-3xl font-bold mt-2 mb-4"><%= product.name %></h1>
      
      <div class="flex items-center mb-4">
        <div class="flex text-yellow-400 mr-2">
          <% for (let i = 0; i < 5; i++) { %>
            <i class="fas fa-star<%= i < product.rating ? '' : '-o text-gray-300' %>"></i>
          <% } %>
        </div>
        <span class="text-gray-500">(<%= product.reviews || 0 %> reviews)</span>
      </div>
      
      <p class="text-4xl font-bold text-indigo-600 mb-6">$<%= product.price.toFixed(2) %></p>
      
      <p class="text-gray-600 dark:text-gray-400 mb-8"><%= product.description %></p>
      
      <div class="flex items-center gap-4 mb-8">
        <div class="flex items-center border rounded-lg">
          <button onclick="changeQty(-1)" class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">-</button>
          <input type="number" id="quantity" value="1" min="1" class="w-16 text-center border-x py-2 bg-transparent">
          <button onclick="changeQty(1)" class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">+</button>
        </div>
        
        <button onclick="addToCart('<%= product.id %>', document.getElementById('quantity').value)" 
          class="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">
          <i class="fas fa-cart-plus mr-2"></i> Add to Cart
        </button>
      </div>
      
      <div class="border-t pt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
        <p><i class="fas fa-truck mr-2"></i> Free shipping on orders over $50</p>
        <p><i class="fas fa-undo mr-2"></i> 30-day return policy</p>
        <p><i class="fas fa-shield-alt mr-2"></i> Secure checkout</p>
      </div>
    </div>
  </div>
</div>
\`, scripts: \`
<script>
function changeQty(delta) {
  const input = document.getElementById('quantity');
  const newVal = Math.max(1, parseInt(input.value) + delta);
  input.value = newVal;
}

async function addToCart(productId, quantity) {
  const res = await fetch('/cart/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity: parseInt(quantity) })
  });
  const data = await res.json();
  if (data.success) {
    document.querySelector('.cart-count').textContent = data.cartCount;
    alert('Added to cart!');
  }
}
</script>
\` }) %>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'product.ejs'), productView.trim());
    
    // Cart
    const cartView = `
<%- include('layout', { body: \`
<div class="max-w-4xl mx-auto">
  <h1 class="text-3xl font-bold mb-8">Shopping Cart</h1>
  
  <% if (cart.length === 0) { %>
    <div class="text-center py-12">
      <i class="fas fa-shopping-cart text-6xl text-gray-300 mb-4"></i>
      <p class="text-xl text-gray-600 dark:text-gray-400 mb-4">Your cart is empty</p>
      <a href="/" class="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg">Continue Shopping</a>
    </div>
  <% } else { %>
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <% cart.forEach(item => { %>
        <div class="flex items-center p-6 border-b dark:border-gray-700 last:border-0" id="item-<%= item.id %>">
          <img src="<%= item.image %>" alt="<%= item.name %>" class="w-20 h-20 object-cover rounded-lg">
          
          <div class="ml-4 flex-1">
            <h3 class="font-semibold"><%= item.name %></h3>
            <p class="text-gray-500">$<%= item.price.toFixed(2) %></p>
          </div>
          
          <div class="flex items-center gap-4">
            <span class="text-gray-600 dark:text-gray-400">Qty: <%= item.quantity %></span>
            <span class="font-bold">$<%= (item.price * item.quantity).toFixed(2) %></span>
            <button onclick="removeItem('<%= item.id %>')" class="text-red-500 hover:text-red-700">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      <% }) %>
    </div>
    
    <div class="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div class="flex justify-between mb-4">
        <span class="text-gray-600 dark:text-gray-400">Subtotal</span>
        <span class="font-bold">$<%= cartTotal.toFixed(2) %></span>
      </div>
      <div class="flex justify-between mb-4">
        <span class="text-gray-600 dark:text-gray-400">Shipping</span>
        <span class="font-bold text-green-600">Free</span>
      </div>
      <div class="border-t pt-4 flex justify-between text-xl">
        <span class="font-semibold">Total</span>
        <span class="font-bold text-indigo-600">$<%= cartTotal.toFixed(2) %></span>
      </div>
      
      <a href="/checkout" class="block w-full mt-6 py-3 bg-indigo-600 text-white text-center rounded-lg font-semibold hover:bg-indigo-700 transition">
        Proceed to Checkout
      </a>
    </div>
  <% } %>
</div>
\`, scripts: \`
<script>
async function removeItem(productId) {
  const res = await fetch('/cart/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId })
  });
  if (res.ok) location.reload();
}
</script>
\` }) %>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'cart.ejs'), cartView.trim());
    
    // Checkout
    const checkoutView = `
<%- include('layout', { 
  head: '<script src="https://js.stripe.com/v3/"></script>',
  body: \`
<div class="max-w-2xl mx-auto">
  <h1 class="text-3xl font-bold mb-8">Checkout</h1>
  
  <form id="payment-form" class="space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 class="text-xl font-semibold mb-4">Shipping Information</h2>
      
      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">First Name</label>
          <input type="text" required class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Last Name</label>
          <input type="text" required class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
        </div>
      </div>
      
      <div class="mt-4">
        <label class="block text-sm font-medium mb-1">Email</label>
        <input type="email" required class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
      </div>
      
      <div class="mt-4">
        <label class="block text-sm font-medium mb-1">Address</label>
        <input type="text" required class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
      </div>
      
      <div class="grid md:grid-cols-3 gap-4 mt-4">
        <div>
          <label class="block text-sm font-medium mb-1">City</label>
          <input type="text" required class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">State</label>
          <input type="text" required class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">ZIP</label>
          <input type="text" required class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
        </div>
      </div>
    </div>
    
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 class="text-xl font-semibold mb-4">Payment</h2>
      <div id="card-element" class="p-4 border rounded-lg dark:border-gray-600"></div>
      <div id="card-errors" class="text-red-500 text-sm mt-2"></div>
    </div>
    
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div class="flex justify-between text-xl mb-4">
        <span class="font-semibold">Total</span>
        <span class="font-bold text-indigo-600">$<%= cartTotal.toFixed(2) %></span>
      </div>
      
      <button type="submit" id="submit-btn" class="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">
        Pay $<%= cartTotal.toFixed(2) %>
      </button>
    </div>
  </form>
</div>
\`, scripts: \`
<script>
const stripe = Stripe('<%= stripePublicKey %>');
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

const form = document.getElementById('payment-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Processing...';
  
  try {
    const res = await fetch('/create-payment-intent', { method: 'POST' });
    const { clientSecret } = await res.json();
    
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement }
    });
    
    if (error) {
      document.getElementById('card-errors').textContent = error.message;
      btn.disabled = false;
      btn.textContent = 'Pay';
    } else if (paymentIntent.status === 'succeeded') {
      await fetch('/order/complete', { method: 'POST' });
      alert('Payment successful!');
      window.location.href = '/';
    }
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = 'Pay';
  }
});
</script>
\` }) %>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'checkout.ejs'), checkoutView.trim());
    
    // Create sample products
    const dataDir = path.join(this.baseDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    
    const products = [
      { id: 'prod-1', name: 'Wireless Headphones', price: 99.99, category: 'Electronics', rating: 4, reviews: 128, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500', description: 'High-quality wireless headphones with noise cancellation.' },
      { id: 'prod-2', name: 'Smart Watch', price: 199.99, category: 'Electronics', rating: 5, reviews: 256, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', description: 'Feature-packed smartwatch with health tracking.' },
      { id: 'prod-3', name: 'Laptop Stand', price: 49.99, category: 'Accessories', rating: 4, reviews: 89, image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500', description: 'Ergonomic aluminum laptop stand.' },
      { id: 'prod-4', name: 'Mechanical Keyboard', price: 129.99, category: 'Electronics', rating: 5, reviews: 342, image: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=500', description: 'RGB mechanical keyboard with custom switches.' }
    ];
    
    fs.writeFileSync(path.join(dataDir, 'products.json'), JSON.stringify(products, null, 2));
  }

  // ==========================================
  // DASHBOARD VIEWS
  // ==========================================
  generateDashboardViews() {
    const dashboardDir = path.join(this.viewsDir, 'dashboard');
    fs.mkdirSync(dashboardDir, { recursive: true });
    
    // Login
    const login = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login | ${this.config.projectName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
  <div class="w-full max-w-md">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">${this.config.projectName}</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">Sign in to your account</p>
      </div>
      
      <% if (error) { %>
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
          <%= error %>
        </div>
      <% } %>
      
      <form action="/login" method="POST" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
          <div class="relative">
            <i class="fas fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input type="email" name="email" required value="admin@example.com"
              class="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
          <div class="relative">
            <i class="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input type="password" name="password" required value="admin123"
              class="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
          </div>
        </div>
        
        <div class="flex items-center justify-between">
          <label class="flex items-center">
            <input type="checkbox" class="w-4 h-4 text-indigo-600 rounded">
            <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">Remember me</span>
          </label>
          <a href="#" class="text-sm text-indigo-600 hover:text-indigo-700">Forgot password?</a>
        </div>
        
        <button type="submit" class="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">
          Sign In
        </button>
      </form>
      
      <p class="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
        Demo: admin@example.com / admin123
      </p>
    </div>
  </div>
</body>
</html>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'login.ejs'), login);
    
    // Dashboard layout
    const dashboardLayout = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %> | ${this.config.projectName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-gray-100 dark:bg-gray-900">
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside class="w-64 bg-gray-800 text-white fixed h-full">
      <div class="p-6">
        <h1 class="text-2xl font-bold">${this.config.projectName}</h1>
      </div>
      
      <nav class="mt-6">
        <a href="/dashboard" class="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition <%= title === 'Dashboard' ? 'bg-gray-700 text-white border-l-4 border-indigo-500' : '' %>">
          <i class="fas fa-home w-5"></i>
          <span class="ml-3">Dashboard</span>
        </a>
        <a href="/dashboard/users" class="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition <%= title === 'Users' ? 'bg-gray-700 text-white border-l-4 border-indigo-500' : '' %>">
          <i class="fas fa-users w-5"></i>
          <span class="ml-3">Users</span>
        </a>
        <a href="/dashboard/analytics" class="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition <%= title === 'Analytics' ? 'bg-gray-700 text-white border-l-4 border-indigo-500' : '' %>">
          <i class="fas fa-chart-line w-5"></i>
          <span class="ml-3">Analytics</span>
        </a>
        <a href="/dashboard/settings" class="flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition <%= title === 'Settings' ? 'bg-gray-700 text-white border-l-4 border-indigo-500' : '' %>">
          <i class="fas fa-cog w-5"></i>
          <span class="ml-3">Settings</span>
        </a>
        
        <div class="absolute bottom-0 w-full border-t border-gray-700">
          <a href="/logout" class="flex items-center px-6 py-4 text-gray-300 hover:bg-gray-700 hover:text-white transition">
            <i class="fas fa-sign-out-alt w-5"></i>
            <span class="ml-3">Logout</span>
          </a>
        </div>
      </nav>
    </aside>
    
    <!-- Main Content -->
    <div class="flex-1 ml-64">
      <!-- Top Bar -->
      <header class="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div class="flex items-center justify-between px-6 py-4">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-white"><%= title %></h2>
          
          <div class="flex items-center gap-4">
            <button class="p-2 text-gray-500 hover:text-gray-700">
              <i class="fas fa-bell"></i>
            </button>
            <div class="flex items-center gap-3">
              <img src="https://ui-avatars.com/api/?name=<%= user.name %>" class="w-8 h-8 rounded-full">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300"><%= user.name %></span>
            </div>
          </div>
        </div>
      </header>
      
      <!-- Page Content -->
      <main class="p-6">
        <%- body %>
      </main>
    </div>
  </div>
  
  <%- typeof scripts !== 'undefined' ? scripts : '' %>
</body>
</html>
`;
    
    fs.writeFileSync(path.join(dashboardDir, 'layout.ejs'), dashboardLayout);
    
    // Dashboard home
    const dashboardIndex = `
<%- include('layout', { body: \`
<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-gray-500 text-sm">Total Users</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-white"><%= stats.users.toLocaleString() %></p>
      </div>
      <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
        <i class="fas fa-users text-blue-600 text-xl"></i>
      </div>
    </div>
    <p class="text-green-500 text-sm mt-2"><i class="fas fa-arrow-up"></i> +12% from last month</p>
  </div>
  
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-gray-500 text-sm">Revenue</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-white">$<%= stats.revenue.toLocaleString() %></p>
      </div>
      <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
        <i class="fas fa-dollar-sign text-green-600 text-xl"></i>
      </div>
    </div>
    <p class="text-green-500 text-sm mt-2"><i class="fas fa-arrow-up"></i> +8% from last month</p>
  </div>
  
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-gray-500 text-sm">Orders</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-white"><%= stats.orders.toLocaleString() %></p>
      </div>
      <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
        <i class="fas fa-shopping-bag text-purple-600 text-xl"></i>
      </div>
    </div>
    <p class="text-green-500 text-sm mt-2"><i class="fas fa-arrow-up"></i> +15% from last month</p>
  </div>
  
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-gray-500 text-sm">Visitors</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-white"><%= stats.visitors.toLocaleString() %></p>
      </div>
      <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
        <i class="fas fa-eye text-orange-600 text-xl"></i>
      </div>
    </div>
    <p class="text-red-500 text-sm mt-2"><i class="fas fa-arrow-down"></i> -3% from last month</p>
  </div>
</div>

<div class="grid lg:grid-cols-2 gap-6">
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
    <h3 class="text-lg font-semibold mb-4">Revenue Overview</h3>
    <canvas id="revenueChart" height="200"></canvas>
  </div>
  
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
    <h3 class="text-lg font-semibold mb-4">Recent Activity</h3>
    <div class="space-y-4">
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <i class="fas fa-user-plus text-blue-600"></i>
        </div>
        <div>
          <p class="font-medium">New user registered</p>
          <p class="text-sm text-gray-500">2 minutes ago</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
          <i class="fas fa-shopping-cart text-green-600"></i>
        </div>
        <div>
          <p class="font-medium">New order #1234</p>
          <p class="text-sm text-gray-500">15 minutes ago</p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
          <i class="fas fa-comment text-purple-600"></i>
        </div>
        <div>
          <p class="font-medium">New review received</p>
          <p class="text-sm text-gray-500">1 hour ago</p>
        </div>
      </div>
    </div>
  </div>
</div>
\`, scripts: \`
<script>
new Chart(document.getElementById('revenueChart'), {
  type: 'line',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Revenue',
      data: [3000, 4500, 4200, 5800, 6200, 7500],
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      fill: true,
      tension: 0.4
    }]
  },
  options: {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { callback: v => '$' + v } }
    }
  }
});
</script>
\` }) %>
`;
    
    fs.writeFileSync(path.join(dashboardDir, 'index.ejs'), dashboardIndex.trim());
    
    // Users page
    const usersPage = `
<%- include('layout', { body: \`
<div class="bg-white dark:bg-gray-800 rounded-xl shadow">
  <div class="p-6 border-b dark:border-gray-700 flex items-center justify-between">
    <h3 class="text-lg font-semibold">All Users</h3>
    <button class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
      <i class="fas fa-plus mr-2"></i> Add User
    </button>
  </div>
  
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead class="bg-gray-50 dark:bg-gray-700">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y dark:divide-gray-700">
        <% users.forEach(user => { %>
          <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
            <td class="px-6 py-4">
              <div class="flex items-center">
                <img src="https://ui-avatars.com/api/?name=<%= user.name %>" class="w-10 h-10 rounded-full">
                <span class="ml-3 font-medium"><%= user.name %></span>
              </div>
            </td>
            <td class="px-6 py-4 text-gray-500"><%= user.email %></td>
            <td class="px-6 py-4">
              <span class="px-2 py-1 text-xs font-medium rounded-full <%= user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800' %>">
                <%= user.role %>
              </span>
            </td>
            <td class="px-6 py-4">
              <span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Active</span>
            </td>
            <td class="px-6 py-4 text-right">
              <button class="text-gray-400 hover:text-gray-600"><i class="fas fa-edit"></i></button>
              <button class="text-gray-400 hover:text-red-600 ml-3"><i class="fas fa-trash"></i></button>
            </td>
          </tr>
        <% }) %>
      </tbody>
    </table>
  </div>
</div>
\` }) %>
`;
    
    fs.writeFileSync(path.join(dashboardDir, 'users.ejs'), usersPage.trim());
    
    // Analytics page
    const analyticsPage = `
<%- include('layout', { body: \`
<div class="grid lg:grid-cols-2 gap-6">
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
    <h3 class="text-lg font-semibold mb-4">Traffic Sources</h3>
    <canvas id="trafficChart" height="200"></canvas>
  </div>
  
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
    <h3 class="text-lg font-semibold mb-4">Sales by Category</h3>
    <canvas id="salesChart" height="200"></canvas>
  </div>
</div>
\`, scripts: \`
<script>
new Chart(document.getElementById('trafficChart'), {
  type: 'doughnut',
  data: {
    labels: ['Organic', 'Direct', 'Referral', 'Social'],
    datasets: [{
      data: [45, 25, 20, 10],
      backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899']
    }]
  }
});

new Chart(document.getElementById('salesChart'), {
  type: 'bar',
  data: {
    labels: ['Electronics', 'Clothing', 'Home', 'Sports'],
    datasets: [{
      label: 'Sales',
      data: [12000, 9000, 7500, 5000],
      backgroundColor: '#6366f1'
    }]
  },
  options: { scales: { y: { beginAtZero: true } } }
});
</script>
\` }) %>
`;
    
    fs.writeFileSync(path.join(dashboardDir, 'analytics.ejs'), analyticsPage.trim());
    
    // Settings page
    const settingsPage = `
<%- include('layout', { body: \`
<div class="max-w-2xl">
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6">
    <h3 class="text-lg font-semibold mb-4">Profile Settings</h3>
    
    <form class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Name</label>
        <input type="text" value="<%= user.name %>" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-1">Email</label>
        <input type="email" value="<%= user.email %>" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
      </div>
      
      <button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
        Save Changes
      </button>
    </form>
  </div>
  
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
    <h3 class="text-lg font-semibold mb-4">Change Password</h3>
    
    <form class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Current Password</label>
        <input type="password" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-1">New Password</label>
        <input type="password" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-1">Confirm Password</label>
        <input type="password" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
      </div>
      
      <button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
        Update Password
      </button>
    </form>
  </div>
</div>
\` }) %>
`;
    
    fs.writeFileSync(path.join(dashboardDir, 'settings.ejs'), settingsPage.trim());
  }

  // ==========================================
  // REALTIME VIEWS
  // ==========================================
  generateRealtimeViews() {
    const realtimeIndex = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %> | ${this.config.projectName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script src="/socket.io/socket.io.js"></script>
</head>
<body class="bg-gray-900 text-white min-h-screen">
  <div class="container mx-auto max-w-4xl p-4">
    <header class="text-center py-8">
      <h1 class="text-4xl font-bold mb-2">${this.config.projectName}</h1>
      <p class="text-gray-400">Real-time Chat Application</p>
    </header>
    
    <!-- Join Screen -->
    <div id="join-screen" class="max-w-md mx-auto">
      <div class="bg-gray-800 rounded-xl p-8">
        <h2 class="text-2xl font-semibold mb-6 text-center">Join the Chat</h2>
        <form id="join-form">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">Username</label>
            <input type="text" id="username" required minlength="2" maxlength="20"
              class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter your username">
          </div>
          <button type="submit" class="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">
            Join Chat
          </button>
        </form>
      </div>
    </div>
    
    <!-- Chat Screen -->
    <div id="chat-screen" class="hidden">
      <div class="grid lg:grid-cols-4 gap-4">
        <!-- Users Sidebar -->
        <div class="lg:col-span-1 bg-gray-800 rounded-xl p-4">
          <h3 class="font-semibold mb-4">
            <i class="fas fa-users mr-2"></i> 
            Online (<span id="user-count">0</span>)
          </h3>
          <ul id="users-list" class="space-y-2"></ul>
        </div>
        
        <!-- Chat Area -->
        <div class="lg:col-span-3 bg-gray-800 rounded-xl flex flex-col" style="height: 600px;">
          <div id="messages" class="flex-1 overflow-y-auto p-4 space-y-4"></div>
          
          <div id="typing-indicator" class="hidden px-4 py-2 text-gray-400 text-sm">
            <i class="fas fa-circle-notch fa-spin mr-2"></i>
            <span id="typing-user"></span> is typing...
          </div>
          
          <form id="message-form" class="p-4 border-t border-gray-700">
            <div class="flex gap-2">
              <input type="text" id="message-input" autocomplete="off"
                class="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Type a message...">
              <button type="submit" class="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    const socket = io();
    let currentUser = '';
    let typingTimeout;
    
    // DOM Elements
    const joinScreen = document.getElementById('join-screen');
    const chatScreen = document.getElementById('chat-screen');
    const joinForm = document.getElementById('join-form');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messagesDiv = document.getElementById('messages');
    const usersList = document.getElementById('users-list');
    const userCount = document.getElementById('user-count');
    const typingIndicator = document.getElementById('typing-indicator');
    const typingUser = document.getElementById('typing-user');
    
    // Join chat
    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      if (username) {
        currentUser = username;
        socket.emit('join', username);
        joinScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        messageInput.focus();
      }
    });
    
    // Send message
    messageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = messageInput.value.trim();
      if (message) {
        socket.emit('message', { message });
        messageInput.value = '';
        socket.emit('typing', false);
      }
    });
    
    // Typing indicator
    messageInput.addEventListener('input', () => {
      socket.emit('typing', true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => socket.emit('typing', false), 1000);
    });
    
    // Socket events
    socket.on('userJoined', ({ username, users, count }) => {
      addSystemMessage(\`\${username} joined the chat\`);
      updateUsersList(users);
      userCount.textContent = count;
    });
    
    socket.on('userLeft', ({ username, users, count }) => {
      addSystemMessage(\`\${username} left the chat\`);
      updateUsersList(users);
      userCount.textContent = count;
    });
    
    socket.on('message', ({ username, message, timestamp }) => {
      const isOwn = username === currentUser;
      const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const html = \`
        <div class="flex \${isOwn ? 'justify-end' : 'justify-start'}">
          <div class="\${isOwn ? 'bg-indigo-600' : 'bg-gray-700'} rounded-lg px-4 py-2 max-w-xs lg:max-w-md">
            \${!isOwn ? \`<div class="text-xs text-indigo-400 mb-1">\${username}</div>\` : ''}
            <div>\${escapeHtml(message)}</div>
            <div class="text-xs text-gray-400 mt-1">\${time}</div>
          </div>
        </div>
      \`;
      
      messagesDiv.insertAdjacentHTML('beforeend', html);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
    
    socket.on('typing', ({ username, isTyping }) => {
      if (username !== currentUser) {
        typingIndicator.classList.toggle('hidden', !isTyping);
        typingUser.textContent = username;
      }
    });
    
    // Helpers
    function addSystemMessage(text) {
      const html = \`
        <div class="text-center text-gray-500 text-sm">
          <span class="bg-gray-800 px-3 py-1 rounded-full">\${text}</span>
        </div>
      \`;
      messagesDiv.insertAdjacentHTML('beforeend', html);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    function updateUsersList(users) {
      usersList.innerHTML = users.map(user => \`
        <li class="flex items-center gap-2 px-3 py-2 rounded-lg \${user === currentUser ? 'bg-gray-700' : ''}">
          <span class="w-2 h-2 bg-green-500 rounded-full"></span>
          \${user} \${user === currentUser ? '(you)' : ''}
        </li>
      \`).join('');
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>
`;
    
    fs.writeFileSync(path.join(this.viewsDir, 'index.ejs'), realtimeIndex);
  }
}

module.exports = ViewGenerator;
