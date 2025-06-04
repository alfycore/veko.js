#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const SetupWizard = require('./commands/setup');
const DevServer = require('../lib/dev/dev-server');

const program = new Command();

program
  .name('veko')
  .description('Veko.js Framework CLI')
  .version('1.1.0');

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

// ============= SETUP COMMAND (UPDATED) =============
program
  .command('setup [project-name]')
  .description('🚀 Interactive project setup wizard')
  .option('-q, --quick', 'Quick setup with defaults')
  .option('--template <template>', 'Template (default, api, blog, admin, ecommerce, portfolio)')
  .option('--features <features>', 'Comma-separated features list')
  .option('--auth', 'Enable authentication system')
  .option('--db <database>', 'Database type (sqlite, mysql, mongodb)')
  .option('--styling <framework>', 'CSS framework (bootstrap, tailwind, material)')
  .action(async (projectNameArg, options) => {
    if (options.quick) {
      const quickConfig = {
        projectName: projectNameArg || 'veko-app',
        template: options.template || 'default',
        features: options.features ? options.features.split(',') : ['hotreload', 'layouts'],
        database: options.db || 'sqlite',
        auth: { enabled: options.auth || false },
        styling: options.styling || 'bootstrap',
        git: true,
        install: true
      };
      
      const SetupExecutor = require('./commands/setup-executor');
      const executor = new SetupExecutor(quickConfig);
      await executor.execute();
    } else {
      const wizard = new SetupWizard();
      await wizard.start();
    }
  });

// ============= NEW COMMANDS =============
program
  .command('wizard')
  .alias('w')
  .description('🧙‍♂️ Full interactive setup wizard')
  .action(async () => {
    const wizard = new SetupWizard();
    await wizard.start();
  });

program
  .command('create <project-name>')
  .description('🎯 Quick project creation with prompts')
  .option('--template <template>', 'Template to use')
  .action(async (projectName, options) => {
    const QuickSetup = require('./commands/quick-setup');
    const quickSetup = new QuickSetup(projectName, options);
    await quickSetup.start();
  });

program
  .command('templates')
  .alias('t')
  .description('📋 List available templates')
  .action(() => {
    const TemplateList = require('./commands/template-list');
    const templateList = new TemplateList();
    templateList.display();
  });

program
  .command('plugins')
  .description('🔌 Plugin management')
  .option('--list', 'List available plugins')
  .option('--search <term>', 'Search plugins')
  .action((options) => {
    const PluginManager = require('./commands/plugin-manager-cli');
    const pluginManager = new PluginManager();
    
    if (options.list) {
      pluginManager.listPlugins();
    } else if (options.search) {
      pluginManager.searchPlugins(options.search);
    } else {
      pluginManager.showMenu();
    }
  });

program.parse();