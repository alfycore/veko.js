const chalk = require('chalk');
const inquirer = require('inquirer');
const { createSpinner } = require('nanospinner');

class QuickSetup {
  constructor(projectName, options = {}) {
    this.projectName = projectName;
    this.options = options;
    this.config = {
      projectName,
      template: options.template || 'default',
      features: ['hotreload', 'layouts'],
      database: 'sqlite',
      auth: { enabled: false },
      plugins: ['logger', 'security'],
      styling: 'bootstrap',
      git: true,
      install: true
    };
  }

  async start() {
    console.log(chalk.blue.bold(`\n🚀 Quick Setup for "${this.projectName}"\n`));

    if (!this.options.template) {
      await this.selectTemplate();
    }

    await this.askEssentialQuestions();
    await this.execute();
  }

  async selectTemplate() {
    const { template } = await inquirer.prompt([{
      type: 'list',
      name: 'template',
      message: '🎯 Choose a template:',
      choices: [
        { name: '🌟 Default - Full web app', value: 'default' },
        { name: '🔌 API - REST API only', value: 'api' },
        { name: '📝 Blog - Content management', value: 'blog' },
        { name: '👑 Admin - Dashboard', value: 'admin' },
        { name: '🎭 Portfolio - Showcase', value: 'portfolio' }
      ]
    }]);

    this.config.template = template;
  }

  async askEssentialQuestions() {
    const questions = [
      {
        type: 'confirm',
        name: 'auth',
        message: '🔐 Include authentication?',
        default: ['admin', 'blog'].includes(this.config.template),
        when: () => this.config.template !== 'api'
      },
      {
        type: 'list',
        name: 'database',
        message: '🗄️ Database type:',
        choices: [
          { name: '📄 SQLite (easy)', value: 'sqlite' },
          { name: '🐘 PostgreSQL', value: 'postgresql' },
          { name: '🍃 MongoDB', value: 'mongodb' },
          { name: '🚫 None', value: 'none' }
        ],
        when: () => ['api', 'blog', 'admin'].includes(this.config.template)
      },
      {
        type: 'list',
        name: 'styling',
        message: '🎨 CSS framework:',
        choices: [
          { name: '🅱️ Bootstrap', value: 'bootstrap' },
          { name: '🎯 Tailwind', value: 'tailwind' },
          { name: '🎭 Custom', value: 'custom' }
        ],
        when: () => this.config.template !== 'api'
      }
    ];

    const answers = await inquirer.prompt(questions);
    
    if (answers.auth) {
      this.config.auth.enabled = true;
    }
    if (answers.database) {
      this.config.database = answers.database;
    }
    if (answers.styling) {
      this.config.styling = answers.styling;
    }
  }

  async execute() {
    const SetupExecutor = require('./setup-executor');
    const executor = new SetupExecutor(this.config);
    
    console.log(chalk.green('\n🎯 Creating your project...\n'));
    await executor.execute();
    
    console.log(chalk.green.bold('\n✨ Quick setup complete!\n'));
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.white(`  cd ${this.projectName}`));
    console.log(chalk.white('  npm run dev'));
  }
}

module.exports = QuickSetup;