#!/usr/bin/env node

/**
 * create-veko-app
 * Quick way to create a Veko.js application
 */

const CreateApp = require('./commands/create-app');

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments manually for simplicity
  let projectName = null;
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'typescript' || key === 'ts') {
        options.typescript = true;
      } else if (key === 'javascript' || key === 'js') {
        options.javascript = true;
      } else if (key === 'tailwind') {
        options.tailwind = true;
      } else if (key === 'eslint') {
        options.eslint = true;
      } else if (key === 'react') {
        options.react = true;
      } else if (key === 'api') {
        options.api = true;
      } else if (key === 'src-dir') {
        options.srcDir = true;
      } else if (key === 'use-npm') {
        options.useNpm = true;
      } else if (key === 'use-yarn') {
        options.useYarn = true;
      } else if (key === 'use-pnpm') {
        options.usePnpm = true;
      } else if (key === 'skip-install') {
        options.skipInstall = true;
      } else if (key === 'yes' || key === 'y') {
        options.yes = true;
      } else if (key.startsWith('example=')) {
        options.example = key.split('=')[1];
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (key === 'e' && args[i + 1]) {
        options.example = args[++i];
      } else if (key === 'y') {
        options.yes = true;
      }
    } else if (!projectName) {
      projectName = arg;
    }
  }
  
  const creator = new CreateApp();
  await creator.run(projectName, options);
}

main().catch(console.error);
