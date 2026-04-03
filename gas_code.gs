/**
 * 🍱 自由543：訂便當系統後端 (GAS 正式版)
 * 版本：3.2-SecureAI
 * 功能：資料過濾、統計、AI 辨識轉發 (Proxy)、多工作表同步、安全認證
 */

function doGet(e) {
  return handleResponse(getData());
}

function doPost(e) {
  var params;
  try {
     params = JSON.parse(e.postData.contents);
  } catch(err) {
     return handleResponse({ error: "無效的 JSON 格式" });
  }
  
  var action = params.action;
  
  switch (action) {
    case 'getMenu':
      return handleResponse(getData());

    case 'updateMenu': // 上架/下架/修改菜單
      updateWorksheetObject('Settings', 'current_menu', {
        posted: params.posted,
        items: params.items,
        closingTime: params.closingTime,
        image: params.image || '',
        storeInfo: params.storeInfo || {},
        remark: params.remark || ''
      });
      return handleResponse({ success: true });

    case 'addOrder': // 新增/修改訂單
      var orderSheet = getOrCreateSheet('Orders');
      orderSheet.appendRow([
        new Date(), // [0] 訂單時間
        params.member, // [1] 人員
        JSON.stringify(params.items), // [2] 品項清單
        params.total, // [3] 總金額
        params.orderId || Utilities.getUuid() // [4] 訂單ID
      ]);
      return handleResponse({ success: true });

    case 'removeOrder': // 刪除訂單 (含安全鎖：已結單不可刪除)
      var currentMenu = (getWorksheetObject('Settings', 'current_menu') || {});
      if (currentMenu.posted === false) {
        return handleResponse({ error: "已結單，系統已鎖定，無法進行訂單取消。" });
      }
      var orderSheet = getOrCreateSheet('Orders');
      var orderRows = orderSheet.getDataRange().getValues();
      var found = false;
      for (var i = orderRows.length - 1; i >= 1; i--) {
        if (orderRows[i][4] === params.orderId) {
          orderSheet.deleteRow(i + 1);
          found = true;
          break;
        }
      }
      return handleResponse({ success: found });

    case 'addMember': // 新增村民
      var memSheet = getOrCreateSheet('Members');
      memSheet.appendRow([params.name, new Date()]);
      return handleResponse({ success: true });

    case 'removeMember': // 移除村民
      var memSheet = getOrCreateSheet('Members');
      var memRows = memSheet.getDataRange().getValues();
      for (var i = memRows.length - 1; i >= 1; i--) {
        if (memRows[i][0] === params.name) {
          memSheet.deleteRow(i + 1);
        }
      }
      return handleResponse({ success: true });
      
    case 'updateMember': // 修改村民名字
      var memSheet = getOrCreateSheet('Members');
      var memRows = memSheet.getDataRange().getValues();
      for (var i = 1; i < memRows.length; i++) {
        if (memRows[i][0] === params.oldName) {
           memSheet.getRange(i+1, 1).setValue(params.newName);
           break;
        }
      }
      return handleResponse({ success: true });

    case 'addMenuHistory': // 歸檔歷史紀錄
      var histSheet = getOrCreateSheet('History');
      histSheet.appendRow([
        new Date(),
        params.name,
        JSON.stringify(params.items),
        params.image || '',
        JSON.stringify(params.storeInfo || {})
      ]);
      return handleResponse({ success: true });

    case 'updateMenuLibrary': // 儲存至菜單庫
      var libSheet = getOrCreateSheet('Library');
      libSheet.appendRow([
        Utilities.getUuid(),
        params.name,
        params.category,
        JSON.stringify(params.items),
        params.image || '',
        JSON.stringify(params.storeInfo || {}),
        params.remark || '',
        false // 是否為最愛
      ]);
      return handleResponse({ success: true });
      
    case 'deleteMenuLibrary': // 刪除菜單庫項目
      var libSheet = getOrCreateSheet('Library');
      var libRows = libSheet.getDataRange().getValues();
      for (var i = libRows.length - 1; i >= 1; i--) {
        if (libRows[i][0] === params.id) {
          libSheet.deleteRow(i + 1);
          break;
        }
      }
      return handleResponse({ success: true });
      
    case 'toggleFavorite': // 切換最愛狀態
      var libSheet = getOrCreateSheet('Library');
      var libRows = libSheet.getDataRange().getValues();
      for (var i = 1; i < libRows.length; i++) {
        if (libRows[i][0] === params.id) {
           libSheet.getRange(i+1, 8).setValue(!libRows[i][7]);
           break;
        }
      }
      return handleResponse({ success: true });

    case 'updateAnnouncement': // 更新公佈欄
      updateWorksheetObject('Settings', 'announcement', params.text);
      return handleResponse({ success: true });


    case 'ocrMenu': // 🚀 AI 影像辨識代理服務 (核心安全性)
      try {
        var scriptProps = PropertiesService.getScriptProperties();
        var azureKey = scriptProps.getProperty('AZURE_API_KEY');
        var azureEndpoint = scriptProps.getProperty('AZURE_ENDPOINT');
        
        if (!azureKey || !azureEndpoint) {
          return handleResponse({ error: "GAS 端未設定 Azure API 金鑰。請檢查指令碼屬性。" });
        }

        var azurePayload = {
          messages: [{ role: "user", content: [
            { type: "text", text: "Please analyze this menu image. Return JSON ONLY with: items(array of {name, price}), storeInfo(obj with {name, phone, address}), remark(strong details)." },
            { type: "image_url", image_url: { url: params.image } }
          ]}],
          max_completion_tokens: 1500
        };

        var response = UrlFetchApp.fetch(azureEndpoint, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'api-key': azureKey },
          payload: JSON.stringify(azurePayload),
          muteHttpExceptions: true
        });

        var ocrRaw = JSON.parse(response.getContentText());
        if (ocrRaw.error) return handleResponse({ error: "AI 辨識服務回報錯誤: " + ocrRaw.error.message });

        var airResContent = ocrRaw.choices[0].message.content;
        // Clean JSON formatting
        airResContent = airResContent.replace(/```json/g, '').replace(/```/g, '').trim();
        return ContentService.createTextOutput(airResContent).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return handleResponse({ error: "GAS OCR Proxy 發生例外: " + err.toString() });
      }

    default:
      return handleResponse({ error: "未知指令: " + action });
  }
}

/** 🛠️ 工具函式庫 **/

function getData() {
  return {
    sysVersion: "3.2-SecureAI",
    menu: getWorksheetObject('Settings', 'current_menu') || { posted: false, items: [], closingTime: '', image: '', storeInfo: {}, remark: '' },
    orders: getOrdersData(),
    members: getMembersList(),
    announcement: getWorksheetObject('Settings', 'announcement') || "歡迎使用自由543訂便當系統！",
    menuLibrary: getLibraryList(),
    menuHistory: getHistoryList()
  };
}

function getOrdersData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var orders = [];
  for (var i = 1; i < rows.length; i++) {
    var itemsStr = rows[i][2];
    var itemsArr = [];
    try { itemsArr = JSON.parse(itemsStr); } catch(e) {}
    orders.push({
      date: rows[i][0],
      member: rows[i][1],
      items: itemsArr,
      total: rows[i][3],
      id: rows[i][4]
    });
  }
  return orders;
}

function getMembersList() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
  if (!sheet) return [];
  var vals = sheet.getRange("A2:A").getValues();
  return vals.map(function(r){ return r[0]; }).filter(function(v){ return v !== ""; });
}

function getLibraryList() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Library');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var lib = [];
  for (var i = 1; i < rows.length; i++) {
    var itemsStr = rows[i][3];
    var storeStr = rows[i][5];
    var itemsArr = [];
    var storeObj = {};
    try { itemsArr = JSON.parse(itemsStr); } catch(e){}
    try { storeObj = JSON.parse(storeStr); } catch(e){}
    lib.push({
      id: rows[i][0], name: rows[i][1], category: rows[i][2],
      items: itemsArr, image: rows[i][4],
      storeInfo: storeObj, remark: rows[i][6], isFavorite: rows[i][7]
    });
  }
  return lib;
}

function getHistoryList() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('History');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var hist = [];
  for (var i = 1; i < rows.length; i++) {
    var itemsArr = [];
    var storeObj = {};
    try { itemsArr = JSON.parse(rows[i][2]); } catch(e){}
    try { storeObj = JSON.parse(rows[i][4]); } catch(e){}
    hist.push({
      date: rows[i][0],
      name: rows[i][1],
      items: itemsArr,
      image: rows[i][3],
      storeInfo: storeObj,
      id: "hist_" + i
    });
  }
  return hist;
}

function handleResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'Orders') sheet.appendRow(['時間', '人員', '品項內容', '總額', 'ID']);
    if (name === 'Members') sheet.appendRow(['名稱', '加入時間']);
    if (name === 'Library') sheet.appendRow(['ID', '店名/菜單名', '分類', '品項JSON', '圖片', '店家資訊JSON', '備註', '最愛']);
    if (name === 'Settings') sheet.appendRow(['Key', 'Value']);
  }
  return sheet;
}

function getWorksheetObject(sheetName, key) {
  var sheet = getOrCreateSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
       try { return JSON.parse(data[i][1]); } catch(e) { return data[i][1]; }
    }
  }
  return null;
}

function updateWorksheetObject(sheetName, key, obj) {
  var sheet = getOrCreateSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var found = false;
  var valueStr = (typeof obj === 'string') ? obj : JSON.stringify(obj);
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(valueStr);
      found = true;
      break;
    }
  }
  if (!found) sheet.appendRow([key, valueStr]);
}
