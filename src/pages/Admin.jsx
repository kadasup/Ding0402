import React, { useState, useEffect, useRef } from 'react';
import { useDing, MENU_CATEGORIES } from '../context/DingContext';
import { DialogBox, Button, ConfirmModal, usePopup } from '../components/Components';
import { Upload, Trash2, Edit, Plus, Users, DollarSign, FileText, ArrowLeft, Loader, Check, X, Settings, Star, Search, Tag, BookOpen, Heart, Images, Clock, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getLocalDateKey } from '../utils/date';
import leafIcon from '../assets/img/leaf.svg';
import bellsIcon from '../assets/img/bells.svg';

const Admin = () => {
    const { user, data, actions, gasUrl, ui } = useDing(); 
    const [activeTab, setActiveTab] = useState('menu'); // menu, members, stats, public
    const [isLibraryBootLoading, setIsLibraryBootLoading] = useState(false);
    const isMenuHydrating = activeTab === 'menu'
        && !!ui?.pending
        && !data?.menu?.lastUpdated
        && (data?.menu?.items || []).length === 0;

    useEffect(() => {
        if (user?.role !== 'admin') {
            actions.loginAdmin();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.role]);

    useEffect(() => {
        let cancelled = false;
        const tabSectionsMap = {
            stats: ['orders'],
            library: ['library'],
            settings: ['debug', 'uploadStatus'],
        };
        const sections = tabSectionsMap[activeTab];
        if (!sections) return;

        const isFirstLibraryLoad = activeTab === 'library' && (data?.menuLibrary || []).length === 0;
        if (isFirstLibraryLoad) {
            setIsLibraryBootLoading(true);
        }

        void (async () => {
            try {
                await actions.fetchData(sections, {
                    silent: true,
                    timeoutMs: 8000,
                    retries: 0,
                });
            } finally {
                if (!cancelled && isFirstLibraryLoad) {
                    setIsLibraryBootLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);



    // Auto-login for admin (No password required)
    if (user?.role !== 'admin') {
        // login is handled by the effect above
        return <div className="p-20 text-center"><Loader className="animate-spin inline-block" /> 正在登入管理後台...</div>;
    }

    // Resize large images before upload to reduce payload and speed up requests.
    const resizeImage = (base64) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; 
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

    const uploadImageToCloud = async (base64, name = "") => {
        try {
            if (!gasUrl) return null;
            let imageToUpload = base64;
            if (base64.length > 50000) {
                imageToUpload = await resizeImage(base64);
            }
            const res = await actions.uploadImage(imageToUpload, name);
            if (!res || res.error) {
                console.error("GAS Upload Error:", res?.error);
                return null;
            }
            return res.url || null;
        } catch (e) {
            console.error("Cloud upload error:", e);
            return null;
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 px-2">
            <div className="flex items-center gap-2">
                <img src={leafIcon} className="w-8 h-8 opacity-80" />
                <h1 className="text-2xl sm:text-3xl font-bold text-ac-green underline decoration-dashed decoration-2 underline-offset-8">
                    管理後台
                </h1>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-center">
                <Link to="/" className="flex-1 sm:flex-none">
                    <Button variant="secondary" className="w-full text-sm py-2 px-4 shadow-sm">
                        <ArrowLeft size={16} /> 返回前台
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
                        { id: 'members', icon: Users, label: '成員管理' },
                        { id: 'stats', icon: DollarSign, label: '統計資料' },
                        { id: 'public', icon: Edit, label: '公告編輯' },
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
                                ? (data.menu.posted
                                    ? <><span>今日菜單</span><span style={{ color: '#FF6B6B' }}>（已上架）</span></>
                                    : '今日菜單（未發布）')
                                : activeTab === 'library'
                                    ? '菜單庫'
                                    : activeTab === 'members'
                                        ? '成員管理'
                                        : activeTab === 'stats'
                                            ? '統計資料'
                                            : activeTab === 'settings'
                                                ? '系統設定'
                                                : '公告編輯'
                        }
                        className="min-h-[400px]"
                    >
                        <div>
                            <div style={{ display: activeTab === 'menu' ? 'block' : 'none' }}>
                                {isMenuHydrating ? <AdminMenuSkeleton /> : <MenuManager data={data} actions={actions} />}
                            </div>
                            {activeTab === 'library' && <div key="library" className="animate-pop"><MenuLibraryManager data={data} actions={actions} setActiveTab={setActiveTab} uploadImageToCloud={uploadImageToCloud} isInitialLoading={isLibraryBootLoading} /></div>}
                            {activeTab === 'members' && <div key="members" className="animate-pop"><MemberManager data={data} actions={actions} /></div>}
                            {activeTab === 'stats' && <div key="stats" className="animate-pop"><StatsManager data={data} /></div>}
                            {activeTab === 'public' && <div key="public" className="animate-pop"><NoticeManager data={data} actions={actions} /></div>}
                            {activeTab === 'settings' && <div key="settings" className="animate-pop"><SettingsManager /></div>}
                        </div>
                    </DialogBox>
                </div>
            </div>
        </div>
    );
};

const AdminMenuSkeleton = () => {
    return (
        <div className="p-4 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border shadow-sm p-6">
                <div className="shimmer-loading rounded-xl" style={{ height: '22px', width: '150px', marginBottom: '18px' }} />
                <div className="shimmer-loading rounded-xl" style={{ height: '54px', width: '100%', marginBottom: '12px' }} />
                <div className="shimmer-loading rounded-xl" style={{ height: '54px', width: '100%', marginBottom: '12px' }} />
                <div className="shimmer-loading rounded-xl" style={{ height: '54px', width: '100%' }} />
            </div>

            <div className="bg-[#FFFBE6] rounded-2xl border shadow-sm p-6">
                <div className="shimmer-loading rounded-xl" style={{ height: '22px', width: '200px', marginBottom: '18px' }} />
                <div className="shimmer-loading rounded-xl" style={{ height: '48px', width: '100%', marginBottom: '10px' }} />
                <div className="shimmer-loading rounded-xl" style={{ height: '48px', width: '100%', marginBottom: '10px' }} />
                <div className="shimmer-loading rounded-xl" style={{ height: '48px', width: '82%' }} />
            </div>

            <div className="bg-gray-50 rounded-2xl border shadow-sm p-6">
                <div className="shimmer-loading rounded-xl" style={{ height: '22px', width: '170px', marginBottom: '18px' }} />
                <div className="shimmer-loading rounded-xl" style={{ height: '44px', width: '100%' }} />
            </div>
        </div>
    );
};

// Sub-components for cleaner file

const MenuManager = ({ data, actions }) => {
    const [draftItems, setDraftItems] = useState(data.menu.items || []);
    const [isPosted, setIsPosted] = useState(data.menu.posted);
    const [closingTime, setClosingTime] = useState(data.menu.closingTime || '');
    const [menuImage, setMenuImage] = useState(data.menu.image || '');
    const [showHistory, setShowHistory] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null); // null | 'publish' | 'unpublish' | 'closeOrder'
    const [storeInfo, setStoreInfo] = useState({ name: '', address: '', phone: '' });
    const [menuRemark, setMenuRemark] = useState(data.menu.remark || '');
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [actionLoadingText, setActionLoadingText] = useState('處理中，請稍候...');
    const [historyPage, setHistoryPage] = useState(1);
    const HISTORY_PAGE_SIZE = 12;
    
    const { showAlert, showConfirm, PopupRenderer } = usePopup();
    const lastSyncRef = React.useRef(data.menu.lastUpdated);

    // Sync from global data on first load OR when local draft is empty but global data exists
    const [hasInitialized, setHasInitialized] = useState(false);
    useEffect(() => {
        const hasData = data.menu && (data.menu.lastUpdated || (data.menu.items && data.menu.items.length > 0) || data.menu.image);
        if (hasData && !hasInitialized) {
            setIsPosted(data.menu.posted);
            setDraftItems(data.menu.items || []);
            setClosingTime(data.menu.closingTime || '');
            setMenuImage(data.menu.image || '');
            setStoreInfo(data.menu.storeInfo || { name: '', address: '', phone: '' });
            setMenuRemark(data.menu.remark || '');
            setHasInitialized(true);
            lastSyncRef.current = data.menu.lastUpdated;
        }
    }, [data.menu, hasInitialized]);

    // Detect external data changes (for example, loaded from menu library).
    const isSyncingRef = React.useRef(false); 
    useEffect(() => {
        // Sync local draft when remote menu version changes.
        const isGlobalNewer = data.menu.lastUpdated && data.menu.lastUpdated !== lastSyncRef.current;
        const isLocalEmpty = draftItems.length === 0 && data.menu.items && data.menu.items.length > 0 && !menuImage;

        if (hasInitialized && (isGlobalNewer || isLocalEmpty)) {
            if (isSyncingRef.current) return;
            
            setIsPosted(data.menu.posted);
            setDraftItems(data.menu.items || []);
            setClosingTime(data.menu.closingTime || '');
            setMenuImage(data.menu.image || '');
            setStoreInfo(data.menu.storeInfo || { name: '', address: '', phone: '' });
            setMenuRemark(data.menu.remark || '');
            lastSyncRef.current = data.menu.lastUpdated;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.menu.lastUpdated, hasInitialized, data.menu.items, data.menu.image]);

    useEffect(() => {
        setHistoryPage(1);
    }, [showHistory, data.menuHistory?.length]);

    useEffect(() => {
        if (!showHistory) return;
        if ((data.menuHistory || []).length > 0) return;
        void actions.fetchData(['history'], {
            silent: true,
            timeoutMs: 8000,
            retries: 0,
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showHistory, data.menuHistory?.length]);



    const deleteHistory = async (hist) => {
        const ok = await showConfirm({
            icon: '⚠️',
            iconBg: '#FEE2E2',
            title: `刪除「${hist.name}」嗎？`,
            message: '刪除後無法復原。',
            confirmText: '確認刪除',
            confirmColor: '#DC2626'
        });
        if (ok) actions.deleteMenuHistory(hist.id);
    };

    const loadHistory = async (hist) => {
        if (isPosted) {
            showAlert({
                icon: '⚠️',
                iconBg: '#FEF3C7',
                title: '菜單已發布，無法載入歷史',
                message: '請先下架目前菜單，再進行載入。',
                buttonColor: '#D97706'
            });
            return;
        }
        const ok = await showConfirm({
            icon: '📋',
            iconBg: '#DBEAFE',
            title: `載入「${hist.name}」嗎？`,
            message: '目前草稿會被這份歷史菜單覆蓋。',
            confirmText: '確認載入',
            confirmColor: '#2563EB'
        });
        if (ok) {
            const items = hist.items || [];
            const image = hist.image || '';
            const store = hist.storeInfo || { name: '', address: '', phone: '' };
            const remark = hist.remark || '';
            setDraftItems(items);
            setMenuImage(image);
            setStoreInfo(store);
            setMenuRemark(remark);
        }
    };

    const handlePublish = async (status, shouldClearOrders = false) => {
        if (isActionLoading) return;
        setActionLoadingText(status ? '處理中，正在上架菜單...' : '處理中，正在下架菜單...');
        setIsActionLoading(true);
        isSyncingRef.current = true; // avoid sync race while publishing/unpublishing
        try {
        if (!status) {
            // Unpublish flow
            const today = new Date();
            const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
            const name = storeInfo.name ? storeInfo.name : '未命名店家';
            const autoSaveName = `${dateStr} 下架存檔 - ${name}`;
            actions.addMenuHistory(autoSaveName, draftItems, menuImage, storeInfo, menuRemark);

            const emptyItems = [];
            const emptyImage = '';
            const emptyStore = { name: '', address: '', phone: '' };
            const emptyRemark = '';
            
            setDraftItems(emptyItems);
            setMenuImage(emptyImage);
            setStoreInfo(emptyStore);
            setMenuRemark(emptyRemark);
            setIsPosted(false);
            
            await actions.updateMenu(emptyItems, false, closingTime, emptyImage, emptyStore, emptyRemark, true, true);
            await showAlert({
                icon: '✅',
                title: '已下架菜單',
                message: '前台已暫停顯示今日菜單。'
            });
        } else {
            // Publish flow
            if (shouldClearOrders) {
                await actions.clearOrders(true);
            }
            setIsPosted(true);
            await actions.updateMenu(draftItems, true, closingTime, menuImage, storeInfo, menuRemark, !shouldClearOrders, true);
            await showAlert({
                icon: '✅',
                title: '已發布菜單',
                message: '前台現在可以開始點餐。'
            });
        }
        
        // Keep sync lock briefly to prevent flicker from delayed refreshes.
        setTimeout(() => { isSyncingRef.current = false; }, 2000);
        } catch (err) {
            console.error('handlePublish error:', err);
            await showAlert({
                icon: '❌',
                title: '操作失敗',
                message: err?.message || '請稍後再試',
                buttonColor: '#DC2626'
            });
        } finally {
            setActionLoadingText('處理中，請稍候...');
            setIsActionLoading(false);
        }
    };



    const doCloseOrder = async () => {
        if (isActionLoading) return;
        setActionLoadingText('處理中，正在結單...');
        setIsActionLoading(true);
        try {
        // Auto-save specific for Closing
        const today = new Date();
        const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
        const name = storeInfo.name ? storeInfo.name : '未命名店家';
        const autoSaveName = `${dateStr} 結單存檔 - ${name}`;
        actions.addMenuHistory(autoSaveName, draftItems, menuImage, storeInfo, menuRemark);

        // Unpost
        setIsPosted(false);
        await actions.updateMenu(draftItems, false, closingTime, menuImage, storeInfo, menuRemark, true, true);

        await showAlert({
            icon: '✅',
            iconBg: '#E0E7FF',
            title: '已完成結單',
            message: '今日菜單已關閉並自動保存。',
            buttonColor: '#4B5563'
        });
        } catch (err) {
            console.error('doCloseOrder error:', err);
            await showAlert({
                icon: '❌',
                title: '結單失敗',
                message: err?.message || '請稍後再試',
                buttonColor: '#DC2626'
            });
        } finally {
            setActionLoadingText('處理中，請稍候...');
            setIsActionLoading(false);
        }
    };

    // Date/Time Options Generation
    const getNext3Days = () => {
        const dates = [];
        for (let i = 0; i < 3; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateStr = getLocalDateKey(d);
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const displayStr = `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
            dates.push({ value: dateStr, label: i === 0 ? `今天 ${displayStr}` : displayStr });
        }
        return dates;
    };

    const ALL_CLOSING_TIMES = ["09:00", "12:00", "17:00"];

    const parseTimeToMinutes = (time) => {
        const [hh, mm] = String(time || '00:00').split(':').map(Number);
        return (hh || 0) * 60 + (mm || 0);
    };

    const getWholeHours = (selectedDate) => {
        const todayKey = getLocalDateKey();
        if (selectedDate !== todayKey) {
            return ALL_CLOSING_TIMES;
        }

        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        return ALL_CLOSING_TIMES.filter((t) => parseTimeToMinutes(t) > nowMinutes);
    };

    // Parse existing closingTime (YYYY-MM-DD HH:mm) or default
    const [datePart, timePart] = closingTime.includes(' ') ? closingTime.split(' ') : [getLocalDateKey(), '12:00'];

    const updateDateTime = (newDate, newTime) => {
        setClosingTime(`${newDate} ${newTime}`);
    };

    const availableHours = getWholeHours(datePart);

    useEffect(() => {
        if (availableHours.length === 0) {
            if (timePart) {
                setClosingTime(`${datePart} `);
            }
            return;
        }

        if (!availableHours.includes(timePart)) {
            updateDateTime(datePart, availableHours[0]);
        }
    }, [availableHours, datePart, timePart]);

    const sortedHistory = [...(data.menuHistory || [])].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const totalHistoryPages = Math.max(1, Math.ceil(sortedHistory.length / HISTORY_PAGE_SIZE));
    const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
    const pagedHistory = sortedHistory.slice((safeHistoryPage - 1) * HISTORY_PAGE_SIZE, safeHistoryPage * HISTORY_PAGE_SIZE);

    return (
        <div className="flex flex-col gap-6 p-4">
            {/* Store Information Config (Read-only) */}
            <div className="p-6 rounded-2xl border shadow-sm flex flex-col gap-4" style={{ background: '#ffffff', borderLeft: '4px solid var(--ac-green)' }}>
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-xl font-black text-ac-brown flex items-center gap-2">
                        店家資訊
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                        <span className="text-sm font-black mb-2 ml-1 flex items-center gap-1" style={{ color: 'var(--ac-green)' }}>店名</span>
                        <div className="bg-gray-50 p-3 rounded-xl border shadow-sm text-base font-bold text-gray-700">{storeInfo.name || '(未填寫)'}</div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black mb-2 ml-1 flex items-center gap-1" style={{ color: 'var(--ac-blue)' }}>電話</span>
                        <div className="bg-gray-50 p-3 rounded-xl border shadow-sm text-base font-bold text-gray-700">{storeInfo.phone || '(未填寫)'}</div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black mb-2 ml-1 flex items-center gap-1" style={{ color: 'var(--ac-brown)' }}>地址</span>
                        <div className="bg-gray-50 p-3 rounded-xl border shadow-sm text-base font-bold text-gray-700">{storeInfo.address || '(未填寫)'}</div>
                    </div>
                </div>
            </div>

            {/* Original Menu Image for Verification */}
            {menuImage && (
                <div className="p-6 rounded-2xl border shadow-sm flex flex-col gap-4" style={{ background: '#F7F7F5', borderLeft: '4px solid #B0BEC5' }}>
                    <div className="flex justify-between items-center border-b pb-3">
                        <h3 className="text-xl font-black text-ac-brown flex items-center gap-2">
                            原始菜單圖片（核對用）
                        </h3>
                    </div>
                    <div className="flex justify-center bg-gray-50 rounded-xl p-2 border overflow-hidden">
                        <img 
                            src={menuImage} 
                            className="w-full h-auto object-contain max-h-[600px] rounded shadow-sm" 
                            alt="Original Menu"
                            loading="lazy"
                            decoding="async"
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
                        當前品項清單 ({draftItems.length})
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
                            目前沒有品項，請先透過掃描或手動新增。
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
                    <span className="font-black text-gray-800 text-base">結單時間設定</span>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 w-full">
                    <div className="flex flex-col gap-1 w-full sm:w-[160px]">
                        <span className="text-xs font-black text-blue-500 ml-1 uppercase tracking-widest">日期</span>
                        <select
                            className="ac-input py-2.5 px-4 text-base border shadow-sm rounded-xl cursor-pointer"
                            style={{ background: '#fff', width: '100%' }}
                            value={datePart}
                            onChange={(e) => {
                                const nextDate = e.target.value;
                                const nextHours = getWholeHours(nextDate);
                                const nextTime = nextHours.includes(timePart) ? timePart : (nextHours[0] || '');
                                updateDateTime(nextDate, nextTime);
                            }}
                        >
                            {getNext3Days().map(d => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex flex-col gap-1 w-full sm:w-[130px]">
                        <span className="text-xs font-black text-blue-500 ml-1 uppercase tracking-widest">時間</span>
                        <select
                            className="ac-input py-2.5 px-4 text-base border shadow-sm rounded-xl cursor-pointer"
                            style={{ background: '#fff', width: '100%' }}
                            value={timePart}
                            disabled={availableHours.length === 0}
                            onChange={(e) => updateDateTime(datePart, e.target.value)}
                        >
                            {availableHours.length === 0 && (
                                <option value="">今日已無可選時段</option>
                            )}
                            {availableHours.map(h => (
                                <option key={h} value={h}>{h}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Today's Remark Setting */}
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col gap-3" style={{ background: '#FFF7ED', borderLeft: '4px solid #FDBA74' }}>
                <span className="font-black text-gray-800 text-base flex items-center gap-2">今日備註 / 公告</span>
                <textarea 
                    className="ac-input text-sm min-h-[80px]" 
                    placeholder="請輸入今天的補充資訊（例如：最晚 11:30 前下單）" 
                    value={menuRemark} 
                    onChange={e => setMenuRemark(e.target.value)} 
                />
            </div>

            {/* Publish Toggle Section */}
            <div className="rounded-2xl border shadow-sm overflow-hidden">
                <div className="grid grid-cols-2" style={{ minHeight: '100px' }}>
                    {/* 下架 Panel */}
                    <button
                        onClick={() => isPosted && !isActionLoading && setConfirmAction('unpublish')}
                        className="flex flex-col items-center justify-center gap-2 py-5 px-4 transition-all duration-300 border-r"
                        style={{
                            background: !isPosted ? '#FEE2E2' : '#FAFAFA',
                            cursor: isPosted ? 'pointer' : 'default',
                            opacity: isPosted ? 0.7 : 1,
                        }}
                    >
                        <span style={{ fontSize: '28px' }}>{!isPosted ? '🔴' : '⭕'}</span>
                        <span className="font-black text-lg" style={{ color: !isPosted ? '#991B1B' : '#9CA3AF' }}>
                            下架
                        </span>
                        {!isPosted && (
                            <span className="text-xs font-bold px-3 py-1 rounded-full animate-status-pulse" style={{ background: '#FECACA', color: '#991B1B' }}>
                                目前狀態
                            </span>
                        )}
                        {isPosted && (
                            <span className="text-xs text-gray-400">點擊可下架</span>
                        )}
                    </button>

                    {/* 上架 Panel */}
                    <button
                        onClick={() => !isPosted && !isActionLoading && setConfirmAction('publish')}
                        className="flex flex-col items-center justify-center gap-2 py-5 px-4 transition-all duration-300"
                        style={{
                            background: isPosted ? '#D1FAE5' : '#FAFAFA',
                            cursor: !isPosted ? 'pointer' : 'default',
                            opacity: !isPosted ? 0.7 : 1,
                        }}
                    >
                        <span style={{ fontSize: '28px', lineHeight: 1 }}>🟢</span>
                        <span className="font-black text-lg" style={{ color: isPosted ? '#065F46' : '#9CA3AF' }}>
                            上架
                        </span>
                        {isPosted && (
                            <span className="text-xs font-bold px-3 py-1 rounded-full animate-status-pulse" style={{ background: '#A7F3D0', color: '#065F46' }}>
                                目前狀態
                            </span>
                        )}
                        {!isPosted && (
                            <span className="text-xs text-gray-400">點擊可發布</span>
                        )}
                    </button>
                </div>

                {/* Close Order - only visible when posted */}
                {isPosted && (
                    <div className="flex justify-center py-3 border-t" style={{ background: '#F9FAFB' }}>
                        <button
                            onClick={() => !isActionLoading && setConfirmAction('closeOrder')}
                            className="font-black px-6 py-2.5 rounded-full transition-all"
                            style={{ backgroundColor: '#4B5563', color: '#fff', fontSize: '1.05rem', letterSpacing: '0.05em', padding: '12px 34px' }}
                        >
                            {isActionLoading ? '處理中...' : '立即結單'}
                        </button>
                    </div>
                )}
            </div>
            {isActionLoading && (
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-ac-blue bg-blue-50 border border-blue-200 rounded-xl py-2">
                    <Loader size={16} className="animate-spin" />
                    {actionLoadingText}
                </div>
            )}

            {/* Publish/Unpublish Confirm Modal */}
            <ConfirmModal
                isOpen={confirmAction === 'publish'}
                onClose={() => setConfirmAction(null)}
                onConfirm={async () => {
                    setConfirmAction(null);
                    const clearAll = await showConfirm({
                        icon: '🧹',
                        iconBg: '#E0F2FE',
                        title: '發布前要清空今日訂單嗎？',
                        message: '如果你已更換菜單，建議先清空舊訂單。',
                        confirmText: '清空再發布',
                        confirmColor: '#3B82F6',
                        cancelText: '保留舊訂單'
                    });
                    await handlePublish(true, clearAll);
                }}
                icon="📢"
                iconBg="#D1FAE5"
                title="確認發布菜單？"
                message="發布後前台就會顯示目前的菜單內容。"
                confirmText="確認發布"
                cancelText="取消"
                confirmColor="#059669"
            />
            <ConfirmModal
                isOpen={confirmAction === 'closeOrder'}
                onClose={() => setConfirmAction(null)}
                onConfirm={doCloseOrder}
                icon="🔒"
                iconBg="#E0E7FF"
                title="確認結單？"
                message={'結單會：\n1. 保存今日菜單到歷史\n2. 關閉前台點餐'}
                confirmText="確認結單"
                cancelText="取消"
                confirmColor="#4B5563"
            />
            <ConfirmModal
                isOpen={confirmAction === 'unpublish'}
                onClose={() => setConfirmAction(null)}
                onConfirm={async () => { await handlePublish(false); }}
                icon="📴"
                iconBg="#FEE2E2"
                title="確認下架菜單？"
                message="下架後前台將看不到今日菜單。"
                confirmText="確認下架"
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
                        菜單歷史
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#D97706', color: '#fff', padding: '2px 8px', borderRadius: '999px' }}>
                            {(data.menuHistory || []).length}
                        </span>
                    </span>
                    <span style={{ fontSize: '12px', color: '#9CA3AF', transition: 'transform 0.2s', transform: showHistory ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                </button>

                {showHistory && (
                    <div className="bg-gray-50 p-4 rounded-xl mt-2 border border-dashed border-gray-300 animate-slide-up">
                        <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                            {sortedHistory.length === 0 ? (
                                <div className="text-center text-gray-400 text-sm py-8">目前沒有歷史菜單</div>
                            ) : (
                                pagedHistory.map(hist => (
                                        <div key={hist.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="font-bold text-ac-brown truncate">{hist.name || '未命名菜單'}</div>
                                                <div className="text-xs text-gray-500">
                                                    {(hist.items || []).length} 項
                                                    {' · '}
                                                    {hist.date ? new Date(hist.date).toLocaleString() : '無日期'}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <Button variant="secondary" className="text-xs px-3 py-1 h-8" onClick={() => loadHistory(hist)}>
                                                    載入
                                                </Button>
                                                <Button variant="danger" className="text-xs px-3 py-1 h-8" onClick={() => deleteHistory(hist)}>
                                                    刪除
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                        {totalHistoryPages > 1 && (
                            <div className="mt-3 flex items-center justify-end gap-2">
                                <Button
                                    variant="secondary"
                                    className="text-xs px-3 py-1 h-8"
                                    disabled={safeHistoryPage <= 1}
                                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                >
                                    上一頁
                                </Button>
                                <span className="text-xs font-bold text-gray-500">
                                    第 {safeHistoryPage} / {totalHistoryPages} 頁
                                </span>
                                <Button
                                    variant="secondary"
                                    className="text-xs px-3 py-1 h-8"
                                    disabled={safeHistoryPage >= totalHistoryPages}
                                    onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                                >
                                    下一頁
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
};

// ========================
// Menu Library Manager
// ========================
const MenuLibraryManager = ({ data, actions, setActiveTab, uploadImageToCloud, isInitialLoading = false }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [showFavOnly, setShowFavOnly] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [libraryPage, setLibraryPage] = useState(1);
    const [isLoadingToDaily, setIsLoadingToDaily] = useState(false);
    const [loadingDailyName, setLoadingDailyName] = useState('');
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
                // Do not persist expanded/collapsed state: always start collapsed.
                // Keep draft field values only.
                setEditingId(draft.editingId || null);
                setFormName(draft.formName || '');
                setFormCategory(draft.formCategory || 'chinese');
                setFormStoreInfo(draft.formStoreInfo || { name: '', address: '', phone: '' });
                setFormItems(draft.formItems || []);
                setFormImage(draft.formImage || '');
                setFormRemark(draft.formRemark || '');
                setShowAddForm(false);
            } catch (e) {
                console.error("Failed to parse library draft:", e);
            }
        }
    }, []);

    // Save draft state to sessionStorage
    useEffect(() => {
        sessionStorage.setItem('menu_library_draft', JSON.stringify({
            editingId, formName, formCategory, formStoreInfo, formItems, formImage, formRemark
        }));
    }, [editingId, formName, formCategory, formStoreInfo, formItems, formImage, formRemark]);

    // States for Add Item Modal
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');

    // Scanning state for library batch upload
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
    const { showAlert, showConfirm, PopupRenderer: LibPopup } = usePopup();

    const library = [...(data.menuLibrary || [])].reverse(); // show newest entries first

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
    const LIBRARY_PAGE_SIZE = 12;
    const totalLibraryPages = Math.max(1, Math.ceil(filteredLibrary.length / LIBRARY_PAGE_SIZE));
    const safeLibraryPage = Math.min(libraryPage, totalLibraryPages);
    const pagedLibrary = filteredLibrary.slice((safeLibraryPage - 1) * LIBRARY_PAGE_SIZE, safeLibraryPage * LIBRARY_PAGE_SIZE);

    useEffect(() => {
        setLibraryPage(1);
    }, [searchTerm, filterCategory, showFavOnly, data.menuLibrary?.length]);

    const resetForm = () => {
        setFormName(''); setFormCategory('chinese');
        setFormStoreInfo({ name: '', address: '', phone: '' });
        setFormItems([]); setFormImage(''); setFormRemark('');
        setEditingId(null); setShowAddForm(false);
    };

    const handleConfirmAddItem = () => {
        if (!newItemName.trim() || !newItemPrice) {
            showAlert({
                icon: '⚠️',
                iconBg: '#FEF3C7',
                title: '資料不完整',
                message: '請輸入品項名稱與價格。',
                buttonColor: '#D97706'
            });
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

    const handleSave = async () => {
        if (!formName && !formStoreInfo.name) {
            showAlert({
                icon: '⚠️',
                iconBg: '#FEF3C7',
                title: '請至少填寫店名',
                buttonColor: '#D97706'
            });
            return;
        }
        
        setIsSaving(true);
        try {
            let finalImageUrl = formImage;
            // Upload Base64 image to Google Drive if needed.
            if (formImage && formImage.startsWith('data:')) {
                const cloudUrl = await uploadImageToCloud(formImage, `lib_${Date.now()}`);
                if (cloudUrl) {
                    finalImageUrl = cloudUrl;
                } else {
                    console.warn("Cloud upload failed, falling back to original image.");
                }
            }

            const payload = {
                name: formName || formStoreInfo.name,
                category: formCategory,
                storeInfo: formStoreInfo,
                items: formItems,
                image: finalImageUrl,
                remark: formRemark,
                isFavorite: false
            };
            
            if (editingId) {
                // Keep existing behavior (no await), only fix broken alert literals.
                actions.updateMenuLibrary(editingId, payload);
                showAlert({ icon: '✅', title: '菜單庫已更新' });
            } else {
                // Keep existing behavior (no await), only fix broken alert literals.
                actions.addMenuLibrary(payload);
                showAlert({ icon: '✅', title: '已新增到菜單庫' });
            }
            resetForm();
        } catch (err) {
            console.error("handleSave Error:", err);
            showAlert({
                icon: '❌',
                title: '儲存失敗',
                message: `請稍後再試：${err.message || '未知錯誤'}`,
                buttonColor: '#DC2626'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        const ok = await showConfirm({
            icon: '🗑️',
            iconBg: '#FEE2E2',
            title: `刪除「${name}」？`,
            message: '此操作無法復原。',
            confirmText: '確認刪除',
            confirmColor: '#DC2626'
        });
        if (ok) actions.deleteMenuLibrary(id);
    };

    const loadToDaily = async (menu) => {
        if (isLoadingToDaily) return;
        if (data.menu?.posted) {
            showAlert({
                icon: '⚠️',
                iconBg: '#FEF3C7',
                title: '今日菜單已發布',
                message: '請先取消發布，才能載入新的菜單。',
                buttonColor: '#D97706'
            });
            return;
        }
        const ok = await showConfirm({
            icon: '📌',
            iconBg: '#DBEAFE',
            title: `載入「${menu.name}」到今日菜單？`,
            message: '這會清空目前訂單，並以此菜單覆蓋今日菜單內容。',
            confirmText: '確認載入',
            confirmColor: '#2563EB'
        });
        if (ok) {
            setIsLoadingToDaily(true);
            setLoadingDailyName(menu.name || '未命名菜單');
            try {
                // Fast path: optimistic local update + background write.
                await actions.clearOrders(true);
                await actions.updateMenu(menu.items, false, '', menu.image || '', menu.storeInfo || {}, menu.remark || '', false, true);
                await showAlert({
                    icon: '✅',
                    title: '已載入到今日菜單',
                    message: '你可以到「今日菜單」頁籤繼續編輯。',
                    buttonText: 'OK',
                    buttonColor: '#2563EB'
                });
                setActiveTab('menu');
            } catch (err) {
                console.error('loadToDaily error:', err);
                await showAlert({
                    icon: '❌',
                    title: '載入失敗',
                    message: err?.message || '請稍後再試',
                    buttonColor: '#DC2626'
                });
            } finally {
                setIsLoadingToDaily(false);
                setLoadingDailyName('');
            }
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
        
        // Preserve backend debug fields without throwing.
        return { 
            items: result.items || [], 
            storeInfo: result.storeInfo || {}, 
            remark: result.remark || '',
            error: result.error || null,
            raw: result.raw || null,
            aiResponse: result.aiResponse || null
        };
    };

    const handleLibraryUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        
        setIsScanning(true);
        setScanProgress({ current: 0, total: files.length });
        let allItems = []; // merged OCR items from all uploaded images
        let latestStore = { name: '', address: '', phone: '' }; // latest detected store info
        let combinedRemark = ''; // merged OCR remarks

        for (let i = 0; i < files.length; i++) {
            setScanProgress({ current: i + 1, total: files.length });
            try {
                // Optimize image before sending to GAS Proxy
                const base64Orig = await new Promise(r => { const rd = new FileReader(); rd.onload = ev => r(ev.target.result); rd.readAsDataURL(files[i]); });
                
                // OCR mode: keep more detail for dense menu tables.
                const img = new Image();
                await new Promise(r => { img.onload = r; img.src = base64Orig; });
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1800;
                const scale = Math.min(1, MAX_WIDTH / img.width); // do not upscale
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                // Extract pure base64 payload from Data URL.
                const pureBase64 = dataUrl.split(',')[1];

                if (i === 0) setFormImage(dataUrl);

                const visionRes = await callAzureVision(pureBase64);
                if (visionRes.items && visionRes.items.length > 0) {
                    allItems = [...allItems, ...visionRes.items];
                    if (visionRes.storeInfo.name) latestStore.name = visionRes.storeInfo.name;
                    if (visionRes.storeInfo.phone) latestStore.phone = visionRes.storeInfo.phone;
                    if (visionRes.storeInfo.address) latestStore.address = visionRes.storeInfo.address;
                    if (visionRes.remark) {
                       combinedRemark = combinedRemark ? combinedRemark + '\n' + visionRes.remark : visionRes.remark;
                    }
                }
            } catch (err) { 
                console.error(`File ${i + 1} error:`, err); 
                showAlert({
                    icon: '❌',
                    iconBg: '#FEE2E2',
                    title: 'AI 掃描失敗',
                    message: `第 ${i + 1} 張圖片處理失敗：${err.message}`,
                    buttonColor: '#DC2626'
                });
            }
        }

        // Only replace items when OCR actually returned results.
        if (allItems.length > 0) setFormItems(allItems);
        setFormStoreInfo(latestStore);
        if (latestStore.name && !formName) setFormName(latestStore.name);
        
        // Trim remark to avoid noisy whitespace and serialization issues.
        const cleanRemark = combinedRemark.trim();
        setFormRemark(cleanRemark);
        setIsScanning(false);
        setScanProgress({ current: 0, total: 0 });
        
        if (allItems.length > 0) {
            showAlert({
                icon: '✅',
                iconBg: '#D1FAE5',
                title: `掃描完成，共 ${allItems.length} 筆品項`,
                buttonColor: 'var(--ac-green)'
            });
        } else {
            showAlert({ 
                icon: '⚠️',
                iconBg: '#FEF3C7',
                title: '沒有辨識到品項',
                message: 'AI 未辨識出可用菜單內容，請確認圖片清晰度或改用手動輸入。',
                buttonColor: '#D97706' 
            });
        }
        e.target.value = '';
    };

    const getCategoryLabel = (id) => (MENU_CATEGORIES.find(c => c.id === id) || {}).label || id;
    const getCategoryColor = (id) => (MENU_CATEGORIES.find(c => c.id === id) || {}).color || '#95A5A6';

    return (
        <div className="p-4 flex flex-col gap-4">
            {isInitialLoading && (
                <div className="fixed inset-0 z-[2147483000] pointer-events-none flex items-start justify-center pt-24">
                    <div className="bg-white/95 border border-blue-200 rounded-2xl shadow-xl px-5 py-3 flex items-center gap-3">
                        <Loader size={18} className="animate-spin text-ac-blue" />
                        <span className="font-bold text-ac-brown">菜單庫資料載入中...</span>
                    </div>
                </div>
            )}
            {/* Toolbar */}
            <div className="flex flex-col gap-3">
                {isLoadingToDaily && (
                    <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-ac-blue">
                        <Loader className="animate-spin" size={16} />
                        處理中，正在載入「{loadingDailyName}」到今日菜單...
                    </div>
                )}
                <div className="flex gap-2 items-center">
                    <div className="flex-grow relative">
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                        <input className="ac-input" style={{ paddingLeft: '36px' }} placeholder="搜尋菜單、店家或品項..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
                        <span className="whitespace-nowrap">{showFavOnly ? '顯示全部' : '只看收藏'}</span>
                    </button>
                    <div className="relative group">
                        <select 
                            className="appearance-none bg-white border-2 border-gray-100 text-gray-700 text-base font-black rounded-full pl-6 pr-12 h-12 shadow-md outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 hover:border-ac-blue hover:text-ac-blue hover:shadow-lg transition-all cursor-pointer min-w-[160px]"
                            value={filterCategory} 
                            onChange={e => setFilterCategory(e.target.value)}
                        >
                            <option value="all">全部分類</option>
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
                        {editingId ? '編輯菜單庫' : '新增菜單庫資料'}
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
                                            AI 掃描中...
                                        </span>
                                        <div className="flex items-center justify-center gap-2">
                                           <span className="text-xs text-blue-400 font-black bg-blue-50 px-3 py-1 rounded-full uppercase">
                                              處理中：{scanProgress.current} / {scanProgress.total} 張
                                           </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <label
                                    className="group cursor-pointer w-full flex flex-col items-center justify-center gap-3 py-5 px-4 rounded-2xl border shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all"
                                    style={{
                                        backgroundColor: '#EAF6FF',
                                        borderColor: '#B9E3FF',
                                        boxShadow: 'inset 0 0 0 1px rgba(185,227,255,0.45)'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#DDF0FF'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#EAF6FF'; }}
                                >
                                    <div className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center border-4 border-blue-100 group-hover:border-ac-blue transition-colors">
                                        <Upload size={32} className="text-ac-blue" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-black text-lg text-ac-brown">
                                            上傳菜單圖片
                                        </span>
                                        <span className="text-xs text-gray-500 font-bold px-4 py-1 rounded-full bg-white/75 inline-block mt-1">
                                            AI 自動辨識品項與店家資訊
                                        </span>
                                    </div>
                                    <input type="file" style={{ display: 'none' }} accept="image/*" multiple onChange={handleLibraryUpload} />
                                </label>
                            )}
                        </div>

                        {formImage && (
                            <div className="text-center relative py-2">
                                <div className="relative inline-block max-w-full">
                                   <img 
                                        src={formImage} 
                                        className="rounded-2xl shadow-lg border-4 border-white ring-1 ring-gray-100 object-contain mx-auto" 
                                        style={{ maxHeight: '300px', maxWidth: '100%' }}
                                        loading="lazy"
                                        decoding="async"
                                    />
                                   <button 
                                        onClick={() => setFormImage('')} 
                                        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all ring-4 ring-white z-20"
                                    >
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
                                <input className="ac-input focus:ring-4 focus:ring-blue-100 transition-all" placeholder="例如：阿美小吃" value={formName} onChange={e => setFormName(e.target.value)} />
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
                                <input className="ac-input text-sm" placeholder="店家名稱" value={formStoreInfo.name} onChange={e => setFormStoreInfo({...formStoreInfo, name: e.target.value})} />
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
                                placeholder="請輸入補充說明（例如：加辣請註明）" 
                                value={formRemark} 
                                onChange={e => setFormRemark(e.target.value)}
                            />
                        </div>

                        {/* Items editor */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between ml-1">
                               <h4 className="font-black text-sm text-ac-brown">品項清單 ({formItems.length})</h4>
                               <button 
                                  onClick={() => setShowAddItemModal(true)} 
                                  className="ac-btn secondary text-xs sm:text-sm whitespace-nowrap shrink-0" 
                                  style={{ padding: '8px 14px', boxSizing: 'border-box', minHeight: '38px', fontSize: '0.85rem' }}
                                >
                                  <Plus size={14} /> 新增品項
                                </button>
                            </div>
                            {formItems.length === 0 ? (
                                <div className="text-center py-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-100 text-gray-400 text-xs font-bold">
                                    尚未新增品項，請使用上方按鈕新增或上傳圖片辨識。
                                </div>
                            ) : (
                                <div className="max-h-[350px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
                                        {formItems.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm hover:border-blue-300 transition-colors animate-pop group" style={{ animationDelay: `${(i % 10) * 0.03}s` }}>
                                                <input 
                                                    className="font-bold text-gray-700 placeholder-gray-300" 
                                                    style={{ border: 'none', background: 'transparent', outline: 'none', boxShadow: 'none', padding: 0, width: '100%', flexGrow: 1, minWidth: '50px' }}
                                                    placeholder="品項名稱..." 
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

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mt-4 pt-6 border-t font-black">
                            <Button
                                variant="secondary"
                                onClick={resetForm}
                                className="w-full sm:w-auto sm:min-w-[168px] whitespace-nowrap"
                                style={{ padding: '12px 28px', minHeight: '52px' }}
                                disabled={isSaving}
                            >
                                取消
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="w-full sm:w-auto sm:min-w-[168px] whitespace-nowrap"
                                style={{ padding: '12px 28px', minHeight: '52px' }}
                                disabled={isSaving}
                            >
                                {isSaving ? <span className="flex items-center gap-2"><Loader className="animate-spin relative" size={18} style={{ top: ' -1px' }} /> 儲存中...</span> : (editingId ? '更新菜單' : '建立菜單')}
                            </Button>
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
                        <h3 className="text-center" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1F2937', marginBottom: '16px' }}>新增品項</h3>
                        
                        <div className="flex flex-col gap-4 mb-6">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-black text-gray-400 ml-1">品項名稱</span>
                                <input 
                                    className="ac-input" 
                                    placeholder="例如：雞腿飯" 
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
                                確認新增
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Library List */}
            <div className="flex flex-col gap-3">
                {filteredLibrary.length === 0 && (
                    <div className="text-center text-gray-400 py-8 italic">
                        {library.length === 0 ? '目前沒有菜單庫資料，先新增第一筆吧。' : '沒有符合條件的菜單。'}
                    </div>
                )}
                {pagedLibrary.map(menu => (
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
                            <div style={{ fontSize: '0.8rem', color: '#777', marginBottom: '6px' }}>{(menu.items || []).length} 項</div>
                        </div>


                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '8px', padding: '0 16px 16px', flexWrap: 'wrap' }}>
                            <Button
                                variant="primary"
                                onClick={() => loadToDaily(menu)}
                                style={{ fontSize: '0.9rem', padding: '8px 18px', height: 'auto' }}
                                disabled={isLoadingToDaily}
                            >
                                {isLoadingToDaily ? '處理中...' : '載入到今日菜單'}
                            </Button>
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
                                title="切換收藏"
                            >
                                <Heart size={14} style={{ fill: menu.isFavorite ? '#ef4444' : 'none' }} />
                                {menu.isFavorite ? '已收藏' : '收藏'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            {totalLibraryPages > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="secondary"
                        className="text-xs px-3 py-1 h-8"
                        disabled={safeLibraryPage <= 1}
                        onClick={() => setLibraryPage(p => Math.max(1, p - 1))}
                    >
                        上一頁
                    </Button>
                    <span className="text-xs font-bold text-gray-500">
                        第 {safeLibraryPage} / {totalLibraryPages} 頁
                    </span>
                    <Button
                        variant="secondary"
                        className="text-xs px-3 py-1 h-8"
                        disabled={safeLibraryPage >= totalLibraryPages}
                        onClick={() => setLibraryPage(p => Math.min(totalLibraryPages, p + 1))}
                    >
                        下一頁
                    </Button>
                </div>
            )}
            <LibPopup />
        </div>
    );
};

const MemberManager = ({ data, actions }) => {
    const [newName, setNewName] = useState('');
    const [editingMember, setEditingMember] = useState(null);
    const [editName, setEditName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [removingName, setRemovingName] = useState('');
    const { showConfirm, PopupRenderer: MemberPopup } = usePopup();

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

    const handleAddMember = async () => {
        const nextName = String(newName || '').replace(/\s+/g, ' ').trim();
        if (!nextName || isAdding) return;
        setIsAdding(true);
        try {
            const result = await actions.addMember(nextName);
            if (result?.ok !== false) {
                setNewName('');
            }
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async (member) => {
        const target = String(member || '').trim();
        if (!target || removingName === target) return;
        const ok = await showConfirm({
            icon: '⚠️',
            iconBg: '#FEE2E2',
            title: `刪除成員「${target}」？`,
            message: '刪除後會同步移除該成員名稱，且無法復原。',
            confirmText: '確認刪除',
            cancelText: '取消',
            confirmColor: '#DC2626',
        });
        if (!ok) return;
        setRemovingName(target);
        try {
            await actions.removeMember(target);
        } finally {
            setRemovingName('');
        }
    };

    return (
        <div className="p-4 flex flex-col gap-4">
            <div className="flex gap-2">
                <input
                    className="ac-input flex-grow"
                    placeholder="輸入新成員名稱..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleAddMember();
                        }
                    }}
                />
                <Button
                    onClick={() => void handleAddMember()}
                    className="whitespace-nowrap"
                    disabled={isAdding || !String(newName || '').trim()}
                >
                    <Plus size={16} /> {isAdding ? '新增中...' : '新增'}
                </Button>
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
                                    <button
                                        onClick={() => void handleRemoveMember(m)}
                                        disabled={removingName === m}
                                        className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={removingName === m ? '刪除中...' : '刪除成員'}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
            <MemberPopup />
        </div>
    );
};








const StatsManager = ({ data }) => {
    // History Filter State
    const [selectedDate, setSelectedDate] = useState(getLocalDateKey());
    const [statsTab, setStatsTab] = useState('member');
    const dateInputRef = useRef(null);

    const openDatePicker = () => {
        const input = dateInputRef.current;
        if (!input) return;

        // Chromium supports showPicker(); fallback keeps Safari/iOS usable.
        if (typeof input.showPicker === 'function') {
            input.showPicker();
            return;
        }

        input.focus();
        input.click();
    };

    // Filter orders by date (API returns ISO date string)
    // GAS orders date format is ISO string. data.orders contains ALL orders.
    const filteredOrders = (data.orders || []).filter(o => {
        // Handle timezone issues roughly or just compare string prefix YYYY-MM-DD
        // The GAS date is ISO.
        if (!o.date) return false;
        return getLocalDateKey(o.date) === selectedDate;
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

    // Item count stats (quantity only, no price)
    const itemStats = Object.entries(
        orders.reduce((acc, order) => {
            (order.items || []).forEach((item) => {
                const name = String(item?.name || '').trim() || '未命名品項';
                const rawQty = Number(item?.qty ?? item?.quantity ?? item?.count ?? 1);
                const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
                acc[name] = (acc[name] || 0) + qty;
            });
            return acc;
        }, {})
    ).sort((a, b) => b[1] - a[1]);
    const itemTotalQty = itemStats.reduce((sum, [, qty]) => sum + qty, 0);

    const memberEntries = Object.entries(byMember)
        .sort((a, b) => (b[1].count - a[1].count) || (b[1].total - a[1].total));

    return (
        <div className="p-4 flex flex-col gap-6">
            {/* Date Filter */}
            <div
                className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg cursor-pointer"
                onClick={openDatePicker}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDatePicker();
                    }
                }}
                aria-label="開啟日期選擇器"
            >
                <span className="font-bold text-gray-600">選擇日期</span>
                <input
                    ref={dateInputRef}
                    type="date"
                    className="ac-input py-1 flex-1 bg-white cursor-pointer"
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
                    <img src={bellsIcon} className="absolute -bottom-2 -right-2 w-16 h-16 opacity-30" loading="lazy" decoding="async" />
                    <div className="text-3xl font-bold relative z-10">${total}</div>
                    <div className="text-sm opacity-90 relative z-10">總金額</div>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                <button
                    onClick={() => setStatsTab('member')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${statsTab === 'member' ? 'bg-ac-green text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                >
                    成員統計
                </button>
                <button
                    onClick={() => setStatsTab('item')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${statsTab === 'item' ? 'bg-ac-green text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                >
                    品項統計（數量）
                </button>
            </div>

            {statsTab === 'member' ? (
                <div className="flex flex-col gap-2">
                    <h3 className="font-bold border-b pb-2">成員統計</h3>
                    {memberEntries.map(([member, stat]) => (
                        <div key={member} className="bg-white p-3 rounded-lg flex justify-between items-center text-sm">
                            <div>
                                <span className="font-bold text-lg mr-2">{member}</span>
                                <span className="text-gray-500">{stat.items.map(i => i.name).join(', ')}</span>
                            </div>
                            <div className="font-bold text-ac-orange">${stat.total}</div>
                        </div>
                    ))}
                    {memberEntries.length === 0 && <div className="text-center italic text-gray-400 py-4">這天沒有成員統計資料</div>}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <h3 className="font-bold border-b pb-2">品項統計（數量）</h3>
                    {itemStats.map(([itemName, qty]) => (
                        <div key={itemName} className="bg-white p-3 rounded-lg flex justify-between items-center text-sm">
                            <span className="font-bold text-gray-700">{itemName}</span>
                            <span className="font-black text-ac-green">x {qty}</span>
                        </div>
                    ))}
                    {itemStats.length > 0 && (
                        <div className="bg-green-50 p-3 rounded-lg flex justify-between items-center text-sm border border-green-200">
                            <span className="font-black text-green-700">總計</span>
                            <span className="font-black text-green-700">x {itemTotalQty}</span>
                        </div>
                    )}
                    {itemStats.length === 0 && <div className="text-center italic text-gray-400 py-4">這天沒有品項統計資料</div>}
                </div>
            )}
        </div>
    );
};

const NoticeManager = ({ data, actions }) => {
    const [text, setText] = useState(data.announcement);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showAlert, PopupRenderer: NoticePopup } = usePopup();

    useEffect(() => {
        setText(data.announcement || '');
    }, [data.announcement]);

    return (
        <div className="p-4 flex flex-col gap-4 h-full">
            <h3 className="font-bold text-gray-500">編輯公告欄</h3>
            <textarea
                className="ac-input flex-grow min-h-[150px] resize-none"
                value={text}
                onChange={e => setText(e.target.value)}
            />
            <Button
                onClick={async () => {
                    if (isSubmitting) return;
                    setIsSubmitting(true);
                    try {
                        const res = await actions.updateAnnouncement(text);
                        if (res?.persisted) {
                            await showAlert({ icon: '✅', title: '公告已成功更新' });
                        } else {
                            await showAlert({
                                icon: '⚠️',
                                iconBg: '#FEF3C7',
                                title: '公告更新可能未生效',
                                message: `目前讀到的公告值：${res?.latestAnnouncement ?? '(查無資料)'}`,
                                buttonColor: '#D97706'
                            });
                        }
                    } catch (err) {
                        console.error('update announcement error:', err);
                        await showAlert({
                            icon: '❌',
                            title: '公告更新失敗',
                            message: err?.message || '請稍後再試',
                            buttonColor: '#DC2626'
                        });
                    } finally {
                        setIsSubmitting(false);
                    }
                }}
                className="self-end"
                disabled={isSubmitting}
            >
                {isSubmitting ? <span className="flex items-center gap-2"><Loader className="animate-spin" size={16} /> 發布中...</span> : '發布公告'}
            </Button>
            <NoticePopup />
        </div>
    );
};

const SettingsManager = () => {
    const { gasUrl, data } = useDing();
    const [urlInput, setUrlInput] = useState(gasUrl);

    useEffect(() => {
        setUrlInput(gasUrl);
    }, [gasUrl]);

    // Connection Check for UI warning
    const isDisconnected = !gasUrl;

    return (
        <div className="p-4 flex flex-col gap-6">
            {isDisconnected && (
                <div className="bg-red-50 border-2 border-red-200 p-6 rounded-2xl animate-pulse">
                    <div className="flex items-center gap-4 text-red-600 mb-2">
                        <span className="text-3xl">⚠️</span>
                        <h2 className="text-xl font-black">系統目前未連線</h2>
                    </div>
                    <p className="text-sm text-red-700 mb-4">
                        如果你重新部署過 GAS，Web App URL 可能改變，請更新下方網址。
                    </p>
                    <button
                        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                        className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-red-700 transition-colors"
                    >
                        前往連線設定
                    </button>
                </div>
            )}

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-800 mb-2">Google Apps Script 連線設定</h3>
                <div style={{ background: '#F0FDF4', border: '1px solid #22C55E', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔗</span>
                    <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 'bold' }}>系統連線設定</span>
                </div>
                <p className="text-sm text-blue-600 mb-4">
                    若重新部署 GAS 專案，請在此更新 Web App URL，確保前後端正確連線。
                </p>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-gray-500">Web App URL</label>
                    <div className="flex gap-2">
                        <input
                            className="ac-input font-mono text-xs flex-1"
                            value={urlInput}
                            readOnly
                            placeholder="請貼上 Google Apps Script Web App URL"
                        />
                        <Button
                            onClick={() => {}}
                            variant="primary"
                            className="text-xs py-1 px-4"
                            disabled
                        >
                            唯讀
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
                            <li>今日訂單: {data?.orders?.length || 0} 筆</li>
                            <li className="text-[10px] text-blue-500 mt-1 border-t pt-1">
                                偵測分頁: {data?.debugSheets?.join(', ') || '無資料'}
                            </li>
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
            try {
                json = JSON.parse(text);
            } catch {
                json = null;
            }

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
                {testing ? '檢測中...' : '診斷連線 (Debug)'}
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
                                    ⚠️ 回傳不是有效 JSON。<br />
                                    1. 確認部署權限為 "Anyone"<br />
                                    2. 前端 URL 使用 `/exec`（不是 `/dev` 或 `/edit`）<br />
                                    3. 重新部署 GAS 後再測一次
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

