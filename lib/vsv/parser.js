/**
 * VSV Parser
 * Parses .jsv and .tsv files into AST
 * Zero dependencies - custom lexer and parser
 */

class VSVParser {
  constructor(vsv) {
    this.vsv = vsv;
  }

  /**
   * Parse VSV source code
   */
  parse(source, options = {}) {
    const tokens = this.tokenize(source);
    const ast = this.buildAST(tokens, options);
    return ast;
  }

  /**
   * Tokenize source code
   */
  tokenize(source) {
    const tokens = [];
    let i = 0;
    let line = 1;
    let col = 1;
    
    while (i < source.length) {
      const char = source[i];
      
      // Track position
      if (char === '\n') {
        line++;
        col = 1;
      }
      
      // Skip whitespace (but track newlines)
      if (/\s/.test(char)) {
        if (char !== '\n') col++;
        i++;
        continue;
      }
      
      // Comments
      if (char === '/' && source[i + 1] === '/') {
        // Single line comment
        while (i < source.length && source[i] !== '\n') i++;
        continue;
      }
      
      if (char === '/' && source[i + 1] === '*') {
        // Multi-line comment
        i += 2;
        while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
          if (source[i] === '\n') { line++; col = 1; }
          i++;
        }
        i += 2;
        continue;
      }
      
      // JSX/Template literals
      if (char === '<' && !this.isOperatorContext(tokens)) {
        const jsx = this.parseJSXToken(source, i);
        tokens.push({ type: 'JSX', value: jsx.value, line, col });
        i = jsx.end;
        col += jsx.value.length;
        continue;
      }
      
      // String literals
      if (char === '"' || char === "'" || char === '`') {
        const str = this.parseString(source, i);
        tokens.push({ type: 'STRING', value: str.value, raw: str.raw, line, col });
        i = str.end;
        col += str.raw.length;
        continue;
      }
      
      // Numbers
      if (/\d/.test(char) || (char === '.' && /\d/.test(source[i + 1]))) {
        const num = this.parseNumber(source, i);
        tokens.push({ type: 'NUMBER', value: num.value, line, col });
        i = num.end;
        col += num.raw.length;
        continue;
      }
      
      // Identifiers and keywords
      if (/[a-zA-Z_$]/.test(char)) {
        const id = this.parseIdentifier(source, i);
        const type = this.getKeywordType(id.value);
        tokens.push({ type, value: id.value, line, col });
        i = id.end;
        col += id.value.length;
        continue;
      }
      
      // VSV special syntax: $state, $computed, $effect, $props
      if (char === '$') {
        const id = this.parseIdentifier(source, i);
        tokens.push({ type: 'VSV_DIRECTIVE', value: id.value, line, col });
        i = id.end;
        col += id.value.length;
        continue;
      }
      
      // Event handlers: @click, @submit, etc.
      if (char === '@') {
        const id = this.parseIdentifier(source, i + 1);
        tokens.push({ type: 'EVENT', value: '@' + id.value, line, col });
        i = id.end;
        col += id.value.length + 1;
        continue;
      }
      
      // Operators and punctuation
      const op = this.parseOperator(source, i);
      if (op) {
        tokens.push({ type: 'OPERATOR', value: op.value, line, col });
        i = op.end;
        col += op.value.length;
        continue;
      }
      
      // Single character
      tokens.push({ type: 'PUNCT', value: char, line, col });
      i++;
      col++;
    }
    
    return tokens;
  }

  /**
   * Check if we're in operator context (to distinguish < from JSX)
   */
  isOperatorContext(tokens) {
    if (tokens.length === 0) return false;
    const last = tokens[tokens.length - 1];
    return ['NUMBER', 'IDENTIFIER', 'STRING'].includes(last.type) ||
           [')', ']'].includes(last.value);
  }

  /**
   * Parse JSX token
   */
  parseJSXToken(source, start) {
    let i = start;
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    while (i < source.length) {
      const char = source[i];
      
      // Handle strings inside JSX
      if ((char === '"' || char === "'" || char === '`') && !inString) {
        inString = true;
        stringChar = char;
        i++;
        continue;
      }
      
      if (inString) {
        if (char === stringChar && source[i - 1] !== '\\') {
          inString = false;
        }
        i++;
        continue;
      }
      
      // Track depth
      if (char === '<' && source[i + 1] !== '/') {
        depth++;
      } else if (char === '/' && source[i + 1] === '>') {
        depth--;
        i += 2;
        if (depth === 0) break;
        continue;
      } else if (char === '<' && source[i + 1] === '/') {
        // Find closing >
        while (i < source.length && source[i] !== '>') i++;
        depth--;
        i++;
        if (depth === 0) break;
        continue;
      } else if (char === '>' && source[i - 1] !== '-') {
        // Check for self-closing or opening tag
        if (source[i - 1] === '/') {
          depth--;
          i++;
          if (depth === 0) break;
          continue;
        }
      }
      
      i++;
    }
    
    return {
      value: source.slice(start, i),
      end: i
    };
  }

  /**
   * Parse string literal
   */
  parseString(source, start) {
    const quote = source[start];
    let i = start + 1;
    let value = '';
    
    while (i < source.length) {
      const char = source[i];
      
      if (char === quote && source[i - 1] !== '\\') {
        break;
      }
      
      if (char === '\\' && i + 1 < source.length) {
        const next = source[i + 1];
        switch (next) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case quote: value += quote; break;
          default: value += char + next;
        }
        i += 2;
        continue;
      }
      
      value += char;
      i++;
    }
    
    return {
      value,
      raw: source.slice(start, i + 1),
      end: i + 1
    };
  }

  /**
   * Parse number
   */
  parseNumber(source, start) {
    let i = start;
    let hasDecimal = false;
    let hasExponent = false;
    
    // Handle hex, binary, octal
    if (source[i] === '0' && source[i + 1]) {
      const next = source[i + 1].toLowerCase();
      if (next === 'x') {
        i += 2;
        while (/[0-9a-fA-F]/.test(source[i])) i++;
        const raw = source.slice(start, i);
        return { value: parseInt(raw, 16), raw, end: i };
      }
      if (next === 'b') {
        i += 2;
        while (/[01]/.test(source[i])) i++;
        const raw = source.slice(start, i);
        return { value: parseInt(raw.slice(2), 2), raw, end: i };
      }
      if (next === 'o') {
        i += 2;
        while (/[0-7]/.test(source[i])) i++;
        const raw = source.slice(start, i);
        return { value: parseInt(raw.slice(2), 8), raw, end: i };
      }
    }
    
    while (i < source.length) {
      const char = source[i];
      
      if (char === '.' && !hasDecimal) {
        hasDecimal = true;
        i++;
        continue;
      }
      
      if ((char === 'e' || char === 'E') && !hasExponent) {
        hasExponent = true;
        i++;
        if (source[i] === '+' || source[i] === '-') i++;
        continue;
      }
      
      if (!/\d/.test(char)) break;
      i++;
    }
    
    const raw = source.slice(start, i);
    return {
      value: parseFloat(raw),
      raw,
      end: i
    };
  }

  /**
   * Parse identifier
   */
  parseIdentifier(source, start) {
    let i = start;
    while (i < source.length && /[a-zA-Z0-9_$]/.test(source[i])) {
      i++;
    }
    return {
      value: source.slice(start, i),
      end: i
    };
  }

  /**
   * Parse operator
   */
  parseOperator(source, start) {
    const ops3 = ['===', '!==', '>>>', '<<=', '>>=', '**=', '&&=', '||=', '??=', '...'];
    const ops2 = ['==', '!=', '<=', '>=', '&&', '||', '??', '++', '--', '+=', '-=', '*=', '/=', '%=', '**', '=>', '<<', '>>', '?.'];
    const ops1 = ['+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', '~', '?', ':'];
    
    const three = source.slice(start, start + 3);
    if (ops3.includes(three)) {
      return { value: three, end: start + 3 };
    }
    
    const two = source.slice(start, start + 2);
    if (ops2.includes(two)) {
      return { value: two, end: start + 2 };
    }
    
    const one = source[start];
    if (ops1.includes(one)) {
      return { value: one, end: start + 1 };
    }
    
    return null;
  }

  /**
   * Get keyword type
   */
  getKeywordType(word) {
    const keywords = [
      'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
      'do', 'switch', 'case', 'break', 'continue', 'default', 'try', 'catch',
      'finally', 'throw', 'new', 'typeof', 'instanceof', 'in', 'of', 'delete',
      'void', 'this', 'super', 'class', 'extends', 'static', 'get', 'set',
      'async', 'await', 'yield', 'import', 'export', 'from', 'as', 'default',
      'true', 'false', 'null', 'undefined', 'NaN', 'Infinity'
    ];
    
    const vsvKeywords = ['component', 'page', 'layout', 'props', 'state', 'computed', 'effect', 'render'];
    
    if (keywords.includes(word)) return 'KEYWORD';
    if (vsvKeywords.includes(word)) return 'VSV_KEYWORD';
    return 'IDENTIFIER';
  }

  /**
   * Build AST from tokens
   */
  buildAST(tokens, options = {}) {
    const ast = {
      type: 'Program',
      body: [],
      components: [],
      imports: [],
      exports: [],
      sourceType: options.typescript ? 'tsv' : 'jsv'
    };
    
    let i = 0;
    
    while (i < tokens.length) {
      const token = tokens[i];
      
      // Import statement
      if (token.type === 'KEYWORD' && token.value === 'import') {
        const importNode = this.parseImport(tokens, i);
        ast.imports.push(importNode.node);
        i = importNode.end;
        continue;
      }
      
      // Export statement
      if (token.type === 'KEYWORD' && token.value === 'export') {
        const exportNode = this.parseExport(tokens, i);
        ast.exports.push(exportNode.node);
        if (exportNode.node.declaration?.type === 'Component') {
          ast.components.push(exportNode.node.declaration);
        }
        i = exportNode.end;
        continue;
      }
      
      // VSV component definition
      if (token.type === 'VSV_KEYWORD' && token.value === 'component') {
        const compNode = this.parseComponent(tokens, i);
        ast.components.push(compNode.node);
        ast.body.push(compNode.node);
        i = compNode.end;
        continue;
      }
      
      // Function component
      if (token.type === 'KEYWORD' && token.value === 'function') {
        const funcNode = this.parseFunction(tokens, i);
        if (this.isComponentFunction(funcNode.node)) {
          funcNode.node.type = 'Component';
          ast.components.push(funcNode.node);
        }
        ast.body.push(funcNode.node);
        i = funcNode.end;
        continue;
      }
      
      // Arrow function component
      if (token.type === 'KEYWORD' && (token.value === 'const' || token.value === 'let')) {
        const declNode = this.parseDeclaration(tokens, i);
        if (declNode.node.init?.type === 'ArrowFunction' && 
            this.isComponentFunction(declNode.node.init)) {
          const compNode = {
            type: 'Component',
            name: declNode.node.name,
            params: declNode.node.init.params,
            body: declNode.node.init.body
          };
          ast.components.push(compNode);
        }
        ast.body.push(declNode.node);
        i = declNode.end;
        continue;
      }
      
      i++;
    }
    
    return ast;
  }

  /**
   * Parse import statement
   */
  parseImport(tokens, start) {
    let i = start + 1; // Skip 'import'
    const node = {
      type: 'ImportDeclaration',
      specifiers: [],
      source: null
    };
    
    // Parse specifiers
    while (i < tokens.length && tokens[i].value !== 'from') {
      if (tokens[i].type === 'IDENTIFIER') {
        // Default import
        node.specifiers.push({
          type: 'ImportDefaultSpecifier',
          local: tokens[i].value
        });
      } else if (tokens[i].value === '{') {
        // Named imports
        i++;
        while (tokens[i].value !== '}') {
          if (tokens[i].type === 'IDENTIFIER') {
            const imported = tokens[i].value;
            let local = imported;
            if (tokens[i + 1]?.value === 'as') {
              local = tokens[i + 2].value;
              i += 2;
            }
            node.specifiers.push({
              type: 'ImportSpecifier',
              imported,
              local
            });
          }
          i++;
        }
      } else if (tokens[i].value === '*') {
        // Namespace import
        if (tokens[i + 1]?.value === 'as') {
          node.specifiers.push({
            type: 'ImportNamespaceSpecifier',
            local: tokens[i + 2].value
          });
          i += 2;
        }
      }
      i++;
    }
    
    // Skip 'from'
    i++;
    
    // Get source
    if (tokens[i]?.type === 'STRING') {
      node.source = tokens[i].value;
      i++;
    }
    
    return { node, end: i };
  }

  /**
   * Parse export statement
   */
  parseExport(tokens, start) {
    let i = start + 1; // Skip 'export'
    const node = {
      type: 'ExportDeclaration',
      default: false,
      declaration: null
    };
    
    if (tokens[i]?.value === 'default') {
      node.default = true;
      i++;
    }
    
    // Parse what's being exported
    if (tokens[i]?.type === 'KEYWORD' && tokens[i].value === 'function') {
      const funcNode = this.parseFunction(tokens, i);
      node.declaration = funcNode.node;
      i = funcNode.end;
    } else if (tokens[i]?.type === 'VSV_KEYWORD' && tokens[i].value === 'component') {
      const compNode = this.parseComponent(tokens, i);
      node.declaration = compNode.node;
      i = compNode.end;
    } else if (tokens[i]?.type === 'KEYWORD' && (tokens[i].value === 'const' || tokens[i].value === 'let')) {
      const declNode = this.parseDeclaration(tokens, i);
      node.declaration = declNode.node;
      i = declNode.end;
    }
    
    return { node, end: i };
  }

  /**
   * Parse component definition
   */
  parseComponent(tokens, start) {
    let i = start + 1; // Skip 'component'
    
    const node = {
      type: 'Component',
      name: null,
      props: [],
      state: [],
      computed: [],
      effects: [],
      render: null
    };
    
    // Get name
    if (tokens[i]?.type === 'IDENTIFIER') {
      node.name = tokens[i].value;
      i++;
    }
    
    // Parse props
    if (tokens[i]?.value === '(') {
      i++;
      while (tokens[i]?.value !== ')') {
        if (tokens[i]?.type === 'IDENTIFIER') {
          node.props.push({
            name: tokens[i].value,
            type: null,
            default: null
          });
        }
        i++;
      }
      i++; // Skip ')'
    }
    
    // Parse body
    if (tokens[i]?.value === '{') {
      const body = this.parseBlock(tokens, i);
      node.body = body.content;
      i = body.end;
    }
    
    return { node, end: i };
  }

  /**
   * Parse function
   */
  parseFunction(tokens, start) {
    let i = start + 1; // Skip 'function'
    
    const node = {
      type: 'Function',
      name: null,
      params: [],
      body: null,
      async: false
    };
    
    // Check for async
    if (tokens[start - 1]?.value === 'async') {
      node.async = true;
    }
    
    // Get name
    if (tokens[i]?.type === 'IDENTIFIER') {
      node.name = tokens[i].value;
      i++;
    }
    
    // Parse params
    if (tokens[i]?.value === '(') {
      const params = this.parseParams(tokens, i);
      node.params = params.params;
      i = params.end;
    }
    
    // Parse body
    if (tokens[i]?.value === '{') {
      const body = this.parseBlock(tokens, i);
      node.body = body.content;
      i = body.end;
    }
    
    return { node, end: i };
  }

  /**
   * Parse declaration
   */
  parseDeclaration(tokens, start) {
    let i = start + 1; // Skip const/let/var
    
    const node = {
      type: 'Declaration',
      kind: tokens[start].value,
      name: null,
      init: null
    };
    
    // Get name
    if (tokens[i]?.type === 'IDENTIFIER') {
      node.name = tokens[i].value;
      i++;
    }
    
    // Get initializer
    if (tokens[i]?.value === '=') {
      i++;
      // Check for arrow function
      if (tokens[i]?.value === '(' || tokens[i]?.type === 'IDENTIFIER') {
        const arrow = this.parseArrowFunction(tokens, i);
        if (arrow) {
          node.init = arrow.node;
          i = arrow.end;
        }
      }
    }
    
    return { node, end: i };
  }

  /**
   * Parse arrow function
   */
  parseArrowFunction(tokens, start) {
    let i = start;
    const node = {
      type: 'ArrowFunction',
      params: [],
      body: null
    };
    
    // Parse params
    if (tokens[i]?.value === '(') {
      const params = this.parseParams(tokens, i);
      node.params = params.params;
      i = params.end;
    } else if (tokens[i]?.type === 'IDENTIFIER') {
      node.params = [{ name: tokens[i].value }];
      i++;
    }
    
    // Check for arrow
    if (tokens[i]?.value !== '=>') {
      return null;
    }
    i++;
    
    // Parse body
    if (tokens[i]?.value === '{') {
      const body = this.parseBlock(tokens, i);
      node.body = body.content;
      i = body.end;
    } else if (tokens[i]?.value === '(') {
      // Expression body with parentheses
      const expr = this.parseExpression(tokens, i);
      node.body = expr.content;
      i = expr.end;
    } else {
      // Single expression body
      node.body = [{ type: 'ReturnStatement', argument: tokens[i] }];
      i++;
    }
    
    return { node, end: i };
  }

  /**
   * Parse parameters
   */
  parseParams(tokens, start) {
    let i = start + 1; // Skip '('
    const params = [];
    
    while (i < tokens.length && tokens[i].value !== ')') {
      if (tokens[i].type === 'IDENTIFIER') {
        const param = { name: tokens[i].value };
        
        // Check for destructuring
        if (tokens[i].value === '{') {
          const destruct = this.parseDestructure(tokens, i);
          params.push({ type: 'destructure', properties: destruct.properties });
          i = destruct.end;
          continue;
        }
        
        // Check for default value
        if (tokens[i + 1]?.value === '=') {
          param.default = tokens[i + 2]?.value;
          i += 2;
        }
        
        params.push(param);
      }
      i++;
    }
    
    return { params, end: i + 1 }; // +1 to skip ')'
  }

  /**
   * Parse destructuring
   */
  parseDestructure(tokens, start) {
    let i = start + 1;
    const properties = [];
    
    while (tokens[i]?.value !== '}') {
      if (tokens[i]?.type === 'IDENTIFIER') {
        properties.push(tokens[i].value);
      }
      i++;
    }
    
    return { properties, end: i + 1 };
  }

  /**
   * Parse block
   */
  parseBlock(tokens, start) {
    let i = start + 1; // Skip '{'
    let depth = 1;
    const content = [];
    
    while (i < tokens.length && depth > 0) {
      if (tokens[i].value === '{') depth++;
      else if (tokens[i].value === '}') depth--;
      
      if (depth > 0) {
        content.push(tokens[i]);
      }
      i++;
    }
    
    return { content, end: i };
  }

  /**
   * Parse expression
   */
  parseExpression(tokens, start) {
    let i = start;
    let depth = 0;
    const content = [];
    
    if (tokens[i].value === '(') {
      depth = 1;
      i++;
    }
    
    while (i < tokens.length) {
      if (tokens[i].value === '(') depth++;
      else if (tokens[i].value === ')') {
        depth--;
        if (depth === 0) break;
      }
      content.push(tokens[i]);
      i++;
    }
    
    return { content, end: i + 1 };
  }

  /**
   * Check if function returns JSX (component)
   */
  isComponentFunction(node) {
    if (!node.body) return false;
    
    // Check if body contains JSX
    const bodyStr = JSON.stringify(node.body);
    return bodyStr.includes('"type":"JSX"') || 
           bodyStr.includes('<') ||
           /^[A-Z]/.test(node.name || '');
  }
}

module.exports = VSVParser;
