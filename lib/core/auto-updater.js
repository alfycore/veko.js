// Fichier de l'auto-updater qui va vérifier si c'est la bonne version de veko 
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const { execSync, spawn } = require('child_process');
const chalk = require('chalk');

class AutoUpdater {
    static packageJsonPath = path.join(process.cwd(), 'package.json');
    static backupDir = path.join(process.cwd(), '.veko-backups');
    static configPath = path.join(process.cwd(), '.veko-updater.json');
    static logPath = path.join(process.cwd(), '.veko-updater.log');
    static currentVersion = null;
    static latestVersion = null;
    static config = {};
    static stats = {
        totalUpdates: 0,
        lastUpdate: null,
        lastCheck: null,
        rollbacks: 0
    };

    // 🎨 Styles visuels simplifiés
    static styles = {
        title: chalk.bold.cyan,
        success: chalk.bold.green,
        error: chalk.bold.red,
        warning: chalk.bold.yellow,
        info: chalk.bold.blue,
        dim: chalk.dim.gray,
        highlight: chalk.bold.white,
        accent: chalk.magenta,
        progress: chalk.green.bold,
        version: chalk.cyan.bold,
        menu: chalk.yellow.bold,
        separator: chalk.dim('─'.repeat(60))
    };

    // 🔧 Configuration par défaut
    static defaultConfig = {
        autoCheck: true,
        autoUpdate: false,
        checkInterval: 3600000, // 1 heure
        backupCount: 5,
        allowPrerelease: false,
        allowBeta: false,
        securityCheck: true,
        progressBar: true,
        notifications: true,
        rollbackOnFailure: true,
        updateChannel: 'stable', // stable, beta, alpha
        customRegistry: null,
        excludeFiles: ['.git', 'node_modules', '.veko-backups'],
        skipDependencies: false
    };

    // 🚀 Initialisation robuste
    static async init() {
        try {
            await this.loadConfig();
            await this.loadStats();
            this.createDirectories();
            
            if (this.config.autoCheck) {
                this.scheduleAutoCheck();
            }
            
            return true;
        } catch (error) {
            console.error(`[Auto-updater] Erreur d'initialisation: ${error.message}`);
            return false; // Ne pas bloquer l'application en cas d'erreur
        }
    }

    // 📁 Création des répertoires nécessaires avec gestion d'erreurs
    static createDirectories() {
        try {
            [this.backupDir].forEach(dir => {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
            });
        } catch (error) {
            console.warn(`[Auto-updater] Impossible de créer les répertoires: ${error.message}`);
        }
    }

    // ⚙️ Chargement de la configuration avec fallback
    static async loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                this.config = { ...this.defaultConfig, ...JSON.parse(configData) };
            } else {
                this.config = { ...this.defaultConfig };
                await this.saveConfig();
            }
        } catch (error) {
            console.warn(`[Auto-updater] Erreur de configuration: ${error.message}`);
            this.config = { ...this.defaultConfig };
        }
    }

    // 💾 Sauvegarde de la configuration avec sécurité
    static async saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.warn(`[Auto-updater] Impossible de sauvegarder la configuration: ${error.message}`);
        }
    }

    // 📊 Chargement des statistiques de manière sécurisée
    static async loadStats() {
        try {
            if (fs.existsSync(this.packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
                if (packageJson.vekoUpdaterStats) {
                    this.stats = { ...this.stats, ...packageJson.vekoUpdaterStats };
                }
            }
        } catch (error) {
            console.warn(`[Auto-updater] Impossible de charger les statistiques: ${error.message}`);
        }
    }

    // 🔄 Programmation de la vérification automatique sécurisée
    static scheduleAutoCheck() {
        try {
            setInterval(async () => {
                try {
                    await this.checkForUpdates(true);
                } catch (error) {
                    // Capture l'erreur pour ne pas arrêter le processus
                    console.error(`[Auto-updater] Erreur de vérification: ${error.message}`);
                }
            }, this.config.checkInterval);
        } catch (error) {
            console.error(`[Auto-updater] Erreur de programmation: ${error.message}`);
        }
    }

    // 📊 Barre de progression
    static showProgress(current, total, message = '') {
        if (!this.config.progressBar) return;
        
        const percentage = Math.round((current / total) * 100);
        const barLength = 40;
        const filledLength = Math.round(barLength * percentage / 100);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        
        process.stdout.write(`\r${this.styles.progress(bar)} ${percentage}% ${message}`);
        
        if (current === total) {
            console.log(''); // Nouvelle ligne à la fin
        }
    }

    // 🎯 Animation de chargement
    static loadingAnimation(message) {
        if (!process.stdout.isTTY) return { stop: () => {} };
        
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        const loader = setInterval(() => {
            process.stdout.write(`\r${this.styles.info(frames[i++ % frames.length])} ${message}`);
        }, 80);
        
        // Retourne une fonction pour arrêter l'animation
        return {
            stop: (finalMessage = '') => {
                clearInterval(loader);
                process.stdout.write(`\r${' '.repeat(message.length + 10)}\r`);
                if (finalMessage) {
                    console.log(finalMessage);
                }
            }
        };
    }

    // 🔍 Vérification de mise à jour avec timeout et animation
    static async checkForUpdates(silent = false) {
        try {
            // Animation si pas en mode silencieux
            const animation = !silent ? 
                this.loadingAnimation('Vérification des mises à jour...') : 
                { stop: () => {} };
            
            this.stats.lastCheck = new Date().toISOString();
            
            const currentVersion = this.getCurrentVersion();
            if (!currentVersion) {
                animation.stop(!silent ? 
                    this.styles.warning('⚠️ Veko n\'est pas installé.') : '');
                return { hasUpdate: false, needsInstall: true };
            }
            
            // Timeout pour éviter les boucles infinies
            const versionInfoPromise = Promise.race([
                this.getVersionInfo(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout lors de la vérification')), 5000)
                )
            ]);
            
            const versionInfo = await versionInfoPromise;
            
            if (!versionInfo) {
                animation.stop(!silent ? 
                    this.styles.error('❌ Impossible de récupérer les informations de version') : '');
                throw new Error('Impossible de récupérer les informations de version');
            }
            
            const comparison = this.compareVersions(currentVersion, versionInfo.latest);
            
            if (comparison < 0) {
                animation.stop(!silent ? 
                    this.styles.warning(`⚠️ Nouvelle version disponible! ${currentVersion} → ${versionInfo.latest}`) : '');
                
                if (!silent) {
                    console.log(this.styles.info(`   Actuelle: ${this.styles.version(currentVersion)}`));
                    console.log(this.styles.info(`   Dernière: ${this.styles.version(versionInfo.latest)}`));
                    
                    if (versionInfo.changelog) {
                        console.log(this.styles.info('\n📝 Notes de mise à jour:'));
                        console.log(this.styles.dim(`${versionInfo.changelog.substring(0, 500)}...`));
                    }
                }
                
                return { 
                    hasUpdate: true, 
                    currentVersion, 
                    latestVersion: versionInfo.latest,
                    changelog: versionInfo.changelog,
                    security: versionInfo.security
                };
            } else {
                animation.stop(!silent ? 
                    this.styles.success(`✅ Version à jour (${currentVersion})`) : '');
                return { hasUpdate: false, currentVersion };
            }
            
        } catch (error) {
            if (!silent) {
                console.log(this.styles.error(`❌ ${error.message}`));
            }
            this.logError(`Erreur lors de la vérification: ${error.message}`);
            return { hasUpdate: false, error: error.message };
        }
    }

    // 🔐 Vérification de sécurité et intégrité
    static async verifyPackageIntegrity(packagePath, expectedIntegrity) {
        if (!this.config.securityCheck || !expectedIntegrity) {
            return true;
        }
        
        try {
            const fileBuffer = fs.readFileSync(packagePath);
            const hash = crypto.createHash('sha512').update(fileBuffer).digest('base64');
            const calculatedIntegrity = `sha512-${hash}`;
            
            return calculatedIntegrity === expectedIntegrity;
        } catch (error) {
            this.log('error', `Erreur lors de la vérification d'intégrité: ${error.message}`);
            return false;
        }
    }

    // 💾 Système de backup amélioré
    static async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(this.backupDir, `backup-${timestamp}`);
            
            console.log(this.styles.info('💾 Création du backup...'));
            
            // Copie les fichiers essentiels
            const filesToBackup = [
                'package.json',
                'package-lock.json',
                'yarn.lock',
                'node_modules/veko'
            ];
            
            fs.mkdirSync(backupPath, { recursive: true });
            
            for (let i = 0; i < filesToBackup.length; i++) {
                const file = filesToBackup[i];
                const sourcePath = path.join(process.cwd(), file);
                const destPath = path.join(backupPath, file);
                
                if (fs.existsSync(sourcePath)) {
                    fs.mkdirSync(path.dirname(destPath), { recursive: true });
                    
                    if (fs.statSync(sourcePath).isDirectory()) {
                        await this.copyDirectory(sourcePath, destPath);
                    } else {
                        fs.copyFileSync(sourcePath, destPath);
                    }
                }
                
                this.showProgress(i + 1, filesToBackup.length, 'Backup en cours...');
            }
            
            // Nettoyage des anciens backups
            this.cleanupOldBackups();
            
            console.log(this.styles.success(`✅ Backup créé: ${backupPath}`));
            return backupPath;
            
        } catch (error) {
            this.log('error', `Erreur lors de la création du backup: ${error.message}`);
            throw error;
        }
    }

    // 📁 Copie récursive de répertoires
    static async copyDirectory(source, destination) {
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }
        
        const items = fs.readdirSync(source);
        
        for (const item of items) {
            const sourcePath = path.join(source, item);
            const destPath = path.join(destination, item);
            
            if (fs.statSync(sourcePath).isDirectory()) {
                await this.copyDirectory(sourcePath, destPath);
            } else {
                fs.copyFileSync(sourcePath, destPath);
            }
        }
    }

    // 🧹 Nettoyage des anciens backups
    static cleanupOldBackups() {
        try {
            const backups = fs.readdirSync(this.backupDir)
                .filter(dir => dir.startsWith('backup-'))
                .map(dir => ({
                    name: dir,
                    path: path.join(this.backupDir, dir),
                    mtime: fs.statSync(path.join(this.backupDir, dir)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);
            
            if (backups.length > this.config.backupCount) {
                const toDelete = backups.slice(this.config.backupCount);
                toDelete.forEach(backup => {
                    fs.rmSync(backup.path, { recursive: true, force: true });
                    this.log('info', `Backup supprimé: ${backup.name}`);
                });
            }
        } catch (error) {
            this.log('error', `Erreur lors du nettoyage des backups: ${error.message}`);
        }
    }

    // 🔄 Rollback vers un backup spécifié
    static async rollback(backupPath) {
        try {
            // Si le chemin n'est pas spécifié, utiliser le plus récent
            if (!backupPath) {
                const backups = fs.readdirSync(this.backupDir)
                    .filter(dir => dir.startsWith('backup-'))
                    .map(dir => path.join(this.backupDir, dir))
                    .sort((a, b) => 
                        fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime()
                    );
                
                if (backups.length === 0) {
                    throw new Error('Aucun backup disponible');
                }
                
                backupPath = backups[0];
                console.log(this.styles.info(`Utilisation du backup le plus récent: ${path.basename(backupPath)}`));
            }
            
            if (!fs.existsSync(backupPath)) {
                throw new Error(`Backup non trouvé: ${backupPath}`);
            }
            
            console.log(this.styles.info('🔄 Restauration en cours...'));
            
            const backupFiles = fs.readdirSync(backupPath);
            
            for (let i = 0; i < backupFiles.length; i++) {
                const file = backupFiles[i];
                const sourcePath = path.join(backupPath, file);
                const destPath = path.join(process.cwd(), file);
                
                if (fs.statSync(sourcePath).isDirectory()) {
                    if (fs.existsSync(destPath)) {
                        fs.rmSync(destPath, { recursive: true, force: true });
                    }
                    await this.copyDirectory(sourcePath, destPath);
                } else {
                    fs.copyFileSync(sourcePath, destPath);
                }
                
                this.showProgress(i + 1, backupFiles.length, 'Restauration...');
            }
            
            this.stats.rollbacks++;
            await this.saveStats();
            
            console.log(this.styles.success('✅ Rollback effectué avec succès!'));
            return true;
            
        } catch (error) {
            this.log('error', `Erreur lors du rollback: ${error.message}`);
            console.log(this.styles.error(`❌ ${error.message}`));
            return false;
        }
    }

    // 🚀 Mise à jour améliorée avec détection de npm
    static async performUpdate(versionInfo) {
        let backupPath = null;
        
        try {
            // Création du backup
            backupPath = await this.createBackup();
            
            console.log(this.styles.info('🚀 Mise à jour en cours...'));
            
            // Trouver le chemin npm correct selon la plateforme
            const isWindows = process.platform === 'win32';
            const npmCommand = isWindows ? 'npm.cmd' : 'npm';
            
            // Désinstallation de l'ancienne version
            console.log(this.styles.info('📦 Désinstallation de l\'ancienne version...'));
            try {
                execSync(`${npmCommand} uninstall veko`, { stdio: 'pipe' });
            } catch (error) {
                // Si echec, essayer avec npx
                console.log(this.styles.warning('⚠️ Tentative alternative avec npx...'));
                execSync(`${isWindows ? 'npx.cmd' : 'npx'} -y npm uninstall veko`, { stdio: 'pipe' });
            }
            
            // Installation de la nouvelle version
            console.log(this.styles.info(`📦 Installation de veko@${versionInfo.latestVersion}...`));
            
            // Utiliser le chemin complet vers npm si disponible
            const installProcess = spawn(npmCommand, ['install', `veko@${versionInfo.latestVersion}`], {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true // Utiliser un shell pour une meilleure compatibilité
            });
            
            let installOutput = '';
            installProcess.stdout.on('data', (data) => {
                installOutput += data.toString();
            });
            
            installProcess.stderr.on('data', (data) => {
                installOutput += data.toString();
            });
            
            await new Promise((resolve, reject) => {
                installProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Installation échouée avec le code ${code}: ${installOutput}`));
                    }
                });
                
                installProcess.on('error', (err) => {
                    // Capturer les erreurs de spawn
                    reject(new Error(`Erreur lors du lancement du processus npm: ${err.message}`));
                });
            });
            
            // Vérification post-installation
            const newVersion = this.getCurrentVersion();
            if (newVersion !== versionInfo.latestVersion) {
                throw new Error('La version installée ne correspond pas à la version attendue');
            }
            
            // Mise à jour des statistiques
            this.stats.totalUpdates++;
            this.stats.lastUpdate = new Date().toISOString();
            await this.saveStats();
            
            console.log(this.styles.success(`✅ Mise à jour réussie vers la version ${versionInfo.latestVersion}!`));
            
            if (this.config.notifications) {
                this.showNotification('Veko mis à jour avec succès!', `Version ${versionInfo.latestVersion}`);
            }
            
            return true;
            
        } catch (error) {
            this.log('error', `Erreur lors de la mise à jour: ${error.message}`);
            console.log(this.styles.error(`❌ Erreur: ${error.message}`));
            
            if (this.config.rollbackOnFailure && backupPath) {
                console.log(this.styles.warning('🔄 Rollback automatique...'));
                await this.rollback(backupPath);
            }
            
            return false;
        }
    }

    // 🔔 Notification système
    static showNotification(title, message) {
        try {
            const platform = os.platform();
            
            if (platform === 'darwin') {
                execSync(`osascript -e 'display notification "${message}" with title "${title}"'`);
            } else if (platform === 'win32') {
                // Windows notification (nécessite des outils supplémentaires)
                console.log(this.styles.info(`🔔 ${title}: ${message}`));
            } else if (platform === 'linux') {
                execSync(`notify-send "${title}" "${message}"`);
            }
        } catch (error) {
            // Ignore les erreurs de notification
        }
    }

    // 📊 Affichage des statistiques
    static displayStats() {
        console.log(this.styles.title('\n📊 Statistiques de l\'auto-updater'));
        console.log(this.styles.separator);
        console.log(this.styles.info(`Mises à jour totales: ${this.stats.totalUpdates}`));
        console.log(this.styles.info(`Rollbacks effectués: ${this.stats.rollbacks}`));
        console.log(this.styles.info(`Dernière vérification: ${this.stats.lastCheck || 'Jamais'}`));
        console.log(this.styles.info(`Dernière mise à jour: ${this.stats.lastUpdate || 'Jamais'}`));
        console.log(this.styles.info(`Version actuelle: ${this.getCurrentVersion() || 'Non installé'}`));
        console.log(this.styles.info(`Canal de mise à jour: ${this.config.updateChannel}`));
        console.log(this.styles.separator);
    }

    // ⚙️ Configuration de base
    static async configureSettings(options = {}) {
        try {
            // Mise à jour des options de configuration avec les paramètres passés
            if (options && typeof options === 'object') {
                this.config = { ...this.config, ...options };
                await this.saveConfig();
                return true;
            }
            
            console.log(this.styles.title('\n⚙️ Configuration actuelle:'));
            console.log(this.styles.separator);
            console.log(this.styles.info(`Vérification auto:   ${this.config.autoCheck ? '✅' : '❌'}`));
            console.log(this.styles.info(`Mise à jour auto:    ${this.config.autoUpdate ? '✅' : '❌'}`));
            console.log(this.styles.info(`Canal:               ${this.config.updateChannel}`));
            console.log(this.styles.info(`Backups:             ${this.config.backupCount}`));
            console.log(this.styles.info(`Vérification sécurité: ${this.config.securityCheck ? '✅' : '❌'}`));
            console.log(this.styles.info(`Notifications:       ${this.config.notifications ? '✅' : '❌'}`));
            console.log(this.styles.info(`Rollback auto:       ${this.config.rollbackOnFailure ? '✅' : '❌'}`));
            console.log(this.styles.separator);
            
            return true;
        } catch (error) {
            console.log(this.styles.error(`❌ Erreur: ${error.message}`));
            return false;
        }
    }

    // 🔌 Gestion des WebSocket avec sécurité améliorée
    static async getVersionInfo() {
        return new Promise((resolve, reject) => {
            try {
                const registry = this.config.customRegistry || 'registry.npmjs.org';
                const options = {
                    hostname: registry,
                    path: '/veko',
                    method: 'GET',
                    headers: {
                        'User-Agent': `veko-auto-updater/2.0.0 (${os.platform()} ${os.arch()})`,
                        'Accept': 'application/json'
                    },
                    timeout: 5000 // Timeout explicite
                };

                const req = https.request(options, (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        // Limite la taille des données pour éviter les attaques DoS
                        if (data.length > 1000000) {  // Limite à ~1MB
                            req.destroy();
                            reject(new Error('Réponse trop volumineuse'));
                            return;
                        }
                        data += chunk;
                    });

                    res.on('end', () => {
                        if (res.statusCode !== 200) {
                            reject(new Error(`Erreur HTTP ${res.statusCode}`));
                            return;
                        }
                        
                        try {
                            const packageInfo = JSON.parse(data);
                            const channel = this.config.updateChannel;
                            
                            if (!packageInfo['dist-tags']) {
                                reject(new Error('Format de réponse invalide'));
                                return;
                            }
                            
                            let version;
                            switch (channel) {
                                case 'beta':
                                    version = packageInfo['dist-tags'].beta || packageInfo['dist-tags'].latest;
                                    break;
                                case 'alpha':
                                    version = packageInfo['dist-tags'].alpha || packageInfo['dist-tags'].beta || packageInfo['dist-tags'].latest;
                                    break;
                                case 'stable':
                                default:
                                    version = packageInfo['dist-tags'].latest;
                            }
                            
                            if (!version || !packageInfo.versions || !packageInfo.versions[version]) {
                                reject(new Error(`Version invalide: ${version}`));
                                return;
                            }
                            
                            const versionInfo = packageInfo.versions[version];
                            
                            resolve({
                                latest: version,
                                changelog: versionInfo?.changelog || (packageInfo.readme?.slice(0, 500) || 'Pas de notes de mise à jour disponibles'),
                                security: versionInfo?.security || false,
                                size: versionInfo?.dist?.unpackedSize,
                                integrity: versionInfo?.dist?.integrity,
                                publishDate: versionInfo?.time
                            });
                        } catch (error) {
                            reject(new Error(`Erreur lors du parsing: ${error.message}`));
                        }
                    });
                });

                // Gestion explicite des erreurs
                req.on('error', (error) => {
                    reject(new Error(`Erreur de connexion: ${error.message}`));
                });

                // Timeout manuels pour plus de contrôle
                req.setTimeout(10000, () => {
                    req.destroy();
                    reject(new Error('Timeout de connexion'));
                });

                req.end();
            } catch (error) {
                reject(new Error(`Erreur lors de la requête: ${error.message}`));
            }
        });
    }

    // ❓ Aide simplifiée
    static showHelp() {
        console.log(this.styles.title('\n❓ Aide - Veko Auto-Updater'));
        console.log(this.styles.separator);
        console.log('Commandes disponibles:');
        console.log('  veko update check        - Vérifier les mises à jour');
        console.log('  veko update update       - Mettre à jour maintenant');
        console.log('  veko update config       - Afficher la configuration');
        console.log('  veko update rollback     - Effectuer un rollback');
        console.log('  veko update stats        - Afficher les statistiques');
        console.log('  veko update fix          - Réparer l\'auto-updater');
        console.log('  veko update help         - Afficher l\'aide');
        console.log('  veko update version      - Afficher la version');
        console.log(this.styles.separator);
    }

    // 🎯 Fonction principale améliorée
    static async checkAndUpdate() {
        try {
            await this.init();
            
            // Vérifier npm en avance
            try {
                await this.ensureNpm();
            } catch (error) {
                console.log(this.styles.error(`❌ ${error.message} - L'auto-updater a besoin de npm pour fonctionner.`));
                return false;
            }
            
            // Animation de chargement
            const animation = this.loadingAnimation('Vérification des mises à jour...');
            
            // Vérification si package.json existe
            if (!fs.existsSync(this.packageJsonPath)) {
                animation.stop(this.styles.error('❌ Le fichier package.json est manquant.'));
                console.log(this.styles.error('Un fichier package.json est nécessaire.'));
                return false;
            }

            // Vérification des mises à jour avec timeout
            const updateInfo = await Promise.race([
                this.checkForUpdates(true),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout lors de la vérification')), 5000)
                )
            ]);
            
            animation.stop();
            
            if (updateInfo.needsInstall) {
                console.log(this.styles.warning('⚠️ Veko n\'est pas installé. Installation en cours...'));
                try {
                    execSync('npm install veko@latest', { stdio: 'inherit' });
                    console.log(this.styles.success('✅ Veko installé avec succès!'));
                    return true;
                } catch (error) {
                    console.log(this.styles.error(`❌ Erreur lors de l'installation: ${error.message}`));
                    return false;
                }
            }
            
            if (updateInfo.hasUpdate) {
                console.log(this.styles.warning(`⚠️ Nouvelle version disponible! ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`));
                if (this.config.autoUpdate) {
                    return await this.performUpdate(updateInfo);
                } else {
                    console.log(this.styles.info('Pour mettre à jour: veko update update'));
                }
            } else if (updateInfo.error) {
                console.log(this.styles.error(`❌ Erreur: ${updateInfo.error}`));
                return false;
            } else {
                console.log(this.styles.success('✅ Veko est à jour!'));
            }
            
            return true;
            
        } catch (error) {
            this.log('error', `Erreur inattendue: ${error.message}`);
            console.log(this.styles.error(`❌ Erreur inattendue: ${error.message}`));
            return false;
        }
    }

    // 🧪 Installation sécurisée de npm avec plusieurs méthodes
    static async ensureNpm() {
        const isWindows = process.platform === 'win32';
        const npmCommands = [
            isWindows ? 'npm.cmd' : 'npm',
            isWindows ? 'npx.cmd' : 'npx',
            'npm', // Essayer sans extension sur Windows aussi
            path.join(process.execPath, '..', isWindows ? 'npm.cmd' : 'npm')
        ];
        
        for (const cmd of npmCommands) {
            try {
                execSync(`${cmd} --version`, { stdio: 'pipe' });
                return cmd; // Retourner la première commande qui fonctionne
            } catch (e) {
                // Continuer avec la commande suivante
            }
        }
        
        throw new Error('npm introuvable sur le système');
    }
    
    // 🚀 Commande de mise à jour spécifique améliorée
    static async performUpdateCommand() {
        try {
            // Vérifier npm en avance
            try {
                await this.ensureNpm();
            } catch (error) {
                console.log(this.styles.error(`❌ ${error.message} - L'auto-updater a besoin de npm pour fonctionner.`));
                return false;
            }
            
            // Vérifier les mises à jour
            const updateInfo = await this.checkForUpdates(true);
            
            if (updateInfo.hasUpdate) {
                console.log(this.styles.warning(`⚠️ Mise à jour disponible: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`));
                console.log(this.styles.info('🚀 Démarrage de la mise à jour...'));
                
                return await this.performUpdate(updateInfo);
            } else if (updateInfo.needsInstall) {
                console.log(this.styles.warning('⚠️ Veko n\'est pas installé. Installation en cours...'));
                
                try {
                    execSync('npm install veko@latest', { stdio: 'inherit' });
                    console.log(this.styles.success('✅ Veko installé avec succès!'));
                    return true;
                } catch (error) {
                    console.log(this.styles.error(`❌ Erreur lors de l'installation: ${error.message}`));
                    return false;
                }
            } else {
                console.log(this.styles.success('✅ Veko est déjà à jour!'));
                return true;
            }
        } catch (error) {
            console.log(this.styles.error(`❌ Erreur lors de la mise à jour: ${error.message}`));
            return false;
        }
    }

    // 📋 Afficher version
    static showVersion() {
        const version = this.getCurrentVersion() || 'non installé';
        console.log(`Veko v${version}`);
        console.log(`Auto-updater v1.1.5`);
        return true;
    }
    
    // 🔧 Réparer l'installation
    static async fixInstallation() {
        console.log(this.styles.title('\n🔧 Réparation de l\'installation'));
        console.log(this.styles.separator);
        
        try {
            // 1. Créer les répertoires nécessaires
            console.log('1. Vérification des répertoires');
            this.createDirectories();
            console.log(this.styles.success('✅ Répertoires vérifiés'));
            
            // 2. Réinitialiser la configuration
            console.log('2. Réinitialisation de la configuration');
            this.config = { ...this.defaultConfig };
            await this.saveConfig();
            console.log(this.styles.success('✅ Configuration réinitialisée'));
            
            // 3. Vérifier package.json
            console.log('3. Vérification de package.json');
            if (!fs.existsSync(this.packageJsonPath)) {
                console.log(this.styles.warning('⚠️ package.json manquant'));
                console.log(this.styles.error('❌ Impossible de continuer sans package.json'));
                return false;
            } else {
                console.log(this.styles.success('✅ package.json trouvé'));
                
                // Vérifier l'installation de veko
                const vekoInstalled = this.getCurrentVersion();
                if (!vekoInstalled) {
                    console.log(this.styles.warning('⚠️ Veko non installé, tentative d\'installation'));
                    try {
                        execSync('npm install veko@latest', { stdio: 'inherit' });
                        console.log(this.styles.success('✅ Veko installé'));
                    } catch (error) {
                        console.log(this.styles.error(`❌ Erreur d'installation: ${error.message}`));
                    }
                } else {
                    console.log(this.styles.success(`✅ Veko v${vekoInstalled} installé`));
                }
            }
            
            // 4. Reset du log
            console.log('4. Nettoyage des logs');
            if (fs.existsSync(this.logPath)) {
                fs.writeFileSync(this.logPath, '');
                console.log(this.styles.success('✅ Logs nettoyés'));
            }
            
            console.log(this.styles.separator);
            console.log(this.styles.success('🎉 Réparation terminée!'));
            console.log(this.styles.info('💡 Utilisez "veko update check" pour vérifier les mises à jour'));
            
            return true;
        } catch (error) {
            console.log(this.styles.error(`❌ Erreur lors de la réparation: ${error.message}`));
            return false;
        }
    }

    // 📄 Récupération de la version actuelle plus robuste
    static getCurrentVersion() {
        try {
            if (!fs.existsSync(this.packageJsonPath)) {
                return null;
            }

            const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
            
            const vekoVersion = packageJson.dependencies?.veko || 
                               packageJson.devDependencies?.veko ||
                               packageJson.peerDependencies?.veko;

            if (!vekoVersion) {
                return null;
            }

            this.currentVersion = vekoVersion.replace(/[\^~>=<]/g, '');
            return this.currentVersion;
        } catch (error) {
            console.warn(`[Auto-updater] Erreur lors de la lecture de package.json: ${error.message}`);
            return null;
        }
    }

    // 📝 Système de logs amélioré avec gestion d'erreurs renforcée
    static log(level, message) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
            
            // Affichage console avec couleurs
            const colorMap = {
                error: this.styles.error,
                warn: this.styles.warning,
                info: this.styles.info,
                success: this.styles.success,
                debug: this.styles.dim
            };
            
            const colorFunc = colorMap[level] || chalk.white;
            console.log(colorFunc(`[${level.toUpperCase()}] ${message}`));
            
            // Écriture dans le fichier de log, mais seulement si accessible
            try {
                if (!fs.existsSync(path.dirname(this.logPath))) {
                    fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
                }
                fs.appendFileSync(this.logPath, logEntry);
                this.rotateLogFile();
            } catch (error) {
                // Ignore les erreurs d'écriture dans le fichier
            }
        } catch (error) {
            // Éviter les boucles infinies avec console.error
            console.error(`Erreur dans le système de log: ${error.message}`);
        }
    }
    
    // 📝 Méthode de fallback pour le logging d'erreurs
    static logError(message) {
        try {
            console.error(`[ERROR] ${message}`);
            // Tentative d'écriture dans le fichier de log
            if (fs.existsSync(path.dirname(this.logPath))) {
                const timestamp = new Date().toISOString();
                const logEntry = `[${timestamp}] [ERROR] ${message}\n`;
                fs.appendFileSync(this.logPath, logEntry);
            }
        } catch (e) {
            // Dernier recours
            console.error(`[Auto-updater] Erreur critique: ${message}`);
        }
    }

    // 🔧 CLI Handler pour les commandes avec meilleure gestion d'erreurs
    static async handleCLI(args = []) {
        const command = args[0];
        
        try {
            // Initialiser d'abord si pas déjà fait
            if (!this.config || Object.keys(this.config).length === 0) {
                await this.init();
            }
            
            // Vérifier les fonctions essentielles et les créer si manquantes
            if (typeof this.getCurrentVersion !== 'function') {
                throw new Error("getCurrentVersion is not a function - Auto-updater corrompu");
            }
            
            if (typeof this.log !== 'function') {
                // Recréer log à la volée si manquante
                this.log = this.logError;
            }
            
            switch (command) {
                case 'check':
                    return await this.checkForUpdates();
                
                case 'update':
                    return await this.performUpdateCommand();
                
                case 'config':
                    if (args[1] && args[2]) {
                        // Mise à jour d'une option spécifique
                        return await this.updateSetting(args[1], args[2]);
                    }
                    return await this.configureSettings();
                
                case 'rollback':
                    return await this.rollback(args[1]);
                
                case 'stats':
                case 'status':
                    return this.displayStats();
                
                case 'fix':
                    return await this.fixInstallation();
                
                case 'help':
                case '--help':
                case '-h':
                    return this.showHelp();
                
                case 'version':
                case '--version':
                case '-v':
                    return this.showVersion();
                
                case undefined:
                default:
                    // Par défaut, check seulement
                    return await this.checkForUpdates();
            }
        } catch (error) {
            console.error(`[Auto-updater] Erreur de commande: ${error.message}`);
            if (process.env.DEBUG) {
                console.error(error.stack);
            }
            return false;
        }
    }

    // 🔧 Mise à jour d'un paramètre
    static async updateSetting(key, value) {
        try {
            // Convertir la valeur en fonction du type attendu
            let parsedValue = value;
            if (value === 'true') parsedValue = true;
            if (value === 'false') parsedValue = false;
            if (!isNaN(parseInt(value))) parsedValue = parseInt(value);
            
            // Vérifier que la clé existe dans la configuration
            if (!(key in this.defaultConfig)) {
                console.log(this.styles.error(`❌ Paramètre inconnu: ${key}`));
                return false;
            }
            
            // Mettre à jour la configuration
            this.config[key] = parsedValue;
            await this.saveConfig();
            
            console.log(this.styles.success(`✅ Paramètre mis à jour: ${key} = ${parsedValue}`));
            return true;
        } catch (error) {
            console.log(this.styles.error(`❌ Erreur: ${error.message}`));
            return false;
        }
    }

    // 🔍 Comparaison de versions améliorée avec support des pre-release
    static compareVersions(version1, version2) {
        const parseVersion = (version) => {
            const [main, prerelease] = version.split('-');
            const [major, minor, patch] = main.split('.').map(n => parseInt(n));
            return { major, minor, patch, prerelease: prerelease || null };
        };
        
        const v1 = parseVersion(version1);
        const v2 = parseVersion(version2);
        
        // Compare major.minor.patch
        if (v1.major !== v2.major) return v1.major - v2.major;
        if (v1.minor !== v2.minor) return v1.minor - v2.minor;
        if (v1.patch !== v2.patch) return v1.patch - v2.patch;
        
        // Compare prerelease
        if (v1.prerelease && !v2.prerelease) return -1;
        if (!v1.prerelease && v2.prerelease) return 1;
        if (v1.prerelease && v2.prerelease) {
            return v1.prerelease.localeCompare(v2.prerelease);
        }
        
        return 0;
    }

    // 🔄 Rotation des logs
    static rotateLogFile() {
        try {
            if (!fs.existsSync(this.logPath)) return;
            
            const stats = fs.statSync(this.logPath);
            if (stats.size > 1024 * 1024) { // 1MB
                const rotatedPath = this.logPath + '.' + Date.now();
                fs.renameSync(this.logPath, rotatedPath);
                fs.writeFileSync(this.logPath, '');
                
                // Nettoyer les anciens logs
                const logDir = path.dirname(this.logPath);
                const files = fs.readdirSync(logDir)
                    .filter(file => file.startsWith(path.basename(this.logPath) + '.'))
                    .sort();
                
                // Garder seulement les 5 derniers logs
                if (files.length > 5) {
                    files.slice(0, files.length - 5).forEach(file => {
                        fs.unlinkSync(path.join(logDir, file));
                    });
                }
            }
        } catch (error) {
            // Ignorer les erreurs
        }
    }

    // 💾 Sauvegarde des statistiques
    static async saveStats() {
        try {
            if (fs.existsSync(this.packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
                packageJson.vekoUpdaterStats = this.stats;
                fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2));
            }
        } catch (error) {
            this.logError(`Impossible de sauvegarder les statistiques: ${error.message}`);
        }
    }
}

module.exports = AutoUpdater;