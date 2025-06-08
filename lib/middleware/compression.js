const zlib = require('zlib');
const { isTextMimeType } = require('../utils/mime-types');

function compression(options = {}) {
  const opts = {
    threshold: 1024,
    level: 6,
    chunkSize: 1024,
    filter: (req, res) => {
      const contentType = res.getHeader('Content-Type') || '';
      return isTextMimeType(contentType);
    },
    ...options
  };

  return (req, res, next) => {
    const acceptEncoding = req.get('accept-encoding') || '';
    
    // Vérifier si le client accepte la compression
    const supportsGzip = acceptEncoding.includes('gzip');
    const supportsDeflate = acceptEncoding.includes('deflate');
    
    if (!supportsGzip && !supportsDeflate) {
      return next();
    }

    // Sauvegarder les méthodes originales
    const originalWrite = res.write;
    const originalEnd = res.end;
    const originalWriteHead = res.writeHead;
    
    let compressionStream = null;
    let headers = {};
    let statusCode = res.statusCode;

    // Override writeHead pour capturer les headers
    res.writeHead = function(code, reasonPhrase, headerObj) {
      statusCode = code;
      if (typeof reasonPhrase === 'object') {
        headerObj = reasonPhrase;
        reasonPhrase = undefined;
      }
      if (headerObj) {
        Object.assign(headers, headerObj);
      }
    };

    // Override write
    res.write = function(chunk, encoding) {
      if (!compressionStream) {
        initCompression();
      }
      
      if (compressionStream) {
        return compressionStream.write(chunk, encoding);
      }
      
      return originalWrite.call(this, chunk, encoding);
    };

    // Override end
    res.end = function(chunk, encoding) {
      if (chunk && !compressionStream) {
        initCompression();
      }
      
      if (compressionStream) {
        if (chunk) {
          compressionStream.write(chunk, encoding);
        }
        compressionStream.end();
      } else {
        originalEnd.call(this, chunk, encoding);
      }
    };

    function initCompression() {
      // Vérifier si on doit compresser
      if (!opts.filter(req, res)) {
        return;
      }

      const contentLength = res.getHeader('Content-Length');
      if (contentLength && parseInt(contentLength) < opts.threshold) {
        return;
      }

      // Restaurer les headers
      if (Object.keys(headers).length > 0) {
        Object.keys(headers).forEach(key => {
          res.setHeader(key, headers[key]);
        });
      }

      // Choisir l'algorithme de compression
      if (supportsGzip) {
        compressionStream = zlib.createGzip({
          level: opts.level,
          chunkSize: opts.chunkSize
        });
        res.setHeader('Content-Encoding', 'gzip');
      } else if (supportsDeflate) {
        compressionStream = zlib.createDeflate({
          level: opts.level,
          chunkSize: opts.chunkSize
        });
        res.setHeader('Content-Encoding', 'deflate');
      }

      if (compressionStream) {
        res.removeHeader('Content-Length');
        res.setHeader('Vary', 'Accept-Encoding');
        
        // Écrire les headers
        originalWriteHead.call(res, statusCode);
        
        // Pipe vers la réponse
        compressionStream.pipe(res);
      }
    }

    next();
  };
}

module.exports = compression;