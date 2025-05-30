@echo off
echo 🔧 Correction des fichiers manquants...

:: Créer lib/app.js si manquant
if not exist "lib\app.js" (
    echo Création de lib/app.js...
    mkdir lib 2>nul
    echo const express = require('express'); > lib\app.js
    echo const path = require('path'); >> lib\app.js
    echo. >> lib\app.js
    echo class App { >> lib\app.js
    echo   constructor(options = {}) { >> lib\app.js
    echo     this.express = express(); >> lib\app.js
    echo     this.init(); >> lib\app.js
    echo   } >> lib\app.js
    echo   init() { >> lib\app.js
    echo     this.express.set('view engine', 'ejs'); >> lib\app.js
    echo     this.express.set('views', path.join(process.cwd(), 'views')); >> lib\app.js
    echo   } >> lib\app.js
    echo } >> lib\app.js
    echo module.exports = App; >> lib\app.js
)

:: Créer lib/router.js si manquant
if not exist "lib\router.js" (
    echo Création de lib/router.js...
    echo const express = require('express'); > lib\router.js
    echo class Router { >> lib\router.js
    echo   constructor() { this.router = express.Router(); } >> lib\router.js
    echo } >> lib\router.js
    echo module.exports = Router; >> lib\router.js
)

:: Créer lib/controller.js si manquant
if not exist "lib\controller.js" (
    echo Création de lib/controller.js...
    echo class Controller {} > lib\controller.js
    echo module.exports = Controller; >> lib\controller.js
)

:: Tester le framework
echo 🧪 Test du framework...
node -e "try { require('./index.js'); console.log('✅ Framework OK'); } catch(e) { console.log('❌ Erreur:', e.message); }"

echo ✅ Correction terminée!
pause