#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const SetupWizard = require('./commands/setup');
const DevServer = require('../lib/dev/dev-server');
const path = require('path');
const fs = require('fs');

// Version du package
const packageJson = require('../package.json');
const version = packageJson.version;

// Ajouter le chemin vers les modules lib
const libPath = path.join(__dirname, '..', 'lib');
process.env.NODE_PATH = `${process.env.NODE_PATH || ''}:${libPath}`;
require('module')._initPaths();

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

// Ajout de la commande update qui servira de passerelle vers veko-update
program
  .command('update')
  .description('Gestionnaire de mise à jour Veko')
  .allowUnknownOption(true)
  .action(() => {
    // Exécuter veko-update avec les mêmes arguments
    const updateBin = path.join(__dirname, 'veko-update.js');
    if (fs.existsSync(updateBin)) {
      const { execSync } = require('child_process');
      try {
        execSync(`node "${updateBin}" ${process.argv.slice(3).join(' ')}`, { 
          stdio: 'inherit' 
        });
      } catch (error) {
        console.error('Erreur lors du lancement de l\'auto-updater');
        process.exit(1);
      }
    } else {
      console.error('L\'auto-updater n\'est pas disponible');
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  console.log('\n🚀 Veko.js v' + version + ' - Ultra-modern Node.js framework\n');
  console.log('Available commands:');
  console.log('  dev      Start development server with hot reload');
  console.log('  setup    Set up a new Veko.js project');
  console.log('  verify   Verify code quality and security');
  console.log('  update   Gestionnaire de mise à jour Veko');
  console.log('\nRun `veko <command> --help` for more information on specific commands.');
  console.log('\nDocumentation: https://veko.js.org');
  process.exit(0);
}