#!/usr/bin/env node

const chalk = require('chalk');
const { Command } = require('commander');
const SetupWizard = require('./commands/setup');
const QuickSetup = require('./commands/quick-setup');

const program = new Command();

program
  .name('create-veko-app')
  .description('Create a new Veko.js application')
  .version('1.1.0')
  .argument('[project-name]', 'Name of the project')
  .option('--template <template>', 'Template to use')
  .option('--quick', 'Quick setup with minimal questions')
  .option('--wizard', 'Full interactive wizard')
  .action(async (projectName, options) => {
    console.log(chalk.blue.bold('🚀 Create Veko App\n'));

    if (!projectName) {
      console.log(chalk.red('❌ Project name is required'));
      console.log(chalk.gray('Usage: npx create-veko-app my-app'));
      process.exit(1);
    }

    try {
      if (options.wizard) {
        const wizard = new SetupWizard();
        wizard.config.projectName = projectName;
        await wizard.start();
      } else if (options.quick || options.template) {
        const quickSetup = new QuickSetup(projectName, options);
        await quickSetup.start();
      } else {
        // Default: ask user preference
        const { setupType } = await require('inquirer').prompt([{
          type: 'list',
          name: 'setupType',
          message: '🎯 How would you like to set up your project?',
          choices: [
            { name: '⚡ Quick - Essential options only', value: 'quick' },
            { name: '🧙‍♂️ Wizard - Full interactive setup', value: 'wizard' }
          ]
        }]);

        if (setupType === 'wizard') {
          const wizard = new SetupWizard();
          wizard.config.projectName = projectName;
          await wizard.start();
        } else {
          const quickSetup = new QuickSetup(projectName, options);
          await quickSetup.start();
        }
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Setup failed:'), error.message);
      process.exit(1);
    }
  });

// Show help if no arguments
if (process.argv.length <= 2) {
  console.log(chalk.blue.bold('🚀 Create Veko App\n'));
  console.log(chalk.white('Usage:'));
  console.log(chalk.gray('  npx create-veko-app my-app'));
  console.log(chalk.gray('  npx create-veko-app my-app --template api'));
  console.log(chalk.gray('  npx create-veko-app my-app --wizard'));
  console.log(chalk.gray('  npx create-veko-app my-app --quick'));
  console.log(chalk.white('\nTemplates:'));
  console.log(chalk.gray('  default, api, blog, admin, ecommerce, portfolio\n'));
  process.exit(0);
}

program.parse();