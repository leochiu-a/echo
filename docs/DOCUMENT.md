# Echo 重構到 Electron：模組化 Checklist

更新日期：2026-02-12  
目標：在不遺失現有功能的前提下，將目前 Swift/macOS POC 重構為 Electron 架構，並保留可維護性與可測試性。

## 進度快照（2026-02-12）

已完成（本次重構落地）：
- Electron 三層架構：`src/main` / `src/preload` / `src/renderer`。
- Main services：`hotkey`、`overlay-window`、`dashboard-window`、`settings`、`history`、`usage`、`codex-runtime`。
- IPC contract（zod 驗證）與 preload 白名單 API。
- Overlay UX：基本模式切換、slash autocomplete、history 導覽、streaming/cancel、copy/replace/insert。
- Dashboard 四區：Home / History / Commands / Settings（含即時儲存）。
- Data layer：settings/history schema + retention + token summary。
- 測試：`Tests/unit` 已覆蓋 slash、prompt compose、error summary、history retention、settings normalization。
- 本地統一入口：`./scripts/dev-local.sh` 會優先跑 Electron。

尚未完成（需下一階段補強）：
- AX bridge 與跨 App replace/insert 仍為 macOS script bridge，尚未達到原生級穩定度。
- Packaging / signing / notarization / release pipeline 尚未建置。
- E2E 自動化（開面板 -> 執行 -> 串流 -> 停止 -> 套用）尚未補齊。

## 0. 參考資料
- [ ] UI/互動參考圖：[`image.png`](./image.png)（專案路徑：[`docs/image.png`](docs/image.png)）。
- [ ] 重構時每個主要 UI 決策需對照此參考圖，避免資訊層級與操作流程偏移。

---

## 1. 現況盤點（重構不可回歸）

### 1.1 目前核心能力（必須保留）
- [ ] 全域快捷鍵開關面板（預設 `Cmd+K`）。
- [ ] 面板在滑鼠附近開啟，並記住使用者拖曳後的位置偏好。
- [ ] 讀取前景 App 的選取文字（含可編輯判定）。
- [ ] Prompt 執行時串流顯示輸出，可中止。
- [ ] `Esc`：執行中為 Stop，未執行為關閉面板。
- [ ] `Enter` 送出、`Tab` 套用 slash suggestion、`↑/↓` 支援 history/slash 選單。
- [ ] 輸出可 Copy，並支援 Replace/Insert 回原本 App。
- [ ] Dashboard 有四區：Home/History/Commands/Settings。
- [ ] History 可保留與清除，含 retention policy。
- [ ] Commands 支援 slash template 與 `{{input}}` 插值。
- [ ] Settings 支援 model / reasoning effort / shortcuts。
- [ ] 啟動時 prewarm `codex app-server` session。

### 1.2 現行程式碼對照（用來做遷移追蹤）
- [ ] `Sources/Echo/Core/AppCoordinator.swift`：應用流程協調、notification glue。
- [ ] `Sources/Echo/HotKey/HotKeyManager.swift`：全域快捷鍵。
- [ ] `Sources/Echo/Overlay/OverlayPanelController.swift`：浮動面板、鍵盤監聽、貼上套用。
- [ ] `Sources/Echo/Core/AXContextManager.swift`：選取文字與可編輯判定。
- [ ] `Sources/Echo/Overlay/InlinePromptViewModel.swift`：執行流程、history、slash、錯誤摘要。
- [ ] `Sources/Echo/CLI/AppServerRunner.swift`：app-server session + JSON-RPC + 串流 + timeout/cancel。
- [ ] `Sources/Echo/Core/AppSettingsStore.swift`：設定與 shortcut/slash commands 儲存。
- [ ] `Sources/Echo/Core/PromptHistoryStore.swift`：history、retention、token summary。
- [ ] `Sources/Echo/Dashboard/**`：Dashboard UI 與 usage。

---

## 2. 目標架構（Electron）

- [ ] 採三層：`main`（system/OS 能力）、`preload`（安全 IPC）、`renderer`（UI）。
- [ ] 以功能切 service：`hotkey`、`overlay-window`、`ax-context`、`codex-runtime`、`settings`、`history`、`usage`。
- [ ] 所有 renderer 不直接碰 Node/OS API，只走 preload 暴露的白名單 API。
- [ ] IPC contract 先定義型別（建議 zod/typebox）再實作，避免邊做邊漂移。

---

## 3. 模組 Checklist

## Module A: App Shell（Main Process）
- [ ] 初始化 Electron app lifecycle 與單例鎖（single instance lock）。
- [ ] 建立兩個視窗模型：`overlayWindow`（無框、浮動）與 `dashboardWindow`（主 UI）。
- [ ] 建立 window state manager（位置、尺寸、可見性）。
- [ ] 實作 app-level coordinator（取代 `AppCoordinator`）。
- [ ] 建立通知/事件總線（可用 typed event emitter）。
- [ ] 啟動後 prewarm codex session（非阻塞）。

DoD
- [ ] 不開啟 dashboard 時，僅靠快捷鍵可完整工作。
- [ ] overlay 可在多次開關後保持穩定，不殘留 ghost window。

## Module B: 平台整合（Global Shortcut / AX / 貼上）
- [ ] 使用 `globalShortcut` 實作快捷鍵註冊與變更重綁。
- [ ] 讀取前景 App 與滑鼠座標，計算 overlay 開啟位置。
- [ ] 實作 AX context bridge（macOS 專用）：取得 selected text + editable flag。
- [ ] 實作 apply-output bridge：replace/insert 回前景 App（需處理 focus restore）。
- [ ] 將平台特有能力隔離在 `platform/macos/*`，避免污染 cross-platform 層。
- [ ] 權限流程：Accessibility 未授權時有可理解提示與 fallback。

DoD
- [ ] `Cmd+K` 開啟後可正確帶入選取文字。
- [ ] Replace/Insert 成功率符合現行 Swift 版本。
- [ ] 權限缺失時不 crash，且可引導使用者修復。

## Module C: Codex Runtime（app-server session）
- [ ] 抽象 `CodexRuntime` 介面：`prewarm`、`run`、`cancel`、`reset`。
- [ ] `spawn("codex app-server")` 並維持單 session 重用。
- [ ] JSON-RPC client：request/notification、request id 管理、pending map。
- [ ] turn 串流事件處理：delta、completed、token usage、error。
- [ ] timeout/cancel 流程與 session reset。
- [ ] stderr snapshot + error summary（保留目前錯誤摘要策略）。
- [ ] prompt compose 規則（edit/question + selected text）完整搬移。

DoD
- [ ] 串流輸出行為與 Swift 版一致。
- [ ] cancel/timeout 後可再次執行，不需重啟 app。
- [ ] model/reasoning 變更可即時生效。

## Module D: Overlay Renderer（Prompt UX）
- [ ] 重建輸入區、輸出區、模式切換（Edit Selection / Ask Question）。
- [ ] 保留 slash autocomplete 與鍵盤操作（Tab/Up/Down/Enter）。
- [ ] 保留 command history 導覽。
- [ ] 保留 copy feedback 與 replace/insert action button 顯示條件。
- [ ] 保留執行中狀態（spinner + stop）。
- [ ] 將 ViewModel 抽成可測試純邏輯（避免 UI state 與 domain state 混雜）。

DoD
- [ ] 快捷鍵體驗、快捷操作、錯誤顯示與 Swift 版等價。
- [ ] 輸入法組字期間不誤觸快捷行為。

## Module E: Dashboard Renderer（Home / History / Commands / Settings）
- [ ] Home：token summary + monthly usage。
- [ ] History：列表、刪除、清空、retention policy、response 詳細檢視。
- [ ] Commands：slash command CRUD、`{{input}}` 說明。
- [ ] Settings：model、reasoning、三組快捷鍵設定。
- [ ] 儲存成功回饋與錯誤提示。

DoD
- [ ] Dashboard 每一區都能單獨開發與測試（路由/元件分離）。
- [ ] 所有設定變更可即時反映到 main process 行為（尤其快捷鍵）。

## Module F: Data Layer（Settings / History / Migration）
- [ ] 定義統一 schema 與版本號（settings/history/slashCommands）。
- [ ] 實作儲存層（可用 `electron-store` 或 SQLite；二擇一先落地）。
- [ ] 實作 migration（舊 key/舊值正規化）。
- [ ] history retention 定時或讀取時清理策略。
- [ ] response 長度上限與 token 欄位正規化。

DoD
- [ ] 重啟後資料一致。
- [ ] schema 升級不破壞舊資料。

## Module G: Security / Packaging / Release
- [ ] 啟用 `contextIsolation: true`、`nodeIntegration: false`。
- [ ] preload 僅暴露最小必要 API，IPC channel 全白名單。
- [ ] child process 命令參數固定化，避免命令注入。
- [ ] macOS signing/notarization 與 Accessibility 權限說明文件。
- [ ] 發版流程（dev/staging/prod）與 crash log 收集方案。

DoD
- [ ] 通過基本安全檢查（無 renderer 直接 Node 權限）。
- [ ] 打包後可在目標機器安裝並正常取得權限。

## Module H: Testing / QA / Observability
- [ ] 單元測試先覆蓋純邏輯：slash resolve、error summary、prompt compose、history retention。
- [ ] main process service 測試：IPC contract、runtime 狀態機、shortcut rebind。
- [ ] E2E 測試腳本：開啟面板 -> 執行 -> 串流 -> 停止 -> 套用輸出。
- [ ] 手動驗收清單（含 Accessibility 未授權、codex 未登入、CLI 不存在）。
- [ ] 事件與錯誤 logging（可追 session id / turn id）。
- [ ] 建立本地快速測試入口腳本：`scripts/dev-local.sh`（行為比照 `scripts/dev.sh`，但優先跑 Electron）。

DoD
- [ ] 每次重構 PR 都能跑過最小回歸測試集合。
- [ ] 高風險流程（串流、取消、貼上）有自動化或明確手測腳本。
- [ ] 本地開發者只需一條命令即可啟動測試流程：`./scripts/dev-local.sh`。

---

## 4. 建議重構順序（最快可落地）

### Phase 1: Runtime First（先通核心）
- [ ] 完成 Module A + C 最小可用版（無完整 UI 先可跑）。
- [ ] 用簡單 debug window 驗證 run/stream/cancel/reset。

### Phase 2: Overlay MVP
- [ ] 完成 Module B + D（可從任意 App 呼叫、帶 selection、跑 prompt）。
- [ ] 驗證 replace/insert 與 focus restore。

### Phase 3: Dashboard + Data
- [ ] 完成 Module E + F。
- [ ] 將 settings/history/slash command 全數接上。

### Phase 4: Hardening
- [ ] 完成 Module G + H。
- [ ] 補齊打包、權限文件、回歸測試與 release checklist。

---

## 5. 風險清單（優先處理）

- [ ] AX 能力在 Electron 無內建等價 API，需 macOS bridge（原生模組或外部 helper）。
- [ ] 全域快捷鍵與輸入法組字事件容易互相影響，需先定義行為優先級。
- [ ] app-server 長連線若處理不當會有 zombie process / pipe 卡死。
- [ ] 輸出套用（replace/insert）是最脆弱跨 App 行為，需高密度手測。
- [ ] 若先做 UI 再做 runtime，會造成大量返工；應先打通 runtime/state。

---

## 6. 完成定義（整體）

- [ ] 功能等價：與 Swift POC 核心行為一致。
- [ ] 架構清晰：main/preload/renderer 邊界明確，無跨層偷接。
- [ ] 可維護：關鍵 domain 規則（slash、prompt compose、history retention）有測試。
- [ ] 可發版：安裝、權限、更新、錯誤追蹤流程完整。

---

## 7. 本地快速測試方式

- [ ] 使用 `./scripts/dev-local.sh` 作為統一入口。
- [ ] 若 Electron 專案已初始化（存在 `package.json` 且有 `scripts.dev`），執行 `npm run dev`。
- [ ] 若 Electron 尚未初始化，fallback 到既有 Swift 流程 `./scripts/dev.sh`。
