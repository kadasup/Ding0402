/**
 * Ding Bento backend (Google Apps Script)
 * Version: 3.3-Stable
 */

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var sectionParam = params.sections || params.section || "";
  if (!sectionParam) {
    return handleResponse(getData());
  }

  var sections = String(sectionParam)
    .split(",")
    .map(function (s) { return String(s || "").trim().toLowerCase(); })
    .filter(Boolean);

  if (!sections.length) {
    return handleResponse(getData());
  }

  return handleResponse(getDataSections(sections));
}

function doPost(e) {
  var params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return handleResponse({ error: "GAS JSON parse error: " + err.toString() });
  }

  var action = params.action;

  switch (action) {
    case "getMenu":
      return handleResponse(getData());

    case "updateMenu":
      updateWorksheetObject("Settings", "current_menu", {
        posted: params.posted,
        items: params.items,
        closingTime: params.closingTime,
        image: params.image || "",
        storeInfo: params.storeInfo || {},
        remark: params.remark || "",
        lastUpdated: params.lastUpdated || new Date().getTime().toString()
      });
      return handleResponse({ success: true });

    case "updateAnnouncement":
      updateWorksheetObject("Settings", "announcement", params.text || "");
      return handleResponse({ success: true, text: params.text || "" });

    case "addOrder":
      var orderSheet = getOrCreateSheet("Orders");
      orderSheet.appendRow([
        new Date(),
        params.member,
        JSON.stringify(params.items),
        params.total,
        params.orderId || Utilities.getUuid(),
        params.menuId || ""
      ]);
      return handleResponse({ success: true });

    case "removeOrder":
      var currentMenu = getWorksheetObject("Settings", "current_menu") || {};
      if (currentMenu.posted === false) {
        return handleResponse({ error: "Menu is not posted yet. Cannot remove order." });
      }

      var orderSheet2 = getOrCreateSheet("Orders");
      var orderRows = orderSheet2.getDataRange().getValues();
      var found = false;
      for (var i = orderRows.length - 1; i >= 1; i--) {
        if (orderRows[i][4] === params.orderId || orderRows[i][4] === params.id) {
          orderSheet2.deleteRow(i + 1);
          found = true;
          break;
        }
      }
      return handleResponse({ success: found });

    case "addMember":
      var memSheet = getOrCreateSheet("Members");
      memSheet.appendRow([params.name, new Date()]);
      return handleResponse({ success: true });

    case "removeMember":
      var memSheet2 = getOrCreateSheet("Members");
      var memRows = memSheet2.getDataRange().getValues();
      for (var i2 = memRows.length - 1; i2 >= 1; i2--) {
        if (memRows[i2][0] === params.name) {
          memSheet2.deleteRow(i2 + 1);
        }
      }
      return handleResponse({ success: true });

    case "updateMember":
      var memberSheet = getOrCreateSheet("Members");
      var memberRows = memberSheet.getDataRange().getValues();
      var renamed = false;
      for (var j = 1; j < memberRows.length; j++) {
        if (memberRows[j][0] === params.oldName) {
          memberSheet.getRange(j + 1, 1).setValue(params.newName);
          renamed = true;
        }
      }

      var ordersSheetForRename = getOrCreateSheet("Orders");
      var orderRowsForRename = ordersSheetForRename.getDataRange().getValues();
      for (var ri = 1; ri < orderRowsForRename.length; ri++) {
        if (orderRowsForRename[ri][1] === params.oldName) {
          ordersSheetForRename.getRange(ri + 1, 2).setValue(params.newName);
        }
      }
      return handleResponse({ success: renamed });

    case "addMenuHistory":
      var histSheet = getOrCreateSheet("MenuHistory");
      histSheet.appendRow([
        new Date().getTime(),
        params.name,
        JSON.stringify(params.items),
        params.image || "",
        JSON.stringify(params.storeInfo || {}),
        params.remark || ""
      ]);
      return handleResponse({ success: true });

    case "deleteMenuHistory":
      var histSheet2 = getOrCreateSheet("MenuHistory");
      var histRows = histSheet2.getDataRange().getValues();
      for (var hi = histRows.length - 1; hi >= 1; hi--) {
        if (String(histRows[hi][0]) === String(params.id)) {
          histSheet2.deleteRow(hi + 1);
          break;
        }
      }
      return handleResponse({ success: true });

    case "addMenuLibrary":
      var libSheet = getOrCreateSheet("MenuLibrary");
      libSheet.appendRow([
        params.id || Utilities.getUuid(),
        params.name,
        params.category,
        JSON.stringify(params.storeInfo || {}),
        JSON.stringify(params.items || []),
        params.image || "",
        params.remark || params.tags || "",
        params.isFavorite || false
      ]);
      return handleResponse({ success: true });

    case "updateMenuLibrary":
      var libSheet2 = getOrCreateSheet("MenuLibrary");
      var libRows = libSheet2.getDataRange().getValues();
      var foundIndex = -1;
      for (var li = 1; li < libRows.length; li++) {
        if (libRows[li][0] === params.id) {
          foundIndex = li + 1;
          break;
        }
      }

      if (foundIndex !== -1) {
        if (params.name) libSheet2.getRange(foundIndex, 2).setValue(params.name);
        if (params.category) libSheet2.getRange(foundIndex, 3).setValue(params.category);
        if (params.storeInfo) libSheet2.getRange(foundIndex, 4).setValue(JSON.stringify(params.storeInfo));
        if (params.items) libSheet2.getRange(foundIndex, 5).setValue(JSON.stringify(params.items));
        if (params.image !== undefined) libSheet2.getRange(foundIndex, 6).setValue(params.image);
        if (params.remark || params.tags) {
          var remarkValue = params.remark || params.tags;
          libSheet2.getRange(foundIndex, 7).setValue(remarkValue);
          libSheet2.getRange(foundIndex, 11).setValue(remarkValue); // Keep remark in column K
        }
        return handleResponse({ success: true });
      }
      return handleResponse({ error: "Menu library item not found by ID" });

    case "deleteMenuLibrary":
      var libSheet3 = getOrCreateSheet("MenuLibrary");
      var libRows3 = libSheet3.getDataRange().getValues();
      for (var di = libRows3.length - 1; di >= 1; di--) {
        if (libRows3[di][0] === params.id) {
          libSheet3.deleteRow(di + 1);
          break;
        }
      }
      return handleResponse({ success: true });

    case "toggleFavorite":
      var libSheet4 = getOrCreateSheet("MenuLibrary");
      var libRows4 = libSheet4.getDataRange().getValues();
      for (var fi = 1; fi < libRows4.length; fi++) {
        if (libRows4[fi][0] === params.id) {
          libSheet4.getRange(fi + 1, 8).setValue(!libRows4[fi][7]);
          break;
        }
      }
      return handleResponse({ success: true });

    case "ocrMenu":
      return handleOcr(params);

    case "clearTodayOrders":
      var clearSheet = getOrCreateSheet("Orders");
      var clearRows = clearSheet.getDataRange().getValues();
      var targetDate = params.dateKey || "";
      var targetMenuId = params.menuId ? String(params.menuId) : "";
      if (clearRows.length <= 1) {
        return handleResponse({ success: true, clearedCount: 0 });
      }

      var header = clearRows[0];
      var keptRows = [header];
      var clearedCount = 0;

      for (var ci = 1; ci < clearRows.length; ci++) {
        var rowDate = formatSheetDateKey(clearRows[ci][0]);
        var rowMenuId = clearRows[ci][5] !== undefined && clearRows[ci][5] !== null ? String(clearRows[ci][5]) : "";
        var matchesDate = !targetDate || rowDate === targetDate;
        var matchesMenu = !targetMenuId || rowMenuId === targetMenuId;
        if (matchesDate && matchesMenu) {
          clearedCount++;
        } else {
          keptRows.push(clearRows[ci]);
        }
      }

      if (clearedCount === 0) {
        return handleResponse({ success: true, clearedCount: 0 });
      }

      clearSheet.clearContents();
      clearSheet.getRange(1, 1, keptRows.length, header.length).setValues(keptRows);
      return handleResponse({ success: true, clearedCount: clearedCount });

    case "uploadImage":
      try {
        var uploadName = params.name || ("img_" + new Date().getTime());
        var uploadResult = saveBase64ToDrive(params.image, uploadName);
        updateWorksheetObject("System", "last_upload_status", {
          ok: true,
          name: uploadName,
          url: uploadResult.url,
          fileId: uploadResult.fileId,
          at: new Date().toISOString()
        });
        return handleResponse({
          success: true,
          name: uploadName,
          url: uploadResult.url,
          fileId: uploadResult.fileId
        });
      } catch (e) {
        updateWorksheetObject("System", "last_upload_status", {
          ok: false,
          name: params.name || "",
          error: e.toString(),
          at: new Date().toISOString()
        });
        return handleResponse({ error: "Upload image failed: " + e.toString() });
      }

    default:
      return handleResponse({ error: "Unknown action: " + action });
  }
}

function getData() {
  return getDataSections(["all"]);
}

function getDataSections(sections) {
  var include = {};
  for (var i = 0; i < sections.length; i++) {
    include[String(sections[i] || "").toLowerCase()] = true;
  }

  var includeAll = include.all === true;
  var includeCore = include.core === true;
  var result = {
    sysVersion: "3.3-Stable"
  };

  if (includeAll || includeCore || include.menu) {
    var currentMenu = getWorksheetObject("Settings", "current_menu") || {
      posted: false,
      items: [],
      closingTime: "",
      image: "",
      storeInfo: {},
      remark: "",
      lastUpdated: "0"
    };
    if (!currentMenu.lastUpdated) currentMenu.lastUpdated = "0";
    result.menu = currentMenu;
  }

  if (includeAll || includeCore || include.members) {
    result.members = getMembersList();
  }

  if (includeAll || includeCore || include.announcement) {
    result.announcement = getWorksheetObject("Settings", "announcement") || "歡迎使用自由543訂便當系統！";
  }

  if (includeAll || include.orders) {
    result.orders = getOrdersData();
  }

  if (includeAll || include.library || include.menulibrary) {
    result.menuLibrary = getLibraryList();
  }

  if (includeAll || include.history || include.menuhistory) {
    result.menuHistory = getHistoryList();
  }

  if (includeAll || include.uploadstatus || include.lastuploadstatus) {
    result.lastUploadStatus = getWorksheetObject("System", "last_upload_status") || null;
  }

  if (includeAll || include.debug || include.debugsheets) {
    result.debugSheets = SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) { return s.getName(); });
  }

  return result;
}

function getLibraryList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("MenuLibrary") || ss.getSheetByName("Library");
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
        remark: rows[i][10] || rows[i][6], // Prefer column K remark, fallback to old column
        isFavorite: rows[i][7] === true || String(rows[i][7]).toUpperCase() === "TRUE"
      });
    } catch (e) {}
  }
  return lib;
}

function getHistoryList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("MenuHistory") || ss.getSheetByName("History");
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  return rows.slice(1).map(function (r) {
    try {
      var idVal = String(r[0] || "");
      if (!idVal) return null;

      var nameVal = r[1] || "未命名菜單";
      var itemsArr = [];
      try { itemsArr = JSON.parse(r[2] || "[]"); } catch (e) { itemsArr = []; }

      var imageVal = (r.length > 3) ? r[3] : "";
      var storeObj = {};
      try { storeObj = (r.length > 4) ? JSON.parse(r[4] || "{}") : {}; } catch (e2) { storeObj = {}; }
      var remarkVal = (r.length > 5) ? (r[5] || "") : "";

      // Support both numeric IDs and IDs like "1774968654980_136"
      var tsPart = idVal.split("_")[0];
      var tsNumber = Number(tsPart);
      var isoDate = (!isNaN(tsNumber) && tsNumber > 0) ? new Date(tsNumber).toISOString() : new Date().toISOString();

      return {
        id: idVal,
        name: nameVal,
        items: itemsArr,
        image: imageVal,
        storeInfo: storeObj,
        remark: remarkVal,
        date: isoDate
      };
    } catch (e3) {
      return null;
    }
  }).filter(Boolean).sort(function (a, b) {
    return new Date(b.date) - new Date(a.date);
  });
}

function getMembersList() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Members");
  if (!sheet) return [];
  return sheet.getRange("A2:A").getValues().map(function (r) { return r[0]; }).filter(Boolean);
}

function getOrdersData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
  if (!sheet) return [];

  return sheet.getDataRange().getValues().slice(1).map(function (r) {
    try {
      var mId = (r[5] !== undefined && r[5] !== null) ? String(r[5]) : "";
      return {
        date: r[0],
        member: r[1],
        items: JSON.parse(r[2] || "[]"),
        total: r[3],
        id: r[4],
        menuId: mId
      };
    } catch (e) {
      return null;
    }
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
    if (name === "Orders") sheet.appendRow(["日期", "成員", "品項JSON", "總額", "ID", "MenuId"]);
    if (name === "Members") sheet.appendRow(["姓名", "加入日期"]);
    if (name === "MenuLibrary") sheet.appendRow(["ID", "名稱", "類別", "店家資訊JSON", "品項JSON", "圖片", "標籤", "時間戳", "收藏", "備註", "Remark"]);
    if (name === "MenuHistory") sheet.appendRow(["ID", "名稱", "品項JSON", "圖片", "店家資訊JSON", "備註"]);
  }
  return sheet;
}

function formatSheetDateKey(value) {
  if (!value) return "";
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function getWorksheetObject(sheetName, key) {
  var sheet = getOrCreateSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      try {
        return JSON.parse(data[i][1]);
      } catch (e) {
        return data[i][1];
      }
    }
  }
  return null;
}

function updateWorksheetObject(sheetName, key, obj) {
  var sheet = getOrCreateSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var valStr = JSON.stringify(obj);

  // Google Sheets single-cell limit is around 50,000 chars; use 49,900 as safe guard.
  if (valStr.length > 49900) {
    if (obj.image && obj.image.length > 500) {
      obj.image = "[image removed: base64 too large (" + obj.image.length + " chars)]";
      valStr = JSON.stringify(obj);
    }
  }

  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(valStr);
      return;
    }
  }
  sheet.appendRow([key, valStr]);
}

function handleOcr(params) {
  try {
    var props = PropertiesService.getScriptProperties();
    var apiEndpoint = props.getProperty("AZURE_ENDPOINT");
    var apiKey = props.getProperty("AZURE_API_KEY");

    if (!apiEndpoint || !apiKey) {
      return handleResponse({ error: "Missing AZURE_ENDPOINT or AZURE_API_KEY in Script Properties" });
    }

    // Accept raw base64 or full data URL
    var imagePayload = params.image;
    if (imagePayload && !imagePayload.startsWith("data:")) {
      imagePayload = "data:image/jpeg;base64," + imagePayload;
    }

    var payload = {
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Analyze this menu image and return JSON only: {\"items\":[{\"name\":\"...\",\"price\":0}],\"storeInfo\":{\"name\":\"...\",\"phone\":\"...\",\"address\":\"...\"},\"remark\":\"...\"}" },
          { type: "image_url", image_url: { url: imagePayload, detail: "high" } }
        ]
      }],
      max_completion_tokens: 2000,
      temperature: 0
    };

    var response = UrlFetchApp.fetch(apiEndpoint, {
      method: "post",
      contentType: "application/json",
      headers: {
        "api-key": apiKey,
        "Ocp-Apim-Subscription-Key": apiKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    var fullText = response.getContentText();

    if (code !== 200) {
      return handleResponse({ error: "Azure API error (" + code + ")", raw: fullText });
    }

    try {
      var resJson = JSON.parse(fullText);
      if (resJson.error) {
        return handleResponse({ error: "Azure response error: " + resJson.error.message });
      }

      var aiContent = resJson.choices[0].message.content;
      var jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          var parsed = JSON.parse(jsonMatch[0]);
          return handleResponse({
            items: parsed.items || [],
            storeInfo: parsed.storeInfo || {},
            remark: parsed.remark || "",
            success: true
          });
        } catch (parseErr) {
          return handleResponse({ error: "JSON parse failed from AI response", aiResponse: aiContent });
        }
      }

      return handleResponse({ error: "AI response did not contain valid JSON object", aiResponse: aiContent });
    } catch (err) {
      return handleResponse({ error: "API response parse failed", raw: fullText });
    }
  } catch (err2) {
    return handleResponse({ error: err2.toString() });
  }
}

// Save base64 image to Google Drive and return a public thumbnail URL.
function saveBase64ToDrive(base64Data, fileName) {
  var folderName = "DingMenuImages";
  var folder = getOrCreateFolder(folderName);

  // Support full data URL or raw base64
  var base64Str = base64Data;
  if (base64Data.indexOf(",") > -1) {
    base64Str = base64Data.split(",")[1];
  }

  var decoded = Utilities.base64Decode(base64Str);
  var blob = Utilities.newBlob(decoded, "image/jpeg", fileName + ".jpg");
  var file = folder.createFile(blob);

  // Make file accessible by link
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Use thumbnail endpoint to avoid viewer pages/cookies
  var fileId = file.getId();
  return {
    fileId: fileId,
    url: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1000"
  };
}

function getOrCreateFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(name);
}

// Manual auth helper: run once in Apps Script editor to grant Drive/UrlFetch scopes.
function authTrigger() {
  var response = UrlFetchApp.fetch("https://google.com");
  var drive = DriveApp.getRootFolder(); // Trigger Drive scope permission
  Logger.log("Auth trigger OK, response code: " + response.getResponseCode());
}
