# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案名稱
Ding0402（自由543 訂便當系統）

## 對話開始時請先讀
進度與最近更動都在 Obsidian：`創作庫/Ding0402/Ding0402-工作筆記.md`

## 專案速覽
- **前端**：React 19 + Vite 7 + react-router，動物森友會風格自訂 CSS，程式在 `src/`（`pages/Home.jsx` 前台、`pages/Admin.jsx` 後台、`context/DingContext.jsx` 狀態）
- **後端**：Google Apps Script 單檔 `gas_code.gs`，用 clasp 管理；資料庫是 Google Sheets
- **通知**：LINE Messaging API Flex 卡片（上架／下架／結單摘要），範本在 `line_flex_*.json`
- **AI 辨識**：菜單照片 OCR 由 GAS 轉發 Azure OpenAI，金鑰只放 GAS Script Properties，前端不碰
- **線上網址**：https://kadasup.github.io/Ding0402/（`.github/workflows/deploy.yml` 自動部署，push `main` 即上線）
- **常用指令**：`npm run dev`／`npm run build`／`npm run lint`
- **規劃文件**：`OPTIMIZATION_PLAN.md`（四階段優化路線圖）、`DEPLOY_GAS.md`（GAS 部署 SOP）、`AI_MEMO.md`（AI 辨識故障排除）

## 🕳️ 已知地雷（動工前必讀）
- **Pages 的 Source 必須維持 GitHub Actions**。改成「Deploy from a branch」會把未編譯原始碼當網站，整頁白畫面（2026-07-22 踩過）。
- **repo 轉 private 會讓 Pages 直接下架**。要暫時關站用 Pages 的 Unpublish site，不要動 repo 可見性或部署來源（2026-07-22 踩過）。
- `vite.config.js` 的 `base: './'` 是正確設定，不要改。
- **改 GAS 前必讀 `DEPLOY_GAS.md`**：`appsscript.json` 必須有 `webapp` 區塊且要進 git；`clasp push` 只更新程式碼不會上線，要 `clasp deploy -i <既有 deployment ID>` 原地升版；不帶 `-i` 會產生新 URL，`.env` 與 LINE webhook 全要換（2026-05-19 踩過）。
- 永遠不要在 GAS 介面刪除生產部署或改變部署類型，URL 會永久消失救不回。
- AI 辨識失效的排查順序見 `AI_MEMO.md`：GAS 權限 → 部署版本 → Azure 金鑰 → 圖片大小。

## 工作模式
- **結束工作**：說「收工」→ 自動 commit + push + 更新 Obsidian 工作筆記
- **接續工作**：說「開工」→ 讀工作筆記、報告 git 狀態、建議下一步

## 三個家
- 📋 本機：`~/Desktop/Claude/Ding0402/`
- 🐙 GitHub：https://github.com/kadasup/Ding0402（public）
- 📘 Obsidian：`創作庫/Ding0402/Ding0402-工作筆記.md`
