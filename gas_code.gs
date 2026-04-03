/**
 * 🍱 自由543：訂便當系統後端 (3.3-Stable)
 * 功能：對齊試算表分頁名稱、修正指令名稱、增加容錯
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

    case 'updateMenu':
      updateWorksheetObject('Settings', 'current_menu', {
        posted: params.posted,
        items: params.items,
        closingTime: params.closingTime,
        image: params.image || '',
        storeInfo: params.storeInfo || {},
        remark: params.remark || ''
      });
      return handleResponse({ success: true });

    case 'addOrder': // 🚀 前端 placeOrder 會對應到這裡
      var orderSheet = getOrCreateSheet('Orders');
      orderSheet.appendRow([
        new Date(),
        params.member,
        JSON.stringify(params.items),
        params.total,
        params.orderId || Utilities.getUuid()
      ]);
      return handleResponse({ success: true });

    case 'removeOrder': // 🚀 前端 deleteOrder 會對應到這裡
      var currentMenu = (getWorksheetObject('Settings', 'current_menu') || {});
      if (currentMenu.posted === false) {
        return handleResponse({ error: "已結單，系統已鎖定，無法進行訂單取消。" });
      }
      var orderSheet = getOrCreateSheet('Orders');
      var orderRows = orderSheet.getDataRange().getValues();
      var found = false;
      for (var i = orderRows.length - 1; i >= 1; i--) {
        if (orderRows[i][4] === params.orderId || orderRows[i][4] === params.id) {
          orderSheet.deleteRow(i + 1);
          found = true;
          break;
        }
      }
      return handleResponse({ success: found });

    case 'addMember':
      var memSheet = getOrCreateSheet('Members');
      memSheet.appendRow([params.name, new Date()]);
      return handleResponse({ success: true });

    case 'removeMember':
      var memSheet = getOrCreateSheet('Members');
      var memRows = memSheet.getDataRange().getValues();
      for (var i = memRows.length - 1; i >= 1; i--) {
        if (memRows[i][0] === params.name) {
          memSheet.deleteRow(i + 1);
        }
      }
      return handleResponse({ success: true });

    case 'addMenuHistory': 
      var histSheet = getOrCreateSheet('MenuHistory');
      histSheet.appendRow([
        new Date().getTime(),          
        params.name,                   
        JSON.stringify(params.items),  
        params.image || '',            
        JSON.stringify(params.storeInfo || {}) 
      ]);
      return handleResponse({ success: true });

    case 'deleteMenuHistory': // 🚀 補上刪除歷史功能
      var histSheet = getOrCreateSheet('MenuHistory');
      var histRows = histSheet.getDataRange().getValues();
      for (var i = histRows.length - 1; i >= 1; i--) {
        if (String(histRows[i][0]) === String(params.id)) {
          histSheet.deleteRow(i + 1);
          break;
        }
      }
      return handleResponse({ success: true });

    case 'addMenuLibrary':
      var libSheet = getOrCreateSheet('MenuLibrary');
      libSheet.appendRow([
        params.id || Utilities.getUuid(),
        params.name,
        params.category,
        JSON.stringify(params.storeInfo || {}),
        JSON.stringify(params.items || []),
        params.image || '',
        params.remark || params.tags || '',
        params.isFavorite || false
      ]);
      return handleResponse({ success: true });
      
    case 'updateMenuLibrary':
      var libSheet = getOrCreateSheet('MenuLibrary');
      var libRows = libSheet.getDataRange().getValues();
      var foundIndex = -1;
      for (var i = 1; i < libRows.length; i++) {
        if (libRows[i][0] === params.id) {
          foundIndex = i + 1;
          break;
        }
      }
      if (foundIndex !== -1) {
        if (params.name) libSheet.getRange(foundIndex, 2).setValue(params.name);
        if (params.category) libSheet.getRange(foundIndex, 3).setValue(params.category);
        if (params.storeInfo) libSheet.getRange(foundIndex, 4).setValue(JSON.stringify(params.storeInfo));
        if (params.items) libSheet.getRange(foundIndex, 5).setValue(JSON.stringify(params.items));
        if (params.image !== undefined) libSheet.getRange(foundIndex, 6).setValue(params.image);
        if (params.remark || params.tags) {
           libSheet.getRange(foundIndex, 7).setValue(params.remark || params.tags);
           libSheet.getRange(foundIndex, 11).setValue(params.remark || params.tags); // 🚀 同步更新到 Column K
        }
        return handleResponse({ success: true });
      }
      return handleResponse({ error: "找不到該菜單 ID" });

    case 'deleteMenuLibrary':
      var libSheet = getOrCreateSheet('MenuLibrary');
      var libRows = libSheet.getDataRange().getValues();
      for (var i = libRows.length - 1; i >= 1; i--) {
        if (libRows[i][0] === params.id) {
          libSheet.deleteRow(i + 1);
          break;
        }
      }
      return handleResponse({ success: true });
      
    case 'toggleFavorite':
      var libSheet = getOrCreateSheet('MenuLibrary');
      var libRows = libSheet.getDataRange().getValues();
      for (var i = 1; i < libRows.length; i++) {
        if (libRows[i][0] === params.id) {
           libSheet.getRange(i+1, 8).setValue(!libRows[i][7]);
           break;
        }
      }
      return handleResponse({ success: true });

    case 'ocrMenu':
      return handleOcr(params);

    default:
      return handleResponse({ error: "未知指令: " + action });
  }
}

/** 🛠️ 資料處理工具 **/

function getData() {
  return {
    sysVersion: "3.3-Stable",
    menu: getWorksheetObject('Settings', 'current_menu') || { posted: false, items: [], closingTime: '', image: '', storeInfo: {}, remark: '' },
    orders: getOrdersData(),
    members: getMembersList(),
    announcement: getWorksheetObject('Settings', 'announcement') || "歡迎使用自由543系統！",
    menuLibrary: getLibraryList(),
    menuHistory: getHistoryList(),
    debugSheets: SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName())
  };
}

function getLibraryList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MenuLibrary') || ss.getSheetByName('Library');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var lib = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][1]) continue;
    try {
      lib.push({
        id: String(rows[i][0] || ""),     
        name: rows[i][1],           
        category: rows[i][2],       
        storeInfo: JSON.parse(rows[i][3] || "{}"),
        items: JSON.parse(rows[i][4] || "[]"),
        image: rows[i][5],          
        remark: rows[i][10] || rows[i][6], // 🚀 對齊截圖：優先從 Column K (Index 10) 讀取備註
        isFavorite: rows[i][7] === true || String(rows[i][7]).toUpperCase() === 'TRUE'
      });
    } catch(e){}
  }
  return lib;
}

function getHistoryList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MenuHistory') || ss.getSheetByName('History');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  return rows.slice(1).map(function(r){
    try {
      var idVal = String(r[0] || "");
      if (!idVal) return null;
      
      var nameVal = r[1] || "未命名紀錄";
      var itemsArr = [];
      try { itemsArr = JSON.parse(r[2] || "[]"); } catch(e){ itemsArr = []; }
      
      var imageVal = (r.length > 3) ? r[3] : "";
      var storeObj = {};
      try { storeObj = (r.length > 4) ? JSON.parse(r[4] || "{}") : {}; } catch(e){ storeObj = {}; }
      
      // 🚀 解析時間：處理格式如 "1774968654980_136"
      var tsPart = idVal.split('_')[0];
      var tsNumber = Number(tsPart);
      var isoDate = (!isNaN(tsNumber) && tsNumber > 0) ? new Date(tsNumber).toISOString() : new Date().toISOString();
      
      return { 
        id: idVal, 
        name: nameVal, 
        items: itemsArr, 
        image: imageVal, 
        storeInfo: storeObj, 
        date: isoDate 
      };
    } catch(e){ 
      return null; 
    }
  }).filter(Boolean).sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
}

function getMembersList() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
  if (!sheet) return [];
  return sheet.getRange("A2:A").getValues().map(function(r){ return r[0]; }).filter(Boolean);
}

function getOrdersData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).map(function(r){
    try { return { date: r[0], member: r[1], items: JSON.parse(r[2] || "[]"), total: r[3], id: r[4] }; } catch(e){ return null; }
  }).filter(Boolean);
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
    if (name === 'MenuLibrary') sheet.appendRow(['ID', '店名', '分類', '店家資訊JSON', '品項JSON', '圖片', '備註', '最愛']);
    if (name === 'MenuHistory') sheet.appendRow(['ID', '店名', '品項內容', '圖片', '店家資訊JSON']);
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
  var valStr = JSON.stringify(obj);
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) { sheet.getRange(i+1, 2).setValue(valStr); return; }
  }
  sheet.appendRow([key, valStr]);
}

function handleOcr(params) {
  try {
    var props = PropertiesService.getScriptProperties();
    var apiEndpoint = props.getProperty('AZURE_ENDPOINT');
    var apiKey = props.getProperty('AZURE_API_KEY');
    
    if (!apiEndpoint || !apiKey) return handleResponse({ error: "GAS 尚未設定 AZURE_ENDPOINT 或 AZURE_API_KEY" });

    var payload = {
      messages: [{ role: "user", content: [
        { type: "text", text: "辨識這份菜單圖片。請務必使用【繁體中文】回傳 JSON。格式：{ \"items\": [{ \"name\": \"...\", \"price\": 0 }], \"storeInfo\": { \"name\": \"...\", \"phone\": \"...\", \"address\": \"...\" }, \"remark\": \"...\" }。請確保輸出為純 JSON，不要有 Markdown 標記。" },
        { type: "image_url", image_url: { url: params.image } }
      ]}],
      max_completion_tokens: 2000,
      temperature: 0
    };
    
    var response = UrlFetchApp.fetch(apiEndpoint, {
      method: 'post', contentType: 'application/json', headers: { 'api-key': apiKey },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    
    var code = response.getResponseCode();
    var fullText = response.getContentText();

    if (code !== 200) {
      return handleResponse({ error: "Azure API 錯誤 (" + code + ")", raw: fullText });
    }

    try {
      var resJson = JSON.parse(fullText);
      if (resJson.error) return handleResponse({ error: "Azure 核心錯誤: " + resJson.error.message });
      
      var aiContent = resJson.choices[0].message.content;
      
      // 🚀 強力 JSON 提取與清理
      var jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
         var cleanJsonStr = jsonMatch[0];
         var parsed = JSON.parse(cleanJsonStr);
         return handleResponse({
            items: parsed.items || [],
            storeInfo: parsed.storeInfo || {},
            remark: parsed.remark || "",
            success: true
         });
      }
      return handleResponse({ error: "AI 未能產出有效 JSON", aiResponse: aiContent });
    } catch(e) {
      return handleResponse({ error: "解析失敗: " + e.toString(), raw: fullText });
    }
  } catch (err) { return handleResponse({ error: err.toString() }); }
}
