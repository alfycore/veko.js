const querystring = require('querystring');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;
    const maxSize = 10 * 1024 * 1024; // 10MB max

    req.on('data', chunk => {
      totalSize += chunk.length;
      
      if (totalSize > maxSize) {
        return reject(new Error('Request body too large'));
      }
      
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString();
        const contentType = req.headers['content-type'] || '';

        if (contentType.includes('application/json')) {
          resolve(JSON.parse(body || '{}'));
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          resolve(querystring.parse(body));
        } else if (contentType.includes('multipart/form-data')) {
          resolve(parseMultipart(body, contentType));
        } else {
          resolve({ raw: body });
        }
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function parseMultipart(body, contentType) {
  const boundary = contentType.split('boundary=')[1];
  if (!boundary) return {};

  const parts = body.split(`--${boundary}`);
  const fields = {};
  const files = {};

  for (const part of parts) {
    if (!part.trim() || part === '--') continue;

    const [headers, content] = part.split('\r\n\r\n');
    if (!headers || content === undefined) continue;

    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    
    if (nameMatch) {
      const name = nameMatch[1];
      
      if (filenameMatch) {
        files[name] = {
          filename: filenameMatch[1],
          data: content.slice(0, -2), // Remove \r\n
          contentType: (headers.match(/Content-Type: ([^\r\n]+)/) || [])[1]
        };
      } else {
        fields[name] = content.slice(0, -2);
      }
    }
  }

  return { ...fields, files };
}

module.exports = { parseBody };