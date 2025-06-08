#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Ajouter le chemin vers les modules lib
const libPath = path.join(__dirname, '..', 'lib');
process.env.NODE_PATH = `${process.env.NODE_PATH || ''}:${libPath}`;
require('module')._initPaths();

// Fonction d'urgence pour les cas critiques
function emergencyRepair() {
    console.error('\n🔧 RÉPARATION D\'URGENCE DE L\'AUTO-UPDATER');
    console.error('═'.repeat(50));
    
    try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        
        if (!fs.existsSync(packageJsonPath)) {
            console.error('❌ package.json non trouvé. Impossible de continuer.');
            console.error('Créez un fichier package.json ou naviguez vers un projet Node.js valide.');
            return false;
        }
        
        console.error('✅ package.json trouvé');
        
        // Vérifier l'installation de veko
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const vekoVersion = packageJson.dependencies?.veko || 
                           packageJson.devDependencies?.veko || 
                           packageJson.peerDependencies?.veko;
        
        if (!vekoVersion) {
            console.error('⚠️ Veko non trouvé dans package.json');
            console.error('🔧 Installation de veko...');
            
            const { execSync } = require('child_process');
            try {
                execSync('npm install veko@latest', { stdio: 'inherit' });
                console.error('✅ Veko installé avec succès');
                return true;
            } catch (error) {
                console.error('❌ Échec de l\'installation:', error.message);
                return false;
            }
        } else {
            console.error(`✅ Veko v${vekoVersion.replace(/[\^~>=<]/g, '')} détecté`);
            return true;
        }
        
    } catch (error) {
        console.error('❌ Erreur critique lors de la réparation:', error.message);
        return false;
    }
}

// Importer l'auto-updater avec gestion des erreurs robuste
let AutoUpdater = null;
try {
    AutoUpdater = require('../lib/core/auto-updater');
    
    // Vérification que l'auto-updater a toutes les méthodes nécessaires
    const requiredMethods = ['handleCLI', 'getCurrentVersion', 'checkForUpdates', 'log', 'init'];
    const missingMethods = requiredMethods.filter(method => typeof AutoUpdater[method] !== 'function');
    
    if (missingMethods.length > 0) {
        console.error(`❌ L'auto-updater est incomplet. Méthodes manquantes: ${missingMethods.join(', ')}`);
        throw new Error('Auto-updater incomplet');
    }
    
} catch (error) {
    console.error(`Erreur de chargement de l'auto-updater: ${error.message}`);
    
    // Tentative de réparation d'urgence
    if (emergencyRepair()) {
        console.error('\n🔄 Tentative de rechargement après réparation...');
        try {
            // Nettoyer le cache des modules
            delete require.cache[require.resolve('../lib/core/auto-updater')];
            AutoUpdater = require('../lib/core/auto-updater');
            console.error('✅ Auto-updater rechargé avec succès');
        } catch (reloadError) {
            console.error('❌ Échec du rechargement:', reloadError.message);
            process.exit(1);
        }
    } else {
        console.error('❌ Réparation d\'urgence échouée');
        process.exit(1);
    }
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

        // Initialisation avec timeout
        const initPromise = Promise.race([
            AutoUpdater.init(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout lors de l\'initialisation')), 10000)
            )
        ]);

        try {
            await initPromise;
        } catch (initError) {
            console.warn(`⚠️ Avertissement d'initialisation: ${initError.message}`);
            // Continuer malgré l'erreur d'initialisation
        }

        // Passer tous les arguments à handleCLI avec timeout
        const cliPromise = Promise.race([
            AutoUpdater.handleCLI(args),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout lors de l\'exécution de la commande')), 30000)
            )
        ]);

        return await cliPromise;
        
    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        
        // Diagnostics et suggestions
        if (error.message.includes('not a function')) {
            console.error('\n🔧 DIAGNOSTIC:');
            console.error('L\'auto-updater semble être corrompu ou incompatible.');
            console.error('\n💡 SOLUTIONS:');
            console.error('1. Réinstallez veko: npm install veko@latest');
            console.error('2. Nettoyez le cache npm: npm cache clean --force');
            console.error('3. Supprimez node_modules et réinstallez: rm -rf node_modules && npm install');
        } else if (error.message.includes('Timeout')) {
            console.error('\n🔧 DIAGNOSTIC:');
            console.error('L\'opération a pris trop de temps à s\'exécuter.');
            console.error('\n💡 SOLUTIONS:');
            console.error('1. Vérifiez votre connexion internet');
            console.error('2. Essayez à nouveau dans quelques minutes');
            console.error('3. Utilisez: veko update fix pour réparer');
        } else {
            console.error('\n💡 Pour réparer automatiquement l\'auto-updater:');
            console.error('npm install veko@latest');
        }
        
        if (process.env.DEBUG) {
            console.error('\n🐛 STACK TRACE:');
            console.error(error.stack);
        }
        
        process.exit(1);
    }
}

// Gestion gracieuse des signaux
process.on('SIGINT', () => {
    console.log('\n👋 Au revoir!');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Arrêt demandé');
    process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    console.error('❌ Erreur non gérée:', error.message);
    
    if (error.message && error.message.includes('not a function')) {
        console.error('\n🔧 L\'auto-updater est corrompu.');
        console.error('Exécutez: npm install veko@latest');
    }
    
    if (process.env.DEBUG) {
        console.error(error.stack);
    }
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejetée:', reason);
    if (process.env.DEBUG) {
        console.error('Promise:', promise);
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