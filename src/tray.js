const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

const MAP_SOURCES = [
  { label: 'endfieldtools.dev', url: 'https://endfieldtools.dev/interactive-map/valley-iv/' },
  { label: 'endfield.gg', url: 'https://endfield.gg/map' },
];

let tray = null;

/**
 * Create system tray icon with context menu.
 *
 * @param {object} opts
 * @param {Function} opts.getState - () => { isVisible, isInteractive, currentMapUrl, opacity }
 * @param {Function} opts.onToggleVisibility - () => void
 * @param {Function} opts.onToggleInteractive - () => void
 * @param {Function} opts.onSetOpacity - (value: number) => void
 * @param {Function} opts.onSwitchMap - (url: string) => void
 * @param {Function} opts.onQuit - () => void
 */
function createTray({ getState, onToggleVisibility, onToggleInteractive, onSetOpacity, onSwitchMap, onQuit }) {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('Endfield Map Overlay');

  function rebuildMenu() {
    const state = getState();

    const template = [
      {
        label: state.gameDetected ? '🟢 Game: Detected' : '🔴 Game: Not Found',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: state.isVisible ? 'Hide Overlay (Ctrl+1)' : 'Show Overlay (Ctrl+1)',
        click: () => { onToggleVisibility(); rebuildMenu(); },
      },
      {
        label: state.isInteractive ? 'Click-Through Mode (Ctrl+2)' : 'Interactive Mode (Ctrl+2)',
        click: () => { onToggleInteractive(); rebuildMenu(); },
        enabled: state.isVisible,
      },
      { type: 'separator' },
      {
        label: 'Opacity',
        submenu: [100, 80, 60, 40, 20].map(pct => ({
          label: `${pct}%`,
          type: 'radio',
          checked: Math.round(state.opacity * 100) === pct,
          click: () => { onSetOpacity(pct / 100); rebuildMenu(); },
        })),
      },
      { type: 'separator' },
      {
        label: 'Map Source',
        submenu: MAP_SOURCES.map(src => ({
          label: src.label,
          type: 'radio',
          checked: state.currentMapUrl === src.url,
          click: () => { onSwitchMap(src.url); rebuildMenu(); },
        })),
      },
      { type: 'separator' },
      {
        label: 'Quit (Ctrl+Q)',
        click: onQuit,
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    tray.setContextMenu(menu);
  }

  rebuildMenu();

  // Left-click on tray icon toggles visibility
  tray.on('click', () => {
    onToggleVisibility();
    rebuildMenu();
  });

  return { rebuildMenu };
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { createTray, destroyTray, MAP_SOURCES };
