# Ding 全面優化總路線圖

## Summary
這份規劃整理成單一整合版 `OPTIMIZATION_PLAN.md`，涵蓋前台、後台、GAS、LINE 通知、資料治理、測試與部署維護，不再只聚焦單點優化。整體採四階段推進：先止血穩定、再整理結構、接著補使用體驗與效能，最後才做監控與可持續維護。預設原則是「不先改外部行為、不先改資料表 schema、先降低未來修改成本」。

## Key Changes

### Phase 1: 穩定化與風險收斂
- GAS 先做責任拆分：`request routing`、`sheet helpers`、`menu/order/member handlers`、`LINE builders`、`notification senders`、`OCR/upload helpers` 以區段常數與明確命名整理，維持單檔部署但邏輯模組化。
- 統一所有 fallback 文案與預設值來源，移除散落的亂碼預設字串，改由單一常數區集中管理。
- `updateMenu` 的資料寫入成功與 LINE 發送成功分離回報，主流程以資料寫入結果為準，通知失敗只回傳附加狀態，不阻塞上架與結單。
- 前台與後台隱藏中的公告功能進一步降耦合：UI 不顯示、fetch 不主動依賴、標題 fallback 不再引用公告內容，但保留資料層 API 以便日後恢復。
- `menu.lastUpdated`、`orders.menuId`、本輪訂單判定規則明文化，避免結單核對卡、本輪已點、清單清除三邊各自解讀。

### Phase 2: 前台與後台結構整理
- `DingContext` 由單一大型 provider 拆成內部責任模組：`fetch/caching`、`menu actions`、`orders actions`、`library actions`、`session/member actions`、`ui feedback`，對外維持同一組 `actions` 介面。
- `fetchData` 的 section 載入策略固定化：`core` 為啟動必需，`orders`、`library`、`history`、`uploadStatus`、`debug` 依頁面需求延遲載入，並明確定義 cache 命中與 refresh 覆蓋邏輯。
- `Home.jsx` 拆成可維護區塊：成員選擇、菜單區、本輪訂單區、購物車與提交區、引導與輔助 UI；主頁僅負責串資料與區塊排序。
- `Admin.jsx` 拆成可維護區塊：今日菜單、菜單庫、成員管理、統計、系統設定；將目前大型條件渲染與內聯邏輯收斂到子元件。
- 共同規則抽到工具層：樓層判定、日期 key、金額加總、品項摘要、角色顯示權限、前台 focus/query 組裝，避免前後台與 GAS 各自維護一份。

### Phase 3: 體驗、效能與資料治理
- 前台下單流程由現在的樂觀更新改成明確雙狀態：`提交中`、`成功已同步`、`失敗已回滾`，避免背景失敗時使用者誤以為已下單完成。
- 後台菜單庫補齊大資料量情境：搜尋、篩選、收藏、首屏骨架與延遲載入維持一致，避免 library 首次載入時卡頓或狀態跳動。
- localStorage cache 政策統一：每種 cache 都有 `savedAt`、`scope/menuId/dateKey`、`maxAge`、`invalidate` 規則，並定義何時只補 UI、何時必須重抓後端。
- GAS 的 Sheet I/O 做保守優化：集中資料列定位、減少重複 `getDataRange()` 讀取、明確處理空表、缺欄、舊欄位相容，避免功能增長後讀寫成本快速上升。
- OCR 與圖片上傳流程補防呆：統一大小限制、錯誤訊息格式、重試邏輯與失敗紀錄，避免「看起來有送出但其實沒成功」的灰色地帶。

### Phase 4: 通知、測試與維運
- LINE 通知擴成完整矩陣：`publish`、`unpublish`、`close summary` 都要有 builder、preview、test payload 與統一送出器；未來若加入提醒類卡片也沿用同格式。
- 結單核對卡規格固定：每樓層一張 bubble、超過顯示上限時退化成摘要、按鈕 deep link 統一路徑、`餐點有誤` 保留 webhook 擴充位。
- 建立最小可行測試面：前端至少有關鍵純函式與資料轉換測試，GAS 至少有可手動驗證的 action checklist，避免每次改動都靠人工全站點一遍。
- 補一份維運文件：部署順序、Script Properties 必填值、LINE 測試步驟、常見錯誤排查、回滾方式，降低未來你自己或其他協作者接手成本。
- 建立版本化變更紀錄策略：每次調整 `GAS API`、`快取規則`、`通知文案`、`Sheet 欄位相容性` 時同步記錄，避免功能雖然能跑但知識只留在對話裡。

## Public APIs / Interfaces
- 前端對 `DingContext` 外部使用方式預設保持不變，但內部拆模組；若新增 helper，優先新增不破壞舊呼叫的包裝層。
- GAS action 名稱預設不改，但回傳 envelope 逐步標準化為 `success / error / meta / sideEffects` 類型，至少先讓 `updateMenu`、`uploadImage`、LINE test actions 一致。
- `linePreviewPayload` 建議擴充支援 `closeSummary` 模式，讓三種 LINE 卡都能從同一路徑預覽。
- 深連結規則統一保留 `focus=current-round`，後續若需要更多前台定位只採 query 擴充，不混用 hash 與多種命名。
- `OPTIMIZATION_PLAN.md` 作為專案內正式規劃文件，內容以分階段 roadmap 為主，不寫成零散會議筆記。

## Test Plan

### GAS
- `getMenu`
- `updateMenu`
- `addOrder`
- `removeOrder`
- `clearTodayOrders`
- `uploadImage`
- `linePreviewPayload`
- 三種 LINE test action 都需人工 checklist 驗證

### 前台
- 首次載入
- 記憶角色登入
- 樓層切換
- 加入購物車
- 重複本輪下單警示
- 刪單
- LINE 深連結導向
- 本輪已點顯示正確

### 後台
- 今日菜單編輯
- 上架
- 結單
- 菜單庫首載
- 菜單庫更新、收藏、刪除
- 成員新增、刪改
- 系統設定讀取

### 相容性
- 無公告顯示狀態下前後台都正常
- 舊資料列缺欄位時不崩潰
- 空訂單、空菜單、空菜單庫都能正常渲染

### 通知
- `publish`、`unpublish`、`close summary` 三種卡片文案、按鈕、顏色、altText、deep link、message action 都符合目前規格

## Assumptions
- 目前優先順序改為「把所有建議整合成總路線圖」，不是做多套互斥方案。
- 近期不更動 Google Sheet schema；若未來要正規化欄位，會列為第二階段之後的獨立決策。
- 公告功能維持隱藏但不刪資料層。
- React/Vite 架構、GAS 單檔部署、LINE Messaging API 架構都維持現狀。
- 這份內容的目標落檔位置是 repo root 的 `OPTIMIZATION_PLAN.md`。

