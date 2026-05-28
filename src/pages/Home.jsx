import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDing } from '../context/DingContext';
import { DialogBox, Button, Modal, EmptyState } from '../components/Components';
import { User, Lock, Loader, ChevronUp, HelpCircle, UtensilsCrossed, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getLocalDateKey, isSameLocalDate } from '../utils/date';
import leafIcon from '../assets/img/leaf.svg';


const normalizeName = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
const sanitizeNote = (value) => String(value || '').trim().slice(0, 15);

const computeClosingInfo = (closingTime, now) => {
    if (!closingTime) return null;
    const ts = new Date(closingTime).getTime();
    if (isNaN(ts)) return null;
    const diffMs = ts - now;
    const diffMin = Math.floor(diffMs / 60000);
    const closingDate = new Date(ts);
    const isClosed = diffMs <= 0;
    const level = isClosed ? 'closed' : diffMin < 10 ? 'urgent' : diffMin < 30 ? 'warn' : 'normal';
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    const remainingText = isClosed
        ? '已截止'
        : hours > 0
            ? `剩 ${hours} 小時 ${mins} 分`
            : diffMin >= 1
                ? `剩 ${diffMin} 分鐘`
                : '剩不到 1 分鐘';
    const today = new Date();
    const isToday = closingDate.toDateString() === today.toDateString();
    const datePart = `${String(closingDate.getMonth() + 1).padStart(2, '0')}/${String(closingDate.getDate()).padStart(2, '0')}`;
    const timePart = `${String(closingDate.getHours()).padStart(2, '0')}:${String(closingDate.getMinutes()).padStart(2, '0')}`;
    const whenText = `${isToday ? '今天' : datePart} ${timePart}`;
    return { isClosed, level, remainingText, whenText };
};

const CLOSING_STYLE = {
    normal: { bg: '#F3F4F6', border: '#D1D5DB', color: '#4B5563', pulse: false },
    warn: { bg: '#FFF7ED', border: '#FB923C', color: '#9A3412', pulse: false },
    urgent: { bg: '#FEE2E2', border: '#EF4444', color: '#991B1B', pulse: true },
    closed: { bg: '#E5E7EB', border: '#9CA3AF', color: '#374151', pulse: false },
};

const Home = () => {
    const { data, actions, loading, bootstrapped, ui } = useDing();
    const location = useLocation();
    const [selectedMember, setSelectedMember] = useState(() => localStorage.getItem('ding_member') || null);
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
    const [successItems, setSuccessItems] = useState([]);
    const [deleteModal, setDeleteModal] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);
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

    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30 * 1000);
        return () => clearInterval(id);
    }, []);
    const closingInfo = useMemo(
        () => computeClosingInfo(data.menu?.closingTime, now),
        [data.menu?.closingTime, now]
    );

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
        let rafId;
        const onResize = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(handleViewport);
        };
        window.addEventListener('resize', onResize);
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', onResize);
        };
    }, []);
    const [randomItem, setRandomItem] = useState(null);
    const [isRolling, setIsRolling] = useState(false);
    const [showRandomModal, setShowRandomModal] = useState(false);
    const currentRoundSectionRef = useRef(null);
    const memberSelectorRef = useRef(null);
    const switchFeedbackTimerRef = useRef(null);
    const [showSwitchFeedback, setShowSwitchFeedback] = useState(false);
    const [pendingCartItem, setPendingCartItem] = useState(null);
    const [cartItemNote, setCartItemNote] = useState('');
    const menuItems = useMemo(() => data.menu.items || [], [data.menu.items]);
    const cartTotal = useMemo(
        () => cart.reduce((sum, item) => sum + Number(item?.price || 0), 0),
        [cart]
    );
    const cartSummary = useMemo(
        () => Object.entries(
            cart.reduce((acc, item) => {
                const name = String(item?.name || '').trim() || '未知餐點';
                const note = sanitizeNote(item?.note);
                const summaryKey = `${name}__${note}`;
                const price = Number(item?.price || 0);
                if (!acc[summaryKey]) {
                    acc[summaryKey] = { name, note, qty: 0, subtotal: 0 };
                }
                acc[summaryKey].qty += 1;
                acc[summaryKey].subtotal += Number.isFinite(price) ? price : 0;
                return acc;
            }, {})
        ),
        [cart]
    );

    const startRandomPick = () => {
        const items = data.menu.items || [];
        if (items.length === 0) return;
        setShowRandomModal(true);
        setIsRolling(true);
        setRandomItem(null);
    };

    useEffect(() => {
        if (!isRolling) return;
        if (menuItems.length === 0) return;
        let count = 0;
        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * menuItems.length);
            setRandomItem(menuItems[randomIndex]);
            count++;
            if (count > 20) {
                clearInterval(interval);
                setIsRolling(false);
            }
        }, 80);
        return () => clearInterval(interval);
    }, [isRolling, menuItems]);

    useEffect(() => {
        return () => {
            if (switchFeedbackTimerRef.current) {
                clearTimeout(switchFeedbackTimerRef.current);
            }
        };
    }, []);

    const openMemberSelector = (withFeedback = false) => {
        setIsSwitchingMember(true);
        setMemberPage(0);

        if (withFeedback) {
            setShowSwitchFeedback(true);
            if (switchFeedbackTimerRef.current) {
                clearTimeout(switchFeedbackTimerRef.current);
            }
            switchFeedbackTimerRef.current = setTimeout(() => {
                setShowSwitchFeedback(false);
            }, 1600);
        }

        window.requestAnimationFrame(() => {
            setTimeout(() => {
                memberSelectorRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }, 80);
        });
    };

    const handleMemberLogin = (name) => {
        setMemberPage(0);
        setSelectedMember(name);
        setIsSwitchingMember(false);
        setShowSwitchFeedback(false);
        if (name) {
            setSelectedFloor(getMemberFloor(name));
        }
        setCart([]); // Clear cart when switching members
        if (name) {
            localStorage.setItem('ding_member', name);
            actions.loginMember(name);
            loadOrdersForMember();
            ui?.pushToast?.('info', `📢 已切換為 ${name}`);
        } else {
            localStorage.removeItem('ding_member');
            actions.logout();
        }
    };

    const memberNameSet = new Set((data?.members || []).map(m => normalizeName(m)).filter(Boolean));
    const selectedMemberValid = !!selectedMember && memberNameSet.has(normalizeName(selectedMember));
    const adminAllowedMemberSet = new Set([
        '1樓尚聲',
        '1樓文琳',
        '1樓振利',
        '14樓信綜',
        '15樓秀琴',
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
    const memberPageSize = 6;
    const memberTotalPages = Math.max(1, Math.ceil(membersByFloor.length / memberPageSize));
    const safeMemberPage = Math.min(memberPage, memberTotalPages - 1);
    const pagedMembers = membersByFloor.slice(
        safeMemberPage * memberPageSize,
        safeMemberPage * memberPageSize + memberPageSize
    );

    const addToCart = (item, note = '') => {
        if (!item) return;
        setCart([...cart, { ...item, note: sanitizeNote(note) }]);
    };

    const openAddToCartModal = (item) => {
        if (!selectedMember || !item) return;
        setPendingCartItem(item);
        setCartItemNote('');
    };

    const confirmAddToCart = () => {
        if (!pendingCartItem) return;
        addToCart(pendingCartItem, cartItemNote);
        setPendingCartItem(null);
        setCartItemNote('');
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
        setSuccessItems(submittingItems);
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
        if (closingInfo?.isClosed) {
            window.alert('已過結單時間，無法再下單。');
            return;
        }
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

    // Show loader until bootstrap has confirmed the menu state. Prevents the
    // "今日尚未開放點餐" empty state from flashing before the first fetch resolves.
    const isInitialLoad = !bootstrapped;



    const myHistory = useMemo(
        () => (data.orders || []).filter(o => o.member === selectedMember),
        [data.orders, selectedMember]
    );

    useEffect(() => {
        const focusTarget = new URLSearchParams(location.search).get('focus');
        if (focusTarget !== 'current-round') return;
        if (!currentRoundSectionRef.current) return;

        const timer = setTimeout(() => {
            currentRoundSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }, 120);

        return () => clearTimeout(timer);
    }, [location.search, selectedMember]);

    const roundMenuId = String(data.menu.lastUpdated || '').trim();
    const { myTodayOrders, myTodayTotal, todayOrderSummary, hasOrderedInCurrentRound } = useMemo(() => {
        const orders = myHistory.filter(o =>
            !!roundMenuId && String(o.menuId || '').trim() === roundMenuId
        );
        const total = orders.reduce((sum, o) => sum + o.total, 0);
        const summary = Object.values(
            orders.reduce((acc, order) => {
                (order.items || []).forEach((item) => {
                    const name = String(item?.name || '').trim() || '未知餐點';
                    const note = sanitizeNote(item?.note);
                    const key = `${normalizeName(name)}__${note}`;
                    const price = Number(item?.price || 0);
                    if (!acc[key]) acc[key] = { name, note, qty: 0, subtotal: 0 };
                    acc[key].qty += 1;
                    acc[key].subtotal += Number.isFinite(price) ? price : 0;
                });
                return acc;
            }, {})
        );
        return {
            myTodayOrders: orders,
            myTodayTotal: total,
            todayOrderSummary: summary,
            hasOrderedInCurrentRound: orders.length > 0,
        };
    }, [myHistory, roundMenuId]);

    const { mostPopularItems, hasNoOrderInCurrentRound } = useMemo(() => {
        const currentMenuItemNames = new Set((data.menu.items || []).map(i => i.name.trim()));
        const rounds = (data.orders || []).filter(o =>
            !!roundMenuId &&
            String(o.menuId || '').trim() === roundMenuId
        );
        const itemCounts = {};
        rounds.forEach(order => {
            (order.items || []).forEach(item => {
                const name = item.name.trim();
                if (currentMenuItemNames.has(name)) {
                    itemCounts[name] = (itemCounts[name] || 0) + 1;
                }
            });
        });
        const maxCount = Math.max(0, ...Object.values(itemCounts));
        const popular = Object.entries(itemCounts)
            .filter((entry) => entry[1] === maxCount && entry[1] > 0)
            .map(([name]) => name);
        return {
            mostPopularItems: popular,
            hasNoOrderInCurrentRound: rounds.length === 0,
        };
    }, [data.orders, data.menu.items, roundMenuId]);



    return (
        <div className="flex flex-col gap-4 max-w-4xl mx-auto pb-40">
            {/* Mobile quick links (non-fixed to prevent overlap) */}
            {isMobileViewport && (
            <div className="px-4">
                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                    <Link to="/guide" className="ac-float-link-inline ac-float-link-inline--guide" title="操作說明">
                        <HelpCircle size={14} />
                        <span>操作說明</span>
                    </Link>
                    {canSeeAdminPortal && (
                        <Link to="/admin" className="ac-float-link-inline ac-float-link-inline--admin" title="管理後台">
                            <Lock size={14} />
                            <span>管理</span>
                        </Link>
                    )}
                </div>
            </div>
            )}

            {/* Desktop floating corner buttons */}
            {!isMobileViewport && (
                <Link to="/guide" className="ac-float-link ac-float-link--left ac-float-link--guide" title="操作說明">
                    <HelpCircle size={16} />
                    <span>操作說明</span>
                </Link>
            )}
            {!isMobileViewport && canSeeAdminPortal && (
                <Link to="/admin" className="ac-float-link ac-float-link--right ac-float-link--admin" title="進入後台">
                    <Lock size={16} />
                    <span>管理後台</span>
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





            {/* Member Selection */}
            <div className="max-w-3xl mx-auto w-full animate-pop" style={{ animationDelay: '0.1s' }}>
                <DialogBox title="選擇角色" className="overflow-visible">
                    <div className="flex flex-col items-center gap-4 py-4 relative z-10 w-full">
                        {selectedMember && (
                            <div className="ac-selected-tile-wrap w-full max-w-md flex flex-col gap-2">
                                <div className="ac-selected-tile">
                                    <div className="ac-selected-tile-info">
                                        <div className="ac-selected-tile-lbl">您已選擇：</div>
                                        <div className="ac-selected-tile-name">{selectedMember}</div>
                                    </div>
                                    <Button variant="warn" onClick={() => openMemberSelector(true)} className="ac-btn sm">
                                        切換角色
                                    </Button>
                                </div>
                                {showSwitchFeedback && (
                                    <div className="text-xs font-black text-ac-blue bg-blue-50 border border-blue-200 rounded-full px-3 py-1 inline-block">
                                        已開啟成員選單，請在下方選擇
                                    </div>
                                )}
                            </div>
                        )}

                        {(!selectedMember || isSwitchingMember) && (
                        <div
                            ref={memberSelectorRef}
                            className={`flex items-center gap-2 w-full max-w-md relative z-50 transition-all ${
                                showSwitchFeedback ? 'ring-2 ring-blue-200 rounded-2xl p-1 bg-blue-50/60' : ''
                            }`}
                        >
                            <User className="text-ac-green shrink-0" />
                            <div className="w-full bg-white border-2 border-ac-green rounded-xl shadow-xl overflow-hidden">
                                <div className="px-3 pt-3 pb-2 border-b bg-[#F8FAFC]">
                                    <div className="text-[11px] font-black text-gray-500 mb-2 tracking-wide">選擇樓層</div>
                                    <div className="flex gap-2" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
                                        {FLOOR_OPTIONS.map((floor) => (
                                            <button
                                                key={floor}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFloor(floor);
                                                    setMemberPage(0);
                                                    if (selectedMember && getMemberFloor(selectedMember) !== floor) {
                                                        handleMemberLogin('');
                                                    }
                                                }}
                                                className="floor-chip whitespace-nowrap leading-none font-black transition-all"
                                                data-active={selectedFloor === floor ? 'true' : 'false'}
                                                style={{
                                                    flex: 1,
                                                    minWidth: 72,
                                                    fontSize: isMobileViewport ? '1rem' : '1.125rem',
                                                }}
                                            >
                                                {floor}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {membersByFloor.length > 0 ? (
                                    <>
                                        <ul className="grid grid-cols-2 gap-2.5 p-3" style={{ listStyle: 'none', margin: 0 }}>
                                            {pagedMembers.map((m) => (
                                                <li
                                                    key={m}
                                                    className="member-chip"
                                                    data-active={selectedMember === m ? 'true' : 'false'}
                                                    onClick={() => handleMemberLogin(m)}
                                                >
                                                    {m}
                                                </li>
                                            ))}
                                        </ul>

                                        {memberTotalPages > 1 && (
                                            <div className="ac-pager">
                                                <button
                                                    type="button"
                                                    onClick={() => setMemberPage((prev) => Math.max(0, prev - 1))}
                                                    disabled={safeMemberPage === 0}
                                                    className="ac-pager-btn"
                                                >
                                                    上一頁
                                                </button>

                                                <span className="ac-pager-label">
                                                    {safeMemberPage + 1} / {memberTotalPages}
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={() => setMemberPage((prev) => Math.min(memberTotalPages - 1, prev + 1))}
                                                    disabled={safeMemberPage >= memberTotalPages - 1}
                                                    className="ac-pager-btn"
                                                >
                                                    下一頁
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <EmptyState
                                        icon={Users}
                                        title="此樓層目前沒有可選成員"
                                        hint="請後台到「成員」分頁新增。"
                                        compact
                                    />
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
                        <div className="max-w-3xl mx-auto w-full animate-pop">
                            <div className="ac-panel ac-empty-panel">
                                <div className="ac-empty-leaf">
                                    <img src={leafIcon} alt="leaf" />
                                </div>
                                <h2 className="ac-empty-title">今日尚未開放點餐</h2>
                                <p className="ac-empty-hint">請等待管理員上架菜單！</p>
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
                                        <React.Fragment key={item.name ?? idx}>
                                            <div
                                                onClick={() => openAddToCartModal(item)}
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
                                    <div className="mt-10 pt-6 border-t-2 border-dashed border-gray-300 w-full animate-pop">
                                        <div className="popular-wrap">
                                            <div className="popular-header">
                                                <span className="ac-pill hot">最多人點 🔥</span>
                                            </div>
                                            <div className="popular-chips">
                                                {mostPopularItems.map((name) => {
                                                    const menuItem = (data.menu.items || []).find(i => {
                                                        const menuName = i.name.trim().toLowerCase();
                                                        const popName = name.trim().toLowerCase();
                                                        if (menuName.replace(/\s/g, '') === popName.replace(/\s/g, '')) return true;
                                                        if (menuName.includes(popName) || popName.includes(menuName)) return true;
                                                        return false;
                                                    });
                                                    return (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            onClick={() => selectedMember && menuItem && openAddToCartModal(menuItem)}
                                                            className="popular-chip"
                                                            disabled={!selectedMember}
                                                        >
                                                            <span>{name}</span>
                                                            {selectedMember && (
                                                                <span className="popular-chip-hint">點我加點 +</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>

                            {/* Closing Time + Countdown — on white card, below the menu (per design spec) */}
                            {closingInfo && (() => {
                                const s = CLOSING_STYLE[closingInfo.level];
                                return (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 16px' }}>
                                        <span
                                            className={s.pulse ? 'animate-status-pulse' : ''}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '6px 16px',
                                                borderRadius: '12px',
                                                fontWeight: 900,
                                                fontSize: '0.92rem',
                                                letterSpacing: '0.04em',
                                                whiteSpace: 'nowrap',
                                                boxShadow: '0 3px 8px rgba(0,0,0,0.08)',
                                                backgroundColor: s.bg,
                                                border: `2px solid ${s.border}`,
                                                color: s.color,
                                            }}
                                        >
                                            <span style={{ whiteSpace: 'nowrap' }}>
                                                {closingInfo.isClosed ? '✕' : '⏰'} 結單 {closingInfo.whenText}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: '0.72rem',
                                                    padding: '2px 8px',
                                                    borderRadius: '9999px',
                                                    background: 'rgba(255,255,255,0.65)',
                                                    border: `1px solid ${s.border}`,
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {closingInfo.remainingText}
                                            </span>
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {selectedMember && (
                        <div ref={currentRoundSectionRef} className="max-w-3xl mx-auto w-full mt-4 animate-pop">
                            <DialogBox title="本輪已點" className="overflow-visible">
                                <div className="p-2 flex flex-col gap-3">
                                    <div className="ac-current-round-tile">
                                        <div className="ac-current-round-tile-name">{selectedMember}</div>
                                    </div>

                                    <div className="flex flex-col gap-2 w-full">
                                        {myTodayOrders.length === 0 && (
                                            <div className="bg-white rounded-xl border border-dashed">
                                                <EmptyState
                                                    icon={UtensilsCrossed}
                                                    title="尚未點餐"
                                                    hint="從下方菜單選一份開始吧！"
                                                    compact
                                                />
                                            </div>
                                        )}

                                        {myTodayOrders.map(order => (
                                            <div key={order.id} className="ac-order-row">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="ac-order-items">
                                                        {order.items.map((i) => {
                                                            const itemName = String(i?.name || '').trim();
                                                            const itemNote = sanitizeNote(i?.note);
                                                            return itemNote ? `${itemName}（${itemNote}）` : itemName;
                                                        }).join('、')}
                                                    </span>
                                                    <span className="ac-order-total">
                                                        ${order.total}
                                                    </span>
                                                </div>

                                                {data?.menu?.posted ? (
                                                    <Button variant="danger" onClick={() => {
                                                        setOrderToDelete(order.id);
                                                        setDeleteModal(true);
                                                    }} className="ac-btn sm">
                                                        取消
                                                    </Button>
                                                ) : (
                                                    <div className="ac-order-closed-tag">
                                                        已結單
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {myTodayOrders.length > 0 && (
                                        <div className="ac-current-round-footer">
                                            <span className="ac-current-round-amount">應繳金額：${myTodayTotal}</span>
                                        </div>
                                    )}
                                </div>
                            </DialogBox>
                        </div>
                    )}

                    {/* Cart Section (Fixed via Portal - v2 Redesign) - responsive */}
                    {selectedMember && data.menu.posted && cart.length > 0 && createPortal(
                        <div style={{
                            position: 'fixed',
                            bottom: isMobileViewport ? 0 : '28px',
                            right: isMobileViewport ? 0 : '22px',
                            left: isMobileViewport ? 0 : 'auto',
                            zIndex: 99999,
                            paddingBottom: isMobileViewport ? 'env(safe-area-inset-bottom)' : 0,
                        }}>
                            <div style={{
                                width: isMobileViewport ? '100%' : '310px',
                                maxWidth: isMobileViewport ? '100%' : '92vw',
                            }} className="animate-pop">
                                <div style={{
                                    borderRadius: isMobileViewport ? '22px 22px 0 0' : '22px',
                                    overflow: 'hidden',
                                    border: '2.5px solid #469cb0',
                                    borderBottom: isMobileViewport ? 'none' : '2.5px solid #469cb0',
                                    boxShadow: '0 16px 48px rgba(70,156,176,0.22), 0 4px 12px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
                                    background: '#FAFAF8',
                                }}>

                                    {/* ── 頭部 ── */}
                                    <div
                                        style={{
                                            background: 'linear-gradient(135deg, #469cb0 0%, #5FCDE4 55%, #8EE0EE 100%)',
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}
                                        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '34px', height: '34px', borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.15)',
                                                border: '1.5px solid rgba(255,255,255,0.3)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.1rem',
                                            }}>🍱</div>
                                            <span style={{ color: '#fff', fontWeight: 900, fontSize: '1rem', letterSpacing: '0.1em' }}>已加餐點</span>
                                            {cart.length > 0 ? (
                                                <span style={{
                                                    background: '#FF6B35', color: '#fff',
                                                    fontSize: '0.72rem', fontWeight: 900,
                                                    minWidth: '22px', height: '22px', borderRadius: '11px',
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    padding: '0 6px',
                                                    boxShadow: '0 2px 8px rgba(255,107,53,0.5)',
                                                }}>{cart.length}</span>
                                            ) : (
                                                <span style={{
                                                    fontSize: '0.68rem', fontWeight: 800,
                                                    padding: '2px 10px', borderRadius: '8px',
                                                    background: 'rgba(255,255,255,0.15)',
                                                    border: '1px solid rgba(255,255,255,0.3)',
                                                    color: 'rgba(255,255,255,0.8)',
                                                    letterSpacing: '0.06em',
                                                }}>空車</span>
                                            )}
                                        </div>
                                        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', letterSpacing: '0.04em' }}>
                                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>$</span>{cartTotal}
                                        </div>
                                    </div>

                                    {/* ── 成員名稱列 ── */}
                                    <div style={{
                                        padding: '8px 14px',
                                        background: 'linear-gradient(180deg, #EAF6FF 0%, #F2FAFF 100%)',
                                        borderBottom: '1.5px solid #B9E3FF',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                                    }}>
                                        <span style={{
                                            padding: '4px 14px', borderRadius: '12px',
                                            background: '#FFF3E0', border: '1.5px solid #F4C86A',
                                            fontWeight: 900, fontSize: '0.95rem', color: '#7C2D12',
                                        }}>{selectedMember}</span>
                                        {myTodayOrders.length > 0 ? (
                                            <span style={{
                                                fontSize: '0.72rem', fontWeight: 900,
                                                padding: '4px 12px', borderRadius: '20px',
                                                background: '#DCFCE7', color: '#166534',
                                                border: '1.5px solid #86EFAC', whiteSpace: 'nowrap',
                                            }}>✓ 已點 {myTodayOrders.length} 筆</span>
                                        ) : (
                                            <span className="animate-status-pulse" style={{
                                                display: 'inline-block',
                                                fontSize: '0.72rem', fontWeight: 900,
                                                padding: '4px 12px', borderRadius: '20px',
                                                background: '#FEF9C3', color: '#92400E',
                                                border: '1.5px solid #FDE68A', whiteSpace: 'nowrap',
                                            }}>尚未點餐</span>
                                        )}
                                    </div>

                                    {/* ── 本輪點餐狀態區 ── */}
                                    <div style={{ padding: '8px 12px', background: '#FAFAF8' }}>
                                        <div style={{
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #469cb0 0%, #5FCDE4 100%)',
                                            padding: '8px 12px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{
                                                    fontWeight: 900, fontSize: '0.82rem',
                                                    padding: '3px 10px', borderRadius: '8px',
                                                    background: 'rgba(255,255,255,0.18)',
                                                    color: '#fff', letterSpacing: '0.04em',
                                                }}>本輪點餐狀態</span>
                                                {myTodayOrders.length > 0 ? (
                                                    <span style={{
                                                        fontSize: '0.7rem', fontWeight: 900,
                                                        padding: '3px 10px', borderRadius: '20px',
                                                        background: '#DCFCE7', color: '#166534',
                                                        border: '1px solid #86EFAC',
                                                    }}>已點過</span>
                                                ) : (
                                                    <span className="animate-status-pulse" style={{
                                                        display: 'inline-block',
                                                        fontSize: '0.7rem', fontWeight: 900,
                                                        padding: '3px 10px', borderRadius: '20px',
                                                        background: '#FEF9C3', color: '#92400E',
                                                        border: '1px solid #FDE68A',
                                                    }}>尚未點餐</span>
                                                )}
                                            </div>
                                            {myTodayOrders.length > 0 && (
                                                <>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 900, marginTop: '4px', color: '#EAF6FF' }}>
                                                        已點 {myTodayOrders.length} 筆，應繳 <span style={{ color: '#FCD34D' }}>${myTodayTotal}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                        {todayOrderSummary.map((stat, idx) => (
                                                            <span key={`${stat.name}_${stat.note || ''}_${idx}`} style={{
                                                                fontSize: '0.68rem', fontWeight: 700,
                                                                padding: '2px 8px', borderRadius: '6px',
                                                                background: 'rgba(255,255,255,0.18)',
                                                                border: '1px solid rgba(255,255,255,0.25)',
                                                                color: '#fff',
                                                            }}>{stat.name}{stat.note ? `（${stat.note}）` : ''} ×{stat.qty}</span>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── 購物車商品列表 ── */}
                                    {cart.length > 0 && (
                                        <div className="animate-slide-up" style={{
                                            padding: '8px 12px',
                                            maxHeight: '38vh', overflowY: 'auto',
                                            background: '#F0F9FC',
                                            borderTop: '1.5px solid #C7E7F0',
                                            display: 'flex', flexDirection: 'column', gap: '6px',
                                        }}>
                                            <div style={{
                                                fontSize: '0.68rem', fontWeight: 800,
                                                color: '#0F766E', background: '#EAF6FF',
                                                border: '1px solid #B9E3FF',
                                                borderRadius: '8px', padding: '4px 10px',
                                            }}>
                                                本次待送出：{cart.length} 項{hasOrderedInCurrentRound ? '（加點）' : ''}
                                            </div>
                                            {cart.map((item, idx) => (
                                                <div key={idx} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '8px 10px', borderRadius: '12px',
                                                    background: '#fff', border: '1.5px solid #C7E7F0',
                                                    boxShadow: '0 1px 4px rgba(70,156,176,0.06)',
                                                }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0F5E6E' }}>{item.name}</span>
                                                        {item.note && (
                                                            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>備註：{item.note}</span>
                                                        )}
                                                        {hasOrderedInCurrentRound && (
                                                            <span style={{
                                                                fontSize: '0.62rem', fontWeight: 800,
                                                                padding: '1px 7px', borderRadius: '4px',
                                                                background: '#FFF3C4', color: '#B45309',
                                                                border: '1px solid #F4D7A2', width: 'fit-content',
                                                            }}>加點</span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#F4A261' }}>${item.price}</span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); removeFromCart(idx); }}
                                                            style={{
                                                                width: '24px', height: '24px', borderRadius: '50%',
                                                                border: '1.5px solid #FCA5A5', background: '#FFF5F5',
                                                                color: '#EF4444', fontSize: '0.65rem', fontWeight: 900,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                cursor: 'pointer', padding: 0,
                                                            }}
                                                        >✕</button>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* 送出按鈕 */}
                                            <Button
                                                onClick={submitOrder}
                                                disabled={closingInfo?.isClosed}
                                                title={closingInfo?.isClosed ? '已過結單時間' : undefined}
                                                className="w-full justify-center py-2 text-lg shadow-md hover:shadow-lg transform active:scale-95 transition-all"
                                                style={closingInfo?.isClosed ? {
                                                    background: '#D1D5DB',
                                                    boxShadow: 'none',
                                                    border: 'none',
                                                    marginTop: '4px',
                                                    cursor: 'not-allowed',
                                                    opacity: 0.75,
                                                } : {
                                                    background: 'linear-gradient(135deg, #D48745 0%, #E8973F 55%, #F4A54A 100%)',
                                                    boxShadow: '0 4px 0 #B06B2A, 0 6px 18px rgba(180,107,42,0.32)',
                                                    border: 'none',
                                                    marginTop: '4px',
                                                }}
                                            >
                                                {closingInfo?.isClosed ? '已截止' : '送出訂單 🚀'}
                                            </Button>
                                        </div>
                                    )}

                                    {/* 空車提示 */}
                                    {cart.length === 0 && (
                                        <div style={{
                                            padding: '10px 14px', textAlign: 'center',
                                            fontSize: '0.78rem', fontWeight: 600,
                                            color: '#94A3B8', background: '#FAFAF8',
                                            borderTop: '1.5px solid #C7E7F0',
                                        }}>
                                            {myTodayOrders.length > 0 ? '想加點？點選菜單即可加入' : '點選菜單上的餐點開始點餐'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

                    <Modal isOpen={showConfirmModal} onClose={() => { if (isSubmittingOrder) return; setShowConfirmModal(false); }}>
                        <div className="flex flex-col items-center gap-4 text-center animate-pop w-full max-w-lg">
                            <div className="ac-icon-ring ac-icon-ring--info">📨</div>
                            <h3 className="text-xl font-black text-ac-brown m-0">確認下單</h3>
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
                                {cartSummary.map(([summaryKey, stat]) => (
                                    <div key={summaryKey} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-b-0">
                                        <span className="font-bold text-ac-brown">{stat.name}{stat.note ? `（${stat.note}）` : ''}</span>
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

                    <Modal isOpen={!!pendingCartItem} onClose={() => { setPendingCartItem(null); setCartItemNote(''); }}>
                        <div className="flex flex-col gap-4 animate-pop w-full max-w-lg">
                            <div className="flex flex-col items-center text-center">
                                <div className="ac-icon-ring ac-icon-ring--bento">🍱</div>
                                <h3 className="text-xl font-black text-ac-brown m-0">加入購物車</h3>
                            </div>
                            <div className="ac-modal-item-preview">
                                <span className="ac-modal-item-name">{pendingCartItem?.name || '-'}</span>
                                <span className="ac-modal-item-price">${pendingCartItem?.price ?? '-'}</span>
                            </div>
                            <div className="w-full">
                                <label htmlFor="cart-note" className="block text-sm font-bold text-ac-brown mb-1">備註（最多15字）</label>
                                <textarea
                                    id="cart-note"
                                    value={cartItemNote}
                                    onChange={(e) => setCartItemNote(String(e.target.value || '').slice(0, 15))}
                                    maxLength={15}
                                    rows={2}
                                    placeholder="例如：飯少、不要辣"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ac-orange"
                                />
                                <div className="text-xs text-gray-500 mt-1 text-right">{cartItemNote.length}/15</div>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <Button variant="secondary" onClick={() => { setPendingCartItem(null); setCartItemNote(''); }}>
                                    取消
                                </Button>
                                <Button onClick={confirmAddToCart}>
                                    確認加入
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    <Modal isOpen={successModal} onClose={() => setSuccessModal(false)}>
                        <div className="flex flex-col items-center gap-3 text-center animate-pop">
                            <div className="ac-icon-ring ac-icon-ring--success">✅</div>
                            <h3 className="text-xl font-black text-ac-brown m-0">已成功下單！</h3>
                            <p className="text-ac-text leading-relaxed text-sm m-0">
                                {successItems
                                    .map((i) => {
                                        const itemName = String(i?.name || '').trim();
                                        const itemNote = sanitizeNote(i?.note);
                                        return itemNote ? `${itemName}（${itemNote}）` : itemName;
                                    })
                                    .join('、')}
                                <br />
                                <span className="font-black text-ac-brown">
                                    共 {successItems.length} 份 · 合計 ${successItems.reduce((s, i) => s + Number(i?.price || 0), 0)}
                                </span>
                            </p>
                            <Button onClick={handleSuccessConfirm} className="w-full justify-center mt-1">
                                看本輪已點
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
                                                openAddToCartModal(randomItem);
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
                        <div className="flex flex-col items-center gap-3 text-center animate-pop">
                            <div className="ac-icon-ring ac-icon-ring--danger">❓</div>
                            <h3 className="text-xl font-black text-ac-brown m-0">確定取消這筆訂單？</h3>
                            <p className="text-ac-text leading-relaxed text-sm m-0">
                                取消後可以再次從菜單下單。
                            </p>
                            <div className="flex gap-3 w-full mt-1">
                                <Button variant="secondary" onClick={() => setDeleteModal(false)} className="flex-1 justify-center">
                                    留著
                                </Button>
                                <Button variant="danger" onClick={confirmDelete} className="flex-1 justify-center">
                                    取消這筆
                                </Button>
                            </div>
                        </div>
                    </Modal>
                </>
            )}

            {/* Scroll to Top Button */}
            {showScrollTop && (
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

