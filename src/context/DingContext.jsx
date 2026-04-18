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
const INITIAL_SECTIONS = ['core'];
const REQUEST_TIMEOUT_MS = 10000;
const REQUEST_RETRIES = 1;
const ORDERS_CACHE_KEY = 'ding_orders_cache_v1';
const ORDERS_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 8;
const CORE_CACHE_KEY = 'ding_core_cache_v1';
const CORE_CACHE_MAX_AGE_MS = 1000 * 60 * 30;
const LIBRARY_CACHE_KEY = 'ding_library_cache_v1';
const HISTORY_CACHE_KEY = 'ding_history_cache_v1';
const BACKOFFICE_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 8;

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
  const bootstrappedGasUrlRef = useRef('');

  const envGasUrl = import.meta.env.VITE_GAS_URL || '';
  const [gasUrl, setGasUrl] = useState(() => {
    const saved = localStorage.getItem('ding_gas_url');
    if (!saved || saved === 'null' || saved === 'undefined' || saved === '') return envGasUrl;
    return saved;
  });

  const readTimedCache = useCallback((cacheKey, maxAgeMs) => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      const savedAt = Number(parsed.savedAt || 0);
      if (!savedAt || Date.now() - savedAt > maxAgeMs) return null;

      const payload = parsed.payload;
      if (!payload || typeof payload !== 'object') return null;
      return payload;
    } catch {
      return null;
    }
  }, []);

  const writeTimedCache = useCallback((cacheKey, payload = {}) => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        savedAt: Date.now(),
        payload,
      }));
    } catch {
      // Ignore storage errors for cache path.
    }
  }, []);

  const readOrdersCache = useCallback((menuId = '') => {
    try {
      const raw = localStorage.getItem(ORDERS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.orders)) return null;

      const cachedDate = String(parsed.dateKey || '');
      if (!cachedDate || cachedDate !== getLocalDateKey()) return null;

      const savedAt = Number(parsed.savedAt || 0);
      if (!savedAt || Date.now() - savedAt > ORDERS_CACHE_MAX_AGE_MS) return null;

      const cachedMenuId = String(parsed.menuId || '');
      const requiredMenuId = String(menuId || '');
      if (requiredMenuId && cachedMenuId && requiredMenuId !== cachedMenuId) return null;

      return { orders: parsed.orders, menuId: cachedMenuId };
    } catch {
      return null;
    }
  }, []);

  const writeOrdersCache = useCallback((orders, menuId = '') => {
    try {
      const normalizedOrders = Array.isArray(orders) ? orders : [];
      const normalizedMenuId = String(menuId || '');
      if (!normalizedMenuId) return;

      localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        dateKey: getLocalDateKey(),
        menuId: normalizedMenuId,
        orders: normalizedOrders,
      }));
    } catch {
      // Ignore storage quota/permission errors for non-critical cache path.
    }
  }, []);

  const hydrateOrdersFromCache = useCallback((menuId = '') => {
    const cached = readOrdersCache(menuId);
    if (!cached) return false;

    setData(prev => {
      if ((prev.orders || []).length > 0) return prev;
      return { ...prev, orders: cached.orders || [] };
    });
    return true;
  }, [readOrdersCache]);

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

  const readCoreCache = useCallback(
    () => readTimedCache(CORE_CACHE_KEY, CORE_CACHE_MAX_AGE_MS),
    [readTimedCache]
  );

  const writeCoreCache = useCallback(
    (payload = {}) => writeTimedCache(CORE_CACHE_KEY, payload),
    [writeTimedCache]
  );

  const hydrateCoreFromCache = useCallback(() => {
    const cached = readCoreCache();
    if (!cached) return false;

    setData(prev => mergeRemoteData(prev, cached));
    return true;
  }, [mergeRemoteData, readCoreCache]);

  const hydrateBackofficeFromCache = useCallback(() => {
    const cachedLibrary = readTimedCache(LIBRARY_CACHE_KEY, BACKOFFICE_CACHE_MAX_AGE_MS);
    const cachedHistory = readTimedCache(HISTORY_CACHE_KEY, BACKOFFICE_CACHE_MAX_AGE_MS);
    const snapshot = {
      ...(Array.isArray(cachedLibrary?.menuLibrary) ? { menuLibrary: cachedLibrary.menuLibrary } : {}),
      ...(Array.isArray(cachedHistory?.menuHistory) ? { menuHistory: cachedHistory.menuHistory } : {}),
    };

    if (!hasOwn(snapshot, 'menuLibrary') && !hasOwn(snapshot, 'menuHistory')) {
      return false;
    }

    setData(prev => mergeRemoteData(prev, snapshot));
    return true;
  }, [mergeRemoteData, readTimedCache]);

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
      const requestedCore = sectionList.some(section => section === 'core' || section === 'all');
      if (requestedCore) {
        const coreSnapshot = {
          ...(hasOwn(json, 'menu') ? { menu: json.menu } : {}),
          ...(hasOwn(json, 'members') ? { members: json.members } : {}),
          ...(hasOwn(json, 'announcement') ? { announcement: json.announcement } : {}),
        };
        if (Object.keys(coreSnapshot).length > 0) {
          writeCoreCache(coreSnapshot);
        }
      }
      if (hasOwn(json, 'menuLibrary')) {
        writeTimedCache(LIBRARY_CACHE_KEY, { menuLibrary: json.menuLibrary || [] });
      }
      if (hasOwn(json, 'menuHistory')) {
        writeTimedCache(HISTORY_CACHE_KEY, { menuHistory: json.menuHistory || [] });
      }
      const requestedOrders = sectionList.some(section => section === 'orders' || section === 'all');
      if (requestedOrders && hasOwn(json, 'orders')) {
        const firstOrderWithMenu = Array.isArray(json.orders)
          ? json.orders.find(order => order && order.menuId !== undefined && order.menuId !== null)
          : null;
        const menuIdForCache = String(
          json?.menu?.lastUpdated
          || firstOrderWithMenu?.menuId
          || ''
        );
        writeOrdersCache(json.orders || [], menuIdForCache);
      }
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
  }, [beginPending, endPending, fetchWithTimeout, gasUrl, mergeRemoteData, pushToast, writeCoreCache, writeOrdersCache, writeTimedCache]);

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
    if (bootstrappedGasUrlRef.current === gasUrl) return;
    bootstrappedGasUrlRef.current = gasUrl;
    let cancelled = false;

    const bootstrap = async () => {
      const hashPath = typeof window !== 'undefined'
        ? String(window.location.hash || '').replace(/^#/, '') || '/'
        : '/';
      const isHomeRoute = hashPath === '/';
      const hasCoreCache = hydrateCoreFromCache();
      if (!isHomeRoute) {
        hydrateBackofficeFromCache();
      }

      const coreData = await fetchData(
        INITIAL_SECTIONS,
        isHomeRoute
          ? (hasCoreCache ? { silent: true, retries: 0, timeoutMs: 8000 } : {})
          : { silent: true, retries: 0, timeoutMs: 8000 }
      );
      const coreMenuId = String(coreData?.menu?.lastUpdated || '');
      if (!cancelled && coreMenuId) {
        hydrateOrdersFromCache(coreMenuId);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [fetchData, gasUrl, hydrateBackofficeFromCache, hydrateCoreFromCache, hydrateOrdersFromCache]);

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
    addMember: async (name) => {
      const nextName = String(name || '').replace(/\s+/g, ' ').trim();
      if (!nextName) return { ok: false, reason: 'empty' };

      const normalizedName = nextName.toLowerCase();
      let existsLocally = false;
      setData(prev => {
        existsLocally = (prev.members || []).some(
          member => String(member || '').replace(/\s+/g, ' ').trim().toLowerCase() === normalizedName
        );
        if (existsLocally) return prev;
        return { ...prev, members: [...prev.members, nextName] };
      });

      if (existsLocally) {
        return { ok: true, skipped: true, reason: 'exists_local' };
      }

      const result = await callGAS('addMember', { name: nextName }, {
        refreshSections: ['members'],
        label: '新增成員中...',
        dedupeKey: `member:add:${normalizedName}`,
      });

      if (result?.error) {
        setData(prev => ({
          ...prev,
          members: (prev.members || []).filter(
            member => String(member || '').replace(/\s+/g, ' ').trim().toLowerCase() !== normalizedName
          ),
        }));
        return { ok: false, reason: 'request_failed', error: result.error };
      }

      return { ok: true, skipped: result?.exists === true };
    },
    removeMember: async (name) => {
      const normalizedName = String(name || '').replace(/\s+/g, ' ').trim();
      if (!normalizedName) return { ok: false, reason: 'empty' };
      const normalizedKey = normalizedName.toLowerCase();
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

      setData(prev => ({
        ...prev,
        members: (prev.members || []).filter(member => normalize(member) !== normalizedKey),
      }));

      const result = await callGAS('removeMember', { name: normalizedName }, {
        refreshSections: ['members'],
        label: '刪除成員中...',
        dedupeKey: `member:remove:${normalizedKey}`,
      });

      if (result?.error) {
        setData(prev => {
          const exists = (prev.members || []).some(member => normalize(member) === normalizedKey);
          if (exists) return prev;
          return { ...prev, members: [...(prev.members || []), normalizedName] };
        });
        return { ok: false, reason: 'request_failed', error: result.error };
      }

      setTimeout(() => {
        void fetchData(['members'], { silent: true, timeoutMs: 8000, retries: 0 });
      }, 600);
      return { ok: true };
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
      const previousMenu = data.menu;

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
        const fastResult = await callGAS('updateMenu', newMenu, {
          refreshDelay: 600,
          refreshSections: ['menu'],
          silent: true,
          dedupeKey: `menu:update:fast:${posted ? 'posted' : 'draft'}`,
        });
        if (fastResult?.error) {
          pendingMenuState.current = null;
          setData(prev => ({ ...prev, menu: previousMenu }));
          throw new Error(fastResult.error || '更新菜單失敗');
        }
        setTimeout(() => {
          void fetchData(['menu'], { silent: true, timeoutMs: 8000, retries: 0 });
        }, 1200);
        return;
      }
      const result = await callGAS('updateMenu', newMenu, {
        refreshSections: ['menu'],
        label: posted ? '上架中...' : '儲存菜單中...',
        dedupeKey: `menu:update:${posted ? 'posted' : 'draft'}`,
      });
      if (result?.error) {
        pendingMenuState.current = null;
        setData(prev => ({ ...prev, menu: previousMenu }));
        throw new Error(result.error || '更新菜單失敗');
      }
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
    placeOrder: async (member, items) => {
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
      const result = await callGAS('addOrder', { member, items, total, orderId, menuId }, {
        refreshSections: ['orders'],
        label: '送出訂單中...',
        dedupeKey: `order:add:${orderId}`,
      });
      if (result?.error) {
        setData(prev => ({ ...prev, orders: prev.orders.filter(o => o.id !== orderId) }));
        return { ok: false, error: result.error };
      }
      return { ok: true, orderId };
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
