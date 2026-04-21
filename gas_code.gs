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
      var previousMenu = getWorksheetObject("Settings", "current_menu") || {};
      var nextMenu = {
        posted: params.posted,
        items: params.items,
        closingTime: params.closingTime,
        image: params.image || "",
        storeInfo: params.storeInfo || {},
        remark: params.remark || "",
        lastUpdated: params.lastUpdated || new Date().getTime().toString()
      };

      updateWorksheetObject("Settings", "current_menu", nextMenu);

      var wasPosted = parseSheetBoolean(previousMenu.posted);
      var isPosted = parseSheetBoolean(nextMenu.posted);
      var lineNotifyResult = { sent: false, skipped: true, reason: "status_unchanged" };

      if (!wasPosted && isPosted) {
        lineNotifyResult = sendLineMenuStatusNotification("publish", nextMenu);
      } else if (wasPosted && !isPosted) {
        var downMenu = {
          posted: false,
          items: (previousMenu && Array.isArray(previousMenu.items) && previousMenu.items.length > 0) ? previousMenu.items : (nextMenu.items || []),
          closingTime: previousMenu && previousMenu.closingTime ? previousMenu.closingTime : (nextMenu.closingTime || ""),
          image: previousMenu && previousMenu.image ? previousMenu.image : (nextMenu.image || ""),
          storeInfo: previousMenu && previousMenu.storeInfo ? previousMenu.storeInfo : (nextMenu.storeInfo || {}),
          remark: previousMenu && previousMenu.remark ? previousMenu.remark : (nextMenu.remark || ""),
          lastUpdated: nextMenu.lastUpdated
        };
        lineNotifyResult = sendLineMenuStatusNotification("unpublish", downMenu);
      }

      return handleResponse({ success: true, lineNotify: lineNotifyResult });

    case "lineTestPublishNotification":
      return handleResponse({
        success: true,
        lineNotify: sendLineMenuStatusNotification("publish", buildLineTestMenuPayload(params, "publish"))
      });

    case "lineTestUnpublishNotification":
      return handleResponse({
        success: true,
        lineNotify: sendLineMenuStatusNotification("unpublish", buildLineTestMenuPayload(params, "unpublish"))
      });

    case "lineTestBothNotifications":
      var testPublishResult = sendLineMenuStatusNotification("publish", buildLineTestMenuPayload(params, "publish"));
      Utilities.sleep(500);
      var testUnpublishResult = sendLineMenuStatusNotification("unpublish", buildLineTestMenuPayload(params, "unpublish"));
      return handleResponse({
        success: true,
        publish: testPublishResult,
        unpublish: testUnpublishResult
      });

    case "linePreviewPayload":
      var previewStatus = String(params.status || params.mode || "publish").toLowerCase() === "unpublish"
        ? "unpublish"
        : "publish";
      var previewMenu = buildLineTestMenuPayload(params, previewStatus);
      var previewFlex = buildMenuStatusFlexMessage(previewStatus, previewMenu, getLineNotifyConfig().appFrontendUrl);
      return handleResponse({
        success: true,
        status: previewStatus,
        simulatorBubble: previewFlex.contents,
        messagePayload: {
          type: "flex",
          altText: previewFlex.altText,
          contents: previewFlex.contents
        },
        validatePushPayload: {
          messages: [{
            type: "flex",
            altText: previewFlex.altText,
            contents: previewFlex.contents
          }]
        }
      });

    case "updateAnnouncement":
      updateWorksheetObject("Settings", "announcement", params.text || "");
      return handleResponse({ success: true, text: params.text || "" });

    case "addOrder":
      var orderMemberName = normalizeMemberName(params.member);
      if (!orderMemberName) {
        return handleResponse({ error: "Member name is required" });
      }
      if (!memberExists(orderMemberName)) {
        return handleResponse({ error: "Member not found: " + orderMemberName });
      }
      var orderItems = Array.isArray(params.items) ? params.items : [];
      if (orderItems.length === 0) {
        return handleResponse({ error: "Order items are required" });
      }
      var orderSheet = getOrCreateSheet("Orders");
      orderSheet.appendRow([
        new Date(),
        orderMemberName,
        JSON.stringify(orderItems),
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
      var nextMemberName = normalizeMemberName(params.name);
      if (!nextMemberName) {
        return handleResponse({ error: "Member name is required" });
      }
      var addLock = LockService.getScriptLock();
      addLock.waitLock(5000);
      try {
        var memSheet = getOrCreateSheet("Members");
        var memRowsForAdd = memSheet.getDataRange().getValues();
        var targetMemberNormalized = nextMemberName.toLowerCase();
        for (var mi = 1; mi < memRowsForAdd.length; mi++) {
          var existingName = normalizeMemberName(memRowsForAdd[mi][0]);
          if (!existingName) continue;
          if (existingName.toLowerCase() === targetMemberNormalized) {
            return handleResponse({ success: true, exists: true, name: existingName });
          }
        }
        memSheet.appendRow([nextMemberName, new Date()]);
        return handleResponse({ success: true, created: true, name: nextMemberName });
      } finally {
        addLock.releaseLock();
      }

    case "removeMember":
      var removeName = normalizeMemberName(params.name);
      if (!removeName) return handleResponse({ success: false, error: "Member name is required" });
      var removeNameKey = removeName.toLowerCase();
      var removeLock = LockService.getScriptLock();
      removeLock.waitLock(5000);
      try {
        var memSheet2 = getOrCreateSheet("Members");
        var memRows = memSheet2.getDataRange().getValues();
        for (var i2 = memRows.length - 1; i2 >= 1; i2--) {
          var rowMember = normalizeMemberName(memRows[i2][0]);
          if (rowMember && rowMember.toLowerCase() === removeNameKey) {
            memSheet2.deleteRow(i2 + 1);
          }
        }
        return handleResponse({ success: true });
      } finally {
        removeLock.releaseLock();
      }

    case "updateMember":
      var oldMemberName = normalizeMemberName(params.oldName);
      var newMemberName = normalizeMemberName(params.newName);
      if (!oldMemberName || !newMemberName) {
        return handleResponse({ success: false, error: "Both oldName and newName are required" });
      }
      var oldMemberKey = oldMemberName.toLowerCase();
      var newMemberKey = newMemberName.toLowerCase();
      if (oldMemberKey === newMemberKey) {
        return handleResponse({ success: false, error: "oldName and newName are identical" });
      }
      var updateLock = LockService.getScriptLock();
      updateLock.waitLock(5000);
      try {
        var memberSheet = getOrCreateSheet("Members");
        var memberRows = memberSheet.getDataRange().getValues();
        var renamed = false;
        var targetExists = false;
        for (var ck = 1; ck < memberRows.length; ck++) {
          var candidate = normalizeMemberName(memberRows[ck][0]);
          if (!candidate) continue;
          if (candidate.toLowerCase() === newMemberKey) {
            targetExists = true;
            break;
          }
        }
        if (targetExists) {
          return handleResponse({ success: false, error: "Target member already exists" });
        }
        for (var j = 1; j < memberRows.length; j++) {
          var oldCandidate = normalizeMemberName(memberRows[j][0]);
          if (oldCandidate && oldCandidate.toLowerCase() === oldMemberKey) {
            memberSheet.getRange(j + 1, 1).setValue(newMemberName);
            renamed = true;
          }
        }

        var ordersSheetForRename = getOrCreateSheet("Orders");
        var orderRowsForRename = ordersSheetForRename.getDataRange().getValues();
        for (var ri = 1; ri < orderRowsForRename.length; ri++) {
          var orderMember = normalizeMemberName(orderRowsForRename[ri][1]);
          if (orderMember && orderMember.toLowerCase() === oldMemberKey) {
            ordersSheetForRename.getRange(ri + 1, 2).setValue(newMemberName);
          }
        }
        return handleResponse({ success: renamed });
      } finally {
        updateLock.releaseLock();
      }

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
      var libRemarkValue = params.remark || params.tags || "";
      var libIsFavorite = parseSheetBoolean(params.isFavorite);
      libSheet.appendRow([
        params.id || Utilities.getUuid(),
        params.name,
        params.category,
        JSON.stringify(params.storeInfo || {}),
        JSON.stringify(params.items || []),
        params.image || "",
        libRemarkValue,
        new Date().getTime(),
        libIsFavorite,
        "",
        libRemarkValue
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
        var hasParam = function (key) { return Object.prototype.hasOwnProperty.call(params, key); };
        if (hasParam("name")) libSheet2.getRange(foundIndex, 2).setValue(params.name || "");
        if (hasParam("category")) libSheet2.getRange(foundIndex, 3).setValue(params.category || "");
        if (hasParam("storeInfo")) libSheet2.getRange(foundIndex, 4).setValue(JSON.stringify(params.storeInfo || {}));
        if (hasParam("items")) libSheet2.getRange(foundIndex, 5).setValue(JSON.stringify(params.items || []));
        if (params.image !== undefined) libSheet2.getRange(foundIndex, 6).setValue(params.image);
        if (hasParam("isFavorite")) {
          libSheet2.getRange(foundIndex, 9).setValue(parseSheetBoolean(params.isFavorite));
        }
        if (hasParam("remark") || hasParam("tags")) {
          var remarkValue = params.remark || params.tags;
          libSheet2.getRange(foundIndex, 7).setValue(remarkValue);
          libSheet2.getRange(foundIndex, 11).setValue(remarkValue); // Keep remark in column K
        }
        libSheet2.getRange(foundIndex, 8).setValue(new Date().getTime());
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
          var currentFav = parseSheetBoolean(libRows4[fi][8]);
          if (libRows4[fi][8] === "" && libRows4[fi][7] !== "") {
            currentFav = parseSheetBoolean(libRows4[fi][7]);
          }
          libSheet4.getRange(fi + 1, 9).setValue(!currentFav);
          libSheet4.getRange(fi + 1, 8).setValue(new Date().getTime());
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
    result.announcement = getWorksheetObject("Settings", "announcement") || "甇∟?雿輻?芰543閮噶?嗥頂蝯梧?";
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
        isFavorite: parseSheetBoolean(rows[i][8] !== "" ? rows[i][8] : rows[i][7])
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
  var rawRows = sheet.getRange("A2:A").getValues();
  var seen = {};
  var uniqueMembers = [];
  for (var i = 0; i < rawRows.length; i++) {
    var normalized = normalizeMemberName(rawRows[i][0]);
    if (!normalized) continue;
    var dedupeKey = normalized.toLowerCase();
    if (seen[dedupeKey]) continue;
    seen[dedupeKey] = true;
    uniqueMembers.push(normalized);
  }
  return uniqueMembers;
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
    if (name === "Orders") sheet.appendRow(["日期", "成員", "項目JSON", "總額", "ID", "MenuId"]);
    if (name === "Members") sheet.appendRow(["姓名", "新增日期"]);
    if (name === "MenuLibrary") sheet.appendRow(["ID", "名稱", "分類", "店家資訊JSON", "項目JSON", "圖片", "備註", "更新時間", "最愛", "保留", "Remark"]);
    if (name === "MenuHistory") sheet.appendRow(["ID", "名稱", "項目JSON", "圖片", "店家資訊JSON", "備註"]);
  }
  return sheet;
}

function normalizeMemberName(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function memberExists(memberName) {
  var normalized = normalizeMemberName(memberName).toLowerCase();
  if (!normalized) return false;
  var members = getMembersList();
  for (var i = 0; i < members.length; i++) {
    if (normalizeMemberName(members[i]).toLowerCase() === normalized) {
      return true;
    }
  }
  return false;
}

function parseSheetBoolean(value) {
  if (value === true || value === false) return value;
  if (value === 1) return true;
  if (value === 0) return false;
  var normalized = String(value === undefined || value === null ? "" : value).trim().toUpperCase();
  return normalized === "TRUE" || normalized === "1" || normalized === "YES";
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

function getLineNotifyConfig() {
  var props = PropertiesService.getScriptProperties();
  var channelAccessToken = props.getProperty("LINE_CHANNEL_ACCESS_TOKEN") || props.getProperty("LINE_ACCESS_TOKEN") || "";
  var channelSecret = props.getProperty("LINE_CHANNEL_SECRET") || "";
  var targetGroupId = props.getProperty("LINE_TARGET_GROUP_ID") || props.getProperty("LINE_GROUP_ID") || "";
  var appFrontendUrl = props.getProperty("APP_FRONTEND_URL") || props.getProperty("FRONTEND_URL") || "";

  return {
    channelAccessToken: String(channelAccessToken || "").trim(),
    channelSecret: String(channelSecret || "").trim(),
    targetGroupId: String(targetGroupId || "").trim(),
    appFrontendUrl: String(appFrontendUrl || "").trim()
  };
}

function buildLineTestMenuPayload(params, status) {
  var p = params || {};
  var current = getWorksheetObject("Settings", "current_menu") || {};
  var now = new Date();
  var oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  var isPublish = String(status || "").toLowerCase() === "publish";

  var defaultItems = [
    { name: "測試招牌飯", price: 110 },
    { name: "測試雞腿便當", price: 120 },
    { name: "測試蔬食餐盒", price: 100 }
  ];

  var parsedItems = Array.isArray(p.items) ? p.items : null;
  var fallbackItems = Array.isArray(current.items) && current.items.length > 0 ? current.items : defaultItems;

  return {
    posted: isPublish,
    items: parsedItems && parsedItems.length > 0 ? parsedItems : fallbackItems,
    closingTime: p.closingTime || current.closingTime || Utilities.formatDate(oneHourLater, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"),
    image: p.image || current.image || "",
    storeInfo: p.storeInfo || current.storeInfo || { name: p.storeName || "測試店家", phone: "", address: "" },
    remark: p.remark || current.remark || (isPublish ? "測試菜單已上架，歡迎開始點餐。" : "測試菜單已下架，暫停接單。"),
    lastUpdated: String(new Date().getTime())
  };
}

function sendLineMenuStatusNotification(status, menu) {
  try {
    var config = getLineNotifyConfig();
    if (!config.channelAccessToken) return { sent: false, skipped: true, reason: "missing_line_access_token" };
    if (!config.targetGroupId) return { sent: false, skipped: true, reason: "missing_line_target_group_id" };

    var menuData = menu || {};
    var flex = buildMenuStatusFlexMessage(status, menuData, config.appFrontendUrl);
    if (!flex || !flex.contents) return { sent: false, skipped: true, reason: "invalid_flex_payload" };

    var payload = {
      to: config.targetGroupId,
      messages: [{
        type: "flex",
        altText: flex.altText,
        contents: flex.contents
      }]
    };

    var response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + config.channelAccessToken
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return { sent: true, code: code };
    }
    return {
      sent: false,
      code: code,
      error: response.getContentText()
    };
  } catch (err) {
    return { sent: false, error: err.toString() };
  }
}

function buildMenuStatusFlexMessage(status, menu, appFrontendUrl) {
  var safeMenu = menu || {};
  var isPublish = String(status || "").toLowerCase() === "publish";
  if (isPublish) {
    return buildLinePublishFlexMessage(safeMenu, appFrontendUrl);
  }
  return buildLineUnpublishFlexMessage(safeMenu, appFrontendUrl);
}

function buildLinePublishFlexMessage(menu, appFrontendUrl) {
  var storeName = (menu.storeInfo && menu.storeInfo.name) ? String(menu.storeInfo.name) : "\u672a\u547d\u540d\u5e97\u5bb6";
  var itemCount = Array.isArray(menu.items) ? menu.items.length : 0;
  var closingDisplay = formatLineClosingTimeZh(menu.closingTime);
  var topItems = summarizeMenuItemNames(menu.items, 3) || "\u672a\u63d0\u4f9b\u7cbe\u9078";
  var heroImageUrl = "https://raw.githubusercontent.com/kadasup/Ding0402/main/public/publish.png";
  var orderUrl = isValidHttpsUrl(appFrontendUrl) ? appFrontendUrl : "https://example.com/ding";

  return {
    altText: "\u3010\u83dc\u55ae\u5df2\u4e0a\u67b6\u3011" + storeName + "\uff0c\u5171 " + itemCount + " \u9805",
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: heroImageUrl,
        size: "full",
        aspectRatio: "20:11",
        aspectMode: "fit"
      },
      header: {
        type: "box",
        layout: "baseline",
        backgroundColor: "#78B159",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "\u83dc\u55ae\u4e0a\u67b6\u901a\u77e5",
            color: "#FFFFFF",
            size: "sm",
            weight: "bold"
          },
          {
            type: "text",
            text: "\u5df2\u4e0a\u67b6",
            color: "#FFFFFF",
            size: "xs",
            align: "end"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "14px",
        contents: [
          {
            type: "text",
            text: "\u83dc\u55ae\u5df2\u4e0a\u67b6\uff0c\u958b\u59cb\u9ede\u9910\u56c9\uff01",
            weight: "bold",
            size: "xl",
            color: "#5A4D41",
            wrap: true
          },
          {
            type: "box",
            layout: "baseline",
            margin: "md",
            paddingAll: "10px",
            backgroundColor: "#FEF3C7",
            cornerRadius: "10px",
            contents: [
              { type: "text", text: "\u220e \u5e97\u5bb6\uff1a", size: "sm", color: "#92400E", weight: "bold", flex: 2 },
              { type: "text", text: storeName, size: "xl", color: "#7C2D12", weight: "bold", wrap: true, flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            margin: "sm",
            contents: [
              { type: "text", text: "\u220e \u54c1\u9805", size: "md", color: "#7C6044", flex: 2 },
              { type: "text", text: itemCount + " \u9805", size: "md", color: "#5A4D41", wrap: true, flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            margin: "sm",
            contents: [
              { type: "text", text: "\u220e \u622a\u6b62", size: "md", color: "#7C6044", flex: 2 },
              { type: "text", text: closingDisplay, size: "md", color: "#5A4D41", wrap: true, flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            margin: "sm",
            contents: [
              { type: "text", text: "\u220e \u7cbe\u9078", size: "md", color: "#7C6044", flex: 2 },
              { type: "text", text: topItems, size: "md", color: "#5A4D41", wrap: true, flex: 5 }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "12px",
        backgroundColor: "#FFFBE6",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#78B159",
            action: {
              type: "uri",
              label: "\u7acb\u5373\u9ede\u9910",
              uri: orderUrl
            }
          }
        ]
      },
      styles: {
        body: { backgroundColor: "#FFFBE6" },
        footer: { separator: true }
      }
    }
  };
}
function buildLineUnpublishFlexMessage(menu, appFrontendUrl) {
  var storeName = (menu.storeInfo && menu.storeInfo.name) ? String(menu.storeInfo.name) : "\u672a\u547d\u540d\u5e97\u5bb6";
  var closingDisplay = formatLineClosingTimeZh(menu.closingTime);
  var heroImageUrl = "https://raw.githubusercontent.com/kadasup/Ding0402/main/public/unpublish.png";
  var viewUrl = isValidHttpsUrl(appFrontendUrl) ? appFrontendUrl : "https://example.com/ding";
  var detailUrl = viewUrl + (viewUrl.indexOf("?") >= 0 ? "&" : "?") + "focus=current-round";

  return {
    altText: "\u3010\u5df2\u7d50\u55ae\u901a\u77e5\u3011" + storeName + "\uff0c\u672c\u8f2a\u5df2\u7d50\u55ae",
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: heroImageUrl,
        size: "full",
        aspectRatio: "20:11",
        aspectMode: "fit"
      },
      header: {
        type: "box",
        layout: "horizontal",
        backgroundColor: "#B87434",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: "\u7d50\u55ae\u901a\u77e5",
            color: "#FFFFFF",
            size: "sm",
            weight: "bold"
          },
          {
            type: "text",
            text: "\u5df2\u7d50\u55ae",
            color: "#FFFFFF",
            size: "xs",
            align: "end"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "14px",
        contents: [
          {
            type: "text",
            text: "\u5df2\u7d50\u55ae\uff0c\u4e0b\u6b21\u8acb\u65e9\uff01",
            weight: "bold",
            size: "xl",
            color: "#5A4D41",
            wrap: true
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            margin: "md",
            contents: [
              { type: "text", text: "\u220e \u5e97\u5bb6", size: "md", color: "#7C6044", flex: 2 },
              { type: "text", text: storeName, size: "md", color: "#5A4D41", wrap: true, flex: 5 }
            ]
          },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            margin: "sm",
            contents: [
              { type: "text", text: "\u220e \u622a\u6b62", size: "md", color: "#7C6044", flex: 2 },
              { type: "text", text: closingDisplay, size: "md", color: "#5A4D41", wrap: true, flex: 5 }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "12px",
        backgroundColor: "#FFFBE6",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#B87434",
            action: {
              type: "uri",
              label: "\u67e5\u770b\u8a02\u55ae\u660e\u7d30",
              uri: detailUrl
            }
          }
        ]
      },
      styles: {
        body: { backgroundColor: "#FFFBE6" },
        footer: { separator: true }
      }
    }
  };
}
function resolveLineImageUrl(value) {

  var url = String(value || "").trim();
  if (!url || !isValidHttpsUrl(url)) return "";
  if (/^https:\/\/drive\.google\.com\/file\/d\//i.test(url)) {
    var m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m && m[1]) {
      return "https://lh3.googleusercontent.com/d/" + m[1] + "=w900";
    }
  }
  if (/^https:\/\/drive\.google\.com\/open/i.test(url) || /^https:\/\/drive\.google\.com\/uc/i.test(url)) {
    var m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
    if (m2 && m2[1]) {
      return "https://lh3.googleusercontent.com/d/" + m2[1] + "=w900";
    }
  }
  return url;
}

// Manual testing helper: run in Apps Script editor when menu state can't be toggled right now.
function testSendLineMenuCards() {
  var publishResult = sendLineMenuStatusNotification("publish", buildLineTestMenuPayload({}, "publish"));
  Utilities.sleep(500);
  var unpublishResult = sendLineMenuStatusNotification("unpublish", buildLineTestMenuPayload({}, "unpublish"));
  Logger.log(JSON.stringify({ publish: publishResult, unpublish: unpublishResult }));
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
          { type: "text", text: "Analyze this menu image and return JSON only: {\"items\":[{\"name\":\"...\",\"price\":0}],\"storeInfo\":{\"name\":\"...\",\"phone\":\"...\",\"address\":\"...\"},\"remark\":\"...\"}. Important language rule: output item names in Traditional Chinese. If both Chinese and English appear for the same item, use the Chinese name only (do not output English translation)." },
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



