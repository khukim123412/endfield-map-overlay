const { app, BaseWindow, WebContentsView, screen } = require('electron');
const path = require('path');
const { createMapView, switchMapUrl, getCurrentUrl } = require('./src/map-view');
const { registerHotkeys, unregisterAll } = require('./src/hotkey');
const { registerIpcHandlers } = require('./src/ipc-handlers');
const { createTray, destroyTray } = require('./src/tray');
const { startPolling, stopPolling, isAvailable: isGameDetectAvailable, isGameDetected } = require('./src/game-window');
const store = require('./src/store');

// Prevent EPIPE crash when parent terminal disconnects
process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

// Prevent multiple instances — second launch will quit immediately
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('[main] Another instance is already running, quitting.');
  app.quit();
}

let overlayWindow = null;
let mapView = null;
let controlView = null;
let trayHandle = null;
let isVisible = true;
let isInteractive = true; // true = map clickable, false = click-through to game
let currentOpacity = 1.0;

const CONTROL_WIDTH = 360;
const CONTROL_HEIGHT = 44;

app.whenReady().then(() => {
  // Load saved settings
  const settings = store.load();
  currentOpacity = settings.opacity;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  // Use BaseWindow (no built-in webContents) — we manage all views manually
  overlayWindow = new BaseWindow({
    x: 0,
    y: 0,
    width: width,
    height: height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    roundedCorners: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  // 1) Add map view first (bottom layer)
  mapView = createMapView(overlayWindow, settings.mapUrl);

  // 2) Add control bar view on top (small floating bar, not full screen)
  const controlX = Math.round((width - CONTROL_WIDTH) / 2);
  const controlY = 8;

  controlView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  controlView.setBounds({ x: controlX, y: controlY, width: CONTROL_WIDTH, height: CONTROL_HEIGHT });
  controlView.setBackgroundColor('#00000000');
  overlayWindow.contentView.addChildView(controlView);
  controlView.webContents.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  controlView.webContents.on('did-finish-load', () => {
    controlView.webContents.send('init-position', { x: controlX, y: controlY });
    // Sync saved opacity to slider
    if (currentOpacity !== 1.0) {
      controlView.webContents.send('opacity-changed', currentOpacity);
    }
  });

  // Apply saved opacity after map loads
  mapView.webContents.on('did-finish-load', () => {
    if (currentOpacity !== 1.0) {
      setMapOpacity(currentOpacity);
    }
  });

  console.log(`[main] Control view added, bounds: ${CONTROL_WIDTH}x${CONTROL_HEIGHT} at (${controlX}, ${controlY})`);

  // Start in interactive mode (map clickable)
  setInteractiveMode(true);

  // Register IPC handlers for renderer controls
  registerIpcHandlers({
    onSetOpacity: setMapOpacity,
    onToggleInteractive: toggleInteractive,
  });

  // Register hotkeys
  registerHotkeys({
    onToggleVisibility: () => { toggleVisibility(); rebuildTrayMenu(); },
    onToggleInteractive: () => { toggleInteractive(); rebuildTrayMenu(); },
    onQuit: cleanup,
  });

  // Create system tray
  trayHandle = createTray({
    getState: () => ({
      isVisible,
      isInteractive,
      currentMapUrl: getCurrentUrl(),
      opacity: currentOpacity,
      gameDetected: isGameDetectAvailable() && isGameDetected(),
    }),
    onToggleVisibility: toggleVisibility,
    onToggleInteractive: toggleInteractive,
    onSetOpacity: (value) => {
      setMapOpacity(value);
      // Sync slider in control bar
      if (controlView && controlView.webContents) {
        controlView.webContents.send('opacity-changed', value);
      }
    },
    onSwitchMap: (url) => {
      if (mapView) {
        switchMapUrl(mapView, url);
        store.set('mapUrl', url);
      }
    },
    onQuit: cleanup,
  });

  // Handle control bar drag — renderer sends new position via IPC
  registerControlBarDrag();

  // Start game window polling (auto-resize overlay to match game bounds)
  if (isGameDetectAvailable()) {
    let wasDetected = false;
    startPolling((bounds) => {
      resizeOverlay(bounds);
      const nowDetected = bounds !== null;
      if (nowDetected !== wasDetected) {
        wasDetected = nowDetected;
        rebuildTrayMenu();
      }
    });
    console.log('[main] Game window polling started');
  } else {
    console.log('[main] Game detection not available, using fullscreen');
  }
});

/**
 * 오버레이 윈도우를 주어진 bounds에 맞춰 리사이즈한다.
 * bounds가 null이면 전체 화면으로 폴백한다.
 */
function resizeOverlay(bounds) {
  if (!overlayWindow) return;

  let x, y, w, h;

  if (bounds) {
    // Win32 GetWindowRect returns physical pixels,
    // Electron setBounds expects logical (DPI-scaled) pixels
    const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1;
    x = Math.round(bounds.x / scaleFactor);
    y = Math.round(bounds.y / scaleFactor);
    w = Math.round(bounds.width / scaleFactor);
    h = Math.round(bounds.height / scaleFactor);
    console.log(`[resize] Game detected → ${w}x${h} at (${x}, ${y}) [scale=${scaleFactor}]`);
  } else {
    const primary = screen.getPrimaryDisplay();
    x = 0;
    y = 0;
    w = primary.bounds.width;
    h = primary.bounds.height;
    console.log(`[resize] Game not detected → fullscreen ${w}x${h}`);
  }

  overlayWindow.setBounds({ x, y, width: w, height: h });

  // 맵 뷰를 윈도우 전체에 맞춤
  if (mapView) {
    mapView.setBounds({ x: 0, y: 0, width: w, height: h });
  }

  // 컨트롤 바를 상단 중앙에 재배치
  if (controlView) {
    const ctrlBounds = controlView.getBounds();
    const newCtrlX = Math.round((w - ctrlBounds.width) / 2);
    const newCtrlY = 8;
    controlView.setBounds({ x: newCtrlX, y: newCtrlY, width: ctrlBounds.width, height: ctrlBounds.height });
  }
}

function setMapOpacity(value) {
  if (!mapView) return;
  // Clamp between 0.1 and 1.0
  const clamped = Math.max(0.1, Math.min(1.0, value));
  currentOpacity = clamped;
  store.set('opacity', clamped);
  // Force page background transparent, then apply opacity to body content only
  mapView.webContents.executeJavaScript(`
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.opacity = ${clamped};
  `);
  console.log(`[opacity] Set to ${Math.round(clamped * 100)}%`);
}

function rebuildTrayMenu() {
  if (trayHandle) trayHandle.rebuildMenu();
}

function registerControlBarDrag() {
  const { ipcMain } = require('electron');
  ipcMain.on('control-bar-drag', (_event, { x, y }) => {
    if (!controlView) return;
    const bounds = controlView.getBounds();
    controlView.setBounds({ x, y, width: bounds.width, height: bounds.height });
  });
}

function toggleVisibility() {
  if (!overlayWindow) return;

  isVisible = !isVisible;
  if (isVisible) {
    overlayWindow.show();
    console.log('[mode] Overlay shown');
  } else {
    overlayWindow.hide();
    console.log('[mode] Overlay hidden');
  }
}

function toggleInteractive() {
  if (!overlayWindow || !isVisible) return;

  isInteractive = !isInteractive;
  setInteractiveMode(isInteractive);
}

function setInteractiveMode(interactive) {
  if (!overlayWindow) return;

  if (interactive) {
    overlayWindow.setIgnoreMouseEvents(false);
    console.log('[mode] Interactive mode (map clickable)');
  } else {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    console.log('[mode] Click-through mode (game clickable)');
  }

  // Notify renderer so UI button stays in sync
  if (controlView && controlView.webContents) {
    controlView.webContents.send('mode-changed', interactive);
  }
}

function cleanup() {
  console.log('[cleanup] Starting cleanup...');
  stopPolling();
  unregisterAll();
  destroyTray();
  if (mapView) {
    console.log('[cleanup] Destroying map webContents');
    mapView.webContents.close({ waitForBeforeUnload: false });
    mapView = null;
  }
  if (controlView) {
    console.log('[cleanup] Destroying control webContents');
    controlView.webContents.close({ waitForBeforeUnload: false });
    controlView = null;
  }
  if (overlayWindow) {
    console.log('[cleanup] Destroying overlay window');
    overlayWindow.destroy();
    overlayWindow = null;
  }
  console.log('[cleanup] Killing child processes and exiting');
  // Kill all child processes (GPU, renderer, utility) that Electron spawned
  const pid = process.pid;
  try {
    require('child_process').execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
  } catch (_) {
    // taskkill may fail on the main process itself, that's fine
    app.exit(0);
  }
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  unregisterAll();
});
