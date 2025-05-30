const path = require('path');
const WebSocket = require('ws');
const fs = require('fs');
const stackTraceParser = require('stacktrace-parser');
const ejs = require('ejs');

// Utility functions for HTML handling
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Highlight HTML code with syntax coloring
function highlightHtml(code, errorPosition = null) {
  // Simple syntax highlighter for HTML/EJS
  let highlighted = '';
  let inTag = false;
  let inAttr = false;
  let inString = false;
  let inEjs = false;
  let stringChar = '';
  let currentPosition = 0;
  
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const isErrorPosition = errorPosition !== null && i === errorPosition;
    const errorHighlight = isErrorPosition ? '<span class="error-highlight">' : '';
    const errorHighlightEnd = isErrorPosition ? '</span>' : '';
    
    // Check for EJS tags
    if (char === '<' && code[i+1] === '%') {
      highlighted += `${errorHighlight}<span class="syntax-ejs">&lt;%${errorHighlightEnd}`;
      inEjs = true;
      i++; // Skip the next character which is %
      currentPosition += 2;
      continue;
    }
    
    if (inEjs && char === '%' && code[i+1] === '>') {
      highlighted += `${errorHighlight}%&gt;</span>${errorHighlightEnd}`;
      inEjs = false;
      i++; // Skip the next character which is >
      currentPosition += 2;
      continue;
    }
    
    if (inEjs) {
      highlighted += `${errorHighlight}${escapeHtml(char)}${errorHighlightEnd}`;
      currentPosition++;
      continue;
    }
    
    // Handle HTML syntax
    if (char === '<' && !inString) {
      highlighted += `${errorHighlight}<span class="syntax-tag">&lt;${errorHighlightEnd}`;
      inTag = true;
      currentPosition++;
      continue;
    }
    
    if (inTag && (char === ' ' || char === '\t') && !inString) {
      highlighted += `${errorHighlight}${char}${errorHighlightEnd}`;
      inAttr = true;
      currentPosition++;
      continue;
    }
    
    if (inTag && (char === '"' || char === "'") && !inString) {
      stringChar = char;
      inString = true;
      highlighted += `${errorHighlight}<span class="syntax-string">${escapeHtml(char)}${errorHighlightEnd}`;
      currentPosition++;
      continue;
    }
    
    if (inString && char === stringChar) {
      inString = false;
      highlighted += `${errorHighlight}${escapeHtml(char)}</span>${errorHighlightEnd}`;
      currentPosition++;
      continue;
    }
    
    if (inTag && char === '>' && !inString) {
      highlighted += `${errorHighlight}&gt;</span>${errorHighlightEnd}`;
      inTag = false;
      inAttr = false;
      currentPosition++;
      continue;
    }
    
    // Handle comments
    if (char === '<' && code.slice(i, i+4) === '<!--') {
      const commentEnd = code.indexOf('-->', i + 4);
      if (commentEnd !== -1) {
        const comment = code.slice(i, commentEnd + 3);
        highlighted += `<span class="syntax-comment">${escapeHtml(comment)}</span>`;
        i = commentEnd + 2;
        currentPosition += comment.length;
        continue;
      }
    }
    
    // Handle attributes
    if (inAttr && code[i-1] === '=') {
      highlighted += `${errorHighlight}<span class="syntax-attr">${escapeHtml(char)}${errorHighlightEnd}`;
      continue;
    }
    
    if (inString) {
      highlighted += `${errorHighlight}${escapeHtml(char)}${errorHighlightEnd}`;
    } else if (inTag) {
      highlighted += `${errorHighlight}${escapeHtml(char)}${errorHighlightEnd}`;
    } else {
      highlighted += `${errorHighlight}${escapeHtml(char)}${errorHighlightEnd}`;
    }
    currentPosition++;
  }
  
  return highlighted;
}

class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      showStack: process.env.NODE_ENV !== 'production',
      enableReload: true,
      wsPort: options.wsPort || 3001,
      errorViewPath: path.join(process.cwd(), 'views', 'error.ejs'),
      language: options.language || 'en', // 'en' or 'fr'
      customErrorViewPath: null,
      logErrors: true,
      errorLog: path.join(process.cwd(), 'logs', 'error.log'),
      diagnostics: true,
      showCodeContext: true,
      ...options
    };
    
    this.wss = null;
    
    // Error types with translations
    this.errorTypes = {
      404: { 
        icon: '🔍', 
        color: 'blue',
        name: {
          en: 'Page not found',
          fr: 'Page non trouvée'
        }
      },
      500: { 
        icon: '💥', 
        color: 'red',
        name: {
          en: 'Internal error',
          fr: 'Erreur interne'
        }
      },
      401: { 
        icon: '🔒', 
        color: 'amber',
        name: {
          en: 'Unauthorized',
          fr: 'Non autorisé'
        }
      },
      403: { 
        icon: '⛔', 
        color: 'orange',
        name: {
          en: 'Forbidden',
          fr: 'Accès interdit'
        }
      },
      400: { 
        icon: '⚠️', 
        color: 'yellow',
        name: {
          en: 'Bad request',
          fr: 'Requête invalide'
        }
      },
      422: { 
        icon: '📝', 
        color: 'rose',
        name: {
          en: 'Validation failed',
          fr: 'Validation échouée'
        }
      },
      default: { 
        icon: '❌', 
        color: 'red',
        name: {
          en: 'Error',
          fr: 'Erreur'
        }
      }
    };
    
    // Create log directory if needed
    if (this.options.logErrors) {
      const logDir = path.dirname(this.options.errorLog);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  // Create a detailed error log
  logError(err, req) {
    if (!this.options.logErrors) return;
    
    const timestamp = new Date().toISOString();
    const method = req ? req.method : 'SYSTEM';
    const url = req ? req.originalUrl : '';
    const status = err.status || err.statusCode || 500;
    const userAgent = req ? req.headers['user-agent'] : '';
    const ip = req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress) : '';
    
    const logEntry = `[${timestamp}] ${status} ${method} ${url}
User-Agent: ${userAgent}
IP: ${ip}
Message: ${err.message}
${err.stack ? `\nStack:\n${err.stack}` : ''}
-------------------------------\n\n`;
    
    fs.appendFile(this.options.errorLog, logEntry, (fsErr) => {
      if (fsErr) console.error('Impossible d\'écrire dans le journal d\'erreurs:', fsErr);
    });
    
    // Log console coloré
    if (method === 'SYSTEM') {
      console.error(
        chalk.red.bold(`[ERROR] ${timestamp}`),
        chalk.yellow(err.message)
      );
    } else {
      console.error(
        chalk.red.bold(`[${status}]`),
        chalk.yellow(`${method} ${url}`),
        chalk.gray(`- ${timestamp}`),
        '\n',
        chalk.red(err.message)
      );
    }
    
    if (this.options.showStack && err.stack) {
      console.error(chalk.gray(err.stack));
    }
  }

  // Extract code context from error stack
  extractCodeContext(errorStack) {
    if (!this.options.showCodeContext || !errorStack) return null;
    
    try {
      const frames = stackTraceParser.parse(errorStack);
      if (!frames.length) return null;
      
      // Take the first frame (where the error occurred)
      const frame = frames.find(f => 
        f.file && 
        !f.file.includes('node_modules') && 
        fs.existsSync(f.file)
      );
      
      if (!frame) return null;
      
      // Read the file and get contextual lines
      const fileContent = fs.readFileSync(frame.file, 'utf8');
      const lines = fileContent.split('\n');
      const lineNumber = frame.lineNumber || 0;
      const columnNumber = frame.column || 0;
      
      // Get lines around error (3 lines before and after)
      const startLine = Math.max(0, lineNumber - 3);
      const endLine = Math.min(lines.length, lineNumber + 3);
      const codeLines = [];
      
      for (let i = startLine; i < endLine; i++) {
        const lineContent = lines[i] || '';
        const isErrorLine = i + 1 === lineNumber;
        
        codeLines.push({
          number: i + 1,
          content: lineContent,
          isError: isErrorLine,
          // Mark the exact location of the error
          highlightColumn: isErrorLine ? columnNumber : null
        });
      }
      
      return {
        file: frame.file,
        line: lineNumber,
        column: columnNumber,
        codeLines: codeLines,
        functionName: frame.methodName || 'anonymous'
      };
    } catch (e) {
      console.error('Unable to extract code context:', e);
      return null;
    }
  }

  // Prepare diagnostic data for the error
  prepareDiagnostics(err, req) {
    if (!this.options.diagnostics) return null;
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      platform: {
        node: process.version,
        os: `${process.platform} ${process.arch}`,
        memory: process.memoryUsage(),
      },
      request: req ? {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        query: req.query,
        cookies: req.cookies
      } : null,
      error: {
        name: err.name,
        message: err.message,
        status: err.status || err.statusCode || 500,
        code: err.code
      }
    };
    
    // Add stack trace parsing
    if (err.stack) {
      diagnostics.error.stackFrames = stackTraceParser.parse(err.stack);
    }
    
    // Add code context if available
    diagnostics.codeContext = this.extractCodeContext(err.stack);
    
    return diagnostics;
  }

  // Middleware for handling errors 404
  handle404() {
    return (req, res, next) => {
      const error = new Error(`Page non trouvée: ${req.originalUrl}`);
      error.status = 404;
      next(error);
    };
  }

  // Middleware for handling errors
  handleErrors() {
    return (err, req, res, next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal server error';
      
      // Determine user's language preference
      const lang = req.query.lang || req.cookies?.lang || this.options.language || 'en';
      
      // Determine error type to customize display
      const errorType = this.errorTypes[status] || this.errorTypes.default;
      
      res.status(status);
      this.renderErrorPage(err, req, res);

      // Also send error to client via WebSocket if available
      if (status === 500 && this.wss) {
        this.broadcast({
          type: 'error',
          status,
          message,
          stack: this.options.showStack ? err.stack : null
        });
      }
    };
  }

  // Render the error page using EJS
  renderErrorPage(err, req, res) {
    // Instead of trying to render 'error' which relies on view lookup paths
    // We'll use the absolute path to the error template
    const errorTemplatePath = path.join(__dirname, '..', 'error', 'error.ejs');
    
    try {
      const errorTypeName = {
        en: this.getErrorTypeName(err.status || 500),
        fr: this.getErrorTypeNameFr(err.status || 500)
      };
      
      const errorType = this.getErrorTypeInfo(err.status || 500);
      
      const renderedHtml = ejs.renderFile(errorTemplatePath, {
        message: err.message || 'An unexpected error occurred',
        error: err,
        status: err.status || 500,
        stack: err.stack,
        showStack: this.options.showStack,
        env: process.env.NODE_ENV || 'development',
        diagnostics: this.generateErrorDiagnostics(err, req),
        errorTypeName,
        errorType,
        lang: req.query.lang || req.cookies?.lang || 'en',
        escapeHtml: (str) => this.escapeHtml(str),
        highlightHtml: (str, errorPos) => this.highlightHtml(str, errorPos)
      }, {}, (renderErr, html) => {
        if (renderErr) {
          console.error('Error rendering error page:', renderErr);
          res.status(500).send('Internal Server Error: ' + err.message);
        } else {
          res.status(err.status || 500).send(html);
        }
      });
    } catch (renderErr) {
      console.error('Failed to render error page:', renderErr);
      res.status(500).send('Internal Server Error: ' + err.message);
    }
  }

  // Middleware to avoid undefined EJS variables
  handleEjsVariables() {
    return (req, res, next) => {
      const originalRender = res.render;
      
      res.render = function(view, locals = {}, callback) {
        // Default variables to prevent "not defined" errors
        const defaultVars = {
          stitle: 'Veko.js',
          title: 'Veko.js Framework',
          message: '',
          content: '',
          sessionUser: null,
          lang: req.query.lang || req.cookies?.lang || 'en',
        };
        
        const safeLocals = {
          ...defaultVars,
          ...locals,
          // Helper function for EJS to detect undefined variables
          $get: function(key, defaultValue = '') {
            return key in locals ? locals[key] : defaultValue;
          }
        };
        
        if (typeof locals === 'function') {
          callback = locals;
        }
        
        originalRender.call(this, view, safeLocals, callback);
      };
      
      next();
    };
  }

  // Configure WebSocket to communicate errors to the client
  setupWebSocket(port) {
    if (this.wss) {
      return this;
    }
    
    this.options.wsPort = port || this.options.wsPort;
    this.wss = new WebSocket.Server({ port: this.options.wsPort });
    
    this.wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ 
        type: 'connected', 
        message: 'Connecté au serveur de développement Veko.js' 
      }));
    });
    
    // Capture des erreurs non gérées
    process.on('uncaughtException', (error) => {
      this.logError(error);
      this.broadcast({ 
        type: 'error', 
        message: error.message,
        stack: this.options.showStack ? error.stack : null
      });
    });
    
    // Capture des promesses rejetées non gérées
    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.logError(error);
      this.broadcast({ 
        type: 'error', 
        message: error.message,
        stack: this.options.showStack ? error.stack : null
      });
    });
    
    return this;
  }

  // Broadcast a message to all connected clients
  broadcast(data) {
    if (!this.wss) return;
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // Get the error type name in English
  getErrorTypeName(statusCode) {
    const errorType = this.errorTypes[statusCode] || this.errorTypes.default;
    return errorType?.name?.en || 'Error';
  }
  
  // Get the error type name in French
  getErrorTypeNameFr(statusCode) {
    const errorType = this.errorTypes[statusCode] || this.errorTypes.default;
    return errorType?.name?.fr || 'Erreur';
  }
  
  // Get the full error type info
  getErrorTypeInfo(statusCode) {
    return this.errorTypes[statusCode] || this.errorTypes.default;
  }
  
  // Generate error diagnostics for display
  generateErrorDiagnostics(err, req) {
    return this.prepareDiagnostics(err, req);
  }
  
  // Escape HTML - make sure this is accessible
  escapeHtml(text) {
    return escapeHtml(text);
  }
  
  // Highlight HTML - make sure this is accessible
  highlightHtml(code, errorPosition) {
    return highlightHtml(code, errorPosition);
  }

  // Integrate with Express
  applyToApp(app) {
    // Middleware to avoid undefined variables
    app.use(this.handleEjsVariables());
    
    // These middlewares should be added after all routes
    app.use(this.handle404());
    app.use(this.handleErrors());
    
    return this;
  }
}

module.exports = ErrorHandler;