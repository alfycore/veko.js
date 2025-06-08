const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class EJSBuilder {
  constructor(options = {}) {
    this.options = {
      viewsDir: options.viewsDir || 'views',
      cache: options.cache !== false,
      debug: options.debug || false,
      strict: options.strict !== false,
      compileDebug: options.compileDebug || false,
      ...options
    };
    
    this.cache = new Map();
    this.compiled = new Map();
    this.dependencies = new Map();
  }

  /**
   * Compile un template EJS
   */
  async compile(template, filePath = null) {
    try {
      const templateHash = this.generateHash(template);
      
      if (this.cache.has(templateHash) && this.options.cache) {
        return this.cache.get(templateHash);
      }

      const compiled = this.parseTemplate(template, filePath);
      
      if (this.options.cache) {
        this.cache.set(templateHash, compiled);
      }

      return compiled;
    } catch (error) {
      throw new Error(`EJS compilation failed: ${error.message}`);
    }
  }

  /**
   * Parser principal pour les templates EJS
   */
  parseTemplate(template, filePath = null) {
    let output = '';
    let index = 0;
    const length = template.length;
    
    // État du parser
    const state = {
      inTag: false,
      tagType: null,
      buffer: '',
      lineNumber: 1,
      dependencies: new Set()
    };

    while (index < length) {
      const char = template[index];
      const nextChar = template[index + 1];

      if (char === '\n') {
        state.lineNumber++;
      }

      // Détection des tags EJS
      if (char === '<' && nextChar === '%') {
        if (!state.inTag) {
          // Sortie du contenu HTML précédent
          if (state.buffer) {
            output += this.escapeHtml(state.buffer);
            state.buffer = '';
          }
          
          state.inTag = true;
          state.tagType = this.detectTagType(template, index + 2);
          index += 2;
          
          // Skip whitespace après <%
          if (template[index] === ' ' || template[index] === '\t') {
            index++;
          }
          continue;
        }
      }

      // Fermeture des tags EJS
      if (char === '%' && nextChar === '>' && state.inTag) {
        const tagContent = state.buffer.trim();
        
        output += this.processTag(tagContent, state.tagType, state);
        
        state.inTag = false;
        state.tagType = null;
        state.buffer = '';
        index += 2;
        continue;
      }

      if (state.inTag) {
        state.buffer += char;
      } else {
        state.buffer += char;
      }

      index++;
    }

    // Contenu HTML final
    if (state.buffer && !state.inTag) {
      output += this.escapeHtml(state.buffer);
    }

    if (filePath) {
      this.dependencies.set(filePath, Array.from(state.dependencies));
    }

    return this.wrapTemplate(output);
  }

  /**
   * Détecte le type de tag EJS
   */
  detectTagType(template, startIndex) {
    const char = template[startIndex];
    
    switch (char) {
      case '=': return 'output'; // <%= %>
      case '-': return 'raw';    // <%- %>
      case '#': return 'comment'; // <%# %>
      case '%': return 'literal'; // <%% %>
      default: return 'code';     // <% %>
    }
  }

  /**
   * Traite un tag EJS selon son type
   */
  processTag(content, tagType, state) {
    switch (tagType) {
      case 'output':
        return this.processOutputTag(content.substring(1));
      
      case 'raw':
        return this.processRawTag(content.substring(1));
      
      case 'comment':
        return ''; // Les commentaires sont ignorés
      
      case 'literal':
        return '<%' + content.substring(1) + '%>';
      
      case 'code':
        return this.processCodeTag(content, state);
      
      default:
        return '';
    }
  }

  /**
   * Traite les tags de sortie <%= %>
   */
  processOutputTag(content) {
    const sanitized = this.sanitizeExpression(content);
    return `\${this.escapeHtml(${sanitized})}`;
  }

  /**
   * Traite les tags de sortie brute <%- %>
   */
  processRawTag(content) {
    const sanitized = this.sanitizeExpression(content);
    return `\${${sanitized}}`;
  }

  /**
   * Traite les tags de code <% %>
   */
  processCodeTag(content, state) {
    // Détection des includes
    if (content.trim().startsWith('include')) {
      return this.processInclude(content, state);
    }

    // Détection des structures de contrôle
    if (this.isControlStructure(content)) {
      return this.processControlStructure(content);
    }

    return `\n${content}\n`;
  }

  /**
   * Traite les includes
   */
  processInclude(content, state) {
    const includeMatch = content.match(/include\s+['"`]([^'"`]+)['"`]/);
    if (includeMatch) {
      const includePath = includeMatch[1];
      state.dependencies.add(includePath);
      return `\${await this.renderPartial('${includePath}', locals)}`;
    }
    return '';
  }

  /**
   * Vérifie si c'est une structure de contrôle
   */
  isControlStructure(content) {
    const controlKeywords = ['if', 'else', 'for', 'while', 'switch', 'try', 'catch'];
    const trimmed = content.trim();
    return controlKeywords.some(keyword => 
      trimmed.startsWith(keyword + ' ') || 
      trimmed.startsWith(keyword + '(') ||
      trimmed === keyword
    );
  }

  /**
   * Traite les structures de contrôle
   */
  processControlStructure(content) {
    // Gestion basique des structures de contrôle
    const trimmed = content.trim();
    
    if (trimmed.startsWith('if')) {
      return `\nif (${this.extractCondition(trimmed)}) {\n`;
    }
    
    if (trimmed === 'else') {
      return '\n} else {\n';
    }
    
    if (trimmed.startsWith('else if')) {
      return `\n} else if (${this.extractCondition(trimmed)}) {\n`;
    }
    
    if (trimmed.startsWith('for')) {
      return `\n${trimmed} {\n`;
    }
    
    if (trimmed === '}') {
      return '\n}\n';
    }

    return `\n${content}\n`;
  }

  /**
   * Extrait la condition d'un if/else if
   */
  extractCondition(statement) {
    const match = statement.match(/(?:if|else if)\s*\((.+)\)/);
    return match ? match[1] : statement.replace(/^(?:if|else if)\s*/, '');
  }

  /**
   * Sanitise une expression JavaScript
   */
  sanitizeExpression(expression) {
    // Nettoyage de base pour éviter les injections
    return expression
      .trim()
      .replace(/[<>]/g, '') // Supprime les chevrons
      .replace(/javascript:/gi, '') // Supprime javascript:
      .replace(/on\w+\s*=/gi, ''); // Supprime les handlers d'événements
  }

  /**
   * Échappe le HTML
   */
  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Enveloppe le template dans une fonction
   */
  wrapTemplate(content) {
    return `
      (async function(locals = {}) {
        const { ${Object.keys(this.getDefaultLocals()).join(', ')} } = locals;
        let __output = '';
        
        try {
          __output = \`${content}\`;
        } catch (error) {
          throw new Error('Template execution error: ' + error.message);
        }
        
        return __output;
      })
    `;
  }

  /**
   * Variables locales par défaut
   */
  getDefaultLocals() {
    return {
      filename: null,
      cache: this.options.cache,
      debug: this.options.debug
    };
  }

  /**
   * Génère un hash pour le cache
   */
  generateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Rendu d'un partial
   */
  async renderPartial(partialPath, locals = {}) {
    const fullPath = path.join(this.options.viewsDir, partialPath + '.ejs');
    
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      const compiled = await this.compile(content, fullPath);
      const templateFn = eval(compiled);
      return await templateFn(locals);
    } catch (error) {
      if (this.options.debug) {
        return `<!-- Partial not found: ${partialPath} -->`;
      }
      return '';
    }
  }

  /**
   * Nettoie le cache
   */
  clearCache() {
    this.cache.clear();
    this.compiled.clear();
    this.dependencies.clear();
  }

  /**
   * Obtient les statistiques du cache
   */
  getCacheStats() {
    return {
      templates: this.cache.size,
      compiled: this.compiled.size,
      dependencies: this.dependencies.size
    };
  }
}

module.exports = EJSBuilder;