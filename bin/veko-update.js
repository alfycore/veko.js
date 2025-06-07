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
    
    // Vérification que l'auto-updater a la méthode handleCLI
    if (!AutoUpdater || typeof AutoUpdater.handleCLI !== 'function') {
        throw new Error('Module auto-updater incomplet ou corrompu');
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

        // Vérifier la présence de npm
        try {
            await AutoUpdater.ensureNpm();
        } catch (error) {
            console.error(`❌ ${error.message}`);
            console.error("L'auto-updater a besoin de npm pour fonctionner correctement.");
            console.error("Veuillez vous assurer que npm est installé et disponible dans votre PATH.");
            process.exit(1);
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
            console.log('npx veko update fix');
        }
        
        if (process.env.DEBUG) {
            console.error(error.stack);
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
    
    if (process.env.DEBUG) {
        console.error(error.stack);
    }
    process.exit(1);
});

// Lancement de l'application avec gestion d'erreurs
main().then(result => {
    process.exit(result ? 0 : 1);
}).catch((error) => {
    console.error(`❌ Erreur fatale: ${error.message}`);
    if (process.env.DEBUG) {
        console.error(error.stack);
    }
    process.exit(1);
});