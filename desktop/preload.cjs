const { contextBridge, ipcRenderer } = require('electron');
// No raw IPC, filesystem, shell, network or Node APIs cross this boundary.
contextBridge.exposeInMainWorld('bonkDesktop', Object.freeze({
  loadPreferences: () => ipcRenderer.invoke('preferences:load'),
  savePreferences: value => ipcRenderer.invoke('preferences:save', value),
  fullscreen: value => ipcRenderer.invoke('window:fullscreen', value),
  onFullscreenChange: callback => {
    const handler = (_event, active) => callback(active === true);
    ipcRenderer.on('window:fullscreen-changed', handler);
    return () => ipcRenderer.removeListener('window:fullscreen-changed', handler);
  },
  quit: () => ipcRenderer.invoke('window:quit'),
}));
