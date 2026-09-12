const path = require('node:path');
// An app-private session serves ONLY the bundled game at its publisher origin.
// No game HTML/JS is downloaded and web security remains enabled.
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
function networkPolicy(config) {
  if (config.transport !== 'steam') throw new Error('Desktop builds require the Steam transport.');
  return {
    // Native Steamworks owns connections. The renderer only fetches its bundle.
    allowed: () => false,
    csp: "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; worker-src 'self'; connect-src 'self'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'",
  };
}

module.exports = { GAME_URL, gameDocument, assetPath, networkPolicy };
