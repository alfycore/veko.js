/**
 * VekoJS Test Suite
 * Tests unitaires complets pour le framework VekoJS
 */

const path = require('path');
const fs = require('fs');

// Mock des dépendances externes avant l'import
jest.mock('ws', () => {
  return {
    Server: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      clients: new Set(),
      close: jest.fn()
    })),
    OPEN: 1
  };
}, { virtual: true });

jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    close: jest.fn()
  })
}), { virtual: true });

// Import après les mocks
const App = require('./lib/app');
const Logger = require('./lib/core/logger');

describe('VekoJS Framework', () => {
  
  describe('Logger', () => {
    let logger;
    let consoleSpy;

    beforeEach(() => {
      logger = new Logger();
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    test('should log success messages', () => {
      logger.log('success', 'Test message', 'details');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('should log error messages', () => {
      logger.log('error', 'Error message', 'error details');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('should log warning messages', () => {
      logger.log('warning', 'Warning message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('should log info messages', () => {
      logger.log('info', 'Info message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('should log dev messages', () => {
      logger.log('dev', 'Dev message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('should handle unknown log types gracefully', () => {
      logger.log('unknown_type', 'Unknown message');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('App Initialization', () => {
    let app;

    beforeEach(() => {
      app = new App({ 
        isDev: false,
        autoInstall: false,
        plugins: { enabled: false },
        autoUpdater: { enabled: false }
      });
    });

    afterEach(async () => {
      if (app) {
        await app.stop();
      }
    });

    test('should create App instance with default options', () => {
      expect(app).toBeInstanceOf(App);
      expect(app.options.port).toBe(3000);
      expect(app.options.wsPort).toBe(3008);
    });

    test('should create App instance with custom port', () => {
      const customApp = new App({ 
        port: 4000,
        autoInstall: false,
        plugins: { enabled: false },
        autoUpdater: { enabled: false }
      });
      expect(customApp.options.port).toBe(4000);
    });

    test('should have logger instance', () => {
      expect(app.logger).toBeInstanceOf(Logger);
    });

    test('should have routeManager', () => {
      expect(app.routeManager).toBeDefined();
    });

    test('should have layoutManager', () => {
      expect(app.layoutManager).toBeDefined();
    });
  });

  describe('App Options Validation', () => {
    test('should reject invalid port', () => {
      expect(() => new App({ 
        port: 99999,
        autoInstall: false,
        plugins: { enabled: false },
        autoUpdater: { enabled: false }
      })).toThrow();
    });

    test('should reject invalid wsPort', () => {
      expect(() => new App({ 
        wsPort: -1,
        autoInstall: false,
        plugins: { enabled: false },
        autoUpdater: { enabled: false }
      })).toThrow();
    });

    test('should accept valid port numbers', () => {
      const app = new App({ 
        port: 8080,
        wsPort: 8081,
        autoInstall: false,
        plugins: { enabled: false },
        autoUpdater: { enabled: false }
      });
      expect(app.options.port).toBe(8080);
      expect(app.options.wsPort).toBe(8081);
    });
  });

  describe('App Security Features', () => {
    let app;

    beforeEach(() => {
      app = new App({ 
        isDev: false,
        autoInstall: false,
        plugins: { enabled: false },
        autoUpdater: { enabled: false },
        security: {
          helmet: true,
          rateLimit: {
            windowMs: 15 * 60 * 1000,
            max: 100
          }
        }
      });
    });

    afterEach(async () => {
      if (app) {
        await app.stop();
      }
    });

    test('should have security configuration', () => {
      expect(app.options.security).toBeDefined();
      expect(app.options.security.helmet).toBe(true);
    });

    test('should have rate limiting configuration', () => {
      expect(app.options.security.rateLimit).toBeDefined();
      expect(app.options.security.rateLimit.max).toBe(100);
    });

    test('isValidPath should detect dangerous paths', () => {
      expect(app.isValidPath('../etc/passwd')).toBe(false);
      expect(app.isValidPath('..\\windows\\system32')).toBe(false);
      expect(app.isValidPath('normal/path')).toBe(true);
    });

    test('isValidPort should validate port ranges', () => {
      expect(app.isValidPort(80)).toBe(true);
      expect(app.isValidPort(3000)).toBe(true);
      expect(app.isValidPort(65535)).toBe(true);
      expect(app.isValidPort(0)).toBe(false);
      expect(app.isValidPort(-1)).toBe(false);
      expect(app.isValidPort(65536)).toBe(false);
    });

    test('isValidHeader should detect malicious headers', () => {
      expect(app.isValidHeader('normal-value')).toBe(true);
      expect(app.isValidHeader('<script>alert("xss")</script>')).toBe(false);
      expect(app.isValidHeader('value"with"quotes')).toBe(false);
    });
  });

  describe('RouteManager', () => {
    let app;

    beforeEach(() => {
      app = new App({ 
        isDev: false,
        autoInstall: false,
        plugins: { enabled: false },
        autoUpdater: { enabled: false }
      });
    });

    afterEach(async () => {
      if (app) {
        await app.stop();
      }
    });

    test('should have routeManager instance', () => {
      expect(app.routeManager).toBeDefined();
    });

    test('should validate route input correctly', () => {
      const routeManager = app.routeManager;
      
      // Test valid input
      const validResult = routeManager.validateRouteInput('GET', '/test', () => {});
      expect(validResult.method).toBe('get');
      expect(validResult.path).toBe('/test');
    });

    test('should reject invalid HTTP methods', () => {
      const routeManager = app.routeManager;
      
      expect(() => {
        routeManager.validateRouteInput('INVALID', '/test', () => {});
      }).toThrow('Méthode HTTP non autorisée');
    });

    test('should detect dangerous path patterns', () => {
      const routeManager = app.routeManager;
      
      expect(routeManager.containsDangerousPatterns('../etc/passwd')).toBe(true);
      expect(routeManager.containsDangerousPatterns('<script>')).toBe(true);
      expect(routeManager.containsDangerousPatterns('javascript:')).toBe(true);
      expect(routeManager.containsDangerousPatterns('/normal/path')).toBe(false);
    });

    test('should sanitize paths correctly', () => {
      const routeManager = app.routeManager;
      
      expect(routeManager.sanitizePath('test')).toBe('/test');
      expect(routeManager.sanitizePath('/test/')).toBe('/test');
      expect(routeManager.sanitizePath('//test//path//')).toBe('/test/path');
    });

    test('should check rate limiting', () => {
      const routeManager = app.routeManager;
      
      // First request should pass
      expect(routeManager.checkRateLimit('test-client')).toBe(true);
      
      // Simulate many requests
      for (let i = 0; i < 99; i++) {
        routeManager.checkRateLimit('test-client');
      }
      
      // 101st request should be blocked
      expect(routeManager.checkRateLimit('test-client')).toBe(false);
    });

    test('should create route with valid parameters', async () => {
      await app.createRoute('get', '/api/test', (req, res) => {
        res.json({ success: true });
      });
      
      expect(app.routeManager.routeExists('get', '/api/test')).toBe(true);
    });

    test('should delete route', async () => {
      await app.createRoute('get', '/api/delete-test', (req, res) => {
        res.json({ success: true });
      });
      
      await app.deleteRoute('get', '/api/delete-test');
      
      expect(app.routeManager.routeExists('get', '/api/delete-test')).toBe(false);
    });
  });

  describe('LayoutManager', () => {
    let app;

    beforeEach(() => {
      app = new App({ 
        isDev: false,
        autoInstall: false,
        plugins: { enabled: false },
        autoUpdater: { enabled: false }
      });
    });

    afterEach(async () => {
      if (app) {
        await app.stop();
      }
    });

    test('should have layoutManager instance', () => {
      expect(app.layoutManager).toBeDefined();
    });

    test('should have default layout options', () => {
      expect(app.options.layouts.enabled).toBe(true);
      expect(app.options.layouts.defaultLayout).toBe('main');
      expect(app.options.layouts.extension).toBe('.ejs');
    });

    test('should sanitize layout names', () => {
      const layoutManager = app.layoutManager;
      
      expect(layoutManager.sanitizeLayoutName('main')).toBe('main');
      expect(layoutManager.sanitizeLayoutName('../../../etc/passwd')).toBe('etcpasswd');
      expect(layoutManager.sanitizeLayoutName('<script>alert(1)</script>')).toBe('scriptalert1script');
    });

    test('should validate render parameters', () => {
      const layoutManager = app.layoutManager;
      
      // Should not throw for valid input
      expect(() => {
        layoutManager.validateRenderParameters('home', {});
      }).not.toThrow();
      
      // Should throw for invalid view name
      expect(() => {
        layoutManager.validateRenderParameters('', {});
      }).toThrow();
      
      // Should throw for path traversal
      expect(() => {
        layoutManager.validateRenderParameters('../secret', {});
      }).toThrow();
    });
  });

  describe('Authentication Manager', () => {
    let app;

    beforeEach(() => {
      app = new App({ 
        isDev: false,
        autoInstall: false,
        plugins: { enabled: false },
        autoUpdater: { enabled: false }
      });
    });

    afterEach(async () => {
      if (app) {
        await app.stop();
      }
    });

    test('should have auth manager instance', () => {
      expect(app.auth).toBeDefined();
    });

    test('should not be enabled by default', () => {
      expect(app.isAuthEnabled()).toBe(false);
    });

    test('should throw when requiring auth without enabling', () => {
      expect(() => {
        app.requireAuth();
      }).toThrow('Le système d\'authentification n\'est pas activé');
    });

    test('should sanitize input correctly', () => {
      const authManager = app.auth;
      
      // Le sanitizeInput supprime les caractères dangereux et échappe les entités HTML
      const sanitized = authManager.sanitizeInput('<script>alert(1)</script>');
      // Vérifie que les caractères dangereux sont échappés ou supprimés
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(authManager.sanitizeInput('normal text')).toBe('normal text');
    });

    test('should validate input against schema', () => {
      const authManager = app.auth;
      
      const schema = {
        username: { required: true, type: 'string', minLength: 3 },
        password: { required: true, type: 'string', minLength: 8 }
      };
      
      // Valid input
      const validResult = authManager.validateInput({
        username: 'testuser',
        password: 'password123'
      }, schema);
      expect(validResult.isValid).toBe(true);
      
      // Invalid input - missing field
      const invalidResult1 = authManager.validateInput({
        username: 'testuser'
      }, schema);
      expect(invalidResult1.isValid).toBe(false);
      
      // Invalid input - too short
      const invalidResult2 = authManager.validateInput({
        username: 'ab',
        password: 'password123'
      }, schema);
      expect(invalidResult2.isValid).toBe(false);
    });

    test('should generate CSRF tokens', () => {
      const authManager = app.auth;
      
      const token1 = authManager.generateCSRFToken();
      const token2 = authManager.generateCSRFToken();
      
      expect(token1).toBeDefined();
      expect(token1.length).toBe(64);
      expect(token1).not.toBe(token2);
    });

    test('should generate secret keys', () => {
      const authManager = app.auth;
      
      const key1 = authManager.generateSecretKey();
      const key2 = authManager.generateSecretKey();
      
      expect(key1).toBeDefined();
      expect(key1.length).toBe(128);
      expect(key1).not.toBe(key2);
    });
  });

  describe('Index Module Exports', () => {
    test('should export App class', () => {
      const veko = require('./index');
      expect(veko.App).toBeDefined();
    });

    test('should export createApp factory', () => {
      const veko = require('./index');
      expect(typeof veko.createApp).toBe('function');
    });

    test('should export startDev function', () => {
      const veko = require('./index');
      expect(typeof veko.startDev).toBe('function');
    });

    test('should export start function', () => {
      const veko = require('./index');
      expect(typeof veko.start).toBe('function');
    });

    test('createApp should create an App instance', () => {
      const veko = require('./index');
      const app = veko.createApp({ 
        autoInstall: false, 
        plugins: { enabled: false },
        autoUpdater: { enabled: false }
      });
      expect(app).toBeInstanceOf(App);
    });
  });

  describe('Security Tests', () => {
    let app;

    beforeEach(() => {
      app = new App({ 
        isDev: false,
        autoInstall: false,
        plugins: { enabled: false },
        autoUpdater: { enabled: false }
      });
    });

    afterEach(async () => {
      if (app) {
        await app.stop();
      }
    });

    test('should not contain malicious code patterns', () => {
      const fs = require('fs');
      const path = require('path');
      
      const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
      
      // Check for dangerous patterns
      const dangerousPatterns = [
        /eval\s*\(/,
        /Function\s*\(/,
        /require\s*\(\s*['"]child_process['"]\s*\)/,
        /spawn|exec|execSync/,
        /net\.connect/,
        /socket\.connect/,
        /reverse.*shell/i,
        /backdoor/i
      ];
      
      dangerousPatterns.forEach(pattern => {
        expect(indexContent).not.toMatch(pattern);
      });
    });

    test('should sanitize user input in routes', async () => {
      const routeManager = app.routeManager;
      
      // Test XSS prevention
      expect(routeManager.containsDangerousPatterns('<script>alert(1)</script>')).toBe(true);
      expect(routeManager.containsDangerousPatterns('onclick=')).toBe(true);
    });

    test('should prevent path traversal attacks', () => {
      const routeManager = app.routeManager;
      
      expect(routeManager.containsDangerousPatterns('../../../etc/passwd')).toBe(true);
      expect(routeManager.containsDangerousPatterns('..\\..\\windows\\system32')).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  let app;
  let server;

  beforeAll(() => {
    app = new App({ 
      port: 3999,
      isDev: false,
      autoInstall: false,
      plugins: { enabled: false },
      autoUpdater: { enabled: false }
    });
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (app) {
      await app.stop();
    }
  });

  test('should create and register multiple routes', async () => {
    await app.createRoute('get', '/api/users', (req, res) => res.json([]));
    await app.createRoute('post', '/api/users', (req, res) => res.json({ created: true }));
    await app.createRoute('get', '/api/users/:id', (req, res) => res.json({ id: req.params.id }));
    
    expect(app.routeManager.routeExists('get', '/api/users')).toBe(true);
    expect(app.routeManager.routeExists('post', '/api/users')).toBe(true);
    expect(app.routeManager.routeExists('get', '/api/users/:id')).toBe(true);
  });

  test('should update existing route', async () => {
    await app.createRoute('get', '/api/update-test', (req, res) => res.json({ version: 1 }));
    await app.updateRoute('get', '/api/update-test', (req, res) => res.json({ version: 2 }));
    
    expect(app.routeManager.routeExists('get', '/api/update-test')).toBe(true);
  });

  test('should handle middleware chain', () => {
    const middlewareExecuted = [];
    
    const middleware1 = (req, res, next) => {
      middlewareExecuted.push('middleware1');
      next();
    };
    
    const middleware2 = (req, res, next) => {
      middlewareExecuted.push('middleware2');
      next();
    };
    
    app.use(middleware1);
    app.use(middleware2);
    
    // Verify middlewares are registered
    expect(app.app._router.stack.length).toBeGreaterThan(0);
  });
});

describe('Performance Tests', () => {
  test('should create routes efficiently', async () => {
    const app = new App({ 
      isDev: false,
      autoInstall: false,
      plugins: { enabled: false },
      autoUpdater: { enabled: false }
    });

    const startTime = Date.now();
    const routeCount = 100;

    for (let i = 0; i < routeCount; i++) {
      await app.createRoute('get', `/perf/route${i}`, (req, res) => res.json({ i }));
    }

    const duration = Date.now() - startTime;
    
    // Should complete in reasonable time (less than 5 seconds for 100 routes)
    expect(duration).toBeLessThan(5000);
    
    await app.stop();
  });

  test('should handle rate limiting efficiently', () => {
    const app = new App({ 
      isDev: false,
      autoInstall: false,
      plugins: { enabled: false },
      autoUpdater: { enabled: false }
    });

    const routeManager = app.routeManager;
    const startTime = Date.now();
    const checkCount = 1000;

    for (let i = 0; i < checkCount; i++) {
      routeManager.checkRateLimit(`client-${i % 10}`);
    }

    const duration = Date.now() - startTime;
    
    // Should complete quickly (less than 100ms for 1000 checks)
    expect(duration).toBeLessThan(100);
  });
});
