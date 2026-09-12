const { app, BrowserWindow, Menu, session, ipcMain, dialog, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { GAME_URL, gameDocument, assetPath, networkPolicy } = require('./policy.cjs');
const { platformStatus } = require('./platform.cjs');

app.setName('Bonk Club');
// A launch argument also permits isolated support/QA profiles. It is never sent
// by the renderer and cannot redirect arbitrary filesystem IPC.
const profileArg = process.argv.find(a => a.startsWith('--profile-dir='));
app.setPath('userData', profileArg ? path.resolve(profileArg.slice(14)) : path.join(app.getPath('appData'), 'BonkClub'));
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let win;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win?.isMinimized()) win.restore(); win?.focus(); });
  app.whenReady().then(start).catch(() => {
    dialog.showErrorBox('Bonk Club could not start', 'The installed game files or saved settings are unavailable. Verify the game files in Steam.');
    app.exit(1);
  });
}
app.on('window-all-closed', () => app.quit());

async function start() {
  const root = path.resolve(__dirname, '../dist-desktop');
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'build-config.json'), 'utf8'));
  const policy = networkPolicy(config);
  const { PreferenceStore } = await import('./store.mjs');
  const store = new PreferenceStore(path.join(app.getPath('userData'), 'saves'));
  const gameSession = session.fromPartition('persist:bonk-game');
  gameSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(contents === win?.webContents && gameDocument(contents.getURL()) && ['clipboard-sanitized-write', 'fullscreen'].includes(permission));
  });
  gameSession.setPermissionCheckHandler((contents, permission, origin) =>
    contents === win?.webContents && origin === new URL(GAME_URL).origin && ['clipboard-sanitized-write', 'fullscreen'].includes(permission));
  gameSession.on('will-download', event => event.preventDefault());
  gameSession.protocol.handle('https', async request => {
    const file = assetPath(request.url, root);
    if (file) {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('', { status: 405 });
      try {
        const data = fs.readFileSync(file);
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' }[path.extname(file)] || 'application/octet-stream';
        return new Response(request.method === 'HEAD' ? null : data, { headers: {
          'Content-Type': mime, 'Content-Security-Policy': policy.csp,
          'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
        } });
      } catch { return new Response('Game asset unavailable', { status: 404 }); }
    }
    return new Response('', { status: 403 });
  });
  const windowFile = path.join(app.getPath('userData'), 'window.json');
  let windowState = {};
  try { if (fs.statSync(windowFile).size < 1024) windowState = JSON.parse(fs.readFileSync(windowFile, 'utf8')); } catch { /* Defaults. */ }
  if (!windowState || typeof windowState !== 'object') windowState = {};
  const display = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(display.width, Math.max(800, Number(windowState.width) || 1280));
  const height = Math.min(display.height, Math.max(600, Number(windowState.height) || 800));
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    title: 'Bonk Club', width, height, minWidth: 800, minHeight: 600, show: false,
    icon: path.join(__dirname, 'assets/icon.png'),
    backgroundColor: '#15191b', autoHideMenuBar: true,
    fullscreen: windowState.fullscreen === true || process.argv.includes('--fullscreen'),
    webPreferences: { session: gameSession, preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true,
      webviewTag: false, navigateOnDragDrop: false, backgroundThrottling: false,
      // Development smoke uses CDP; packaged builds close this inspection surface.
      devTools: !app.isPackaged,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-redirect', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  // On Windows these events can precede isFullScreen() updating its value.
  win.on('enter-full-screen', () => win.webContents.send('window:fullscreen-changed', true));
  win.on('leave-full-screen', () => win.webContents.send('window:fullscreen-changed', false));
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F11' || (input.alt && input.key === 'Enter'))) {
      event.preventDefault(); win.setFullScreen(!win.isFullScreen());
    }
    if ((input.control || input.meta) && ['r', 'R', '+', '-', '0'].includes(input.key)) event.preventDefault();
  });
  function trusted(event) {
    if (event.sender !== win.webContents || !event.senderFrame || event.senderFrame !== win.webContents.mainFrame || !gameDocument(event.senderFrame.url)) throw new Error('Untrusted sender');
  }
  ipcMain.handle('preferences:load', event => { trusted(event); return { value: store.value, warning: store.warning }; });
  ipcMain.handle('platform:status', event => { trusted(event); return platformStatus(config); });
  ipcMain.handle('preferences:save', (event, value) => { trusted(event); return store.save(value); });
  ipcMain.handle('window:fullscreen', async (event, value) => {
    trusted(event);
    if (typeof value === 'boolean' && value !== win.isFullScreen()) {
      await new Promise(resolve => {
        const name = value ? 'enter-full-screen' : 'leave-full-screen';
        let timer;
        const done = () => { clearTimeout(timer); win.removeListener(name, done); setImmediate(resolve); };
        win.once(name, done); timer = setTimeout(done, 1500); win.setFullScreen(value);
      });
    }
    return win.isFullScreen();
  });
  ipcMain.handle('window:quit', event => { trusted(event); app.quit(); });
  win.on('close', () => {
    try { const b = win.getNormalBounds(); fs.writeFileSync(windowFile, JSON.stringify({ width: b.width, height: b.height, fullscreen: win.isFullScreen() })); } catch { /* A window preference must not prevent exit. */ }
  });
  let recovering = false;
  win.webContents.on('render-process-gone', async (_event, details) => {
    if (recovering || details.reason === 'clean-exit') return;
    recovering = true;
    const { response } = await dialog.showMessageBox(win, { type: 'error', title: 'Bonk Club', message: 'The game stopped unexpectedly.', detail: 'The current room has ended. Your saved settings are kept.', buttons: ['Restart game', 'Quit'], defaultId: 0, cancelId: 1 });
    if (response === 0) { await win.loadURL(GAME_URL); recovering = false; } else app.quit();
  });
  win.once('ready-to-show', () => win.show());
  await win.loadURL(GAME_URL);
}
