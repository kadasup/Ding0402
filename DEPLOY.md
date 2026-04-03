# 🚀 「自由543」發佈建議與高安全性架構 (GitHub + GAS)

這套系統現在已升級為 **「高安全性架構」**。您的 AI 辨識金鑰將不再暴露於前端瀏覽器中，而是安全地保存在 Google 雲端後端。

## 🏗️ 最終推薦架構

- **前端 (Web App)**: **GitHub Pages** (免費發佈)。
- **後端與安全代理 (Backend & Proxy)**: **Google Apps Script (GAS)**。
  - **OCR 辨識轉發**：前端呼叫 GAS，GAS 帶上金鑰後轉發給 Azure。金鑰絕不流向用戶端。
- **資料庫**: **Google Sheets**。

---

## 🛠️ 第一步：更新 Google Apps Script (GAS)

請將以下程式碼片段加入到您的 Google Apps Script 專案中（通常在 `doPost` 函式內部的 `switch` 區塊）：

```javascript
/* GAS 專用：OCR 辨識轉發邏輯 */
case 'ocrMenu':
  const azureKey = PropertiesService.getScriptProperties().getProperty('AZURE_API_KEY');
  const azureEndpoint = PropertiesService.getScriptProperties().getProperty('AZURE_ENDPOINT');
  
  const payload = {
    messages: [{ role: "user", content: [
      { type: "text", text: "Please analyze this menu image. \n1. Extract items/prices as 'items'(array). \n2. Extract 'storeInfo'(object). \n3. Extract 'remark'(string). \nReturn ONLY raw JSON." },
      { type: "image_url", image_url: { url: params.image } }
    ]}],
    max_completion_tokens: 1000
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'api-key': azureKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const resp = UrlFetchApp.fetch(azureEndpoint, options);
  const respText = resp.getContentText();
  const respJson = JSON.parse(respText);
  
  if (respJson.error) {
    return ContentService.createTextOutput(JSON.stringify({ error: respJson.error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  let ocrContent = respJson.choices[0].message.content;
  ocrContent = ocrContent.replace(/```json/g, '').replace(/```/g, '').trim();
  return ContentService.createTextOutput(ocrContent).setMimeType(ContentService.MimeType.JSON);
```

### 🔐 存放金鑰 (非常重要)：
1. 在 GAS 編輯器左側點擊 **專案設定 (Project Settings, 小齒輪圖示)**。
2. 滾動到 **指令碼屬性 (Script Properties)**。
3. 新增兩個屬性：
   - `AZURE_API_KEY`: 您的 API 金鑰。
   - `AZURE_ENDPOINT`: 您的 Azure 終端網址。

---

## 🛠️ 第二步：GitHub Pages 發佈

1. **上傳程式碼**：將此專案推送到 GitHub。
2. **設定 Base**：確保 `vite.config.js` 內容如下（我已為您設定好）：
   ```javascript
   export default defineConfig({
     plugins: [react()],
     base: './', // 關鍵：確保 GitHub Pages 正確解析路徑
   })
   ```
3. **自動發佈**：
   - 前往 GitHub 專案的 `Settings` -> `Pages`。
   - 在 `Build and deployment` -> `Source` 選擇 **GitHub Actions**。
   - GitHub 會自動偵測 Vite 專案並啟動部署。

---

## 🛡️ 安全總結
- **公開代碼無風險**：您的 GitHub 代碼現在不含任何 API 金鑰。
- **後端保護**：金鑰存放在 Google 的 Script Properties 中，只有您能存取。
- **零成本運行**：GitHub Pages 與 GAS 均為免費額度，非常適合小型團隊使用。

祝您的「自由543」訂餐系統順利上線！🚀
