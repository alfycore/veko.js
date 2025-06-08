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
    'commander': '^11.1.0'
  };

  static async checkAndInstall() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    let packageJson = {};

    if (fs.existsSync(packageJsonPath)) {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
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

      for (const module of missingModules) {
        await this.installModule(module.name, module.version);
      }

      console.log('\n✅ Tous les modules ont été installés avec succès!\n');
    }
  }

  static async installModule(moduleName, version) {
    try {
      console.log(`📥 Installation de ${moduleName}@${version}...`);
      
      const command = `npm install ${moduleName}@${version}`;
      execSync(command, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      console.log(`✅ ${moduleName} installé avec succès!`);
    } catch (error) {
      console.error(`❌ Erreur lors de l'installation de ${moduleName}:`, error.message);
      process.exit(1);
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