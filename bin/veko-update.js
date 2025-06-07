#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Ajouter le chemin vers les modules lib
const libPath = path.join(__dirname, '..', 'lib');
process.env.NODE_PATH = `${process.env.NODE_PATH || ''}:${libPath}`;
require('module')._initPaths();

// Importer l'auto-updater avec gestion des erreurs robuste
let AutoUpdater = null;
try {
    AutoUpdater = require('../lib/core/auto-updater');
    
    // Vérification que l'auto-updater a toutes les méthodes nécessaires
    const requiredMethods = ['handleCLI', 'getCurrentVersion', 'checkForUpdates', 'log'];
    const missingMethods = requiredMethods.filter(method => typeof AutoUpdater[method] !== 'function');
    
    if (missingMethods.length > 0) {
        console.error(`❌ L'auto-updater est incomplet ou corrompu. Méthodes manquantes: ${missingMethods.join(', ')}`);
        console.error('Tentative de réparation...');
        
        // Correction pour méthodes manquantes
        if (typeof AutoUpdater.getCurrentVersion !== 'function') {
            AutoUpdater.getCurrentVersion = function() {
                try {
                    const packageJsonPath = path.join(process.cwd(), 'package.json');
                    if (!fs.existsSync(packageJsonPath)) return null;
                    
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                    const vekoVersion = packageJson.dependencies?.veko || 
                                       packageJson.devDependencies?.veko || 
                                       packageJson.peerDependencies?.veko;
                                       
                    return vekoVersion?.replace(/[\^~>=<]/g, '') || null;
                } catch (error) {
                    console.warn(`[Auto-updater] Erreur lors de la lecture de package.json: ${error.message}`);
                    return null;
                }
            };
        }
        
        if (typeof AutoUpdater.log !== 'function') {
            AutoUpdater.log = function(level, message) {
                console.log(`[${level.toUpperCase()}] ${message}`);
            };
        }
    }
} catch (error) {
    console.error(`Erreur de chargement de l'auto-updater: ${error.message}`);
    console.error('Veko fonctionnera sans auto-updater');
    process.exit(1);
}

async function main() {
    const args = process.argv.slice(2);

    try {
        // Vérification de la disponibilité avant l'exécution
        if (!AutoUpdater) {
            throw new Error("L'auto-updater n'est pas disponible");
        }

        if (typeof AutoUpdater.handleCLI !== 'function') {
            throw new Error("La méthode handleCLI est manquante dans l'auto-updater");
        }

        // Passer tous les arguments à handleCLI
        return await AutoUpdater.handleCLI(args);
    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        
        // Suggérer des solutions
        if (error.message.includes('not a function')) {
            console.error('\nL\'auto-updater semble être corrompu. Pour le réparer:');
            console.error('1. Réinstallez veko: npm install veko@latest');
            console.error('2. Ou exécutez: npm install -g veko pour une installation globale');
        } else {
            console.log('\nPour réparer automatiquement l\'auto-updater, essayez:');
            console.log('npm install veko@latest');
        }
        
        process.exit(1);
    }
}

// Gestion gracieuse des signaux
process.on('SIGINT', () => {
    process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    console.error('❌ Erreur non gérée:', error.message);
    
    if (error.message && error.message.includes('not a function')) {
        console.error('\nL\'auto-updater est corrompu ou incompatible.');
        console.error('Réinstallez veko avec: npm install veko@latest');
    }
    
    process.exit(1);
});

// Lancement de l'application avec gestion d'erreurs
main().then(result => {
    process.exit(result ? 0 : 1);
}).catch((error) => {
    console.error(`❌ Erreur fatale: ${error.message}`);
    process.exit(1);
});