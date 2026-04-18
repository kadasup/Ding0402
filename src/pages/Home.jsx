import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDing } from '../context/DingContext';
import { DialogBox, Button, Modal } from '../components/Components';
import { ShoppingBag, History, User, Lock, Coffee, Loader, ChevronDown, ChevronUp, X, Trash2, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getLocalDateKey, isSameLocalDate } from '../utils/date';
import leafIcon from '../assets/img/leaf.svg';


const Home = () => {
    const { data, actions, loading } = useDing();
    const [selectedMember, setSelectedMember] = useState(() => localStorage.getItem('ding_member') || null);
    const normalizeName = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const loadOrdersForMember = () => {
        void actions.fetchData(['orders'], {
            silent: true,
            timeoutMs: 8000,
            retries: 0,
        });
    };

    // 讓重新整理時，若有記憶角色，能同步至全局 context
    useEffect(() => {
        if (selectedMember) {
            actions.loginMember(selectedMember);
            loadOrdersForMember();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Safety check if data is not yet loaded or invalid


    const [cart, setCart] = useState([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
    const [isDuplicateRoundOrder, setIsDuplicateRoundOrder] = useState(false);
    const [successModal, setSuccessModal] = useState(false);
    const [deleteModal, setDeleteModal] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSwitchingMember, setIsSwitchingMember] = useState(false);
    const [memberPage, setMemberPage] = useState(0);
    const [isMobileViewport, setIsMobileViewport] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth < 768;
    });
    const BASE_FLOOR_OPTIONS = ['1樓', '14樓', '15樓'];
    const FLOOR_OPTIONS = [...BASE_FLOOR_OPTIONS, 'VIP'];
    const getMemberFloor = (memberName) => {
        const matched = String(memberName || '').trim().match(/^(\d+)\s*樓/);
        const detectedFloor = matched ? `${matched[1]}樓` : '';
        if (!detectedFloor) return 'VIP';
        return BASE_FLOOR_OPTIONS.includes(detectedFloor) ? detectedFloor : 'VIP';
    };
    const [selectedFloor, setSelectedFloor] = useState(() => getMemberFloor(localStorage.getItem('ding_member') || ''));
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleViewport = () => setIsMobileViewport(window.innerWidth < 768);
        handleViewport();
        window.addEventListener('resize', handleViewport);
        return () => window.removeEventListener('resize', handleViewport);
    }, []);
    const [randomItem, setRandomItem] = useState(null);
    const [isRolling, setIsRolling] = useState(false);
    const [showRandomModal, setShowRandomModal] = useState(false);
    const currentRoundSectionRef = useRef(null);
    const cartTotal = cart.reduce((sum, item) => sum + Number(item?.price || 0), 0);
    const cartSummary = Object.entries(
        cart.reduce((acc, item) => {
            const name = String(item?.name || '').trim() || '未知餐點';
            const price = Number(item?.price || 0);
            if (!acc[name]) {
                acc[name] = { qty: 0, subtotal: 0 };
            }
            acc[name].qty += 1;
            acc[name].subtotal += Number.isFinite(price) ? price : 0;
            return acc;
        }, {})
    );

    const startRandomPick = () => {
        const items = data.menu.items || [];
        if (items.length === 0) return;
        
        setShowRandomModal(true);
        setIsRolling(true);
        setRandomItem(null);
        
        // Rolling animation for 2 seconds
        let count = 0;
        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * items.length);
            setRandomItem(items[randomIndex]);
            count++;
            if (count > 20) {
                clearInterval(interval);
                setIsRolling(false);
            }
        }, 80);
    };

    const handleMemberLogin = (name) => {
        setSearchTerm('');
        setMemberPage(0);
        setSelectedMember(name);
        setIsSwitchingMember(false);
        setIsDropdownOpen(false);
        if (name) {
            setSelectedFloor(getMemberFloor(name));
        }
        setCart([]); // Clear cart when switching members
        if (name) {
            localStorage.setItem('ding_member', name);
            actions.loginMember(name);
            loadOrdersForMember();
        } else {
            localStorage.removeItem('ding_member');
            actions.logout();
        }
    };

    const memberNameSet = new Set((data?.members || []).map(m => normalizeName(m)).filter(Boolean));
    const selectedMemberValid = !!selectedMember && memberNameSet.has(normalizeName(selectedMember));
    const adminAllowedMemberSet = new Set([
        '1樓李尚聲',
        '1樓周文琳',
        '14樓林信綜',
    ].map(normalizeName));
    const canSeeAdminPortal = selectedMemberValid && adminAllowedMemberSet.has(normalizeName(selectedMember));

    useEffect(() => {
        if (!selectedMember) return;
        if (loading) return;
        // Wait until member list is available; avoid clearing remembered role too early on refresh.
        if ((data?.members || []).length === 0) return;
        if (selectedMemberValid) return;
        handleMemberLogin('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMember, selectedMemberValid, loading, data?.members]);

    const membersByFloor = (data?.members || []).filter(m => getMemberFloor(m) === selectedFloor);
    const filteredMembers = membersByFloor.filter(m => String(m || '').toLowerCase().includes(String(searchTerm || '').toLowerCase()));
    const memberPageSize = 6;
    const memberTotalPages = Math.max(1, Math.ceil(filteredMembers.length / memberPageSize));
    const safeMemberPage = Math.min(memberPage, memberTotalPages - 1);
    const pagedMembers = filteredMembers.slice(
        safeMemberPage * memberPageSize,
        safeMemberPage * memberPageSize + memberPageSize
    );

    const addToCart = (item) => {
        setCart([...cart, item]);
    };

    const removeFromCart = (index) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const executeOrder = async () => {
        if (isSubmittingOrder) return;
        setIsSubmittingOrder(true);
        const submittingItems = [...cart];
        // Optimistic UX: close modal and show success immediately while request runs in background.
        setCart([]);
        setShowConfirmModal(false);
        setTimeout(() => setSuccessModal(true), 80);
        try {
            const result = await actions.placeOrder(selectedMember, submittingItems);
            if (result?.ok === false) {
                setSuccessModal(false);
                setCart(prev => (prev.length === 0 ? submittingItems : prev));
                window.alert(result?.error || '下單失敗，請稍後再試。');
                return;
            }
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    const confirmDelete = () => {
        if (orderToDelete) {
            actions.deleteOrder(orderToDelete);
            setDeleteModal(false);
            setOrderToDelete(null);
        }
    };

    const submitOrder = () => {
        if (cart.length === 0) return;
        if (!selectedMember || !selectedMemberValid) {
            window.alert('請先選擇有效成員再下單。');
            handleMemberLogin('');
            return;
        }

        // Warn if user already ordered today
        const todayStr = getLocalDateKey();
        const currentMenuId = String(data.menu.lastUpdated || '');
        const alreadyOrdered = data.orders.some(o =>
            o.member === selectedMember &&
            isSameLocalDate(o.date, todayStr) &&
            String(o.menuId || '') === currentMenuId
        );
        setIsDuplicateRoundOrder(alreadyOrdered);
        setShowConfirmModal(true);
    };

    const handleSuccessConfirm = () => {
        setSuccessModal(false);
        setTimeout(() => {
            currentRoundSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }, 80);
    };

    // Safety check: Only show full-page loader if initial data hasn't arrived yet.
    // We check !data.menu.lastUpdated because that is null initially and populated after first fetch.
    const isInitialLoad = loading && (!data.menu || !data.menu.lastUpdated);



    // Filter history for current user (Safe access)
    const myHistory = (data.orders || []).filter(o => o.member === selectedMember);

    // Filter current round orders by current menuId (not by date)
    const currentMenuId = data.menu.lastUpdated;
    const roundMenuId = String(currentMenuId || '').trim();
    const myTodayOrders = myHistory.filter(o =>
        !!roundMenuId &&
        String(o.menuId || '').trim() === roundMenuId
    );
    const myTodayTotal = myTodayOrders.reduce((sum, o) => sum + o.total, 0);
    const todayOrderSummary = Object.values(
        myTodayOrders.reduce((acc, order) => {
            (order.items || []).forEach((item) => {
                const name = String(item?.name || '').trim() || '未知餐點';
                const key = normalizeName(name);
                const price = Number(item?.price || 0);
                if (!acc[key]) {
                    acc[key] = { name, qty: 0, subtotal: 0 };
                }
                acc[key].qty += 1;
                acc[key].subtotal += Number.isFinite(price) ? price : 0;
            });
            return acc;
        }, {})
    );
    const hasOrderedInCurrentRound = myTodayOrders.length > 0;

    // Calculate Most Popular by current menu round (menuId), not by date.
    const currentMenuItemNames = new Set((data.menu.items || []).map(i => i.name.trim()));
    const currentRoundOrders = (data.orders || []).filter(o =>
        !!roundMenuId &&
        String(o.menuId || '').trim() === roundMenuId
    );
    const itemCounts = {};
    currentRoundOrders.forEach(order => {
        (order.items || []).forEach(item => {
            const name = item.name.trim();
            // Only count if it's in the CURRENT menu
            if (currentMenuItemNames.has(name)) {
                itemCounts[name] = (itemCounts[name] || 0) + 1;
            }
        });
    });
    const maxCount = Math.max(0, ...Object.values(itemCounts));
    const mostPopularItems = Object.entries(itemCounts)
        .filter((entry) => entry[1] === maxCount && entry[1] > 0)
        .map(([name]) => name);
    const hasNoOrderInCurrentRound = currentRoundOrders.length === 0;



    return (
        <div className="flex flex-col gap-4 max-w-4xl mx-auto pb-40">
            {/* Mobile quick links (non-fixed to prevent overlap) */}
            {isMobileViewport && (
            <div className="px-4">
                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                    <Link
                        to="/guide"
                        className="hover:scale-105 active:scale-95 transition-all"
                        title="操作說明"
                    >
                        <Button
                            variant="secondary"
                            className="px-3 py-2 rounded-full shadow-md border-2 border-white flex items-center gap-1.5 text-sm"
                            style={{ backgroundColor: '#FFB84D', color: '#FFF' }}
                        >
                            <HelpCircle size={16} />
                            <span className="font-bold tracking-wide">操作說明</span>
                        </Button>
                    </Link>
                    {canSeeAdminPortal && (
                        <Link
                            to="/admin"
                            className="hover:scale-105 active:scale-95 transition-all"
                            title="管理後台"
                        >
                            <Button
                                variant="secondary"
                                className="px-3 py-2 rounded-full shadow-md border-2 border-white flex items-center gap-1.5 text-sm"
                            >
                                <Lock size={16} />
                                <span className="font-bold tracking-wide">管理</span>
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
            )}
            {/* Admin Portal Entry (Fixed to avoid overlap) */}
            {!isMobileViewport && canSeeAdminPortal && (
                <Link 
                    to="/admin" 
                    className="ac-admin-link hover:scale-105 active:scale-95 transition-all"
                    style={{ position: 'fixed', top: '24px', right: '24px', left: 'auto', zIndex: 99999, opacity: 0.8 }}
                    title="進入後台"
                >
                    <Button variant="secondary" className="px-5 py-2.5 rounded-full shadow-lg border-2 border-white flex items-center gap-2">
                        <Lock size={18} /> 
                        <span className="font-bold tracking-widest">管理後台</span>
                    </Button>
                </Link>
            )}

            {/* Guide Entry */}
            {!isMobileViewport && (
                <Link 
                    to="/guide" 
                    className="hover:scale-105 active:scale-95 transition-all"
                    style={{ position: 'fixed', top: '24px', left: '24px', right: 'auto', zIndex: 99999, opacity: 0.8 }}
                    title="操作說明"
                >
                    <Button variant="secondary" className="px-5 py-2.5 rounded-full shadow-lg border-2 border-white flex items-center gap-2" style={{ backgroundColor: '#FFB84D', color: '#FFF' }}>
                        <HelpCircle size={18} /> 
                        <span className="font-bold tracking-widest">操作說明</span>
                    </Button>
                </Link>
            )}

            {/* Header / Announcement */}
            <div className="flex flex-col items-center mb-6 relative px-4">
                <div className="brand-hero">
                    <div className="brand-hero-glow" />
                    <div className="brand-hero-card">
                        <div className="brand-hero-leaf">
                            <img src={leafIcon} alt="leaf" loading="lazy" decoding="async" />
                        </div>

                        <div className="brand-hero-text">
                            <p className="brand-hero-overline">DING BENTO CLUB</p>
                            <h1 className="brand-hero-title">自由543</h1>
                            <p className="brand-hero-subtitle">Ding Bento</p>
                        </div>

                        <div className="brand-hero-leaf brand-hero-leaf-right">
                            <img src={leafIcon} alt="leaf" loading="lazy" decoding="async" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto w-full">
                <DialogBox title="公布欄" className="mb-2 bg-ac-panel relative overflow-visible">

                    <div className="p-2 text-center">
                        <span className="inline-block bg-white text-ac-orange px-4 py-1 rounded-full border-2 border-ac-orange font-black text-lg tracking-widest shadow-sm rotate-1">
                            📢 公布訊息
                        </span>
                    </div>
                    <div className="p-6 text-center text-xl font-bold text-ac-brown min-h-[60px] flex items-center justify-center whitespace-pre-line">
                        {data.announcement}
                    </div>
                </DialogBox>
            </div>




            {/* Member Selection */}
            <div className="max-w-3xl mx-auto w-full animate-pop" style={{ animationDelay: '0.1s' }}>
                <DialogBox title="選擇角色" className="overflow-visible">
                    <div className="flex flex-col items-center gap-4 py-4 relative z-10 w-full">
                        {selectedMember && (
                            <div className="w-full max-w-md bg-white border-2 border-ac-orange rounded-2xl px-4 py-3 shadow-sm">
                                <div className="text-xs font-black text-ac-orange tracking-widest mb-1">您已選擇：</div>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-2xl font-black text-ac-brown leading-tight">{selectedMember}</div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSwitchingMember(true);
                                            setIsDropdownOpen(true);
                                            setSearchTerm('');
                                            setMemberPage(0);
                                        }}
                                        className="shrink-0 px-3 py-1.5 rounded-full border-2 border-ac-orange text-ac-orange bg-white font-black text-sm hover:bg-orange-100 transition-colors"
                                    >
                                        切換角色
                                    </button>
                                </div>
                            </div>
                        )}

                        {(!selectedMember || isSwitchingMember) && (
                        <div className="flex items-center gap-2 w-full max-w-md relative z-50">
                            <User className="text-ac-green shrink-0" />
                            <div className="relative w-full">
                                <input
                                    type="text"
                                    placeholder={selectedFloor ? '-- 請輸入或選擇成員 --' : '-- 請先選擇樓層 --'}
                                    value={selectedMember && !isDropdownOpen && !isSwitchingMember ? selectedMember : searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setMemberPage(0);
                                        setIsDropdownOpen(true);
                                    }}
                                    onFocus={() => {
                                        setIsDropdownOpen(true);
                                        setSearchTerm('');
                                        setMemberPage(0);
                                    }}
                                    onBlur={() => setTimeout(() => {
                                        setIsDropdownOpen(false);
                                        if (selectedMember) {
                                            setIsSwitchingMember(false);
                                        }
                                    }, 200)}
                                    className="ac-input w-full pr-20 cursor-text"
                                />

                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <ChevronDown className="text-gray-400" size={20} />
                                </div>

                                {(selectedMember || searchTerm) && (
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleMemberLogin('');
                                            setMemberPage(0);
                                            if (searchTerm) setIsDropdownOpen(true);
                                        }}
                                        className="absolute right-12 top-1/2 -translate-y-1/2 ac-clear-btn z-20"
                                        title="清除選擇"
                                    >
                                        <Trash2 size={18} strokeWidth={2.5} />
                                    </button>
                                )}

                                {isDropdownOpen && (
                                    <div className="absolute z-999 w-full mt-1 bg-white border-2 border-ac-green rounded-xl shadow-xl overflow-hidden left-0 top-full">
                                        <div className="px-3 pt-3 pb-2 border-b bg-[#F8FAFC]">
                                            <div className="text-[11px] font-black text-gray-500 mb-2 tracking-wide">選擇樓層</div>
                                            <div className="flex gap-2" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
                                                {FLOOR_OPTIONS.map((floor) => (
                                                    <button
                                                        key={floor}
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setSelectedFloor(floor);
                                                            setMemberPage(0);
                                                            setSearchTerm('');
                                                        }}
                                                        className="whitespace-nowrap px-3 py-2 rounded-full border leading-none font-black transition-all"
                                                        style={{
                                                            flex: 1,
                                                            minWidth: 72,
                                                            fontSize: isMobileViewport ? '1rem' : '1.125rem',
                                                            background: selectedFloor === floor ? '#EAF6FF' : '#fff',
                                                            borderColor: selectedFloor === floor ? '#5FCDE4' : '#E5E7EB',
                                                            color: selectedFloor === floor ? '#0F766E' : '#4B5563',
                                                        }}
                                                    >
                                                        {floor}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {!selectedFloor ? (
                                            <div className="px-4 py-4 text-gray-400 text-center cursor-default">
                                                請先選擇樓層再選成員
                                            </div>
                                        ) : filteredMembers.length > 0 ? (
                                            <>
                                                <ul className="grid grid-cols-2 gap-2 p-2" style={{ listStyle: 'none', margin: 0 }}>
                                                    {pagedMembers.map((m) => (
                                                        <li
                                                            key={m}
                                                            className={`px-3 py-2 rounded-lg hover:bg-[#FFF8E7] cursor-pointer text-ac-brown font-bold text-center border border-gray-100 ${
                                                                selectedMember === m ? 'bg-[#FFF8E7] border-ac-green' : 'bg-white'
                                                            }`}
                                                            onMouseDown={() => {
                                                                handleMemberLogin(m);
                                                                setIsDropdownOpen(false);
                                                            }}
                                                        >
                                                            {m}
                                                        </li>
                                                    ))}
                                                </ul>

                                                {memberTotalPages > 1 && (
                                                    <div className="flex items-center justify-between px-3 py-2 border-t bg-[#F8FAFC]">
                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setMemberPage((prev) => Math.max(0, prev - 1));
                                                            }}
                                                            disabled={safeMemberPage === 0}
                                                            className="px-3 py-1 rounded-full border text-sm font-bold"
                                                            style={{
                                                                opacity: safeMemberPage === 0 ? 0.45 : 1,
                                                                cursor: safeMemberPage === 0 ? 'not-allowed' : 'pointer',
                                                                background: '#fff',
                                                            }}
                                                        >
                                                            上一頁
                                                        </button>

                                                        <span className="text-xs font-bold text-gray-500">
                                                            {safeMemberPage + 1} / {memberTotalPages}
                                                        </span>

                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setMemberPage((prev) => Math.min(memberTotalPages - 1, prev + 1));
                                                            }}
                                                            disabled={safeMemberPage >= memberTotalPages - 1}
                                                            className="px-3 py-1 rounded-full border text-sm font-bold"
                                                            style={{
                                                                opacity: safeMemberPage >= memberTotalPages - 1 ? 0.45 : 1,
                                                                cursor: safeMemberPage >= memberTotalPages - 1 ? 'not-allowed' : 'pointer',
                                                                background: '#fff',
                                                            }}
                                                        >
                                                            下一頁
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="px-4 py-3 text-gray-400 text-center cursor-default">
                                                找不到符合條件的成員
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        )}
                    </div>
                </DialogBox>
            </div>

            {/* Shop Closed / Loading / Store Info Logic */}
            {isInitialLoad ? (
                <div className="max-w-3xl mx-auto w-full">
                    <div className="p-12 text-center opacity-70 bg-white rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center min-h-[300px]">
                        <Loader className="animate-spin mb-4 text-ac-green" size={48} />
                        <h2 className="text-xl font-bold text-ac-brown mb-2">菜單讀取中...</h2>
                        <p className="text-sm text-gray-400">請稍候...</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Shop Closed Message (Shown if not posted) */}
                    {!data.menu.posted && (
                        <div className="max-w-3xl mx-auto w-full">
                            <div className="py-16 text-center bg-white rounded-3xl border-2 border-dashed border-gray-300" style={{ opacity: 0.8 }}>
                                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>😴</div>
                                <h2 className="text-2xl font-black text-ac-brown mb-2" style={{ letterSpacing: '0.1em' }}>今日尚未開放點餐</h2>
                                <p className="text-gray-400 font-medium">請等待店家開啟菜單後再點餐</p>
                            </div>
                        </div>
                    )}

                    {/* Store Info Card (Vertical Layout Redesign) */}
                    {data.menu.posted && (
                        <div className="bg-white rounded-3xl overflow-hidden shadow-xl mb-4 border-4 border-ac-brown relative max-w-3xl mx-auto w-full animate-pop">
                            {/* Header: Store Info */}
                            <div className="bg-[#F9E076] p-4 text-center border-b-4 border-ac-brown border-dashed">
                                <h2 className="text-3xl font-black text-ac-brown mb-2 tracking-wide drop-shadow-sm">
                                    {data.menu.storeInfo?.name || "今日店家"}
                                </h2>
                                <div className="flex flex-col gap-1 text-sm font-bold text-[#7C6044]">
                                    {data.menu.storeInfo?.phone && (
                                        <div className="flex items-center justify-center gap-2">
                                            <span>📞</span>
                                            <span>{data.menu.storeInfo.phone}</span>
                                        </div>
                                    )}
                                    {data.menu.storeInfo?.address && (
                                        <div className="flex items-center justify-center gap-2">
                                            <span>📍</span>
                                            <span>{data.menu.storeInfo.address}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Remark Section */}
                            {data.menu.remark && (
                                <div className="px-4 py-3 border-b-4 border-ac-brown border-dashed animate-pop">
                                    <div className="rounded-2xl border-2 border-[#F4C86A] px-4 py-4 text-center" style={{ backgroundColor: '#FFF8E7' }}>
                                        <div className="inline-block bg-[#FFE29A] text-[#B87434] px-3 py-1 rounded-full border border-[#F4C86A] font-black text-xs mb-2 shadow-sm">
                                            📢 貼心提醒 / 備註
                                        </div>
                                        <div className="text-ac-brown font-bold text-base leading-relaxed whitespace-pre-line px-2">
                                            {data.menu.remark}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Body: Menu List (Simple List) */}

                            <div className="p-6 bg-[#FFF8E7]">
                                <div className="text-center mb-4">
                                    <div className="inline-flex items-center justify-center bg-ac-green text-white px-6 py-1 rounded-full shadow-md hover:scale-105 transition-transform cursor-default">
                                        <span className="font-bold text-lg tracking-widest leading-none pt-[2px]">店家菜單</span>
                                    </div>
                                    {selectedMember && (
                                        <p className="text-sm text-ac-brown mt-2 animate-bounce-subtle">
                                            👇 點選餐點可直接加入購物車
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col w-full max-w-2xl mx-auto px-2 sm:px-6">
                                    {(data.menu.items || []).map((item, idx) => (
                                        <React.Fragment key={idx}>
                                            <div
                                                onClick={() => selectedMember && addToCart(item)}
                                                style={{
                                                    paddingRight: selectedMember ? '60px' : '10px',
                                                    paddingLeft: selectedMember ? '10px' : '0'
                                                }}
                                                className={`flex justify-between items-end py-2 transition-all duration-200 relative group
                                                    ${selectedMember ? 'cursor-pointer hover:bg-yellow-50 -mx-2 rounded-lg' : ''}
                                                `}
                                            >
                                                <span className="font-bold text-xl text-gray-800 leading-tight group-hover:text-ac-green transition-colors relative z-10 bg-[#FFF8E7] group-hover:bg-yellow-50 pr-2">
                                                    {item.name}
                                                </span>

                                                {/* Dotted Leader (Visual connection inside item) */}
                                                <div className="flex-grow border-b-4 border-dotted border-gray-300 mb-2 mx-1 opacity-50 relative -z-0"></div>

                                                <div className="flex items-center gap-2 relative z-10 bg-[#FFF8E7] group-hover:bg-yellow-50 pl-2">
                                                    <span className="font-bold text-xl text-ac-orange whitespace-nowrap">
                                                        ${item.price}
                                                    </span>
                                                </div>
                                                {selectedMember && (
                                                    <div
                                                        style={{ right: '5px', width: '40px', height: '40px', top: '50%', transform: 'translateY(-50%)' }}
                                                        className="absolute flex items-center justify-center rounded-full bg-ac-green text-white opacity-0 group-hover:opacity-100 transition-all shadow-md"
                                                    >
                                                        <span className="font-bold text-lg">+1</span>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Explicit Dashed Separator (Only between items, not after last) */}
                                            {idx < (data.menu.items || []).length - 1 && (
                                                <div style={{ borderBottom: '2px dashed #A0A0A0', width: '100%', margin: '8px 0' }}></div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>

                                {selectedMember && myTodayOrders.length === 0 && data.menu.posted && (
                                    <div className="mt-6 flex justify-center">
                                        <button
                                            onClick={startRandomPick}
                                            className="inline-flex items-center justify-center gap-2 text-white px-8 py-2 rounded-full border-2 font-black transition-all hover:brightness-105 hover:scale-[1.01] active:scale-[0.99] group shadow-lg animate-cta-pulse"
                                            style={{ background: 'linear-gradient(180deg, #D48745 0%, #B9672D 100%)', borderColor: '#E7C392', cursor: 'pointer' }}
                                        >
                                            <span className="text-base sm:text-lg group-hover:scale-110 transition-transform">⭐</span>
                                            <span className="text-sm sm:text-base tracking-wide">不知道今天吃什麼</span>
                                            <span className="text-base sm:text-lg group-hover:scale-110 transition-transform">⭐</span>
                                        </button>
                                    </div>
                                )}
                                
                                {/* Integrated Most Popular Section */}
                                {!hasNoOrderInCurrentRound && (
                                    <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-300 w-full animate-pop">
                                        <div className="rounded-2xl border-2 border-[#F4C86A] px-4 py-4" style={{ backgroundColor: '#FFF8E7' }}>
                                            <div className="flex justify-center mb-4">
                                                <div className="bg-hot-yellow text-ac-brown px-6 py-1 rounded-full shadow-md border-2 border-white transform -rotate-1">
                                                    <span className="font-black text-sm tracking-widest leading-none block whitespace-nowrap">最多人點 🔥</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap justify-center gap-4">
                                                {mostPopularItems.map((name) => {
                                                    const menuItem = (data.menu.items || []).find(i => {
                                                        const menuName = i.name.trim().toLowerCase();
                                                        const popName = name.trim().toLowerCase();
                                                        
                                                        // Exact after normalization
                                                        if (menuName.replace(/\s/g, '') === popName.replace(/\s/g, '')) return true;
                                                        
                                                        // Partial match as fallback
                                                        if (menuName.includes(popName) || popName.includes(menuName)) return true;
                                                        
                                                        return false;
                                                    });
                                                    return (
                                                        <button 
                                                            key={name} 
                                                            onClick={() => selectedMember && menuItem && addToCart(menuItem)}
                                                            className={`
                                                                group relative flex flex-col items-center justify-center
                                                                min-w-[100px] px-4 py-2.5 rounded-xl border-2 transition-all duration-300
                                                                ${selectedMember 
                                                                    ? 'cursor-pointer hover:bg-orange-50 hover:border-ac-orange hover:-translate-y-1 shadow-sm hover:shadow-md' 
                                                                    : 'cursor-default opacity-90'}
                                                                bg-white border-orange-100/30
                                                            `}
                                                        >
                                                            <span className="text-base font-black text-ac-brown whitespace-nowrap">
                                                                {name}
                                                            </span>
                                                            {selectedMember && (
                                                                <span className="text-[9px] font-black text-ac-orange mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    點我加點 +
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Footer: Closing Time */}
                                {data.menu.closingTime && (
                                    <div className="mt-6 text-center">
                                        <span
                                            className="inline-block px-5 py-1.5 rounded-xl font-black text-base shadow-md tracking-wide"
                                            style={{
                                                backgroundColor: '#FFE7E7',
                                                border: '2px solid #EF4444',
                                                color: '#B91C1C'
                                            }}
                                        >
                                            {(() => {
                                                const cTime = data.menu.closingTime || '';
                                                try {
                                                    const dateObj = new Date(cTime);
                                                    if (isNaN(dateObj.getTime())) throw new Error('Invalid Date');

                                                    // Format Date: MM/DD
                                                    const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                                                    const d = dateObj.getDate().toString().padStart(2, '0');
                                                    const dateStr = `${m}/${d}`;

                                                    // Format Time: HH:mm (24h)
                                                    const h = dateObj.getHours().toString().padStart(2, '0');
                                                    const min = dateObj.getMinutes().toString().padStart(2, '0');
                                                    const timeStr = `${h}:${min}`;

                                                    const today = new Date();
                                                    const isToday = dateObj.toDateString() === today.toDateString();

                                                    return `⏰ 結單時間：${isToday ? '今天' : dateStr} ${timeStr}`;
                                                } catch {
                                                    return `⏰ 結單時間：${cTime}`;
                                                }
                                            })()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedMember && (
                        <div ref={currentRoundSectionRef} className="max-w-3xl mx-auto w-full mt-4 animate-pop">
                            <DialogBox title="本輪已點" className="overflow-visible">
                                <div className="p-4 flex flex-col gap-3">
                                    <div className="w-full max-w-md bg-orange-50 border-2 border-ac-orange rounded-2xl px-4 py-3 shadow-sm">
                                        <div className="text-2xl font-black text-ac-brown leading-tight">{selectedMember}</div>
                                    </div>

                                    <div className="flex flex-col gap-3 w-full">
                                        {myTodayOrders.length === 0 && (
                                            <div className="text-center italic text-gray-400 py-6 bg-white rounded-xl border border-dashed">
                                                <div className="font-bold text-gray-500 not-italic">尚未點餐，往上滑看一眼賀甲A菜單！</div>
                                            </div>
                                        )}

                                        {myTodayOrders.map(order => (
                                            <div key={order.id} className="flex justify-between items-center bg-white border border-ac-green/30 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-black text-lg text-ac-brown leading-tight tracking-wide">
                                                        {order.items.map(i => i.name).join(', ')}
                                                    </span>
                                                    <span className="font-bold text-ac-orange text-base">
                                                        ${order.total}
                                                    </span>
                                                </div>

                                                {data?.menu?.posted ? (
                                                    <Button variant="danger" onClick={() => {
                                                        setOrderToDelete(order.id);
                                                        setDeleteModal(true);
                                                    }} className="px-3 py-1.5 text-sm rounded-full shadow-sm hover:scale-105 active:scale-95 transition-transform">
                                                        取消
                                                    </Button>
                                                ) : (
                                                    <div className="px-3 py-1.5 text-xs font-bold text-gray-400 bg-gray-50 rounded-full border border-gray-200">
                                                        已結單
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-1 pt-3 border-t-2 border-dashed border-ac-green/30 w-full text-center">
                                        <div className="text-ac-orange font-black text-xl">
                                            應繳金額：${myTodayTotal}
                                        </div>
                                    </div>
                                </div>
                            </DialogBox>
                        </div>
                    )}

                    {/* Cart Section (Fixed via Portal - Optimized) */}
                    {selectedMember && data.menu.posted && createPortal(
                        <div style={{ position: 'fixed', bottom: '30px', right: '30px', left: 'auto', zIndex: 99999, display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '300px', maxWidth: '90vw' }} className="transition-all duration-300 transform translate-y-0 animate-pop">
                                <div style={{ backgroundColor: '#FDFBF7', borderRadius: '24px' }} className="shadow-2xl border-4 border-[#78B159] ring-4 ring-[#FDFBF7] overflow-hidden">

                                    {/* Header / Toggle */}
                                    <div
                                        style={{ backgroundColor: '#78B159' }}
                                        className="text-white py-3 px-5 flex items-center justify-start gap-6 cursor-pointer active:brightness-90 transition-colors"
                                        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">🍱</span>
                                            <span className="font-bold text-lg tracking-widest">已加餐點</span>
                                            {cart.length > 0 ? (
                                                <span className="bg-ac-orange text-white text-xs font-bold px-2 py-1 rounded-full">{cart.length}</span>
                                            ) : (
                                                <span className="text-xs text-ac-green bg-white/10 px-2 py-1 rounded-full">空車</span>
                                            )}
                                        </div>
                                        <div className="font-bold text-lg tracking-wider">
                                            總計 <span className="text-[#F9E076] text-xl drop-shadow-sm">${cartTotal}</span>
                                        </div>
                                    </div>

                                    <div className="px-3 pt-2 pb-1 text-center" style={{ backgroundColor: '#FDFBF7' }}>
                                        <span className="inline-flex items-center rounded-full border border-[#F4A261] bg-[#FFF3C4] px-4 py-1.5 text-base font-black text-[#B87434]">
                                            {selectedMember}
                                        </span>
                                    </div>

                                    <div className="px-3 pb-2" style={{ backgroundColor: '#FDFBF7' }}>
                                        <div className="rounded-xl border border-[#F4D7A2] bg-[#FFF9EE] px-3 py-2">
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className="font-black px-3 py-1 rounded-lg"
                                                    style={{ backgroundColor: '#FFF3C4', color: '#9A6A2E', border: '1px solid #F4D7A2', fontSize: '0.95rem', letterSpacing: '0.03em' }}
                                                >
                                                    今日點餐狀態
                                                </span>
                                                {myTodayOrders.length > 0 ? (
                                                    <span
                                                        className="text-xs font-black px-2 py-0.5 rounded-full"
                                                        style={{ backgroundColor: '#D1FAE5', color: '#047857', border: '1px solid #A7F3D0' }}
                                                    >
                                                        已點過
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="text-xs font-black px-3 py-1 rounded-full shadow-sm animate-status-pulse"
                                                        style={{ backgroundColor: '#FFE4B3', color: '#B45309', border: '2px solid #F59E0B' }}
                                                    >
                                                        尚未點餐
                                                    </span>
                                                )}
                                            </div>
                                            {myTodayOrders.length > 0 ? (
                                                <>
                                                    <div className="text-base font-black text-[#7C5A28] mt-1">
                                                        已點 {myTodayOrders.length} 筆，應繳金額 <span style={{ color: '#D97706' }}>${myTodayTotal}</span>
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {todayOrderSummary.map((stat) => (
                                                            <span key={stat.name} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#F0E2C5] text-[#8B5E2B]">
                                                                {stat.name} x{stat.qty}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Content (Only show if items exist or user clicks header to expand - keeping simple expanded view for now per request) */}
                                    {cart.length > 0 && (
                                        <div style={{ backgroundColor: '#FFF0F5' }} className="p-2 max-h-[40vh] overflow-y-auto animate-slide-up">
                                            <div className="flex flex-col gap-2">
                                                <div className="text-[11px] font-black text-[#9A6A2E] bg-[#FFF9EE] border border-[#F4D7A2] rounded-lg px-2 py-1.5">
                                                    本次待送出：{cart.length} 項{hasOrderedInCurrentRound ? '（加點）' : ''}
                                                </div>
                                                {cart.map((item, idx) => {
                                                    return (
                                                        <div key={idx} className="flex justify-between items-center bg-white/80 border border-dashed border-red-200 p-2 rounded-xl shadow-sm">
                                                            <div className="flex flex-col pl-2">
                                                                <span className="font-bold text-gray-700">{item.name}</span>
                                                                {hasOrderedInCurrentRound && (
                                                                    <span
                                                                        className="text-[11px] font-black px-2 py-0.5 rounded-full w-fit mt-1"
                                                                        style={{ backgroundColor: '#FFF3C4', color: '#B45309', border: '1px solid #F4D7A2' }}
                                                                    >
                                                                        加點
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-gray-400 text-sm">${item.price}</span>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); removeFromCart(idx); }}
                                                                    className="text-red-400 hover:text-red-600 w-6 h-6 flex items-center justify-center hover:bg-red-50 rounded-full transition-colors"
                                                                >
                                                                    x
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                <div className="pt-2 px-1">
                                                    <Button onClick={submitOrder} className="w-full justify-center py-2 text-lg shadow-md hover:shadow-lg transform active:scale-95 transition-all">
                                                        送出訂單 🚀
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {cart.length === 0 && (
                                        <div className="py-2 text-center text-gray-400 text-sm bg-yellow-50/30">
                                            {myTodayOrders.length > 0 ? '( 今天已點過餐，想加點可直接點菜單 )' : '( 今天還沒點餐，快去挑幾樣吧 )'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

                    <Modal isOpen={showConfirmModal} onClose={() => { if (isSubmittingOrder) return; setShowConfirmModal(false); }}>
                        <div className="flex flex-col items-center gap-4 text-center animate-pop w-full max-w-lg">
                            <h3 className="text-xl font-bold text-ac-brown">確認下單</h3>
                            <div className="w-full bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-left">
                                <div className="text-xs font-black text-ac-orange tracking-widest mb-1">本次下單成員</div>
                                <div className="text-xl font-black text-ac-brown">{selectedMember || '-'}</div>
                            </div>
                            {isDuplicateRoundOrder && (
                                <div className="w-full bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl px-4 py-2 text-sm font-bold text-left">
                                    提醒：你本輪已點過餐，若確定要再送一次，請按「確認下單」。
                                </div>
                            )}
                            <div className="w-full max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-xl px-3 py-2 text-left">
                                {cartSummary.map(([name, stat]) => (
                                    <div key={name} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-b-0">
                                        <span className="font-bold text-ac-brown">{name}</span>
                                        <span className="font-bold text-gray-600">x {stat.qty}，小計 ${stat.subtotal}</span>
                                    </div>
                                ))}
                                {cartSummary.length === 0 && (
                                    <div className="text-sm text-gray-400 text-center py-2">購物車是空的</div>
                                )}
                            </div>
                            <div className="w-full flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                                <span className="font-black text-green-700">總金額</span>
                                <span className="font-black text-xl text-ac-orange">${cartTotal}</span>
                            </div>
                            <div className="flex gap-4">
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowConfirmModal(false)}
                                    disabled={isSubmittingOrder}
                                >
                                    再想想
                                </Button>
                                <Button
                                    onClick={executeOrder}
                                    disabled={isSubmittingOrder}
                                    className="min-w-[120px] justify-center"
                                >
                                    {isSubmittingOrder ? (
                                        <>
                                            <Loader size={16} className="animate-spin" />
                                            送出中...
                                        </>
                                    ) : '確認下單'}
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    <Modal isOpen={successModal} onClose={() => setSuccessModal(false)}>
                        <div className="flex flex-col items-center gap-4 text-center animate-pop">
                            <h3 className="text-xl font-bold text-ac-brown">下單成功</h3>
                            <div className="text-4xl animate-bounce">🍃</div>
                            <p className="text-ac-text leading-relaxed">
                                你的餐點已經送出。<br />
                                可以到本輪已點區塊確認內容。
                            </p>
                            <Button onClick={handleSuccessConfirm}>
                                點我看明細
                            </Button>
                        </div>
                    </Modal>

                    {/* Random Pick Modal */}
                    <Modal isOpen={showRandomModal} onClose={() => !isRolling && setShowRandomModal(false)}>
                        <div className="flex flex-col items-center justify-center p-4 min-h-[300px]">
                            {isRolling ? (
                                <div className="flex flex-col items-center gap-6">
                                    <div className="text-6xl animate-bounce">🎲</div>
                                    <h3 className="text-2xl font-black text-ac-brown tracking-widest">正在為您挑選好料...</h3>
                                    <div className="bg-white border-4 border-ac-green p-4 rounded-2xl w-64 h-20 flex items-center justify-center overflow-hidden relative">
                                        <div className="text-2xl font-bold text-ac-green whitespace-nowrap animate-pulse">
                                            {randomItem?.name || "???"}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-6 animate-pop">
                                    <div className="text-6xl">🎉</div>
                                    <h3 className="text-xl font-bold text-gray-500">決定好啦！今天就吃...</h3>
                                    <div className="border-4 border-ac-orange p-6 rounded-[2rem] shadow-xl transform rotate-2 max-w-xs w-full text-center" style={{ backgroundColor: '#FFF8E7' }}>
                                        <div className="text-3xl font-black text-ac-brown mb-2 leading-tight">
                                            {randomItem?.name}
                                        </div>
                                        <div className="text-xl font-bold text-ac-orange">
                                            ${randomItem?.price}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
                                        <Button 
                                            onClick={() => {
                                                addToCart(randomItem);
                                                setShowRandomModal(false);
                                            }}
                                            className="w-full py-3 text-lg justify-center shadow-lg transform hover:scale-105 active:scale-95"
                                        >
                                            看起來很棒，加點！🚀
                                        </Button>
                                        <Button 
                                            variant="secondary" 
                                            onClick={startRandomPick}
                                            className="w-full py-2 text-sm justify-center opacity-70"
                                        >
                                            不太想吃這個，重新選一次 🎲
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Modal>

                    <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)}>
                        <div className="flex flex-col items-center gap-4 text-center animate-pop">
                            <h3 className="text-xl font-bold text-ac-brown">取消訂單</h3>
                            <p className="text-ac-text leading-relaxed">
                                確定要取消這筆訂單嗎？<br />
                                <span className="text-sm text-gray-500">(這筆訂單會直接刪除喔)</span>
                            </p>
                            <div className="flex gap-4">
                                <Button variant="secondary" onClick={() => setDeleteModal(false)}>
                                    再想想
                                </Button>
                                <Button variant="danger" onClick={confirmDelete}>
                                    確定刪除
                                </Button>
                            </div>
                        </div>
                    </Modal>
                </>
            )}

            {/* Scroll to Top Button */}
            {showScrollTop && !isDropdownOpen && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="fixed ac-scroll-top hover:scale-110 active:scale-95 transition-all animate-pop z-[99999]"
                    style={{
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

export default Home;

