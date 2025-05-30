#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const DevServer = require('../lib/dev-server');
const path = require('path');
const fs = require('fs');

const program = new Command();

program
  .name('veko')
  .description('Veko.js Framework CLI')
  .version('1.0.0');

program
  .command('dev')
  .description('Démarre le serveur de développement avec auto-refresh')
  .option('-p, --port <port>', 'Port du serveur', '3000')
  .option('-w, --watch <dirs>', 'Dossiers à surveiller', 'views,routes,public')
  .option('-f, --file <file>', 'Fichier de démarrage personnalisé')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Démarrage du serveur de développement Veko.js...'));
    
    // Vérifier si un fichier de démarrage est spécifié
    if (options.file) {
      const filePath = path.resolve(process.cwd(), options.file);
      
      try {
        if (fs.existsSync(filePath)) {
          console.log(chalk.blue(`📄 Utilisation du fichier de démarrage: ${options.file}`));
          
          // Modifier le chemin du projet pour utiliser le répertoire du fichier comme racine
          const projectRoot = path.dirname(filePath);
          
          const devServer = new DevServer({
            port: parseInt(options.port),
            watchDirs: options.watch.split(','),
            projectRoot: projectRoot,
            customEntryFile: filePath
          });
          
          await devServer.start();
        } else {
          console.error(chalk.red(`❌ Le fichier ${options.file} n'existe pas.`));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`❌ Erreur lors du chargement du fichier ${options.file}:`), error);
        process.exit(1);
      }
    } else {
      // Comportement par défaut sans fichier spécifié
      const devServer = new DevServer({
        port: parseInt(options.port),
        watchDirs: options.watch.split(','),
        projectRoot: process.cwd()
      });
      
      await devServer.start();
    }
  });

program
  .command('build')
  .description('Build le projet pour la production')
  .action(() => {
    console.log(chalk.green('📦 Build en cours...'));
    // Logique de build
  });

program
  .command('start')
  .description('Démarre le serveur en mode production')
  .action(() => {
    console.log(chalk.green('🌟 Démarrage en mode production...'));
    // Logique de démarrage production
  });

program.parse();