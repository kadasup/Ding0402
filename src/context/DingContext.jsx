import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getLocalDateKey, isSameLocalDate } from '../utils/date';

const DingContext = createContext();

export const MENU_CATEGORIES = [
  { id: 'chinese', label: '中式', color: '#E74C3C' },
  { id: 'western', label: '西式', color: '#3498DB' },
  { id: 'japanese', label: '日式', color: '#E67E22' },
  { id: 'korean', label: '韓式', color: '#9B59B6' },
  { id: 'other', label: '其他', color: '#95A5A6' },
];

const INITIAL_DATA = {
  members: [],
  orders: [],
  menu: {
    date: getLocalDateKey(),
    items: [],
    posted: false,
    lastUpdated: null,
    closingTime: '',
    image: '',
    storeInfo: { name: '', address: '', phone: '' },
    remark: '',
  },
  menuHistory: [],
  menuLibrary: [],
  announcement: '歡迎使用 Ding 便當系統',
};

const SYNC_PROTECTION_TIME = 3000;
const ALL_SECTIONS = ['core', 'orders', 'library', 'history', 'uploadStatus', 'debug'];
const REQUEST_TIMEOUT_MS = 10000;
const REQUEST_RETRIES = 1;

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

export const DingProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [toast, setToast] = useState(null);

  const lastMenuUpdate = useRef(0);
  const pendingMenuState = useRef(null);
  const lastOrderUpdate = useRef(0);
  const lastLibraryUpdate = useRef(0);
  const lastHistoryUpdate = useRef(0);
  const refreshTimer = useRef(null);
  const dedupeInFlight = useRef(new Set());
  const activeRequestCount = useRef(0);
  const toastTimer = useRef(null);

  const envGasUrl = import.meta.env.VITE_GAS_URL || '';
  const [gasUrl, setGasUrl] = useState(() => {
    const saved = localStorage.getItem('ding_gas_url');
    if (!saved || saved === 'null' || saved === 'undefined' || saved === '') return envGasUrl;
    return saved;
  });

  const beginPending = useCallback((label = '處理中，請稍候...') => {
    activeRequestCount.current += 1;
    setPendingCount(activeRequestCount.current);
    if (label) setStatusText(label);
  }, []);

  const endPending = useCallback(() => {
    activeRequestCount.current = Math.max(0, activeRequestCount.current - 1);
    setPendingCount(activeRequestCount.current);
    if (activeRequestCount.current === 0) {
      setStatusText('');
    }
  }, []);

  const pushToast = useCallback((type, message, duration = 2200) => {
    if (!message) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: `${Date.now()}_${Math.random()}`, type, message });
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, duration);
  }, []);

  const clearToast = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast(null);
  }, []);

  const fetchWithTimeout = useCallback(async (url, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const mergeRemoteData = useCallback((prevData, remoteData = {}) => {
    const now = Date.now();
    const hasMenu = hasOwn(remoteData, 'menu');
    const hasOrders = hasOwn(remoteData, 'orders');
    const hasMembers = hasOwn(remoteData, 'members');
    const hasLibrary = hasOwn(remoteData, 'menuLibrary');
    const hasHistory = hasOwn(remoteData, 'menuHistory');
    const hasAnnouncement = hasOwn(remoteData, 'announcement');
    const hasUploadStatus = hasOwn(remoteData, 'lastUploadStatus');
    const hasDebugSheets = hasOwn(remoteData, 'debugSheets');

    const json = {
      ...prevData,
      ...(hasMembers ? { members: remoteData.members || [] } : {}),
      ...(hasOrders ? { orders: remoteData.orders || [] } : {}),
      ...(hasLibrary ? { menuLibrary: remoteData.menuLibrary || [] } : {}),
      ...(hasHistory ? { menuHistory: remoteData.menuHistory || [] } : {}),
      ...(hasAnnouncement ? { announcement: remoteData.announcement || '' } : {}),
      ...(hasUploadStatus ? { lastUploadStatus: remoteData.lastUploadStatus || null } : {}),
      ...(hasDebugSheets ? { debugSheets: remoteData.debugSheets || [] } : {}),
      menu: hasMenu
        ? {
            ...INITIAL_DATA.menu,
            ...(prevData?.menu || {}),
            ...(remoteData?.menu || {}),
          }
        : (prevData?.menu || INITIAL_DATA.menu),
    };

    let finalMenu = json.menu;
    if (hasMenu && now - lastMenuUpdate.current < SYNC_PROTECTION_TIME) {
      const localMenu = prevData.menu || INITIAL_DATA.menu;
      const remoteMenu = json.menu || INITIAL_DATA.menu;

      if (remoteMenu.lastUpdated !== localMenu.lastUpdated || remoteMenu.posted !== localMenu.posted) {
        finalMenu = {
          ...remoteMenu,
          ...localMenu,
          posted: pendingMenuState.current !== null ? pendingMenuState.current : localMenu.posted,
        };
      } else {
        pendingMenuState.current = null;
      }
    }

    let finalOrders = json.orders || [];
    if (!hasOrders || now - lastOrderUpdate.current < SYNC_PROTECTION_TIME) {
      finalOrders = prevData.orders || [];
    }

    let finalLibrary = json.menuLibrary || [];
    if (!hasLibrary || now - lastLibraryUpdate.current < SYNC_PROTECTION_TIME) {
      finalLibrary = prevData.menuLibrary || [];
    }

    let finalHistory = json.menuHistory || [];
    if (!hasHistory || now - lastHistoryUpdate.current < SYNC_PROTECTION_TIME) {
      finalHistory = prevData.menuHistory || [];
    }

    return {
      ...INITIAL_DATA,
      ...json,
      menu: finalMenu,
      orders: finalOrders,
      menuLibrary: finalLibrary,
      menuHistory: finalHistory,
    };
  }, []);

  const fetchData = useCallback(async (sections = ALL_SECTIONS, options = {}) => {
    if (!gasUrl) return null;

    const sectionList = Array.isArray(sections) && sections.length ? sections : ALL_SECTIONS;
    const params = new URLSearchParams();
    params.set('sections', sectionList.join(','));
    params.set('t', Date.now().toString());
    const shouldShowLoading = options.silent !== true;
    const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    const retries = options.retries ?? REQUEST_RETRIES;
    const label = options.label ?? '資料載入中...';

    if (shouldShowLoading) {
      setLoading(true);
      beginPending(label);
    }
    try {
      let lastErr = null;
      let res = null;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          res = await fetchWithTimeout(`${gasUrl}?${params.toString()}`, { cache: 'no-store' }, timeoutMs);
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
          }
        }
      }
      if (!res) throw lastErr || new Error('Fetch failed');
      const json = await res.json();
      setData(prevData => mergeRemoteData(prevData, json));
      return json;
    } catch (err) {
      console.error('Fetch Data Error:', err);
      if (shouldShowLoading) {
        pushToast('error', err?.name === 'AbortError' ? '讀取逾時，請稍後再試。' : '讀取資料失敗，請稍後再試。');
      }
      return null;
    } finally {
      if (shouldShowLoading) {
        setLoading(false);
        endPending();
      }
    }
  }, [beginPending, endPending, fetchWithTimeout, gasUrl, mergeRemoteData, pushToast]);

  const scheduleRefresh = useCallback((delay = 150, sections = ALL_SECTIONS) => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }

    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void fetchData(sections, { silent: true });
    }, delay);
  }, [fetchData]);

  useEffect(() => {
    if (!gasUrl) return;
    void fetchData();
  }, [gasUrl, fetchData]);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const callGAS = useCallback(async (action, payload = {}, options = {}) => {
    if (!gasUrl) return { error: '未設定 Web App URL' };

    const {
      fireAndForget = false,
      refresh = true,
      refreshDelay,
      refreshSections = ALL_SECTIONS,
      timeoutMs = REQUEST_TIMEOUT_MS,
      retries = REQUEST_RETRIES,
      label = '處理中，請稍候...',
      silent = true,
      dedupeKey = '',
      successToast = '',
      errorToast = true,
    } = options;

    if (dedupeKey && dedupeInFlight.current.has(dedupeKey)) {
      return { skippedDuplicate: true };
    }
    if (dedupeKey) {
      dedupeInFlight.current.add(dedupeKey);
    }
    if (!silent) {
      beginPending(label);
    }

    const requestBody = JSON.stringify({ action, ...payload, _t: Date.now() });

    const runCorsRequest = async () => {
      const res = await fetchWithTimeout(gasUrl, { method: 'POST', body: requestBody }, timeoutMs);
      const responseText = await res.text();
      if (!responseText) return null;
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid GAS response: ${parseError?.message || 'parse failed'}`);
      }
    };

    const runNoCorsFallback = async () => {
      await fetchWithTimeout(gasUrl, { method: 'POST', mode: 'no-cors', body: requestBody }, timeoutMs);
      return { opaque: true };
    };

    const finalize = () => {
      if (!silent) endPending();
      if (dedupeKey) dedupeInFlight.current.delete(dedupeKey);
    };

    const applyPostRefresh = () => {
      if (refresh !== false) {
        scheduleRefresh(refreshDelay ?? 150, refreshSections);
      }
    };

    if (fireAndForget) {
      void (async () => {
        let wrote = false;
        try {
          for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
              await runCorsRequest();
              wrote = true;
              break;
            } catch {
              if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 220 * (attempt + 1)));
              }
            }
          }
          if (!wrote) {
            await runNoCorsFallback();
            wrote = true;
          }
          applyPostRefresh();
          if (successToast) pushToast('success', successToast);
        } catch (err) {
          console.error('GAS Action Error:', err);
          if (errorToast) {
            pushToast('error', '操作失敗，請稍後再試。');
          }
        } finally {
          finalize();
        }
      })();
      return { queued: true };
    }

    let lastErr = null;
    try {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const responseData = await runCorsRequest();
          applyPostRefresh();
          if (successToast) pushToast('success', successToast);
          return responseData;
        } catch (err) {
          lastErr = err;
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 220 * (attempt + 1)));
          }
        }
      }

      const fallbackResponse = await runNoCorsFallback();
      applyPostRefresh();
      if (successToast) pushToast('success', successToast);
      return fallbackResponse;
    } catch (err) {
      lastErr = err || lastErr;
      console.error('GAS Action Error:', lastErr);
      const message = lastErr?.name === 'AbortError'
        ? '操作逾時，請稍後再試。'
        : '操作失敗，請檢查網路或稍後再試。';
      if (errorToast) {
        pushToast('error', message);
      }
      return { error: message, detail: lastErr?.message || '' };
    } finally {
      finalize();
    }
  }, [beginPending, endPending, fetchWithTimeout, gasUrl, pushToast, scheduleRefresh]);

  const actions = useMemo(() => ({
    updateGasUrl: (url) => {
      setGasUrl(url);
      localStorage.setItem('ding_gas_url', url);
    },
    loginAdmin: () => setUser({ name: 'Admin', role: 'admin' }),
    loginMember: (name) => setUser(name ? { name, role: 'member' } : null),
    logout: () => setUser(null),
    fetchData: (sections, options) => fetchData(sections, options),
    addMember: (name) => {
      const nextName = String(name || '').trim();
      if (!nextName) return;

      setData(prev => {
        if (prev.members.includes(nextName)) return prev;
        return { ...prev, members: [...prev.members, nextName] };
      });
      void callGAS('addMember', { name: nextName }, {
        refreshSections: ['members'],
        label: '新增成員中...',
        dedupeKey: `member:add:${nextName}`,
      });
    },
    removeMember: (name) => {
      setData(prev => ({ ...prev, members: prev.members.filter(m => m !== name) }));
      void callGAS('removeMember', { name }, {
        refreshSections: ['members'],
        label: '刪除成員中...',
        dedupeKey: `member:remove:${name}`,
      });
    },
    updateMember: (oldName, newName) => {
      const nextName = String(newName || '').trim();
      if (!nextName || oldName === nextName) return;

      setData(prev => ({
        ...prev,
        members: prev.members.map(m => m === oldName ? nextName : m),
        orders: prev.orders.map(order => order.member === oldName ? { ...order, member: nextName } : order),
      }));
      void callGAS('updateMember', { oldName, newName: nextName }, {
        refreshSections: ['members', 'orders'],
        label: '更新成員中...',
        dedupeKey: `member:update:${oldName}:${nextName}`,
      });
    },
    updateMenu: async (items, posted, closingTime, image, storeInfo, remark, keepVersion = true, fastMode = false) => {
      const nowStr = keepVersion && data.menu.lastUpdated ? data.menu.lastUpdated : Date.now().toString();
      lastMenuUpdate.current = Date.now();
      pendingMenuState.current = posted;

      const newMenu = {
        date: getLocalDateKey(),
        items,
        posted,
        closingTime,
        image,
        storeInfo,
        remark,
        lastUpdated: nowStr,
      };

      setData(prev => ({ ...prev, menu: newMenu }));
      if (fastMode) {
        void callGAS('updateMenu', newMenu, {
          fireAndForget: true,
          refreshDelay: 600,
          refreshSections: ['menu'],
          silent: true,
          dedupeKey: `menu:update:fast:${posted ? 'posted' : 'draft'}`,
        });
        return;
      }
      await callGAS('updateMenu', newMenu, {
        refreshSections: ['menu'],
        label: posted ? '上架中...' : '儲存菜單中...',
        dedupeKey: `menu:update:${posted ? 'posted' : 'draft'}`,
      });
    },
    addMenuHistory: (name, items, image, storeInfo, remark = '') => {
      lastHistoryUpdate.current = Date.now();
      void callGAS('addMenuHistory', { name, items, image, storeInfo, remark }, {
        fireAndForget: true,
        silent: true,
        refreshSections: ['history'],
        refreshDelay: 700,
        errorToast: false,
        dedupeKey: `history:add:${name}`,
      });
    },
    deleteMenuHistory: (id) => {
      lastHistoryUpdate.current = Date.now();
      setData(prev => ({ ...prev, menuHistory: prev.menuHistory.filter(h => h.id !== id) }));
      void callGAS('deleteMenuHistory', { id }, {
        refreshSections: ['history'],
        label: '刪除歷史菜單中...',
        dedupeKey: `history:delete:${id}`,
      });
    },
    clearOrders: async (fastMode = false) => {
      lastOrderUpdate.current = Date.now();
      setData(prev => ({ ...prev, orders: [] }));
      const payload = {
        dateKey: getLocalDateKey(),
        menuId: data.menu.lastUpdated || '',
      };
      if (fastMode) {
        void callGAS('clearTodayOrders', payload, {
          fireAndForget: true,
          refreshDelay: 600,
          refreshSections: ['orders'],
          silent: true,
          dedupeKey: 'orders:clear:fast',
        });
        return;
      }
      await callGAS('clearTodayOrders', payload, {
        refreshSections: ['orders'],
        label: '清空今日訂單中...',
        dedupeKey: 'orders:clear',
      });
    },
    placeOrder: (member, items) => {
      lastOrderUpdate.current = Date.now();
      const orderId = `order_${Date.now()}`;
      const total = items.reduce((sum, item) => sum + (item.price || 0), 0);
      const menuId = data.menu.lastUpdated;
      const newOrder = {
        id: orderId,
        member,
        items,
        total,
        date: new Date().toISOString(),
        menuId,
      };

      setData(prev => ({ ...prev, orders: [...prev.orders, newOrder] }));
      void callGAS('addOrder', { member, items, total, orderId, menuId }, {
        refreshSections: ['orders'],
        label: '送出訂單中...',
        dedupeKey: `order:add:${orderId}`,
      });
    },
    deleteOrder: (id) => {
      lastOrderUpdate.current = Date.now();
      setData(prev => ({ ...prev, orders: prev.orders.filter(o => o.id !== id) }));
      void callGAS('removeOrder', { orderId: id }, {
        refreshSections: ['orders'],
        label: '取消訂單中...',
        dedupeKey: `order:remove:${id}`,
      });
    },
    addMenuLibrary: (item) => {
      lastLibraryUpdate.current = Date.now();
      const tempId = item.id || `lib_${Date.now()}`;
      const newItem = { ...item, id: tempId };
      setData(prev => ({ ...prev, menuLibrary: [...prev.menuLibrary, newItem] }));
      void callGAS('addMenuLibrary', newItem, {
        refreshSections: ['library'],
        label: '新增菜單庫中...',
        dedupeKey: `library:add:${tempId}`,
      });
    },
    updateMenuLibrary: (id, updates) => {
      lastLibraryUpdate.current = Date.now();
      setData(prev => ({
        ...prev,
        menuLibrary: prev.menuLibrary.map(m => m.id === id ? { ...m, ...updates } : m),
      }));
      void callGAS('updateMenuLibrary', { id, ...updates }, {
        refreshSections: ['library'],
        label: '更新菜單庫中...',
        dedupeKey: `library:update:${id}`,
      });
    },
    deleteMenuLibrary: (id) => {
      lastLibraryUpdate.current = Date.now();
      setData(prev => ({ ...prev, menuLibrary: prev.menuLibrary.filter(m => m.id !== id) }));
      void callGAS('deleteMenuLibrary', { id }, {
        refreshSections: ['library'],
        label: '刪除菜單庫中...',
        dedupeKey: `library:delete:${id}`,
      });
    },
    toggleFavorite: (id) => {
      lastLibraryUpdate.current = Date.now();
      setData(prev => ({
        ...prev,
        menuLibrary: prev.menuLibrary.map(m => m.id === id ? { ...m, isFavorite: !m.isFavorite } : m),
      }));
      void callGAS('toggleFavorite', { id }, {
        refreshSections: ['library'],
        label: '更新收藏中...',
        dedupeKey: `library:favorite:${id}`,
      });
    },
    updateAnnouncement: async (text) => {
      const nextText = String(text ?? '');
      const prevText = data.announcement;

      // Optimistic update: make UI instant for text-only updates.
      setData(prev => ({ ...prev, announcement: nextText }));

      const result = await callGAS('updateAnnouncement', { text: nextText }, {
        refresh: false,
        label: '發布公告中...',
        dedupeKey: 'announcement:update',
      });
      if (result?.error) {
        // Roll back on explicit backend error.
        setData(prev => ({ ...prev, announcement: prevText }));
        return { persisted: false, result, latestAnnouncement: prevText };
      }

      // Keep verification in background; do not block user feedback.
      setTimeout(() => {
        void fetchData(['announcement'], { silent: true });
      }, 300);

      return {
        persisted: true,
        result,
        latestAnnouncement: nextText,
        optimistic: true,
      };
    },
    uploadImage: async (image, name) => {
      const uploadRes = await callGAS('uploadImage', { image, name }, {
        refresh: false,
        timeoutMs: 20000,
        retries: 1,
        label: '上傳圖片中...',
        dedupeKey: `upload:${name || 'default'}`,
      });
      if (uploadRes?.url) return uploadRes;

      await new Promise(resolve => setTimeout(resolve, 700));
      const latest = await fetchData(['uploadStatus'], { silent: true });
      const lastUpload = latest?.lastUploadStatus;
      if (lastUpload && lastUpload.ok && (!name || lastUpload.name === name)) {
        return {
          success: true,
          url: lastUpload.url,
          fileId: lastUpload.fileId,
          name: lastUpload.name,
          viaFallback: true,
        };
      }
      return uploadRes;
    },
    ocrMenu: async (image) => {
      return callGAS('ocrMenu', { image }, {
        refresh: false,
        timeoutMs: 20000,
        retries: 1,
        label: 'AI 辨識中...',
      });
    },
  }), [callGAS, data.announcement, data.menu.lastUpdated, fetchData]);

  const getTodayOrders = useCallback(() => {
    const today = getLocalDateKey();
    return (data.orders || []).filter(o => isSameLocalDate(o.date, today));
  }, [data.orders]);

  const ui = useMemo(() => ({
    pending: pendingCount > 0,
    pendingCount,
    statusText,
    toast,
    clearToast,
    pushToast,
  }), [clearToast, pendingCount, pushToast, statusText, toast]);

  return (
    <DingContext.Provider value={{ user, data, loading, gasUrl, actions, getTodayOrders, ui }}>
      {children}
    </DingContext.Provider>
  );
};

export const useDing = () => useContext(DingContext);
