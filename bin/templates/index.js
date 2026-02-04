/**
 * Veko.js Project Templates
 * Complete template system for project generation
 */

const templates = {
  // ============================================
  // DEFAULT TEMPLATE - Simple EJS Web App
  // ============================================
  default: {
    name: 'Default',
    description: 'Simple web application with EJS templates',
    icon: '🌐',
    dependencies: {
      'express': '^4.18.2',
      'ejs': '^3.1.9',
      'veko': 'latest',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4',
      'cookie-parser': '^1.4.6'
    },
    devDependencies: {
      'nodemon': '^3.0.2'
    }
  },

  // ============================================
  // TYPESCRIPT TEMPLATE
  // ============================================
  typescript: {
    name: 'TypeScript',
    description: 'TypeScript-first web application',
    icon: '📘',
    dependencies: {
      'express': '^4.18.2',
      'ejs': '^3.1.9',
      'veko': 'latest',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4',
      'cookie-parser': '^1.4.6'
    },
    devDependencies: {
      'typescript': '^5.3.3',
      '@types/node': '^20.10.0',
      '@types/express': '^4.17.21',
      '@types/compression': '^1.7.5',
      '@types/cookie-parser': '^1.4.6',
      'ts-node': '^10.9.2',
      'ts-node-dev': '^2.0.0',
      'nodemon': '^3.0.2'
    }
  },

  // ============================================
  // REACT SSR TEMPLATE
  // ============================================
  react: {
    name: 'React SSR',
    description: 'React with Server-Side Rendering',
    icon: '⚛️',
    dependencies: {
      'express': '^4.18.2',
      'veko': 'latest',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4'
    },
    devDependencies: {
      'esbuild': '^0.19.8',
      'nodemon': '^3.0.2',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0'
    }
  },

  // ============================================
  // REACT + TYPESCRIPT TEMPLATE
  // ============================================
  'react-typescript': {
    name: 'React + TypeScript',
    description: 'React SSR with full TypeScript support',
    icon: '⚛️📘',
    dependencies: {
      'express': '^4.18.2',
      'veko': 'latest',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4'
    },
    devDependencies: {
      'typescript': '^5.3.3',
      '@types/node': '^20.10.0',
      '@types/express': '^4.17.21',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      'esbuild': '^0.19.8',
      'ts-node': '^10.9.2',
      'ts-node-dev': '^2.0.0',
      'nodemon': '^3.0.2'
    }
  },

  // ============================================
  // API TEMPLATE
  // ============================================
  api: {
    name: 'REST API',
    description: 'RESTful API with authentication ready',
    icon: '🔌',
    dependencies: {
      'express': '^4.18.2',
      'veko': 'latest',
      'cors': '^2.8.5',
      'helmet': '^7.1.0',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4',
      'express-rate-limit': '^7.1.5',
      'jsonwebtoken': '^9.0.2',
      'bcryptjs': '^2.4.3',
      'validator': '^13.11.0',
      'morgan': '^1.10.0'
    },
    devDependencies: {
      'nodemon': '^3.0.2',
      'jest': '^29.7.0',
      'supertest': '^6.3.3'
    }
  },

  // ============================================
  // API + TYPESCRIPT TEMPLATE
  // ============================================
  'api-typescript': {
    name: 'REST API + TypeScript',
    description: 'TypeScript REST API with validation',
    icon: '🔌📘',
    dependencies: {
      'express': '^4.18.2',
      'veko': 'latest',
      'cors': '^2.8.5',
      'helmet': '^7.1.0',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4',
      'express-rate-limit': '^7.1.5',
      'jsonwebtoken': '^9.0.2',
      'bcryptjs': '^2.4.3',
      'validator': '^13.11.0',
      'morgan': '^1.10.0',
      'zod': '^3.22.4'
    },
    devDependencies: {
      'typescript': '^5.3.3',
      '@types/node': '^20.10.0',
      '@types/express': '^4.17.21',
      '@types/cors': '^2.8.17',
      '@types/jsonwebtoken': '^9.0.5',
      '@types/bcryptjs': '^2.4.6',
      '@types/validator': '^13.11.7',
      '@types/morgan': '^1.9.9',
      'ts-node': '^10.9.2',
      'ts-node-dev': '^2.0.0',
      'nodemon': '^3.0.2',
      'jest': '^29.7.0',
      '@types/jest': '^29.5.11',
      'ts-jest': '^29.1.1',
      'supertest': '^6.3.3',
      '@types/supertest': '^2.0.16'
    }
  },

  // ============================================
  // FULL TEMPLATE - Everything included
  // ============================================
  full: {
    name: 'Full Featured',
    description: 'Complete project with auth, database, plugins',
    icon: '🚀',
    dependencies: {
      'express': '^4.18.2',
      'ejs': '^3.1.9',
      'veko': 'latest',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4',
      'cookie-parser': '^1.4.6',
      'cors': '^2.8.5',
      'helmet': '^7.1.0',
      'express-rate-limit': '^7.1.5',
      'express-session': '^1.17.3',
      'jsonwebtoken': '^9.0.2',
      'bcryptjs': '^2.4.3',
      'validator': '^13.11.0',
      'morgan': '^1.10.0',
      'multer': '^1.4.5-lts.1',
      'sharp': '^0.33.1'
    },
    devDependencies: {
      'nodemon': '^3.0.2',
      'jest': '^29.7.0',
      'supertest': '^6.3.3'
    }
  },

  // ============================================
  // TAILWIND TEMPLATE
  // ============================================
  tailwind: {
    name: 'Tailwind CSS',
    description: 'Beautiful UI with Tailwind CSS',
    icon: '🎨',
    dependencies: {
      'express': '^4.18.2',
      'ejs': '^3.1.9',
      'veko': 'latest',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4',
      'cookie-parser': '^1.4.6'
    },
    devDependencies: {
      'tailwindcss': '^3.4.0',
      'postcss': '^8.4.32',
      'autoprefixer': '^10.4.16',
      'nodemon': '^3.0.2',
      'concurrently': '^8.2.2'
    }
  },

  // ============================================
  // BLOG TEMPLATE
  // ============================================
  blog: {
    name: 'Blog',
    description: 'Markdown blog with syntax highlighting',
    icon: '📝',
    dependencies: {
      'express': '^4.18.2',
      'ejs': '^3.1.9',
      'veko': 'latest',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4',
      'marked': '^11.1.0',
      'highlight.js': '^11.9.0',
      'gray-matter': '^4.0.3',
      'reading-time': '^1.5.0',
      'feed': '^4.2.2',
      'slugify': '^1.6.6'
    },
    devDependencies: {
      'nodemon': '^3.0.2'
    }
  },

  // ============================================
  // E-COMMERCE TEMPLATE
  // ============================================
  ecommerce: {
    name: 'E-commerce',
    description: 'Online store with cart and payments',
    icon: '🛒',
    dependencies: {
      'express': '^4.18.2',
      'ejs': '^3.1.9',
      'veko': 'latest',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4',
      'cookie-parser': '^1.4.6',
      'express-session': '^1.17.3',
      'stripe': '^14.10.0',
      'helmet': '^7.1.0',
      'validator': '^13.11.0',
      'multer': '^1.4.5-lts.1',
      'sharp': '^0.33.1',
      'slugify': '^1.6.6'
    },
    devDependencies: {
      'nodemon': '^3.0.2',
      'tailwindcss': '^3.4.0',
      'postcss': '^8.4.32',
      'autoprefixer': '^10.4.16'
    }
  },

  // ============================================
  // DASHBOARD TEMPLATE
  // ============================================
  dashboard: {
    name: 'Admin Dashboard',
    description: 'Admin panel with charts and tables',
    icon: '📊',
    dependencies: {
      'express': '^4.18.2',
      'ejs': '^3.1.9',
      'veko': 'latest',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4',
      'cookie-parser': '^1.4.6',
      'express-session': '^1.17.3',
      'jsonwebtoken': '^9.0.2',
      'bcryptjs': '^2.4.3',
      'helmet': '^7.1.0',
      'morgan': '^1.10.0'
    },
    devDependencies: {
      'nodemon': '^3.0.2',
      'tailwindcss': '^3.4.0',
      'postcss': '^8.4.32',
      'autoprefixer': '^10.4.16'
    }
  },

  // ============================================
  // REALTIME TEMPLATE
  // ============================================
  realtime: {
    name: 'Real-time App',
    description: 'WebSocket chat and notifications',
    icon: '⚡',
    dependencies: {
      'express': '^4.18.2',
      'ejs': '^3.1.9',
      'veko': 'latest',
      'dotenv': '^16.3.1',
      'compression': '^1.7.4',
      'socket.io': '^4.7.2',
      'express-session': '^1.17.3',
      'helmet': '^7.1.0'
    },
    devDependencies: {
      'nodemon': '^3.0.2'
    }
  }
};

module.exports = templates;
