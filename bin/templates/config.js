/**
 * Config Files Generator
 * Generates package.json, tsconfig, .env, etc.
 */

const fs = require('fs');
const path = require('path');
const templates = require('./index');

class ConfigGenerator {
  constructor(config) {
    this.config = config;
    this.projectPath = config.projectPath;
    this.templateConfig = templates[config.template] || templates.default;
  }

  generate() {
    this.generatePackageJson();
    this.generateEnv();
    this.generateGitignore();
    this.generateReadme();
    this.generateEditorConfig();
    this.generatePrettierConfig();
    this.generateEslintConfig();
    
    if (this.config.typescript) {
      this.generateTsConfig();
    }
    
    if (this.config.docker) {
      this.generateDockerFiles();
    }
    
    this.generateVekoConfig();
  }

  generatePackageJson() {
    const pkg = {
      name: this.config.projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: `${this.config.projectName} - Built with VekoJS`,
      main: this.config.typescript ? 'dist/index.js' : 'src/index.js',
      scripts: {
        dev: 'veko dev',
        build: this.config.typescript ? 'tsc && veko build' : 'veko build',
        start: 'NODE_ENV=production node ' + (this.config.typescript ? 'dist/index.js' : 'src/index.js'),
        lint: 'eslint . --ext .js,.ts',
        'lint:fix': 'eslint . --ext .js,.ts --fix',
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage'
      },
      keywords: ['veko', 'nodejs', 'express', 'web'],
      author: '',
      license: 'MIT',
      dependencies: {
        vekojs: '^1.2.5',
        ...this.templateConfig.dependencies
      },
      devDependencies: {
        eslint: '^8.57.0',
        prettier: '^3.2.5',
        jest: '^29.7.0',
        ...this.templateConfig.devDependencies
      },
      engines: {
        node: '>=18.0.0'
      }
    };

    // Add nodemon for dev mode
    if (!pkg.devDependencies.nodemon) {
      pkg.devDependencies.nodemon = '^3.1.0';
    }

    fs.writeFileSync(
      path.join(this.projectPath, 'package.json'),
      JSON.stringify(pkg, null, 2)
    );
  }

  generateEnv() {
    let env = `# ${this.config.projectName} Environment Variables
# Built with VekoJS

# Server
NODE_ENV=development
PORT=3000

# Security
SESSION_SECRET=${this.generateSecret()}
JWT_SECRET=${this.generateSecret()}

# Database (if needed)
# DATABASE_URL=mongodb://localhost:27017/${this.config.projectName.toLowerCase().replace(/\s+/g, '_')}

# CORS
CORS_ORIGIN=http://localhost:3000
`;

    // Add template-specific env vars
    switch (this.config.template) {
      case 'ecommerce':
        env += `
# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
`;
        break;
      case 'blog':
        env += `
# Blog
SITE_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
`;
        break;
      case 'realtime':
        env += `
# Socket.io
SOCKET_CORS_ORIGIN=*
`;
        break;
    }

    fs.writeFileSync(path.join(this.projectPath, '.env'), env);
    fs.writeFileSync(path.join(this.projectPath, '.env.example'), env.replace(/=.+/g, '='));
  }

  generateGitignore() {
    const gitignore = `# Dependencies
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build
dist/
build/
.cache/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Coverage
coverage/
.nyc_output/

# Misc
.tmp/
temp/
*.bak
`;

    fs.writeFileSync(path.join(this.projectPath, '.gitignore'), gitignore);
  }

  generateReadme() {
    const readme = `# ${this.config.projectName}

${this.templateConfig.description}

Built with [VekoJS](https://www.npmjs.com/package/vekojs) 🚀

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
\`\`\`

## Project Structure

\`\`\`
${this.config.projectName}/
├── src/
│   ├── index.${this.config.typescript ? 'ts' : 'js'}    # Main entry point
│   ├── routes/              # Route handlers
│   ├── views/               # EJS templates
│   └── public/              # Static assets
├── .env                     # Environment variables
├── package.json
└── README.md
\`\`\`

## Available Scripts

| Script | Description |
|--------|-------------|
| \`npm run dev\` | Start development server with hot reload |
| \`npm run build\` | Build for production |
| \`npm start\` | Start production server |
| \`npm run lint\` | Run ESLint |
| \`npm test\` | Run tests |

## Environment Variables

Copy \`.env.example\` to \`.env\` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| \`PORT\` | Server port | 3000 |
| \`NODE_ENV\` | Environment | development |
| \`SESSION_SECRET\` | Session encryption key | - |

## Features

${this.getFeaturesList()}

## Documentation

- [VekoJS Documentation](https://www.npmjs.com/package/vekojs)
- [Express.js Guide](https://expressjs.com/)
${this.config.typescript ? '- [TypeScript Handbook](https://www.typescriptlang.org/docs/)' : ''}
${this.config.react ? '- [React Documentation](https://react.dev/)' : ''}

## License

MIT © ${new Date().getFullYear()}
`;

    fs.writeFileSync(path.join(this.projectPath, 'README.md'), readme);
  }

  getFeaturesList() {
    const features = [
      '- ✅ Express.js server',
      '- ✅ EJS templating',
      '- ✅ Hot reload development',
      '- ✅ Security headers (Helmet)',
      '- ✅ Compression',
    ];

    if (this.config.typescript) {
      features.push('- ✅ TypeScript support');
    }
    if (this.config.react) {
      features.push('- ✅ React SSR');
    }
    if (this.config.tailwind) {
      features.push('- ✅ Tailwind CSS');
    }
    if (this.config.template === 'api' || this.config.template === 'api-typescript') {
      features.push('- ✅ REST API with JWT auth');
      features.push('- ✅ Rate limiting');
      features.push('- ✅ CORS configuration');
    }
    if (this.config.template === 'realtime') {
      features.push('- ✅ WebSocket (Socket.io)');
      features.push('- ✅ Real-time messaging');
    }
    if (this.config.template === 'blog') {
      features.push('- ✅ Markdown blog posts');
      features.push('- ✅ Syntax highlighting');
      features.push('- ✅ RSS feed');
    }
    if (this.config.template === 'ecommerce') {
      features.push('- ✅ Shopping cart');
      features.push('- ✅ Stripe payments');
    }
    if (this.config.template === 'dashboard') {
      features.push('- ✅ Admin dashboard');
      features.push('- ✅ Chart.js analytics');
      features.push('- ✅ User authentication');
    }

    return features.join('\n');
  }

  generateEditorConfig() {
    const editorConfig = `# EditorConfig
# https://editorconfig.org

root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.{json,yml,yaml}]
indent_size = 2
`;

    fs.writeFileSync(path.join(this.projectPath, '.editorconfig'), editorConfig);
  }

  generatePrettierConfig() {
    const prettierrc = {
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5',
      printWidth: 100,
      bracketSpacing: true,
      arrowParens: 'avoid',
      endOfLine: 'lf'
    };

    fs.writeFileSync(
      path.join(this.projectPath, '.prettierrc'),
      JSON.stringify(prettierrc, null, 2)
    );

    const prettierignore = `node_modules/
dist/
build/
coverage/
*.min.js
*.min.css
`;

    fs.writeFileSync(path.join(this.projectPath, '.prettierignore'), prettierignore);
  }

  generateEslintConfig() {
    const eslintrc = {
      env: {
        node: true,
        es2022: true,
        jest: true
      },
      extends: [
        'eslint:recommended'
      ],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'no-console': 'off',
        'prefer-const': 'error',
        'no-var': 'error'
      }
    };

    if (this.config.typescript) {
      eslintrc.parser = '@typescript-eslint/parser';
      eslintrc.plugins = ['@typescript-eslint'];
      eslintrc.extends.push('plugin:@typescript-eslint/recommended');
    }

    if (this.config.react) {
      eslintrc.extends.push('plugin:react/recommended');
      eslintrc.settings = {
        react: { version: 'detect' }
      };
    }

    fs.writeFileSync(
      path.join(this.projectPath, '.eslintrc.json'),
      JSON.stringify(eslintrc, null, 2)
    );

    const eslintignore = `node_modules/
dist/
build/
coverage/
public/js/*.min.js
`;

    fs.writeFileSync(path.join(this.projectPath, '.eslintignore'), eslintignore);
  }

  generateTsConfig() {
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2022'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        noImplicitAny: true,
        strictNullChecks: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'coverage']
    };

    if (this.config.react) {
      tsconfig.compilerOptions.jsx = 'react';
    }

    fs.writeFileSync(
      path.join(this.projectPath, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );
  }

  generateDockerFiles() {
    const dockerfile = `# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
${this.config.typescript ? 'RUN npm run build' : ''}

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
${this.config.typescript 
  ? 'COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist'
  : 'COPY --from=builder --chown=nodejs:nodejs /app/src ./src'
}
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

USER nodejs

EXPOSE 3000

CMD ["node", "${this.config.typescript ? 'dist' : 'src'}/index.js"]
`;

    fs.writeFileSync(path.join(this.projectPath, 'Dockerfile'), dockerfile);

    const dockerignore = `node_modules
npm-debug.log
Dockerfile*
docker-compose*
.git
.gitignore
.env*
coverage
*.md
`;

    fs.writeFileSync(path.join(this.projectPath, '.dockerignore'), dockerignore);

    const dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "\${PORT:-3000}:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
`;

    fs.writeFileSync(path.join(this.projectPath, 'docker-compose.yml'), dockerCompose);
  }

  generateVekoConfig() {
    const vekoConfig = {
      name: this.config.projectName,
      version: '1.0.0',
      template: this.config.template,
      options: {
        typescript: this.config.typescript || false,
        react: this.config.react || false,
        tailwind: this.config.tailwind || false,
        srcDir: true
      },
      server: {
        port: 3000,
        host: 'localhost'
      },
      build: {
        outDir: 'dist',
        minify: true,
        sourcemap: true
      },
      dev: {
        hotReload: true,
        openBrowser: false
      }
    };

    fs.writeFileSync(
      path.join(this.projectPath, 'veko.config.json'),
      JSON.stringify(vekoConfig, null, 2)
    );
  }

  generateSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

module.exports = ConfigGenerator;
