#!/usr/bin/env node

/**
 * Veko.js CLI - Zero Dependencies
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Colors (ANSI)
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

// Get version
let version = '1.2.18';
try {
  const pkg = require('../package.json');
  version = pkg.version;
} catch {}

// Logo
function showLogo() {
  console.log();
  console.log(c('cyan', '  ██╗   ██╗███████╗██╗  ██╗ ██████╗ '));
  console.log(c('cyan', '  ██║   ██║██╔════╝██║ ██╔╝██╔═══██╗'));
  console.log(c('cyan', '  ██║   ██║█████╗  █████╔╝ ██║   ██║'));
  console.log(c('cyan', '  ╚██╗ ██╔╝██╔══╝  ██╔═██╗ ██║   ██║'));
  console.log(c('cyan', '   ╚████╔╝ ███████╗██║  ██╗╚██████╔╝'));
  console.log(c('cyan', '    ╚═══╝  ╚══════╝╚═╝  ╚═╝ ╚═════╝ '));
  console.log();
  console.log(c('gray', `  Zero-dependency Node.js framework v${version}`));
  console.log();
}

// Help
function showHelp() {
  showLogo();
  console.log(c('bold', 'Usage:'));
  console.log('  veko <command> [options]');
  console.log();
  console.log(c('bold', 'Commands:'));
  console.log('  init [name]     Create a new Veko project');
  console.log('  dev             Start development server');
  console.log('  start           Start production server');
  console.log('  build           Build for production');
  console.log();
  console.log(c('bold', 'Options:'));
  console.log('  -v, --version   Show version');
  console.log('  -h, --help      Show this help');
  console.log();
  console.log(c('bold', 'Examples:'));
  console.log(c('gray', '  $ veko init my-app'));
  console.log(c('gray', '  $ veko dev'));
  console.log(c('gray', '  $ veko start'));
  console.log();
}

// Parse args
const args = process.argv.slice(2);
const command = args[0];

// Version
if (args.includes('-v') || args.includes('--version')) {
  console.log(version);
  process.exit(0);
}

// Help
if (!command || args.includes('-h') || args.includes('--help')) {
  showHelp();
  process.exit(0);
}

// Commands
switch (command) {
  case 'init':
    initProject(args[1]);
    break;
  case 'dev':
    runDev();
    break;
  case 'start':
    runStart();
    break;
  case 'build':
    runBuild();
    break;
  default:
    console.log(c('red', `Unknown command: ${command}`));
    showHelp();
    process.exit(1);
}

// Init project
function initProject(name) {
  const projectName = name || 'veko-app';
  const projectPath = path.join(process.cwd(), projectName);
  
  console.log();
  console.log(c('cyan', `Creating ${projectName}...`));
  
  // Create directory
  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }
  
  // Create package.json
  const pkg = {
    name: projectName,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'node index.js',
      start: 'NODE_ENV=production node index.js'
    },
    dependencies: {
      veko: `^${version}`
    }
  };
  fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(pkg, null, 2));
  
  // Create index.js
  const indexJs = `const { createApp } = require('veko');

const app = createApp({ port: 3000 });

// Home route
app.get('/', (req, res) => {
  res.html(\`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Veko App</title>
      <style>
        body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { text-align: center; color: white; }
        h1 { font-size: 3rem; margin-bottom: 0.5rem; }
        p { opacity: 0.8; }
        code { background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Welcome to Veko</h1>
        <p>Zero-dependency Node.js framework</p>
        <p><code>Edit index.js to get started</code></p>
      </div>
    </body>
    </html>
  \`);
});

// API route example
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Veko!', time: new Date().toISOString() });
});

app.listen(3000, () => {
  console.log('\\x1b[32m✓\\x1b[0m Server running at http://localhost:3000');
});
`;
  fs.writeFileSync(path.join(projectPath, 'index.js'), indexJs);
  
  // Create public folder
  fs.mkdirSync(path.join(projectPath, 'public'), { recursive: true });
  fs.writeFileSync(path.join(projectPath, 'public', '.gitkeep'), '');
  
  // Create components folder for VSV
  fs.mkdirSync(path.join(projectPath, 'components'), { recursive: true });
  
  // Create example VSV component
  const homeVsv = `export default function Home(props) {
  const [count, setCount] = $state(0);
  
  return (
    <div class="container">
      <h1>Welcome to Veko</h1>
      <p>Count: {count()}</p>
      <button @click={() => setCount(c => c + 1)}>Increment</button>
    </div>
  );
}
`;
  fs.writeFileSync(path.join(projectPath, 'components', 'Home.jsv'), homeVsv);
  
  console.log(c('green', '✓') + ' Created project structure');
  console.log();
  console.log(c('bold', 'Next steps:'));
  console.log(c('gray', `  cd ${projectName}`));
  console.log(c('gray', '  npm install'));
  console.log(c('gray', '  npm run dev'));
  console.log();
}

// Dev server
function runDev() {
  console.log();
  console.log(c('cyan', '▲ Veko.js ') + c('gray', version));
  
  const entryFiles = ['index.js', 'src/index.js', 'app.js', 'server.js'];
  let entry = null;
  
  for (const file of entryFiles) {
    if (fs.existsSync(path.join(process.cwd(), file))) {
      entry = file;
      break;
    }
  }
  
  if (!entry) {
    console.log(c('red', '✗ No entry file found (index.js, app.js, server.js)'));
    process.exit(1);
  }
  
  console.log(c('gray', `  Starting ${entry}...`));
  console.log();
  
  const child = spawn('node', [entry], { 
    cwd: process.cwd(), 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  child.on('error', (err) => {
    console.error(c('red', `Error: ${err.message}`));
  });
}

// Production start
function runStart() {
  console.log();
  console.log(c('cyan', '▲ Veko.js ') + c('gray', version) + c('green', ' (production)'));
  
  const entryFiles = ['index.js', 'src/index.js', 'app.js', 'server.js'];
  let entry = null;
  
  for (const file of entryFiles) {
    if (fs.existsSync(path.join(process.cwd(), file))) {
      entry = file;
      break;
    }
  }
  
  if (!entry) {
    console.log(c('red', '✗ No entry file found'));
    process.exit(1);
  }
  
  const child = spawn('node', [entry], { 
    cwd: process.cwd(), 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
}

// Build
function runBuild() {
  console.log();
  console.log(c('cyan', '▲ Veko.js Build'));
  console.log(c('gray', '  No build step needed - Veko runs natively!'));
  console.log(c('green', '✓ Ready for production'));
  console.log();
}
