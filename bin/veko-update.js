#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

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

    try {
        // Vérification de la disponibilité avant l'exécution
        if (!AutoUpdater) {
            throw new Error("L'auto-updater n'est pas disponible");
        }

        // Passer tous les arguments à handleCLI
        return await AutoUpdater.handleCLI(args);
    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        
        // Suggérer la commande de réparation
        console.log('\nPour réparer automatiquement l\'auto-updater, essayez:');
        console.log('npx veko update fix');
        
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