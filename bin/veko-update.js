#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Message d'installation si l'utilisateur essaie d'utiliser npx veko-update
if (process.argv[1].includes('npx')) {
  console.log('\n🚀 Veko Auto-Updater\n');
  console.log('Il semble que vous utilisez npx pour exécuter cet outil.');
  console.log('Pour une meilleure expérience, installez veko globalement :\n');
  console.log('  npm install -g veko');
  console.log('\nPuis utilisez la commande :\n');
  console.log('  veko update\n');
  console.log('Ou si vous préférez ne pas installer globalement :\n');
  console.log('  npx veko update\n');
}

// Ajouter le chemin vers les modules lib
const libPath = path.join(__dirname, '..', 'lib');
process.env.NODE_PATH = `${process.env.NODE_PATH || ''}:${libPath}`;
require('module')._initPaths();

// Importer l'auto-updater avec gestion des erreurs
let AutoUpdater = null;
try {
    AutoUpdater = require('../lib/core/auto-updater');
} catch (error) {
    console.error(`Erreur de chargement de l'auto-updater: ${error.message}`);
    console.error('Veko fonctionnera sans auto-updater');
    process.exit(1);
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
        // Vérification de la disponibilité avant l'exécution
        if (!AutoUpdater) {
            throw new Error("L'auto-updater n'est pas disponible");
        }

        switch (command) {
            // ...existing code...

            case undefined:
            case 'menu':
                // Menu interactif par défaut
                await AutoUpdater.interactive();
                break;

            case 'fix':
                console.log('🔧 Tentative de réparation de l\'auto-updater...');
                await fixAutoUpdater();
                break;

            default:
                if (typeof AutoUpdater.handleCLI === 'function') {
                    await AutoUpdater.handleCLI(args);
                } else {
                    console.log(`❌ Commande inconnue: ${command}`);
                    showHelp();
                    process.exit(1);
                }
        }
    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        
        // Suggérer la commande de réparation
        console.log('\nPour réparer automatiquement l\'auto-updater, essayez:');
        console.log('npx veko-update fix');
        
        if (process.env.DEBUG) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Fonction de dépannage de l'auto-updater
async function fixAutoUpdater() {
    console.log('1. Vérification des répertoires...');
    try {
        const backupDir = path.join(process.cwd(), '.veko-backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
            console.log('✅ Répertoire de backup créé');
        }
        
        console.log('2. Réinitialisation de la configuration...');
        const configPath = path.join(process.cwd(), '.veko-updater.json');
        const defaultConfig = {
            autoCheck: true,
            autoUpdate: false,
            checkInterval: 3600000,
            backupCount: 5,
            securityCheck: true,
            progressBar: true,
            notifications: true,
            rollbackOnFailure: true,
            updateChannel: 'stable'
        };
        
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log('✅ Configuration réinitialisée');
        
        console.log('3. Nettoyage des fichiers temporaires...');
        const pidFile = path.join(process.cwd(), '.veko-updater.pid');
        if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
            console.log('✅ Fichier PID supprimé');
        }
        
        console.log('\n✅ Auto-updater réparé avec succès!');
        console.log('Vous pouvez maintenant utiliser: npx veko-update');
    } catch (error) {
        console.error(`❌ Erreur pendant la réparation: ${error.message}`);
        throw error;
    }
}

function showHelp() {
    console.log(`
🚀 Veko Auto-Updater - Le plus avancé des auto-updaters Node.js

Usage: npx veko-update [command] [options]

Commandes:
  (aucune)          🎨 Ouvre le menu interactif (recommandé)
  check             🔍 Vérifier les mises à jour
  update            ⚡ Mettre à jour maintenant
  status            📊 Afficher le statut actuel
  config            ⚙️ Configurer l'auto-updater
  rollback [backup] 🔄 Effectuer un rollback
  stats             📈 Afficher les statistiques détaillées
  backup            💾 Gérer les backups
  daemon            👾 Démarrer en mode daemon (arrière-plan)
  stop              🛑 Arrêter le daemon
  activate          🎯 Configuration initiale guidée
  fix               🔧 Réparer l'auto-updater
  help              ❓ Afficher cette aide
  version           📋 Afficher la version

Options:
  --verbose, -v     Sortie détaillée
  --force, -f       Forcer l'opération
  --help, -h        Afficher l'aide
    `);
}

// Gestion gracieuse des signaux
process.on('SIGINT', () => {
    console.log('\n👋 Auto-updater interrompu par l\'utilisateur');
    if (AutoUpdater && typeof AutoUpdater.closeReadline === 'function') {
        try {
            AutoUpdater.closeReadline();
        } catch (err) {
            // Ignorer les erreurs pendant l'arrêt
        }
    }
    process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    console.error('❌ Erreur non gérée:', error.message);
    if (process.env.DEBUG) {
        console.error(error.stack);
    }
    process.exit(1);
});

// Lancement de l'application avec gestion d'erreurs
main().catch((error) => {
    console.error(`❌ Erreur fatale: ${error.message}`);
    if (process.env.DEBUG) {
        console.error(error.stack);
    }
    process.exit(1);
});