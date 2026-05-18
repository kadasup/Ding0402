import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDing, MENU_CATEGORIES } from '../context/DingContext';
import { DialogBox, Button, ConfirmModal, usePopup, EmptyState } from '../components/Components';
import { Upload, Trash2, Edit, Plus, Users, DollarSign, FileText, ArrowLeft, Loader, Check, X, Settings, Star, Search, BookOpen, Heart, Clock, ChevronUp, Printer, Inbox, UtensilsCrossed, BarChart3, Building2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getLocalDateKey } from '../utils/date';
import leafIcon from '../assets/img/leaf.svg';
import bellsIcon from '../assets/img/bells.svg';

const _normalizeNote = (value) => String(value || '').trim();
const _getOrderFloor = (memberName) => {
    const matched = String(memberName || '').trim().match(/^(\d+)\s*樓/);
    return matched ? `${matched[1]}樓` : 'VIP';
};
const _getItemQty = (item) => {
    const rawQty = Number(item?.qty ?? item?.quantity ?? item?.count ?? 1);
    return Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
};
const _getOrderTotal = (order) => {
    const rawTotal = Number(order?.total);
    if (Number.isFinite(rawTotal) && rawTotal >= 0) return rawTotal;
    return (order?.items || []).reduce((sum, item) => {
        const price = Number(item?.price || 0);
        return sum + (Number.isFinite(price) ? price : 0);
    }, 0);
};
const _floorSortValue = (floorName) => {
    if (floorName === 'VIP') return Number.MAX_SAFE_INTEGER;
    const matched = String(floorName || '').match(/^(\d+)\s*樓/);
    return matched ? Number(matched[1]) : Number.MAX_SAFE_INTEGER - 1;
};
const _formatDateTime = (ts) => {
    if (!ts) return '-';
    const dateObj = new Date(ts);
    if (Number.isNaN(dateObj.getTime())) return '-';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${d} ${hh}:${mm}`;
};
const _parseTimestampSeed = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return NaN;
    const firstPart = raw.split('_')[0];
    const ts = Number(firstPart);
    return Number.isFinite(ts) && ts > 0 ? ts : NaN;
};
const _getRoundKeyFromOrder = (order) => {
    const menuId = String(order?.menuId || '').trim();
    if (menuId) return `menu:${menuId}`;
    const dateKey = order?.date ? getLocalDateKey(order.date) : 'unknown';
    return `legacy:${dateKey || 'unknown'}`;
};
const _escapeHtml = (raw = '') => String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const Admin = () => {
    const { user, data, actions, gasUrl, ui } = useDing(); 
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('menu'); // menu, library, members, stats, settings
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [isLibraryBootLoading, setIsLibraryBootLoading] = useState(false);
    const [isStatsLoading, setIsStatsLoading] = useState(false);
    const libraryPrefetchedRef = useRef(false);
    const libraryFetchInFlightRef = useRef(null);
    const currentRoundFocusKeyRef = useRef('');
    const isMenuHydrating = activeTab === 'menu'
        && !!ui?.pending
        && !data?.menu?.lastUpdated
        && (data?.menu?.items || []).length === 0;

    const fetchLibraryData = React.useCallback(() => {
        if (libraryFetchInFlightRef.current) return libraryFetchInFlightRef.current;
        const task = actions.fetchData(['library'], {
            silent: true,
            timeoutMs: 8000,
            retries: 0,
        }).finally(() => {
            libraryFetchInFlightRef.current = null;
        });
        libraryFetchInFlightRef.current = task;
        return task;
    }, [actions]);

    useEffect(() => {
        if (user?.role !== 'admin') {
            actions.loginAdmin();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.role]);

    const menuLibraryLength = (data?.menuLibrary || []).length;
    useEffect(() => {
        if (user?.role !== 'admin') return;
        if (libraryPrefetchedRef.current) return;
        libraryPrefetchedRef.current = true;
        if (menuLibraryLength > 0) return;
        void fetchLibraryData();
    }, [user?.role, menuLibraryLength, fetchLibraryData]);

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
        if (activeTab === 'stats') {
            setIsStatsLoading(true);
        }

        void (async () => {
            try {
                if (activeTab === 'library') {
                    await fetchLibraryData();
                } else {
                    await actions.fetchData(sections, {
                        silent: true,
                        timeoutMs: 8000,
                        retries: 0,
                    });
                }
            } finally {
                if (!cancelled && isFirstLibraryLoad) {
                    setIsLibraryBootLoading(false);
                }
                if (!cancelled && activeTab === 'stats') {
                    setIsStatsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, fetchLibraryData]);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };
        handleScroll();
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const focusTarget = new URLSearchParams(location.search).get('focus');
        if (focusTarget !== 'current-round') return;

        if (activeTab !== 'stats') {
            setActiveTab('stats');
            return;
        }

        const focusKey = `${location.pathname}${location.search}`;
        if (currentRoundFocusKeyRef.current === focusKey) return;
        currentRoundFocusKeyRef.current = focusKey;

        const timer = window.setTimeout(() => {
            const target = document.getElementById('admin-current-round');
            if (target && typeof target.scrollIntoView === 'function') {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 160);

        return () => window.clearTimeout(timer);
    }, [location.pathname, location.search, activeTab]);

    const shouldShowTopArrow = ['menu', 'library', 'members', 'stats'].includes(activeTab);


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
        <div className="admin-header">
            <div className="admin-header-brand">
                <div className="admin-header-leaf">
                    <img src={leafIcon} alt="leaf" />
                </div>
                <div className="admin-header-text">
                    <span className="eyebrow">DING BENTO · ADMIN</span>
                    <h1 className="admin-header-title">管理後台</h1>
                </div>
            </div>
            <Link to="/" className="admin-header-back">
                <Button variant="secondary" className="px-5 py-2.5">
                    <ArrowLeft size={18} /> 返回前台
                </Button>
            </Link>
        </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar Nav */}
                <div className="md:col-span-1 flex flex-col gap-3">
                    {[
                        { id: 'menu', icon: FileText, label: '今日菜單' },
                        { id: 'library', icon: BookOpen, label: '菜單庫' },
                        { id: 'members', icon: Users, label: '成員管理' },
                        { id: 'stats', icon: DollarSign, label: '統計資料' },
                        { id: 'settings', icon: Settings, label: '系統設定' },
                    ].map((tab, idx) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            onMouseEnter={() => {
                                if (tab.id !== 'library') return;
                                if ((data?.menuLibrary || []).length > 0) return;
                                void fetchLibraryData();
                            }}
                            className="admin-tab animate-pop"
                            data-active={activeTab === tab.id ? 'true' : 'false'}
                            style={{ animationDelay: `${idx * 0.05}s` }}
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
                                    ? <>
                                        <span>今日菜單</span>
                                        <span style={{
                                            marginLeft: '8px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '2px 10px',
                                            borderRadius: '999px',
                                            background: '#FEF3C7',
                                            color: '#B45309',
                                            border: '1px solid #FCD34D',
                                            fontWeight: 900,
                                            letterSpacing: '0.04em',
                                            boxShadow: '0 1px 0 rgba(180,83,9,0.2)',
                                        }}>已上架</span>
                                    </>
                                    : '今日菜單（未發布）')
                                : activeTab === 'library'
                                    ? '菜單庫'
                                    : activeTab === 'members'
                                        ? '成員管理'
                                        : activeTab === 'stats'
                                            ? '統計資料'
                                        : activeTab === 'settings'
                                            ? '系統設定'
                                                : '今日菜單'
                        }
                        className="min-h-[400px]"
                    >
                        <div>
                            <div style={{ display: activeTab === 'menu' ? 'block' : 'none' }}>
                                {isMenuHydrating ? <AdminMenuSkeleton /> : <MenuManager data={data} actions={actions} />}
                            </div>
                            {activeTab === 'library' && <div key="library" className="animate-pop"><MenuLibraryManager data={data} actions={actions} setActiveTab={setActiveTab} uploadImageToCloud={uploadImageToCloud} isInitialLoading={isLibraryBootLoading} /></div>}
                            {activeTab === 'members' && <div key="members" className="animate-pop"><MemberManager data={data} actions={actions} /></div>}
                            {activeTab === 'stats' && <div key="stats" className="animate-pop"><StatsManager data={data} isLoading={isStatsLoading} /></div>}
                            {activeTab === 'settings' && <div key="settings" className="animate-pop"><SettingsManager /></div>}
                        </div>
                    </DialogBox>
                </div>
            </div>

            {showScrollTop && shouldShowTopArrow && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="fixed ac-scroll-top hover:scale-110 active:scale-95 transition-all animate-pop z-[99999]"
                    style={{
                        position: 'fixed',
                        right: '20px',
                        left: 'auto',
                        margin: 0,
                        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))'
                    }}
                    title="回到頂部"
                    aria-label="回到頂部"
                >
                    <ChevronUp size={24} color="white" strokeWidth={3} />
                </button>
            )}
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
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null); // null | 'publish' | 'closeOrder'
    const [storeInfo, setStoreInfo] = useState({ name: '', address: '', phone: '' });
    const [menuRemark, setMenuRemark] = useState(data.menu.remark || '');
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [actionLoadingText, setActionLoadingText] = useState('處理中，請稍候...');
    const [historyPage, setHistoryPage] = useState(1);
    const HISTORY_PAGE_SIZE = 12;

    const { showAlert, showConfirm, PopupRenderer } = usePopup();
    const lastSyncRef = React.useRef(data.menu.lastUpdated);
    const historyFetchedOnceRef = React.useRef(false);
    const isHistoryLoadingRef = React.useRef(false);

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

    const fetchHistoryInBackground = React.useCallback(async () => {
        if (isHistoryLoadingRef.current) return;
        isHistoryLoadingRef.current = true;
        setIsHistoryLoading(true);
        try {
            await actions.fetchData(['history'], {
                silent: true,
                timeoutMs: 8000,
                retries: 0,
            });
        } finally {
            isHistoryLoadingRef.current = false;
            setIsHistoryLoading(false);
        }
    }, [actions]);

    useEffect(() => {
        if (historyFetchedOnceRef.current) return;
        historyFetchedOnceRef.current = true;
        void fetchHistoryInBackground();
    }, [fetchHistoryInBackground]);

    const menuHistoryLength = (data.menuHistory || []).length;
    useEffect(() => {
        if (!showHistory) return;
        if (menuHistoryLength > 0) return;
        void fetchHistoryInBackground();
    }, [showHistory, menuHistoryLength, fetchHistoryInBackground]);



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
        const clearTodayMenuDraft = () => {
            const emptyItems = [];
            const emptyImage = '';
            const emptyStore = { name: '', address: '', phone: '' };
            const emptyRemark = '';
            setDraftItems(emptyItems);
            setMenuImage(emptyImage);
            setStoreInfo(emptyStore);
            setMenuRemark(emptyRemark);
            return { emptyItems, emptyImage, emptyStore, emptyRemark };
        };
        try {
        if (!status) {
            // Unpublish flow
            const today = new Date();
            const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
            const name = storeInfo.name ? storeInfo.name : '未命名店家';
            const autoSaveName = `${dateStr} 下架存檔 - ${name}`;
            actions.addMenuHistory(autoSaveName, draftItems, menuImage, storeInfo, menuRemark);

            const { emptyItems, emptyImage, emptyStore, emptyRemark } = clearTodayMenuDraft();
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
        const clearTodayMenuDraft = () => {
            const emptyItems = [];
            const emptyImage = '';
            const emptyStore = { name: '', address: '', phone: '' };
            const emptyRemark = '';
            setDraftItems(emptyItems);
            setMenuImage(emptyImage);
            setStoreInfo(emptyStore);
            setMenuRemark(emptyRemark);
            return { emptyItems, emptyImage, emptyStore, emptyRemark };
        };
        try {
        // Auto-save specific for Closing
        const today = new Date();
        const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
        const name = storeInfo.name ? storeInfo.name : '未命名店家';
        const autoSaveName = `${dateStr} 結單存檔 - ${name}`;
        actions.addMenuHistory(autoSaveName, draftItems, menuImage, storeInfo, menuRemark);

        // Unpost
        const { emptyItems, emptyImage, emptyStore, emptyRemark } = clearTodayMenuDraft();
        setIsPosted(false);
        await actions.updateMenu(emptyItems, false, closingTime, emptyImage, emptyStore, emptyRemark, true, true);

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

    const isClosingTimeLocked = isPosted || isActionLoading;
    const availableHours = getWholeHours(datePart);
    const dateOptions = React.useMemo(() => {
        const base = getNext3Days();
        if (!datePart) return base;
        if (base.some((d) => d.value === datePart)) return base;
        return [{ value: datePart, label: datePart }, ...base];
    }, [datePart]);
    const displayHours = isClosingTimeLocked
        ? (timePart ? [timePart] : [])
        : availableHours;

    useEffect(() => {
        if (isClosingTimeLocked) return;
        if (availableHours.length === 0) {
            if (timePart) {
                setClosingTime(`${datePart} `);
            }
            return;
        }

        if (!availableHours.includes(timePart)) {
            updateDateTime(datePart, availableHours[0]);
        }
    }, [availableHours, datePart, timePart, isClosingTimeLocked]);

    const { sortedHistory, totalHistoryPages, safeHistoryPage, pagedHistory } = useMemo(() => {
        const sorted = [...(data.menuHistory || [])].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        const totalPages = Math.max(1, Math.ceil(sorted.length / HISTORY_PAGE_SIZE));
        const safePage = Math.min(historyPage, totalPages);
        return {
            sortedHistory: sorted,
            totalHistoryPages: totalPages,
            safeHistoryPage: safePage,
            pagedHistory: sorted.slice((safePage - 1) * HISTORY_PAGE_SIZE, safePage * HISTORY_PAGE_SIZE),
        };
    }, [data.menuHistory, historyPage]);
    const hasMenuDraft = draftItems.length > 0 || !!menuImage || !!storeInfo.name;
    const canCloseOrder = isPosted && !isActionLoading;
    const canPublishMenu = !isPosted && hasMenuDraft && !isActionLoading;

    return (
        <div className="flex flex-col gap-6 p-4">
            {/* Store Information Config (Read-only) */}
            <div className="ac-block ac-block--green">
                <div className="ac-block-head">
                    <span>店家資訊</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                        <span className="text-xs font-black mb-2 ml-1 tracking-wide uppercase" style={{ color: 'var(--ac-green)' }}>店名</span>
                        <div className="bg-gray-50 p-3 rounded-xl border text-base font-bold text-gray-700">{storeInfo.name || '(未填寫)'}</div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-black mb-2 ml-1 tracking-wide uppercase" style={{ color: 'var(--ac-blue-deep)' }}>電話</span>
                        <div className="bg-gray-50 p-3 rounded-xl border text-base font-bold text-gray-700">{storeInfo.phone || '(未填寫)'}</div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-black mb-2 ml-1 tracking-wide uppercase" style={{ color: 'var(--ac-brown)' }}>地址</span>
                        <div className="bg-gray-50 p-3 rounded-xl border text-base font-bold text-gray-700">{storeInfo.address || '(未填寫)'}</div>
                    </div>
                </div>
            </div>

            {/* Original Menu Image for Verification */}
            {menuImage && (
                <div className="ac-block" style={{ borderLeftColor: '#B0BEC5' }}>
                    <div className="ac-block-head">
                        <span>原始菜單圖片（核對用）</span>
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
            <div className="ac-block ac-block--orange">
                <div className="ac-block-head">
                    <span>當前品項清單 ({draftItems.length})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {draftItems.map((item, i) => (
                        <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border">
                            <span className="font-bold text-gray-700">{item.name}</span>
                            <span className="font-black text-ac-green text-lg">${item.price}</span>
                        </div>
                    ))}
                    {draftItems.length === 0 && (
                        <div className="md:col-span-2 bg-white/50 rounded-xl border-2 border-dashed">
                            <EmptyState
                                icon={UtensilsCrossed}
                                title="目前沒有品項"
                                hint="請先透過掃描或手動新增。"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Closing Time Setting */}
            <div className="ac-block ac-block--blue">
                <div className="ac-block-head">
                    <span className="flex items-center gap-2">
                        <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg inline-flex">
                            <Clock size={16} />
                        </span>
                        結單時間設定
                    </span>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 w-full">
                    <div className="flex flex-col gap-1 w-full sm:w-[160px]">
                        <span className="text-xs font-black text-blue-500 ml-1 uppercase tracking-widest">日期</span>
                        <select
                            className={`ac-input py-2.5 px-4 text-base border shadow-sm rounded-xl ${
                                isClosingTimeLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                            }`}
                            style={{ background: '#fff', width: '100%' }}
                            value={datePart}
                            disabled={isClosingTimeLocked}
                            onChange={(e) => {
                                const nextDate = e.target.value;
                                const nextHours = getWholeHours(nextDate);
                                const nextTime = nextHours.includes(timePart) ? timePart : (nextHours[0] || '');
                                updateDateTime(nextDate, nextTime);
                            }}
                        >
                            {dateOptions.map(d => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex flex-col gap-1 w-full sm:w-[130px]">
                        <span className="text-xs font-black text-blue-500 ml-1 uppercase tracking-widest">時間</span>
                        <select
                            className={`ac-input py-2.5 px-4 text-base border shadow-sm rounded-xl ${
                                (isClosingTimeLocked || availableHours.length === 0) ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                            }`}
                            style={{ background: '#fff', width: '100%' }}
                            value={timePart}
                            disabled={isClosingTimeLocked || availableHours.length === 0}
                            onChange={(e) => updateDateTime(datePart, e.target.value)}
                        >
                            {isClosingTimeLocked && !timePart && (
                                <option value="">未設定</option>
                            )}
                            {!isClosingTimeLocked && availableHours.length === 0 && (
                                <option value="">今日已無可選時段</option>
                            )}
                            {displayHours.map(h => (
                                <option key={h} value={h}>{h}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Today's Remark Setting */}
            <div className="ac-block ac-block--amber">
                <div className="ac-block-head">
                    <span>📢 今日備註 / 公告</span>
                </div>
                <textarea
                    className="ac-textarea text-sm"
                    placeholder="請輸入今天的補充資訊（例如：最晚 11:30 前下單）"
                    value={menuRemark}
                    onChange={e => setMenuRemark(e.target.value)}
                />
            </div>

            {/* Publish Action Section */}
            <div className="ac-action-grid">
                <button
                    type="button"
                    onClick={() => canCloseOrder && setConfirmAction('closeOrder')}
                    disabled={!canCloseOrder}
                    className={`ac-action-card ac-action-card--danger mobile-action-card-primary ${canCloseOrder ? 'action-card-breathe' : ''}`}
                >
                    <div className="ac-action-icon">⏰</div>
                    <div className={`ac-action-title ${canCloseOrder ? 'action-card-breathe-text' : ''}`}>
                        下架 / 結單
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => canPublishMenu && setConfirmAction('publish')}
                    disabled={!canPublishMenu}
                    className={`ac-action-card ac-action-card--ok mobile-publish-priority ${canPublishMenu ? 'publish-cta-breathe' : ''}`}
                    data-hot={canPublishMenu ? 'true' : 'false'}
                >
                    {canPublishMenu && <div className="ac-action-hot">推薦下一步</div>}
                    <div className="ac-action-icon">🍱</div>
                    <div className={`ac-action-title ${canPublishMenu ? 'publish-cta-breathe-text' : ''}`}>
                        上架
                    </div>
                </button>
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
                            {isHistoryLoading && sortedHistory.length === 0 ? (
                                <div className="text-center text-gray-500 text-sm py-8 flex items-center justify-center gap-2">
                                    <Loader size={14} className="animate-spin" />
                                    菜單歷史讀取中...
                                </div>
                            ) : sortedHistory.length === 0 ? (
                                <EmptyState icon={Clock} title="目前沒有歷史菜單" hint="發佈過的菜單會自動歸檔到這裡。" />
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
    const editFormRef = useRef(null);
    const editHighlightTimerRef = useRef(null);
    const [highlightEditForm, setHighlightEditForm] = useState(false);
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

    const LIBRARY_PAGE_SIZE = 12;

    const { filteredLibrary, totalLibraryPages, safeLibraryPage, pagedLibrary } = useMemo(() => {
        const library = [...(data.menuLibrary || [])].reverse();
        const filtered = library.filter(m => {
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
        const totalPages = Math.max(1, Math.ceil(filtered.length / LIBRARY_PAGE_SIZE));
        const safePage = Math.min(libraryPage, totalPages);
        return {
            filteredLibrary: filtered,
            totalLibraryPages: totalPages,
            safeLibraryPage: safePage,
            pagedLibrary: filtered.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE),
        };
    }, [data.menuLibrary, showFavOnly, filterCategory, searchTerm, libraryPage]);

    useEffect(() => {
        setLibraryPage(1);
    }, [searchTerm, filterCategory, showFavOnly, data.menuLibrary?.length]);

    useEffect(() => {
        return () => {
            if (editHighlightTimerRef.current) {
                clearTimeout(editHighlightTimerRef.current);
            }
        };
    }, []);

    const resetForm = () => {
        setFormName(''); setFormCategory('chinese');
        setFormStoreInfo({ name: '', address: '', phone: '' });
        setFormItems([]); setFormImage(''); setFormRemark('');
        setEditingId(null); setShowAddForm(false); setHighlightEditForm(false);
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
        const safeStoreInfo = (menu && menu.storeInfo && typeof menu.storeInfo === 'object')
            ? menu.storeInfo
            : { name: '', address: '', phone: '' };
        const safeItems = Array.isArray(menu && menu.items) ? menu.items : [];

        setEditingId(menu && menu.id ? menu.id : null);
        setFormName((menu && menu.name) || '');
        setFormCategory((menu && menu.category) || 'other');
        setFormStoreInfo({
            name: safeStoreInfo.name || '',
            address: safeStoreInfo.address || '',
            phone: safeStoreInfo.phone || ''
        });
        setFormItems(safeItems);
        setFormImage((menu && menu.image) || '');
        setFormRemark((menu && menu.remark) || '');
        setShowAddForm(true);
        setHighlightEditForm(true);
        if (editHighlightTimerRef.current) clearTimeout(editHighlightTimerRef.current);
        editHighlightTimerRef.current = setTimeout(() => {
            setHighlightEditForm(false);
        }, 1100);

        // Ensure the edit form is visible after clicking "編輯" in long lists.
        setTimeout(() => {
            if (editFormRef.current && typeof editFormRef.current.scrollIntoView === 'function') {
                editFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 0);
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
                await actions.updateMenu(menu.items, false, '', menu.image || '', menu.storeInfo || {}, menu.remark || '', false, true, true);
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
                <div className="ac-lib-filter-bar">
                    <button
                        type="button"
                        onClick={() => setShowFavOnly(!showFavOnly)}
                        className="ac-fav-btn"
                        data-active={showFavOnly ? 'true' : 'false'}
                    >
                        <Heart
                            size={16}
                            className={showFavOnly ? 'animate-pulse' : ''}
                            style={{ fill: showFavOnly ? '#ef4444' : 'none' }}
                        />
                        <span>{showFavOnly ? '顯示全部' : '只看收藏'}</span>
                    </button>
                    <select
                        className="ac-cat-select"
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                    >
                        <option value="all">全部分類</option>
                        {MENU_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <span className="ac-count-pill">共 {filteredLibrary.length} 筆</span>
                </div>
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
                <div
                    ref={editFormRef}
                    className="ac-panel border-2 border-ac-green shadow-lg animate-slide-up bg-white mb-6 p-6"
                    style={{
                        transition: 'box-shadow 0.25s ease, transform 0.25s ease',
                        boxShadow: highlightEditForm
                            ? '0 0 0 4px rgba(95,205,228,0.45), 0 12px 28px rgba(95,205,228,0.28)'
                            : undefined
                    }}
                >
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
                                <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-100">
                                    <EmptyState
                                        icon={UtensilsCrossed}
                                        title="尚未新增品項"
                                        hint="請使用上方按鈕新增或上傳圖片辨識。"
                                        compact
                                    />
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
                    <EmptyState
                        icon={BookOpen}
                        title={(data?.menuLibrary || []).length === 0 ? '目前沒有菜單庫' : '沒有符合條件的菜單'}
                        hint={(data?.menuLibrary || []).length === 0 ? '先新增第一筆，之後可以快速套用到當日菜單。' : '試試清空搜尋條件或改用其他關鍵字。'}
                    />
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
        <div className="p-1 flex flex-col gap-4">
            <div className="ac-section-header">
                <span className="ac-section-header-title">成員管理</span>
                <span className="ac-section-header-sub">共 {(data.members || []).length} 位成員</span>
            </div>
            <div className="flex gap-2">
                <input
                    className="ac-input flex-grow"
                    placeholder="輸入新成員名稱…（例：14樓 阿德）"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.members.map(m => (
                    <div key={m} className="ac-member-cell">
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
                                <button onClick={() => saveEdit(m)} className="ac-icon-btn ac-icon-btn--ok" title="儲存"><Check size={18} /></button>
                                <button onClick={cancelEdit} className="ac-icon-btn ac-icon-btn--neutral" title="取消"><X size={18} /></button>
                            </div>
                        ) : (
                            <>
                                <span className="ac-member-name">{m}</span>
                                <div className="flex gap-2 flex-shrink-0">
                                    <button onClick={() => startEdit(m)} className="ac-icon-btn ac-icon-btn--edit" title="編輯成員"><Edit size={16} /></button>
                                    <button
                                        onClick={() => void handleRemoveMember(m)}
                                        disabled={removingName === m}
                                        className="ac-icon-btn ac-icon-btn--danger"
                                        title={removingName === m ? '刪除中...' : '刪除成員'}
                                    >
                                        <Trash2 size={16} />
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








const StatsManager = ({ data, isLoading = false }) => {
    // Round Filter State (menuId-first; fallback to legacy date bucket)
    const [selectedRoundKey, setSelectedRoundKey] = useState('');
    const [statsTab, setStatsTab] = useState('item');
    const statsPrintRef = useRef(null);
    const roundOptions = useMemo(() => Object.values(
        (data.orders || []).reduce((acc, order) => {
            if (!order) return acc;
            const key = _getRoundKeyFromOrder(order);
            const menuId = String(order?.menuId || '').trim();
            const dateKey = order?.date ? getLocalDateKey(order.date) : 'unknown';
            const tsRaw = new Date(order?.date || '').getTime();
            const ts = Number.isFinite(tsRaw) ? tsRaw : 0;
            if (!acc[key]) {
                acc[key] = { key, menuId: menuId || '', legacyDateKey: menuId ? '' : dateKey, startTs: ts, endTs: ts, count: 0, orders: [] };
            }
            acc[key].count += 1;
            acc[key].orders.push(order);
            acc[key].startTs = Math.min(acc[key].startTs, ts);
            acc[key].endTs = Math.max(acc[key].endTs, ts);
            return acc;
        }, {})
    ).sort((a, b) => b.endTs - a.endTs), [data.orders]);

    const historyStoreCandidates = useMemo(() =>
        (data?.menuHistory || [])
            .map((hist) => ({
                ts: _parseTimestampSeed(hist?.id),
                storeName: String(hist?.storeInfo?.name || hist?.name || '').trim(),
            }))
            .filter((candidate) => candidate.storeName),
    [data.menuHistory]);

    const resolveRoundStoreName = (round) => {
        const currentMenuId = String(data?.menu?.lastUpdated || '').trim();
        const currentStoreName = String(data?.menu?.storeInfo?.name || '').trim();
        if (round?.menuId && round.menuId === currentMenuId && currentStoreName) return currentStoreName;
        if (!round?.menuId) return '-';
        const roundTs = _parseTimestampSeed(round.menuId);
        if (!Number.isFinite(roundTs) || historyStoreCandidates.length === 0) return '-';
        let forwardBest = null;
        let anyBest = null;
        for (const candidate of historyStoreCandidates) {
            if (!Number.isFinite(candidate.ts)) continue;
            const forwardDelta = candidate.ts - roundTs;
            const absDelta = Math.abs(forwardDelta);
            if (forwardDelta >= 0 && (!forwardBest || forwardDelta < forwardBest.delta)) forwardBest = { name: candidate.storeName, delta: forwardDelta };
            if (!anyBest || absDelta < anyBest.delta) anyBest = { name: candidate.storeName, delta: absDelta };
        }
        return forwardBest?.name || anyBest?.name || '-';
    };

    const getRoundLabel = (round) => {
        const startStr = _formatDateTime(round.startTs);
        const storeName = resolveRoundStoreName(round);
        return `上架：${startStr}｜店名：${storeName}｜${round.count}筆`;
    };

    const effectiveRoundKey = useMemo(() => {
        if (!roundOptions.length) return '';
        const keyExists = roundOptions.some((r) => r.key === selectedRoundKey);
        if (selectedRoundKey && keyExists) return selectedRoundKey;
        const currentMenuId = String(data?.menu?.lastUpdated || '').trim();
        const preferredKey = currentMenuId ? `menu:${currentMenuId}` : roundOptions[0].key;
        const preferredExists = roundOptions.some((r) => r.key === preferredKey);
        return preferredExists ? preferredKey : roundOptions[0].key;
    }, [roundOptions, selectedRoundKey, data.menu?.lastUpdated]);

    const { selectedRound, orders, total, itemStats, itemTotalQty, floorStats } = useMemo(() => {
        const round = roundOptions.find((r) => r.key === effectiveRoundKey) || null;
        const ords = round ? round.orders : [];
        const tot = ords.reduce((sum, o) => sum + _getOrderTotal(o), 0);

        const stats = Object.values(
            ords.reduce((acc, order) => {
                (order.items || []).forEach((item) => {
                    const name = String(item?.name || '').trim() || '未命名品項';
                    const note = _normalizeNote(item?.note ?? item?.remark ?? item?.memo);
                    const qty = _getItemQty(item);
                    if (!acc[name]) acc[name] = { name, totalQty: 0, noteMap: {} };
                    acc[name].totalQty += qty;
                    if (note) {
                        acc[name].noteMap[note] = (acc[name].noteMap[note] || 0) + qty;
                    }
                });
                return acc;
            }, {})
        )
            .map((s) => ({
                name: s.name,
                totalQty: s.totalQty,
                notes: Object.entries(s.noteMap)
                    .map(([note, qty]) => ({ note, qty }))
                    .sort((a, b) => b.qty - a.qty || a.note.localeCompare(b.note, 'zh-Hant')),
            }))
            .sort((a, b) => b.totalQty - a.totalQty || a.name.localeCompare(b.name, 'zh-Hant'));

        const floors = Object.entries(
            ords.reduce((acc, order) => {
                const floor = _getOrderFloor(order.member);
                const memberName = String(order?.member || '').trim() || '未命名成員';
                if (!acc[floor]) acc[floor] = { totalQty: 0, totalAmount: 0, orderCount: 0, memberDetails: {} };
                acc[floor].orderCount += 1;
                const orderTotal = _getOrderTotal(order);
                acc[floor].totalAmount += orderTotal;
                const memberKey = memberName.toLowerCase();
                if (!acc[floor].memberDetails[memberKey]) acc[floor].memberDetails[memberKey] = { displayName: memberName, items: [], total: 0 };
                const md = acc[floor].memberDetails[memberKey];
                md.total += orderTotal;
                (order.items || []).forEach((item) => {
                    const name = String(item?.name || '').trim() || '未命名品項';
                    const qty = _getItemQty(item);
                    const price = Number(item?.price || 0);
                    const note = _normalizeNote(item?.note ?? item?.remark ?? item?.memo);
                    md.items.push({ name, note, qty, price: Number.isFinite(price) ? price : 0 });
                    acc[floor].totalQty += qty;
                });
                return acc;
            }, {})
        )
            .map(([floor, stat]) => {
                const memberList = Object.values(stat.memberDetails)
                    .map((md) => {
                        const merged = {};
                        md.items.forEach((it) => {
                            const mergeKey = `${it.name}__${_normalizeNote(it.note)}`;
                            if (!merged[mergeKey]) merged[mergeKey] = { name: it.name, note: _normalizeNote(it.note), qty: 0, price: it.price };
                            merged[mergeKey].qty += it.qty;
                        });
                        return {
                            name: md.displayName,
                            items: Object.values(merged).map((v) => ({ name: v.name, note: v.note, qty: v.qty, price: v.price })),
                            total: md.total,
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
                return { floor, orderCount: stat.orderCount, totalQty: stat.totalQty, totalAmount: stat.totalAmount, memberList };
            })
            .sort((a, b) => _floorSortValue(a.floor) - _floorSortValue(b.floor));

        return {
            selectedRound: round,
            orders: ords,
            total: tot,
            itemStats: stats,
            itemTotalQty: stats.reduce((sum, s) => sum + s.totalQty, 0),
            floorStats: floors,
        };
    }, [roundOptions, effectiveRoundKey]);
    const handlePrintStats = () => {
        const printableNode = statsPrintRef.current;
        if (!printableNode) return;

        const printWindow = window.open('', '_blank', 'width=1200,height=900');
        if (!printWindow) {
            window.alert('無法開啟列印視窗，請允許彈出視窗後再試一次。');
            return;
        }

        const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map((node) => node.outerHTML)
            .join('\n');
        const tabLabel = statsTab === 'item'
            ? '品項統計'
            : '樓層統計（成員 / 品項 / 金額）';
        const selectedRoundLabel = selectedRound ? getRoundLabel(selectedRound) : '未選擇輪次';
        const printedAt = _formatDateTime(Date.now());

        printWindow.document.open();
        printWindow.document.write(`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>統計資料列印</title>
  ${styleNodes}
  <style>
    body { background: #fff; }
    .stats-print-root { max-width: 980px; margin: 0 auto; padding: 24px; }
  </style>
</head>
<body>
  <div class="stats-print-root">
    <h1 class="text-2xl font-black text-ac-brown mb-2">統計資料</h1>
    <div class="text-sm text-gray-600 mb-4">
      <div>輪次：${_escapeHtml(selectedRoundLabel)}</div>
      <div>頁籤：${_escapeHtml(tabLabel)}</div>
      <div>列印時間：${_escapeHtml(printedAt)}</div>
    </div>
    ${printableNode.innerHTML}
  </div>
</body>
</html>`);
        printWindow.document.close();

        // Close only after print dialog is completed/cancelled.
        printWindow.onafterprint = () => {
            try {
                if (!printWindow.closed) {
                    printWindow.close();
                }
            } catch {
                // Ignore close errors.
            }
        };

        try {
            // Invoke print directly in click flow to avoid popup blockers
            // that may reject delayed/asynchronous print triggers.
            printWindow.focus();
            printWindow.print();
        } catch {
            window.alert('列印功能被瀏覽器阻擋，請在新視窗按 Ctrl+P（或 Cmd+P）列印。');
        }
    };

    return (
        <div id="admin-current-round" className="p-1 flex flex-col gap-4">
            {/* Round filter */}
            <div className="ac-stats-filter">
                <span className="ac-stats-filter-label">選擇統計</span>
                <select
                    className="ac-stats-filter-select"
                    value={effectiveRoundKey}
                    onChange={(e) => setSelectedRoundKey(e.target.value)}
                >
                    {roundOptions.map((round) => (
                        <option key={round.key} value={round.key}>
                            {getRoundLabel(round)}
                        </option>
                    ))}
                </select>
                <Button
                    onClick={handlePrintStats}
                    variant="secondary"
                    className="ac-btn sm whitespace-nowrap"
                    disabled={roundOptions.length === 0}
                >
                    <Printer size={14} /> 列印
                </Button>
            </div>

            <div ref={statsPrintRef} className="flex flex-col gap-4">
                {roundOptions.length === 0 && (
                    <EmptyState
                        icon={BarChart3}
                        title="目前沒有可統計的訂單輪次"
                        hint="發佈菜單並有人下單後，統計資料會顯示在這裡。"
                    />
                )}

                {/* 2-KPI row */}
                <div className="ac-kpi-row">
                    <div className="ac-kpi ac-kpi--green">
                        <div className="ac-kpi-value">{orders.length}</div>
                        <div className="ac-kpi-label">訂單數</div>
                    </div>
                    <div className="ac-kpi ac-kpi--orange">
                        <img src={bellsIcon} className="ac-kpi-charm" loading="lazy" decoding="async" alt="" />
                        <div className="ac-kpi-value">${total}</div>
                        <div className="ac-kpi-label">總金額</div>
                    </div>
                </div>

                {/* Sub-tabs */}
                <div className="ac-subtab-bar">
                    <button
                        type="button"
                        onClick={() => setStatsTab('item')}
                        className="ac-subtab"
                        data-active={statsTab === 'item' ? 'true' : 'false'}
                    >
                        品項統計
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatsTab('floor')}
                        className="ac-subtab"
                        data-active={statsTab === 'floor' ? 'true' : 'false'}
                    >
                        樓層統計
                    </button>
                </div>

                {statsTab === 'item' && (
                    <div className="flex flex-col gap-2">
                        {isLoading && (
                            <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-2 text-sm font-bold flex items-center gap-2">
                                <Loader size={16} className="animate-spin" />
                                載入中...
                            </div>
                        )}
                        {itemStats.map((stat) => (
                            <div key={stat.name} className="ac-stat-item">
                                <div className="ac-stat-item-head">
                                    <span className="ac-stat-item-name">{stat.name}</span>
                                    <span className="ac-stat-item-qty">x {stat.totalQty}</span>
                                </div>
                                {stat.notes.length > 0 && (
                                    <div className="ac-stat-notes">
                                        {stat.notes.map((n) => (
                                            <div key={n.note} className="flex justify-between items-center gap-2 text-xs">
                                                <span className="ac-note-tag">{n.note}</span>
                                                <span className="font-black text-ac-orange whitespace-nowrap">x {n.qty}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {itemStats.length > 0 && (
                            <div className="ac-stat-total">
                                <span>總計</span>
                                <span>x {itemTotalQty}</span>
                            </div>
                        )}
                        {itemStats.length === 0 && (
                            <EmptyState icon={Inbox} title="此輪次沒有品項統計" hint="這個輪次還沒有人下單。" compact />
                        )}
                    </div>
                )}

                {statsTab === 'floor' && (
                    <div className="flex flex-col gap-3">
                        {floorStats.map((floorStat) => (
                            <div key={floorStat.floor} className="ac-floor-card">
                                <div className="ac-floor-head">
                                    <span className="ac-floor-label">{floorStat.floor}</span>
                                    <div className="ac-floor-meta">
                                        <span>訂單 {floorStat.orderCount} 筆 · 數量 x{floorStat.totalQty}</span>
                                        <span className="ac-floor-meta-amount">${floorStat.totalAmount}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    {floorStat.memberList.map((member) => (
                                        <div key={`${floorStat.floor}-${member.name}`} className="ac-floor-member-row">
                                            <span className="ac-floor-member-name">{member.name}</span>
                                            <div className="ac-floor-member-items">
                                                {member.items.map((item, idx) => {
                                                    const note = _normalizeNote(item.note ?? item.remark ?? item.memo);
                                                    return (
                                                        <span
                                                            key={`${member.name}-${item.name}-${idx}`}
                                                            className="ac-floor-member-item"
                                                        >
                                                            <span>
                                                                {item.name}
                                                                {note && <span className="ac-note-tag" style={{ marginLeft: 6 }}>{note}</span>}
                                                            </span>
                                                            {item.qty > 1 && <span className="font-bold text-ac-green-deep">x{item.qty}</span>}
                                                        </span>
                                                    );
                                                })}
                                                {member.items.length === 0 && (
                                                    <span className="text-xs italic text-gray-400">無品項</span>
                                                )}
                                            </div>
                                            <span className="ac-floor-member-total">${member.total}</span>
                                        </div>
                                    ))}
                                    {floorStat.memberList.length === 0 && (
                                        <EmptyState icon={Building2} title="此樓層當日無訂單" compact />
                                    )}
                                </div>
                            </div>
                        ))}
                        {floorStats.length === 0 && (
                            <EmptyState icon={Building2} title="此輪次沒有樓層統計" hint="這個輪次還沒有人下單。" compact />
                        )}
                    </div>
                )}
            </div>
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
        <div className="p-1 flex flex-col gap-3">
            <div className="ac-section-header">
                <span className="ac-section-header-title">系統設定</span>
            </div>

            {isDisconnected && (
                <div className="ac-setting-card" style={{ borderLeftColor: 'var(--ac-red)', background: '#FEF2F2' }}>
                    <div className="ac-setting-card-head" style={{ color: '#991B1B' }}>
                        <span className="text-xl">⚠️</span> 系統目前未連線
                    </div>
                    <p className="ac-setting-card-hint" style={{ color: '#7F1D1D' }}>
                        如果你重新部署過 GAS，Web App URL 可能改變，請更新下方網址。
                    </p>
                </div>
            )}

            <div className="ac-setting-card ac-setting-card--blue">
                <div className="ac-setting-card-head">🔗 Google Apps Script 連線設定</div>
                <p className="ac-setting-card-hint">
                    若重新部署 GAS 專案，請在此更新 Web App URL，確保前後端正確連線。
                </p>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-black tracking-wide" style={{ color: 'var(--ac-blue-deep)' }}>Web App URL</label>
                    <div className="flex gap-2">
                        <input
                            className="ac-mono-input"
                            value={urlInput}
                            readOnly
                            placeholder="請貼上 Google Apps Script Web App URL"
                        />
                        <Button variant="secondary" className="ac-btn sm" disabled>
                            唯讀
                        </Button>
                    </div>
                </div>
            </div>

            <div className="ac-setting-card ac-setting-card--green">
                <div className="ac-setting-card-head">📊 現有資料狀態</div>
                <ul className="text-sm" style={{ background: 'var(--gray-50)', borderRadius: 10, border: '1px solid var(--gray-200)', padding: 12, listStyle: 'none', margin: 0, lineHeight: 1.7 }}>
                    <li className="flex justify-between" style={{ borderBottom: '1px dashed var(--gray-200)', padding: '4px 0' }}><span>成員</span><span className="font-bold">{data?.members?.length || 0} 位</span></li>
                    <li className="flex justify-between" style={{ borderBottom: '1px dashed var(--gray-200)', padding: '4px 0' }}><span>菜單庫</span><span className="font-bold">{data?.menuLibrary?.length || 0} 筆</span></li>
                    <li className="flex justify-between" style={{ borderBottom: '1px dashed var(--gray-200)', padding: '4px 0' }}><span>歷史紀錄</span><span className="font-bold">{data?.menuHistory?.length || 0} 筆</span></li>
                    <li className="flex justify-between" style={{ borderBottom: '1px dashed var(--gray-200)', padding: '4px 0' }}><span>今日訂單</span><span className="font-bold">{data?.orders?.length || 0} 筆</span></li>
                    <li className="flex justify-between text-xs" style={{ paddingTop: 6, color: 'var(--ac-blue-deep)' }}>
                        <span>偵測分頁</span><span className="truncate ml-2">{data?.debugSheets?.join(', ') || '無資料'}</span>
                    </li>
                </ul>
            </div>

            <div className="ac-setting-card ac-setting-card--brown">
                <div className="ac-setting-card-head">🔧 連線診斷</div>
                <DebugConnection url={urlInput} />
            </div>

            <div className="text-center text-xs text-gray-400 mt-2">
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


