const crypto = require('crypto');

function generateETag(stats) {
  if (stats && stats.mtime && stats.size !== undefined) {
    // ETag basé sur la taille et la date de modification
    return `"${stats.size}-${stats.mtime.getTime()}"`;
  }
  
  // Fallback pour les strings
  const hash = crypto.createHash('md5').update(stats.toString()).digest('hex');
  return `"${hash}"`;
}

function generateStrongETag(content) {
  const hash = crypto.createHash('sha1').update(content).digest('hex');
  return `"${hash}"`;
}

function generateWeakETag(content) {
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return `W/"${hash}"`;
}

function isValidETag(etag) {
  if (!etag || typeof etag !== 'string') return false;
  
  // Strong ETag: "hash"
  if (/^"[^"]*"$/.test(etag)) return true;
  
  // Weak ETag: W/"hash"
  if (/^W\/"[^"]*"$/.test(etag)) return true;
  
  return false;
}

function isWeakETag(etag) {
  return typeof etag === 'string' && etag.startsWith('W/');
}

function compareETags(etag1, etag2) {
  if (!isValidETag(etag1) || !isValidETag(etag2)) return false;
  
  // Enlever le préfixe W/ pour la comparaison
  const clean1 = etag1.replace(/^W\//, '');
  const clean2 = etag2.replace(/^W\//, '');
  
  return clean1 === clean2;
}

module.exports = {
  generateETag,
  generateStrongETag,
  generateWeakETag,
  isValidETag,
  isWeakETag,
  compareETags
};