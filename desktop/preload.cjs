const { contextBridge, ipcRenderer } = require('electron');
// No raw IPC, filesystem, shell, network or Node APIs cross this boundary.
contextBridge.exposeInMainWorld('bonkDesktop', Object.freeze({
  loadPreferences: () => ipcRenderer.invoke('preferences:load'),
  savePreferences: value => ipcRenderer.invoke('preferences:save', value),
  fullscreen: value => ipcRenderer.invoke('window:fullscreen', value),
  quit: () => ipcRenderer.invoke('window:quit'),
}));
