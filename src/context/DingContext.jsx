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

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

export const DingProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(false);

  const lastMenuUpdate = useRef(0);
  const pendingMenuState = useRef(null);
  const lastOrderUpdate = useRef(0);
  const lastLibraryUpdate = useRef(0);
  const lastHistoryUpdate = useRef(0);
  const refreshTimer = useRef(null);

  const envGasUrl = import.meta.env.VITE_GAS_URL || '';
  const [gasUrl, setGasUrl] = useState(() => {
    const saved = localStorage.getItem('ding_gas_url');
    if (!saved || saved === 'null' || saved === 'undefined' || saved === '') return envGasUrl;
    return saved;
  });

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

    if (shouldShowLoading) {
      setLoading(true);
    }
    try {
      const res = await fetch(`${gasUrl}?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      setData(prevData => mergeRemoteData(prevData, json));
      return json;
    } catch (err) {
      console.error('Fetch Data Error:', err);
      return null;
    } finally {
      if (shouldShowLoading) {
        setLoading(false);
      }
    }
  }, [gasUrl, mergeRemoteData]);

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
    };
  }, []);

  const callGAS = useCallback(async (action, payload = {}, options = {}) => {
    if (!gasUrl) return null;

    const requestBody = JSON.stringify({ action, ...payload, _t: Date.now() });
    if (options.fireAndForget) {
      fetch(gasUrl, {
        method: 'POST',
        body: requestBody,
      })
        .then(() => {
          if (options.refresh !== false) {
            scheduleRefresh(options.refreshDelay ?? 600, options.refreshSections || ALL_SECTIONS);
          }
        })
        .catch(() => {
          fetch(gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: requestBody,
          })
            .then(() => {
              if (options.refresh !== false) {
                scheduleRefresh(options.refreshDelay ?? 800, options.refreshSections || ALL_SECTIONS);
              }
            })
            .catch((retryErr) => {
              console.error('GAS Action Error:', retryErr);
            });
        });
      return { queued: true };
    }

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        body: requestBody,
      });

      const responseText = await res.text();
      let responseData = null;
      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch (parseError) {
        console.error('GAS Response Parse Error:', parseError, responseText);
        return { error: 'Invalid GAS response', raw: responseText };
      }

      if (options.refresh !== false) {
        scheduleRefresh(options.refreshDelay ?? 150, options.refreshSections || ALL_SECTIONS);
      }

      return responseData;
    } catch (err) {
      // CORS can block reading the response even when GAS still receives the POST.
      // Retry with no-cors so write actions still go through in strict browser environments.
      try {
        await fetch(gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: requestBody,
        });
        if (options.refresh !== false) {
          scheduleRefresh(options.refreshDelay ?? 350, options.refreshSections || ALL_SECTIONS);
        }
        return { opaque: true };
      } catch (retryErr) {
        console.error('GAS Action Error:', retryErr);
        return null;
      }
    }
  }, [gasUrl, scheduleRefresh]);

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
      void callGAS('addMember', { name: nextName }, { refreshSections: ['members'] });
    },
    removeMember: (name) => {
      setData(prev => ({ ...prev, members: prev.members.filter(m => m !== name) }));
      void callGAS('removeMember', { name }, { refreshSections: ['members'] });
    },
    updateMember: (oldName, newName) => {
      const nextName = String(newName || '').trim();
      if (!nextName || oldName === nextName) return;

      setData(prev => ({
        ...prev,
        members: prev.members.map(m => m === oldName ? nextName : m),
        orders: prev.orders.map(order => order.member === oldName ? { ...order, member: nextName } : order),
      }));
      void callGAS('updateMember', { oldName, newName: nextName }, { refreshSections: ['members', 'orders'] });
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
        void callGAS('updateMenu', newMenu, { fireAndForget: true, refreshDelay: 600, refreshSections: ['menu'] });
        return;
      }
      await callGAS('updateMenu', newMenu, { refreshSections: ['menu'] });
    },
    addMenuHistory: (name, items, image, storeInfo, remark = '') => {
      lastHistoryUpdate.current = Date.now();
      void callGAS('addMenuHistory', { name, items, image, storeInfo, remark }, { refreshSections: ['history'] });
    },
    deleteMenuHistory: (id) => {
      lastHistoryUpdate.current = Date.now();
      setData(prev => ({ ...prev, menuHistory: prev.menuHistory.filter(h => h.id !== id) }));
      void callGAS('deleteMenuHistory', { id }, { refreshSections: ['history'] });
    },
    clearOrders: async (fastMode = false) => {
      lastOrderUpdate.current = Date.now();
      setData(prev => ({ ...prev, orders: [] }));
      const payload = {
        dateKey: getLocalDateKey(),
        menuId: data.menu.lastUpdated || '',
      };
      if (fastMode) {
        void callGAS('clearTodayOrders', payload, { fireAndForget: true, refreshDelay: 600, refreshSections: ['orders'] });
        return;
      }
      await callGAS('clearTodayOrders', payload, { refreshSections: ['orders'] });
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
      void callGAS('addOrder', { member, items, total, orderId, menuId }, { refreshSections: ['orders'] });
    },
    deleteOrder: (id) => {
      lastOrderUpdate.current = Date.now();
      setData(prev => ({ ...prev, orders: prev.orders.filter(o => o.id !== id) }));
      void callGAS('removeOrder', { orderId: id }, { refreshSections: ['orders'] });
    },
    addMenuLibrary: (item) => {
      lastLibraryUpdate.current = Date.now();
      const tempId = item.id || `lib_${Date.now()}`;
      const newItem = { ...item, id: tempId };
      setData(prev => ({ ...prev, menuLibrary: [...prev.menuLibrary, newItem] }));
      void callGAS('addMenuLibrary', newItem, { refreshSections: ['library'] });
    },
    updateMenuLibrary: (id, updates) => {
      lastLibraryUpdate.current = Date.now();
      setData(prev => ({
        ...prev,
        menuLibrary: prev.menuLibrary.map(m => m.id === id ? { ...m, ...updates } : m),
      }));
      void callGAS('updateMenuLibrary', { id, ...updates }, { refreshSections: ['library'] });
    },
    deleteMenuLibrary: (id) => {
      lastLibraryUpdate.current = Date.now();
      setData(prev => ({ ...prev, menuLibrary: prev.menuLibrary.filter(m => m.id !== id) }));
      void callGAS('deleteMenuLibrary', { id }, { refreshSections: ['library'] });
    },
    toggleFavorite: (id) => {
      lastLibraryUpdate.current = Date.now();
      setData(prev => ({
        ...prev,
        menuLibrary: prev.menuLibrary.map(m => m.id === id ? { ...m, isFavorite: !m.isFavorite } : m),
      }));
      void callGAS('toggleFavorite', { id }, { refreshSections: ['library'] });
    },
    updateAnnouncement: async (text) => {
      const nextText = String(text ?? '');
      const prevText = data.announcement;

      // Optimistic update: make UI instant for text-only updates.
      setData(prev => ({ ...prev, announcement: nextText }));

      const result = await callGAS('updateAnnouncement', { text: nextText }, { refresh: false });
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
      const uploadRes = await callGAS('uploadImage', { image, name }, { refresh: false });
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
      return callGAS('ocrMenu', { image }, { refresh: false });
    },
  }), [callGAS, data.announcement, data.menu.lastUpdated, fetchData]);

  const getTodayOrders = useCallback(() => {
    const today = getLocalDateKey();
    return (data.orders || []).filter(o => isSameLocalDate(o.date, today));
  }, [data.orders]);

  return (
    <DingContext.Provider value={{ user, data, loading, gasUrl, actions, getTodayOrders }}>
      {children}
    </DingContext.Provider>
  );
};

export const useDing = () => useContext(DingContext);
