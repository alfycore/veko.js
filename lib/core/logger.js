/**
 * Logger minimaliste style Next.js
 */

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

class Logger {
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.verbose = options.verbose || process.env.VEKO_VERBOSE === 'true';
  }

  log(type, message, details = '') {
    if (this.silent) return;
    
    switch (type) {
      case 'ready':
      case 'server':
        console.log(`${colors.green}${colors.bold} ✓ ${colors.reset}${message}${details ? ` ${colors.gray}${details}${colors.reset}` : ''}`);
        break;
        
      case 'event':
        console.log(`${colors.gray} ○ ${colors.reset}${message}${details ? ` ${colors.gray}${details}${colors.reset}` : ''}`);
        break;
        
      case 'wait':
        console.log(`${colors.cyan} ◐ ${colors.reset}${message}${details ? ` ${colors.gray}${details}${colors.reset}` : ''}`);
        break;
        
      case 'error':
        console.log(`${colors.red}${colors.bold} ✗ ${colors.reset}${colors.red}${message}${colors.reset}${details ? `\n   ${colors.gray}${details}${colors.reset}` : ''}`);
        break;
        
      case 'warn':
      case 'warning':
        console.log(`${colors.yellow} ⚠ ${colors.reset}${message}${details ? ` ${colors.gray}${details}${colors.reset}` : ''}`);
        break;
        
      case 'success':
        console.log(`${colors.green} ✓ ${colors.reset}${message}${details ? ` ${colors.gray}${details}${colors.reset}` : ''}`);
        break;
        
      case 'info':
      case 'route':
      case 'create':
      case 'dev':
      case 'reload':
      case 'file':
      case 'install':
      case 'debug':
        // Only show in verbose mode
        if (this.verbose) {
          console.log(`${colors.gray} ○ ${colors.reset}${message}${details ? ` ${colors.dim}${details}${colors.reset}` : ''}`);
        }
        break;

      default:
        if (this.verbose) {
          console.log(`${colors.gray}   ${colors.reset}${message}${details ? ` ${colors.dim}${details}${colors.reset}` : ''}`);
        }
    }
  }

  // Shorthand methods
  ready(msg, details) { this.log('ready', msg, details); }
  event(msg, details) { this.log('event', msg, details); }
  wait(msg, details) { this.log('wait', msg, details); }
  error(msg, details) { this.log('error', msg, details); }
  warn(msg, details) { this.log('warn', msg, details); }
  info(msg, details) { this.log('info', msg, details); }
  success(msg, details) { this.log('success', msg, details); }
}

module.exports = Logger;