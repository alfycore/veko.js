// Fichier de l'auto-updater qui va vérifier si c'est la bonne version de veko 
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const { execSync, spawn } = require('child_process');
const readline = require('readline');
const chalk = require('chalk');

class AutoUpdater {
    static packageJsonPath = path.join(process.cwd(), 'package.json');
    static backupDir = path.join(process.cwd(), '.veko-backups');
    static configPath = path.join(process.cwd(), '.veko-updater.json');
    static logPath = path.join(process.cwd(), '.veko-updater.log');
    static currentVersion = null;
    static latestVersion = null;
    static rl = null;
    static config = {};
    static stats = {
        totalUpdates: 0,
        lastUpdate: null,
        lastCheck: null,
        rollbacks: 0
    };

    // 🎨 Styles visuels avancés
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
        selected: chalk.inverse.green,
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

    // 🚀 Initialisation avancée
    static async init() {
        await this.loadConfig();
        await this.loadStats();
        this.createDirectories();
        this.setupSignalHandlers();
        
        if (this.config.autoCheck) {
            this.scheduleAutoCheck();
        }
    }

    // 📁 Création des répertoires nécessaires
    static createDirectories() {
        [this.backupDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // ⚙️ Chargement de la configuration
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
            this.log('error', `Erreur lors du chargement de la configuration: ${error.message}`);
            this.config = { ...this.defaultConfig };
        }
    }

    // 💾 Sauvegarde de la configuration
    static async saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            this.log('error', `Erreur lors de la sauvegarde de la configuration: ${error.message}`);
        }
    }

    // 📊 Chargement des statistiques
    static async loadStats() {
        try {
            const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
            if (packageJson.vekoUpdaterStats) {
                this.stats = { ...this.stats, ...packageJson.vekoUpdaterStats };
            }
        } catch (error) {
            this.log('warn', `Impossible de charger les statistiques: ${error.message}`);
        }
    }

    // 💾 Sauvegarde des statistiques
    static async saveStats() {
        try {
            const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
            packageJson.vekoUpdaterStats = this.stats;
            fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2));
        } catch (error) {
            this.log('error', `Erreur lors de la sauvegarde des statistiques: ${error.message}`);
        }
    }

    // 📝 Système de logs avancé
    static log(level, message) {
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
        
        // Écriture dans le fichier de log
        try {
            fs.appendFileSync(this.logPath, logEntry);
            this.rotateLogFile();
        } catch (error) {
            console.error(chalk.red(`Erreur d'écriture dans le log: ${error.message}`));
        }
    }

    // 🔄 Rotation des fichiers de log
    static rotateLogFile() {
        try {
            const stats = fs.statSync(this.logPath);
            if (stats.size > 1024 * 1024) { // 1MB
                const rotatedPath = `${this.logPath}.${Date.now()}`;
                fs.renameSync(this.logPath, rotatedPath);
                
                // Garde seulement les 5 derniers logs
                const logFiles = fs.readdirSync(path.dirname(this.logPath))
                    .filter(file => file.startsWith(path.basename(this.logPath)))
                    .sort()
                    .slice(0, -5);
                
                logFiles.forEach(file => {
                    const filePath = path.join(path.dirname(this.logPath), file);
                    fs.unlinkSync(filePath);
                });
            }
        } catch (error) {
            // Ignore les erreurs de rotation
        }
    }

    // 🔄 Programmation de la vérification automatique
    static scheduleAutoCheck() {
        setInterval(async () => {
            try {
                await this.checkForUpdates(true);
            } catch (error) {
                this.log('error', `Erreur lors de la vérification automatique: ${error.message}`);
            }
        }, this.config.checkInterval);
    }

    // 🎯 Gestionnaires de signaux
    static setupSignalHandlers() {
        process.on('SIGINT', () => {
            this.log('info', 'Arrêt gracieux de l\'auto-updater');
            this.closeReadline();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            this.log('info', 'Arrêt du processus demandé');
            this.closeReadline();
            process.exit(0);
        });
    }

    // 🖥️ Interface readline avancée
    static initReadline() {
        if (!this.rl) {
            this.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                completer: this.autoCompleter.bind(this)
            });
            
            // Émojis et couleurs pour le prompt
            this.rl.setPrompt(chalk.cyan('🚀 veko-updater > '));
        }
    }

    // 🔍 Auto-complétion
    static autoCompleter(line) {
        const completions = ['update', 'check', 'config', 'rollback', 'stats', 'help', 'exit'];
        const hits = completions.filter((c) => c.startsWith(line));
        return [hits.length ? hits : completions, line];
    }

    static closeReadline() {
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
    }

    // ❓ Questions interactives avancées
    static async askQuestion(question, defaultValue = '', options = {}) {
        return new Promise((resolve) => {
            const { type = 'text', choices = [], validation = null } = options;
            
            let prompt = question;
            if (defaultValue) {
                prompt += ` ${this.styles.dim(`(défaut: ${defaultValue})`)}`;
            }
            
            if (type === 'select' && choices.length > 0) {
                prompt += '\n' + choices.map((choice, index) => 
                    `  ${this.styles.menu(index + 1)}. ${choice}`
                ).join('\n');
            }
            
            prompt += this.styles.accent(' > ');
            
            this.rl.question(prompt, (answer) => {
                const finalAnswer = answer.trim() || defaultValue;
                
                if (validation && !validation(finalAnswer)) {
                    console.log(this.styles.error('❌ Réponse invalide. Veuillez réessayer.'));
                    resolve(this.askQuestion(question, defaultValue, options));
                    return;
                }
                
                if (type === 'select' && choices.length > 0) {
                    const index = parseInt(finalAnswer) - 1;
                    if (index >= 0 && index < choices.length) {
                        resolve(choices[index]);
                        return;
                    }
                }
                
                resolve(finalAnswer);
            });
        });
    }

    // 🎨 Affichage du banner
    static displayBanner() {
        console.clear();
        console.log(this.styles.title(`
╔═══════════════════════════════════════════════════════════╗
║                    🚀 VEKO AUTO-UPDATER                  ║
║                   Le meilleur de Node.js                 ║
╚═══════════════════════════════════════════════════════════╝
        `));
        console.log(this.styles.separator);
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

    // 🔍 Vérification de mise à jour avec gestion avancée des canaux
    static async checkForUpdates(silent = false) {
        try {
            if (!silent) {
                this.displayBanner();
                console.log(this.styles.info('🔍 Vérification des mises à jour...'));
            }
            
            this.stats.lastCheck = new Date().toISOString();
            
            const currentVersion = this.getCurrentVersion();
            if (!currentVersion) {
                if (!silent) {
                    console.log(this.styles.warning('⚠️ Veko n\'est pas installé.'));
                }
                return { hasUpdate: false, needsInstall: true };
            }
            
            const versionInfo = await this.getVersionInfo();
            
            if (!versionInfo) {
                throw new Error('Impossible de récupérer les informations de version');
            }
            
            const comparison = this.compareVersions(currentVersion, versionInfo.latest);
            
            if (comparison < 0) {
                if (!silent) {
                    console.log(this.styles.warning(`⚠️ Nouvelle version disponible!`));
                    console.log(this.styles.info(`   Actuelle: ${this.styles.version(currentVersion)}`));
                    console.log(this.styles.info(`   Dernière: ${this.styles.version(versionInfo.latest)}`));
                    
                    if (versionInfo.changelog) {
                        console.log(this.styles.info('\n📋 Changelog:'));
                        console.log(this.styles.dim(versionInfo.changelog.slice(0, 200) + '...'));
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
                if (!silent) {
                    console.log(this.styles.success(`✅ Version à jour (${currentVersion})`));
                }
                return { hasUpdate: false, currentVersion };
            }
            
        } catch (error) {
            this.log('error', `Erreur lors de la vérification: ${error.message}`);
            if (!silent) {
                console.log(this.styles.error(`❌ ${error.message}`));
            }
            return { hasUpdate: false, error: error.message };
        }
    }

    // 🌐 Récupération des informations de version avancées
    static async getVersionInfo() {
        return new Promise((resolve, reject) => {
            const registry = this.config.customRegistry || 'registry.npmjs.org';
            const options = {
                hostname: registry,
                path: '/veko',
                method: 'GET',
                headers: {
                    'User-Agent': `veko-auto-updater/2.0.0 (${os.platform()} ${os.arch()})`,
                    'Accept': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const packageInfo = JSON.parse(data);
                        const channel = this.config.updateChannel;
                        
                        let version;
                        switch (channel) {
                            case 'stable':
                                version = packageInfo['dist-tags'].latest;
                                break;
                            case 'beta':
                                version = packageInfo['dist-tags'].beta || packageInfo['dist-tags'].latest;
                                break;
                            case 'alpha':
                                version = packageInfo['dist-tags'].alpha || packageInfo['dist-tags'].beta || packageInfo['dist-tags'].latest;
                                break;
                            default:
                                version = packageInfo['dist-tags'].latest;
                        }
                        
                        const versionInfo = packageInfo.versions[version];
                        
                        resolve({
                            latest: version,
                            changelog: versionInfo?.changelog || packageInfo.readme?.slice(0, 500),
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

            req.on('error', (error) => {
                reject(new Error(`Erreur de connexion: ${error.message}`));
            });

            req.setTimeout(15000, () => {
                req.destroy();
                reject(new Error('Timeout de connexion'));
            });

            req.end();
        });
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

    // 💾 Système de backup avancé
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

    // 🔄 Rollback vers un backup
    static async rollback(backupPath = null) {
        try {
            if (!backupPath) {
                const backups = fs.readdirSync(this.backupDir)
                    .filter(dir => dir.startsWith('backup-'))
                    .sort()
                    .reverse();
                
                if (backups.length === 0) {
                    throw new Error('Aucun backup disponible');
                }
                
                console.log(this.styles.warning('📋 Backups disponibles:'));
                backups.forEach((backup, index) => {
                    console.log(`  ${index + 1}. ${backup}`);
                });
                
                const choice = await this.askQuestion(
                    'Choisissez un backup à restaurer',
                    '1',
                    { type: 'select', choices: backups }
                );
                
                backupPath = path.join(this.backupDir, choice);
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

    // 🚀 Mise à jour avancée avec gestion d'erreurs
    static async performUpdate(versionInfo) {
        let backupPath = null;
        
        try {
            // Création du backup
            backupPath = await this.createBackup();
            
            console.log(this.styles.info('🚀 Mise à jour en cours...'));
            
            // Désinstallation de l'ancienne version
            console.log(this.styles.info('📦 Désinstallation de l\'ancienne version...'));
            execSync('npm uninstall veko', { stdio: 'pipe' });
            
            // Installation de la nouvelle version
            const installCommand = `npm install veko@${versionInfo.latestVersion}`;
            console.log(this.styles.info(`📦 Installation de veko@${versionInfo.latestVersion}...`));
            
            const installProcess = spawn('npm', ['install', `veko@${versionInfo.latestVersion}`], {
                stdio: ['pipe', 'pipe', 'pipe']
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

    // ⚙️ Menu de configuration interactif
    static async configureSettings() {
        this.displayBanner();
        console.log(this.styles.title('⚙️ Configuration de l\'auto-updater'));
        
        const options = [
            'Vérification automatique',
            'Mise à jour automatique',
            'Canal de mise à jour',
            'Nombre de backups',
            'Vérifications de sécurité',
            'Afficher la barre de progression',
            'Notifications',
            'Rollback automatique',
            'Sauvegarder et quitter'
        ];
        
        while (true) {
            console.log(this.styles.separator);
            console.log(this.styles.info('Configuration actuelle:'));
            console.log(`  1. Vérification auto: ${this.config.autoCheck ? '✅' : '❌'}`);
            console.log(`  2. Mise à jour auto: ${this.config.autoUpdate ? '✅' : '❌'}`);
            console.log(`  3. Canal: ${this.config.updateChannel}`);
            console.log(`  4. Backups: ${this.config.backupCount}`);
            console.log(`  5. Sécurité: ${this.config.securityCheck ? '✅' : '❌'}`);
            console.log(`  6. Barre de progression: ${this.config.progressBar ? '✅' : '❌'}`);
            console.log(`  7. Notifications: ${this.config.notifications ? '✅' : '❌'}`);
            console.log(`  8. Rollback auto: ${this.config.rollbackOnFailure ? '✅' : '❌'}`);
            console.log(`  9. Sauvegarder et quitter`);
            
            const choice = await this.askQuestion(
                '\nQue souhaitez-vous modifier ?',
                '9',
                { 
                    validation: (answer) => {
                        const num = parseInt(answer);
                        return num >= 1 && num <= 9;
                    }
                }
            );
            
            const choiceNum = parseInt(choice);
            
            switch (choiceNum) {
                case 1:
                    this.config.autoCheck = !this.config.autoCheck;
                    break;
                case 2:
                    this.config.autoUpdate = !this.config.autoUpdate;
                    break;
                case 3:
                    const channels = ['stable', 'beta', 'alpha'];
                    this.config.updateChannel = await this.askQuestion(
                        'Canal de mise à jour',
                        this.config.updateChannel,
                        { type: 'select', choices: channels }
                    );
                    break;
                case 4:
                    const backupCount = await this.askQuestion(
                        'Nombre de backups à conserver',
                        this.config.backupCount.toString(),
                        { validation: (answer) => !isNaN(parseInt(answer)) && parseInt(answer) > 0 }
                    );
                    this.config.backupCount = parseInt(backupCount);
                    break;
                case 5:
                    this.config.securityCheck = !this.config.securityCheck;
                    break;
                case 6:
                    this.config.progressBar = !this.config.progressBar;
                    break;
                case 7:
                    this.config.notifications = !this.config.notifications;
                    break;
                case 8:
                    this.config.rollbackOnFailure = !this.config.rollbackOnFailure;
                    break;
                case 9:
                    await this.saveConfig();
                    console.log(this.styles.success('✅ Configuration sauvegardée!'));
                    return;
            }
        }
    }

    // 🎯 Menu principal interactif
    static async showMainMenu() {
        this.displayBanner();
        
        const options = [
            'Vérifier les mises à jour',
            'Mettre à jour maintenant',
            'Voir les statistiques',
            'Gérer les backups',
            'Configuration',
            'Aide',
            'Quitter'
        ];
        
        console.log(this.styles.menu('🎯 Menu principal:'));
        options.forEach((option, index) => {
            console.log(`  ${this.styles.accent(index + 1)}. ${option}`);
        });
        
        const choice = await this.askQuestion(
            '\nVotre choix',
            '1',
            { 
                type: 'select',
                choices: options,
                validation: (answer) => {
                    const num = parseInt(answer);
                    return num >= 1 && num <= options.length;
                }
            }
        );
        
        const choiceNum = parseInt(choice);
        
        switch (choiceNum) {
            case 1:
                await this.checkAndUpdate();
                break;
            case 2:
                const updateInfo = await this.checkForUpdates();
                if (updateInfo.hasUpdate) {
                    await this.performUpdate(updateInfo);
                } else {
                    console.log(this.styles.info('Aucune mise à jour disponible.'));
                }
                break;
            case 3:
                this.displayStats();
                break;
            case 4:
                await this.manageBackups();
                break;
            case 5:
                await this.configureSettings();
                break;
            case 6:
                this.showHelp();
                break;
            case 7:
                console.log(this.styles.success('👋 Au revoir!'));
                return;
        }
        
        // Attend une touche avant de continuer
        await this.askQuestion('\nAppuyez sur Entrée pour continuer...');
        await this.showMainMenu();
    }

    // 💾 Gestion des backups
    static async manageBackups() {
        try {
            const backups = fs.readdirSync(this.backupDir)
                .filter(dir => dir.startsWith('backup-'))
                .map(dir => ({
                    name: dir,
                    path: path.join(this.backupDir, dir),
                    mtime: fs.statSync(path.join(this.backupDir, dir)).mtime,
                    size: this.getDirectorySize(path.join(this.backupDir, dir))
                }))
                .sort((a, b) => b.mtime - a.mtime);
            
            if (backups.length === 0) {
                console.log(this.styles.warning('Aucun backup disponible.'));
                return;
            }
            
            console.log(this.styles.title('\n💾 Gestion des backups'));
            console.log(this.styles.separator);
            
            backups.forEach((backup, index) => {
                const date = backup.mtime.toLocaleString();
                const size = this.formatBytes(backup.size);
                console.log(`${index + 1}. ${backup.name} (${date}) - ${size}`);
            });
            
            const actions = ['Restaurer un backup', 'Supprimer un backup', 'Retour'];
            const action = await this.askQuestion(
                '\nAction à effectuer',
                '3',
                { type: 'select', choices: actions }
            );
            
            if (action === 'Restaurer un backup') {
                const backupChoice = await this.askQuestion(
                    'Choisissez un backup à restaurer',
                    '1',
                    { type: 'select', choices: backups.map(b => b.name) }
                );
                
                const confirm = await this.askQuestion(
                    this.styles.warning('⚠️ Êtes-vous sûr de vouloir restaurer ce backup ? (o/n)'),
                    'n'
                );
                
                if (confirm.toLowerCase().startsWith('o')) {
                    const backupPath = path.join(this.backupDir, backupChoice);
                    await this.rollback(backupPath);
                }
            } else if (action === 'Supprimer un backup') {
                const backupChoice = await this.askQuestion(
                    'Choisissez un backup à supprimer',
                    '1',
                    { type: 'select', choices: backups.map(b => b.name) }
                );
                
                const confirm = await this.askQuestion(
                    this.styles.warning('⚠️ Êtes-vous sûr de vouloir supprimer ce backup ? (o/n)'),
                    'n'
                );
                
                if (confirm.toLowerCase().startsWith('o')) {
                    const backupPath = path.join(this.backupDir, backupChoice);
                    fs.rmSync(backupPath, { recursive: true, force: true });
                    console.log(this.styles.success('✅ Backup supprimé!'));
                }
            }
            
        } catch (error) {
            console.log(this.styles.error(`❌ Erreur: ${error.message}`));
        }
    }

    // 📏 Calcul de la taille d'un répertoire
    static getDirectorySize(dirPath) {
        let totalSize = 0;
        
        const walk = (dir) => {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.isDirectory()) {
                    walk(filePath);
                } else {
                    totalSize += stats.size;
                }
            });
        };
        
        walk(dirPath);
        return totalSize;
    }

    // 📊 Formatage des tailles
    static formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ❓ Aide
    static showHelp() {
        console.log(this.styles.title('\n❓ Aide - Veko Auto-Updater'));
        console.log(this.styles.separator);
        console.log(this.styles.info('Commandes disponibles:'));
        console.log('  • Vérifier les mises à jour : Vérifie si une nouvelle version est disponible');
        console.log('  • Mettre à jour maintenant : Force la mise à jour vers la dernière version');
        console.log('  • Voir les statistiques : Affiche les statistiques d\'utilisation');
        console.log('  • Gérer les backups : Restaurer ou supprimer des backups');
        console.log('  • Configuration : Modifier les paramètres de l\'auto-updater');
        console.log('');
        console.log(this.styles.info('Fonctionnalités:'));
        console.log('  ✅ Vérification automatique des mises à jour');
        console.log('  ✅ Backup automatique avant mise à jour');
        console.log('  ✅ Rollback en cas d\'échec');
        console.log('  ✅ Vérifications de sécurité et d\'intégrité');
        console.log('  ✅ Support des canaux de mise à jour (stable, beta, alpha)');
        console.log('  ✅ Interface interactive avec auto-complétion');
        console.log('  ✅ Logs détaillés avec rotation automatique');
        console.log('  ✅ Notifications système');
        console.log('  ✅ Statistiques détaillées');
        console.log(this.styles.separator);
    }

    // 🎯 Fonction principale améliorée
    static async checkAndUpdate() {
        try {
            await this.init();
            
            // Vérification si package.json existe
            if (!fs.existsSync(this.packageJsonPath)) {
                console.log(this.styles.error('❌ Le fichier package.json est manquant.'));
                const created = await this.createPackageJson();
                if (!created) return false;
                return true;
            }

            // Vérification des mises à jour
            const updateInfo = await this.checkForUpdates();
            
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
                if (this.config.autoUpdate) {
                    return await this.performUpdate(updateInfo);
                } else {
                    const shouldUpdate = await this.askForUpdate(updateInfo);
                    if (shouldUpdate) {
                        return await this.performUpdate(updateInfo);
                    }
                }
            }
            
            return true;
            
        } catch (error) {
            this.log('error', `Erreur inattendue: ${error.message}`);
            console.log(this.styles.error(`❌ Erreur inattendue: ${error.message}`));
            return false;
        }
    }

    // 🤔 Demande de confirmation pour mise à jour
    static async askForUpdate(updateInfo) {
        this.initReadline();
        
        console.log(this.styles.title('\n🚀 Mise à jour disponible!'));
        console.log(this.styles.separator);
        console.log(this.styles.info(`Version actuelle: ${this.styles.version(updateInfo.currentVersion)}`));
        console.log(this.styles.info(`Nouvelle version: ${this.styles.version(updateInfo.latestVersion)}`));
        
        if (updateInfo.security) {
            console.log(this.styles.error('🔒 Cette mise à jour contient des correctifs de sécurité importants!'));
        }
        
        const shouldUpdate = await this.askQuestion(
            this.styles.accent('Voulez-vous mettre à jour maintenant ? (o/n)'),
            'o'
        );
        
        this.closeReadline();
        return shouldUpdate.toLowerCase().startsWith('o') || shouldUpdate.toLowerCase().startsWith('y');
    }

    // 🎯 Fonction de vérification rapide
    static checkVersion() {
        const currentVersion = this.getCurrentVersion();
        if (!currentVersion) {
            return false;
        }

        console.log(this.styles.success(`✅ Veko version ${currentVersion} détectée`));
        return true;
    }

    // 📋 Collecte des informations de projet améliorée
    static async collectProjectInfo() {
        console.log(this.styles.title('\n📋 Configuration du nouveau projet Veko'));
        console.log(this.styles.dim('Appuyez sur Entrée pour utiliser les valeurs par défaut\n'));

        const projectInfo = {};

        // Nom du projet avec validation
        projectInfo.name = await this.askQuestion(
            this.styles.menu('📦 Nom du projet'), 
            path.basename(process.cwd()).toLowerCase().replace(/\s+/g, '-'),
            { 
                validation: (name) => /^[a-z0-9-_]+$/.test(name) 
            }
        );

        // Version avec validation semver
        projectInfo.version = await this.askQuestion(
            this.styles.menu('🔢 Version initiale'), 
            '1.0.0',
            { 
                validation: (version) => /^\d+\.\d+\.\d+$/.test(version) 
            }
        );

        // Description
        projectInfo.description = await this.askQuestion(
            this.styles.menu('📝 Description du projet'), 
            'Un projet utilisant le framework Veko'
        );

        // Fichier principal
        projectInfo.main = await this.askQuestion(
            this.styles.menu('📄 Fichier principal'), 
            'index.js'
        );

        // Auteur
        projectInfo.author = await this.askQuestion(
            this.styles.menu('👤 Auteur'), 
            ''
        );

        // Email
        const email = await this.askQuestion(
            this.styles.menu('📧 Email (optionnel)'), 
            '',
            { 
                validation: (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) 
            }
        );

        if (email) {
            projectInfo.author = projectInfo.author 
                ? `${projectInfo.author} <${email}>` 
                : `<${email}>`;
        }

        // Licence avec choix amélioré
        const licenseOptions = ['ISC', 'MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'Unlicense'];
        console.log(this.styles.info('\n📜 Licences disponibles:'));
        licenseOptions.forEach((license, index) => {
            console.log(this.styles.dim(`  ${index + 1}. ${license}`));
        });
        
        const licenseChoice = await this.askQuestion(
            this.styles.menu('📜 Licence (numéro ou nom)'), 
            'ISC'
        );

        const licenseNumber = parseInt(licenseChoice);
        if (licenseNumber >= 1 && licenseNumber <= licenseOptions.length) {
            projectInfo.license = licenseOptions[licenseNumber - 1];
        } else if (licenseOptions.includes(licenseChoice)) {
            projectInfo.license = licenseChoice;
        } else {
            projectInfo.license = licenseChoice || 'ISC';
        }

        // Repository
        const repository = await this.askQuestion(
            this.styles.menu('🔗 URL du repository Git (optionnel)'), 
            ''
        );

        if (repository) {
            projectInfo.repository = {
                type: 'git',
                url: repository
            };
        }

        // Mots-clés
        const keywords = await this.askQuestion(
            this.styles.menu('🏷️ Mots-clés (séparés par des virgules)'), 
            'veko, framework, javascript'
        );

        projectInfo.keywords = keywords.split(',').map(k => k.trim()).filter(k => k);

        // Scripts
        const startScript = await this.askQuestion(
            this.styles.menu('▶️ Script de démarrage (npm start)'), 
            'node ' + projectInfo.main
        );

        const devScript = await this.askQuestion(
            this.styles.menu('🔧 Script de développement (npm run dev)'), 
            'nodemon ' + projectInfo.main
        );

        const buildScript = await this.askQuestion(
            this.styles.menu('🏗️ Script de build (npm run build)'), 
            ''
        );

        projectInfo.scripts = {
            test: "echo \"Error: no test specified\" && exit 1",
            start: startScript
        };

        if (devScript && devScript !== startScript) {
            projectInfo.scripts.dev = devScript;
        }

        if (buildScript) {
            projectInfo.scripts.build = buildScript;
        }

        return projectInfo;
    }

    // 📄 Création de package.json améliorée
    static async createPackageJson() {
        try {
            this.initReadline();
            
            console.log(this.styles.warning('\n🎯 Le fichier package.json est manquant.'));
            console.log(this.styles.info('📋 Nous allons le créer ensemble!\n'));

            const projectInfo = await this.collectProjectInfo();

            // Affichage du récapitulatif
            console.log(this.styles.title('\n📋 Récapitulatif de votre projet:'));
            console.log(this.styles.separator);
            console.log(this.styles.highlight(`   📦 Nom: ${projectInfo.name}`));
            console.log(this.styles.highlight(`   🔢 Version: ${projectInfo.version}`));
            console.log(this.styles.highlight(`   📝 Description: ${projectInfo.description}`));
            console.log(this.styles.highlight(`   📄 Fichier principal: ${projectInfo.main}`));
            console.log(this.styles.highlight(`   👤 Auteur: ${projectInfo.author || 'Non spécifié'}`));
            console.log(this.styles.highlight(`   📜 Licence: ${projectInfo.license}`));
            
            if (projectInfo.repository) {
                console.log(this.styles.highlight(`   🔗 Repository: ${projectInfo.repository.url}`));
            }
            
            console.log(this.styles.highlight(`   🏷️ Mots-clés: ${projectInfo.keywords.join(', ')}`));
            console.log(this.styles.separator);

            const confirm = await this.askQuestion(
                this.styles.accent('✅ Confirmer la création du package.json ? (o/n)'), 
                'o'
            );

            this.closeReadline();

            if (confirm.toLowerCase().startsWith('o') || confirm.toLowerCase().startsWith('y')) {
                const packageJsonContent = {
                    name: projectInfo.name,
                    version: projectInfo.version,
                    description: projectInfo.description,
                    main: projectInfo.main,
                    scripts: projectInfo.scripts,
                    keywords: projectInfo.keywords,
                    author: projectInfo.author,
                    license: projectInfo.license,
                    dependencies: {
                        veko: "latest"
                    },
                    vekoUpdaterConfig: {
                        ...this.defaultConfig
                    }
                };

                if (projectInfo.repository) {
                    packageJsonContent.repository = projectInfo.repository;
                }

                fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJsonContent, null, 2));
                
                console.log(this.styles.success('\n✅ package.json créé avec succès!'));
                console.log(this.styles.info('📦 Installation de Veko en cours...'));
                
                try {
                    execSync('npm install', { stdio: 'inherit' });
                    console.log(this.styles.success('✅ Veko installé avec succès!'));
                    console.log(this.styles.info('🎉 Votre projet est prêt à être utilisé!'));
                } catch (error) {
                    console.log(this.styles.warning('⚠️ Erreur lors de l\'installation automatique.'));
                    console.log(this.styles.info('💡 Exécutez manuellement: npm install'));
                }

                return true;
            } else {
                console.log(this.styles.warning('❌ Création annulée.'));
                return false;
            }

        } catch (error) {
            this.closeReadline();
            this.log('error', `Erreur lors de la création de package.json: ${error.message}`);
            console.log(this.styles.error(`❌ Erreur: ${error.message}`));
            return false;
        }
    }

    // 📄 Récupération de la version actuelle améliorée
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
            this.log('error', `Erreur lors de la lecture de package.json: ${error.message}`);
            return null;
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

    // 🎯 Fonction d'entrée interactive
    static async interactive() {
        await this.init();
        await this.showMainMenu();
    }

    // 🎯 Activation automatique de l'auto-updater
    static async activate() {
        try {
            this.initReadline();
            
            console.log(this.styles.title('🚀 Activation de l\'auto-updater Veko'));
            console.log(this.styles.separator);
            
            await this.init();
            
            // Premier lancement : affichage de bienvenue
            if (!fs.existsSync(this.configPath)) {
                await this.showWelcomeMessage();
            }
            
            // Vérification immédiate
            console.log(this.styles.info('🔍 Vérification initiale...'));
            const updateInfo = await this.checkForUpdates(true);
            
            if (updateInfo.hasUpdate) {
                console.log(this.styles.warning('🎉 Une mise à jour est disponible!'));
                console.log(this.styles.info(`Version actuelle: ${this.styles.version(updateInfo.currentVersion)}`));
                console.log(this.styles.info(`Nouvelle version: ${this.styles.version(updateInfo.latestVersion)}`));
                
                const autoUpdate = await this.askQuestion(
                    this.styles.accent('Voulez-vous activer les mises à jour automatiques ? (o/n)'),
                    'n'
                );
                
                if (autoUpdate.toLowerCase().startsWith('o')) {
                    this.config.autoUpdate = true;
                    await this.saveConfig();
                    console.log(this.styles.success('✅ Mises à jour automatiques activées'));
                } else {
                    console.log(this.styles.info('ℹ️ Mises à jour manuelles conservées'));
                }
            } else if (updateInfo.needsInstall) {
                console.log(this.styles.warning('⚠️ Veko n\'est pas installé correctement'));
                console.log(this.styles.info('💡 Utilisez "npm install veko" pour l\'installer'));
            } else {
                console.log(this.styles.success('✅ Veko est à jour!'));
            }
            
            // Programme les vérifications automatiques
            if (this.config.autoCheck) {
                console.log(this.styles.info('⏰ Vérifications automatiques programmées'));
            }
            
            console.log(this.styles.separator);
            console.log(this.styles.success('🎉 Auto-updater Veko activé avec succès!'));
            console.log(this.styles.info('💡 Utilisez "npx veko-update" pour ouvrir le menu principal'));
            console.log(this.styles.info('💡 Utilisez "npx veko-update --help" pour voir toutes les commandes'));
            
            this.closeReadline();
            return true;
            
        } catch (error) {
            this.log('error', `Erreur lors de l'activation: ${error.message}`);
            console.log(this.styles.error(`❌ Erreur lors de l'activation: ${error.message}`));
            this.closeReadline();
            return false;
        }
    }

    // 🖥️ Interface en ligne de commande
    static async handleCLI(args = []) {
        const command = args[0];
        
        switch (command) {
            case 'check':
                return await this.checkForUpdates();
            case 'update':
                return await this.checkAndUpdate();
            case 'config':
                return await this.configureSettings();
            case 'rollback':
                return await this.rollback(args[1]);
            case 'stats':
                return this.displayStats();
            case 'activate':
                return await this.activate();
            case 'help':
                return this.showCLIHelp();
            default:
                return await this.interactive();
        }
    }

    // 🔧 Aide CLI
    static showCLIHelp() {
        console.log(this.styles.title('\n❓ Aide - Veko Auto-Updater CLI'));
        console.log(this.styles.separator);
        console.log('Usage: npx veko-update [command] [options]');
        console.log('');
        console.log('Commandes disponibles:');
        console.log('  check     - Vérifier les mises à jour');
        console.log('  update    - Mettre à jour maintenant');
        console.log('  config    - Configurer l\'auto-updater');
        console.log('  rollback  - Effectuer un rollback');
        console.log('  stats     - Afficher les statistiques');
        console.log('  activate  - Configuration initiale');
        console.log('  help      - Afficher cette aide');
        console.log(this.styles.separator);
    }
}

// 🚀 Auto-exécution si appelé directement
if (require.main === module) {
    AutoUpdater.main().catch(error => {
        console.error(chalk.red(`Erreur fatale: ${error.message}`));
        process.exit(1);
    });
}

module.exports = AutoUpdater;