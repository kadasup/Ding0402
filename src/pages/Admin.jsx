import React, { useState, useEffect } from 'react';
import { useDing, MENU_CATEGORIES } from '../context/DingContext';
import { DialogBox, Button, ConfirmModal, usePopup } from '../components/Components';
import { Upload, Trash2, Edit, Plus, Users, DollarSign, FileText, ArrowLeft, Loader, Check, X, Settings, Star, Search, Tag, BookOpen, Heart, Images, Clock, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import leafIcon from '../assets/img/leaf.svg';
import bellsIcon from '../assets/img/bells.svg';

const Admin = () => {
    const { user, data, actions, getTodayOrders, gasUrl } = useDing(); 
    const [password, setPassword] = useState('');
    const [activeTab, setActiveTab] = useState('menu'); // menu, members, stats, public

    // Debugging trace
    useEffect(() => {
        console.log("Ding DATA Updated:", data);
        console.log("Found menuLibrary:", data?.menuLibrary?.length, "items");
        console.log("Found menuHistory:", data?.menuHistory?.length, "entries");
    }, [data]);



    // Auto-login for admin (No password required)
    if (user?.role !== 'admin') {
        actions.loginAdmin();
        return <div className="p-20 text-center"><Loader className="animate-spin inline-block" /> 正在進入後台...</div>;
    }

    return (
        <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 px-2">
            <div className="flex items-center gap-2">
                <img src={leafIcon} className="w-8 h-8 opacity-80" />
                <h1 className="text-2xl sm:text-3xl font-bold text-ac-green underline decoration-dashed decoration-2 underline-offset-8">
                    後台管理
                </h1>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-center">
                <Link to="/" className="flex-1 sm:flex-none">
                    <Button variant="secondary" className="w-full text-sm py-2 px-4 shadow-sm">
                        <ArrowLeft size={16} /> 返回主頁
                    </Button>
                </Link>
                <Button onClick={actions.logout} variant="danger" className="flex-1 sm:flex-none text-sm py-2 px-4 shadow-sm">
                    <X size={16} /> 登出
                </Button>
            </div>
        </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar Nav */}
                <div className="md:col-span-1 flex flex-col gap-3">
                    {[
                        { id: 'menu', icon: FileText, label: '今日菜單' },
                        { id: 'library', icon: BookOpen, label: '菜單庫' },
                        { id: 'members', icon: Users, label: '人員管理' },
                        { id: 'stats', icon: DollarSign, label: '錢錢統計' },
                        { id: 'public', icon: Edit, label: '發布公告' },
                        { id: 'settings', icon: Settings, label: '系統設定' },
                    ].map((tab, idx) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`text-left px-5 py-4 rounded-xl font-black flex items-center gap-3 transition-all animate-pop ${activeTab === tab.id ? 'bg-ac-green text-white shadow-md transform scale-105' : 'bg-white hover-bg-leaf-light'}`}
                            style={{ animationDelay: `${idx * 0.05}s`, fontSize: '1.05rem', letterSpacing: '0.08em' }}
                        >
                            <tab.icon size={20} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="md:col-span-3 animate-slide-up">
                    <DialogBox
                        title={
                            activeTab === 'menu'
                                ? (data.menu.posted ? '今日菜單 🟢 上架中' : '今日菜單 🔴 下架中')
                                : activeTab === 'library' ? '📚 菜單庫管理'
                                    : activeTab === 'members' ? '人員名單'
                                        : activeTab === 'stats' ? '財務報表'
                                            : activeTab === 'settings' ? '系統連線設定'
                                                : '公告編輯'
                        }
                        className="min-h-[400px]"
                    >
                        <div>
                            <div style={{ display: activeTab === 'menu' ? 'block' : 'none' }}>
                                <MenuManager data={data} actions={actions} setActiveTab={setActiveTab} />
                            </div>
                            {activeTab === 'library' && <div key="library" className="animate-pop"><MenuLibraryManager data={data} actions={actions} setActiveTab={setActiveTab} /></div>}
                            {activeTab === 'members' && <div key="members" className="animate-pop"><MemberManager data={data} actions={actions} /></div>}
                            {activeTab === 'stats' && <div key="stats" className="animate-pop"><StatsManager data={data} getTodayOrders={getTodayOrders} /></div>}
                            {activeTab === 'public' && <div key="public" className="animate-pop"><NoticeManager data={data} actions={actions} /></div>}
                            {activeTab === 'settings' && <div key="settings" className="animate-pop"><SettingsManager /></div>}
                        </div>
                    </DialogBox>
                </div>
            </div>
        </div>
    );
};

// Sub-components for cleaner file

const MenuManager = ({ data, actions, setActiveTab }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
    const [draftItems, setDraftItems] = useState(data.menu.items || []);
    const [isPosted, setIsPosted] = useState(data.menu.posted);
    const [closingTime, setClosingTime] = useState(data.menu.closingTime || '');
    const [menuImage, setMenuImage] = useState(data.menu.image || '');
    const [showKeyInput, setShowKeyInput] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null); // null | 'publish' | 'unpublish' | 'closeOrder'
    const [storeInfo, setStoreInfo] = useState({ name: '', address: '', phone: '' });
    const [menuRemark, setMenuRemark] = useState(data.menu.remark || '');
    
    const { showAlert, showConfirm, PopupRenderer } = usePopup();
    const lastSyncRef = React.useRef(data.menu.lastUpdated);
    const { gasUrl } = useDing();

    // Sync from global data on first load
    const [hasInitialized, setHasInitialized] = useState(false);
    useEffect(() => {
        if (data.menu && data.menu.lastUpdated && !hasInitialized) {
            setIsPosted(data.menu.posted);
            if (data.menu.items) setDraftItems(data.menu.items);
            if (data.menu.closingTime) setClosingTime(data.menu.closingTime);
            if (data.menu.image) setMenuImage(data.menu.image);
            if (data.menu.storeInfo) setStoreInfo(data.menu.storeInfo);
            if (data.menu.remark !== undefined) setMenuRemark(data.menu.remark || '');
            setHasInitialized(true);
            lastSyncRef.current = data.menu.lastUpdated;
        }
    }, [data.menu, hasInitialized]);

    // Detect external data changes (e.g. from library "載入今日")
    useEffect(() => {
        if (hasInitialized && data.menu.lastUpdated && data.menu.lastUpdated !== lastSyncRef.current) {
            setIsPosted(data.menu.posted);
            setDraftItems(data.menu.items || []);
            setClosingTime(data.menu.closingTime || '');
            setMenuImage(data.menu.image || '');
            setStoreInfo(data.menu.storeInfo || { name: '', address: '', phone: '' });
            setMenuRemark(data.menu.remark || '');
            lastSyncRef.current = data.menu.lastUpdated;
        }
    }, [data.menu.lastUpdated, hasInitialized]);

    const deleteHistory = async (hist) => {
        const ok = await showConfirm({
            icon: '🗑️', iconBg: '#FEE2E2',
            title: `刪除「${hist.name}」？`,
            message: '此操作無法復原。',
            confirmText: '確定刪除', confirmColor: '#DC2626'
        });
        if (ok) actions.deleteMenuHistory(hist.id);
    };

    const loadHistory = async (hist) => {
        if (isPosted) {
            showAlert({ icon: '⚠️', iconBg: '#FEF3C7', title: '菜單上架中，無法載入', message: '請先將目前菜單「下架」後再載入歷史菜單。', buttonColor: '#D97706' });
            return;
        }
        const ok = await showConfirm({
            icon: '📋', iconBg: '#DBEAFE',
            title: `載入「${hist.name}」？`,
            message: '目前的編輯內容會被覆蓋。',
            confirmText: '確定載入', confirmColor: '#2563EB'
        });
        if (ok) {
            const items = hist.items || [];
            const image = hist.image || '';
            const store = hist.storeInfo || { name: '', address: '', phone: '' };
            setDraftItems(items);
            setMenuImage(image);
            setStoreInfo(store);
        }
    };

    const callAzureVision = async (base64Image) => {
        try {
            if (!gasUrl) throw new Error("尚未設定 GAS URL，無法使用 AI 辨識");

            const response = await fetch(gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'ocrMenu',
                    image: base64Image
                })
            });

            if (!response.ok) throw new Error(`GAS Proxy Error: ${response.status}`);
            
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            
            return {
                items: result.items || [],
                storeInfo: result.storeInfo || { name: '', address: '', phone: '' }
            };
        } catch (error) {
            console.error("AI Vision Proxy Error:", error);
            throw error;
        }
    };

    const processFileToBase64 = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    };

    const resizeImage = (base64) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = base64;
        });
    };

    // Batch file upload handler
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        setIsScanning(true);
        setScanProgress({ current: 0, total: files.length });

        let allItems = [];
        let latestStoreInfo = { ...storeInfo };
        let latestImage = menuImage;

        for (let i = 0; i < files.length; i++) {
            setScanProgress({ current: i + 1, total: files.length });
            try {
                const base64 = await processFileToBase64(files[i]);
                const resized = await resizeImage(base64);
                if (i === 0) latestImage = resized;
                
                const { items, storeInfo: newStoreInfo } = await callAzureVision(resized);
                allItems = [...allItems, ...items];
                if (newStoreInfo.name) latestStoreInfo.name = newStoreInfo.name;
                if (newStoreInfo.phone) latestStoreInfo.phone = newStoreInfo.phone;
                if (newStoreInfo.address) latestStoreInfo.address = newStoreInfo.address;
            } catch (err) {
                console.error(`File ${i + 1} error:`, err);
            }
        }

        if (allItems.length > 0) setDraftItems(allItems);
        setMenuImage(latestImage);
        setStoreInfo(latestStoreInfo);
        setIsScanning(false);
        setScanProgress({ current: 0, total: 0 });

        if (allItems.length > 0) {
            showAlert({ icon: '✅', title: '辨識完成！', message: `共辨識 ${files.length} 張照片，${allItems.length} 個品項。` });
        } else {
            showAlert({ icon: '⚠️', iconBg: '#FEF3C7', title: '未辨識到品項', message: '請確認照片品質後重試。', buttonColor: '#D97706' });
        }

        e.target.value = '';
    };

    const updateItem = (idx, field, val) => {
        const newItems = [...draftItems];
        newItems[idx] = { ...newItems[idx], [field]: field === 'price' ? Number(val) : val };
        setDraftItems(newItems);
    };

    const deleteItem = (idx) => {
        setDraftItems(draftItems.filter((_, i) => i !== idx));
    };

    const addItem = () => setDraftItems([...draftItems, { name: 'New Item', price: 0 }]);

    const saveMenu = () => {
        actions.updateMenu(draftItems, isPosted, closingTime, menuImage, storeInfo, menuRemark);
        showAlert({ icon: '💾', title: '菜單已儲存！', message: isPosted ? '前台將同步更新。' : '' });
    };

    const handlePublish = async (status) => {
        if (!status) {
            // Auto-save to history when unposting
            const today = new Date();
            const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
            const name = storeInfo.name ? storeInfo.name : '未輸入';
            const autoSaveName = `${dateStr} 下架封存 ${name}`;
            actions.addMenuHistory(autoSaveName, draftItems, menuImage, storeInfo);

            // Clear all draft data upon unpublishing as requested
            const emptyItems = [];
            const emptyImage = '';
            const emptyStore = { name: '', address: '', phone: '' };
            const emptyRemark = '';
            
            setDraftItems(emptyItems);
            setMenuImage(emptyImage);
            setStoreInfo(emptyStore);
            setMenuRemark(emptyRemark);
            setIsPosted(false);
            
            // Sync empty state to global context
            await actions.updateMenu(emptyItems, false, closingTime, emptyImage, emptyStore, emptyRemark);
        } else {
            setIsPosted(true);
            await actions.updateMenu(draftItems, true, closingTime, menuImage, storeInfo, menuRemark);
        }
    };



    const doCloseOrder = async () => {
        // Auto-save specific for Closing
        const today = new Date();
        const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
        const name = storeInfo.name ? storeInfo.name : '未輸入';
        const autoSaveName = `${dateStr} 結單封存 ${name}`;
        actions.addMenuHistory(autoSaveName, draftItems, menuImage, storeInfo);

        // Unpost
        setIsPosted(false);
        await actions.updateMenu(draftItems, false, closingTime, menuImage, storeInfo, menuRemark);

        showAlert({ icon: '🌙', iconBg: '#E0E7FF', title: '今日已結單！辛苦了！', message: '菜單已成功封存並下架。', buttonColor: '#4B5563' });
    };

    // Date/Time Options Generation
    const getNext3Days = () => {
        const dates = [];
        for (let i = 0; i < 3; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
            const displayStr = `${d.getMonth() + 1}/${d.getDate()} (${['日', '一', '二', '三', '四', '五', '六'][d.getDay()]})`;
            dates.push({ value: dateStr, label: i === 0 ? `今天 ${displayStr}` : displayStr });
        }
        return dates;
    };

    const getWholeHours = () => {
        return ["09:00", "12:00", "17:00"];
    };

    // Parse existing closingTime (YYYY-MM-DD HH:mm) or default
    const [datePart, timePart] = closingTime.includes(' ') ? closingTime.split(' ') : [new Date().toISOString().split('T')[0], '12:00'];

    const updateDateTime = (newDate, newTime) => {
        setClosingTime(`${newDate} ${newTime}`);
    };

    return (
        <div className="flex flex-col gap-6 p-4">
            {/* Store Information Config (Read-only) */}
            <div className="p-6 rounded-2xl border shadow-sm flex flex-col gap-4" style={{ background: '#ffffff', borderLeft: '4px solid var(--ac-green)' }}>
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-xl font-black text-ac-brown flex items-center gap-2">
                        🏪 店家資訊
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                        <span className="text-sm font-black mb-2 ml-1 flex items-center gap-1" style={{ color: 'var(--ac-green)' }}>📛 店名</span>
                        <div className="bg-gray-50 p-3 rounded-xl border shadow-sm text-base font-bold text-gray-700">{storeInfo.name || '(未載入)'}</div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black mb-2 ml-1 flex items-center gap-1" style={{ color: 'var(--ac-blue)' }}>📞 電話</span>
                        <div className="bg-gray-50 p-3 rounded-xl border shadow-sm text-base font-bold text-gray-700">{storeInfo.phone || '(未載入)'}</div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black mb-2 ml-1 flex items-center gap-1" style={{ color: 'var(--ac-brown)' }}>📍 地址</span>
                        <div className="bg-gray-50 p-3 rounded-xl border shadow-sm text-base font-bold text-gray-700">{storeInfo.address || '(未載入)'}</div>
                    </div>
                </div>
            </div>

            {/* Original Menu Image for Verification */}
            {menuImage && (
                <div className="p-6 rounded-2xl border shadow-sm flex flex-col gap-4" style={{ background: '#F7F7F5', borderLeft: '4px solid #B0BEC5' }}>
                    <div className="flex justify-between items-center border-b pb-3">
                        <h3 className="text-xl font-black text-ac-brown flex items-center gap-2">
                            🖼️ 原始菜單照片 (核對用)
                        </h3>
                    </div>
                    <div className="flex justify-center bg-gray-50 rounded-lg p-2 border">
                        <img 
                            src={menuImage} 
                            className="max-h-[300px] w-auto rounded shadow-sm border" 
                            alt="Original Menu"
                            onClick={() => window.open(menuImage, '_blank')}
                            style={{ cursor: 'zoom-in' }}
                        />
                    </div>
                </div>
            )}

            {/* Menu Items List - Read Only */}
            <div className="p-6 rounded-2xl border shadow-sm flex flex-col gap-4" style={{ background: '#FFFBE6', borderLeft: '4px solid #F59E0B' }}>
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-xl font-black text-ac-brown flex items-center gap-2">
                        🍱 品項列表 ({draftItems.length})
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {draftItems.map((item, i) => (
                        <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm">
                            <span className="font-bold text-gray-700">{item.name}</span>
                            <span className="font-black text-ac-green text-lg">${item.price}</span>
                        </div>
                    ))}
                    {draftItems.length === 0 && (
                        <div className="md:col-span-2 text-center py-8 text-gray-400 italic bg-white/50 rounded-xl border-2 border-dashed">
                            目前沒有品項。請先至「菜單庫」點擊「載入今日」！
                        </div>
                    )}
                </div>
            </div>

            {/* Closing Time Setting */}
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col items-center gap-4" style={{ background: '#EFF6FF', borderLeft: '4px solid #60A5FA' }}>
                <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                        <Clock size={18} />
                    </span>
                    <span className="font-black text-gray-800 text-base">設定結單時間</span>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 w-full">
                    <div className="flex flex-col gap-1 w-full sm:w-[160px]">
                        <span className="text-xs font-black text-blue-500 ml-1 uppercase tracking-widest">🗓️ 日期選擇</span>
                        <select
                            className="ac-input py-2.5 px-4 text-base border shadow-sm rounded-xl cursor-pointer"
                            style={{ background: '#fff', width: '100%' }}
                            value={datePart}
                            onChange={(e) => updateDateTime(e.target.value, timePart)}
                        >
                            {getNext3Days().map(d => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex flex-col gap-1 w-full sm:w-[130px]">
                        <span className="text-xs font-black text-blue-500 ml-1 uppercase tracking-widest">⏰ 時間選擇</span>
                        <select
                            className="ac-input py-2.5 px-4 text-base border shadow-sm rounded-xl cursor-pointer"
                            style={{ background: '#fff', width: '100%' }}
                            value={timePart}
                            onChange={(e) => updateDateTime(datePart, e.target.value)}
                        >
                            {getWholeHours().map(h => (
                                <option key={h} value={h}>{h}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Today's Remark Setting */}
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col gap-3" style={{ background: '#FFF7ED', borderLeft: '4px solid #FDBA74' }}>
                <span className="font-black text-gray-800 text-base flex items-center gap-2">📝 當日備註 / 公告</span>
                <textarea 
                    className="ac-input text-sm min-h-[80px]" 
                    placeholder="輸入給成員的留言 (如: 今天只有中餐、11點前要點完等)" 
                    value={menuRemark} 
                    onChange={e => setMenuRemark(e.target.value)} 
                />
            </div>

            {/* Publish Toggle Section */}
            <div className="rounded-2xl border shadow-sm overflow-hidden">
                <div className="grid grid-cols-2" style={{ minHeight: '100px' }}>
                    {/* 下架 Panel */}
                    <button
                        onClick={() => isPosted && setConfirmAction('unpublish')}
                        className="flex flex-col items-center justify-center gap-2 py-5 px-4 transition-all duration-300 border-r"
                        style={{
                            background: !isPosted ? '#FEE2E2' : '#FAFAFA',
                            cursor: isPosted ? 'pointer' : 'default',
                            opacity: isPosted ? 0.7 : 1,
                        }}
                    >
                        <span style={{ fontSize: '28px' }}>{!isPosted ? '🔴' : '🔒'}</span>
                        <span className="font-black text-lg" style={{ color: !isPosted ? '#991B1B' : '#9CA3AF' }}>
                            下架
                        </span>
                        {!isPosted && (
                            <span className="text-xs font-bold px-3 py-1 rounded-full animate-status-pulse" style={{ background: '#FECACA', color: '#991B1B' }}>
                                目前狀態
                            </span>
                        )}
                        {isPosted && (
                            <span className="text-xs text-gray-400">點擊下架</span>
                        )}
                    </button>

                    {/* 上架 Panel */}
                    <button
                        onClick={() => !isPosted && setConfirmAction('publish')}
                        className="flex flex-col items-center justify-center gap-2 py-5 px-4 transition-all duration-300"
                        style={{
                            background: isPosted ? '#D1FAE5' : '#FAFAFA',
                            cursor: !isPosted ? 'pointer' : 'default',
                            opacity: !isPosted ? 0.7 : 1,
                        }}
                    >
                        <span style={{ fontSize: '28px' }}>{isPosted ? '🟢' : '🚀'}</span>
                        <span className="font-black text-lg" style={{ color: isPosted ? '#065F46' : '#9CA3AF' }}>
                            上架
                        </span>
                        {isPosted && (
                            <span className="text-xs font-bold px-3 py-1 rounded-full animate-status-pulse" style={{ background: '#A7F3D0', color: '#065F46' }}>
                                目前狀態
                            </span>
                        )}
                        {!isPosted && (
                            <span className="text-xs text-gray-400">點擊上架</span>
                        )}
                    </button>
                </div>

                {/* Close Order - only visible when posted */}
                {isPosted && (
                    <div className="flex justify-center py-3 border-t" style={{ background: '#F9FAFB' }}>
                        <button
                            onClick={() => setConfirmAction('closeOrder')}
                            className="font-black px-6 py-2.5 rounded-full transition-all"
                            style={{ backgroundColor: '#4B5563', color: '#fff', fontSize: '0.95rem', letterSpacing: '0.05em' }}
                        >
                            🌙 今日結單
                        </button>
                    </div>
                )}
            </div>

            {/* Publish/Unpublish Confirm Modal */}
            <ConfirmModal
                isOpen={confirmAction === 'publish'}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => handlePublish(true)}
                icon="🚀"
                iconBg="#D1FAE5"
                title="確定要上架菜單嗎？"
                message="上架後前台將顯示今日菜單，成員可以開始點餐。"
                confirmText="✅ 確定上架"
                cancelText="取消"
                confirmColor="#059669"
            />
            <ConfirmModal
                isOpen={confirmAction === 'closeOrder'}
                onClose={() => setConfirmAction(null)}
                onConfirm={doCloseOrder}
                icon="🌙"
                iconBg="#E0E7FF"
                title="確定要今日結單嗎？"
                message={"系統將會：\n1. 自動備份今日菜單 📂\n2. 將菜單下架 🔒"}
                confirmText="🌙 確定結單"
                cancelText="取消"
                confirmColor="#4B5563"
            />
            <ConfirmModal
                isOpen={confirmAction === 'unpublish'}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => handlePublish(false)}
                icon="🔒"
                iconBg="#FEE2E2"
                title="確定要下架菜單嗎？"
                message="下架後菜單將自動封存至歷史紀錄，前台將無法點餐。"
                confirmText="🔴 確定下架"
                cancelText="取消"
                confirmColor="#DC2626"
            />

            <PopupRenderer />

            {/* History Section */}
            <div className="mt-2">
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full flex items-center justify-between gap-2 font-black text-base px-5 py-4 rounded-2xl border shadow-sm transition-all"
                    style={{ background: showHistory ? '#FEF3C7' : '#F9FAFB', borderLeft: '4px solid #D97706', color: '#92400E' }}
                >
                    <span className="flex items-center gap-2">
                        📂 歷史紀錄
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#D97706', color: '#fff', padding: '2px 8px', borderRadius: '999px' }}>
                            {(data.menuHistory || []).length}
                        </span>
                    </span>
                    <span style={{ fontSize: '12px', color: '#9CA3AF', transition: 'transform 0.2s', transform: showHistory ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                </button>

                {showHistory && (
                    <div className="bg-gray-50 p-4 rounded-xl mt-2 border border-dashed border-gray-300 animate-slide-up">
                        <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                            {(() => {
                                const history = data.menuHistory || [];
                                if (history.length === 0) return (
                                    <div className="text-center text-gray-400 text-sm py-8 flex flex-col items-center gap-2">
                                        <span style={{ fontSize: '2rem' }}>📭</span>
                                        <span>暫無歷史紀錄</span>
                                        <span className="text-xs">下架 / 結單時系統會自動封存菜單</span>
                                    </div>
                                );

                                // Filter out entries with invalid dates
                                const validHistory = history.filter(h => {
                                    if (!h.date) return false;
                                    const d = new Date(h.date);
                                    return !isNaN(d.getTime());
                                });

                                if (validHistory.length === 0) return (
                                    <div className="text-center text-gray-400 text-sm py-8">暫無有效歷史紀錄</div>
                                );

                                // Group by Month
                                const grouped = validHistory.reduce((acc, hist) => {
                                    const date = new Date(hist.date);
                                    const key = `${date.getFullYear()}年${date.getMonth() + 1}月`;
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(hist);
                                    return acc;
                                }, {});

                                // Sort Months Descending
                                const sortedKeys = Object.keys(grouped).sort((a, b) => {
                                    const matchA = a.match(/(\d+)年(\d+)月/);
                                    const matchB = b.match(/(\d+)年(\d+)月/);
                                    if (!matchA || !matchB) return 0;
                                    const [y1, m1] = matchA.slice(1).map(Number);
                                    const [y2, m2] = matchB.slice(1).map(Number);
                                    return (y2 * 100 + m2) - (y1 * 100 + m1);
                                });

                                return sortedKeys.map(month => {
                                    // Group items in this month by Day
                                    const monthItems = grouped[month];
                                    const byDay = monthItems.reduce((dayAcc, item) => {
                                        const d = new Date(item.date);
                                        const dayKey = d.getDate();
                                        const fullDayStr = `${month}${dayKey}日`;
                                        if (!dayAcc[fullDayStr]) dayAcc[fullDayStr] = [];
                                        dayAcc[fullDayStr].push(item);
                                        return dayAcc;
                                    }, {});

                                    const sortedDays = Object.keys(byDay).sort((a, b) => {
                                        const matchA = a.match(/(\d+)日/);
                                        const matchB = b.match(/(\d+)日/);
                                        if (!matchA || !matchB) return 0;
                                        return parseInt(matchB[1]) - parseInt(matchA[1]);
                                    });

                                    return (
                                        <div key={month}>
                                            <h3 className="font-bold text-ac-brown mb-2 mt-3 pb-1 text-base flex items-center gap-2" style={{ borderBottom: '2px solid #F3F4F6' }}>
                                                📅 {month}
                                                <span style={{ fontSize: '0.7rem', background: '#F3F4F6', color: '#6B7280', padding: '2px 8px', borderRadius: '999px' }}>
                                                    {grouped[month].length} 筆
                                                </span>
                                            </h3>
                                            <div className="flex flex-col gap-2">
                                                {sortedDays.map(dayStr => (
                                                    <HistoryDayGroup key={dayStr} dateStr={dayStr} items={byDay[dayStr]} actions={actions} loadHistory={loadHistory} onDeleteHistory={deleteHistory} />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

// ========================
// Menu Library Manager
// ========================
const MenuLibraryManager = ({ data, actions, setActiveTab }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [showFavOnly, setShowFavOnly] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const { gasUrl } = useDing();

    // Add/Edit form state
    const [formName, setFormName] = useState('');
    const [formCategory, setFormCategory] = useState('chinese');
    const [formStoreInfo, setFormStoreInfo] = useState({ name: '', address: '', phone: '' });
    const [formItems, setFormItems] = useState([]);
    const [formImage, setFormImage] = useState('');
    const [formRemark, setFormRemark] = useState('');

    // Load draft state from sessionStorage
    useEffect(() => {
        const draftStr = sessionStorage.getItem('menu_library_draft');
        if (draftStr) {
            try {
                const draft = JSON.parse(draftStr);
                if (draft.showAddForm) {
                    setShowAddForm(draft.showAddForm);
                    setEditingId(draft.editingId);
                    setFormName(draft.formName || '');
                    setFormCategory(draft.formCategory || 'chinese');
                    setFormStoreInfo(draft.formStoreInfo || { name: '', address: '', phone: '' });
                    setFormItems(draft.formItems || []);
                    setFormImage(draft.formImage || '');
                    setFormRemark(draft.formRemark || '');
                }
            } catch (e) {
                console.error("Failed to parse library draft:", e);
            }
        }
    }, []);

    // Save draft state to sessionStorage
    useEffect(() => {
        sessionStorage.setItem('menu_library_draft', JSON.stringify({
            showAddForm, editingId, formName, formCategory, formStoreInfo, formItems, formImage, formRemark
        }));
    }, [showAddForm, editingId, formName, formCategory, formStoreInfo, formItems, formImage, formRemark]);

    // States for Add Item Modal
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');

    // Scanning state for library batch upload
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
    const { showAlert, showConfirm, PopupRenderer: LibPopup } = usePopup();

    const library = data.menuLibrary || [];

    const filteredLibrary = library.filter(m => {
        if (showFavOnly && !m.isFavorite) return false;
        if (filterCategory !== 'all' && m.category !== filterCategory) return false;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            const nameMatch = (m.name || '').toLowerCase().includes(q);
            const storeMatch = (m.storeInfo?.name || '').toLowerCase().includes(q);
            const itemMatch = (m.items || []).some(i => (i.name || '').toLowerCase().includes(q));
            if (!nameMatch && !storeMatch && !itemMatch) return false;
        }
        return true;
    });

    const resetForm = () => {
        setFormName(''); setFormCategory('chinese');
        setFormStoreInfo({ name: '', address: '', phone: '' });
        setFormItems([]); setFormImage(''); setFormRemark('');
        setEditingId(null); setShowAddForm(false);
    };

    const handleConfirmAddItem = () => {
        if (!newItemName.trim() || !newItemPrice) {
            showAlert({ icon: '⚠️', iconBg: '#FEF3C7', title: '請填寫完整', message: '名稱和價格不能為空', buttonColor: '#D97706' });
            return;
        }
        setFormItems([...formItems, { name: newItemName.trim(), price: Number(newItemPrice) }]);
        setShowAddItemModal(false);
        setNewItemName('');
        setNewItemPrice('');
    };

    const startEdit = (menu) => {
        setEditingId(menu.id);
        setFormName(menu.name || '');
        setFormCategory(menu.category || 'other');
        setFormStoreInfo(menu.storeInfo || { name: '', address: '', phone: '' });
        setFormItems(menu.items || []);
        setFormImage(menu.image || '');
        setFormRemark(menu.remark || '');
        setShowAddForm(true);
    };

    const handleSave = () => {
        if (!formName && !formStoreInfo.name) {
            showAlert({ icon: '⚠️', iconBg: '#FEF3C7', title: '請至少輸入菜單名稱或店名', buttonColor: '#D97706' });
            return;
        }
        const payload = {
            name: formName || formStoreInfo.name,
            category: formCategory,
            storeInfo: formStoreInfo,
            items: formItems,
            image: formImage,
            remark: formRemark,
            isFavorite: false
        };
        if (editingId) {
            actions.updateMenuLibrary(editingId, payload);
            showAlert({ icon: '✅', title: '菜單已更新！' });
        } else {
            actions.addMenuLibrary(payload);
            showAlert({ icon: '✅', title: '菜單已新增至菜單庫！' });
        }
        resetForm();
    };

    const handleDelete = async (id, name) => {
        const ok = await showConfirm({
            icon: '🗑️', iconBg: '#FEE2E2',
            title: `刪除「${name}」？`,
            message: '此操作無法復原。',
            confirmText: '確定刪除', confirmColor: '#DC2626'
        });
        if (ok) actions.deleteMenuLibrary(id);
    };

    const loadToDaily = async (menu) => {
        if (data.menu?.posted) {
            showAlert({ icon: '⚠️', iconBg: '#FEF3C7', title: '菜單上架中，無法載入', message: '請先將目前菜單「下架」後再載入。', buttonColor: '#D97706' });
            return;
        }
        const ok = await showConfirm({
            icon: '📋', iconBg: '#DBEAFE',
            title: `載入「${menu.name}」？`,
            message: '將載入至今日菜單規劃。',
            confirmText: '確定載入', confirmColor: '#2563EB'
        });
        if (ok) {
            actions.updateMenu(menu.items, false, '', menu.image || '', menu.storeInfo || {});
            await showAlert({ icon: '✅', title: '已載入至今日菜單！', message: '即將前往「今日菜單」分頁查看。', buttonText: '📋 移動到今日菜單', buttonColor: '#2563EB' });
            setActiveTab('menu');
        }
    };

    const callAzureVision = async (base64Image) => {
        // Now using GAS as a secure proxy to call Azure
        const response = await fetch(gasUrl, {
            method: 'POST',
            body: JSON.stringify({
                action: 'ocrMenu',
                image: base64Image
            })
        });
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        return { 
            items: result.items || [], 
            storeInfo: result.storeInfo || {}, 
            remark: result.remark || '' 
        };
    };

    const handleLibraryUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        
        setIsScanning(true);
        setScanProgress({ current: 0, total: files.length });
        let allItems = [];
        let latestStore = { ...formStoreInfo };
        let combinedRemark = formRemark;

        for (let i = 0; i < files.length; i++) {
            setScanProgress({ current: i + 1, total: files.length });
            try {
                // Optimize image before sending to GAS Proxy
                const base64Orig = await new Promise(r => { const rd = new FileReader(); rd.onload = ev => r(ev.target.result); rd.readAsDataURL(files[i]); });
                
                // Create a resized version to save bandwidth and speed up proxying
                const img = new Image();
                await new Promise(r => { img.onload = r; img.src = base64Orig; });
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Efficient size for OCR
                const scale = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6); // Slightly lower quality for much smaller size

                if (i === 0) {
                    setFormImage(compressedBase64); // Show preview for the first image
                }

                const { items, storeInfo: si, remark } = await callAzureVision(compressedBase64);
                allItems = [...allItems, ...items];
                if (si.name) latestStore.name = si.name;
                if (si.phone) latestStore.phone = si.phone;
                if (si.address) latestStore.address = si.address;
                if (remark) {
                    combinedRemark = combinedRemark ? combinedRemark + '\n' + remark : remark;
                }
            } catch (err) { console.error(`File ${i + 1} error:`, err); }
        }
        if (allItems.length > 0) setFormItems(prev => [...prev, ...allItems]);
        setFormStoreInfo(latestStore);
        if (latestStore.name && !formName) setFormName(latestStore.name);
        if (combinedRemark !== formRemark) setFormRemark(combinedRemark);
        setIsScanning(false);
        setScanProgress({ current: 0, total: 0 });
        showAlert({ icon: allItems.length > 0 ? '✅' : '⚠️', iconBg: allItems.length > 0 ? '#D1FAE5' : '#FEF3C7', title: allItems.length > 0 ? `辨識完成！${allItems.length} 個品項` : '未辨識到品項', buttonColor: allItems.length > 0 ? 'var(--ac-green)' : '#D97706' });
        e.target.value = '';
    };

    const getCategoryLabel = (id) => (MENU_CATEGORIES.find(c => c.id === id) || {}).label || id;
    const getCategoryColor = (id) => (MENU_CATEGORIES.find(c => c.id === id) || {}).color || '#95A5A6';

    return (
        <div className="p-4 flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-3">
                <div className="flex gap-2 items-center">
                    <div className="flex-grow relative">
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                        <input className="ac-input" style={{ paddingLeft: '36px' }} placeholder="搜尋店名、菜名..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <Button onClick={() => { resetForm(); setShowAddForm(true); }} className="whitespace-nowrap"><Plus size={16} /> 新增菜單</Button>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-gray-50/50 p-2 rounded-2xl border border-gray-100/50">
                    <button 
                        onClick={() => setShowFavOnly(!showFavOnly)} 
                        className={`group flex items-center justify-center gap-3 px-6 h-12 rounded-full text-base font-black transition-all shadow-md border ${showFavOnly ? 'bg-red-50 text-red-600 border-red-200 ring-4 ring-red-100 shadow-inner' : 'bg-white text-gray-700 border-gray-200 hover:border-ac-orange hover:text-ac-orange hover:shadow-lg'}`}
                    >
                        <Heart 
                            size={20} 
                            className={showFavOnly ? 'text-red-500 animate-pulse' : 'text-gray-400 group-hover:text-red-400 transition-colors'} 
                            style={{ fill: showFavOnly ? '#ef4444' : 'none' }}
                        /> 
                        <span className="whitespace-nowrap">{showFavOnly ? '最愛菜單模式' : '最愛'}</span>
                    </button>
                    <div className="relative group">
                        <select 
                            className="appearance-none bg-white border-2 border-gray-100 text-gray-700 text-base font-black rounded-full pl-6 pr-12 h-12 shadow-md outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 hover:border-ac-blue hover:text-ac-blue hover:shadow-lg transition-all cursor-pointer min-w-[160px]"
                            value={filterCategory} 
                            onChange={e => setFilterCategory(e.target.value)}
                        >
                            <option value="all">📂 全部分類</option>
                            {MENU_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 group-hover:text-ac-blue transition-colors">
                            <ChevronDown size={18} strokeWidth={3} />
                        </div>
                    </div>
                    <span className="text-xs font-bold text-gray-500 ml-auto bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                        共 {filteredLibrary.length} 筆
                    </span>
                </div>
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
                <div className="ac-panel border-2 border-ac-green shadow-lg animate-slide-up bg-white mb-6 p-6">
                    <h3 className="font-black text-ac-brown mb-6 text-xl flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-ac-green flex items-center justify-center text-white text-sm">
                           {editingId ? '✏️' : '➕'}
                        </div>
                        {editingId ? '編輯菜單' : '新增菜單到菜單庫'}
                    </h3>
                    <div className="flex flex-col gap-4 relative z-10">
                        {/* AI Upload Column - Making it prominent */}
                        <div className="bg-[#f0f9ff] p-8 rounded-3xl border-4 border-dashed border-ac-blue/40 text-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] group hover:border-ac-blue/80 transition-all">
                            {isScanning ? (
                                <div className="flex flex-col items-center gap-4 py-4">
                                    <div className="relative w-24 h-24 bg-white rounded-full shadow-inner border-4 border-blue-50 flex items-center justify-center overflow-hidden">
                                        <Loader className="animate-spin text-ac-blue" size={56} />
                                        {/* Added Scanning line */}
                                        <div className="absolute inset-x-0 h-1.5 bg-blue-400 opacity-60 shadow-[0_0_15px_rgba(95,205,228,0.9)] animate-scan-line"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-12 h-12 bg-blue-300 rounded-full animate-ping opacity-25"></div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-xl font-black text-ac-blue animate-pulse tracking-wide">
                                            AI 辨識中...
                                        </span>
                                        <div className="flex items-center justify-center gap-2">
                                           <span className="text-xs text-blue-400 font-black bg-blue-50 px-3 py-1 rounded-full uppercase">
                                              正在處理第 {scanProgress.current} / {scanProgress.total} 張
                                           </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <label className="cursor-pointer flex flex-col items-center justify-center gap-3 py-4 hover:scale-[1.02] active:scale-95 transition-all">
                                    <div className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center border-4 border-blue-100 group-hover:border-ac-blue transition-colors">
                                        <Upload size={32} className="text-ac-blue" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-black text-lg text-ac-brown">
                                            點擊上傳菜單照片
                                        </span>
                                        <span className="text-xs text-gray-400 font-bold px-4 py-1 rounded-full bg-white/50 inline-block mt-1">
                                            AI 自動辨識品項、價格、店家資訊
                                        </span>
                                    </div>
                                    <input type="file" style={{ display: 'none' }} accept="image/*" multiple onChange={handleLibraryUpload} />
                                </label>
                            )}
                        </div>

                        {formImage && (
                            <div className="text-center relative group py-2">
                                <div className="relative inline-block">
                                   <img src={formImage} className="max-h-40 mx-auto rounded-2xl shadow-lg border-4 border-white ring-1 ring-gray-100" />
                                   <button onClick={() => setFormImage('')} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all ring-4 ring-white">
                                      <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
                                   </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5 ml-1">
                                   <span className="text-xs font-black text-ac-brown uppercase tracking-wider">菜單名稱</span>
                                </div>
                                <input className="ac-input focus:ring-4 focus:ring-blue-100 transition-all" placeholder="例: 王記便當" value={formName} onChange={e => setFormName(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5 ml-1">
                                   <span className="text-xs font-black text-ac-brown uppercase tracking-wider">分類</span>
                                </div>
                                <select className="ac-input focus:ring-4 focus:ring-blue-100 transition-all font-bold" value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                                    {MENU_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-black text-gray-400 ml-1">店名</span>
                                <input className="ac-input text-sm" placeholder="預設同菜單名" value={formStoreInfo.name} onChange={e => setFormStoreInfo({...formStoreInfo, name: e.target.value})} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-black text-gray-400 ml-1">電話</span>
                                <input className="ac-input text-sm" placeholder="電話" value={formStoreInfo.phone} onChange={e => setFormStoreInfo({...formStoreInfo, phone: e.target.value})} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-black text-gray-400 ml-1">地址</span>
                                <input className="ac-input text-sm" placeholder="地址" value={formStoreInfo.address} onChange={e => setFormStoreInfo({...formStoreInfo, address: e.target.value})} />
                            </div>
                        </div>

                        {/* Remark field */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 ml-1">
                                <span className="text-xs font-black text-ac-brown uppercase tracking-wider">備註 / 公告</span>
                            </div>
                            <textarea 
                                className="ac-input min-h-[90px] py-3 text-sm focus:ring-4 focus:ring-blue-100 transition-all" 
                                placeholder="輸入此菜單的備註事項 (如: 滿千送一、週二公休等)" 
                                value={formRemark} 
                                onChange={e => setFormRemark(e.target.value)}
                            />
                        </div>

                        {/* Items editor */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between ml-1">
                               <h4 className="font-black text-sm text-ac-brown">品項列表 ({formItems.length})</h4>
                               <button 
                                  onClick={() => setShowAddItemModal(true)} 
                                  className="ac-btn secondary text-xs" 
                                  style={{ padding: '6px 14px', boxSize: 'border-box', height: 'auto', fontSize: '0.8rem' }}
                               >
                                  <Plus size={14} /> 新增品項
                               </button>
                            </div>
                            {formItems.length === 0 ? (
                                <div className="text-center py-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-100 text-gray-400 text-xs font-bold">
                                    尚無品項，請點擊右方新增或上傳照片辨識
                                </div>
                            ) : (
                                <div className="max-h-[350px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
                                        {formItems.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm hover:border-blue-300 transition-colors animate-pop group" style={{ animationDelay: `${(i % 10) * 0.03}s` }}>
                                                <input 
                                                    className="font-bold text-gray-700 placeholder-gray-300" 
                                                    style={{ border: 'none', background: 'transparent', outline: 'none', boxShadow: 'none', padding: 0, width: '100%', flexGrow: 1, minWidth: '50px' }}
                                                    placeholder="輸入名稱..." 
                                                    value={item.name} 
                                                    onChange={e => { const n = [...formItems]; n[i] = {...n[i], name: e.target.value}; setFormItems(n); }} 
                                                />
                                                <div className="flex items-center gap-1 shrink-0" style={{ width: 'max-content' }}>
                                                   <span className="font-black text-ac-green text-lg">$</span>
                                                   <input 
                                                       type="number" 
                                                       className="font-black text-ac-green text-lg text-right placeholder-green-200" 
                                                       style={{ border: 'none', background: 'transparent', outline: 'none', boxShadow: 'none', padding: 0, width: '64px', minWidth: '64px' }}
                                                       value={item.price} 
                                                       onChange={e => { const n = [...formItems]; n[i] = {...n[i], price: Number(e.target.value)}; setFormItems(n); }} 
                                                   />
                                                   <button 
                                                       onClick={() => setFormItems(formItems.filter((_, j) => j !== i))} 
                                                       className="w-8 h-8 flex items-center justify-center text-gray-300 group-hover:text-red-500 rounded-full transition-colors ml-1 hover:bg-red-50"
                                                   >
                                                       <Trash2 size={16} />
                                                   </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 justify-center mt-4 pt-6 border-t font-black">
                            <Button variant="secondary" onClick={resetForm} style={{ padding: '12px 40px' }}>取消</Button>
                            <Button onClick={handleSave} style={{ padding: '12px 40px' }}>{editingId ? '更新菜單' : '儲存至菜單庫'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Item Modal in Menu Library */}
            {showAddItemModal && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowAddItemModal(false)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#fff', borderRadius: '20px', padding: '32px 28px 24px', maxWidth: '360px', width: '100%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
                            animation: 'bounce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                    >
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
                            ➕
                        </div>
                        <h3 className="text-center" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1F2937', marginBottom: '16px' }}>手動新增品項</h3>
                        
                        <div className="flex flex-col gap-4 mb-6">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-black text-gray-400 ml-1">品項名稱</span>
                                <input 
                                    className="ac-input" 
                                    placeholder="例: 排骨便當" 
                                    value={newItemName} 
                                    onChange={e => setNewItemName(e.target.value)} 
                                    autoFocus
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-black text-gray-400 ml-1">價格</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-ac-green text-xl pl-1">$</span>
                                    <input 
                                        type="number"
                                        className="ac-input flex-grow w-full" 
                                        placeholder="0" 
                                        value={newItemPrice} 
                                        onChange={e => setNewItemPrice(e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowAddItemModal(false)}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid #E5E7EB',
                                    background: '#fff', fontWeight: 800, fontSize: '0.95rem', color: '#6B7280',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.target.style.background = '#F3F4F6'; }}
                                onMouseLeave={e => { e.target.style.background = '#fff'; }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirmAddItem}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                                    background: 'var(--ac-green)', fontWeight: 800, fontSize: '0.95rem', color: '#fff',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: `0 4px 12px rgba(16, 185, 129, 0.4)`
                                }}
                                onMouseEnter={e => { e.target.style.opacity = '0.85'; }}
                                onMouseLeave={e => { e.target.style.opacity = '1'; }}
                            >
                                ✅ 確定新增
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Library List */}
            <div className="flex flex-col gap-3">
                {filteredLibrary.length === 0 && (
                    <div className="text-center text-gray-400 py-8 italic">
                        {library.length === 0 ? '菜單庫還是空的，點擊上方「新增菜單」開始建立吧！' : '找不到符合條件的菜單'}
                    </div>
                )}
                {filteredLibrary.map(menu => (
                    <div key={menu.id} className="bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        {/* Info section */}
                        <div style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                <span className="font-bold" style={{ fontSize: '1.1rem', color: 'var(--ac-brown)' }}>{menu.name}</span>
                                <span className="flex items-center px-3 py-1 rounded-lg border shadow-sm text-xs font-black transition-colors" style={{ 
                                    color: getCategoryColor(menu.category), 
                                    backgroundColor: getCategoryColor(menu.category) + '1A', // ~10% opacity
                                    borderColor: getCategoryColor(menu.category) + '33', // ~20% opacity
                                    whiteSpace: 'nowrap' 
                                }}>
                                    {getCategoryLabel(menu.category)}
                                </span>
                            </div>
                            {menu.storeInfo?.name && <div style={{ fontSize: '0.9rem', color: '#555', marginBottom: '4px' }}>🏪 {menu.storeInfo.name}</div>}
                            <div style={{ fontSize: '0.8rem', color: '#999', display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                {menu.storeInfo?.phone && <span>📞 {menu.storeInfo.phone}</span>}
                                {menu.storeInfo?.address && <span>📍 {menu.storeInfo.address}</span>}
                            </div>
                            {menu.remark && (
                                <div style={{ fontSize: '0.85rem', color: '#d97706', background: '#fffbeb', padding: '6px 10px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #fef3c7', whiteSpace: 'pre-line' }}>
                                    📝 {menu.remark}
                                </div>
                            )}
                            <div style={{ fontSize: '0.8rem', color: '#777', marginBottom: '6px' }}>{(menu.items || []).length} 個品項</div>
                        </div>
                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '8px', padding: '0 16px 16px', flexWrap: 'wrap' }}>
                            <Button variant="primary" onClick={() => loadToDaily(menu)} style={{ fontSize: '0.9rem', padding: '8px 18px', height: 'auto' }}>📋 載入今日</Button>
                            <div style={{ flex: 1 }}></div>
                            <Button variant="secondary" onClick={() => startEdit(menu)} className="text-xs" style={{ padding: '6px 12px', height: 'auto' }}><Edit size={13} /> 編輯</Button>
                            <Button variant="danger" onClick={() => handleDelete(menu.id, menu.name)} className="text-xs" style={{ padding: '6px 12px', height: 'auto' }}><Trash2 size={13} /> 刪除</Button>
                            <button
                                onClick={() => actions.toggleFavorite(menu.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold',
                                    border: menu.isFavorite ? '2px solid #ef4444' : '2px solid #ddd',
                                    background: menu.isFavorite ? '#fef2f2' : '#fff',
                                    color: menu.isFavorite ? '#ef4444' : '#999',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                                title="加入最愛"
                            >
                                <Heart size={14} style={{ fill: menu.isFavorite ? '#ef4444' : 'none' }} />
                                {menu.isFavorite ? '已收藏' : '加入最愛'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <LibPopup />
        </div>
    );
};

// Sub-component for Day Accordion
const HistoryDayGroup = ({ dateStr, items, actions, loadHistory, onDeleteHistory }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Sort a copy to avoid mutating the prop array
    const sortedItems = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="border rounded-lg overflow-hidden transition-all bg-gray-50">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="p-3 bg-gray-100 hover:bg-gray-200 cursor-pointer flex justify-between items-center select-none transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-bold text-xs" style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block' }}>▼</span>
                    <span className="font-bold text-gray-700">{dateStr}</span>
                    <span className="text-xs bg-ac-brown text-white px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
            </div>

            {isOpen && (
                <div className="p-2 flex flex-col gap-2 bg-white border-t border-gray-200">
                    {sortedItems.map(hist => (
                        <div key={hist.id} className="flex justify-between items-center p-2 hover:bg-yellow-50 rounded-lg border border-transparent hover:border-yellow-200 transition-colors">
                            <div className="flex flex-col">
                                <span className="font-bold text-xs text-gray-800">{hist.name}</span>
                                <span className="text-[10px] text-gray-400 flex items-center gap-2">
                                    {new Date(hist.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {hist.items && <span>· {hist.items.length} 品項</span>}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="primary" onClick={() => loadHistory(hist)} className="text-xs px-2 py-1 h-7">📋 載入今日</Button>
                                <Button variant="danger" onClick={() => onDeleteHistory(hist)} className="text-xs px-2 py-1 h-7">刪除</Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const MemberManager = ({ data, actions }) => {
    const [newName, setNewName] = useState('');
    const [editingMember, setEditingMember] = useState(null);
    const [editName, setEditName] = useState('');

    const startEdit = (member) => {
        setEditingMember(member);
        setEditName(member);
    };

    const cancelEdit = () => {
        setEditingMember(null);
        setEditName('');
    };

    const saveEdit = (oldName) => {
        if (editName && editName !== oldName) {
            actions.updateMember(oldName, editName);
        }
        setEditingMember(null);
    };

    return (
        <div className="p-4 flex flex-col gap-4">
            <div className="flex gap-2">
                <input
                    className="ac-input flex-grow"
                    placeholder="輸入新村民名字..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                />
                <Button onClick={() => { if (newName) { actions.addMember(newName); setNewName(''); } }} className="whitespace-nowrap"><Plus size={16} /> 新增</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.members.map(m => (
                    <div key={m} className="bg-white p-3 rounded-xl flex justify-between items-center shadow-sm h-14">
                        {editingMember === m ? (
                            <div className="flex flex-grow gap-2 items-center w-full">
                                <input
                                    className="ac-input py-1 px-2 text-sm flex-grow min-w-0"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEdit(m);
                                        if (e.key === 'Escape') cancelEdit();
                                    }}
                                />
                                <button onClick={() => saveEdit(m)} className="text-green-500 hover:text-green-700 bg-green-50 p-1.5 rounded-lg flex-shrink-0 transition-colors"><Check size={18} /></button>
                                <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 bg-gray-100 p-1.5 rounded-lg flex-shrink-0 transition-colors"><X size={18} /></button>
                            </div>
                        ) : (
                            <>
                                <span className="font-bold truncate mr-2">{m}</span>
                                <div className="flex gap-2 flex-shrink-0">
                                    <button onClick={() => startEdit(m)} className="text-ac-blue hover:text-blue-600 bg-blue-50 p-1.5 rounded-lg transition-colors"><Edit size={18} /></button>
                                    <button onClick={() => actions.removeMember(m)} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};








const StatsManager = ({ data, getTodayOrders }) => {
    // History Filter State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Filter orders by date (API returns ISO date string)
    // GAS orders date format is ISO string. data.orders contains ALL orders.
    const filteredOrders = (data.orders || []).filter(o => {
        // Handle timezone issues roughly or just compare string prefix YYYY-MM-DD
        // The GAS date is ISO.
        if (!o.date) return false;
        return String(o.date).startsWith(selectedDate);
    });

    const orders = filteredOrders;
    const total = orders.reduce((sum, o) => sum + o.total, 0);

    // Group by member
    const byMember = orders.reduce((acc, o) => {
        if (!acc[o.member]) acc[o.member] = { count: 0, total: 0, items: [] };
        acc[o.member].count += 1;
        acc[o.member].total += o.total;
        acc[o.member].items.push(...o.items);
        return acc;
    }, {});

    return (
        <div className="p-4 flex flex-col gap-6">
            {/* Date Filter */}
            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                <span className="font-bold text-gray-600">📅 查詢日期：</span>
                <input
                    type="date"
                    className="ac-input py-1 w-auto bg-white"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                />
            </div>

            <div className="flex gap-4">
                <div className="flex-1 bg-ac-green text-white p-4 rounded-2xl shadow-md text-center">
                    <div className="text-3xl font-bold">{orders.length}</div>
                    <div className="text-sm opacity-90">訂單數</div>
                </div>
                <div className="flex-1 bg-ac-orange text-white p-4 rounded-2xl shadow-md text-center relative overflow-hidden">
                    <img src={bellsIcon} className="absolute -bottom-2 -right-2 w-16 h-16 opacity-30" />
                    <div className="text-3xl font-bold relative z-10">${total}</div>
                    <div className="text-sm opacity-90 relative z-10">總收入</div>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <h3 className="font-bold border-b pb-2">明細列表</h3>
                {Object.entries(byMember).map(([member, stat]) => (
                    <div key={member} className="bg-white p-3 rounded-lg flex justify-between items-center text-sm">
                        <div>
                            <span className="font-bold text-lg mr-2">{member}</span>
                            <span className="text-gray-500">{stat.items.map(i => i.name).join(', ')}</span>
                        </div>
                        <div className="font-bold text-ac-orange">${stat.total}</div>
                    </div>
                ))}
                {orders.length === 0 && <div className="text-center italic text-gray-400 py-4">這天沒有訂單紀錄喔 (Zzz...)</div>}
            </div>
        </div>
    );
};

const NoticeManager = ({ data, actions }) => {
    const [text, setText] = useState(data.announcement);
    const { showAlert, PopupRenderer: NoticePopup } = usePopup();
    return (
        <div className="p-4 flex flex-col gap-4 h-full">
            <h3 className="font-bold text-gray-500">編輯公佈欄</h3>
            <textarea
                className="ac-input flex-grow min-h-[150px] resize-none"
                value={text}
                onChange={e => setText(e.target.value)}
            />
            <Button onClick={() => {
                actions.updateAnnouncement(text);
                showAlert({ icon: '📢', title: '公告已發布成功！' });
            }} className="self-end">發布公告</Button>
            <NoticePopup />
        </div>
    );
};

const SettingsManager = () => {
    const { gasUrl, actions, data } = useDing();
    const [urlInput, setUrlInput] = useState(gasUrl);

    useEffect(() => {
        setUrlInput(gasUrl);
    }, [gasUrl]);

    return (
        <div className="p-4 flex flex-col gap-6">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-800 mb-2">📡 Google Apps Script連線設定</h3>
                <div style={{ background: '#F0FDF4', border: '1px solid #22C55E', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔗</span>
                    <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 'bold' }}>系統連線設定</span>
                </div>
                <p className="text-sm text-blue-600 mb-4">
                    如果您重新部署了 GAS 專案，Web App URL 可能會改變。請在此更新，以確保系統能正確連線。
                </p>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-gray-500">Web App URL</label>
                    <div className="flex gap-2">
                        <input
                            className="ac-input font-mono text-xs flex-1"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="貼上您的 Google Apps Script Web App URL"
                        />
                        <Button
                            onClick={() => actions.updateGasUrl(urlInput)}
                            variant="primary"
                            className="text-xs py-1 px-4"
                        >
                            儲存 URL
                        </Button>
                    </div>
                </div>
                    <div className="mt-4 pt-4 border-t border-blue-200 flex flex-col gap-4">
                        <div className="bg-white p-3 rounded-xl border text-xs font-mono">
                            <p className="font-bold text-gray-400 mb-1 border-b pb-1">現有資料狀態</p>
                            <ul className="list-disc ml-4 text-gray-600 gap-1 flex flex-col">
                                <li>人員: {data?.members?.length || 0} 位</li>
                                <li>菜單庫: {data?.menuLibrary?.length || 0} 筆</li>
                                <li>歷史紀錄: {data?.menuHistory?.length || 0} 筆</li>
                                <li>今天訂單: {data?.orders?.length || 0} 筆</li>
                            </ul>
                        </div>
                        <DebugConnection url={urlInput} />
                    </div>
                </div>

                <div className="text-center text-xs text-gray-400 mt-10">
                    Ding Lunch System v1.2 (Security Patch)
                </div>
            </div>
        );
    };

const DebugConnection = ({ url }) => {
    const [log, setLog] = useState(null);
    const [testing, setTesting] = useState(false);

    const runTest = async () => {
        setTesting(true);
        setLog(null);
        try {
            const start = Date.now();
            const res = await fetch(`${url}?t=${start}`);
            const text = await res.text();
            let json = null;
            try { json = JSON.parse(text); } catch (e) { }

            setLog({
                status: res.status,
                ok: res.ok,
                type: res.headers.get('content-type'),
                time: Date.now() - start,
                isJson: !!json,
                preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                version: json?.sysVersion
            });
        } catch (err) {
            setLog({ error: err.message });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="bg-white p-2 rounded border border-gray-300 text-xs font-mono mt-2">
            <Button onClick={runTest} variant="secondary" className="mb-2 text-xs py-1">
                {testing ? '測試中...' : '診斷連線 (Debug)'}
            </Button>
            {log && (
                <div className="flex flex-col gap-1 text-gray-600">
                    {log.error ? (
                        <span className="text-red-500 font-bold">Error: {log.error}</span>
                    ) : (
                        <>
                            <span className={log.ok ? "text-green-600" : "text-red-500"}>HTTP Status: {log.status}</span>
                            <span>Time: {log.time}ms</span>
                            <span>Type: {log.type}</span>
                            <span className={log.isJson ? "text-green-600" : "text-red-500"}>Valid JSON: {log.isJson ? 'Yes' : 'No'}</span>
                            {log.version && <span>GAS Version: {log.version}</span>}
                            <div className="bg-gray-100 p-1 rounded mt-1 break-all">
                                Preview: {log.preview}
                            </div>
                            {!log.isJson && (
                                <p className="text-red-400 mt-1">
                                    ⚠️ 如果不是 JSON，通常代表：<br />
                                    1. 權限不是 "Anyone"<br />
                                    2. 網址是 /dev 或 /edit 而不是 /exec<br />
                                    3. GAS 程式崩潰
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default Admin;
