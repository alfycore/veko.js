/**
 * Template List Command
 * Displays available project templates for Veko.js
 */

const chalk = require('chalk');

class TemplateList {
  constructor() {
    this.templates = [
      {
        name: 'basic',
        description: 'Simple starter template with minimal configuration',
        features: ['Express server', 'EJS views', 'Basic routing'],
        recommended: false
      },
      {
        name: 'full',
        description: 'Complete template with all features enabled',
        features: ['Express server', 'EJS views', 'Authentication', 'Plugins', 'Dev server', 'Layouts'],
        recommended: true
      },
      {
        name: 'api',
        description: 'REST API template without views',
        features: ['Express server', 'JSON responses', 'CORS', 'Rate limiting', 'Validation'],
        recommended: false
      },
      {
        name: 'react',
        description: 'React SSR template with full React support',
        features: ['React 18', 'SSR/CSR/Hybrid', 'Hooks', 'Components', 'HMR'],
        recommended: false
      },
      {
        name: 'auth',
        description: 'Template with authentication pre-configured',
        features: ['JWT auth', 'Session support', 'OAuth ready', 'Protected routes'],
        recommended: false
      },
      {
        name: 'plugin',
        description: 'Template for creating Veko.js plugins',
        features: ['Plugin structure', 'Hooks system', 'API access', 'Examples'],
        recommended: false
      }
    ];
  }

  display() {
    console.log();
    console.log(chalk.bold.cyan('📋 Available Veko.js Templates'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();

    this.templates.forEach((template, index) => {
      const badge = template.recommended 
        ? chalk.green(' ★ RECOMMENDED') 
        : '';
      
      console.log(
        chalk.bold.white(`  ${template.name}`) + badge
      );
      console.log(chalk.gray(`     ${template.description}`));
      console.log(
        chalk.dim(`     Features: `) + 
        chalk.yellow(template.features.join(', '))
      );
      
      if (index < this.templates.length - 1) {
        console.log();
      }
    });

    console.log();
    console.log(chalk.gray('─'.repeat(60)));
    console.log();
    console.log(chalk.dim('  Usage:'));
    console.log(chalk.cyan('    npx veko create my-app --template <template-name>'));
    console.log(chalk.cyan('    npx veko setup my-app'));
    console.log();
  }

  getTemplate(name) {
    return this.templates.find(t => t.name === name);
  }

  getTemplateNames() {
    return this.templates.map(t => t.name);
  }
}

module.exports = TemplateList;
