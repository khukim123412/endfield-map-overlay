const { ipcMain } = require('electron');

/**
 * Register IPC handlers for renderer ↔ main communication.
 *
 * @param {object} opts
 * @param {Function} opts.onSetOpacity - (value: number 0~1) → set map opacity
 * @param {Function} opts.onToggleInteractive - () → toggle interactive/click-through
 */
function registerIpcHandlers({ onSetOpacity, onToggleInteractive }) {
  ipcMain.on('set-opacity', (_event, value) => {
    onSetOpacity(value);
  });

  ipcMain.on('toggle-interactive', () => {
    onToggleInteractive();
  });
}

module.exports = { registerIpcHandlers };
