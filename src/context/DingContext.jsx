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
      
      // 🚀 強度保護：避免伺服器剛收到指令但還沒寫入 Sheet 時回傳的舊資料覆蓋本地狀態
      const now = Date.now();
      if (now - lastMenuUpdate.current < 8000) {
          // 在 8 秒內（剛點擊載入今日或上架），我們信任本地最新的 menu 資料
          json.menu = { ...json.menu, ...data.menu }; 
      } else if (pendingMenuState.current !== null && (now - lastMenuUpdate.current < 20000)) {
          if (json.menu.posted !== pendingMenuState.current) {
               json.menu = { ...json.menu, posted: pendingMenuState.current };
          } else {
               pendingMenuState.current = null;
          }
      }

      setData(json);
    } catch (err) {
      console.error("Fetch Data Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [gasUrl]);

  const callGAS = async (action, payload = {}) => {
    try {
      await fetch(gasUrl, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ action, ...payload })
      });
      // 🚀 增加延遲到 4 秒，給 GAS 充足的 IO 時間，減少「刪除完又跑回來」或「載入今日沒反應」的問題
      setTimeout(fetchData, 4000); 
    } catch (err) { console.error("GAS Action Error:", err); }
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
    updateMenu: (items, posted, closingTime, image, storeInfo, remark) => {
      const nowStr = new Date().toISOString();
      lastMenuUpdate.current = Date.now();
      pendingMenuState.current = posted;
      setData(prev => ({ 
        ...prev, 
        menu: { 
          ...prev.menu, 
          items, posted, closingTime, image, storeInfo, remark,
          lastUpdated: nowStr // 🚀 關鍵修正：補上時間指標，讓 Admin 組件偵測到變化
        } 
      }));
      callGAS('updateMenu', { items, posted, closingTime, image, storeInfo, remark, lastUpdated: nowStr });
    },
    addMenuHistory: (name, items, image, storeInfo) => {
      callGAS('addMenuHistory', { name, items, image, storeInfo });
    },
    deleteMenuHistory: (id) => {
      setData(prev => ({ ...prev, menuHistory: prev.menuHistory.filter(h => h.id !== id) }));
      callGAS('deleteMenuHistory', { id });
    },
    placeOrder: (member, items, total) => {
      const orderId = `order_${Date.now()}`;
      setData(prev => ({ ...prev, orders: [...prev.orders, { id: orderId, member, items, total, date: new Date().toISOString() }] }));
      callGAS('addOrder', { member, items, total, orderId }); // 🚀 修正指令為 addOrder
    },
    deleteOrder: (id) => {
      setData(prev => ({ ...prev, orders: prev.orders.filter(o => o.id !== id) }));
      callGAS('removeOrder', { orderId: id }); // 🚀 修正指令為 removeOrder
    },
    addMenuLibrary: (item) => callGAS('addMenuLibrary', item),
    updateMenuLibrary: (id, updates) => callGAS('updateMenuLibrary', { id, ...updates }),
    deleteMenuLibrary: (id) => callGAS('deleteMenuLibrary', { id }),
    toggleFavorite: (id) => callGAS('toggleFavorite', { id }),
    updateAnnouncement: (text) => {
      setData(prev => ({ ...prev, announcement: text }));
      callGAS('updateAnnouncement', { text });
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
