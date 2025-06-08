const mimeTypes = {
  // Text
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.md': 'text/markdown',
  
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  
  // Video
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  
  // Archives
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.7z': 'application/x-7z-compressed',
  
  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  
  // Applications
  '.exe': 'application/octet-stream',
  '.msi': 'application/x-msi',
  '.dmg': 'application/x-apple-diskimage',
  '.deb': 'application/x-debian-package',
  '.rpm': 'application/x-rpm'
};

function getMimeType(extension) {
  const ext = extension.toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function getExtension(mimeType) {
  for (const [ext, mime] of Object.entries(mimeTypes)) {
    if (mime === mimeType) {
      return ext;
    }
  }
  return null;
}

function isTextMimeType(mimeType) {
  return mimeType.startsWith('text/') || 
         mimeType === 'application/json' ||
         mimeType === 'application/javascript' ||
         mimeType === 'application/xml';
}

module.exports = { 
  mimeTypes, 
  getMimeType, 
  getExtension, 
  isTextMimeType 
};