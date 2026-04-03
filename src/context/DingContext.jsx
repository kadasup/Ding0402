import React, { createContext, useContext, useState, useEffect } from 'react';

const DingContext = createContext();

export const MENU_CATEGORIES = [
  { id: 'chinese', label: '🍜 中式', color: '#E74C3C' },
  { id: 'western', label: '🍝 西式', color: '#3498DB' },
  { id: 'japanese', label: '🍣 日式', color: '#E67E22' },
  { id: 'korean', label: '🍲 韓式', color: '#9B59B6' },
  { id: 'other', label: '📋 其他', color: '#95A5A6' },
];

const DEFAULT_GAS_URL = import.meta.env.VITE_GAS_URL || "";

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
    storeInfo: {
      name: '',
      address: '',
      phone: ''
    }
  },
  menuHistory: [],
  menuLibrary: [], // 菜單庫
  announcement: "載入中...",
};

export const DingProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { name, role: 'admin' | 'member' }
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [gasUrl, setGasUrl] = useState(localStorage.getItem('ding_gas_url') || DEFAULT_GAS_URL);
  const lastMenuUpdate = React.useRef(0); // Timestamp of last local menu update
  const pendingMenuState = React.useRef(null); // Track expected posted state

  // 1. Fetch Data from GAS
  const fetchData = async () => {
    setLoading(true);
    try {
      if (!gasUrl) throw new Error("尚未設定 GAS URL");

      const res = await fetch(`${gasUrl}?t=${new Date().getTime()}`);
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error("JSON Parse Error. Raw response:", text);
        if (text.includes("Google Drive")) {
          throw new Error("URL 錯誤：請確認您使用的是 'Web App URL' 且權限為 'Anyone'");
        }
        throw new Error("Invalid JSON response. (可能是 URL 錯誤或權限不足)");
      }

      // Robust Data Normalization
      if (json.menu) {
        const p = json.menu.posted;
        json.menu.posted = p === true || String(p).toUpperCase() === 'TRUE';

        // Ensure critical arrays/objects exist
        if (!json.menu.items) json.menu.items = [];
        if (!json.menu.closingTime) json.menu.closingTime = '';
        if (!json.menu.storeInfo) json.menu.storeInfo = { name: '', address: '', phone: '' };
        if (!json.menu.image) json.menu.image = '';
      }
      if (json.orders === undefined) json.orders = [];
      if (json.members === undefined) json.members = [];
      if (json.menuHistory === undefined) json.menuHistory = [];
      if (json.menuLibrary === undefined) json.menuLibrary = [];

      if (json && json.menu) {
        const now = Date.now();
        const timeSinceUpdate = now - lastMenuUpdate.current;
        
        // PROTECTIVE LOGIC: If we have a pending menu state update,
        // check if server has caught up. If not, keep local state.
        if (pendingMenuState.current !== null) {
          const serverMatchesExpected = json.menu.posted === pendingMenuState.current;
          if (serverMatchesExpected || timeSinceUpdate > 30000) {
            // Server caught up OR timeout (30s) - accept server data
            console.log("Server synced with local state, accepting server data");
            pendingMenuState.current = null;
            lastMenuUpdate.current = 0;
            setData(json);
          } else {
            // Server hasn't caught up yet - keep local menu state
            console.log(`GAS lag protection: server posted=${json.menu.posted}, expected=${pendingMenuState.current}, keeping local (${Math.round(timeSinceUpdate/1000)}s ago)`);
            setData(prev => ({
              ...json,
              menu: prev.menu, // Keep our optimistic/local state
              menuHistory: prev.menuHistory // Keep our optimistic history
            }));
          }
        } else {
          setData(json);
        }
      } else {
        console.error("Invalid data format received:", json);
        setData(prev => ({ ...prev, announcement: "伺服器資料異常，請稍後再試。" }));
      }
    } catch (err) {
      console.error("GAS Fetch Error:", err);
      setData(prev => ({ ...prev, announcement: `連線失敗: ${err.message}` }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [gasUrl]); // Refetch when URL changes

  // 2. Generic GAS Call Wrapper
  const callGAS = async (action, payload = {}) => {
    // We don't set global loading true here if we want Optimistic UI to feel fast.
    // Instead, we just trigger the background sync.

    try {
      // Use standard fetch if possible to get better error handling, 
      // though no-cors is the "safe" way for GAS POST redirects.
      // But we can try to handle it.
      await fetch(gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action, ...payload })
      });

      // Increase wait time for GAS to finish spreadsheet writing.
      // Since we use no-cors, the fetch resolves immediately after sending.
      setTimeout(() => {
        fetchData(); // Background refresh
      }, 2500); // 2.5 seconds is safer for GAS

    } catch (err) {
      console.error("GAS Action Error:", err);
      // In a real Optimistic UI, we would rollback here.
      // For now, just alert.
      alert(`操作同步失敗，請重新整理頁面: ${err.message}`);
    }
  };

  const updateGasUrl = (newUrl) => {
    setGasUrl(newUrl);
    localStorage.setItem('ding_gas_url', newUrl);
    // Reset protective locks to force a fresh fetch from the new URL
    pendingMenuState.current = null;
    lastMenuUpdate.current = 0;
    alert('GAS URL 已更新，正在重新連線...');
  };

  // Actions
  const loginAdmin = () => {
    setUser({ name: 'Admin', role: 'admin' });
    return true;
  };

  const loginMember = (name) => {
    setUser({ name, role: 'member' });
  };

  const logout = () => setUser(null);

  const addMember = (name) => {
    // Optimistic update: Add immediately to local state
    setData(prev => ({ ...prev, members: [...prev.members, name] }));
    callGAS('addMember', { name });
  };

  const removeMember = (name) => {
    setData(prev => ({ ...prev, members: prev.members.filter(m => m !== name) }));
    callGAS('removeMember', { name });
  };

  const updateMember = (oldName, newName) => {
    setData(prev => ({
      ...prev,
      members: prev.members.map(m => m === oldName ? newName : m)
    }));
    callGAS('updateMember', { oldName, newName });
  };

  const updateAnnouncement = (text) => {
    setData(prev => ({ ...prev, announcement: text }));
    callGAS('updateAnnouncement', { text });
  };

  const updateMenu = (newItems, posted = false, closingTime = '', image = '', storeInfo = { name: '', address: '', phone: '' }, remark = '') => {
    const newMenu = {
      ...data.menu,
      items: newItems,
      posted,
      closingTime,
      image,
      storeInfo,
      remark,
      lastUpdated: new Date().toISOString()
    };
    lastMenuUpdate.current = Date.now(); // Record update time
    pendingMenuState.current = posted; // Track expected posted state
    setData(prev => ({ ...prev, menu: newMenu }));
    callGAS('updateMenu', { items: newItems, posted, closingTime, image, storeInfo, remark });
  };

  const addMenuHistory = (name, items, image, storeInfo = { name: '', address: '', phone: '' }) => {
    const newHist = { id: `temp_${Date.now()}`, name, items, image, storeInfo, date: new Date().toISOString() };
    setData(prev => ({
      ...prev,
      menuHistory: [newHist, ...(prev.menuHistory || [])] // Add to top for UX
    }));
    callGAS('addMenuHistory', { name, items, image, storeInfo });
  };

  const deleteMenuHistory = (id) => {
    setData(prev => ({ ...prev, menuHistory: prev.menuHistory.filter(h => h.id !== id) }));
    callGAS('deleteMenuHistory', { id });
  };

  const placeOrder = (member, items) => {
    const total = items.reduce((sum, item) => sum + item.price, 0);
    const newOrder = {
      id: `temp_${Date.now()}`,
      member,
      items,
      total,
      date: new Date().toISOString()
    };
    // Optimistic
    setData(prev => ({ ...prev, orders: [...prev.orders, newOrder] }));
    callGAS('placeOrder', { member, items, total });
  };

  const deleteOrder = (id) => {
    setData(prev => ({ ...prev, orders: prev.orders.filter(o => o.id !== id) }));
    callGAS('deleteOrder', { id });
  };

  // --- Menu Library Actions ---
  const addMenuLibrary = (menuData) => {
    const tempItem = { 
      id: `temp_${Date.now()}`, 
      ...menuData, 
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString()
    };
    setData(prev => ({
      ...prev,
      menuLibrary: [tempItem, ...(prev.menuLibrary || [])]
    }));
    callGAS('addMenuLibrary', menuData);
  };

  const updateMenuLibrary = (id, updates) => {
    setData(prev => ({
      ...prev,
      menuLibrary: (prev.menuLibrary || []).map(m => 
        m.id === id ? { ...m, ...updates, updatedDate: new Date().toISOString() } : m
      )
    }));
    callGAS('updateMenuLibrary', { id, ...updates });
  };

  const deleteMenuLibrary = (id) => {
    setData(prev => ({
      ...prev,
      menuLibrary: (prev.menuLibrary || []).filter(m => m.id !== id)
    }));
    callGAS('deleteMenuLibrary', { id });
  };

  const toggleFavorite = (id) => {
    setData(prev => ({
      ...prev,
      menuLibrary: (prev.menuLibrary || []).map(m => 
        m.id === id ? { ...m, isFavorite: !m.isFavorite } : m
      )
    }));
    callGAS('toggleFavorite', { id });
  };

  const getTodayOrders = () => {
    if (!data.orders) return [];
    const today = new Date().toISOString().split('T')[0];
    return data.orders.filter(o => {
      const orderDate = o.date ? String(o.date) : '';
      return orderDate.startsWith(today);
    });
  };

  return (
    <DingContext.Provider value={{
      user,
      data,
      loading,
      gasUrl,
      actions: {
        updateGasUrl,
        loginAdmin,
        loginMember,
        logout,
        addMember,
        removeMember,
        updateMember,
        updateMenu,
        addMenuHistory,
        deleteMenuHistory,
        placeOrder,
        deleteOrder,
        updateAnnouncement,
        addMenuLibrary,
        updateMenuLibrary,
        deleteMenuLibrary,
        toggleFavorite,
      },
      getTodayOrders
    }}>
      {children}
    </DingContext.Provider>
  );
};

export const useDing = () => useContext(DingContext);
