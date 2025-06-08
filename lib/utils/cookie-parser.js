function parseCookies(cookieHeader) {
  const cookies = {};
  
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      try {
        cookies[name] = decodeURIComponent(value);
      } catch (e) {
        cookies[name] = value;
      }
    }
  });
  
  return cookies;
}

function serializeCookie(name, value, options = {}) {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  
  if (options.maxAge) {
    cookie += `; Max-Age=${options.maxAge}`;
  }
  
  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }
  
  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }
  
  if (options.path) {
    cookie += `; Path=${options.path}`;
  }
  
  if (options.httpOnly) {
    cookie += '; HttpOnly';
  }
  
  if (options.secure) {
    cookie += '; Secure';
  }
  
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  }
  
  return cookie;
}

module.exports = { parseCookies, serializeCookie };