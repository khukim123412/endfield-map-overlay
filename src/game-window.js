'use strict';

/**
 * game-window.js — Win32 게임 창 감지 모듈
 * Koffi FFI로 user32.dll 함수를 호출하여 게임 창 HWND를 찾고 추적한다.
 */

let koffi = null;
let user32 = null;

// Win32 API bindings
let FindWindowW = null;
let GetWindowRect = null;
let IsIconic = null;
let IsWindow = null;

// 게임 창 제목 후보 (버전/언어에 따라 다를 수 있음)
const GAME_TITLE_CANDIDATES = [
  'Endfield',
  'Arknights: Endfield',
  'Arknights Endfield',
  '明日方舟：终末地',
  '明日方舟:终末地',
];

let cachedHwnd = null;
let pollTimer = null;
let onBoundsChanged = null; // callback(bounds | null)
let lastBoundsJson = '';
let available = false;

function init() {
  try {
    koffi = require('koffi');
    user32 = koffi.load('user32.dll');

    // HWND FindWindowW(LPCWSTR lpClassName, LPCWSTR lpWindowName)
    FindWindowW = user32.func('FindWindowW', 'void*', ['str16', 'str16']);

    // BOOL GetWindowRect(HWND hWnd, LPRECT lpRect)
    const RECT = koffi.struct('RECT', {
      left: 'int32',
      top: 'int32',
      right: 'int32',
      bottom: 'int32',
    });
    GetWindowRect = user32.func('GetWindowRect', 'bool', ['void*', koffi.out(koffi.pointer(RECT))]);

    // BOOL IsIconic(HWND hWnd)
    IsIconic = user32.func('IsIconic', 'bool', ['void*']);

    // BOOL IsWindow(HWND hWnd)
    IsWindow = user32.func('IsWindow', 'bool', ['void*']);

    available = true;
    console.log('[game-window] Koffi + user32.dll loaded successfully');
  } catch (err) {
    available = false;
    console.warn('[game-window] Koffi load failed, falling back to fullscreen mode:', err.message);
  }
}

/**
 * 게임 창 HWND를 검색한다.
 * 캐시된 HWND가 유효하면 재사용, 아니면 후보 리스트로 재검색.
 */
function findGameWindow() {
  if (!available) return null;

  // 캐시된 HWND 유효성 확인
  if (cachedHwnd && IsWindow(cachedHwnd)) {
    return cachedHwnd;
  }

  cachedHwnd = null;

  // 후보 제목으로 검색
  for (const title of GAME_TITLE_CANDIDATES) {
    const hwnd = FindWindowW(null, title);
    if (hwnd) {
      cachedHwnd = hwnd;
      console.log(`[game-window] Found game window: "${title}"`);
      return hwnd;
    }
  }

  return null;
}

/**
 * 게임 창의 위치와 크기를 반환한다.
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
function getGameBounds() {
  const hwnd = findGameWindow();
  if (!hwnd) return null;

  // 최소화 상태면 bounds를 반환하지 않음
  if (IsIconic(hwnd)) return null;

  const rect = {};
  const ok = GetWindowRect(hwnd, rect);
  if (!ok) return null;

  return {
    x: rect.left,
    y: rect.top,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
  };
}

/**
 * 500ms 간격으로 게임 창을 폴링한다.
 * bounds가 변경되면 콜백을 호출한다.
 * @param {function} callback - (bounds | null) => void
 */
function startPolling(callback) {
  if (!available) {
    console.log('[game-window] Polling skipped (koffi not available)');
    return;
  }

  onBoundsChanged = callback;
  lastBoundsJson = '';

  pollTimer = setInterval(() => {
    const bounds = getGameBounds();
    const boundsJson = bounds ? JSON.stringify(bounds) : '';

    if (boundsJson !== lastBoundsJson) {
      lastBoundsJson = boundsJson;
      if (onBoundsChanged) onBoundsChanged(bounds);
    }
  }, 500);

  console.log('[game-window] Polling started (500ms interval)');

  // 최초 1회 즉시 실행
  const bounds = getGameBounds();
  lastBoundsJson = bounds ? JSON.stringify(bounds) : '';
  if (onBoundsChanged) onBoundsChanged(bounds);
}

/**
 * 폴링을 중지한다.
 */
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[game-window] Polling stopped');
  }
}

/**
 * 현재 게임 창이 감지되었는지 반환한다.
 */
function isGameDetected() {
  if (!available) return false;
  return findGameWindow() !== null;
}

/**
 * Koffi가 정상 로드되어 기능 사용 가능한지 반환한다.
 */
function isAvailable() {
  return available;
}

// 모듈 로드 시 즉시 초기화
init();

module.exports = {
  startPolling,
  stopPolling,
  getGameBounds,
  isGameDetected,
  isAvailable,
  GAME_TITLE_CANDIDATES,
};
