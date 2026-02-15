// --- Opacity slider ---
const opacitySlider = document.getElementById('opacity-slider');
const opacityValue = document.getElementById('opacity-value');

opacitySlider.addEventListener('input', () => {
  const val = parseInt(opacitySlider.value, 10);
  opacityValue.textContent = val + '%';
  window.overlayAPI.setOpacity(val / 100);
});

// --- Mode toggle button ---
const modeBtn = document.getElementById('mode-btn');

modeBtn.addEventListener('click', () => {
  window.overlayAPI.toggleInteractive();
});

// Listen for opacity changes from main process (e.g. via tray menu)
window.overlayAPI.onOpacityChange((value) => {
  const pct = Math.round(value * 100);
  opacitySlider.value = pct;
  opacityValue.textContent = pct + '%';
});

// Listen for mode changes from main process (e.g. via hotkey)
window.overlayAPI.onModeChange((interactive) => {
  modeBtn.textContent = interactive ? '인터랙티브' : '클릭투과';
  modeBtn.classList.toggle('active', interactive);
});

// --- Receive initial view position from main ---
window.overlayAPI.onInitPosition(({ x, y }) => {
  const controlBar = document.getElementById('control-bar');
  controlBar.dataset.viewX = x;
  controlBar.dataset.viewY = y;
});

// --- Drag control bar (moves the WebContentsView via IPC) ---
const controlBar = document.getElementById('control-bar');
let isDragging = false;
let dragStartScreenX = 0;
let dragStartScreenY = 0;
let dragStartViewX = 0;
let dragStartViewY = 0;

controlBar.addEventListener('mousedown', (e) => {
  if (e.target.closest('input, button')) return;

  isDragging = true;
  dragStartScreenX = e.screenX;
  dragStartScreenY = e.screenY;
  // Store current view position (sent from main on load, or default)
  dragStartViewX = parseInt(controlBar.dataset.viewX || '0', 10);
  dragStartViewY = parseInt(controlBar.dataset.viewY || '0', 10);
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.screenX - dragStartScreenX;
  const dy = e.screenY - dragStartScreenY;
  const newX = dragStartViewX + dx;
  const newY = dragStartViewY + dy;
  window.overlayAPI.dragControlBar(newX, newY);
  controlBar.dataset.viewX = newX;
  controlBar.dataset.viewY = newY;
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});
