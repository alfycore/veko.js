class TemplateHelpers {
  /**
   * Helper pour les dates
   */
  static formatDate(date, format = 'DD/MM/YYYY') {
    if (!date) return '';
    
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return format
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year);
  }

  /**
   * Helper pour les URLs
   */
  static url(path, params = {}) {
    let url = path;
    const queryString = new URLSearchParams(params).toString();
    
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
    
    return url;
  }

  /**
   * Helper pour les assets
   */
  static asset(path) {
    const baseUrl = process.env.ASSET_URL || '/';
    return baseUrl + path.replace(/^\/+/, '');
  }

  /**
   * Helper pour le pluriel
   */
  static pluralize(count, singular, plural = null) {
    if (count === 1) return singular;
    return plural || (singular + 's');
  }

  /**
   * Helper pour tronquer le texte
   */
  static truncate(text, length = 100, suffix = '...') {
    if (!text || text.length <= length) return text;
    return text.substring(0, length) + suffix;
  }

  /**
   * Helper conditionnelle de classe CSS
   */
  static classNames(classes) {
    const result = [];
    
    for (const [className, condition] of Object.entries(classes)) {
      if (condition) {
        result.push(className);
      }
    }
    
    return result.join(' ');
  }
}

module.exports = TemplateHelpers;