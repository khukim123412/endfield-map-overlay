const { globalShortcut } = require('electron');

/**
 * Hotkey bindings for the overlay.
 * Ctrl+1: Toggle overlay visibility
 * Ctrl+2: Toggle interactive / click-through mode
 * Ctrl+Q: Quit
 */

function registerHotkeys({ onToggleVisibility, onToggleInteractive, onQuit }) {
  const bindings = [
    { key: 'CommandOrControl+1', label: 'Toggle visibility', handler: onToggleVisibility },
    { key: 'CommandOrControl+2', label: 'Toggle interactive', handler: onToggleInteractive },
    { key: 'CommandOrControl+Q', label: 'Quit', handler: onQuit },
  ];

  for (const { key, label, handler } of bindings) {
    const ok = globalShortcut.register(key, handler);
    console.log(`[hotkey] ${key} (${label}) registered: ${ok}`);
  }
}

function unregisterAll() {
  globalShortcut.unregisterAll();
  console.log('[hotkey] All hotkeys unregistered');
}

module.exports = { registerHotkeys, unregisterAll };
