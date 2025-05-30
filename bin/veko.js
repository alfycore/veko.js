#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const DevServer = require('../lib/dev-server');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const program = new Command();

program
  .name('veko')
  .description('Veko.js Framework CLI')
  .version('1.0.0');

// ============= DEV COMMAND =============
program
  .command('dev')
  .description('Start development server')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('-f, --file <file>', 'Entry file', 'app.js')
  .option('-w, --watch <dirs>', 'Watch directories', 'views,routes,public')
  .action(async (options) => {
    try {
      const devServer = new DevServer({
        port: parseInt(options.port),
        file: options.file,
        watchDirs: options.watch.split(',')
      });
      
      await devServer.start();
    } catch (error) {
      console.error(chalk.red('❌ Error starting dev server:'), error.message);
      process.exit(1);
    }
  });

// ============= BUILD COMMAND =============
program
  .command('build')
  .description('Build for production')
  .action(() => {
    console.log(chalk.blue('🔨 Building for production...'));
    console.log(chalk.green('✅ Build completed!'));
  });

// ============= START COMMAND =============
program
  .command('start')
  .description('Start production server')
  .option('-f, --file <file>', 'Entry file', 'app.js')
  .action((options) => {
    try {
      console.log(chalk.blue('🚀 Starting production server...'));
      execSync(`node ${options.file}`, { stdio: 'inherit' });
    } catch (error) {
      console.error(chalk.red('❌ Error starting server:'), error.message);
      process.exit(1);
    }
  });

// ============= SETUP COMMAND =============
program
  .command('setup [project-name]')
  .description('Initialize a new Veko.js project')
  .option('-n, --name <name>', 'Project name', 'veko-app')
  .option('-d, --dir <directory>', 'Destination directory')
  .option('-t, --template <template>', 'Template to use (default, api, blog, admin)', 'default')
  .option('--skip-install', 'Skip dependency installation')
  .option('--git', 'Initialize Git repository')
  .action(async (projectNameArg, options) => {
    const projectName = projectNameArg || options.name;
    const projectDir = options.dir || projectName;
    const template = options.template;
    
    console.log(chalk.blue.bold('\n🚀 Veko.js Project Setup\n'));
    
    try {
      await setupProject(projectDir, projectName, template, options);
      
      console.log(chalk.green.bold('\n✨ Project created successfully!\n'));
      console.log(chalk.cyan('📁 Next steps:'));
      console.log(chalk.white('   cd ' + projectDir));
      if (options.skipInstall) {
        console.log(chalk.white('   npm install'));
      }
      console.log(chalk.white('   veko dev'));
      console.log(chalk.gray('\n   Your app will be available at http://localhost:3000\n'));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Error creating project:'), error.message);
      process.exit(1);
    }
  });

// ============= SETUP FUNCTIONS =============

async function setupProject(projectDir, projectName, template, options) {
  const fullPath = path.resolve(process.cwd(), projectDir);
  
  // Create main directory
  console.log(chalk.blue('📁 Creating directory...'));
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  } else if (fs.readdirSync(fullPath).length > 0) {
    throw new Error('Directory ' + projectDir + ' is not empty');
  }
  
  // Create project structure
  console.log(chalk.blue('📂 Creating structure...'));
  createProjectStructure(fullPath);
  
  // Generate files based on template
  console.log(chalk.blue('📄 Generating files...'));
  await generateFiles(fullPath, projectName, template);
  
  // Initialize Git if requested
  if (options.git) {
    console.log(chalk.blue('🔄 Initializing Git...'));
    initializeGit(fullPath);
  }
  
  // Install dependencies
  if (!options.skipInstall) {
    console.log(chalk.blue('📦 Installing dependencies...'));
    await installDependencies(fullPath);
  }
}

function createProjectStructure(projectPath) {
  const directories = [
    'views',
    'views/layouts',
    'views/partials',
    'views/components',
    'routes',
    'routes/api',
    'public',
    'public/css',
    'public/js',
    'public/images',
    'config',
    'middleware',
    'plugins',
    'data',
    'data/plugins',
    'utils'
  ];
  
  directories.forEach(dir => {
    const fullDirPath = path.join(projectPath, dir);
    fs.mkdirSync(fullDirPath, { recursive: true });
    console.log(chalk.gray(`   ✓ ${dir}/`));
  });
}

async function generateFiles(projectPath, projectName, template) {
  const files = getTemplateFiles(template, projectName);
  
  for (const [filePath, content] of Object.entries(files)) {
    const fullFilePath = path.join(projectPath, filePath);
    const dir = path.dirname(fullFilePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullFilePath, content, 'utf8');
    console.log(chalk.gray(`   ✓ ${filePath}`));
  }
}

function getTemplateFiles(template, projectName) {
  switch (template) {
    case 'api':
      return getApiTemplateFiles(projectName);
    case 'blog':
      return getBlogTemplateFiles(projectName);
    case 'admin':
      return getAdminTemplateFiles(projectName);
    default:
      return getDefaultTemplateFiles(projectName);
  }
}

function initializeGit(projectPath) {
  try {
    execSync('git init', { cwd: projectPath, stdio: 'pipe' });
    execSync('git add .', { cwd: projectPath, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: projectPath, stdio: 'pipe' });
    console.log(chalk.gray('   ✓ Git repository initialized'));
  } catch (error) {
    console.log(chalk.yellow('   ⚠ Git initialization failed (optional)'));
  }
}

async function installDependencies(projectPath) {
  try {
    console.log(chalk.gray('   Installing npm packages...'));
    execSync('npm install', { cwd: projectPath, stdio: 'pipe' });
    console.log(chalk.gray('   ✓ Dependencies installed'));
  } catch (error) {
    console.log(chalk.yellow('   ⚠ Failed to install dependencies'));
    console.log(chalk.gray('   Run "npm install" manually in the project directory'));
  }
}

function getDefaultTemplateFiles(projectName) {
  return {
    // Package.json
    'package.json': JSON.stringify({
      name: projectName,
      version: '1.0.0',
      description: `${projectName} - Veko.js Application`,
      main: 'app.js',
      scripts: {
        dev: 'veko dev',
        start: 'node app.js',
        build: 'veko build'
      },
      dependencies: {
        'veko': 'latest',
        'express': '^4.18.2',
        'ejs': '^3.1.9',
        'ws': '^8.14.2',
        'chokidar': '^3.5.3',
        'chalk': '^4.1.2'
      },
      devDependencies: {
        'nodemon': '^3.0.1'
      },
      keywords: ['veko', 'nodejs', 'web', 'framework'],
      author: '',
      license: 'MIT'
    }, null, 2),

    // Main app.js
    'app.js': `const { App } = require('veko');

const app = new App({
  port: 3000,
  isDev: process.env.NODE_ENV !== 'production',
  viewsDir: 'views',
  staticDir: 'public',
  routesDir: 'routes',
  layouts: {
    enabled: true,
    defaultLayout: 'main',
    layoutsDir: 'views/layouts'
  },
  plugins: {
    enabled: true,
    autoLoad: true,
    pluginsDir: 'plugins'
  }
});

// Custom middleware
app.use((req, res, next) => {
  console.log(\`\${req.method} \${req.url}\`);
  next();
});

// Load routes and start server
app.loadRoutes()
   .listen(() => {
     console.log('🚀 App started on http://localhost:3000');
   });
`,

    // Main layout
    'views/layouts/main.ejs': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= meta.title || '${projectName}' %></title>
    
    <% if (meta.description) { %>
    <meta name="description" content="<%= meta.description %>">
    <% } %>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <!-- Custom CSS -->
    <link rel="stylesheet" href="/css/app.css">
    
    <!-- Page specific CSS -->
    <% if (layout && layout.css) { %>
        <% layout.css.forEach(href => { %>
        <link rel="stylesheet" href="<%= href %>">
        <% }); %>
    <% } %>
    
    <!-- Custom head section -->
    <% if (sections && sections.head) { %>
    <%- sections.head %>
    <% } %>
</head>
<body class="<%= layout && layout.bodyClass || '' %>">
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="/">
                🚀 <%= meta.title || '${projectName}' %>
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="/">Home</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/about">About</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/contact">Contact</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
    
    <!-- Custom header -->
    <% if (sections && sections.header) { %>
    <header>
        <%- sections.header %>
    </header>
    <% } %>
    
    <!-- Main content -->
    <main class="container my-4">
        <%- sections.content %>
    </main>
    
    <!-- Footer -->
    <footer class="bg-dark text-light py-4 mt-5">
        <div class="container">
            <% if (sections && sections.footer) { %>
            <%- sections.footer %>
            <% } else { %>
            <div class="row">
                <div class="col-md-6">
                    <h5>🚀 ${projectName}</h5>
                    <p>Built with Veko.js</p>
                </div>
                <div class="col-md-6 text-end">
                    <small>&copy; <%= new Date().getFullYear() %> - Powered by Veko.js ⚡</small>
                </div>
            </div>
            <% } %>
        </div>
    </footer>
    
    <!-- Bootstrap JavaScript -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <!-- Custom JavaScript -->
    <script src="/js/app.js"></script>
    
    <!-- Page specific JS -->
    <% if (layout && layout.js) { %>
        <% layout.js.forEach(src => { %>
        <script src="<%= src %>"></script>
        <% }); %>
    <% } %>
    
    <!-- Custom scripts section -->
    <% if (sections && sections.scripts) { %>
    <%- sections.scripts %>
    <% } %>
</body>
</html>`,

    // Home page
    'views/home.ejs': `<% layout.title('Home - ${projectName}') %>
<% layout.meta('description', 'Welcome to ${projectName}') %>
<% layout.css('/css/home.css') %>

<% layout.section('header', \`
<div class="hero-section bg-gradient text-center text-white p-5 rounded mb-4">
    <h1 class="display-4">🎉 Welcome to Veko.js</h1>
    <p class="lead">Ultra-modern Node.js framework</p>
</div>
\`) %>

<!-- Features -->
<div class="row">
    <div class="col-md-4 mb-4">
        <div class="card h-100">
            <div class="card-body text-center">
                <h3>🚀 Fast</h3>
                <p class="card-text">Optimized performance and ultra-fast loading times.</p>
            </div>
        </div>
    </div>
    <div class="col-md-4 mb-4">
        <div class="card h-100">
            <div class="card-body text-center">
                <h3>💎 Modern</h3>
                <p class="card-text">Cutting-edge technologies and modern architecture.</p>
            </div>
        </div>
    </div>
    <div class="col-md-4 mb-4">
        <div class="card h-100">
            <div class="card-body text-center">
                <h3>🎨 Flexible</h3>
                <p class="card-text">Advanced layout system and reusable components.</p>
            </div>
        </div>
    </div>
</div>

<% layout.section('scripts', \`
<script>
    console.log('✨ ${projectName} loaded with Veko.js!');
    
    // Card hover animations
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.transition = 'transform 0.3s ease';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
</script>
\`) %>`,

    // About page
    'views/about.ejs': `<% layout.title('About - ${projectName}') %>
<% layout.meta('description', 'Learn more about ${projectName}') %>

<div class="row">
    <div class="col-lg-8 mx-auto">
        <h1>📖 About</h1>
        
        <p class="lead">
            Welcome to ${projectName}, an application built with Veko.js!
        </p>
        
        <h3>🚀 What is Veko.js?</h3>
        <p>
            Veko.js is a modern framework for Node.js that offers:
        </p>
        
        <ul>
            <li><strong>Intelligent Hot Reload</strong> - Selective reloading of modified routes</li>
            <li><strong>Advanced Layout System</strong> - Powerful templating with sections and helpers</li>
            <li><strong>Dynamic Routes</strong> - Create/delete routes on-the-fly</li>
            <li><strong>Plugin System</strong> - Extensible architecture with hooks</li>
            <li><strong>Auto Module Installation</strong> - Automatic dependency management</li>
            <li><strong>Beautiful Logging</strong> - Colorful logging system with icons</li>
        </ul>
        
        <div class="alert alert-info">
            <strong>💡 Tip:</strong> 
            Use <code>veko dev</code> to start the development server 
            with intelligent hot reload!
        </div>
    </div>
</div>`,

    // Contact page
    'views/contact.ejs': `<% layout.title('Contact - ${projectName}') %>
<% layout.meta('description', 'Contact us') %>

<div class="row">
    <div class="col-lg-8 mx-auto">
        <h1>📞 Contact</h1>
        
        <p class="lead">
            Get in touch with us!
        </p>
        
        <% if (typeof success !== 'undefined' && success) { %>
        <div class="alert alert-success">
            <strong>✅ Success!</strong> Your message has been sent.
        </div>
        <% } %>
        
        <form method="POST" action="/contact">
            <div class="mb-3">
                <label for="name" class="form-label">Name</label>
                <input type="text" class="form-control" id="name" name="name" required>
            </div>
            
            <div class="mb-3">
                <label for="email" class="form-label">Email</label>
                <input type="email" class="form-control" id="email" name="email" required>
            </div>
            
            <div class="mb-3">
                <label for="message" class="form-label">Message</label>
                <textarea class="form-control" id="message" name="message" rows="5" required></textarea>
            </div>
            
            <button type="submit" class="btn btn-primary">📤 Send Message</button>
        </form>
    </div>
</div>`,

    // Routes
    'routes/index.js': `module.exports = {
  get: (req, res) => {
    res.render('home', {
      title: 'Home',
      bodyClass: 'home-page'
    });
  }
};`,

    'routes/about.js': `module.exports = {
  get: (req, res) => {
    res.render('about', {
      title: 'About',
      bodyClass: 'about-page'
    });
  }
};`,

    'routes/contact.js': `module.exports = {
  get: (req, res) => {
    const success = req.query.success === '1';
    res.render('contact', {
      title: 'Contact',
      bodyClass: 'contact-page',
      success
    });
  },
  
  post: (req, res) => {
    const { name, email, message } = req.body;
    
    // Here you can process the form
    console.log('Message received:', { name, email, message });
    
    // Redirect with success message
    res.redirect('/contact?success=1');
  }
};`,

    // API Route example
    'routes/api/hello.js': `module.exports = {
  get: (req, res) => {
    res.json({
      message: 'Hello from Veko.js API!',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  },
  
  post: (req, res) => {
    const { name } = req.body;
    res.json({
      message: \`Hello \${name || 'World'}!\`,
      received: req.body
    });
  }
};`,

    // CSS
    'public/css/app.css': `/* Global styles for ${projectName} */

body {
    background-color: #f8f9fa;
}

.hero-section {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.card {
    border: none;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
}

.card:hover {
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.navbar-brand {
    font-weight: bold;
}

footer {
    margin-top: auto;
}

/* Animations */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.container > * {
    animation: fadeInUp 0.6s ease-out;
}

/* Code highlighting */
pre {
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 0.375rem;
    padding: 1rem;
}

code {
    background-color: #f8f9fa;
    color: #e83e8c;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
}`,

    'public/css/home.css': `/* Home page specific styles */

.home-page .hero-section {
    margin-bottom: 3rem;
}

.home-page .card h3 {
    color: #495057;
    margin-bottom: 1rem;
}`,

    // JavaScript
    'public/js/app.js': `// Global JavaScript for ${projectName}

console.log('🚀 ${projectName} initialized!');

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Form handling with feedback
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function(e) {
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Sending...';
            
            // Restore after 3 seconds in case of error
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }, 3000);
        }
    });
});`,

    // Example plugin
    'plugins/logger.js': `module.exports = {
  name: 'logger',
  version: '1.0.0',
  description: 'Request logging plugin',
  author: 'Veko.js',
  
  defaultConfig: {
    enabled: true,
    logRequests: true,
    logErrors: true
  },

  async load(app, config, context) {
    if (config.logRequests) {
      // Log all requests
      context.hook('request:start', (req) => {
        context.log('info', \`\${req.method} \${req.url}\`, \`IP: \${req.ip}\`);
      });
    }
    
    if (config.logErrors) {
      // Log errors
      context.hook('error:handle', (error, req) => {
        context.log('error', 'Request error', \`\${error.message} - \${req.url}\`);
      });
    }
    
    // Add stats route
    context.addRoute('get', '/api/stats', (req, res) => {
      const stats = context.storage.get('stats', { 
        requests: 0, 
        errors: 0, 
        startTime: new Date().toISOString() 
      });
      
      res.json({
        plugin: 'logger',
        stats,
        uptime: process.uptime()
      });
    });
    
    // Track stats
    context.hook('request:end', (req, res) => {
      const stats = context.storage.get('stats', { requests: 0, errors: 0 });
      stats.requests++;
      
      if (res.statusCode >= 400) {
        stats.errors++;
      }
      
      context.storage.set('stats', stats);
    });
    
    context.log('success', 'Logger plugin loaded');
  },

  async unload(app, config) {
    console.log('Logger plugin unloaded');
  }
};`,

    // README
    'README.md': `# ${projectName}

> Application built with Veko.js

## 🚀 Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or directly with Veko
veko dev
\`\`\`

Your application will be available at [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

\`\`\`
${projectName}/
├── views/              # EJS templates
│   ├── layouts/        # Layout templates
│   └── partials/       # Reusable components
├── routes/             # Application routes
│   └── api/           # API routes
├── public/             # Static assets
│   ├── css/           # Stylesheets
│   ├── js/            # Client-side JavaScript
│   └── images/        # Images
├── plugins/           # Custom plugins
├── config/            # Configuration files
├── middleware/        # Custom middleware
└── app.js            # Entry point
\`\`\`

## 🛠️ Available Commands

- \`npm run dev\` - Development mode with hot reload
- \`npm start\` - Production mode
- \`veko dev\` - Veko development server
- \`veko build\` - Build for production

## ✨ Features

- 🔥 **Intelligent Hot Reload** - Selective reloading of modified routes
- 🎨 **Advanced Layout System** - Powerful templating with sections and helpers
- 🔌 **Plugin System** - Extensible architecture with hooks
- 📦 **Auto Module Installation** - Automatic dependency management
- 🎨 **Beautiful Logging** - Colorful logging system with icons

Happy coding! 🚀
`,

    // Gitignore
    '.gitignore': `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Grunt intermediate storage
.grunt

# Bower dependency directory
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons
build/Release

# Dependency directories
jspm_packages/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
.env.test
.env.production.local
.env.local

# parcel-bundler cache
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless/

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs
*.log

# Build
dist/
build/

# Plugin data
data/plugins/*.json
!data/plugins/.gitkeep

# Temporary files
tmp/
temp/
`,

    // Environment example
    '.env.example': `# Environment configuration for ${projectName}

# Server
NODE_ENV=development
PORT=3000
HOST=localhost

# Database (example)
DATABASE_URL=mongodb://localhost:27017/${projectName}

# Security
JWT_SECRET=your-jwt-secret-key
SESSION_SECRET=your-session-secret

# Development
DEBUG=true
LOG_LEVEL=info
`,

    // Keep file for data/plugins directory
    'data/plugins/.gitkeep': ''
  };
}

function getApiTemplateFiles(projectName) {
  const baseFiles = getDefaultTemplateFiles(projectName);
  
  // Override for API template
  baseFiles['app.js'] = `const { App } = require('veko');

const app = new App({
  port: 3000,
  isDev: process.env.NODE_ENV !== 'production',
  routesDir: 'routes',
  layouts: {
    enabled: false // Disable layouts for API
  },
  plugins: {
    enabled: true,
    autoLoad: true,
    pluginsDir: 'plugins'
  }
});

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// JSON middleware
app.use(require('express').json({ limit: '10mb' }));
app.use(require('express').urlencoded({ extended: true, limit: '10mb' }));

// API logging middleware
app.use((req, res, next) => {
  console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.url}\`);
  next();
});

app.loadRoutes()
   .listen(() => {
     console.log('🚀 API server started on http://localhost:3000');
     console.log('📚 API Documentation: http://localhost:3000/api/docs');
   });
`;

  // Remove view files for API template
  delete baseFiles['views/layouts/main.ejs'];
  delete baseFiles['views/home.ejs'];
  delete baseFiles['views/about.ejs'];
  delete baseFiles['views/contact.ejs'];
  delete baseFiles['routes/index.js'];
  delete baseFiles['routes/about.js'];
  delete baseFiles['routes/contact.js'];

  // Add API documentation
  baseFiles['routes/api/docs.js'] = `module.exports = {
  get: (req, res) => {
    res.json({
      title: '${projectName} API',
      version: '1.0.0',
      endpoints: {
        'GET /api/hello': 'Simple hello endpoint',
        'GET /api/docs': 'This documentation'
      }
    });
  }
};`;

  return baseFiles;
}

function getBlogTemplateFiles(projectName) {
  // Add blog-specific templates here
  return getDefaultTemplateFiles(projectName);
}

function getAdminTemplateFiles(projectName) {
  // Add admin-specific templates here
  return getDefaultTemplateFiles(projectName);
}

program.parse();