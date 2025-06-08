const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { getMimeType } = require('./utils/mime-types');
const { generateETag } = require('./utils/etag');

function serveStatic(root, options = {}) {
  const opts = {
    index: 'index.html',
    dotfiles: 'ignore',
    etag: true,
    lastModified: true,
    maxAge: 0,
    immutable: false,
    cacheControl: true,
    ...options
  };

  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    let pathname = decodeURIComponent(req.path);
    
    // Sécurité: empêcher l'accès aux fichiers en dehors du répertoire
    if (pathname.includes('..') || pathname.includes('\0')) {
      return res.status(400).send('Bad Request');
    }

    let filePath = path.join(root, pathname);
    
    try {
      const stats = await promisify(fs.stat)(filePath);
      
      if (stats.isDirectory()) {
        if (opts.index) {
          filePath = path.join(filePath, opts.index);
          try {
            await promisify(fs.stat)(filePath);
          } catch {
            return next();
          }
        } else {
          return next();
        }
      }

      // Vérifier les dotfiles
      const basename = path.basename(filePath);
      if (basename.startsWith('.')) {
        if (opts.dotfiles === 'deny') {
          return res.status(403).send('Forbidden');
        } else if (opts.dotfiles === 'ignore') {
          return next();
        }
      }

      // Headers de cache
      if (opts.etag && !res.getHeader('ETag')) {
        const etag = generateETag(stats);
        res.setHeader('ETag', etag);
        
        if (req.get('If-None-Match') === etag) {
          return res.status(304).end();
        }
      }

      if (opts.lastModified && !res.getHeader('Last-Modified')) {
        const lastModified = stats.mtime.toUTCString();
        res.setHeader('Last-Modified', lastModified);
        
        if (req.get('If-Modified-Since') === lastModified) {
          return res.status(304).end();
        }
      }

      if (opts.cacheControl && opts.maxAge > 0) {
        let cacheControl = `max-age=${opts.maxAge}`;
        if (opts.immutable) {
          cacheControl += ', immutable';
        }
        res.setHeader('Cache-Control', cacheControl);
      }

      // Définir le Content-Type
      const contentType = getMimeType(path.extname(filePath));
      res.setHeader('Content-Type', contentType);

      return res.sendFile(filePath);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        return next();
      }
      return next(error);
    }
  };
}

module.exports = serveStatic;