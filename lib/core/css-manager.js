// Fichier pour le framwork veko permettant de faire des css plus simplifies
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const { createRequire } = require('module');
const require = createRequire(import.meta.url);
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

class CssManager {
    constructor(options = {}) {
        this.options = {
            inputDir: options.inputDir || 'src/css',
            outputDir: options.outputDir || 'public/css',
            isDev: options.isDev || false,
            plugins: options.plugins || [],
            enableSimplifiedSyntax: options.enableSimplifiedSyntax !== false,
            theme: options.theme || {},
            autoprefixer: options.autoprefixer !== false,
            minify: options.minify !== false && !options.isDev,
            sourceMap: options.sourceMap || options.isDev
        };
        
        // Initialiser les plugins PostCSS
        this.plugins = [
            ...(this.options.autoprefixer ? [autoprefixer()] : []),
            ...this.options.plugins || [],
            ...(this.options.minify ? [cssnano({ preset: 'default' })] : [])
        ];
        
        // Variables prédéfinies pour la syntaxe simplifiée
        this.variables = {
            // Couleurs de base
            primary: '#3490dc',
            secondary: '#ffed4a',
            success: '#38c172',
            danger: '#e3342f',
            warning: '#f6993f',
            info: '#6cb2eb',
            light: '#f8f9fa',
            dark: '#343a40',
            
            // Tailles d'espacement
            'space-xs': '0.25rem',
            'space-sm': '0.5rem',
            'space-md': '1rem',
            'space-lg': '1.5rem',
            'space-xl': '2rem',
            
            // Tailles de police
            'font-xs': '0.75rem',
            'font-sm': '0.875rem',
            'font-md': '1rem',
            'font-lg': '1.125rem',
            'font-xl': '1.25rem',
            
            // Breakpoints
            'mobile': '576px',
            'tablet': '768px',
            'desktop': '992px',
            'widescreen': '1200px',
            
            // Autres
            'radius': '0.25rem',
            'radius-lg': '0.5rem',
            'shadow': '0 2px 4px rgba(0,0,0,0.1)',
            'transition': 'all 0.3s ease',
            
            // Merge avec les variables du thème
            ...this.options.theme
        };
        
        // Raccourcis pour les propriétés fréquemment utilisées
        this.shortcuts = {
            // Dimensions
            w: 'width',
            h: 'height',
            minw: 'min-width',
            minh: 'min-height',
            maxw: 'max-width',
            maxh: 'max-height',
            
            // Marges et padding
            m: 'margin',
            mt: 'margin-top',
            mr: 'margin-right',
            mb: 'margin-bottom',
            ml: 'margin-left',
            mx: ['margin-left', 'margin-right'],
            my: ['margin-top', 'margin-bottom'],
            
            p: 'padding',
            pt: 'padding-top',
            pr: 'padding-right',
            pb: 'padding-bottom',
            pl: 'padding-left',
            px: ['padding-left', 'padding-right'],
            py: ['padding-top', 'padding-bottom'],
            
            // Flexbox
            flex: 'display: flex',
            'flex-col': 'flex-direction: column',
            'flex-row': 'flex-direction: row',
            'items-center': 'align-items: center',
            'justify-center': 'justify-content: center',
            'justify-between': 'justify-content: space-between',
            'justify-around': 'justify-content: space-around',
            'justify-end': 'justify-content: flex-end',
            'justify-start': 'justify-content: flex-start',
            
            // Texte
            'text-center': 'text-align: center',
            'text-left': 'text-align: left',
            'text-right': 'text-align: right',
            'text-bold': 'font-weight: bold',
            'text-normal': 'font-weight: normal',
            'text-italic': 'font-style: italic',
            'uppercase': 'text-transform: uppercase',
            'lowercase': 'text-transform: lowercase',
            
            // Position
            relative: 'position: relative',
            absolute: 'position: absolute',
            fixed: 'position: fixed',
            sticky: 'position: sticky',
            
            // Display
            block: 'display: block',
            inline: 'display: inline',
            'inline-block': 'display: inline-block',
            none: 'display: none',
            
            // Bordures
            'rounded': `border-radius: ${this.variables['radius']}`,
            'rounded-lg': `border-radius: ${this.variables['radius-lg']}`,
            'rounded-full': 'border-radius: 9999px',
            
            // Effets
            'shadow-sm': 'box-shadow: 0 1px 2px rgba(0,0,0,0.05)',
            'shadow': `box-shadow: ${this.variables['shadow']}`,
            'shadow-lg': 'box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
            
            // Grille
            grid: 'display: grid',
            
            // Autres
            'hidden': 'display: none',
            'overflow-hidden': 'overflow: hidden',
            'overflow-auto': 'overflow: auto',
            'cursor-pointer': 'cursor: pointer',
            'opacity-0': 'opacity: 0',
            'opacity-50': 'opacity: 0.5',
            'opacity-100': 'opacity: 1'
        };
        
        this.init();
    };
    
    init() {
        this.ensureDirectories();
        this.processCssFiles();
    }
    
    ensureDirectories() {
        if (!fs.existsSync(this.options.outputDir)) {
            fs.mkdirSync(this.options.outputDir, { recursive: true });
            console.log(chalk.green(`📂 Dossier de sortie créé: ${this.options.outputDir}`));
        }
    }
    
    processCssFiles() {
        const inputFiles = fs.readdirSync(this.options.inputDir).filter(file => 
            file.endsWith('.css') || file.endsWith('.vcss') || file.endsWith('.veko')
        );
        
        if (inputFiles.length === 0) {
            console.warn(chalk.yellow(`⚠️ Aucun fichier CSS trouvé dans ${this.options.inputDir}`));
            return;
        }

        inputFiles.forEach(file => {
            const inputFilePath = path.join(this.options.inputDir, file);
            const outputFileName = file.replace(/\.vcss$|\.veko$/, '.css');
            const outputFilePath = path.join(this.options.outputDir, outputFileName);

            const fileContent = fs.readFileSync(inputFilePath, 'utf8');
            const isSimplifiedSyntax = file.endsWith('.vcss') || file.endsWith('.veko');
            
            let cssContent = fileContent;
            
            // Traiter la syntaxe simplifiée si applicable
            if (isSimplifiedSyntax && this.options.enableSimplifiedSyntax) {
                try {
                    cssContent = this.parseSimplifiedSyntax(fileContent);
                    console.log(chalk.blue(`🔄 Syntaxe simplifiée convertie pour ${file}`));
                } catch (error) {
                    console.error(chalk.red(`❌ Erreur de parsing pour ${file}: ${error.message}`));
                    return;
                }
            }
            
            // Appliquer les post-processeurs
            postcss(this.plugins)
                .process(cssContent, { 
                    from: inputFilePath, 
                    to: outputFilePath,
                    map: this.options.sourceMap ? { inline: true } : false
                })
                .then(result => {
                    fs.writeFileSync(outputFilePath, result.css);
                    console.log(chalk.green(`✅ Fichier traité: ${file} -> ${outputFileName}`));
                })
                .catch(error => {
                    console.error(chalk.red(`❌ Erreur lors du traitement de ${file}: ${error.message}`));
                });
        });
    }

    watch() {
        if (!this.options.isDev) {
            console.warn(chalk.yellow('⚠️ Le mode de surveillance est activé uniquement en mode développement.'));
            return;
        }

        const chokidar = require('chokidar');
        const watchPattern = path.join(this.options.inputDir, '**/*.{css,vcss,veko}');
        
        console.log(chalk.blue(`👀 Surveillance des fichiers: ${watchPattern}`));
        
        chokidar.watch(watchPattern, { persistent: true })
            .on('change', (filePath) => {
                console.log(chalk.blue(`🔄 Fichier modifié: ${filePath}`));
                this.processSingleFile(filePath);
            })
            .on('add', (filePath) => {
                console.log(chalk.green(`➕ Nouveau fichier détecté: ${filePath}`));
                this.processSingleFile(filePath);
            })
            .on('error', (error) => {
                console.error(chalk.red(`❌ Erreur de surveillance: ${error.message}`));
            });
    }
    
    processSingleFile(filePath) {
        const file = path.basename(filePath);
        const outputFileName = file.replace(/\.vcss$|\.veko$/, '.css');
        const outputFilePath = path.join(this.options.outputDir, outputFileName);
        
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const isSimplifiedSyntax = file.endsWith('.vcss') || file.endsWith('.veko');
            
            let cssContent = fileContent;
            
            if (isSimplifiedSyntax && this.options.enableSimplifiedSyntax) {
                cssContent = this.parseSimplifiedSyntax(fileContent);
                console.log(chalk.blue(`🔄 Syntaxe simplifiée convertie pour ${file}`));
            }
            
            postcss(this.plugins)
                .process(cssContent, { 
                    from: filePath, 
                    to: outputFilePath,
                    map: this.options.sourceMap ? { inline: true } : false
                })
                .then(result => {
                    fs.writeFileSync(outputFilePath, result.css);
                    console.log(chalk.green(`✅ Fichier traité: ${file} -> ${outputFileName}`));
                })
                .catch(error => {
                    console.error(chalk.red(`❌ Erreur lors du traitement de ${file}: ${error.message}`));
                });
        } catch (error) {
            console.error(chalk.red(`❌ Erreur de traitement pour ${file}: ${error.message}`));
        }
    }

    // Syntaxe simplifiée de CSS pour Veko
    parseSimplifiedSyntax(input) {
        // Traitement des variables
        let content = this.processVariables(input);
        
        // Traitement des importations
        content = this.processImports(content);
        
        // Traitement des blocs
        content = this.processBlocks(content);
        
        // Traitement des raccourcis
        content = this.processShortcuts(content);
        
        // Traitement des sélecteurs spéciaux
        content = this.processSpecialSelectors(content);
        
        // Traitement des fonctions
        content = this.processFunctions(content);
        
        // Traitement des media queries simplifiées
        content = this.processMediaQueries(content);
        
        return content;
    }
    
    processVariables(content) {
        // Traiter les déclarations de variables
        const variableRegex = /\$([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
        content = content.replace(variableRegex, (match, varName, varValue) => {
            this.variables[varName] = varValue.trim();
            return `/* Variable ${varName} définie */`;
        });
        
        // Remplacer les références aux variables
        const varReferenceRegex = /\$([a-zA-Z0-9-_]+)/g;
        return content.replace(varReferenceRegex, (match, varName) => {
            if (this.variables[varName] !== undefined) {
                return this.variables[varName];
            }
            console.warn(chalk.yellow(`⚠️ Variable non définie: ${varName}`));
            return match;
        });
    }
    
    processImports(content) {
        // Traiter les imports simplifiés
        const importRegex = /@import\s+["']?([^"';]+)["']?;/g;
        
        return content.replace(importRegex, (match, importPath) => {
            // Vérifier si le chemin est relatif ou absolu
            const isRelative = !path.isAbsolute(importPath);
            let fullPath;
            
            if (isRelative) {
                fullPath = path.join(this.options.inputDir, importPath);
            } else {
                fullPath = importPath;
            }
            
            // Ajouter l'extension si nécessaire
            if (!path.extname(fullPath)) {
                const extensions = ['.vcss', '.veko', '.css'];
                for (const ext of extensions) {
                    const pathWithExt = fullPath + ext;
                    if (fs.existsSync(pathWithExt)) {
                        fullPath = pathWithExt;
                        break;
                    }
                }
            }
            
            // Lire et traiter le fichier importé
            try {
                if (!fs.existsSync(fullPath)) {
                    console.warn(chalk.yellow(`⚠️ Fichier d'import introuvable: ${fullPath}`));
                    return `/* Erreur d'import: ${importPath} */`;
                }
                
                let importContent = fs.readFileSync(fullPath, 'utf8');
                const isSimplifiedSyntax = fullPath.endsWith('.vcss') || fullPath.endsWith('.veko');
                
                if (isSimplifiedSyntax) {
                    importContent = this.parseSimplifiedSyntax(importContent);
                }
                
                return importContent;
            } catch (error) {
                console.error(chalk.red(`❌ Erreur lors de l'import de ${fullPath}: ${error.message}`));
                return `/* Erreur d'import: ${error.message} */`;
            }
        });
    }
    
    processBlocks(content) {
        // Traiter la syntaxe simplifiée des blocs
        // Exemple: .btn { bg: blue; pad: 10px; } -> .btn { background: blue; padding: 10px; }
        
        const blockRegex = /([^\s{]+)\s*{([^}]*)}/g;
        
        return content.replace(blockRegex, (match, selector, declarations) => {
            const processedDeclarations = this.processDeclarations(declarations);
            return `${selector} {\n${processedDeclarations}\n}`;
        });
    }
    
    processDeclarations(declarations) {
        let result = '';
        const lines = declarations.split(';').map(line => line.trim());
        
        for (let line of lines) {
            if (!line) continue;
            
            // Traiter les déclarations raccourcies
            const parts = line.split(':').map(part => part.trim());
            
            if (parts.length < 2) continue;
            
            const prop = parts[0];
            const value = parts.slice(1).join(':');
            
            // Gérer les raccourcis
            if (this.shortcuts[prop]) {
                if (typeof this.shortcuts[prop] === 'string') {
                    // Raccourci simple
                    result += `${this.shortcuts[prop]}: ${value};\n`;
                } else if (Array.isArray(this.shortcuts[prop])) {
                    // Raccourci multiple
                    this.shortcuts[prop].forEach(fullProp => {
                        result += `${fullProp}: ${value};\n`;
                    });
                }
            } else {
                // Valeurs prédéfinies pour certaines propriétés
                const processedValue = this.processPropertyValue(prop, value);
                result += `${prop}: ${processedValue};\n`;
            }
        }
        
        return result;
    }
    
    processPropertyValue(property, value) {
        // Traiter les valeurs spéciales
        switch (property) {
            case 'bg':
                return value.replace(/^(\w+)$/, (m, color) => this.getColorValue(color));
            case 'color':
            case 'border-color':
            case 'background-color':
                return this.getColorValue(value);
            case 'size':
                return value.replace(/^(\d+)$/, '$1px');
            default:
                return value;
        }
    }
    
    getColorValue(colorName) {
        // Vérifier si c'est une couleur prédéfinie
        const predefinedColors = {
            primary: this.variables.primary,
            secondary: this.variables.secondary,
            success: this.variables.success,
            danger: this.variables.danger,
            warning: this.variables.warning,
            info: this.variables.info,
            light: this.variables.light,
            dark: this.variables.dark
        };
        
        return predefinedColors[colorName] || colorName;
    }
    
    processShortcuts(content) {
        // Convertir les mixins et raccourcis
        // Exemple: @mixin btn { ... } et .element { @btn; }
        
        // 1. Définition des mixins
        const mixinDefRegex = /@mixin\s+([a-zA-Z0-9-_]+)\s*{([^}]*)}/g;
        const mixins = {};
        
        content = content.replace(mixinDefRegex, (match, name, body) => {
            mixins[name] = body.trim();
            return ''; // Supprimer la définition du mixin
        });
        
        // 2. Utilisation des mixins
        const mixinUseRegex = /@([a-zA-Z0-9-_]+);/g;
        
        return content.replace(mixinUseRegex, (match, name) => {
            if (mixins[name]) {
                return mixins[name];
            }
            console.warn(chalk.yellow(`⚠️ Mixin non défini: ${name}`));
            return match;
        });
    }
    
    processSpecialSelectors(content) {
        // Traiter les sélecteurs spéciaux comme &:hover ou &__item
        
        // Les sélecteurs &-based
        content = content.replace(/([^{}]*{[^{}]*})/g, (block) => {
            const selectorMatch = block.match(/([^{]*){/);
            if (!selectorMatch) return block;
            
            const selector = selectorMatch[1].trim();
            
            return block.replace(/&([^\s{,]*)/g, (match, suffix) => {
                return selector + suffix;
            });
        });
        
        return content;
    }
    
    processFunctions(content) {
        // Traiter les fonctions personnalisées comme @lighten, @darken, etc.
        
        const functionRegex = /@(lighten|darken|fade|mix)\(([^)]+)\)/g;
        
        return content.replace(functionRegex, (match, func, params) => {
            const args = params.split(',').map(arg => arg.trim());
            
            switch (func) {
                case 'lighten':
                    if (args.length === 2) {
                        return `color-mix(in srgb, ${args[0]} ${parseFloat(100 - args[1])}%, white)`;
                    }
                    break;
                case 'darken':
                    if (args.length === 2) {
                        return `color-mix(in srgb, ${args[0]} ${parseFloat(100 - args[1])}%, black)`;
                    }
                    break;
                case 'fade':
                    if (args.length === 2) {
                        const alpha = parseFloat(args[1]) / 100;
                        return `rgba(${args[0]}, ${alpha})`;
                    }
                    break;
                case 'mix':
                    if (args.length === 3) {
                        const ratio = parseFloat(args[2]);
                        return `color-mix(in srgb, ${args[0]} ${ratio}%, ${args[1]})`;
                    }
                    break;
            }
            
            console.warn(chalk.yellow(`⚠️ Fonction non supportée ou paramètres invalides: ${match}`));
            return match;
        });
    }
    
    processMediaQueries(content) {
        // Convertir les media queries simplifiées
        // Exemple: @mobile { ... } -> @media (max-width: 576px) { ... }
        
        const mediaQueryShortcuts = {
            mobile: `(max-width: ${this.variables.mobile})`,
            tablet: `(min-width: ${this.variables.mobile}) and (max-width: ${this.variables.desktop})`,
            desktop: `(min-width: ${this.variables.tablet})`,
            widescreen: `(min-width: ${this.variables.widescreen})`,
            dark: '(prefers-color-scheme: dark)',
            light: '(prefers-color-scheme: light)',
            print: 'print',
            portrait: '(orientation: portrait)',
            landscape: '(orientation: landscape)'
        };
        
        const mediaRegex = /@(mobile|tablet|desktop|widescreen|dark|light|print|portrait|landscape)\s*{([^}]*)}/g;
        
        return content.replace(mediaRegex, (match, type, body) => {
            const mediaQuery = mediaQueryShortcuts[type];
            if (mediaQuery) {
                return `@media ${mediaQuery} {\n${body}\n}`;
            }
            return match;
        });
    }
    
    // Fonctions utilitaires
    generateUtilityClasses() {
        // Génération automatique de classes utilitaires
        let utilityCSS = '/* Classes utilitaires générées automatiquement */\n\n';
        
        // Espacement (margin, padding)
        const spacingValues = {
            '0': '0',
            '1': '0.25rem',
            '2': '0.5rem',
            '3': '0.75rem',
            '4': '1rem',
            '5': '1.5rem',
            '6': '2rem',
            '8': '3rem'
        };
        
        // Margin utilities
        for (const [key, value] of Object.entries(spacingValues)) {
            utilityCSS += `.m-${key} { margin: ${value}; }\n`;
            utilityCSS += `.mt-${key} { margin-top: ${value}; }\n`;
            utilityCSS += `.mr-${key} { margin-right: ${value}; }\n`;
            utilityCSS += `.mb-${key} { margin-bottom: ${value}; }\n`;
            utilityCSS += `.ml-${key} { margin-left: ${value}; }\n`;
            utilityCSS += `.mx-${key} { margin-left: ${value}; margin-right: ${value}; }\n`;
            utilityCSS += `.my-${key} { margin-top: ${value}; margin-bottom: ${value}; }\n`;
        }
        
        utilityCSS += '\n';
        
        // Padding utilities
        for (const [key, value] of Object.entries(spacingValues)) {
            utilityCSS += `.p-${key} { padding: ${value}; }\n`;
            utilityCSS += `.pt-${key} { padding-top: ${value}; }\n`;
            utilityCSS += `.pr-${key} { padding-right: ${value}; }\n`;
            utilityCSS += `.pb-${key} { padding-bottom: ${value}; }\n`;
            utilityCSS += `.pl-${key} { padding-left: ${value}; }\n`;
            utilityCSS += `.px-${key} { padding-left: ${value}; padding-right: ${value}; }\n`;
            utilityCSS += `.py-${key} { padding-top: ${value}; padding-bottom: ${value}; }\n`;
        }
        
        utilityCSS += '\n/* Classes de disposition */\n';
        utilityCSS += '.flex { display: flex; }\n';
        utilityCSS += '.flex-col { flex-direction: column; }\n';
        utilityCSS += '.flex-row { flex-direction: row; }\n';
        utilityCSS += '.items-center { align-items: center; }\n';
        utilityCSS += '.justify-center { justify-content: center; }\n';
        utilityCSS += '.justify-between { justify-content: space-between; }\n';
        
        utilityCSS += '\n/* Classes de texte */\n';
        utilityCSS += '.text-center { text-align: center; }\n';
        utilityCSS += '.text-left { text-align: left; }\n';
        utilityCSS += '.text-right { text-align: right; }\n';
        utilityCSS += '.text-bold { font-weight: bold; }\n';
        
        return utilityCSS;
    }
    
    // Génère un fichier de documentation
    generateDocumentation() {
        let doc = `# Documentation CSS Simplifiée Veko

## Introduction

La syntaxe CSS simplifiée de Veko permet d'écrire du CSS plus rapidement et plus clairement.
Elle offre une expérience similaire à Sass/SCSS mais avec une syntaxe encore plus concise et des fonctionnalités adaptées au framework Veko.

## Installation et utilisation

\`\`\`bash
# Compiler les fichiers CSS
npx veko css build src/css public/css

# Mode surveillance (développement)
npx veko css watch src/css public/css

# Créer un nouveau template
npx veko css create basic src/css/style.vcss

# Bundler les fichiers CSS
npx veko css bundle src/css public/css index.vcss bundle.css

# Optimiser les fichiers CSS
npx veko css optimize public/css --purge src/views

# Analyser un fichier CSS
npx veko css analyze src/css style.vcss
\`\`\`

## Variables

La déclaration et l'utilisation de variables sont simples et intuitives :

\`\`\`css
/* Définition de variables */
$primary: #3490dc;
$spacing: 1rem;
$font-size: 16px;

/* Utilisation des variables */
.element {
    color: $primary;
    padding: $spacing;
    font-size: $font-size;
}
\`\`\`

## Raccourcis de propriétés

Les raccourcis permettent d'écrire moins de code tout en restant expressif :

\`\`\`css
/* Avant (syntaxe simplifiée) */
.element {
    w: 100%;
    h: 200px;
    m: 10px;
    p: 15px;
    bg: primary;
    flex: true;
    items-center: true;
    justify-between: true;
    rounded: true;
}

/* Après compilation (CSS standard) */
.element {
    width: 100%;
    height: 200px;
    margin: 10px;
    padding: 15px;
    background: #3490dc;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 0.25rem;
}
\`\`\`

### Liste des raccourcis principaux

| Raccourci       | Propriété CSS                         |
|-----------------|---------------------------------------|
| w               | width                                 |
| h               | height                                |
| m               | margin                                |
| p               | padding                               |
| mt, mr, mb, ml  | margin-top, -right, -bottom, -left    |
| pt, pr, pb, pl  | padding-top, -right, -bottom, -left   |
| mx              | margin-left + margin-right            |
| my              | margin-top + margin-bottom            |
| px              | padding-left + padding-right          |
| py              | padding-top + padding-bottom          |
| flex            | display: flex                         |
| grid            | display: grid                         |
| block           | display: block                        |
| none            | display: none                         |
| text-center     | text-align: center                    |
| rounded         | border-radius: 0.25rem                |
| shadow          | box-shadow: 0 2px 4px rgba(0,0,0,0.1) |
| bg              | background                            |

## Media Queries simplifiées

Veko simplifie l'écriture des media queries pour le responsive design :

\`\`\`css
/* Media queries simplifiées */
@mobile {
    .element {
        w: 100%;
        p: 10px;
    }
}

@tablet {
    .element {
        w: 50%;
    }
}

/* Compilation en CSS standard */
@media (max-width: 576px) {
    .element {
        width: 100%;
        padding: 10px;
    }
}

@media (min-width: 576px) and (max-width: 992px) {
    .element {
        width: 50%;
    }
}
\`\`\`

### Breakpoints prédéfinis

| Nom        | Condition                                          |
|------------|---------------------------------------------------|
| mobile     | (max-width: 576px)                                |
| tablet     | (min-width: 576px) and (max-width: 992px)         |
| desktop    | (min-width: 768px)                                |
| widescreen | (min-width: 1200px)                               |
| dark       | (prefers-color-scheme: dark)                      |
| light      | (prefers-color-scheme: light)                     |
| print      | print                                             |
| portrait   | (orientation: portrait)                           |
| landscape  | (orientation: landscape)                          |

## Mixins

Les mixins permettent de réutiliser des blocs de styles :

\`\`\`css
/* Définition d'un mixin */
@mixin btn-primary {
    bg: $primary;
    p: 10px 15px;
    color: white;
    rounded: true;
    transition: all 0.3s ease;
}

/* Utilisation du mixin */
.btn {
    @btn-primary;
    text-center: true;
}

.btn-large {
    @btn-primary;
    p: 15px 20px;
    font-size: 1.2rem;
}
\`\`\`

## Fonctions de couleur

Veko inclut des fonctions pour manipuler les couleurs :

\`\`\`css
.btn-hover {
    background-color: @lighten($primary, 10%);
    color: @darken(white, 10%);
}

.overlay {
    background-color: @fade(black, 50%);
}

.gradient {
    background: @mix(blue, purple, 70%);
}
\`\`\`

## Sélecteurs imbriqués 

Le symbole & permet de référencer le sélecteur parent :

\`\`\`css
.card {
    bg: white;
    m: 10px;
    p: 15px;
    
    &__header {
        font-weight: bold;
        mb: 10px;
    }
    
    &__body {
        font-size: 0.9rem;
    }
    
    &:hover {
        bg: #f8f8f8;
    }
    
    &--featured {
        border-left: 4px solid $primary;
    }
}

/* Compile en : */
.card { background: white; margin: 10px; padding: 15px; }
.card__header { font-weight: bold; margin-bottom: 10px; }
.card__body { font-size: 0.9rem; }
.card:hover { background: #f8f8f8; }
.card--featured { border-left: 4px solid #3490dc; }
\`\`\`

## Import de fichiers

Simplifiez l'organisation de votre code avec des imports :

\`\`\`css
/* Import d'autres fichiers */
@import "variables";
@import "reset";
@import "components/buttons";
@import "layout/header";

/* Remarque : Les extensions de fichier sont optionnelles */
\`\`\`

## Bundling et optimisation

Veko offre des outils puissants pour regrouper et optimiser vos styles :

\`\`\`bash
# Regrouper tous les fichiers en un seul
npx veko css bundle src/css dist/css main.vcss bundle.min.css

# Optimiser en supprimant le CSS non utilisé
npx veko css optimize dist/css --purge src/views

# Optimiser avec plusieurs options
npx veko css optimize dist/css --purge src/views --merge --no-minify
\`\`\`

## Templates disponibles

Veko fournit plusieurs templates prêts à l'emploi :

\`\`\`bash
npx veko css create basic src/css/style.vcss
npx veko css create reset src/css/reset.vcss
npx veko css create grid src/css/grid.vcss
npx veko css create theme src/css/theme.vcss
npx veko css create component src/css/component.vcss
npx veko css create layout src/css/layout.vcss
npx veko css create animation src/css/animation.vcss
npx veko css create responsive src/css/responsive.vcss
\`\`\`

## Analyse de CSS

Analysez vos styles pour identifier les problèmes et optimiser votre code :

\`\`\`bash
npx veko css analyze src/css style.vcss
\`\`\`

L'analyse fournit des informations sur :
- Nombre de règles et sélecteurs
- Taille du fichier
- Propriétés les plus utilisées
- Palette de couleurs
- Spécificité et complexité
- Recommandations d'optimisation
`;
        return doc;
    }
    
    // CLI pour les commandes interactives
    static cli(args) {
        const command = args[0];
        
        switch (command) {
            case 'build':
                const manager = new CssManager({
                    inputDir: args[1] || 'src/css',
                    outputDir: args[2] || 'public/css',
                    isDev: args.includes('--dev')
                });
                manager.processCssFiles();
                break;
                
            case 'watch':
                const watchManager = new CssManager({
                    inputDir: args[1] || 'src/css',
                    outputDir: args[2] || 'public/css',
                    isDev: true
                });
                watchManager.watch();
                break;
                
            case 'create':
                const templateName = args[1] || 'basic';
                const outputPath = args[2] || `src/css/${templateName}.vcss`;
                const dirPath = path.dirname(outputPath);
                
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }
                
                const creator = new CssManager();
                creator.createTemplate(templateName, outputPath);
                break;
                
            case 'docs':
                const docsPath = args[1] || 'veko-css-docs.md';
                const docsManager = new CssManager();
                docsManager.saveDocumentation(docsPath);
                break;
                
            case 'bundle':
                const bundleManager = new CssManager({
                    inputDir: args[1] || 'src/css',
                    outputDir: args[2] || 'public/css',
                    isDev: args.includes('--dev')
                });
                const entryPoint = args[3] || 'index.vcss';
                const outputBundle = args[4] || 'bundle.css';
                bundleManager.bundleStyles(entryPoint, outputBundle, {
                    minify: !args.includes('--no-minify'),
                    sourcemap: args.includes('--sourcemap') || args.includes('--dev'),
                    purge: args.includes('--purge'),
                    critical: args.includes('--critical')
                });
                break;
                
            case 'optimize':
                const optimizeManager = new CssManager({
                    inputDir: args[1] || 'src/css',
                    outputDir: args[2] || 'public/css'
                });
                optimizeManager.optimizeStyles({
                    purge: args.includes('--purge') ? args[args.indexOf('--purge') + 1] : null,
                    minify: !args.includes('--no-minify'),
                    mergeDuplicates: args.includes('--merge'),
                    reduceSpecificity: args.includes('--reduce-specificity')
                });
                break;
                
            case 'analyze':
                const analyzeManager = new CssManager({
                    inputDir: args[1] || 'src/css',
                });
                const targetFile = args[2];
                analyzeManager.analyzeStylesheet(targetFile);
                break;
                
            default:
                console.log(`
Usage: npx veko css [command] [options]

Commands:
  build [inputDir] [outputDir]           Compile les fichiers CSS
  watch [inputDir] [outputDir]           Surveille et compile les fichiers CSS
  create [template] [outputPath]         Crée un nouveau fichier à partir d'un template
  docs [outputPath]                      Génère la documentation
  bundle [inputDir] [outputDir] [entry]  Regroupe et optimise les fichiers CSS
  optimize [inputDir] [outputDir]        Optimise les fichiers CSS
  analyze [inputDir] [file]              Analyse un fichier CSS

Options:
  --dev                                  Active le mode développement
  --no-minify                            Désactive la minification
  --sourcemap                            Génère des sourcemaps
  --purge [htmlDir]                      Supprime le CSS non utilisé (PurgeCSS)
  --critical                             Extrait le CSS critique (above the fold)
  --merge                                Fusionne les règles dupliquées
  --reduce-specificity                   Réduit la spécificité CSS

Templates disponibles:
  basic                                  Structure CSS de base
  reset                                  CSS Reset
  grid                                   Système de grille
  theme                                  Thème complet
  utils                                  Classes utilitaires
  component                              Composant réutilisable
  layout                                 Structure de mise en page
  animation                              Animations et transitions
  responsive                             Modèle responsive complet
                `);
        }
    }
    
    // Nouveau système de regroupement (bundling) pour le CSS
    async bundleStyles(entryPoint, outputFile, options = {}) {
        console.log(chalk.blue(`🔄 Regroupement des styles à partir de ${entryPoint}...`));
        
        // Options par défaut
        options = {
            minify: true,
            sourcemap: false,
            purge: false,
            critical: false,
            ...options
        };
        
        try {
            // Construire l'arbre de dépendances
            const depTree = await this.buildDependencyTree(entryPoint);
            
            // Concaténer tous les fichiers
            const bundledContent = await this.concatenateFiles(depTree);
            
            // Compiler le contenu simplifié si nécessaire
            const compiledContent = this.compileBundle(bundledContent);
            
            // Optimiser le CSS
            let optimizedContent = compiledContent;
            
            if (options.purge) {
                optimizedContent = await this.purgeCss(optimizedContent, options.purge);
            }
            
            // Appliquer les processeurs de post-traitement
            const plugins = [
                options.minify ? cssnano({ preset: 'default' }) : null,
            ].filter(Boolean);
            
            const outputPath = path.join(this.options.outputDir, outputFile);
            
            // Traiter avec PostCSS
            const result = await postcss(plugins).process(optimizedContent, {
                from: path.join(this.options.inputDir, entryPoint),
                to: outputPath,
                map: options.sourcemap ? { inline: true } : false
            });
            
            // Écrire le fichier de sortie
            fs.writeFileSync(outputPath, result.css);
            console.log(chalk.green(`✅ Bundle CSS créé: ${outputPath}`));
            
            // Générer le CSS critique si demandé
            if (options.critical) {
                await this.generateCriticalCss(outputPath);
            }
            
            // Afficher les statistiques du bundle
            this.displayBundleStats(outputPath, depTree);
            
            return {
                success: true,
                outputPath,
                size: fs.statSync(outputPath).size
            };
            
        } catch (error) {
            console.error(chalk.red(`❌ Erreur lors du regroupement des styles: ${error.message}`));
            throw error;
        }
    }
    
    // Construction de l'arbre de dépendances
    async buildDependencyTree(entryFile, visited = new Set()) {
        const entryPath = path.join(this.options.inputDir, entryFile);
        
        if (visited.has(entryPath)) {
            return []; // Éviter les boucles infinies
        }
        
        if (!fs.existsSync(entryPath)) {
            const extensions = ['.vcss', '.veko', '.css'];
            let found = false;
            
            for (const ext of extensions) {
                const pathWithExt = entryPath + ext;
                if (fs.existsSync(pathWithExt)) {
                    visited.add(entryPath);
                    found = true;
                    return await this.buildDependencyTree(entryFile + ext, visited);
                }
            }
            
            if (!found) {
                console.warn(chalk.yellow(`⚠️ Fichier introuvable: ${entryPath}`));
                return [];
            }
        }
        
        // Marquer comme visité
        visited.add(entryPath);
        
        // Lire le contenu du fichier
        const fileContent = fs.readFileSync(entryPath, 'utf8');
        
        // Extraire les imports
        const importRegex = /@import\s+["']?([^"';]+)["']?;/g;
        const imports = [];
        let match;
        
        while ((match = importRegex.exec(fileContent)) !== null) {
            const importPath = match[1];
            imports.push(importPath);
        }
        
        // Construire l'arbre récursivement
        const dependencies = [];
        
        for (const importPath of imports) {
            // Vérifier si le chemin est relatif
            const isRelative = !path.isAbsolute(importPath);
            let fullImportPath;
            
            if (isRelative) {
                fullImportPath = path.join(path.dirname(entryPath), importPath);
            } else {
                fullImportPath = importPath;
            }
            
            const relativePath = path.relative(this.options.inputDir, fullImportPath);
            const subDeps = await this.buildDependencyTree(relativePath, visited);
            dependencies.push({
                path: relativePath,
                dependencies: subDeps
            });
        }
        
        return [{
            path: path.relative(this.options.inputDir, entryPath),
            dependencies
        }];
    }
    
    // Concaténation des fichiers dans l'ordre correct
    async concatenateFiles(depTree) {
        let result = '';
        
        const processNode = (node) => {
            // Traiter d'abord les dépendances
            if (node.dependencies && node.dependencies.length > 0) {
                node.dependencies.forEach(dep => {
                    processNode(dep);
                });
            }
            
            // Lire et ajouter le contenu du fichier actuel
            const filePath = path.join(this.options.inputDir, node.path);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Filtrer le contenu pour supprimer les imports
                const filteredContent = content.replace(/@import\s+["']?[^"';]+["']?;/g, '');
                
                result += `/* ${node.path} */\n${filteredContent}\n\n`;
            }
        };
        
        // Parcourir l'arbre
        depTree.forEach(node => {
            processNode(node);
        });
        
        return result;
    }
    
    // Compiler le bundle de CSS simplifié
    compileBundle(content) {
        return this.parseSimplifiedSyntax(content);
    }
    
    // Purger le CSS non utilisé
    async purgeCss(css, htmlDir) {
        try {
            const purgecss = require('purgecss');
            
            const htmlFiles = this.findFiles(htmlDir, ['.html', '.htm', '.js', '.jsx', '.ts', '.tsx', '.vue', '.php']);
            
            if (htmlFiles.length === 0) {
                console.warn(chalk.yellow('⚠️ Aucun fichier HTML trouvé pour PurgeCSS'));
                return css;
            }
            
            const result = await new purgecss.PurgeCSS().purge({
                content: htmlFiles,
                css: [{ raw: css }],
                safelist: {
                    standard: ['html', 'body', 'active', 'hover', 'focus', 'disabled'],
                    deep: [/^dark-/, /^light-/, /^v-/]
                },
                defaultExtractor: content => content.match(/[\w-/:%]+(?<!:)/g) || []
            });
            
            console.log(chalk.green(`✅ CSS purgé: ${result[0].css.length} octets (réduction de ${Math.round((1 - result[0].css.length / css.length) * 100)}%)`));
            
            return result[0].css;
        } catch (error) {
            console.error(chalk.red(`❌ Erreur lors du purge CSS: ${error.message}`));
            console.log(chalk.yellow('⚠️ Essayez d\'installer purgecss: npm install purgecss --save-dev'));
            return css;
        }
    }
    
    // Générer le CSS critique
    async generateCriticalCss(cssPath) {
        try {
            const critical = require('critical');
            
            const outputDir = path.dirname(cssPath);
            const fileName = path.basename(cssPath, '.css');
            const outputPath = path.join(outputDir, `${fileName}.critical.css`);
            
            // Trouver un fichier HTML à utiliser
            const htmlFiles = this.findFiles(process.cwd(), ['.html', '.htm']).slice(0, 1);
            
            if (htmlFiles.length === 0) {
                console.warn(chalk.yellow('⚠️ Aucun fichier HTML trouvé pour extraire le CSS critique'));
                return false;
            }
            
            const result = await critical.generate({
                src: htmlFiles[0],
                css: [cssPath],
                width: 1300,
                height: 900,
                target: outputPath,
                inline: false
            });
            
            console.log(chalk.green(`✅ CSS critique généré: ${outputPath}`));
            return true;
            
        } catch (error) {
            console.error(chalk.red(`❌ Erreur lors de la génération du CSS critique: ${error.message}`));
            console.log(chalk.yellow('⚠️ Essayez d\'installer critical: npm install critical --save-dev'));
            return false;
        }
    }
    
    // Afficher des statistiques sur le bundle
    displayBundleStats(filePath, depTree) {
        const fileSize = fs.statSync(filePath).size;
        const fileSizeKb = (fileSize / 1024).toFixed(2);
        
        // Compter les fichiers dans l'arbre de dépendances
        let fileCount = 0;
        const processNode = (node) => {
            fileCount++;
            if (node.dependencies) {
                node.dependencies.forEach(dep => processNode(dep));
            }
        };
        
        depTree.forEach(node => processNode(node));
        
        console.log(chalk.blue('\n📊 Statistiques du bundle:'));
        console.log(chalk.blue(`📁 Nombre de fichiers: ${fileCount}`));
        console.log(chalk.blue(`📏 Taille: ${fileSizeKb} KB`));
        
        // Afficher les métriques de performance
        if (fileSize > 50 * 1024) {
            console.log(chalk.yellow('⚠️ Le fichier CSS est assez volumineux. Envisagez d\'utiliser --purge pour réduire sa taille.'));
        } else {
            console.log(chalk.green('✅ Taille du fichier optimale!'));
        }
    }
    
    // Optimisation des styles
    async optimizeStyles(options = {}) {
        console.log(chalk.blue('🔧 Optimisation des fichiers CSS...'));
        
        const cssFiles = this.findFiles(this.options.outputDir, ['.css']).filter(file => !file.includes('.min.css'));
        
        if (cssFiles.length === 0) {
            console.warn(chalk.yellow('⚠️ Aucun fichier CSS à optimiser'));
            return;
        }
        
        for (const cssFile of cssFiles) {
            const content = fs.readFileSync(cssFile, 'utf8');
            let optimizedContent = content;
            
            // Purger le CSS non utilisé
            if (options.purge) {
                optimizedContent = await this.purgeCss(optimizedContent, options.purge);
            }
            
            // Fusionner les règles dupliquées
            if (options.mergeDuplicates) {
                optimizedContent = this.mergeDuplicateRules(optimizedContent);
            }
            
            // Réduire la spécificité
            if (options.reduceSpecificity) {
                optimizedContent = this.reduceSpecificity(optimizedContent);
            }
            
            // Minifier
            if (options.minify) {
                const result = await postcss([cssnano({ preset: 'default' })]).process(optimizedContent, {
                    from: cssFile,
                    to: cssFile
                });
                optimizedContent = result.css;
            }
            
            // Écrire le fichier optimisé
            fs.writeFileSync(cssFile, optimizedContent);
            
            // Créer une version minifiée séparée
            if (options.minify) {
                const minFileName = cssFile.replace('.css', '.min.css');
                fs.writeFileSync(minFileName, optimizedContent);
                console.log(chalk.green(`✅ Version minifiée créée: ${minFileName}`));
            }
            
            console.log(chalk.green(`✅ Fichier optimisé: ${cssFile}`));
        }
    }
    
    // Fusionner les règles CSS dupliquées
    mergeDuplicateRules(css) {
        try {
            const CleanCSS = require('clean-css');
            const options = {
                level: {
                    2: {
                        mergeSemantically: true,
                        mergeMedia: true,
                        mergeIntoShorthands: true,
                        overrideProperties: true
                    }
                }
            };
            
            const result = new CleanCSS(options).minify(css);
            
            if (result.errors.length > 0) {
                console.warn(chalk.yellow(`⚠️ Erreurs lors de la fusion des règles: ${result.errors.join(', ')}`));
                return css;
            }
            
            return result.styles;
        } catch (error) {
            console.error(chalk.red(`❌ Erreur lors de la fusion des règles: ${error.message}`));
            console.log(chalk.yellow('⚠️ Essayez d\'installer clean-css: npm install clean-css --save-dev'));
            return css;
        }
    }
    
    // Réduire la spécificité CSS
    reduceSpecificity(css) {
        try {
            const specificity = require('specificity');
            
            // Analyser le CSS (implémentation simplifiée)
            const styleRules = [];
            const regex = /([^{]+)\{([^}]+)\}/g;
            let match;
            
            while ((match = regex.exec(css)) !== null) {
                const selector = match[1].trim();
                const declarations = match[2].trim();
                
                // Ignorer les media queries, keyframes, etc.
                if (selector.includes('@')) continue;
                
                // Calculer la spécificité
                const selectorList = selector.split(',').map(s => s.trim());
                const highestSpecificity = selectorList.map(s => {
                    try {
                        return specificity.calculate(s)[0].specificity.split(',').join('');
                    } catch (e) {
                        return '0000';
                    }
                }).sort().reverse()[0];
                
                styleRules.push({
                    selector,
                    declarations,
                    specificity: parseInt(highestSpecificity, 10)
                });
            }
            
            // Trier par spécificité décroissante
            styleRules.sort((a, b) => b.specificity - a.specificity);
            
            // Identifier les règles qui pourraient être simplifiées
            const highSpecificityThreshold = 100; // Seuil arbitraire
            
            const highSpecificityRules = styleRules.filter(rule => rule.specificity > highSpecificityThreshold);
            
            if (highSpecificityRules.length > 0) {
                console.log(chalk.yellow(`⚠️ ${highSpecificityRules.length} règles avec une spécificité élevée ont été identifiées.`));
                console.log(chalk.yellow('Suggestions d\'amélioration:'));
                
                highSpecificityRules.slice(0, 5).forEach(rule => {
                    console.log(chalk.yellow(`  - "${rule.selector.substring(0, 50)}${rule.selector.length > 50 ? '...' : ''}"`));
                });
                
                if (highSpecificityRules.length > 5) {
                    console.log(chalk.yellow(`  et ${highSpecificityRules.length - 5} autres...`));
                }
            }
            
            return css; // La modification automatique serait trop risquée
        } catch (error) {
            console.error(chalk.red(`❌ Erreur lors de la réduction de spécificité: ${error.message}`));
            console.log(chalk.yellow('⚠️ Essayez d\'installer specificity: npm install specificity --save-dev'));
            return css;
        }
    }
    
    // Analyser une feuille de style
    analyzeStylesheet(filePath) {
        try {
            if (!filePath) {
                const cssFiles = this.findFiles(this.options.inputDir, ['.css', '.vcss', '.veko']);
                if (cssFiles.length === 0) {
                    console.warn(chalk.yellow('⚠️ Aucun fichier CSS trouvé pour l\'analyse'));
                    return;
                }
                filePath = cssFiles[0];
            }
            
            if (!fs.existsSync(filePath)) {
                console.error(chalk.red(`❌ Fichier ${filePath} introuvable`));
                return;
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            let parsedContent = content;
            
            if (filePath.endsWith('.vcss') || filePath.endsWith('.veko')) {
                parsedContent = this.parseSimplifiedSyntax(content);
            }
            
            // Analyser le contenu
            const stats = this.calculateCssStats(parsedContent);
            
            console.log(chalk.blue('\n📊 Analyse CSS:'));
            console.log(chalk.blue(`📄 Fichier: ${path.basename(filePath)}`));
            console.log(chalk.blue(`📏 Taille: ${(parsedContent.length / 1024).toFixed(2)} KB`));
            console.log(chalk.blue(`🔢 Règles: ${stats.rules}`));
            console.log(chalk.blue(`🎯 Sélecteurs: ${stats.selectors}`));
            console.log(chalk.blue(`🎨 Déclarations: ${stats.declarations}`));
            console.log(chalk.blue(`🌈 Couleurs: ${Object.keys(stats.colors).length}`));
            
            // Afficher la complexité
            console.log(chalk.blue('\n🧩 Complexité:'));
            console.log(chalk.blue(`📏 Spécificité moyenne: ${stats.avgSpecificity.toFixed(2)}`));
            console.log(chalk.blue(`📊 Sélecteurs imbriqués max: ${stats.maxNesting}`));
            
            // Afficher les propriétés les plus utilisées
            console.log(chalk.blue('\n📈 Top 5 des propriétés:'));
            Object.entries(stats.properties)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .forEach(([prop, count]) => {
                    console.log(chalk.blue(`  - ${prop}: ${count}`));
                });
            
            // Afficher la palette de couleurs
            console.log(chalk.blue('\n🎨 Palette de couleurs:'));
            Object.entries(stats.colors)
                .slice(0, 10)
                .forEach(([color, count]) => {
                    // Convertir en RGB pour affichage dans le terminal
                    console.log(chalk.hex(color)(` ███ `) + chalk.blue(` ${color} (${count})`));
                });
            
            if (Object.keys(stats.colors).length > 10) {
                console.log(chalk.blue(`  et ${Object.keys(stats.colors).length - 10} autres couleurs...`));
            }
            
            // Recommandations
            this.displayCssRecommendations(stats);
            
        } catch (error) {
            console.error(chalk.red(`❌ Erreur lors de l'analyse: ${error.message}`));
        }
    }
    
    // Calculer des statistiques sur le CSS
    calculateCssStats(css) {
        const stats = {
            rules: 0,
            selectors: 0,
            declarations: 0,
            properties: {},
            colors: {},
            avgSpecificity: 0,
            maxNesting: 0
        };
        
        try {
            // Utilisation d'une expression régulière simplifiée
            const ruleRegex = /([^{]+)\{([^}]+)\}/g;
            const propertyRegex = /([a-z-]+)\s*:\s*([^;]+);/g;
            const colorRegex = /#([a-f0-9]{3,8})|rgba?\([^)]+\)|hsla?\([^)]+\)/gi;
            
            let ruleMatch;
            let specificitySum = 0;
            let selectorCount = 0;
            
            while ((ruleMatch = ruleRegex.exec(css)) !== null) {
                stats.rules++;
                
                const selector = ruleMatch[1].trim();
                const declarations = ruleMatch[2].trim();
                
                // Compter les sélecteurs (séparés par des virgules)
                const selectorList = selector.split(',').map(s => s.trim());
                stats.selectors += selectorList.length;
                selectorCount += selectorList.length;
                
                // Analyser la spécificité
                const nestingLevel = Math.max(...selectorList.map(s => (s.match(/\s+|\>/g) || []).length + 1));
                stats.maxNesting = Math.max(stats.maxNesting, nestingLevel);
                
                // Analyser la spécificité simplifiée
                const specificityScore = selectorList.map(s => {
                    return (s.match(/#/g) || []).length * 100 + // ids
                           (s.match(/\./g) || []).length * 10 + // classes
                           (s.match(/\[/g) || []).length * 10 + // attributs
                           (s.match(/\:/g) || []).length * 10 + // pseudo-classes
                           (s.match(/[a-z]/g) || []).length; // éléments
                }).reduce((sum, val) => sum + val, 0);
                
                specificitySum += specificityScore;
                
                // Analyser les déclarations
                let propMatch;
                while ((propMatch = propertyRegex.exec(declarations)) !== null) {
                    stats.declarations++;
                    
                    const property = propMatch[1].trim();
                    const value = propMatch[2].trim();
                    
                    // Compter les occurrences des propriétés
                    stats.properties[property] = (stats.properties[property] || 0) + 1;
                    
                    // Extraire les couleurs
                    const colorMatches = value.match(colorRegex);
                    if (colorMatches) {
                        colorMatches.forEach(color => {
                            // Normaliser les couleurs
                            try {
                                const normalizedColor = this.normalizeColor(color);
                                if (normalizedColor) {
                                    stats.colors[normalizedColor] = (stats.colors[normalizedColor] || 0) + 1;
                                }
                            } catch (e) {
                                // Ignorer les erreurs de couleur
                            }
                        });
                    }
                }
            }
            
            // Calculer la spécificité moyenne
            stats.avgSpecificity = selectorCount > 0 ? specificitySum / selectorCount : 0;
            
            return stats;
            
        } catch (error) {
            console.error(chalk.red(`❌ Erreur lors du calcul des statistiques: ${error.message}`));
            return stats;
        }
    }
    
    // Normaliser la représentation des couleurs
    normalizeColor(color) {
        // Convertir toutes les couleurs en hexadécimal
        if (color.startsWith('#')) {
            // Déjà hexadécimal
            if (color.length === 4) {
                // #RGB -> #RRGGBB
                return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
            }
            return color.toLowerCase();
        }
        
        if (color.startsWith('rgb')) {
            // Conversion simplifiée RGB -> HEX
            const matches = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
            if (matches) {
                const r = parseInt(matches[1]).toString(16).padStart(2, '0');
                const g = parseInt(matches[2]).toString(16).padStart(2, '0');
                const b = parseInt(matches[3]).toString(16).padStart(2, '0');
                return `#${r}${g}${b}`;
            }
        }
        
        return color;
    }
    
    // Afficher des recommandations basées sur l'analyse
    displayCssRecommendations(stats) {
        console.log(chalk.blue('\n💡 Recommandations:'));
        
        // Vérifier la taille
        if (stats.rules > 500) {
            console.log(chalk.yellow('⚠️  Nombre élevé de règles. Envisagez de diviser votre CSS en modules.'));
        }
        
        // Vérifier la complexité
        if (stats.avgSpecificity > 30) {
            console.log(chalk.yellow('⚠️  Spécificité moyenne élevée. Simplifiez vos sélecteurs.'));
        }
        
        if (stats.maxNesting > 3) {
            console.log(chalk.yellow('⚠️  Niveaux d\'imbrication élevés. Limitez à 3 niveaux maximum.'));
        }
        
        // Vérifier la cohérence des couleurs
        const colorCount = Object.keys(stats.colors).length;
        if (colorCount > 15) {
            console.log(chalk.yellow(`⚠️  Palette de ${colorCount} couleurs. Utilisez des variables pour une palette cohérente.`));
        }
        
        // Recommandations basées on les propriétés
        if (stats.properties['!important'] > 5) {
            console.log(chalk.yellow('⚠️  Usage excessif de !important. Améliorez la structure de vos sélecteurs.'));
        }
        
        if (stats.properties['position'] > 20 && (!stats.properties['z-index'] || stats.properties['z-index'] < 5)) {
            console.log(chalk.yellow('⚠️  Utilisations fréquentes de position sans z-index. Vérifiez vos superpositions.'));
        }
        
        // Conseils pour l'optimisation
        if (stats.rules > 100 && stats.selectors > 500) {
            console.log(chalk.yellow('💡 Utilisez "veko css optimize --purge" pour éliminer les styles non utilisés.'));
        }
    }
    
    // Trouver des fichiers correspondant aux extensions données
    findFiles(dir, extensions, results = []) {
        if (!fs.existsSync(dir)) {
            return results;
        }
        
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            
            if (fs.statSync(fullPath).isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                this.findFiles(fullPath, extensions, results);
            } else if (extensions.some(ext => file.endsWith(ext))) {
                results.push(fullPath);
            }
        });
        
        return results;
    }
    
    // Créer de nouveaux templates
    createTemplate(templateName, outputPath) {
        const templates = {
            basic: `/* Template CSS Veko basique */
$primary: #3490dc;
$secondary: #ffed4a;
$text-color: #333;
$background: #fff;

/* Styles de base */
body {
    color: $text-color;
    bg: $background;
    font-family: 'Arial', sans-serif;
    m: 0;
    p: 0;
}

.container {
    maxw: 1200px;
    m: 0 auto;
    p: 15px;
}

/* Bouton */
.btn {
    display: inline-block;
    bg: $primary;
    color: white;
    p: 10px 15px;
    rounded: true;
    text-decoration: none;
    transition: all 0.3s ease;
}

.btn:hover {
    bg: @darken($primary, 10%);
}

/* Media queries */
@mobile {
    .container {
        p: 10px;
    }
}`,
            reset: `/* Reset CSS Veko */
* {
    m: 0;
    p: 0;
    box-sizing: border-box;
}

html, body {
    h: 100%;
}

body {
    font-family: 'Arial', sans-serif;
    line-height: 1.6;
}

img {
    maxw: 100%;
    h: auto;
    display: block;
}

a {
    text-decoration: none;
    color: inherit;
}

ul, ol {
    list-style: none;
}

button, input, textarea, select {
    font-family: inherit;
    font-size: inherit;
}`,
            grid: `/* Système de grille Veko */
.container {
    w: 100%;
    maxw: 1200px;
    m: 0 auto;
    p: 0 15px;
}

.row {
    display: flex;
    flex-wrap: wrap;
    m: 0 -15px;
}

.col {
    flex: 1;
    p: 0 15px;
}

/* Colonnes avec tailles spécifiques */
@for 1 to 12 {
    .col-{i} {
        flex: 0 0 calc({i} / 12 * 100%);
        maxw: calc({i} / 12 * 100%);
    }
}

/* Responsive */
@mobile {
    .col {
        flex: 0 0 100%;
        maxw: 100%;
    }
}`,
            theme: `/* Thème Veko */
/* Variables */
$primary: #3490dc;
$secondary: #ffed4a;
$success: #38c172;
$danger: #e3342f;
$warning: #f6993f;
$info: #6cb2eb;
$light: #f8f9fa;
$dark: #343a40;

$font-family: 'Arial', sans-serif;
$font-size: 16px;
$line-height: 1.6;

$border-radius: 0.25rem;
$shadow: 0 2px 4px rgba(0,0,0,0.1);

/* Base */
body {
    font-family: $font-family;
    font-size: $font-size;
    line-height: $line-height;
    color: $dark;
    bg: $light;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
    m: 0 0 1rem;
    font-weight: bold;
    line-height: 1.2;
}

h1 { font-size: 2.5rem; }
h2 { font-size: 2rem; }
h3 { font-size: 1.75rem; }
h4 { font-size: 1.5rem; }
h5 { font-size: 1.25rem; }
h6 { font-size: 1rem; }

/* Boutons */
.btn {
    display: inline-block;
    p: 0.5rem 1rem;
    font-size: 1rem;
    rounded: true;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
    transition: all 0.3s ease;
}

.btn-primary {
    bg: $primary;
    color: white;
}

.btn-secondary {
    bg: $secondary;
    color: $dark;
}

.btn-success {
    bg: $success;
    color: white;
}

.btn-danger {
    bg: $danger;
    color: white;
}

/* Cards */
.card {
    bg: white;
    rounded: true;
    shadow: $shadow;
    m: 0 0 1rem;
    overflow: hidden;
}

.card-header {
    p: 1rem;
    bg: $light;
    border-bottom: 1px solid #dee2e6;
}

.card-body {
    p: 1rem;
}

.card-footer {
    p: 1rem;
    bg: $light;
    border-top: 1px solid #dee2e6;
}

/* Utilities */
.text-primary { color: $primary; }
.text-secondary { color: $secondary; }
.text-success { color: $success; }
.text-danger { color: $danger; }
.text-warning { color: $warning; }
.text-info { color: $info; }
.text-light { color: $light; }
.text-dark { color: $dark; }

.bg-primary { bg: $primary; }
.bg-secondary { bg: $secondary; }
.bg-success { bg: $success; }
.bg-danger { bg: $danger; }
.bg-warning { bg: $warning; }
.bg-info { bg: $info; }
.bg-light { bg: $light; }
.bg-dark { bg: $dark; }

/* Media Queries */
@dark {
    body {
        bg: $dark;
        color: $light;
    }
    
    .card {
        bg: #2d3339;
    }
}`,
            utils: this.generateUtilityClasses(),
            
            component: `/* Composant réutilisable Veko */
$primary: #3490dc;
$radius: 0.25rem;
$shadow: 0 2px 4px rgba(0,0,0,0.1);
$transition: all 0.3s ease;

.v-component {
    bg: white;
    rounded: true;
    shadow: $shadow;
    transition: $transition;
    p: 1rem;
    m: 0 0 1rem;

    &:hover {
        shadow: 0 4px 8px rgba(0,0,0,0.15);
        transform: translateY(-2px);
    }
    
    &__header {
        font-weight: bold;
        mb: 0.5rem;
        pb: 0.5rem;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    &__body {
        p: 0.5rem 0;
    }
    
    &__footer {
        mt: 0.5rem;
        pt: 0.5rem;
        border-top: 1px solid #eee;
        display: flex;
        justify-content: flex-end;
    }
    
    &--primary {
        border-left: 4px solid $primary;
    }
}

/* Utilisation d'un mixin */
@mixin btn {
    display: inline-block;
    p: 0.5rem 1rem;
    border: none;
    rounded: true;
    cursor: pointer;
    text-decoration: none;
    transition: $transition;
    bg: $primary;
    color: white;
    
    &:hover {
        bg: @darken($primary, 10%);
    }
}

.v-btn {
    @btn;
    
    &--small {
        p: 0.25rem 0.5rem;
        font-size: 0.875rem;
    }
    
    &--large {
        p: 0.75rem 1.5rem;
        font-size: 1.125rem;
    }
}

/* Media queries */
@mobile {
    .v-component {
        p: 0.75rem;
        
        &__header, &__footer {
            flex-direction: column;
        }
    }
}`,

            layout: `/* Layout Veko */
$container-width: 1200px;
$gap: 1rem;

* {
    box-sizing: border-box;
}

body {
    m: 0;
    p: 0;
    min-h: 100vh;
    display: flex;
    flex-direction: column;
}

.container {
    w: 100%;
    maxw: $container-width;
    m: 0 auto;
    p: 0 1rem;
}

.v-layout {
    display: flex;
    flex: 1;
    
    &__main {
        flex: 1;
        p: $gap;
    }
    
    &__sidebar {
        w: 300px;
        p: $gap;
        border-left: 1px solid #eee;
    }
    
    &__header {
        p: $gap;
        border-bottom: 1px solid #eee;
    }
    
    &__footer {
        p: $gap;
        border-top: 1px solid #eee;
    }
}

/* Grille flexible */
.v-grid {
    display: flex;
    flex-wrap: wrap;
    m: 0 (-$gap/2);
    
    &__item {
        p: 0 ($gap/2) $gap;
    }
    
    /* Colonnes */
    @for 1 to 12 {
        &__item--{i} {
            w: calc({i} / 12 * 100%);
        }
    }
}

/* Media queries */
@tablet {
    .v-layout {
        flex-direction: column;
        
        &__sidebar {
            w: 100%;
            border-left: none;
            border-top: 1px solid #eee;
        }
    }
    
    .v-grid {
        &__item--tablet-6 {
            w: 50%;
        }
        
        &__item--tablet-12 {
            w: 100%;
        }
    }
}

@mobile {
    .v-grid {
        &__item {
            w: 100% !important;
        }
    }
}`,

            animation: `/* Animations Veko */
$transition-speed: 0.3s;
$transition-function: ease;

/* Variables */
$bounce: cubic-bezier(0.175, 0.885, 0.32, 1.275);
$ease-out-back: cubic-bezier(0.175, 0.885, 0.32, 1.275);
$ease-in-out-sine: cubic-bezier(0.445, 0.05, 0.55, 0.95);

/* Transitions de base */
.v-transition {
    transition: all $transition-speed $transition-function;
    
    &--slow {
        transition-duration: 0.5s;
    }
    
    &--fast {
        transition-duration: 0.15s;
    }
    
    &--bounce {
        transition-timing-function: $bounce;
    }
    
    &--sine {
        transition-timing-function: $ease-in-out-sine;
    }
}

/* Animations */
@keyframes v-fade-in {
    0% { opacity: 0; }
    100% { opacity: 1; }
}

@keyframes v-fade-out {
    0% { opacity: 1; }
    100% { opacity: 0; }
}

@keyframes v-slide-up {
    0% { transform: translateY(20px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
}

@keyframes v-slide-down {
    0% { transform: translateY(-20px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
}

@keyframes v-slide-left {
    0% { transform: translateX(20px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
}

@keyframes v-slide-right {
    0% { transform: translateX(-20px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
}

@keyframes v-scale {
    0% { transform: scale(0.9); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
}

@keyframes v-shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-5px); }
    40%, 80% { transform: translateX(5px); }
}

@keyframes v-pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

/* Classes d'animation */
.v-animate {
    &--fade-in {
        animation: v-fade-in $transition-speed forwards;
    }
    
    &--fade-out {
        animation: v-fade-out $transition-speed forwards;
    }
    
    &--slide-up {
        animation: v-slide-up $transition-speed forwards;
    }
    
    &--slide-down {
        animation: v-slide-down $transition-speed forwards;
    }
    
    &--slide-left {
        animation: v-slide-left $transition-speed forwards;
    }
    
    &--slide-right {
        animation: v-slide-right $transition-speed forwards;
    }
    
    &--scale {
        animation: v-scale $transition-speed forwards;
    }
    
    &--shake {
        animation: v-shake 0.5s;
    }
    
    &--pulse {
        animation: v-pulse 1s infinite;
    }
    
    &--slow {
        animation-duration: 0.5s;
    }
    
    &--fast {
        animation-duration: 0.15s;
    }
    
    &--delay-1 {
        animation-delay: 0.1s;
    }
    
    &--delay-2 {
        animation-delay: 0.2s;
    }
    
    &--delay-3 {
        animation-delay: 0.3s;
    }
}

/* Effets au survol */
.v-hover {
    &--grow {
        transition: transform $transition-speed;
        
        &:hover {
            transform: scale(1.05);
        }
    }
    
    &--shrink {
        transition: transform $transition-speed;
        
        &:hover {
            transform: scale(0.95);
        }
    }
    
    &--float {
        transition: transform $transition-speed;
        
        &:hover {
            transform: translateY(-5px);
        }
    }
    
    &--shadow {
        transition: box-shadow $transition-speed;
        
        &:hover {
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
    }
}`,

            responsive: `/* Framework Responsive Veko */
$breakpoints: (
    xs: 0,
    sm: 576px,
    md: 768px,
    lg: 992px,
    xl: 1200px,
    xxl: 1400px
);

* {
    box-sizing: border-box;
    m: 0;
    p: 0;
}

html {
    font-size: 16px;
}

body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
}

/* Conteneurs */
.container {
    w: 100%;
    p: 0 15px;
    m: 0 auto;
}

@media (min-width: 576px) {
    .container {
        maxw: 540px;
    }
}

@media (min-width: 768px) {
    .container {
        maxw: 720px;
    }
}

@media (min-width: 992px) {
    .container {
        maxw: 960px;
    }
}

@media (min-width: 1200px) {
    .container {
        maxw: 1140px;
    }
}

.container-fluid {
    w: 100%;
    p: 0 15px;
    m: 0 auto;
}

/* Grille */
.row {
    display: flex;
    flex-wrap: wrap;
    m: 0 -15px;
}

.col {
    flex-basis: 0;
    flex-grow: 1;
    maxw: 100%;
    p: 0 15px;
}

/* Définir les colonnes pour chaque breakpoint */
@for 1 to 12 {
    .col-{i} {
        flex: 0 0 calc({i} / 12 * 100%);
        maxw: calc({i} / 12 * 100%);
    }
}

/* Breakpoints sm */
@media (min-width: 576px) {
    @for 1 to 12 {
        .col-sm-{i} {
            flex: 0 0 calc({i} / 12 * 100%);
            maxw: calc({i} / 12 * 100%);
        }
    }
}

/* Breakpoints md */
@media (min-width: 768px) {
    @for 1 to 12 {
        .col-md-{i} {
            flex: 0 0 calc({i} / 12 * 100%);
            maxw: calc({i} / 12 * 100%);
        }
    }
}

/* Breakpoints lg */
@media (min-width: 992px) {
    @for 1 to 12 {
        .col-lg-{i} {
            flex: 0 0 calc({i} / 12 * 100%);
            maxw: calc({i} / 12 * 100%);
        }
    }
}

/* Breakpoints xl */
@media (min-width: 1200px) {
    @for 1 to 12 {
        .col-xl-{i} {
            flex: 0 0 calc({i} / 12 * 100%);
            maxw: calc({i} / 12 * 100%);
        }
    }
}

/* Classes d'affichage responsive */
.d-none { display: none; }
.d-block { display: block; }
.d-inline { display: inline; }
.d-inline-block { display: inline-block; }
.d-flex { display: flex; }
.d-grid { display: grid; }

@media (min-width: 576px) {
    .d-sm-none { display: none; }
    .d-sm-block { display: block; }
    .d-sm-inline { display: inline; }
    .d-sm-inline-block { display: inline-block; }
    .d-sm-flex { display: flex; }
    .d-sm-grid { display: grid; }
}

@media (min-width: 768px) {
    .d-md-none { display: none; }
    .d-md-block { display: block; }
    .d-md-inline { display: inline; }
    .d-md-inline-block { display: inline-block; }
    .d-md-flex { display: flex; }
    .d-md-grid { display: grid; }
}

@media (min-width: 992px) {
    .d-lg-none { display: none; }
    .d-lg-block { display: block; }
    .d-lg-inline { display: inline; }
    .d-lg-inline-block { display: inline-block; }
    .d-lg-flex { display: flex; }
    .d-lg-grid { display: grid; }
}

@media (min-width: 1200px) {
    .d-xl-none { display: none; }
    .d-xl-block { display: block; }
    .d-xl-inline { display: inline; }
    .d-xl-inline-block { display: inline-block; }
    .d-xl-flex { display: flex; }
    .d-xl-grid { display: grid; }
}

/* Marges et rembourrage responsive */
@for 0 to 5 {
    .m-{i} { m: calc({i} * 0.25rem); }
    .p-{i} { p: calc({i} * 0.25rem); }
    
    .mt-{i} { mt: calc({i} * 0.25rem); }
    .mb-{i} { mb: calc({i} * 0.25rem); }
    .ml-{i} { ml: calc({i} * 0.25rem); }
    .mr-{i} { mr: calc({i} * 0.25rem); }
    
    .mx-{i} { mx: calc({i} * 0.25rem); }
    .my-{i} { my: calc({i} * 0.25rem); }
    
    .pt-{i} { pt: calc({i} * 0.25rem); }
    .pb-{i} { pb: calc({i} * 0.25rem); }
    .pl-{i} { pl: calc({i} * 0.25rem); }
    .pr-{i} { pr: calc({i} * 0.25rem); }
    
    .px-{i} { px: calc({i} * 0.25rem); }
    .py-{i} { py: calc({i} * 0.25rem); }
}

/* Textes responsive */
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

@media (min-width: 576px) {
    .text-sm-center { text-align: center; }
    .text-sm-left { text-align: left; }
    .text-sm-right { text-align: right; }
}

@media (min-width: 768px) {
    .text-md-center { text-align: center; }
    .text-md-left { text-align: left; }
    .text-md-right { text-align: right; }
}

@media (min-width: 992px) {
    .text-lg-center { text-align: center; }
    .text-lg-left { text-align: left; }
    .text-lg-right { text-align: right; }
}

@media (min-width: 1200px) {
    .text-xl-center { text-align: center; }
    .text-xl-left { text-align: left; }
    .text-xl-right { text-align: right; }
}`
        };
        
        // ...existing code...
    }

    // Génération de documentation améliorée
    generateDocumentation() {
        let doc = `# Documentation CSS Simplifiée Veko

## Introduction

La syntaxe CSS simplifiée de Veko permet d'écrire du CSS plus rapidement et plus clairement.
Elle offre une expérience similaire à Sass/SCSS mais avec une syntaxe encore plus concise et des fonctionnalités adaptées au framework Veko.

## Installation et utilisation

\`\`\`bash
# Compiler les fichiers CSS
npx veko css build src/css public/css

# Mode surveillance (développement)
npx veko css watch src/css public/css

# Créer un nouveau template
npx veko css create basic src/css/style.vcss

# Bundler les fichiers CSS
npx veko css bundle src/css public/css index.vcss bundle.css

# Optimiser les fichiers CSS
npx veko css optimize public/css --purge src/views

# Analyser un fichier CSS
npx veko css analyze src/css style.vcss
\`\`\`

## Variables

La déclaration et l'utilisation de variables sont simples et intuitives :

\`\`\`css
/* Définition de variables */
$primary: #3490dc;
$spacing: 1rem;
$font-size: 16px;

/* Utilisation des variables */
.element {
    color: $primary;
    padding: $spacing;
    font-size: $font-size;
}
\`\`\`

## Raccourcis de propriétés

Les raccourcis permettent d'écrire moins de code tout en restant expressif :

\`\`\`css
/* Avant (syntaxe simplifiée) */
.element {
    w: 100%;
    h: 200px;
    m: 10px;
    p: 15px;
    bg: primary;
    flex: true;
    items-center: true;
    justify-between: true;
    rounded: true;
}

/* Après compilation (CSS standard) */
.element {
    width: 100%;
    height: 200px;
    margin: 10px;
    padding: 15px;
    background: #3490dc;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 0.25rem;
}
\`\`\`

### Liste des raccourcis principaux

| Raccourci       | Propriété CSS                         |
|-----------------|---------------------------------------|
| w               | width                                 |
| h               | height                                |
| m               | margin                                |
| p               | padding                               |
| mt, mr, mb, ml  | margin-top, -right, -bottom, -left    |
| pt, pr, pb, pl  | padding-top, -right, -bottom, -left   |
| mx              | margin-left + margin-right            |
| my              | margin-top + margin-bottom            |
| px              | padding-left + padding-right          |
| py              | padding-top + padding-bottom          |
| flex            | display: flex                         |
| grid            | display: grid                         |
| block           | display: block                        |
| none            | display: none                         |
| text-center     | text-align: center                    |
| rounded         | border-radius: 0.25rem                |
| shadow          | box-shadow: 0 2px 4px rgba(0,0,0,0.1) |
| bg              | background                            |

## Media Queries simplifiées

Veko simplifie l'écriture des media queries pour le responsive design :

\`\`\`css
/* Media queries simplifiées */
@mobile {
    .element {
        w: 100%;
        p: 10px;
    }
}

@tablet {
    .element {
        w: 50%;
    }
}

/* Compilation en CSS standard */
@media (max-width: 576px) {
    .element {
        width: 100%;
        padding: 10px;
    }
}

@media (min-width: 576px) and (max-width: 992px) {
    .element {
        width: 50%;
    }
}
\`\`\`

### Breakpoints prédéfinis

| Nom        | Condition                                          |
|------------|---------------------------------------------------|
| mobile     | (max-width: 576px)                                |
| tablet     | (min-width: 576px) and (max-width: 992px)         |
| desktop    | (min-width: 768px)                                |
| widescreen | (min-width: 1200px)                               |
| dark       | (prefers-color-scheme: dark)                      |
| light      | (prefers-color-scheme: light)                     |
| print      | print                                             |
| portrait   | (orientation: portrait)                           |
| landscape  | (orientation: landscape)                          |

## Mixins

Les mixins permettent de réutiliser des blocs de styles :

\`\`\`css
/* Définition d'un mixin */
@mixin btn-primary {
    bg: $primary;
    p: 10px 15px;
    color: white;
    rounded: true;
    transition: all 0.3s ease;
}

/* Utilisation du mixin */
.btn {
    @btn-primary;
    text-center: true;
}

.btn-large {
    @btn-primary;
    p: 15px 20px;
    font-size: 1.2rem;
}
\`\`\`

## Fonctions de couleur

Veko inclut des fonctions pour manipuler les couleurs :

\`\`\`css
.btn-hover {
    background-color: @lighten($primary, 10%);
    color: @darken(white, 10%);
}

.overlay {
    background-color: @fade(black, 50%);
}

.gradient {
    background: @mix(blue, purple, 70%);
}
\`\`\`

## Sélecteurs imbriqués 

Le symbole & permet de référencer le sélecteur parent :

\`\`\`css
.card {
    bg: white;
    m: 10px;
    p: 15px;
    
    &__header {
        font-weight: bold;
        mb: 10px;
    }
    
    &__body {
        font-size: 0.9rem;
    }
    
    &:hover {
        bg: #f8f8f8;
    }
    
    &--featured {
        border-left: 4px solid $primary;
    }
}

/* Compile en : */
.card { background: white; margin: 10px; padding: 15px; }
.card__header { font-weight: bold; margin-bottom: 10px; }
.card__body { font-size: 0.9rem; }
.card:hover { background: #f8f8f8; }
.card--featured { border-left: 4px solid #3490dc; }
\`\`\`

## Import de fichiers

Simplifiez l'organisation de votre code avec des imports :

\`\`\`css
/* Import d'autres fichiers */
@import "variables";
@import "reset";
@import "components/buttons";
@import "layout/header";

/* Remarque : Les extensions de fichier sont optionnelles */
\`\`\`

## Bundling et optimisation

Veko offre des outils puissants pour regrouper et optimiser vos styles :

\`\`\`bash
# Regrouper tous les fichiers en un seul
npx veko css bundle src/css dist/css main.vcss bundle.min.css

# Optimiser en supprimant le CSS non utilisé
npx veko css optimize dist/css --purge src/views

# Optimiser avec plusieurs options
npx veko css optimize dist/css --purge src/views --merge --no-minify
\`\`\`

## Templates disponibles

Veko fournit plusieurs templates prêts à l'emploi :

\`\`\`bash
npx veko css create basic src/css/style.vcss
npx veko css create reset src/css/reset.vcss
npx veko css create grid src/css/grid.vcss
npx veko css create theme src/css/theme.vcss
npx veko css create component src/css/component.vcss
npx veko css create layout src/css/layout.vcss
npx veko css create animation src/css/animation.vcss
npx veko css create responsive src/css/responsive.vcss
\`\`\`

## Analyse de CSS

Analysez vos styles pour identifier les problèmes et optimiser votre code :

\`\`\`bash
npx veko css analyze src/css style.vcss
\`\`\`

L'analyse fournit des informations sur :
- Nombre de règles et sélecteurs
- Taille du fichier
- Propriétés les plus utilisées
- Palette de couleurs
- Spécificité et complexité
- Recommandations d'optimisation
`;
        return doc;
    }
}

module.exports = CssManager;