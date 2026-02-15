const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),
  toggleInteractive: () => ipcRenderer.send('toggle-interactive'),
  dragControlBar: (x, y) => ipcRenderer.send('control-bar-drag', { x, y }),
  onModeChange: (callback) => {
    ipcRenderer.on('mode-changed', (_event, interactive) => callback(interactive));
  },
  onOpacityChange: (callback) => {
    ipcRenderer.on('opacity-changed', (_event, value) => callback(value));
  },
  onInitPosition: (callback) => {
    ipcRenderer.on('init-position', (_event, pos) => callback(pos));
  },
});
