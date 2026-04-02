/**
 * ===================================================
 * 將以下程式碼新增到你的 Google Apps Script (GAS) 專案中
 * ===================================================
 * 
 * 步驟：
 * 1. 在你的 GAS doPost(e) 函式的 switch/case 中新增 'uploadImage' case
 * 2. 新加 uploadImageToDrive() 函式
 * 3. 重新部署 Web App（版本號要更新）
 */

// === 在 doPost(e) 的 switch(action) 中加入這段 ===
/*
case 'uploadImage':
  var result = uploadImageToDrive(payload.imageData, payload.fileName);
  // 注意: 由於前端用 no-cors，無法直接讀取回應
  // 所以圖片上傳改用 doGet 路由（見下方）
  break;
*/

// === 新增以下函式 ===

/**
 * 將 Base64 圖片上傳到 Google Drive 並回傳公開 URL
 * @param {string} base64Data - Base64 編碼的圖片資料 (含 data:image/jpeg;base64, 前綴)
 * @param {string} fileName - 檔案名稱
 * @returns {Object} { success: boolean, url: string }
 */
function uploadImageToDrive(base64Data, fileName) {
  try {
    // 取得或建立 "DingMenuImages" 資料夾
    var folderName = 'DingMenuImages';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    
    // 移除 Base64 前綴 (data:image/jpeg;base64,)
    var cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    
    // 解碼並建立 Blob
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, 'image/jpeg', fileName || 'menu_' + Date.now() + '.jpg');
    
    // 上傳到 Drive
    var file = folder.createFile(blob);
    
    // 設定公開可檢視
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    // 回傳可直接嵌入的 URL
    var fileId = file.getId();
    var url = 'https://lh3.googleusercontent.com/d/' + fileId;
    
    return { success: true, url: url, fileId: fileId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// === 修改你的 doGet(e) 函式，加入圖片上傳路由 ===
// 在你現有的 doGet(e) 函式中，加入以下判斷：
/*
function doGet(e) {
  var action = e.parameter.action;
  
  // 新增: 圖片上傳路由
  if (action === 'uploadImage') {
    var imageData = e.parameter.imageData;
    var fileName = e.parameter.fileName || 'menu_' + Date.now() + '.jpg';
    var result = uploadImageToDrive(imageData, fileName);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // 原本的 doGet 邏輯（讀取資料）
  // ... 你現有的程式碼 ...
}
*/

// ===================================================
// 但因為 GET 有 URL 長度限制（~2000 字元），Base64 圖片太大
// 所以最佳方案是修改 doPost 讓它回傳 JSON：
// ===================================================

/*
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action;
  var payload = body.data || {};
  
  // ... 你現有的 switch cases ...
  
  // 新增圖片上傳 case:
  if (action === 'uploadImage') {
    var result = uploadImageToDrive(payload.imageData, payload.fileName);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // 其他 action 保持原樣...
  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
*/
