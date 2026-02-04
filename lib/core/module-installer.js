const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

class ModuleInstaller {
  static requiredModules = {
    'express': '^4.18.2',
    'ejs': '^3.1.9',
    'ws': '^8.14.2',
    'chokidar': '^3.5.3',
    'chalk': '^4.1.2',
    'commander': '^11.1.0',
    'helmet': '^7.0.0',
    'express-rate-limit': '^7.0.0',
    'validator': '^13.11.0'
  };

  static optionalModules = {
    'bcryptjs': '^2.4.3',
    'express-session': '^1.17.3',
    'sqlite3': '^5.1.6'
  };

  static installationQueue = [];

  static async checkAndInstall() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    let packageJson = {};

    try {
      if (fs.existsSync(packageJsonPath)) {
        const content = fs.readFileSync(packageJsonPath, 'utf8');
        packageJson = JSON.parse(content);
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors de la lecture du package.json:', error.message);
    }

    const missingModules = [];

    for (const [moduleName, version] of Object.entries(this.requiredModules)) {
      try {
        require.resolve(moduleName);
      } catch (error) {
        missingModules.push({ name: moduleName, version });
      }
    }

    if (missingModules.length > 0) {
      console.log('\n🔍 Modules manquants détectés...');
      console.log('📦 Installation automatique en cours...\n');

      let successCount = 0;
      for (const module of missingModules) {
        try {
          await this.installModule(module.name, module.version);
          successCount++;
        } catch (err) {
          console.error(`⚠️ Échec de l'installation de ${module.name}: ${err.message}`);
        }
      }

      if (successCount === missingModules.length) {
        console.log('\n✅ Tous les modules ont été installés avec succès!\n');
      } else {
        console.log(`\n⚠️ ${successCount}/${missingModules.length} modules installés.\n`);
      }
    }
  }

  static async installModule(moduleName, version = 'latest') {
    // Protection contre les installations simultanées du même module
    const moduleKey = `${moduleName}@${version}`;
    
    if (this.installationQueue.includes(moduleKey)) {
      console.log(`⏳ ${moduleName} déjà en cours d'installation...`);
      return true;
    }

    this.installationQueue.push(moduleKey);

    try {
      console.log(`📥 Installation de ${moduleName}@${version}...`);
      
      // Validation du nom du module pour éviter les injections de commandes
      if (!/^[@a-zA-Z0-9-_./]+$/.test(moduleName)) {
        throw new Error('Nom de module invalide');
      }

      const command = `npm install ${moduleName}@${version} --save`;
      execSync(command, { 
        stdio: 'pipe',
        cwd: process.cwd(),
        timeout: 120000 // 2 minutes timeout
      });
      
      console.log(`✅ ${moduleName} installé avec succès!`);
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de l'installation de ${moduleName}:`, error.message);
      throw error;
    } finally {
      // Retirer de la queue
      const index = this.installationQueue.indexOf(moduleKey);
      if (index > -1) {
        this.installationQueue.splice(index, 1);
      }
    }
  }

  static createPackageJsonIfNeeded() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      console.log('📄 Création du package.json...');
      
      const packageJson = {
        name: "veko-app",
        version: "1.0.0",
        description: "Application Veko.js",
        main: "app.js",
        scripts: {
          dev: "node app.js",
          start: "node app.js"
        },
        dependencies: this.requiredModules
      };

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ package.json créé!');
    }
  }
}

module.exports = ModuleInstaller;