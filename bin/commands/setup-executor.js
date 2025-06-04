const { createSpinner } = require('nanospinner');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SetupExecutor {
  constructor(config) {
    this.config = config;
    this.projectPath = path.resolve(process.cwd(), config.projectName);
  }

  async execute() {
    const totalSteps = 8;
    let currentStep = 0;

    try {
      // Step 1: Create directory
      currentStep++;
      const spinner1 = createSpinner(`[${currentStep}/${totalSteps}] 📁 Creating project directory...`).start();
      await this.sleep(800);
      await this.createDirectory();
      spinner1.success({ text: `📁 Project directory created` });

      // Step 2: Generate project structure
      currentStep++;
      const spinner2 = createSpinner(`[${currentStep}/${totalSteps}] 🏗️ Generating project structure...`).start();
      await this.sleep(1200);
      await this.createProjectStructure();
      spinner2.success({ text: `🏗️ Project structure created` });

      // Step 3: Generate templates and files
      currentStep++;
      const spinner3 = createSpinner(`[${currentStep}/${totalSteps}] 📄 Generating template files...`).start();
      await this.sleep(1500);
      await this.generateTemplateFiles();
      spinner3.success({ text: `📄 Template files generated` });

      // Step 4: Configure features and plugins
      currentStep++;
      const spinner4 = createSpinner(`[${currentStep}/${totalSteps}] ⚡ Configuring features and plugins...`).start();
      await this.sleep(1000);
      await this.configureFeatures();
      spinner4.success({ text: `⚡ Features and plugins configured` });

      // Step 5: Setup authentication
      if (this.config.auth.enabled) {
        currentStep++;
        const spinner5 = createSpinner(`[${currentStep}/${totalSteps}] 🔐 Setting up authentication...`).start();
        await this.sleep(1300);
        await this.setupAuthentication();
        spinner5.success({ text: `🔐 Authentication system configured` });
      }

      // Step 6: Setup database
      if (this.config.database !== 'none') {
        currentStep++;
        const spinner6 = createSpinner(`[${currentStep}/${totalSteps}] 🗄️ Configuring database...`).start();
        await this.sleep(900);
        await this.setupDatabase();
        spinner6.success({ text: `🗄️ Database configured` });
      }

      // Step 7: Initialize Git
      if (this.config.git) {
        currentStep++;
        const spinner7 = createSpinner(`[${currentStep}/${totalSteps}] 📦 Initializing Git repository...`).start();
        await this.sleep(600);
        await this.initializeGit();
        spinner7.success({ text: `📦 Git repository initialized` });
      }

      // Step 8: Install dependencies
      if (this.config.install) {
        currentStep++;
        const spinner8 = createSpinner(`[${currentStep}/${totalSteps}] 📥 Installing dependencies...`).start();
        await this.installDependencies();
        spinner8.success({ text: `📥 Dependencies installed successfully` });
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Setup failed:'), error.message);
      throw error;
    }
  }

  async createDirectory() {
    if (fs.existsSync(this.projectPath)) {
      throw new Error(`Directory ${this.config.projectName} already exists`);
    }
    fs.mkdirSync(this.projectPath, { recursive: true });
  }

  async createProjectStructure() {
    const directories = this.getDirectoriesForTemplate();
    
    for (const dir of directories) {
      const fullPath = path.join(this.projectPath, dir);
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  getDirectoriesForTemplate() {
    const baseDirectories = [
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
      'utils'
    ];

    const templateDirectories = {
      blog: ['content', 'content/posts', 'admin', 'uploads'],
      admin: ['admin', 'admin/views', 'dashboard'],
      ecommerce: ['shop', 'products', 'orders', 'cart'],
      portfolio: ['portfolio', 'projects', 'gallery'],
      pwa: ['pwa', 'sw', 'manifest', 'offline']
    };

    return [
      ...baseDirectories,
      ...(templateDirectories[this.config.template] || [])
    ];
  }

  async generateTemplateFiles() {
    const TemplateGenerator = require('./template-generator');
    const generator = new TemplateGenerator(this.config);
    const files = generator.generateFiles();

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(this.projectPath, filePath);
      const dir = path.dirname(fullPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }

  async configureFeatures() {
    const FeatureConfigurer = require('./feature-configurer');
    const configurer = new FeatureConfigurer(this.config, this.projectPath);
    await configurer.configure();
  }

  async setupAuthentication() {
    if (this.config.auth.enabled) {
      const AuthSetup = require('./auth-setup');
      const authSetup = new AuthSetup(this.config, this.projectPath);
      await authSetup.configure();
    }
  }

  async setupDatabase() {
    const DatabaseSetup = require('./database-setup');
    const dbSetup = new DatabaseSetup(this.config, this.projectPath);
    await dbSetup.configure();
  }

  async initializeGit() {
    try {
      execSync('git init', { cwd: this.projectPath, stdio: 'pipe' });
      execSync('git add .', { cwd: this.projectPath, stdio: 'pipe' });
      execSync('git commit -m "🎉 Initial commit - Created with Veko.js"', { 
        cwd: this.projectPath, 
        stdio: 'pipe' 
      });
    } catch (error) {
      // Git initialization is optional
      console.log(chalk.yellow('   ⚠ Git initialization failed (optional)'));
    }
  }

  async installDependencies() {
    try {
      execSync('npm install', { 
        cwd: this.projectPath, 
        stdio: 'pipe'
      });
    } catch (error) {
      throw new Error('Failed to install dependencies. Run "npm install" manually.');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SetupExecutor;