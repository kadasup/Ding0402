# 🍱 自由543：AI 菜單辨識故障排除指南 (Memo)

如果未來 AI 辨識失效，請先檢查以下三大檢查點，並直接將本文件提供給 AI 助理。

## 1. GAS 權限問題 (最常見)
**症狀：** 診斷資料顯示 `Exception: 你沒有呼叫「UrlFetchApp.fetch」的權限`。
**解決：** 
- 在 GAS 編輯器選取 `authTrigger` 函式並點擊 **「執行」**。
- 完成彈窗內的 Google 帳號授權。

## 2. 部署版本未更新
**症狀：** 程式碼改了但行為沒變，或是 API 一直回傳舊的格式。
**解決：** 
- 每次修改 `gas_code.gs` 後，必須：**「管理部署」** -> **「編輯」** -> **「新版本」** -> **「部署」**。

## 3. Azure 端點與金鑰設定
**屬性名稱：**
- `AZURE_ENDPOINT`: 必須是完整包含 `openai/deployments/.../chat/completions?api-version=...` 的網址。
- `AZURE_API_KEY`: Azure 提供之 API 金鑰。
**檢查：** 進入 GAS 的「專案設定」->「指令碼屬性」確認內容無誤。

## 4. 圖片限制
- 圖片最大寬度建議維持在 **1000px**，JPEG 品質 **0.85**。
- 超過此限制可能導致 Google Apps Script 的 Payload 過大而請求失敗。

---
*Last Updated: 2026-04-04*