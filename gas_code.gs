/* 
  Ding 訂便當系統 - Google Apps Script 後端程式碼 
  請將此程式碼複製到您的 GAS 專案中 (副檔名 .gs)
*/

// 定義試算表中的分頁名稱
const SHEET_NAMES = {
  ORDERS: 'Orders',
  MEMBERS: 'Members',
  MENU: 'Menu',
  MENU_HISTORY: 'MenuHistory',
  MENU_LIBRARY: 'MenuLibrary', // 菜單庫 (含分類、最愛)
  SYSTEM: 'System' // 存放公告等設定
};

// ==========================================
// 圖片上傳至 Google Drive 輔助函式
// ==========================================

/**
 * 將 Base64 圖片上傳到 Google Drive 並回傳公開 URL
 */
function uploadImageToDrive(base64Data, fileName) {
  try {
    var folderName = 'DingMenuImages';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    
    // 移除 Base64 前綴 (data:image/jpeg;base64,...)
    var cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, 'image/jpeg', fileName || 'menu_' + Date.now() + '.jpg');
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    // lh3 格式 URL，可直接嵌入 <img> 使用
    var fileId = file.getId();
    var url = 'https://lh3.googleusercontent.com/d/' + fileId;
    
    Logger.log('Image uploaded to Drive: ' + url);
    return url;
  } catch (err) {
    Logger.log('Image upload error: ' + err.message);
    return base64Data; // 失敗時保留原始 base64
  }
}

/**
 * 自動偵測 Base64 圖片並轉換為 Drive URL
 * 如果已經是 URL，直接回傳
 */
function processImageField(imageData, prefix) {
  if (!imageData) return '';
  
  // 已經是 URL，直接回傳
  if (typeof imageData === 'string' && imageData.startsWith('http')) return imageData;
  
  // Base64 格式 → 上傳到 Drive
  if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
    var fileName = (prefix || 'menu') + '_' + Date.now() + '.jpg';
    return uploadImageToDrive(imageData, fileName);
  }
  
  return imageData;
}

// ==========================================

// 1. 初始化 (如果試算表是空的，自動建立欄位)
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Orders Sheet
  let orderSheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
  if (!orderSheet) orderSheet = ss.insertSheet(SHEET_NAMES.ORDERS);
  if (orderSheet.getLastRow() < 1) {
    orderSheet.clear();
    orderSheet.appendRow(['ID', 'Member', 'ItemsJSON', 'Total', 'Date']);
  }

  // Members Sheet
  let memberSheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
  if (!memberSheet) memberSheet = ss.insertSheet(SHEET_NAMES.MEMBERS);
  if (memberSheet.getLastRow() < 2) {
    memberSheet.clear();
    memberSheet.appendRow(['Name']);
    memberSheet.appendRow(['aa']);
    memberSheet.appendRow(['bb']);
  }

  // Menu Sheet
  let menuSheet = ss.getSheetByName(SHEET_NAMES.MENU);
  if (!menuSheet) menuSheet = ss.insertSheet(SHEET_NAMES.MENU);
  if (menuSheet.getLastRow() < 2) {
    menuSheet.clear();
    menuSheet.appendRow(['JSON_Data', 'IsPosted', 'LastUpdated']);
    menuSheet.appendRow([JSON.stringify({ items: [], closingTime: '', image: '' }), 'FALSE', new Date().toISOString()]);
  }

  // Menu History Sheet
  let histSheet = ss.getSheetByName(SHEET_NAMES.MENU_HISTORY);
  if (!histSheet) histSheet = ss.insertSheet(SHEET_NAMES.MENU_HISTORY);
  if (histSheet.getLastRow() < 1) {
    histSheet.clear();
    histSheet.appendRow(['ID', 'Name', 'ItemsJSON', 'Image', 'Date', 'StoreInfoJSON']);
  }

  // Menu Library Sheet (菜單庫)
  let libSheet = ss.getSheetByName(SHEET_NAMES.MENU_LIBRARY);
  if (!libSheet) libSheet = ss.insertSheet(SHEET_NAMES.MENU_LIBRARY);
  if (libSheet.getLastRow() < 1) {
    libSheet.clear();
    libSheet.appendRow(['ID', 'Name', 'Category', 'StoreInfoJSON', 'ItemsJSON', 'Image', 'TagsJSON', 'IsFavorite', 'CreatedDate', 'UpdatedDate']);
  }

  // System Sheet
  let sysSheet = ss.getSheetByName(SHEET_NAMES.SYSTEM);
  if (!sysSheet) sysSheet = ss.insertSheet(SHEET_NAMES.SYSTEM);
  if (sysSheet.getLastRow() < 2) {
    sysSheet.clear();
    sysSheet.appendRow(['Key', 'Value']);
    sysSheet.appendRow(['announcement', '歡迎來到 Ding 訂便當系統 (GAS版)']);
  }
}

// 2. 處理 GET 請求 (讀取所有資料)
function doGet(e) {
  try {
    return ContentService.createTextOutput(JSON.stringify(getAllData()))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: error.toString(), 
      stack: error.stack,
      announcement: "系統發生錯誤，請檢查後端日誌" 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 3. 處理 POST 請求 (寫入資料)
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    let result = {};

    switch (action) {
      case 'placeOrder':
        result = addOrder(params.data);
        break;
      case 'updateMenu':
        result = updateMenu(params.data);
        break;
      case 'updateAnnouncement':
        result = updateAnnouncement(params.data);
        break;
      case 'addMember':
        result = addMember(params.data);
        break;
      case 'removeMember':
        result = removeMember(params.data);
        break;
      case 'updateMember':
        result = updateMember(params.data);
        break;
      case 'addMenuHistory':
        result = addMenuHistory(params.data);
        break;
      case 'deleteMenuHistory':
        result = deleteMenuHistory(params.data);
        break;
      case 'deleteOrder':
        result = deleteOrder(params.data);
        break;
      case 'addMenuLibrary':
        result = addMenuLibrary(params.data);
        break;
      case 'updateMenuLibrary':
        result = updateMenuLibrary(params.data);
        break;
      case 'deleteMenuLibrary':
        result = deleteMenuLibrary(params.data);
        break;
      case 'toggleFavorite':
        result = toggleFavorite(params.data);
        break;
      default:
        result = { error: 'Unknown action' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- 核心邏輯 ---

// Helper for safe JSON parsing
function safeParse(str, fallback) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch (e) {
    return fallback;
  }
}

// 產生更強健的 ID (時間戳 + 隨機數)
function generateId() {
  return new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
}

function getAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Self-Repair: Check for missing OR empty/corrupted sheets
  const checkAndFix = (name, minRows) => {
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < minRows) return true;
    return false;
  };

  if (checkAndFix(SHEET_NAMES.MEMBERS, 2) || 
      checkAndFix(SHEET_NAMES.ORDERS, 2) || 
      checkAndFix(SHEET_NAMES.MENU, 2) || 
      checkAndFix(SHEET_NAMES.SYSTEM, 2) ||
      checkAndFix(SHEET_NAMES.MENU_HISTORY, 1) ||
      checkAndFix(SHEET_NAMES.MENU_LIBRARY, 1)) {
      setupSheets();
      SpreadsheetApp.flush();
  }

  // 1. Members
  let members = [];
  const mSheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
  if (mSheet && mSheet.getLastRow() > 1) {
     const mData = mSheet.getDataRange().getValues();
     members = mData.slice(1).map(row => row[0]).filter(n => n);
  }

  // 2. Orders
  let orders = [];
  const oSheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
  if (oSheet && oSheet.getLastRow() > 1) {
     const oData = oSheet.getDataRange().getValues();
     orders = oData.slice(1).map(row => ({
        id: row[0],
        member: row[1],
        items: safeParse(row[2], []),
        total: Number(row[3]),
        date: row[4]
     }));
  }

  // 3. Menu
  let menu = { 
    items: [], closingTime: '', image: '', storeInfo: { name: '', address: '', phone: '' }, 
    posted: false, lastUpdated: '' 
  };
  
  const meSheet = ss.getSheetByName(SHEET_NAMES.MENU);
  if (meSheet) {
    const meData = meSheet.getDataRange().getValues();
    const menuRow = meData[1] || ['{}', 'FALSE', '']; 
    
    let menuObj = safeParse(menuRow[0], {});
    if (Array.isArray(menuObj)) {
        menuObj = { items: menuObj };
    }

    menu = {
      items: menuObj.items || [],
      closingTime: menuObj.closingTime || '',
      image: menuObj.image || '',
      storeInfo: menuObj.storeInfo || { name: '', address: '', phone: '' },
      remark: menuObj.remark || '',
      posted: menuRow[1] === true || String(menuRow[1]).toUpperCase() === 'TRUE',
      lastUpdated: menuRow[2]
    };
  }

  // 4. Announcement
  let announcement = '';
  const sSheet = ss.getSheetByName(SHEET_NAMES.SYSTEM);
  if (sSheet) {
    const sData = sSheet.getDataRange().getValues();
    announcement = sData[1] ? sData[1][1] : '';
  }

  // 5. Menu History
  let menuHistory = [];
  const hSheet = ss.getSheetByName(SHEET_NAMES.MENU_HISTORY);
  if (hSheet && hSheet.getLastRow() > 1) {
    const hData = hSheet.getDataRange().getValues();
    menuHistory = hData.slice(1).map(row => ({
      id: row[0],
      name: row[1],
      items: safeParse(row[2], []),
      image: row[3],
      date: row[4],
      storeInfo: safeParse(row[5], { name: '', address: '', phone: '' })
    })).sort((a,b) => new Date(b.date) - new Date(a.date));
  }

  // 6. Menu Library (菜單庫)
  let menuLibrary = [];
  const lSheet = ss.getSheetByName(SHEET_NAMES.MENU_LIBRARY);
  if (lSheet && lSheet.getLastRow() > 1) {
    const lData = lSheet.getDataRange().getValues();
    menuLibrary = lData.slice(1).map(row => ({
      id: row[0],
      name: row[1],
      category: row[2] || 'other',
      storeInfo: safeParse(row[3], { name: '', address: '', phone: '' }),
      items: safeParse(row[4], []),
      image: row[5] || '',
      tags: safeParse(row[6], []),
      isFavorite: row[7] === true || String(row[7]).toUpperCase() === 'TRUE',
      createdDate: row[8],
      updatedDate: row[9],
      remark: row[10] || ''
    })).sort((a,b) => new Date(b.updatedDate || b.createdDate) - new Date(a.updatedDate || a.createdDate));
  }

  return { 
    sysVersion: '3.1', // Bump version for Drive image upload
    members, 
    orders, 
    menu, 
    announcement, 
    menuHistory,
    menuLibrary
  };
}

function addOrder(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
    const id = generateId();
    sheet.appendRow([
      id,
      data.member,
      JSON.stringify(data.items),
      data.total,
      new Date().toISOString()
    ]);
    SpreadsheetApp.flush();
    return { success: true, id };
  } catch (e) {
    return { error: '伺服器繁忙，請稍後再試: ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateMenu(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.MENU);
    
    // 自動將 Base64 圖片上傳到 Drive
    var imageUrl = processImageField(data.image || '', 'menu');
    
    const menuWrapper = {
        items: data.items,
        closingTime: data.closingTime || '',
        image: imageUrl,
        storeInfo: data.storeInfo || { name: '', address: '', phone: '' },
        remark: data.remark || ''
    };

    sheet.getRange(2, 1, 1, 3).setValues([[
      JSON.stringify(menuWrapper),
      data.posted,
      new Date().toISOString()
    ]]);
    SpreadsheetApp.flush();
    return { success: true };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function addMenuHistory(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAMES.MENU_HISTORY);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAMES.MENU_HISTORY);
      sheet.appendRow(['ID', 'Name', 'ItemsJSON', 'Image', 'Date', 'StoreInfoJSON']);
    }
    
    // 自動將 Base64 圖片上傳到 Drive
    var imageUrl = processImageField(data.image || '', 'history');
    
    const id = generateId();
    sheet.appendRow([
      id,
      data.name,
      JSON.stringify(data.items),
      imageUrl,
      new Date().toISOString(),
      JSON.stringify(data.storeInfo || {})
    ]);
    SpreadsheetApp.flush();
    return { success: true };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteMenuHistory(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.MENU_HISTORY);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(data.id)) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteOrder(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(data.id)) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function addMember(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
    sheet.appendRow([data.name]);
    SpreadsheetApp.flush();
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function removeMember(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === data.name) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function updateMember(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === data.oldName) {
        sheet.getRange(i + 1, 1).setValue(data.newName);
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function updateAnnouncement(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SYSTEM);
  sheet.getRange(2, 2).setValue(data.text);
  SpreadsheetApp.flush();
  return { success: true };
}

// --- Menu Library CRUD ---

function addMenuLibrary(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAMES.MENU_LIBRARY);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAMES.MENU_LIBRARY);
      sheet.appendRow(['ID', 'Name', 'Category', 'StoreInfoJSON', 'ItemsJSON', 'Image', 'TagsJSON', 'IsFavorite', 'CreatedDate', 'UpdatedDate', 'Remark']);
    }
    
    // 自動將 Base64 圖片上傳到 Drive
    var imageUrl = processImageField(data.image || '', 'library');
    
    const id = generateId();
    const now = new Date().toISOString();
    sheet.appendRow([
      id,
      data.name || '',
      data.category || 'other',
      JSON.stringify(data.storeInfo || {}),
      JSON.stringify(data.items || []),
      imageUrl,
      JSON.stringify(data.tags || []),
      data.isFavorite ? 'TRUE' : 'FALSE',
      now,
      now,
      data.remark || ''
    ]);
    SpreadsheetApp.flush();
    return { success: true, id };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateMenuLibrary(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.MENU_LIBRARY);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(data.id)) {
        const row = i + 1;
        if (data.name !== undefined) sheet.getRange(row, 2).setValue(data.name);
        if (data.category !== undefined) sheet.getRange(row, 3).setValue(data.category);
        if (data.storeInfo !== undefined) sheet.getRange(row, 4).setValue(JSON.stringify(data.storeInfo));
        if (data.items !== undefined) sheet.getRange(row, 5).setValue(JSON.stringify(data.items));
        // 自動將 Base64 圖片上傳到 Drive
        if (data.image !== undefined) sheet.getRange(row, 6).setValue(processImageField(data.image, 'library'));
        if (data.tags !== undefined) sheet.getRange(row, 7).setValue(JSON.stringify(data.tags));
        if (data.isFavorite !== undefined) sheet.getRange(row, 8).setValue(data.isFavorite ? 'TRUE' : 'FALSE');
        if (data.remark !== undefined) sheet.getRange(row, 11).setValue(data.remark);
        sheet.getRange(row, 10).setValue(new Date().toISOString());
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteMenuLibrary(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.MENU_LIBRARY);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(data.id)) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function toggleFavorite(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.MENU_LIBRARY);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(data.id)) {
        const current = values[i][7] === true || String(values[i][7]).toUpperCase() === 'TRUE';
        sheet.getRange(i + 1, 8).setValue(current ? 'FALSE' : 'TRUE');
        sheet.getRange(i + 1, 10).setValue(new Date().toISOString());
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true };
  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// --- 圖片處理助手 ---

/**
 * 處理圖片欄位：如果是 Base64 則上傳到 Drive，否則直接返回 URL
 */
function processImageField(imageValue, prefix) {
  if (!imageValue) return '';
  
  // 如果已經是 http(s) 開頭，代表已經是 URL 了
  if (imageValue.indexOf('http') === 0) return imageValue;
  
  // 如果包含 base64 標記，則嘗試上傳
  if (imageValue.indexOf('base64,') !== -1) {
    try {
      return uploadImageToDrive(imageValue, prefix + "_" + generateId());
    } catch (e) {
      console.error("Image upload failed:", e);
      return ''; // 上傳失敗則不存圖片，避免存入巨大的 base64
    }
  }
  
  // 其他情況（如果是空的或其他文字）
  return '';
}

/**
 * 將 Base64 圖片上傳到 Google Drive 並返回公開連結
 */
function uploadImageToDrive(base64Data, filename) {
  var folderName = 'DingMenuImages';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  
  // 解析 base64
  var splitData = base64Data.split(',');
  var contentType = splitData[0].match(/:(.*?);/)[1];
  var bytes = Utilities.base64Decode(splitData[1]);
  var blob = Utilities.newBlob(bytes, contentType, filename);
  
  // 建立檔案
  var file = folder.createFile(blob);
  
  // 設定權限為「任何知道連結的人都可以檢視」
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // 取得下載連結 (或預覽連結)
  // 使用 webContentLink 可以直接下載，或用 getDownloadUrl
  // 我們使用 getDownloadUrl 的變體來讓 <img> 標籤能顯示
  var fileId = file.getId();
  return "https://lh3.googleusercontent.com/d/" + fileId;
}

/**
 * 手動執行測試：確認 Google Drive 權限並建立資料夾
 */
function testDriveConnection() {
  try {
    var folderName = 'DingMenuImages';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    Logger.log('✅ 資料夾已確認：' + folder.getName());
    Logger.log('🔗 資料夾 ID: ' + folder.getId());
    return '測試成功！資料夾 ID: ' + folder.getId() + '，請至雲端硬碟確認。';
  } catch(e) {
    Logger.log('❌ 錯誤：' + e.toString());
    return '錯誤：' + e.toString();
  }
}
