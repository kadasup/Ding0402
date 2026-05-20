# GAS Web App 部署 — 注意事項摘要

> 2026-05-20 整理。這份的目的是避免再次發生「前端讀取資料失敗 / `/exec` 回 404」這類部署事故。

---

## 🛑 修改 GAS 前必須遵守的判定（Pre-flight Checklist）

**每次要動 `gas_code.gs` / `appsscript.json` / 跑 `clasp` 之前，逐條檢查：**

- [ ] **① `appsscript.json` 有 `webapp` 區塊？**
  - 沒有就補上（`executeAs: "USER_DEPLOYING"` + `access: "ANYONE_ANONYMOUS"`），不然 push 後 `/exec` 馬上 404。

- [ ] **② 我要的是「改程式」還是「換 URL」？**
  - **改程式（99% 的情況）**：用 `clasp deploy -i <現有 DEPLOYMENT_ID>` 原地升版，URL 不變。
  - **換 URL（極少情況，例如重建專案）**：才用 `clasp deploy`（不帶 `-i`），事後**必須同步更新** `.env` + LINE webhook + 任何寫死的舊網址。

- [ ] **③ 絕對不在 GAS 介面動「類型」**
  - 不要把 Web App 類型改成資料庫 / API 執行檔，會立刻 404 且救不回原 URL。

- [ ] **④ 絕對不刪除生產用的 Web App 部署**
  - 一刪 URL 就永久消失，前端必須換 `.env`。

- [ ] **⑤ Push 後一定要驗證**
  - `curl "<VITE_GAS_URL>?action=ping"` 回 200 + JSON 才算成功，不要只看 clasp 沒報錯。

- [ ] **⑥ `appsscript.json` 要進 git，不能 ignore**
  - 它是 manifest 的單一事實來源，本地少設定 → push 後就少設定。

---

## 今天踩到的雷（按嚴重度排序）

### 1. `appsscript.json` 一定要有 `webapp` 區塊
**沒有的話 `clasp push` 之後，所有 Web App 部署的 `/exec` 都會回 404。**

正確內容：
```json
{
  "timeZone": "Asia/Taipei",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

這個檔案**必須進 git**，不能 ignore。`clasp push` 會把本地 manifest 整個覆蓋到 GAS 上。

### 2. `clasp push` ≠ 部署生效
- `clasp push`：**只更新 GAS 編輯器的程式碼**，不影響線上 Web App。
- 線上 `/exec` 拿到的版本是 **部署版本** 鎖定的那個 snapshot，不是 HEAD。
- **要讓改動生效**，必須額外做：升版（新版本）或重新部署。

### 3. 不要按「新增部署作業」改程式碼
- 「新增部署作業」會給你 **新的 deployment ID + 新的 URL**，`.env` 那條會繼續用舊的（可能空的）版本。
- 要原地升版用 **「管理部署作業 → 編輯 → 版本：新版本 → 部署」**，URL 不變。

### 4. CLI 對應原地升版的指令
```bash
clasp deploy -i <DEPLOYMENT_ID> -d "說明"
```
- 必須帶 `-i`，否則 clasp 預設**建新部署**。
- 這次救回 URL 就是用 `clasp deploy -i AKfyc...BmvwC`。

---

## SOP — 改 GAS 程式碼的標準流程

```bash
# 1. 改 gas_code.gs（或 appsscript.json）
# 2. push 上去
clasp push

# 3. 原地升版（同一條 /exec URL，前端不用改 .env）
clasp deploy -i AKfycbwEXQQ82oQUnytE0Z4xyVBoieXLm27VwYiCEgJdhwLsTgiOKKP9so9U7fl5ZgxBmvwc -d "說明"

# 4. 驗證
curl "https://script.google.com/macros/s/AKfycbwEXQQ82oQUnytE0Z4xyVBoieXLm27VwYiCEgJdhwLsTgiOKKP9so9U7fl5ZgxBmvwc/exec?action=ping"
# 預期：{"success":true,"version":"...",...}
```

---

## 永遠不要做

| 動作 | 後果 |
|---|---|
| 在「管理部署作業」**刪掉** Web App 部署 | URL 永久消失，沒救 |
| **改類型**（Web App ↔ 資料庫 ↔ API 執行檔） | `/exec` 立刻 404 |
| 從 `appsscript.json` 拿掉 `webapp` 區塊 | 下次 push 就掛 |
| `clasp deploy` 不帶 `-i` | 拿到新 URL，`.env` 跟 LINE webhook 全要換 |

---

## 出事時的快速診斷

**症狀：前端「讀取資料失敗」**

```bash
# 1. 直接打 ping endpoint，看 GAS 是否活著
curl "<VITE_GAS_URL>?action=ping"

# 200 + JSON  → 後端正常，看前端
# 404 「找不到網頁」 → Web App 部署掛了（最可能是 appsscript.json 沒 webapp）
# 401/403 → 部署存取權限不是「所有人」
# 502/503 → GAS 服務出問題或腳本 crash，去 GAS 編輯器看「執行記錄」
```

**修 404 的順序：**
1. 確認 `appsscript.json` 有 `webapp` 區塊 → 沒有就補
2. `clasp push`
3. `clasp deploy -i <原 deployment ID>`
4. 再 ping

---

## 重要 ID 速查（這個專案）

| 項目 | 值 |
|---|---|
| Script ID | `12EDUFUqU-bSez6diEc0OcSvCPIwokvb21FUPUKks__l63t2sp-Zq3e5_` |
| Web App Deployment ID（前端用的） | `AKfycbwEXQQ82oQUnytE0Z4xyVBoieXLm27VwYiCEgJdhwLsTgiOKKP9so9U7fl5ZgxBmvwc` |
| Web App URL | `https://script.google.com/macros/s/AKfycbwEXQQ82oQUnytE0Z4xyVBoieXLm27VwYiCEgJdhwLsTgiOKKP9so9U7fl5ZgxBmvwc/exec` |
| 設定檔位置 | `.clasp.json` / `.env` |

---

## 事件記錄

- **2026-05-19**：初始化 clasp（commit `6671a76`）。當時 `appsscript.json` 沒有 `webapp` 區塊，`clasp push` 把 GAS 線上的 manifest 蓋掉，導致所有 Web App 部署的 `/exec` 開始 404，前端「讀取資料失敗」。
- **2026-05-20**：補上 `webapp` 設定（commit `9767ccc`），用 `clasp deploy -i` 原地升到 @92，URL 不變、前端恢復正常。
