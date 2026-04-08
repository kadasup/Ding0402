import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const DingContext = createContext();

export const MENU_CATEGORIES = [
  { id: 'chinese', label: '🍜 中式', color: '#E74C3C' },
  { id: 'western', label: '🍝 西式', color: '#3498DB' },
  { id: 'japanese', label: '🍣 日式', color: '#E67E22' },
  { id: 'korean', label: '🍲 韓式', color: '#9B59B6' },
  { id: 'other', label: '📋 其他', color: '#95A5A6' },
];

const INITIAL_DATA = {
  members: [],
  orders: [],
  menu: {
    date: new Date().toISOString().split('T')[0],
    items: [],
    posted: false,
    lastUpdated: null,
    closingTime: '',
    image: '',
    storeInfo: { name: '', address: '', phone: '' }
  },
  menuHistory: [],
  menuLibrary: [],
  announcement: "歡迎使用自由543系統！",
};

export const DingProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  
  // 🚀 關鍵修正：補上缺失的 useRef
  const lastMenuUpdate = useRef(0);
  const pendingMenuState = useRef(null);
  const lastOrderUpdate = useRef(0);
  const lastLibraryUpdate = useRef(0);
  const lastHistoryUpdate = useRef(0);

  const envGasUrl = import.meta.env.VITE_GAS_URL || "";
  const [gasUrl, setGasUrl] = useState(() => {
    const saved = localStorage.getItem('ding_gas_url');
    if (!saved || saved === "null" || saved === "undefined" || saved === "") return envGasUrl;
    return saved;
  });

  const fetchData = async () => {
    if (!gasUrl) return;
    setLoading(true);
    try {
      const res = await fetch(`${gasUrl}?t=${Date.now()}`);
      const json = await res.json();
      
      setData(prevData => {
          // 🚀 強度保護：避免伺服器剛收到指令但還沒寫入 Sheet 時回傳的舊資料覆蓋本地狀態
          const now = Date.now();
          const SYNC_PROTECTION_TIME = 15000; // 🚀 15 秒保護期
          
          let finalMenu = json.menu;
          if (now - lastMenuUpdate.current < SYNC_PROTECTION_TIME) {
              const localMenu = prevData.menu;
              const remoteMenu = json.menu;
              if (remoteMenu.lastUpdated !== localMenu.lastUpdated || remoteMenu.posted !== localMenu.posted) {
                  finalMenu = { 
                    ...remoteMenu, 
                    ...localMenu,
                    posted: pendingMenuState.current !== null ? pendingMenuState.current : localMenu.posted
                  };
              }
          }

          let finalOrders = json.orders;
          if (now - lastOrderUpdate.current < SYNC_PROTECTION_TIME) {
              finalOrders = prevData.orders;
          }

          let finalLibrary = json.menuLibrary;
          if (now - lastLibraryUpdate.current < SYNC_PROTECTION_TIME) {
              finalLibrary = prevData.menuLibrary;
          }

          let finalHistory = json.menuHistory;
          if (now - lastHistoryUpdate.current < SYNC_PROTECTION_TIME) {
              finalHistory = prevData.menuHistory;
          }

          return { 
              ...json, 
              menu: finalMenu,
              orders: finalOrders,
              menuLibrary: finalLibrary,
              menuHistory: finalHistory
          };
      });

    } catch (err) {
      console.error("Fetch Data Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 自動重新整理邏輯：僅在連線 URL 變更時載入一次
  useEffect(() => {
    if (!gasUrl) return;
    fetchData(); 
  }, [gasUrl]);



  const callGAS = async (action, payload = {}) => {
    try {
      // 🚀 關鍵優化：使用 fetch 取得回應（原本 no-cors 無法取得 body，現在改回 cors 並處理）
      const res = await fetch(gasUrl, {
        method: "POST",
        body: JSON.stringify({ action, ...payload, _t: Date.now() })
      });
      const data = await res.json();
      
      // 🚀 執行動作後，等待 3.5 秒再重新整理，讓 Google 有足夠時間更新試算表
      setTimeout(fetchData, 3500); 
      return data;
    } catch (err) { console.error("GAS Action Error:", err); return null; }
  };

  const actions = {
    updateGasUrl: (url) => { setGasUrl(url); localStorage.setItem('ding_gas_url', url); },
    loginAdmin: () => setUser({ name: 'Admin', role: 'admin' }),
    loginMember: (name) => setUser({ name, role: 'member' }),
    logout: () => setUser(null),
    addMember: (name) => {
      setData(prev => ({ ...prev, members: [...prev.members, name] }));
      callGAS('addMember', { name });
    },
    removeMember: (name) => {
      setData(prev => ({ ...prev, members: prev.members.filter(m => m !== name) }));
      callGAS('removeMember', { name });
    },
    updateMember: (oldName, newName) => {
      setData(prev => ({ ...prev, members: prev.members.map(m => m === oldName ? newName : m) }));
      callGAS('updateMember', { oldName, newName });
    },
    updateMenu: async (items, posted, closingTime, image, storeInfo, remark, keepVersion = true) => {
      // 🚀 關鍵：如果是結單或一般更新，保留原本的 lastUpdated 作為版本號；如果是重新載入或清空，才換新版本號
      const nowStr = keepVersion && data.menu.lastUpdated ? data.menu.lastUpdated : new Date().getTime().toString();
      lastMenuUpdate.current = Date.now();
      pendingMenuState.current = posted;
      
      const newMenu = { 
        items, posted, closingTime, image, storeInfo, remark,
        lastUpdated: nowStr 
      };

      setData(prev => ({ ...prev, menu: newMenu }));
      
      // 🚀 執行 GAS 更新
      await callGAS('updateMenu', newMenu);
      
      // 🚀 執行完後，手動觸發一次 fetchData，確保 15 秒保護期期間 local 都是 A
      setTimeout(fetchData, 4000);
    },
    addMenuHistory: (name, items, image, storeInfo) => {
      lastHistoryUpdate.current = Date.now();
      callGAS('addMenuHistory', { name, items, image, storeInfo });
    },
    deleteMenuHistory: (id) => {
      lastHistoryUpdate.current = Date.now();
      setData(prev => ({ ...prev, menuHistory: prev.menuHistory.filter(h => h.id !== id) }));
      callGAS('deleteMenuHistory', { id });
    },
    clearOrders: async () => {
      lastOrderUpdate.current = Date.now();
      setData(prev => ({ ...prev, orders: [] }));
      await callGAS('clearTodayOrders', {});
    },
    placeOrder: (member, items) => {
      lastOrderUpdate.current = Date.now();
      const orderId = `order_${Date.now()}`;
      const total = items.reduce((sum, item) => sum + (item.price || 0), 0);
      const menuId = data.menu.lastUpdated; // 🚀 記錄這筆訂單是屬於哪個版本的菜單
      
      setData(prev => ({ 
        ...prev, 
        orders: [...prev.orders, { id: orderId, member, items, total, date: new Date().toISOString(), menuId }] 
      }));
      callGAS('addOrder', { member, items, total, orderId, menuId }); 
    },
    deleteOrder: (id) => {
      lastOrderUpdate.current = Date.now();
      setData(prev => ({ ...prev, orders: prev.orders.filter(o => o.id !== id) }));
      callGAS('removeOrder', { orderId: id }); // 🚀 修正指令為 removeOrder
    },
    addMenuLibrary: (item) => {
      lastLibraryUpdate.current = Date.now();
      // 🚀 樂觀更新：立刻產生 ID 並塞入本地列表，讓畫面瞬間反應
      const tempId = item.id || `lib_${Date.now()}`;
      const newItem = { ...item, id: tempId };
      setData(prev => ({ ...prev, menuLibrary: [...prev.menuLibrary, newItem] }));
      callGAS('addMenuLibrary', newItem);
    },
    updateMenuLibrary: (id, updates) => {
      lastLibraryUpdate.current = Date.now();
      // 🚀 樂觀更新：立刻更新本地列表
      setData(prev => ({ 
        ...prev, 
        menuLibrary: prev.menuLibrary.map(m => m.id === id ? { ...m, ...updates } : m) 
      }));
      callGAS('updateMenuLibrary', { id, ...updates });
    },
    deleteMenuLibrary: (id) => {
      lastLibraryUpdate.current = Date.now();
      // 🚀 樂觀更新：立刻從本地列表移除
      setData(prev => ({ ...prev, menuLibrary: prev.menuLibrary.filter(m => m.id !== id) }));
      callGAS('deleteMenuLibrary', { id });
    },
    toggleFavorite: (id) => {
      lastLibraryUpdate.current = Date.now();
      // 🚀 樂觀更新：立刻切換本地的最愛狀態
      setData(prev => ({ 
        ...prev, 
        menuLibrary: prev.menuLibrary.map(m => m.id === id ? { ...m, isFavorite: !m.isFavorite } : m) 
      }));
      callGAS('toggleFavorite', { id });
    },
    updateAnnouncement: (text) => {
      setData(prev => ({ ...prev, announcement: text }));
      callGAS('updateAnnouncement', { text });
    },
    uploadImage: async (image, name) => {
      return await callGAS('uploadImage', { image, name });
    },
    ocrMenu: async (image) => {
      return await callGAS('ocrMenu', { image });
    }
  };

  const getTodayOrders = () => {
    const today = new Date().toISOString().split('T')[0];
    return (data.orders || []).filter(o => String(o.date).startsWith(today));
  };

  return (
    <DingContext.Provider value={{ user, data, loading, gasUrl, actions, getTodayOrders }}>
      {children}
    </DingContext.Provider>
  );
};

export const useDing = () => useContext(DingContext);
