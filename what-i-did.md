# Endfield Map Overlay - 진행 기록

## 프로젝트 목표
명일방주 엔드필드의 커뮤니티 인터랙티브 맵(endfieldtools.dev)을 게임 위에 투명 오버레이로 띄워주는 Electron 앱.

## 완료한 작업

### Phase 1: 프로젝트 셋업 + 기본 윈도우 (완료)
- `D:\claude\endfield-overlay\` 프로젝트 디렉토리 생성
- `package.json` 작성 (Electron 35.x)
- `npm install` 완료
- `main.js` 작성 — 전체화면 투명 프레임리스 윈도우 생성
- `renderer/index.html` 작성 — 테스트용 UI
- `renderer/preload.js` 작성 — IPC 브릿지 골격
- **테스트 결과**: 투명 윈도우가 화면 위에 정상 표시됨 (확인 완료)

### Phase 2: 맵 임베드 (완료)
- `src/map-view.js` 작성 — WebContentsView로 외부 맵 로드
- 맵 URL: `endfieldtools.dev/interactive-map/valley-iv/` (지역 선택 페이지가 아닌 직접 맵)
- `main.js`에 맵 뷰 통합 + cleanup 로직 추가
- 종료: Ctrl+Q → `mapView.webContents.close()` + `overlayWindow.destroy()` + `app.exit(0)`
- `renderer/index.html` 투명 배경으로 정리 (Phase 1 테스트 UI 제거)
- **테스트 결과**: 맵 로드 성공, Ctrl+Q로 모든 프로세스 깨끗하게 종료 확인

### Phase 3: 단축키 (완료)
- `src/hotkey.js` 작성 — 글로벌 단축키 등록/해제 모듈
- `main.js` 리팩터링 — 인라인 Ctrl+Q를 hotkey 모듈로 이동, 상태 관리 추가
- Ctrl+1: 오버레이 표시/숨김 토글 (`overlayWindow.show()` / `.hide()`)
- Ctrl+2: 인터랙티브 ↔ 클릭투과 모드 전환 (`setIgnoreMouseEvents`)
- Ctrl+Q: 종료 (기존과 동일)
- 클릭투과 모드: `setIgnoreMouseEvents(true, { forward: true })` — 마우스가 게임으로 통과
- **테스트 결과**: 세 단축키 모두 정상 동작 확인

### Phase 4: 컨트롤 바 UI (완료)
- `BrowserWindow` → `BaseWindow` 전환 — 모든 뷰를 WebContentsView로 수동 관리
- 맵 뷰(하단) + 컨트롤 뷰(상단) 레이어링: `addChildView` 순서로 z-order 제어
- `renderer/styles.css` 작성 — 반투명 다크 컨트롤 바, 슬라이더, 토글 버튼
- `renderer/index.html` 완성 — 투명도 슬라이더 + 인터랙티브/클릭투과 모드 토글 버튼
- `renderer/renderer.js` 작성 — 슬라이더/버튼 이벤트 + 컨트롤 바 드래그 이동
- `renderer/preload.js` 업데이트 — `setOpacity`, `toggleInteractive`, `onModeChange` IPC 노출
- `src/ipc-handlers.js` 작성 — `set-opacity`, `toggle-interactive` IPC 핸들러
- `main.js` 리팩터링 — `setMapOpacity()` 함수 추가 (맵 페이지 배경 투명화 + body opacity 조절)
- 컨트롤 뷰: `setBackgroundColor('#00000000')` + CSS `pointer-events: none` (body) / `auto` (컨트롤 바)
- 맵 뷰: `setBackgroundColor('#00000000')` + JS로 `html/body` 배경 투명화 → 투명도 줄이면 뒤가 비침
- Ctrl+2 핫키 ↔ UI 버튼 동기화: `controlView.webContents.send('mode-changed', ...)`
- **테스트 결과**: 컨트롤 바 표시, 투명도 슬라이더, 모드 토글, 드래그 이동 모두 정상 동작 확인

### Phase 5: 시스템 트레이 (완료)
- `assets/icon.ico` 생성 — 16x16 teal 맵 핀 아이콘 (Node.js로 프로그래밍 생성)
- `src/tray.js` 작성 — 시스템 트레이 모듈
  - 좌클릭: 오버레이 표시/숨김 토글
  - 우클릭 컨텍스트 메뉴: 표시/숨김, 인터랙티브/클릭투과, 투명도(100/80/60/40/20%), 맵 소스 전환, 종료
  - 상태 반영: `getState()` 콜백으로 현재 상태를 메뉴에 실시간 반영
- `src/map-view.js` 수정 — `switchMapUrl()`, `getCurrentUrl()` 함수 추가 (맵 소스 전환 지원)
- `main.js` 수정 — 트레이 통합, `currentOpacity` 상태 추적, `rebuildTrayMenu()` 헬퍼
- `renderer/preload.js` 수정 — `onOpacityChange` IPC 추가 (트레이 → 컨트롤 바 슬라이더 동기화)
- `renderer/renderer.js` 수정 — 트레이에서 투명도 변경 시 슬라이더 UI 동기화
- 상태 동기화: 핫키 ↔ 트레이 ↔ 컨트롤 바 UI 모두 양방향 동기화
- cleanup에 `destroyTray()` 추가
- **맵 소스**: endfieldtools.dev (기본), endfield.gg (대체)
- **테스트 결과**: 앱 실행 정상, 트레이 아이콘 생성 확인, 에러 없음

## 남은 작업

### Phase 5.1: 의존성 설치 (완료)
- `npm install koffi` (순수 JS FFI, node-gyp 불필요)

### Phase 5.2: 게임 창 감지 모듈 (완료)
- `src/game-window.js` 작성 — Koffi로 Win32 API 호출 (FindWindowW, GetWindowRect, IsIconic, IsWindow)
- 게임 창 제목 후보 리스트: `Endfield`, `Arknights: Endfield`, `Arknights Endfield`, 중문 2종
- HWND 캐싱 + 500ms 폴링 (bounds 변경 시에만 콜백)
- Koffi 로드 실패 시 graceful degradation (에러 없이 null 반환)
- **테스트 결과**: 실제 게임(`"Endfield"`) 감지 성공, bounds `{x:314, y:162, w:1293, h:756}` 정상 반환

### Phase 5.3: main.js 통합
- `resizeOverlay(bounds)` 함수 추가
- 폴링 시작/정지, 전체화면 폴백

### Phase 5.4: 트레이 메뉴 업데이트 (완료)
- `tray.js` — 메뉴 최상단에 게임 감지 상태 표시 (`🟢 Game: Detected` / `🔴 Game: Not Found`, 비활성 라벨)
- `main.js` — `getState()`에 `gameDetected` 추가, 폴링 콜백에서 감지 상태 변경 시 트레이 메뉴 자동 리빌드
- **테스트 결과**: 게임 실행 중 🟢 표시, 맵 소스 전환/투명도/모드 토글 모두 정상

### Phase 5.5: 테스트 (완료)
- Koffi + user32.dll 로드 ✅
- 게임 창 감지 (`"Endfield"`) ✅
- DPI 스케일링 (scale=2) 적용된 오버레이 리사이즈 ✅
- 맵 로드 + 맵 소스 전환 (endfieldtools ↔ endfield.gg) ✅
- 핫키 3종 (Ctrl+1/2/Q) 등록 ✅
- 오버레이 표시/숨김 ✅
- 트레이 게임 감지 상태 표시 ✅
- 에러/크래시 없음 ✅

### Phase 6: 설정 저장 + 마무리 (완료)
- `src/store.js` 작성 — 순수 JSON 파일 기반 (electron-store는 ESM-only라 제외)
  - 저장 경로: `app.getPath('userData')/settings.json` (`AppData/Roaming/endfield-map-overlay/`)
  - `load()`, `get(key)`, `set(key, value)` API
  - 기본값: opacity 1.0, mapUrl endfieldtools.dev
- `main.js` 통합 — 시작 시 설정 로드, 투명도/맵 URL 변경 시 자동 저장
- `map-view.js` 수정 — `createMapView(parentWindow, initialUrl)` 파라미터 추가
- 맵 로드 후 저장된 투명도 자동 적용 + 컨트롤 바 슬라이더 동기화
- **테스트 결과**: 투명도 44%로 설정 → 종료 → 재시작 시 44% 복원 확인

### Phase 7: 빌드 (완료)
- `electron-builder` v26.7.0 devDependency 추가
- `package.json`에 `build` 설정 추가:
  - `appId`: `dev.endfield.map-overlay`
  - `productName`: `Endfield Map Overlay`
  - `win.target`: `portable` (설치 불필요한 단일 .exe)
  - `portable.artifactName`: `EndfieldMapOverlay.exe`
  - `files`: main.js, src/, renderer/, assets/, koffi만 포함 (불필요한 node_modules 제외)
  - `asarUnpack`: koffi의 `.node` 네이티브 바이너리를 asar 밖으로 추출
- `assets/icon.ico`를 256x256으로 재생성 (electron-builder 최소 요구사항)
- winCodeSign symlink 이슈 해결 (Windows 11에서 darwin dylib symlink 생성 권한 부족 → 수동 캐시 추출)
- **빌드 결과**: `dist/EndfieldMapOverlay.exe` (약 82MB, 포터블)

## 현재 파일 구조
```
D:\claude\endfield-overlay\
├── package.json
├── package-lock.json
├── main.js
├── node_modules/
├── renderer/
│   ├── index.html
│   ├── styles.css
│   ├── renderer.js
│   └── preload.js
├── src/
│   ├── hotkey.js
│   ├── ipc-handlers.js
│   ├── game-window.js
│   ├── map-view.js
│   ├── store.js
│   └── tray.js
└── assets/
    └── icon.ico
```

## 기술 메모
- Electron BaseWindow 사용 (BrowserWindow 대신) — webContents 없이 WebContentsView만으로 구성
- BaseWindow 옵션: `transparent: true`, `frame: false`, `alwaysOnTop: 'screen-saver'`
- `roundedCorners: false` → Windows 11 시각 글리치 방지
- 맵 임베드: WebContentsView 사용 (BrowserView는 deprecated, iframe은 X-Frame-Options 차단됨)
- 종료 시 `app.quit()`이 아닌 `app.exit(0)` 사용 — WebContentsView 자식 프로세스가 좀비로 남는 문제 해결
- `/interactive-map/`은 맵 선택 페이지, 실제 맵은 `/interactive-map/valley-iv/` 등 하위 경로
- 맵 소스: endfieldtools.dev (1순위), endfield.gg (2순위)
- 게임은 보더리스 윈도우 모드에서만 오버레이 가능
