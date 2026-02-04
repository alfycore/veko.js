/**
 * Create Veko App
 * Interactive project creator inspired by create-next-app
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync, spawn } = require('child_process');

// Import template generators
const templates = require('../templates/index');
const TemplateGenerator = require('../templates/generator');
const ViewGenerator = require('../templates/views');
const StaticGenerator = require('../templates/static');
const ConfigGenerator = require('../templates/config');
const ReactGenerator = require('../templates/react');

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
    
    console.log(chalk.white(`  Creating a new Veko.js app in `) + chalk.green(projectPath));
    console.log();
    
    // Create project directory
    fs.mkdirSync(projectPath, { recursive: true });
    
    // Create src directory if needed
    if (config.srcDir) {
      fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
    }
    
    // Generate all files using new template system
    console.log(chalk.gray('  Generating project files...'));
    
    try {
      // Generate config files (package.json, .env, .gitignore, etc.)
      const configGen = new ConfigGenerator(config);
      configGen.generate();
      console.log(chalk.green('  ✓ ') + chalk.white('Generated configuration files'));
      
      // Generate main entry file and routes
      const templateGen = new TemplateGenerator(config);
      templateGen.generateMainFile();
      templateGen.generateRoutes();
      console.log(chalk.green('  ✓ ') + chalk.white('Generated server files'));
      
      // Generate views (EJS templates)
      if (!config.api && template !== 'api' && template !== 'api-typescript') {
        const viewGen = new ViewGenerator(config);
        viewGen.generate();
        console.log(chalk.green('  ✓ ') + chalk.white('Generated view templates'));
      }
      
      // Generate React files if applicable
      const reactGen = new ReactGenerator(config);
      reactGen.generate();
      if (config.react || template === 'react' || template === 'react-typescript') {
        console.log(chalk.green('  ✓ ') + chalk.white('Generated React components'));
      }
      
      // Generate static assets (CSS, JS)
      const staticGen = new StaticGenerator(config);
      staticGen.generate();
      console.log(chalk.green('  ✓ ') + chalk.white('Generated static assets'));
      
    } catch (error) {
      console.log(chalk.red('  ✗ ') + chalk.white('Error generating files: ' + error.message));
      console.log(chalk.gray('    ' + error.stack));
    }
    
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
}

module.exports = CreateApp;
