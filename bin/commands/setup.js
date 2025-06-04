const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const boxen = require('boxen');
const figlet = require('figlet');
const gradient = require('gradient-string');
const { createSpinner } = require('nanospinner');
const path = require('path');  
const fs = require('fs').promises;

/**
 * Assistant de configuration interactif pour les projets Veko.js
 * Fournit une interface utilisateur complète pour la création de projets
 */
class SetupWizard {
  constructor() {
    this.config = {
      projectName: '',
      template: 'default',
      features: [],
      database: 'sqlite',
      auth: { enabled: false },
      plugins: [],
      styling: 'bootstrap',
      theme: 'light',
      git: true,
      install: true,
      description: '',
      author: '',
      license: 'MIT',
      scripts: true,
      docker: false,
      env: true
    };
    
    // Configuration de sécurité
    this.securityConfig = {
      maxProjectNameLength: 50,
      maxDescriptionLength: 200,
      maxAuthorLength: 100,
      allowedFileNameChars: /^[a-zA-Z0-9\-_]+$/,
      maxFeatures: 20,
      maxPlugins: 15
    };
    
    // Templates prédéfinis
    this.templates = new Map([
      ['default', {
        name: '🌟 Default - Full-featured web application',
        description: 'Complete web application with all features',
        files: ['views/', 'routes/', 'public/', 'plugins/', 'middleware/', 'app.js']
      }],
      ['api', {
        name: '🔌 API Only - REST API server',
        description: 'RESTful API server with authentication',
        files: ['routes/api/', 'middleware/', 'models/', 'tests/', 'server.js']
      }],
      ['blog', {
        name: '📝 Blog - Content management system',
        description: 'Blog engine with admin interface',
        files: ['views/blog/', 'content/posts/', 'admin/', 'uploads/', 'blog.js']
      }],
      ['admin', {
        name: '👑 Admin Dashboard - Management interface',
        description: 'Administrative dashboard and management tools',
        files: ['admin/views/', 'dashboard/', 'auth/', 'api/admin/', 'admin.js']
      }],
      ['ecommerce', {
        name: '🛍️ E-commerce - Online store',
        description: 'Complete e-commerce solution',
        files: ['shop/views/', 'products/', 'orders/', 'payments/', 'store.js']
      }],
      ['portfolio', {
        name: '🎭 Portfolio - Personal showcase',
        description: 'Personal portfolio and project showcase',
        files: ['portfolio/views/', 'projects/', 'gallery/', 'blog/', 'portfolio.js']
      }],
      ['pwa', {
        name: '📱 PWA - Progressive Web App',
        description: 'Progressive Web Application with offline support',
        files: ['pwa/', 'sw/', 'manifest/', 'offline/', 'pwa.js']
      }]
    ]);
  }

  /**
   * Point d'entrée principal du wizard
   */
  async start() {
    try {
      console.clear();
      await this.showWelcome();
      await this.gatherProjectInfo();
      await this.selectTemplate();
      await this.selectFeatures();
      await this.configureDatabase();
      await this.configureAuth();
      await this.selectPlugins();
      await this.selectStyling();
      await this.finalOptions();
      await this.confirmOptions();
      await this.executeSetup();
      await this.showCompletion();
    } catch (error) {
      await this.handleError(error);
    }
  }

  /**
   * Affichage de l'écran d'accueil avec titre stylisé
   */
  async showWelcome() {
    try {
      const title = figlet.textSync('VEKO.JS', {
        font: 'ANSI Shadow',
        horizontalLayout: 'fitted'
      });

      console.log(gradient.rainbow(title));
    } catch (error) {
      // Fallback si figlet échoue
      console.log(chalk.cyan.bold('╔══════════════════════════════════╗'));
      console.log(chalk.cyan.bold('║            VEKO.JS               ║'));
      console.log(chalk.cyan.bold('╚══════════════════════════════════╝'));
    }

    console.log(chalk.cyan.bold('\n✨ Interactive Project Setup Wizard ✨\n'));
    
    const welcomeBox = boxen(
      chalk.white('🎉 Welcome to Veko.js Setup Wizard!\n\n') +
      chalk.gray('This wizard will guide you through creating a new\n') +
      chalk.gray('Veko.js project with all the features you need.\n\n') +
      chalk.blue('✓ Templates & Examples\n') +
      chalk.blue('✓ Authentication System\n') +
      chalk.blue('✓ Database Integration\n') +
      chalk.blue('✓ Plugin Ecosystem\n') +
      chalk.blue('✓ Beautiful UI Frameworks'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'cyan',
        textAlignment: 'center'
      }
    );

    console.log(welcomeBox);

    const { ready } = await inquirer.prompt([{
      type: 'confirm',  
      name: 'ready',
      message: '🚀 Ready to create something amazing?',
      default: true
    }]);

    if (!ready) {
      console.log(chalk.yellow('\n👋 See you later! Happy coding!'));
      process.exit(0);
    }
  }

  /**
   * Collecte des informations de base du projet
   */
  async gatherProjectInfo() {
    console.log(chalk.blue.bold('\n📝 Project Information\n'));

    const questions = [
      {
        type: 'input',
        name: 'projectName',
        message: '📁 What\'s your project name?',
        default: 'my-veko-app',
        validate: (input) => this.validateProjectName(input)
      },
      {
        type: 'input', 
        name: 'description',
        message: '📄 Project description:',
        default: 'A modern web application built with Veko.js',
        validate: (input) => this.validateDescription(input)
      },
      {
        type: 'input',
        name: 'author',
        message: '👤 Author name:',
        default: process.env.USER || process.env.USERNAME || '',
        validate: (input) => this.validateAuthor(input)
      },
      {
        type: 'list',
        name: 'license',
        message: '📜 Choose a license:',
        choices: [
          { name: '📋 MIT - Most permissive', value: 'MIT' },
          { name: '🔒 ISC - Simple and permissive', value: 'ISC' },
          { name: '⚖️ Apache-2.0 - Patent protection', value: 'Apache-2.0' },
          { name: '🆓 GPL-3.0 - Copyleft', value: 'GPL-3.0' },
          { name: '🚫 Unlicense - Public domain', value: 'Unlicense' }
        ],
        default: 'MIT'
      }
    ];

    const answers = await inquirer.prompt(questions);
    Object.assign(this.config, this.sanitizeProjectInfo(answers));
  }

  /**
   * Sélection du template de projet
   */
  async selectTemplate() {
    console.log(chalk.blue.bold('\n🎨 Choose Your Template\n'));

    const templateChoices = Array.from(this.templates.entries()).map(([value, template]) => ({
      name: template.name,
      value
    }));

    const { template } = await inquirer.prompt([{
      type: 'list',
      name: 'template',
      message: '🎯 Select a template:',
      choices: templateChoices,
      pageSize: 10
    }]);

    this.config.template = template;
    this.showTemplatePreview(template);
  }

  /**
   * Affichage de l'aperçu du template sélectionné
   */
  showTemplatePreview(templateName) {
    const template = this.templates.get(templateName);
    if (!template) return;

    const preview = template.files.map(file => `📁 ${file}`).join('\n');
    
    const previewBox = boxen(
      chalk.cyan('📋 Template Structure:\n\n') + 
      chalk.gray(preview) + '\n\n' +
      chalk.blue('Description: ') + chalk.white(template.description),
      {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'blue',
        title: '📦 Project Structure',
        titleAlignment: 'center'
      }
    );

    console.log(previewBox);
  }

  /**
   * Sélection des fonctionnalités
   */
  async selectFeatures() {
    console.log(chalk.blue.bold('\n⚡ Select Features & Add-ons\n'));

    const featureChoices = [
      { name: '🔥 Hot Reload Development Server', value: 'hotreload', checked: true },
      { name: '📱 Progressive Web App (PWA)', value: 'pwa' },
      { name: '🎨 Advanced Layout System', value: 'layouts', checked: true },
      { name: '🔍 SEO Optimization', value: 'seo' },
      { name: '📊 Analytics Integration', value: 'analytics' },
      { name: '💬 Real-time WebSocket Support', value: 'websocket' },
      { name: '📧 Email System (Nodemailer)', value: 'email' },
      { name: '🔒 Rate Limiting & Security', value: 'security' },
      { name: '📁 File Upload System', value: 'upload' },
      { name: '🌐 Multi-language (i18n)', value: 'i18n' },
      { name: '📋 Form Validation', value: 'validation' },
      { name: '🎭 Component System', value: 'components' },
      { name: '🗜️ Image Processing', value: 'imageprocessing' },
      { name: '🔄 Backup System', value: 'backup' }
    ];

    const { features } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'features',
      message: '🎁 Which features would you like to include?',
      choices: featureChoices,
      pageSize: 15,
      validate: (input) => this.validateFeatures(input)
    }]);

    this.config.features = features;
  }

  /**
   * Configuration de la base de données
   */
  async configureDatabase() {
    const dbRequiredTemplates = ['api', 'blog', 'admin', 'ecommerce'];
    
    if (dbRequiredTemplates.includes(this.config.template)) {
      console.log(chalk.blue.bold('\n🗄️ Database Configuration\n'));

      const databaseChoices = [
        { name: '📄 SQLite - File-based (recommended for dev)', value: 'sqlite' },
        { name: '🐘 PostgreSQL - Advanced relational database', value: 'postgresql' },
        { name: '🐬 MySQL - Popular relational database', value: 'mysql' },
        { name: '🍃 MongoDB - Document database', value: 'mongodb' },
        { name: '⚡ Redis - In-memory cache/database', value: 'redis' },
        { name: '🚫 None - No database', value: 'none' }
      ];

      const { database } = await inquirer.prompt([{
        type: 'list',
        name: 'database',
        message: '💾 Choose your database:',
        choices: databaseChoices
      }]);

      this.config.database = database;
    }
  }

  /**
   * Configuration du système d'authentification
   */
  async configureAuth() {
    const authRequiredTemplates = ['default', 'blog', 'admin', 'ecommerce'];
    
    if (authRequiredTemplates.includes(this.config.template)) {
      console.log(chalk.blue.bold('\n🔐 Authentication System\n'));

      const { enableAuth } = await inquirer.prompt([{
        type: 'confirm',
        name: 'enableAuth',
        message: '🔑 Enable authentication system?',
        default: ['admin', 'ecommerce'].includes(this.config.template)
      }]);

      if (enableAuth) {
        const authConfig = await this.configureAuthDetails();
        this.config.auth = { enabled: true, ...authConfig };
      } else {
        this.config.auth = { enabled: false };
      }
    }
  }

  /**
   * Configuration détaillée de l'authentification
   */
  async configureAuthDetails() {
    return await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'methods',
        message: '🚪 Authentication methods:',
        choices: [
          { name: '📧 Email/Password (Local)', value: 'local', checked: true },
          { name: '🌐 Google OAuth', value: 'google' },
          { name: '📘 Facebook OAuth', value: 'facebook' },
          { name: '🐙 GitHub OAuth', value: 'github' },
          { name: '💼 LinkedIn OAuth', value: 'linkedin' },
          { name: '🔗 JWT Tokens', value: 'jwt' }
        ],
        validate: (input) => input.length > 0 || 'At least one method is required'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: '🛡️ Authentication features:',
        choices: [
          { name: '👤 User profiles', value: 'profiles', checked: true },
          { name: '👑 Role-based access control', value: 'roles' },
          { name: '📧 Email verification', value: 'emailVerification' },
          { name: '🔄 Password reset', value: 'passwordReset' },
          { name: '🔒 Two-factor authentication', value: '2fa' },
          { name: '📊 Login analytics', value: 'analytics' },
          { name: '🚫 Account lockout', value: 'lockout' }
        ]
      }
    ]);
  }

  /**
   * Sélection des plugins
   */
  async selectPlugins() {
    console.log(chalk.blue.bold('\n🔌 Plugins & Extensions\n'));

    const pluginChoices = [
      { name: '📊 Logger - Advanced request/error logging', value: 'logger', checked: true },
      { name: '🛡️ Security - Helmet, CORS, rate limiting', value: 'security', checked: true },
      { name: '⚡ Cache - Redis/Memory caching system', value: 'cache' },
      { name: '📈 Monitoring - Health checks & metrics', value: 'monitoring' },
      { name: '📦 Compression - Gzip response compression', value: 'compression' },
      { name: '🔄 Backup - Automated data backups', value: 'backup' },
      { name: '🎨 Image Processing - Sharp/Jimp integration', value: 'images' },
      { name: '📧 Mailer - Email templates & sending', value: 'mailer' },
      { name: '📅 Scheduler - Cron jobs & tasks', value: 'scheduler' },
      { name: '🔍 Search - Full-text search engine', value: 'search' },
      { name: '📱 Push Notifications', value: 'notifications' },
      { name: '🏪 Session Store - Persistent sessions', value: 'sessionstore' }
    ];

    const { plugins } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'plugins',
      message: '🎯 Select plugins to install:',
      choices: pluginChoices,
      pageSize: 12,
      validate: (input) => this.validatePlugins(input)
    }]);

    this.config.plugins = plugins;
  }

  /**
   * Sélection du framework de style
   */
  async selectStyling() {
    console.log(chalk.blue.bold('\n🎨 Styling & UI Framework\n'));

    const stylingQuestions = [
      {
        type: 'list',
        name: 'framework',
        message: '🎭 Choose a CSS framework:',
        choices: [
          { name: '🅱️ Bootstrap 5 - Popular component library', value: 'bootstrap' },
          { name: '🎯 Tailwind CSS - Utility-first framework', value: 'tailwind' },
          { name: '🎪 Bulma - Modern CSS framework', value: 'bulma' },
          { name: '⚡ Material Design - Google Material UI', value: 'material' },
          { name: '🎨 Foundation - Responsive front-end framework', value: 'foundation' },
          { name: '🎭 Semantic UI - Human-friendly HTML', value: 'semantic' },
          { name: '🖼️ Custom CSS - Write your own styles', value: 'custom' },
          { name: '🚫 None - No CSS framework', value: 'none' }
        ]
      },
      {
        type: 'list',
        name: 'theme',
        message: '🌈 Color theme preference:',
        choices: [
          { name: '🌅 Light - Clean and bright', value: 'light' },
          { name: '🌙 Dark - Easy on the eyes', value: 'dark' },
          { name: '🎨 Auto - Follow system preference', value: 'auto' },
          { name: '🌈 Custom - Define your own colors', value: 'custom' }
        ],
        when: (answers) => answers.framework !== 'none'
      }
    ];

    const stylingAnswers = await inquirer.prompt(stylingQuestions);
    this.config.styling = stylingAnswers.framework;
    this.config.theme = stylingAnswers.theme || 'light';
  }

  /**
   * Options finales de configuration
   */
  async finalOptions() {
    console.log(chalk.blue.bold('\n⚙️ Final Configuration\n'));

    const finalQuestions = [
      {
        type: 'confirm',
        name: 'git',
        message: '📦 Initialize Git repository?',
        default: true
      },
      {
        type: 'confirm',
        name: 'install',
        message: '📥 Install dependencies automatically?',
        default: true
      },
      {
        type: 'confirm',
        name: 'scripts',
        message: '📜 Add useful npm scripts?',
        default: true
      },
      {
        type: 'confirm',
        name: 'docker',
        message: '🐳 Generate Docker configuration?',
        default: false
      },
      {
        type: 'confirm',
        name: 'env',
        message: '🔐 Create environment configuration?',
        default: true
      }
    ];

    const finalAnswers = await inquirer.prompt(finalQuestions);
    Object.assign(this.config, finalAnswers);
  }

  /**
   * Confirmation de la configuration
   */
  async confirmOptions() {
    console.log(chalk.blue.bold('\n📋 Configuration Summary\n'));

    const summary = this.generateSummary();
    const summaryBox = boxen(summary, {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'green',
      title: '📦 Project Configuration',
      titleAlignment: 'center'
    });

    console.log(summaryBox);

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: '✅ Proceed with this configuration?',
      default: true
    }]);

    if (!confirm) {
      console.log(chalk.yellow('\n👋 Setup cancelled. See you later!'));
      process.exit(0);
    }
  }

  /**
   * Génération du résumé de configuration
   */
  generateSummary() {
    const { projectName, template, features, database, auth, plugins, styling, theme } = this.config;
    
    return chalk.white(`
🏷️  Project: ${chalk.cyan.bold(projectName)}
📝 Description: ${chalk.gray(this.config.description)}
👤 Author: ${chalk.green(this.config.author)}
🎨 Template: ${chalk.yellow(template)}
🗄️  Database: ${chalk.blue(database)}
🔐 Auth: ${chalk.magenta(auth.enabled ? '✅ Enabled' : '❌ Disabled')}
🎭 Styling: ${chalk.yellow(styling)} ${theme ? `(${theme})` : ''}

📦 Features (${features.length}):
${features.map(f => `   ✓ ${f}`).join('\n') || '   No additional features'}

🔌 Plugins (${plugins.length}):
${plugins.map(p => `   ⚡ ${p}`).join('\n') || '   No plugins selected'}

⚙️  Options:
   📦 Git: ${this.config.git ? '✅' : '❌'}
   📥 Auto-install: ${this.config.install ? '✅' : '❌'}
   🐳 Docker: ${this.config.docker ? '✅' : '❌'}
   🔐 Environment: ${this.config.env ? '✅' : '❌'}
    `);
  }

  /**
   * Exécution de la configuration
   */
  async executeSetup() {
    try {
      const SetupExecutor = require('./setup-executor');
      const executor = new SetupExecutor(this.config);
      await executor.execute();
    } catch (error) {
      throw new Error(`Setup execution failed: ${error.message}`);
    }
  }

  /**
   * Écran de finalisation
   */
  async showCompletion() {
    console.log(chalk.green.bold('\n🎉 Setup Complete!\n'));
    
    const completionMessage = this.generateCompletionMessage();
    const completionBox = boxen(completionMessage, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green',
      title: '🎊 Success!',
      titleAlignment: 'center'
    });

    console.log(completionBox);
    console.log(chalk.rainbow('\n✨ Happy coding with Veko.js! ✨\n'));
  }

  /**
   * Génération du message de finalisation
   */
  generateCompletionMessage() {
    const { projectName } = this.config;
    
    return chalk.white(`Your project "${chalk.cyan.bold(projectName)}" has been created successfully!\n\n`) +
      chalk.gray('Next steps:\n') +
      chalk.white(`  📁 cd ${projectName}\n`) +
      chalk.white('  🚀 npm run dev\n') +
      chalk.white('  🌐 veko dev\n\n`') +
      chalk.gray('Your app will be available at: ') +
      chalk.blue.underline('http://localhost:3000\n\n') +
      chalk.yellow('📚 Documentation: ') + chalk.blue.underline('https://veko.js.org');
  }

  // === Méthodes de validation sécurisées ===

  /**
   * Validation du nom de projet
   */
  validateProjectName(input) {
    if (!input || input.length < 1) {
      return 'Project name is required';
    }
    
    if (input.length > this.securityConfig.maxProjectNameLength) {
      return `Project name must be less than ${this.securityConfig.maxProjectNameLength} characters`;
    }
    
    if (!this.securityConfig.allowedFileNameChars.test(input)) {
      return 'Use only letters, numbers, hyphens and underscores';
    }
    
    try {
      // Vérification synchrone de l'existence du répertoire
      const fs = require('fs');
      if (fs.existsSync(input)) {
        return 'Directory already exists';
      }
    } catch (error) {
      // Ignorer les erreurs de vérification
    }
    
    return true;
  }

  /**
   * Validation de la description
   */
  validateDescription(input) {
    if (input && input.length > this.securityConfig.maxDescriptionLength) {
      return `Description must be less than ${this.securityConfig.maxDescriptionLength} characters`;
    }
    return true;
  }

  /**
   * Validation de l'auteur
   */
  validateAuthor(input) {
    if (input && input.length > this.securityConfig.maxAuthorLength) {
      return `Author name must be less than ${this.securityConfig.maxAuthorLength} characters`;
    }
    return true;
  }

  /**
   * Validation des fonctionnalités
   */
  validateFeatures(input) {
    if (input.length > this.securityConfig.maxFeatures) {
      return `Maximum ${this.securityConfig.maxFeatures} features allowed`;
    }
    return true;
  }

  /**
   * Validation des plugins
   */
  validatePlugins(input) {
    if (input.length > this.securityConfig.maxPlugins) {
      return `Maximum ${this.securityConfig.maxPlugins} plugins allowed`;
    }
    return true;
  }

  /**
   * Nettoyage sécurisé des informations de projet
   */
  sanitizeProjectInfo(info) {
    return {
      projectName: this.sanitizeString(info.projectName, this.securityConfig.maxProjectNameLength),
      description: this.sanitizeString(info.description, this.securityConfig.maxDescriptionLength),
      author: this.sanitizeString(info.author, this.securityConfig.maxAuthorLength),
      license: info.license || 'MIT'
    };
  }

  /**
   * Nettoyage générique de chaîne
   */
  sanitizeString(str, maxLength) {
    if (typeof str !== 'string') return '';
    return str.trim().substring(0, maxLength);
  }

  /**
   * Gestion centralisée des erreurs
   */
  async handleError(error) {
    console.log(chalk.red.bold('\n❌ Setup Error\n'));
    
    const errorBox = boxen(
      chalk.red('An error occurred during setup:\n\n') +
      chalk.white(error.message) + '\n\n' +
      chalk.gray('Please try again or report this issue if it persists.'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'red',
        title: '🚨 Error',
        titleAlignment: 'center'
      }
    );

    console.log(errorBox);
    
    const { retry } = await inquirer.prompt([{
      type: 'confirm',
      name: 'retry',
      message: '🔄 Would you like to try again?',
      default: true
    }]);

    if (retry) {
      await this.start();
    } else {
      process.exit(1);
    }
  }
}

module.exports = SetupWizard;