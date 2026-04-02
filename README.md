# Ding 訂便當系統 (GAS 雲端版) 🍱🍃

這是一個使用 React + Vite 建置的前端訂餐網頁，搭配 **Google Sheets (試算表) + Google Apps Script** 作為後端資料庫。

## 🌟 專案架構

*   **前端 (Frontend)**: React, Vite, Tailwind-like CSS (Animal Crossing Theme).
*   **後端 (Backend)**: Google Apps Script (GAS).
*   **資料庫 (Database)**: Google Sheets (自動儲存訂單、菜單、會員資料).

所有的資料都會即時同步到 Google 雲端試算表，無需架設傳統伺服器，永久免費且資料透明。

---

## � 快速啟動

1.  **安裝依賴**:
    ```bash
    npm install
    ```

2.  **啟動網頁**:
    ```bash
    npm run dev
    ```
    前往 `http://localhost:5173` 即可開始點餐。

---

## ☁️ 後端維護指南 (Google Apps Script)

本專案目前已連接至雲端 GAS 專案。
若您需要修改後端邏輯 (例如新增欄位、修改計費方式)，請參考專案中的與原始碼檔案：

*   **後端原始碼**: `./gas_code.gs`
*   **如何更新後端**:
    1.  開啟您的 Google Sheet 關聯的 Apps Script 專案。
    2.  將 `gas_code.gs` 的內容複製並覆蓋原本的程式碼。
    3.  **重要**: 每次修改程式碼後，必須點擊「部署」->「管理部署」->「編輯」-> **建立新版本** -> 部署。網址才會更新生效。

---

## 🌍 GitHub Pages 佈署

此專案已設定好可以一鍵佈署到 GitHub Pages。

**使用 gh-pages 佈署**:

1.  確認 `vite.config.js` 中已有 `base: './'` (已設定)。
2.  執行佈署指令：
    ```bash
    npm run deploy
    ```
    *(需先安裝 gh-pages: `npm install gh-pages --save-dev`)*

---
*無人島生活 © 2024*
