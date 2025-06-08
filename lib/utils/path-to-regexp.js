function pathToRegexp(path, keys = []) {
  if (path === '*') return /^.*$/;
  if (path instanceof RegExp) return path;
  
  if (typeof path === 'string') {
    // Échapper les caractères spéciaux
    let regexpSource = path
      .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');

    // Gérer les paramètres nommés (:param)
    regexpSource = regexpSource.replace(/:([a-zA-Z_$][a-zA-Z0-9_$]*)/g, (match, paramName) => {
      keys.push({ name: paramName });
      return '([^/]+)';
    });

    // Gérer les paramètres optionnels (:param?)
    regexpSource = regexpSource.replace(/:([a-zA-Z_$][a-zA-Z0-9_$]*)\?/g, (match, paramName) => {
      keys.push({ name: paramName, optional: true });
      return '([^/]*)?';
    });

    // Gérer les wildcards
    regexpSource = regexpSource.replace(/\*/g, '([^/]*)');

    return new RegExp(`^${regexpSource}$`);
  }
  
  return path;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseParams(pattern, path) {
  const keys = [];
  const regexp = pathToRegexp(pattern, keys);
  const matches = regexp.exec(path);
  
  if (!matches) return null;
  
  const params = {};
  keys.forEach((key, index) => {
    params[key.name] = decodeURIComponent(matches[index + 1] || '');
  });
  
  return params;
}

module.exports = { pathToRegexp, escapeRegExp, parseParams };