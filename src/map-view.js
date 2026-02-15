const { WebContentsView } = require('electron');

const DEFAULT_MAP_URL = 'https://endfieldtools.dev/interactive-map/valley-iv/';

let currentUrl = DEFAULT_MAP_URL;

function createMapView(parentWindow, initialUrl) {
  if (initialUrl) currentUrl = initialUrl;
  const mapView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Fill the entire parent window
  const { width, height } = parentWindow.getBounds();
  mapView.setBounds({ x: 0, y: 0, width, height });
  mapView.setBackgroundColor('#00000000');

  parentWindow.contentView.addChildView(mapView);

  console.log(`[map-view] Loading map: ${currentUrl}`);
  console.log(`[map-view] Bounds: ${width}x${height}`);

  mapView.webContents.loadURL(currentUrl);

  mapView.webContents.on('did-finish-load', () => {
    console.log('[map-view] Map loaded successfully');
  });

  mapView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[map-view] Failed to load: ${errorDescription} (${errorCode}) - ${validatedURL}`);
  });

  // Keep map view sized to window
  parentWindow.on('resize', () => {
    const { width, height } = parentWindow.getBounds();
    mapView.setBounds({ x: 0, y: 0, width, height });
  });

  return mapView;
}

function switchMapUrl(mapView, url) {
  currentUrl = url;
  console.log(`[map-view] Switching to: ${url}`);
  mapView.webContents.loadURL(url);
}

function getCurrentUrl() {
  return currentUrl;
}

module.exports = { createMapView, switchMapUrl, getCurrentUrl, DEFAULT_MAP_URL };
