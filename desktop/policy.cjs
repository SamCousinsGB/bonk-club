const path = require('node:path');
// An app-private session serves ONLY the bundled game at its existing publisher
// origin. No game HTML/JS is downloaded. This keeps CORS and browser invites
// compatible with the deployed service, without disabling web security.
const GAME_URL = 'https://samcousinsgb.github.io/bonk-club/';
function gameDocument(value) {
  try {
    const u = new URL(value), base = new URL(GAME_URL);
    return !u.username && !u.password && u.origin === base.origin &&
      [base.pathname, base.pathname + 'index.html'].includes(u.pathname);
  } catch { return false; }
}
function assetPath(value, root) {
  try {
    const u = new URL(value), base = new URL(GAME_URL);
    if (u.origin !== base.origin || u.username || u.password || !u.pathname.startsWith(base.pathname)) return null;
    const relative = decodeURIComponent(u.pathname.slice(base.pathname.length)) || 'index.html';
    if (!/^(index\.html|favicon\.svg|assets\/[a-zA-Z0-9_.-]+)$/.test(relative)) return null;
    const result = path.resolve(root, relative);
    return result.startsWith(path.resolve(root) + path.sep) ? result : null;
  } catch { return null; }
}
function endpoint(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) throw new Error('Use an HTTPS service URL without credentials or query parameters.');
  return u;
}
function networkPolicy(config) {
  const room = endpoint(config.roomServiceUrl), relay = endpoint(config.turnCredentialsUrl);
  return {
    allowed(value) {
      try {
        const u = new URL(value);
        if (u.username || u.password) return false;
        return (u.origin === room.origin && (u.pathname === room.pathname || u.pathname.startsWith(room.pathname.replace(/\/$/, '') + '/'))) ||
          (u.origin === relay.origin && u.pathname === relay.pathname) ||
          (u.protocol === 'wss:' && u.host === room.host && u.pathname.startsWith(room.pathname.replace(/\/$/, '') + '/'));
      } catch { return false; }
    },
    csp: "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; worker-src 'self'; connect-src 'self' " +
      [...new Set([room.origin, relay.origin, 'wss://' + room.host])].join(' ') +
      "; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'"
  };
}
module.exports = { GAME_URL, gameDocument, assetPath, networkPolicy };
