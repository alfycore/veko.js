/**
 * Create Veko App
 * Interactive project creator inspired by create-next-app
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync, spawn } = require('child_process');

// Interactive prompt utilities
class InteractivePrompt {
  constructor() {
    this.rl = null;
  }

  // Text input prompt
  async text(message, defaultValue = '') {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const defaultText = defaultValue ? chalk.gray(` (${defaultValue})`) : '';
      
      rl.question(`${chalk.cyan('?')} ${chalk.bold(message)}${defaultText} ${chalk.gray('›')} `, (answer) => {
        rl.close();
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  // Toggle (Yes/No) with arrow keys
  async toggle(message, defaultValue = true) {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      const stdout = process.stdout;
      
      let selected = defaultValue;
      
      const render = () => {
        readline.clearLine(stdout, 0);
        readline.cursorTo(stdout, 0);
        
        const yes = selected 
          ? chalk.cyan.underline('Yes') 
          : chalk.gray('Yes');
        const no = !selected 
          ? chalk.cyan.underline('No') 
          : chalk.gray('No');
        
        stdout.write(`${chalk.cyan('?')} ${chalk.bold(message)} ${chalk.gray('›')} ${yes} ${chalk.gray('/')} ${no}`);
      };
      
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      
      render();
      
      const onKeypress = (key) => {
        // Arrow left/right or h/l
        if (key === '\u001b[D' || key === '\u001b[C' || key === 'h' || key === 'l' || key === 'y' || key === 'n') {
          if (key === 'y') selected = true;
          else if (key === 'n') selected = false;
          else selected = !selected;
          render();
        }
        // Enter
        else if (key === '\r' || key === '\n') {
          stdin.setRawMode(false);
          stdin.removeListener('data', onKeypress);
          stdout.write('\n');
          resolve(selected);
        }
        // Ctrl+C
        else if (key === '\u0003') {
          stdin.setRawMode(false);
          process.exit();
        }
      };
      
      stdin.on('data', onKeypress);
    });
  }

  // Select from list with arrow keys
  async select(message, choices) {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      const stdout = process.stdout;
      
      let selectedIndex = 0;
      
      const render = () => {
        // Move cursor up to redraw
        if (selectedIndex !== -1) {
          readline.moveCursor(stdout, 0, -(choices.length));
        }
        
        console.log(`${chalk.cyan('?')} ${chalk.bold(message)}`);
        
        choices.forEach((choice, index) => {
          const isSelected = index === selectedIndex;
          const prefix = isSelected ? chalk.cyan('❯') : ' ';
          const text = isSelected 
            ? chalk.cyan(choice.name || choice) 
            : chalk.gray(choice.name || choice);
          console.log(`  ${prefix} ${text}`);
        });
      };
      
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      
      // Initial render
      console.log(`${chalk.cyan('?')} ${chalk.bold(message)} ${chalk.gray('(Use arrow keys)')}`);
      choices.forEach((choice, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? chalk.cyan('❯') : ' ';
        const text = isSelected 
          ? chalk.cyan(choice.name || choice) 
          : chalk.gray(choice.name || choice);
        console.log(`  ${prefix} ${text}`);
      });
      
      const onKeypress = (key) => {
        // Arrow up
        if (key === '\u001b[A' || key === 'k') {
          selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : choices.length - 1;
          readline.moveCursor(stdout, 0, -(choices.length));
          choices.forEach((choice, index) => {
            readline.clearLine(stdout, 0);
            const isSelected = index === selectedIndex;
            const prefix = isSelected ? chalk.cyan('❯') : ' ';
            const text = isSelected 
              ? chalk.cyan(choice.name || choice) 
              : chalk.gray(choice.name || choice);
            console.log(`  ${prefix} ${text}`);
          });
        }
        // Arrow down
        else if (key === '\u001b[B' || key === 'j') {
          selectedIndex = selectedIndex < choices.length - 1 ? selectedIndex + 1 : 0;
          readline.moveCursor(stdout, 0, -(choices.length));
          choices.forEach((choice, index) => {
            readline.clearLine(stdout, 0);
            const isSelected = index === selectedIndex;
            const prefix = isSelected ? chalk.cyan('❯') : ' ';
            const text = isSelected 
              ? chalk.cyan(choice.name || choice) 
              : chalk.gray(choice.name || choice);
            console.log(`  ${prefix} ${text}`);
          });
        }
        // Enter
        else if (key === '\r' || key === '\n') {
          stdin.setRawMode(false);
          stdin.removeListener('data', onKeypress);
          const choice = choices[selectedIndex];
          resolve(choice.value !== undefined ? choice.value : choice);
        }
        // Ctrl+C
        else if (key === '\u0003') {
          stdin.setRawMode(false);
          process.exit();
        }
      };
      
      stdin.on('data', onKeypress);
    });
  }

  // Multi-select with checkboxes
  async multiSelect(message, choices) {
    return new Promise((resolve) => {
      const stdin = process.stdin;
      const stdout = process.stdout;
      
      let selectedIndex = 0;
      const selected = new Set();
      
      const render = () => {
        readline.moveCursor(stdout, 0, -(choices.length));
        
        choices.forEach((choice, index) => {
          readline.clearLine(stdout, 0);
          const isCursor = index === selectedIndex;
          const isChecked = selected.has(index);
          const prefix = isCursor ? chalk.cyan('❯') : ' ';
          const checkbox = isChecked ? chalk.cyan('◉') : chalk.gray('○');
          const text = isCursor 
            ? chalk.cyan(choice.name || choice) 
            : (isChecked ? chalk.white(choice.name || choice) : chalk.gray(choice.name || choice));
          console.log(`  ${prefix} ${checkbox} ${text}`);
        });
      };
      
      // Initial render
      console.log(`${chalk.cyan('?')} ${chalk.bold(message)} ${chalk.gray('(Space to select, Enter to confirm)')}`);
      choices.forEach((choice, index) => {
        const isCursor = index === selectedIndex;
        const isChecked = selected.has(index);
        const prefix = isCursor ? chalk.cyan('❯') : ' ';
        const checkbox = isChecked ? chalk.cyan('◉') : chalk.gray('○');
        const text = isCursor 
          ? chalk.cyan(choice.name || choice) 
          : chalk.gray(choice.name || choice);
        console.log(`  ${prefix} ${checkbox} ${text}`);
      });
      
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      
      const onKeypress = (key) => {
        // Arrow up
        if (key === '\u001b[A' || key === 'k') {
          selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : choices.length - 1;
          render();
        }
        // Arrow down
        else if (key === '\u001b[B' || key === 'j') {
          selectedIndex = selectedIndex < choices.length - 1 ? selectedIndex + 1 : 0;
          render();
        }
        // Space - toggle selection
        else if (key === ' ') {
          if (selected.has(selectedIndex)) {
            selected.delete(selectedIndex);
          } else {
            selected.add(selectedIndex);
          }
          render();
        }
        // Enter
        else if (key === '\r' || key === '\n') {
          stdin.setRawMode(false);
          stdin.removeListener('data', onKeypress);
          const result = Array.from(selected).map(i => {
            const choice = choices[i];
            return choice.value !== undefined ? choice.value : choice;
          });
          resolve(result);
        }
        // Ctrl+C
        else if (key === '\u0003') {
          stdin.setRawMode(false);
          process.exit();
        }
      };
      
      stdin.on('data', onKeypress);
    });
  }
}

const prompt = new InteractivePrompt();

class CreateApp {
  constructor() {
    this.templates = {
      default: {
        name: 'Default',
        description: 'A simple Veko.js project with EJS templates',
        dependencies: ['express', 'ejs', 'veko'],
        devDependencies: []
      },
      typescript: {
        name: 'TypeScript',
        description: 'Veko.js with TypeScript configured',
        dependencies: ['express', 'ejs', 'veko'],
        devDependencies: ['typescript', '@types/node', '@types/express', 'ts-node']
      },
      react: {
        name: 'React SSR',
        description: 'React with Server-Side Rendering',
        dependencies: ['express', 'veko', 'react', 'react-dom'],
        devDependencies: ['esbuild']
      },
      'react-typescript': {
        name: 'React + TypeScript',
        description: 'React SSR with TypeScript',
        dependencies: ['express', 'veko', 'react', 'react-dom'],
        devDependencies: ['typescript', '@types/node', '@types/react', '@types/react-dom', 'esbuild', 'ts-node']
      },
      api: {
        name: 'API Only',
        description: 'REST API without views',
        dependencies: ['express', 'veko', 'cors', 'helmet'],
        devDependencies: []
      },
      'api-typescript': {
        name: 'API + TypeScript',
        description: 'REST API with TypeScript',
        dependencies: ['express', 'veko', 'cors', 'helmet'],
        devDependencies: ['typescript', '@types/node', '@types/express', '@types/cors', 'ts-node']
      },
      full: {
        name: 'Full Featured',
        description: 'Complete project with auth, plugins, and more',
        dependencies: ['express', 'ejs', 'veko', 'bcryptjs', 'jsonwebtoken', 'express-session'],
        devDependencies: ['jest']
      },
      tailwind: {
        name: 'With Tailwind CSS',
        description: 'Veko.js with Tailwind CSS pre-configured',
        dependencies: ['express', 'ejs', 'veko'],
        devDependencies: ['tailwindcss', 'postcss', 'autoprefixer']
      },
      blog: {
        name: 'Blog Template',
        description: 'Markdown-based blog',
        dependencies: ['express', 'ejs', 'veko', 'marked', 'gray-matter'],
        devDependencies: []
      },
      ecommerce: {
        name: 'E-commerce',
        description: 'E-commerce starter with Stripe',
        dependencies: ['express', 'ejs', 'veko', 'stripe', 'express-session'],
        devDependencies: []
      },
      dashboard: {
        name: 'Admin Dashboard',
        description: 'Admin panel with charts',
        dependencies: ['express', 'ejs', 'veko', 'chart.js', 'express-session'],
        devDependencies: []
      },
      realtime: {
        name: 'Real-time App',
        description: 'WebSocket-based application',
        dependencies: ['express', 'ejs', 'veko', 'socket.io'],
        devDependencies: []
      }
    };
  }

  async run(projectName, options) {
    console.log();
    
    // Get project name if not provided
    if (!projectName) {
      projectName = await prompt.text('What is your project named?', 'my-veko-app');
    }
    
    const projectPath = path.resolve(process.cwd(), projectName);
    
    // Check if directory exists
    if (fs.existsSync(projectPath)) {
      const files = fs.readdirSync(projectPath);
      if (files.length > 0) {
        console.log(chalk.red(`  ✗ Directory ${chalk.bold(projectName)} is not empty.`));
        console.log();
        return;
      }
    }
    
    let config = {
      projectName,
      projectPath,
      template: 'default',
      typescript: false,
      tailwind: false,
      eslint: false,
      srcDir: false,
      react: false,
      api: false,
      packageManager: 'npm'
    };
    
    // Parse options
    if (options.typescript) config.typescript = true;
    if (options.tailwind) config.tailwind = true;
    if (options.eslint) config.eslint = true;
    if (options.srcDir) config.srcDir = true;
    if (options.react) config.react = true;
    if (options.api) config.api = true;
    if (options.useYarn) config.packageManager = 'yarn';
    if (options.usePnpm) config.packageManager = 'pnpm';
    
    // Determine template
    if (options.example) {
      config.template = options.example;
    } else if (!options.yes) {
      // Interactive mode
      config = await this.interactiveSetup(config);
    } else {
      // Build template from flags
      if (config.react && config.typescript) {
        config.template = 'react-typescript';
      } else if (config.react) {
        config.template = 'react';
      } else if (config.api && config.typescript) {
        config.template = 'api-typescript';
      } else if (config.api) {
        config.template = 'api';
      } else if (config.typescript) {
        config.template = 'typescript';
      } else if (config.tailwind) {
        config.template = 'tailwind';
      }
    }
    
    // Create project
    await this.createProject(config, options.skipInstall);
  }

  async interactiveSetup(config) {
    console.log();
    
    // TypeScript?
    config.typescript = await prompt.toggle(
      'Would you like to use ' + chalk.bold('TypeScript') + '?',
      false
    );
    
    // ESLint?
    config.eslint = await prompt.toggle(
      'Would you like to use ' + chalk.bold('ESLint') + '?',
      true
    );
    
    // Tailwind?
    config.tailwind = await prompt.toggle(
      'Would you like to use ' + chalk.bold('Tailwind CSS') + '?',
      false
    );
    
    // src/ directory?
    config.srcDir = await prompt.toggle(
      'Would you like to use ' + chalk.bold('`src/` directory') + '?',
      false
    );
    
    // Project type selection
    const projectType = await prompt.select(
      'What type of project would you like to create?',
      [
        { name: '🌐  Web App (EJS templates)', value: 'web' },
        { name: '⚛️   React SSR App', value: 'react' },
        { name: '🔌  API Only (REST)', value: 'api' },
        { name: '📝  Blog (Markdown)', value: 'blog' },
        { name: '🛒  E-commerce', value: 'ecommerce' },
        { name: '📊  Dashboard', value: 'dashboard' }
      ]
    );
    
    config.react = projectType === 'react';
    config.api = projectType === 'api';
    
    // Set template based on choices
    if (projectType === 'blog') {
      config.template = 'blog';
    } else if (projectType === 'ecommerce') {
      config.template = 'ecommerce';
    } else if (projectType === 'dashboard') {
      config.template = 'dashboard';
    } else if (config.react && config.typescript) {
      config.template = 'react-typescript';
    } else if (config.react) {
      config.template = 'react';
    } else if (config.api && config.typescript) {
      config.template = 'api-typescript';
    } else if (config.api) {
      config.template = 'api';
    } else if (config.typescript) {
      config.template = 'typescript';
    } else if (config.tailwind) {
      config.template = 'tailwind';
    }
    
    // Package manager
    config.packageManager = await prompt.select(
      'Which package manager would you like to use?',
      [
        { name: 'npm', value: 'npm' },
        { name: 'yarn', value: 'yarn' },
        { name: 'pnpm', value: 'pnpm' }
      ]
    );
    
    console.log();
    
    return config;
  }

  async createProject(config, skipInstall = false) {
    const { projectName, projectPath, template } = config;
    const templateConfig = this.templates[template] || this.templates.default;
    
    console.log(chalk.white(`  Creating a new Veko.js app in `) + chalk.green(projectPath));
    console.log();
    
    // Create directory
    fs.mkdirSync(projectPath, { recursive: true });
    
    // Determine structure
    const baseDir = config.srcDir ? path.join(projectPath, 'src') : projectPath;
    
    // Create directories
    const dirs = [
      'routes',
      'public',
      'public/css',
      'public/js',
      'public/images'
    ];
    
    if (!config.api) {
      dirs.push('views', 'views/layouts', 'views/partials');
    }
    
    if (config.react) {
      dirs.push('components', 'pages');
    }
    
    if (config.srcDir) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    
    dirs.forEach(dir => {
      fs.mkdirSync(path.join(baseDir, dir), { recursive: true });
    });
    
    // Generate files
    this.generatePackageJson(projectPath, config, templateConfig);
    this.generateMainFile(baseDir, config);
    this.generateConfig(projectPath, config);
    this.generateRoutes(baseDir, config);
    
    if (!config.api) {
      this.generateViews(baseDir, config);
    }
    
    if (config.react) {
      this.generateReactFiles(baseDir, config);
    }
    
    this.generatePublicFiles(baseDir, config);
    
    if (config.typescript) {
      this.generateTsConfig(projectPath);
    }
    
    if (config.eslint) {
      this.generateEslintConfig(projectPath, config);
    }
    
    if (config.tailwind) {
      this.generateTailwindConfig(projectPath);
    }
    
    this.generateGitignore(projectPath);
    this.generateReadme(projectPath, config);
    
    console.log(chalk.green('  ✓ ') + chalk.white('Created project structure'));
    
    // Install dependencies
    if (!skipInstall) {
      console.log();
      console.log(chalk.white('  Installing dependencies...'));
      console.log();
      
      try {
        const cmd = config.packageManager;
        const installCmd = cmd === 'yarn' ? 'yarn' : `${cmd} install`;
        
        execSync(installCmd, {
          cwd: projectPath,
          stdio: 'inherit'
        });
        
        console.log();
        console.log(chalk.green('  ✓ ') + chalk.white('Installed dependencies'));
      } catch (error) {
        console.log(chalk.yellow('  ⚠ ') + chalk.white('Failed to install dependencies'));
        console.log(chalk.gray(`    Run \`${config.packageManager} install\` manually`));
      }
    }
    
    // Success message
    console.log();
    console.log(chalk.green('  Success! ') + chalk.white(`Created ${projectName} at ${projectPath}`));
    console.log();
    console.log(chalk.white('  Inside that directory, you can run several commands:'));
    console.log();
    console.log(chalk.cyan('    ' + config.packageManager + (config.packageManager === 'npm' ? ' run ' : ' ') + 'dev'));
    console.log(chalk.gray('      Starts the development server.'));
    console.log();
    console.log(chalk.cyan('    ' + config.packageManager + (config.packageManager === 'npm' ? ' run ' : ' ') + 'build'));
    console.log(chalk.gray('      Builds the app for production.'));
    console.log();
    console.log(chalk.cyan('    ' + config.packageManager + (config.packageManager === 'npm' ? ' run ' : ' ') + 'start'));
    console.log(chalk.gray('      Runs the built app in production mode.'));
    console.log();
    console.log(chalk.white('  We suggest that you begin by typing:'));
    console.log();
    console.log(chalk.cyan(`    cd ${projectName}`));
    console.log(chalk.cyan('    ' + config.packageManager + (config.packageManager === 'npm' ? ' run ' : ' ') + 'dev'));
    console.log();
  }

  generatePackageJson(projectPath, config, templateConfig) {
    const ext = config.typescript ? 'ts' : 'js';
    const mainFile = config.srcDir ? `src/index.${ext}` : `index.${ext}`;
    
    const pkg = {
      name: config.projectName,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: config.typescript 
          ? 'ts-node-dev --respawn ' + mainFile
          : 'node ' + mainFile + ' --dev',
        build: 'veko build',
        start: config.typescript
          ? 'node dist/index.js'
          : 'node ' + mainFile,
        lint: config.eslint ? 'eslint . --ext .js,.jsx,.ts,.tsx' : undefined
      },
      dependencies: {},
      devDependencies: {}
    };
    
    // Remove undefined scripts
    Object.keys(pkg.scripts).forEach(key => {
      if (!pkg.scripts[key]) delete pkg.scripts[key];
    });
    
    // Add dependencies
    templateConfig.dependencies.forEach(dep => {
      pkg.dependencies[dep] = 'latest';
    });
    
    templateConfig.devDependencies.forEach(dep => {
      pkg.devDependencies[dep] = 'latest';
    });
    
    if (config.eslint) {
      pkg.devDependencies.eslint = 'latest';
      if (config.typescript) {
        pkg.devDependencies['@typescript-eslint/parser'] = 'latest';
        pkg.devDependencies['@typescript-eslint/eslint-plugin'] = 'latest';
      }
    }
    
    fs.writeFileSync(
      path.join(projectPath, 'package.json'),
      JSON.stringify(pkg, null, 2)
    );
  }

  generateMainFile(baseDir, config) {
    const ext = config.typescript ? 'ts' : 'js';
    let content;
    
    if (config.api) {
      content = config.typescript ? `
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello from Veko.js API!' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(port, () => {
  console.log(\`🚀 API running at http://localhost:\${port}\`);
});
`.trim() : `
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Veko.js API!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(port, () => {
  console.log(\`🚀 API running at http://localhost:\${port}\`);
});
`.trim();
    } else if (config.react) {
      content = config.typescript ? `
import { createReactApp } from 'veko';

const app = createReactApp({
  port: 3000,
  mode: 'hybrid'
});

// React routes are in /pages
app.start().then(() => {
  console.log('🚀 Server running at http://localhost:3000');
});
`.trim() : `
const { createReactApp } = require('veko');

const app = createReactApp({
  port: 3000,
  mode: 'hybrid'
});

// React routes are in /pages
app.start().then(() => {
  console.log('🚀 Server running at http://localhost:3000');
});
`.trim();
    } else {
      content = config.typescript ? `
import { createApp } from 'veko';
import path from 'path';

const app = createApp({
  port: 3000,
  viewEngine: 'ejs',
  viewsDir: path.join(__dirname, 'views'),
  publicDir: path.join(__dirname, 'public')
});

// Routes
app.createRoute('GET', '/', (req, res) => {
  res.render('index', { 
    title: 'Welcome to Veko.js',
    message: 'Your app is running!'
  });
});

app.createRoute('GET', '/about', (req, res) => {
  res.render('about', { title: 'About' });
});

app.start().then(() => {
  console.log('🚀 Server running at http://localhost:3000');
});
`.trim() : `
const { createApp } = require('veko');
const path = require('path');

const app = createApp({
  port: 3000,
  viewEngine: 'ejs',
  viewsDir: path.join(__dirname, 'views'),
  publicDir: path.join(__dirname, 'public')
});

// Routes
app.createRoute('GET', '/', (req, res) => {
  res.render('index', { 
    title: 'Welcome to Veko.js',
    message: 'Your app is running!'
  });
});

app.createRoute('GET', '/about', (req, res) => {
  res.render('about', { title: 'About' });
});

app.start().then(() => {
  console.log('🚀 Server running at http://localhost:3000');
});
`.trim();
    }
    
    fs.writeFileSync(path.join(baseDir, `index.${ext}`), content);
  }

  generateConfig(projectPath, config) {
    const content = `
/** @type {import('veko').VekoConfig} */
module.exports = {
  // Server configuration
  port: 3000,
  host: 'localhost',
  
  // Environment
  env: process.env.NODE_ENV || 'development',
  
  // Views
  viewEngine: '${config.api ? 'none' : 'ejs'}',
  
  // Features
  features: {
    typescript: ${config.typescript},
    react: ${config.react},
    tailwind: ${config.tailwind}
  },
  
  // Development
  dev: {
    hotReload: true,
    openBrowser: false
  }
};
`.trim();
    
    fs.writeFileSync(path.join(projectPath, 'veko.config.js'), content);
  }

  generateRoutes(baseDir, config) {
    const ext = config.typescript ? 'ts' : 'js';
    
    if (config.api) {
      const content = config.typescript ? `
import { Router } from 'express';

const router = Router();

router.get('/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Doe', email: 'jane@example.com' }
  ]);
});

router.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ id: parseInt(id), name: 'John Doe', email: 'john@example.com' });
});

router.post('/users', (req, res) => {
  const { name, email } = req.body;
  res.status(201).json({ id: 3, name, email });
});

export default router;
`.trim() : `
const { Router } = require('express');

const router = Router();

router.get('/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Doe', email: 'jane@example.com' }
  ]);
});

router.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ id: parseInt(id), name: 'John Doe', email: 'john@example.com' });
});

router.post('/users', (req, res) => {
  const { name, email } = req.body;
  res.status(201).json({ id: 3, name, email });
});

module.exports = router;
`.trim();
      
      fs.writeFileSync(path.join(baseDir, 'routes', `api.${ext}`), content);
    }
  }

  generateViews(baseDir, config) {
    // Layout
    const layoutHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %> | Veko.js</title>
    ${config.tailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : '<link rel="stylesheet" href="/css/style.css">'}
</head>
<body${config.tailwind ? ' class="bg-gray-50 min-h-screen"' : ''}>
    <%- include('../partials/header') %>
    <main${config.tailwind ? ' class="container mx-auto px-4 py-8"' : ''}>
        <%- body %>
    </main>
    <%- include('../partials/footer') %>
    <script src="/js/main.js"></script>
</body>
</html>
`.trim();
    
    fs.writeFileSync(path.join(baseDir, 'views', 'layouts', 'main.ejs'), layoutHtml);
    
    // Header partial
    const headerHtml = config.tailwind ? `
<header class="bg-white shadow-sm">
    <nav class="container mx-auto px-4 py-4 flex justify-between items-center">
        <a href="/" class="text-xl font-bold text-indigo-600">Veko.js</a>
        <div class="flex gap-6">
            <a href="/" class="text-gray-600 hover:text-indigo-600 transition">Home</a>
            <a href="/about" class="text-gray-600 hover:text-indigo-600 transition">About</a>
        </div>
    </nav>
</header>
`.trim() : `
<header>
    <nav>
        <a href="/" class="logo">Veko.js</a>
        <div class="nav-links">
            <a href="/">Home</a>
            <a href="/about">About</a>
        </div>
    </nav>
</header>
`.trim();
    
    fs.writeFileSync(path.join(baseDir, 'views', 'partials', 'header.ejs'), headerHtml);
    
    // Footer partial
    const footerHtml = config.tailwind ? `
<footer class="bg-gray-100 mt-auto py-6">
    <div class="container mx-auto px-4 text-center text-gray-500 text-sm">
        <p>Built with <span class="text-indigo-600">Veko.js</span> &copy; ${new Date().getFullYear()}</p>
    </div>
</footer>
`.trim() : `
<footer>
    <p>Built with <span class="highlight">Veko.js</span> &copy; ${new Date().getFullYear()}</p>
</footer>
`.trim();
    
    fs.writeFileSync(path.join(baseDir, 'views', 'partials', 'footer.ejs'), footerHtml);
    
    // Index page
    const indexHtml = config.tailwind ? `
<div class="text-center py-16">
    <h1 class="text-5xl font-bold text-gray-900 mb-4">
        Welcome to <span class="text-indigo-600">Veko.js</span>
    </h1>
    <p class="text-xl text-gray-600 mb-8"><%= message %></p>
    
    <div class="flex justify-center gap-4">
        <a href="/about" class="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
            Learn More
        </a>
        <a href="https://github.com/wiltark/veko.js" target="_blank" 
           class="px-6 py-3 border border-gray-300 rounded-lg hover:border-indigo-600 transition">
            GitHub
        </a>
    </div>
    
    <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        <div class="p-6 bg-white rounded-xl shadow-sm">
            <div class="text-3xl mb-4">⚡</div>
            <h3 class="font-semibold text-lg mb-2">Fast</h3>
            <p class="text-gray-500">Hot reload and optimized builds</p>
        </div>
        <div class="p-6 bg-white rounded-xl shadow-sm">
            <div class="text-3xl mb-4">🔒</div>
            <h3 class="font-semibold text-lg mb-2">Secure</h3>
            <p class="text-gray-500">Built-in security features</p>
        </div>
        <div class="p-6 bg-white rounded-xl shadow-sm">
            <div class="text-3xl mb-4">🧩</div>
            <h3 class="font-semibold text-lg mb-2">Extensible</h3>
            <p class="text-gray-500">Plugin system for any feature</p>
        </div>
    </div>
</div>
`.trim() : `
<div class="hero">
    <h1>Welcome to <span class="highlight">Veko.js</span></h1>
    <p class="subtitle"><%= message %></p>
    
    <div class="buttons">
        <a href="/about" class="btn btn-primary">Learn More</a>
        <a href="https://github.com/wiltark/veko.js" target="_blank" class="btn btn-secondary">GitHub</a>
    </div>
    
    <div class="features">
        <div class="feature">
            <span class="icon">⚡</span>
            <h3>Fast</h3>
            <p>Hot reload and optimized builds</p>
        </div>
        <div class="feature">
            <span class="icon">🔒</span>
            <h3>Secure</h3>
            <p>Built-in security features</p>
        </div>
        <div class="feature">
            <span class="icon">🧩</span>
            <h3>Extensible</h3>
            <p>Plugin system for any feature</p>
        </div>
    </div>
</div>
`.trim();
    
    fs.writeFileSync(path.join(baseDir, 'views', 'index.ejs'), indexHtml);
    
    // About page
    const aboutHtml = config.tailwind ? `
<div class="max-w-2xl mx-auto">
    <h1 class="text-4xl font-bold text-gray-900 mb-6">About</h1>
    <p class="text-gray-600 mb-4">
        Veko.js is a modern Node.js framework designed for building fast, secure, and scalable web applications.
    </p>
    <p class="text-gray-600 mb-4">
        With features like hot reload, React SSR support, authentication, and a powerful plugin system, 
        Veko.js makes it easy to build production-ready applications.
    </p>
    <a href="/" class="text-indigo-600 hover:underline">&larr; Back to Home</a>
</div>
`.trim() : `
<div class="content">
    <h1>About</h1>
    <p>
        Veko.js is a modern Node.js framework designed for building fast, secure, and scalable web applications.
    </p>
    <p>
        With features like hot reload, React SSR support, authentication, and a powerful plugin system, 
        Veko.js makes it easy to build production-ready applications.
    </p>
    <a href="/">&larr; Back to Home</a>
</div>
`.trim();
    
    fs.writeFileSync(path.join(baseDir, 'views', 'about.ejs'), aboutHtml);
  }

  generateReactFiles(baseDir, config) {
    const ext = config.typescript ? 'tsx' : 'jsx';
    
    // App component
    const appContent = config.typescript ? `
import React from 'react';

interface AppProps {
  children: React.ReactNode;
}

export default function App({ children }: AppProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Veko.js + React</title>
        ${config.tailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : '<link rel="stylesheet" href="/css/style.css" />'}
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
`.trim() : `
import React from 'react';

export default function App({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Veko.js + React</title>
        ${config.tailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : '<link rel="stylesheet" href="/css/style.css" />'}
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
`.trim();
    
    fs.writeFileSync(path.join(baseDir, 'components', `App.${ext}`), appContent);
    
    // Home page
    const homeContent = config.typescript ? `
import React, { useState } from 'react';

export default function Home() {
  const [count, setCount] = useState<number>(0);
  
  return (
    <div className="${config.tailwind ? 'min-h-screen flex flex-col items-center justify-center bg-gray-50' : 'container'}">
      <h1 className="${config.tailwind ? 'text-5xl font-bold text-gray-900 mb-4' : 'title'}">
        Welcome to <span className="${config.tailwind ? 'text-indigo-600' : 'highlight'}">Veko.js</span> + React
      </h1>
      
      <p className="${config.tailwind ? 'text-xl text-gray-600 mb-8' : 'subtitle'}">
        Server-Side Rendered React Application
      </p>
      
      <div className="${config.tailwind ? 'flex gap-4 items-center' : 'counter'}">
        <button 
          onClick={() => setCount(c => c - 1)}
          className="${config.tailwind ? 'px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300' : 'btn'}"
        >
          -
        </button>
        <span className="${config.tailwind ? 'text-2xl font-bold w-16 text-center' : 'count'}">{count}</span>
        <button 
          onClick={() => setCount(c => c + 1)}
          className="${config.tailwind ? 'px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700' : 'btn btn-primary'}"
        >
          +
        </button>
      </div>
    </div>
  );
}
`.trim() : `
import React, { useState } from 'react';

export default function Home() {
  const [count, setCount] = useState(0);
  
  return (
    <div className="${config.tailwind ? 'min-h-screen flex flex-col items-center justify-center bg-gray-50' : 'container'}">
      <h1 className="${config.tailwind ? 'text-5xl font-bold text-gray-900 mb-4' : 'title'}">
        Welcome to <span className="${config.tailwind ? 'text-indigo-600' : 'highlight'}">Veko.js</span> + React
      </h1>
      
      <p className="${config.tailwind ? 'text-xl text-gray-600 mb-8' : 'subtitle'}">
        Server-Side Rendered React Application
      </p>
      
      <div className="${config.tailwind ? 'flex gap-4 items-center' : 'counter'}">
        <button 
          onClick={() => setCount(c => c - 1)}
          className="${config.tailwind ? 'px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300' : 'btn'}"
        >
          -
        </button>
        <span className="${config.tailwind ? 'text-2xl font-bold w-16 text-center' : 'count'}">{count}</span>
        <button 
          onClick={() => setCount(c => c + 1)}
          className="${config.tailwind ? 'px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700' : 'btn btn-primary'}"
        >
          +
        </button>
      </div>
    </div>
  );
}
`.trim();
    
    fs.writeFileSync(path.join(baseDir, 'pages', `index.${ext}`), homeContent);
  }

  generatePublicFiles(baseDir, config) {
    // CSS
    const css = config.tailwind ? `/* Tailwind is loaded via CDN */
@tailwind base;
@tailwind components;
@tailwind utilities;
` : `
/* Veko.js Default Styles */
:root {
  --primary: #4f46e5;
  --primary-hover: #4338ca;
  --text: #1f2937;
  --text-light: #6b7280;
  --bg: #f9fafb;
  --white: #ffffff;
  --border: #e5e7eb;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
header {
  background: var(--white);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

header nav {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-links a {
  color: var(--text-light);
  text-decoration: none;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--primary);
}

/* Main */
main {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 4rem 2rem;
  width: 100%;
}

/* Hero */
.hero {
  text-align: center;
  padding: 4rem 0;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.highlight {
  color: var(--primary);
}

.subtitle {
  font-size: 1.25rem;
  color: var(--text-light);
  margin-bottom: 2rem;
}

/* Buttons */
.buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 4rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
  font-size: 1rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.btn-secondary:hover {
  border-color: var(--primary);
}

/* Features */
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-top: 4rem;
}

.feature {
  background: var(--white);
  padding: 2rem;
  border-radius: 1rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.feature .icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 1rem;
}

.feature h3 {
  margin-bottom: 0.5rem;
}

.feature p {
  color: var(--text-light);
  font-size: 0.9rem;
}

/* Content */
.content {
  max-width: 600px;
  margin: 0 auto;
}

.content h1 {
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
}

.content p {
  margin-bottom: 1rem;
  line-height: 1.7;
  color: var(--text-light);
}

.content a {
  color: var(--primary);
  text-decoration: none;
}

.content a:hover {
  text-decoration: underline;
}

/* Footer */
footer {
  background: var(--white);
  padding: 2rem;
  text-align: center;
  color: var(--text-light);
  margin-top: auto;
}

/* Counter (React) */
.counter {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
}

.count {
  font-size: 2rem;
  font-weight: bold;
  width: 4rem;
  text-align: center;
}
`.trim();
    
    fs.writeFileSync(path.join(baseDir, 'public', 'css', 'style.css'), css);
    
    // JS
    const js = `
// Veko.js Client-Side JavaScript
console.log('🚀 Veko.js app loaded');

// Add your client-side code here
`.trim();
    
    fs.writeFileSync(path.join(baseDir, 'public', 'js', 'main.js'), js);
  }

  generateTsConfig(projectPath) {
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020', 'DOM'],
        outDir: './dist',
        rootDir: './',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        jsx: 'react-jsx'
      },
      include: ['**/*.ts', '**/*.tsx'],
      exclude: ['node_modules', 'dist']
    };
    
    fs.writeFileSync(
      path.join(projectPath, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );
  }

  generateEslintConfig(projectPath, config) {
    const eslintConfig = {
      env: {
        browser: true,
        es2021: true,
        node: true
      },
      extends: [
        'eslint:recommended',
        ...(config.typescript ? ['plugin:@typescript-eslint/recommended'] : []),
        ...(config.react ? ['plugin:react/recommended', 'plugin:react-hooks/recommended'] : [])
      ],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ...(config.react ? { ecmaFeatures: { jsx: true } } : {})
      },
      ...(config.typescript ? { parser: '@typescript-eslint/parser' } : {}),
      plugins: [
        ...(config.typescript ? ['@typescript-eslint'] : []),
        ...(config.react ? ['react', 'react-hooks'] : [])
      ],
      rules: {
        'no-console': 'warn',
        'no-unused-vars': 'warn'
      },
      ...(config.react ? { settings: { react: { version: 'detect' } } } : {})
    };
    
    fs.writeFileSync(
      path.join(projectPath, '.eslintrc.json'),
      JSON.stringify(eslintConfig, null, 2)
    );
  }

  generateTailwindConfig(projectPath) {
    const content = `
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.ejs',
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca'
        }
      }
    }
  },
  plugins: []
};
`.trim();
    
    fs.writeFileSync(path.join(projectPath, 'tailwind.config.js'), content);
    
    // PostCSS config
    const postcss = `
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
`.trim();
    
    fs.writeFileSync(path.join(projectPath, 'postcss.config.js'), postcss);
  }

  generateGitignore(projectPath) {
    const content = `
# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.veko/

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*

# IDE
.idea/
.vscode/
*.swp
*.swo
.DS_Store

# Testing
coverage/

# Misc
*.tgz
.cache/
`.trim();
    
    fs.writeFileSync(path.join(projectPath, '.gitignore'), content);
  }

  generateReadme(projectPath, config) {
    const content = `
# ${config.projectName}

A [Veko.js](https://github.com/wiltark/veko.js) project.

## Getting Started

First, run the development server:

\`\`\`bash
npm run dev
# or
yarn dev
# or
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

\`\`\`
${config.projectName}/
├── ${config.srcDir ? 'src/' : ''}
│   ├── ${config.api ? 'routes/' : 'views/'}
│   ├── public/
│   │   ├── css/
│   │   └── js/
│   └── index.${config.typescript ? 'ts' : 'js'}
├── package.json
├── veko.config.js
${config.typescript ? '├── tsconfig.json\n' : ''}${config.eslint ? '├── .eslintrc.json\n' : ''}${config.tailwind ? '├── tailwind.config.js\n' : ''}└── README.md
\`\`\`

## Learn More

- [Veko.js Documentation](https://github.com/wiltark/veko.js)
${config.react ? '- [React Documentation](https://react.dev)\n' : ''}${config.typescript ? '- [TypeScript Documentation](https://www.typescriptlang.org/docs)\n' : ''}${config.tailwind ? '- [Tailwind CSS Documentation](https://tailwindcss.com/docs)\n' : ''}

## Deploy

Deploy your Veko.js app with your preferred hosting provider.
`.trim();
    
    fs.writeFileSync(path.join(projectPath, 'README.md'), content);
  }
}

module.exports = CreateApp;
