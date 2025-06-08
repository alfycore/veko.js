const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m'
};

class Logger {
  log(type, message, details = '') {
    const timestamp = new Date().toLocaleTimeString('en-US');
    const prefix = `${colors.gray}[${timestamp}]${colors.reset}`;
    
    const logStyles = {
      success: {
        badge: `${colors.bgGreen}${colors.white} ✨ `,
        text: `${colors.green}${colors.bright}`,
        icon: '🎉'
      },
      error: {
        badge: `${colors.bgRed}${colors.white} 💥 `,
        text: `${colors.red}${colors.bright}`,
        icon: '❌'
      },
      warning: {
        badge: `${colors.bgYellow}${colors.white} ⚡ `,
        text: `${colors.yellow}${colors.bright}`,
        icon: '⚠️'
      },
      info: {
        badge: `${colors.bgBlue}${colors.white} 💎 `,
        text: `${colors.blue}${colors.bright}`,
        icon: 'ℹ️'
      },
      server: {
        badge: `${colors.bgMagenta}${colors.white} 🚀 `,
        text: `${colors.magenta}${colors.bright}`,
        icon: '🌟'
      },
      route: {
        badge: `${colors.bgCyan}${colors.white} 🌐 `,
        text: `${colors.cyan}${colors.bright}`,
        icon: '🔗'
      },
      dev: {
        badge: `${colors.bgBlue}${colors.white} 🛠️ `,
        text: `${colors.blue}${colors.bright}`,
        icon: '⚙️'
      },
      file: {
        badge: `${colors.bgGreen}${colors.white} 📁 `,
        text: `${colors.green}${colors.bright}`,
        icon: '📂'
      },
      reload: {
        badge: `${colors.bgYellow}${colors.white} 🔄 `,
        text: `${colors.yellow}${colors.bright}`,
        icon: '🔄'
      },
      create: {
        badge: `${colors.bgGreen}${colors.white} ➕ `,
        text: `${colors.green}${colors.bright}`,
        icon: '✅'
      },
      delete: {
        badge: `${colors.bgRed}${colors.white} 🗑️ `,
        text: `${colors.red}${colors.bright}`,
        icon: '🗑️'
      },
      install: {
        badge: `${colors.bgMagenta}${colors.white} 📦 `,
        text: `${colors.magenta}${colors.bright}`,
        icon: '📦'
      }
    };

    const style = logStyles[type] || logStyles.info;
    
    console.log(
      `${prefix} ${style.badge}${colors.reset} ${style.text}${message}${colors.reset} ${colors.dim}${details}${colors.reset}`
    );
  }
}

module.exports = Logger;