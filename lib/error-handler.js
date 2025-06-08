const path = require('path');
const fs = require('fs');

class ErrorHandler {
  constructor(app) {
    this.app = app;
    this.isDev = app.get('env') === 'development';
  }

  // Analyser la stack trace pour extraire des informations utiles
  parseStackTrace(stack) {
    if (!stack) return [];
    
    const lines = stack.split('\n').slice(1); // Skip first line (error message)
    return lines.map(line => {
      const match = line.match(/at (.+?) \((.+?):(\d+):(\d+)\)/);
      if (match) {
        const [, functionName, filePath, lineNumber, columnNumber] = match;
        return {
          function: functionName.trim(),
          file: filePath,
          line: parseInt(lineNumber),
          column: parseInt(columnNumber),
          isNodeModule: filePath.includes('node_modules'),
          isVekoModule: filePath.includes('veko.js'),
          source: this.getSourceCode(filePath, parseInt(lineNumber))
        };
      }
      return { raw: line.trim() };
    }).filter(item => item.function || item.raw);
  }

  // Obtenir le code source autour de la ligne d'erreur
  getSourceCode(filePath, lineNumber, context = 5) {
    try {
      if (!fs.existsSync(filePath)) return null;
      
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const start = Math.max(0, lineNumber - context - 1);
      const end = Math.min(lines.length, lineNumber + context);
      
      return {
        lines: lines.slice(start, end).map((line, index) => ({
          number: start + index + 1,
          content: line,
          isError: start + index + 1 === lineNumber
        })),
        fileName: path.basename(filePath)
      };
    } catch (e) {
      return null;
    }
  }

  // Générer la page d'erreur style Next.js
  generateErrorPage(error, req, statusCode = 500) {
    const stackTrace = this.parseStackTrace(error.stack);
    const errorCode = statusCode;
    const errorMessage = error.message || 'An error occurred';
    const errorType = error.constructor.name;
    const timestamp = new Date().toISOString();
    const processInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage()
    };
    
    // Extraire la première erreur non-node_modules pour l'affichage principal
    const mainError = stackTrace.find(trace => !trace.isNodeModule) || stackTrace[0];
    
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${errorCode} · System Error</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
                        'mono': ['SF Mono', 'Monaco', 'Consolas', 'monospace']
                    },
                    animation: {
                        'fade-in': 'fadeIn 0.6s ease-out',
                        'slide-up': 'slideUp 0.8s ease-out',
                        'gradient': 'gradient 8s ease infinite',
                        'float': 'float 6s ease-in-out infinite'
                    },
                    keyframes: {
                        fadeIn: {
                            '0%': { opacity: '0', transform: 'translateY(20px)' },
                            '100%': { opacity: '1', transform: 'translateY(0)' }
                        },
                        slideUp: {
                            '0%': { opacity: '0', transform: 'translateY(40px)' },
                            '100%': { opacity: '1', transform: 'translateY(0)' }
                        },
                        gradient: {
                            '0%, 100%': { backgroundPosition: '0% 50%' },
                            '50%': { backgroundPosition: '100% 50%' }
                        },
                        float: {
                            '0%, 100%': { transform: 'translateY(0px)' },
                            '50%': { transform: 'translateY(-20px)' }
                        }
                    },
                    backgroundSize: {
                        '400%': '400% 400%'
                    }
                }
            }
        }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        body {
            background: #0a0a0a;
            background-image: 
                radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 40% 40%, rgba(120, 200, 255, 0.2) 0%, transparent 50%);
            min-height: 100vh;
        }
        
        .glass-card {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
        }
        
        .gradient-text {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .error-gradient {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .floating-orb {
            background: linear-gradient(135deg, rgba(120, 119, 198, 0.4) 0%, rgba(255, 119, 198, 0.4) 100%);
            filter: blur(40px);
            animation: float 6s ease-in-out infinite;
        }
        
        .code-block {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .metric-card {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .metric-card:hover {
            transform: translateY(-4px);
            background: rgba(255, 255, 255, 0.12);
        }
        
        .status-indicator {
            position: relative;
        }
        
        .status-indicator::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 100%;
            height: 100%;
            background: inherit;
            border-radius: inherit;
            transform: translate(-50%, -50%);
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
            opacity: 0.75;
        }
        
        @keyframes ping {
            75%, 100% {
                transform: translate(-50%, -50%) scale(2);
                opacity: 0;
            }
        }
        
        .button-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            transition: all 0.3s ease;
        }
        
        .button-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }
        
        .button-secondary {
            background: rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
        }
        
        .button-secondary:hover {
            background: rgba(255, 255, 255, 0.15);
            transform: translateY(-2px);
        }
    </style>
</head>
<body class="text-white font-sans">
    <!-- Floating Orbs -->
    <div class="fixed top-20 left-20 w-32 h-32 floating-orb rounded-full"></div>
    <div class="fixed bottom-20 right-20 w-40 h-40 floating-orb rounded-full" style="animation-delay: -3s;"></div>
    
    <!-- Header -->
    <header class="relative z-10 px-6 py-8">
        <div class="max-w-6xl mx-auto">
            <div class="flex items-center justify-between">
                <div class="animate-fade-in">
                    <h1 class="text-2xl font-semibold text-white flex items-center">
                        <span class="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg mr-3 flex items-center justify-center text-sm font-bold">V</span>
                        Veko.js
                    </h1>
                    <p class="text-gray-400 text-sm mt-1">Error Handler v2.0</p>
                </div>
                
                <div class="flex items-center space-x-6 text-sm text-gray-400">
                    <div class="flex items-center space-x-2">
                        <div class="w-2 h-2 bg-green-400 rounded-full status-indicator"></div>
                        <span>Node ${processInfo.nodeVersion}</span>
                    </div>
                    <span>${this.formatUptime(processInfo.uptime)}</span>
                    <span>${timestamp.split('T')[1].split('.')[0]}</span>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto px-6 pb-16">
        <!-- Error Hero Section -->
        <section class="mb-16 animate-slide-up">
            <div class="glass-card rounded-3xl p-12 text-center">
                <div class="mb-8">
                    <div class="text-8xl font-bold error-gradient mb-4">${errorCode}</div>
                    <h2 class="text-3xl font-semibold text-white mb-2">${errorType}</h2>
                    <div class="text-gray-400 font-mono text-sm px-4 py-2 glass-card rounded-full inline-block">
                        ${req.method} ${this.escapeHtml(req.url)}
                    </div>
                </div>
                
                <div class="code-block rounded-2xl p-8 max-w-4xl mx-auto">
                    <div class="flex items-start space-x-4">
                        <div class="w-3 h-3 bg-red-400 rounded-full mt-1 flex-shrink-0"></div>
                        <p class="text-red-300 font-mono text-lg leading-relaxed text-left">
                            ${this.escapeHtml(errorMessage)}
                        </p>
                    </div>
                </div>
            </div>
        </section>

        ${this.isDev ? this.generateDevErrorContentModern(stackTrace, mainError, req, processInfo) : ''}

        <!-- System Metrics -->
        <section class="mb-16">
            <h3 class="text-2xl font-semibold text-white mb-8">System Overview</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="glass-card rounded-2xl p-6 metric-card">
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-gray-400 text-sm font-medium">Memory Usage</div>
                        <div class="w-3 h-3 bg-blue-400 rounded-full"></div>
                    </div>
                    <div class="text-2xl font-bold text-white mb-1">${this.formatBytes(processInfo.memory.heapUsed)}</div>
                    <div class="text-gray-500 text-sm">of ${this.formatBytes(processInfo.memory.heapTotal)}</div>
                </div>
                
                <div class="glass-card rounded-2xl p-6 metric-card">
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-gray-400 text-sm font-medium">Platform</div>
                        <div class="w-3 h-3 bg-purple-400 rounded-full"></div>
                    </div>
                    <div class="text-2xl font-bold text-white mb-1">${processInfo.platform.charAt(0).toUpperCase() + processInfo.platform.slice(1)}</div>
                    <div class="text-gray-500 text-sm">${processInfo.arch}</div>
                </div>
                
                <div class="glass-card rounded-2xl p-6 metric-card">
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-gray-400 text-sm font-medium">Uptime</div>
                        <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                    <div class="text-2xl font-bold text-white mb-1">${this.formatUptime(processInfo.uptime)}</div>
                    <div class="text-gray-500 text-sm">hours:min:sec</div>
                </div>
                
                <div class="glass-card rounded-2xl p-6 metric-card">
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-gray-400 text-sm font-medium">Error Type</div>
                        <div class="w-3 h-3 bg-red-400 rounded-full"></div>
                    </div>
                    <div class="text-2xl font-bold error-gradient mb-1">${errorType}</div>
                    <div class="text-gray-500 text-sm">exception</div>
                </div>
            </div>
        </section>

        <!-- Actions -->
        <section class="text-center">
            <div class="glass-card rounded-3xl p-8">
                <h3 class="text-xl font-semibold text-white mb-8">Recovery Options</h3>
                <div class="flex flex-wrap justify-center gap-4">
                    <button onclick="window.location.href='/'" 
                            class="button-primary px-8 py-3 rounded-full text-white font-medium">
                        Go to Homepage
                    </button>
                    
                    <button onclick="history.back()" 
                            class="button-secondary px-8 py-3 rounded-full text-white font-medium">
                        Go Back
                    </button>
                    
                    <button onclick="location.reload()" 
                            class="button-secondary px-8 py-3 rounded-full text-white font-medium">
                        Retry Request
                    </button>
                </div>
            </div>
        </section>
    </main>
</body>
</html>`;
  }

  generateDevErrorContentModern(stackTrace, mainError, req, processInfo) {
    return `
    <!-- Stack Trace Section -->
    <section class="mb-16">
        <h3 class="text-2xl font-semibold text-white mb-8">Execution Trace</h3>
        <div class="glass-card rounded-3xl overflow-hidden">
            <div class="p-6 border-b border-white/10">
                <div class="flex items-center justify-between">
                    <div class="text-white font-medium">Stack Analysis</div>
                    <div class="text-gray-400 text-sm">
                        ${stackTrace.length} frames • ${stackTrace.filter(t => !t.isNodeModule).length} user code
                    </div>
                </div>
            </div>
            
            <div class="divide-y divide-white/5">
                ${stackTrace.slice(0, 8).map((trace, index) => {
                    if (!trace.function) return '';
                    
                    const isMainError = index === 0;
                    const isUserCode = !trace.isNodeModule && !trace.isVekoModule;
                    
                    return `
                    <div class="p-6 hover:bg-white/5 transition-all duration-300">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center space-x-3">
                                <div class="w-2 h-2 ${isMainError ? 'bg-red-400' : isUserCode ? 'bg-blue-400' : 'bg-gray-500'} rounded-full"></div>
                                <div>
                                    <div class="text-white font-mono text-sm font-medium">${this.escapeHtml(trace.function)}</div>
                                    <div class="text-gray-400 text-xs mt-1">${this.escapeHtml(path.basename(trace.file))}:${trace.line}</div>
                                </div>
                            </div>
                            
                            <div class="flex items-center space-x-2">
                                <span class="px-3 py-1 text-xs rounded-full font-medium ${
                                    isUserCode ? 'bg-blue-500/20 text-blue-300' :
                                    trace.isVekoModule ? 'bg-purple-500/20 text-purple-300' :
                                    'bg-gray-500/20 text-gray-300'
                                }">
                                    ${isUserCode ? 'USER' : trace.isVekoModule ? 'VEKO' : 'NODE'}
                                </span>
                                ${isMainError ? '<span class="px-3 py-1 text-xs rounded-full font-medium bg-red-500/20 text-red-300">ORIGIN</span>' : ''}
                            </div>
                        </div>
                        
                        ${trace.source ? this.generateSourceCodeBlockModern(trace.source) : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>
    </section>

    <!-- Request Details -->
    <section class="mb-16">
        <h3 class="text-2xl font-semibold text-white mb-8">Request Information</h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- HTTP Details -->
            <div class="glass-card rounded-2xl p-8">
                <h4 class="text-lg font-semibold text-white mb-6">HTTP Request</h4>
                <div class="space-y-4">
                    <div class="flex justify-between items-center py-3 border-b border-white/10">
                        <span class="text-gray-400 font-medium">Method</span>
                        <span class="font-mono text-white px-3 py-1 bg-white/10 rounded-lg">${req.method}</span>
                    </div>
                    <div class="flex justify-between items-center py-3 border-b border-white/10">
                        <span class="text-gray-400 font-medium">Path</span>
                        <span class="font-mono text-white text-sm truncate max-w-xs">${this.escapeHtml(req.url)}</span>
                    </div>
                    <div class="flex justify-between items-center py-3 border-b border-white/10">
                        <span class="text-gray-400 font-medium">Protocol</span>
                        <span class="font-mono text-white">${req.protocol?.toUpperCase() || 'HTTP'}</span>
                    </div>
                    <div class="flex justify-between items-center py-3">
                        <span class="text-gray-400 font-medium">Host</span>
                        <span class="font-mono text-white">${req.get('host') || 'localhost'}</span>
                    </div>
                </div>
            </div>
            
            <!-- Environment Details -->
            <div class="glass-card rounded-2xl p-8">
                <h4 class="text-lg font-semibold text-white mb-6">Environment</h4>
                <div class="space-y-4">
                    <div class="flex justify-between items-center py-3 border-b border-white/10">
                        <span class="text-gray-400 font-medium">Node Version</span>
                        <span class="font-mono text-green-400 font-semibold">${processInfo.nodeVersion}</span>
                    </div>
                    <div class="flex justify-between items-center py-3 border-b border-white/10">
                        <span class="text-gray-400 font-medium">Platform</span>
                        <span class="font-mono text-white">${processInfo.platform} (${processInfo.arch})</span>
                    </div>
                    <div class="flex justify-between items-center py-3 border-b border-white/10">
                        <span class="text-gray-400 font-medium">Process ID</span>
                        <span class="font-mono text-white">${process.pid}</span>
                    </div>
                    <div class="flex justify-between items-center py-3">
                        <span class="text-gray-400 font-medium">Memory Usage</span>
                        <span class="font-mono text-blue-400 font-semibold">${this.formatBytes(processInfo.memory.heapUsed)}</span>
                    </div>
                </div>
            </div>
        </div>
    </section>
  `;
}

generateSourceCodeBlockModern(source) {
  if (!source || !source.lines) return '';
  
  return `
    <div class="mt-4 code-block rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <span class="text-gray-300 text-sm font-medium">📄 ${source.fileName}</span>
            <span class="text-gray-500 text-xs">${source.lines.length} lines</span>
        </div>
        <div class="p-4 overflow-x-auto">
            <div class="font-mono text-sm space-y-1">
                ${source.lines.map(line => `
                    <div class="flex hover:bg-white/5 rounded-lg transition-colors ${line.isError ? 'bg-red-500/10 border-l-2 border-red-400 pl-3' : 'pl-5'}">
                        <span class="text-gray-500 text-right w-12 mr-4 select-none text-xs leading-relaxed">${line.number}</span>
                        <span class="text-gray-300 ${line.isError ? 'text-red-300 font-medium' : ''} flex-1 leading-relaxed">${this.escapeHtml(line.content)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
  `;
}
// ...existing code...
formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)}${units[unitIndex]}`;
}

formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  }
}

module.exports = ErrorHandler;