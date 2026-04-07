import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDing } from '../context/DingContext';
import { DialogBox, Button, Modal } from '../components/Components';
import { ShoppingBag, History, User, Lock, Coffee, Loader, ChevronDown, ChevronUp, X, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import leafIcon from '../assets/img/leaf.svg';
import bellsIcon from '../assets/img/bells.svg';
import fossilIcon from '../assets/img/fossil.svg';
import presentIcon from '../assets/img/present.svg';
import turnipIcon from '../assets/img/turnip.svg';


const Home = () => {
    const { data, user, actions, getTodayOrders, loading } = useDing();
    const [selectedMember, setSelectedMember] = useState(() => localStorage.getItem('ding_member') || null);

    // 讓重新整理時，若有記憶角色，能同步至全局 context
    useEffect(() => {
        if (selectedMember) {
            actions.loginMember(selectedMember);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Safety check if data is not yet loaded or invalid


    const [cart, setCart] = useState([]);
    const [orders, setOrders] = useState([]);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [successModal, setSuccessModal] = useState(false);
    const [deleteModal, setDeleteModal] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    const [randomItem, setRandomItem] = useState(null);
    const [isRolling, setIsRolling] = useState(false);
    const [showRandomModal, setShowRandomModal] = useState(false);

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

    // Refresh orders on mount
    useEffect(() => {
        if (getTodayOrders) {
            getTodayOrders();
            // Note: getTodayOrders in context returns array, doesn't return promise if not async. 
            // Context definition: getTodayOrders = () => { ... return filtered ... }
            // It is synchronous in current context!
            setOrders(getTodayOrders());
        }
    }, [data.orders]);

    useEffect(() => {
        if (data.menu.image) setImageLoaded(false);
    }, [data.menu.image]);

    const handleMemberLogin = (name) => {
        setSearchTerm('');
        setSelectedMember(name);
        setCart([]); // Clear cart when switching members
        if (name) {
            localStorage.setItem('ding_member', name);
            actions.loginMember(name);
        } else {
            localStorage.removeItem('ding_member');
            actions.loginMember(null);
        }
    };

    const filteredMembers = (data?.members || []).filter(m => String(m || '').toLowerCase().includes(String(searchTerm || '').toLowerCase()));

    const addToCart = (item) => {
        setCart([...cart, item]);
    };

    const removeFromCart = (index) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const executeOrder = () => {
        actions.placeOrder(selectedMember, cart);
        setCart([]);
        setShowConfirmModal(false);
        setTimeout(() => setSuccessModal(true), 200);
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

        // Warn if user already ordered today
        const todayStr = new Date().toISOString().split('T')[0];
        const alreadyOrdered = data.orders.some(o => o.member === selectedMember && String(o.date).startsWith(todayStr));
        if (alreadyOrdered) {
            setShowConfirmModal(true);
            return;
        }

        executeOrder();
    };

    // Safety check: Only show full-page loader if initial data hasn't arrived yet.
    // We check !data.menu.lastUpdated because that is null initially and populated after first fetch.
    const isInitialLoad = loading && (!data.menu || !data.menu.lastUpdated);



    // Filter history for current user (Safe access)
    const myHistory = (data.orders || []).filter(o => o.member === selectedMember);
    const totalSpent = myHistory.reduce((sum, o) => sum + o.total, 0);

    // Filter ONLY today's orders for the "My Today's Orders" section
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMenuId = data.menu.lastUpdated;
    const myTodayOrders = myHistory.filter(o => {
        const isToday = o.date && String(o.date).startsWith(todayStr);
        // 🚀 關鍵強化：不只看日期，還要看這筆單是不是為了「目前這份菜單」點的
        const isForCurrentMenu = String(o.menuId) === String(currentMenuId);
        return isToday && isForCurrentMenu;
    });
    const myTodayTotal = myTodayOrders.reduce((sum, o) => sum + o.total, 0);

    // Calculate Today's Most Popular (Global) - Filtered by current menu items
    const currentMenuItemNames = new Set((data.menu.items || []).map(i => i.name.trim()));
    const allTodayOrders = (data.orders || []).filter(o => o.date && String(o.date).startsWith(todayStr));
    const itemCounts = {};
    allTodayOrders.forEach(order => {
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
        .filter(([_, count]) => count === maxCount && count > 0)
        .map(([name]) => name);
    const isFirstOrderToday = allTodayOrders.length === 0;



    return (
        <div className="flex flex-col gap-4 max-w-4xl mx-auto pb-40">
            {/* Admin Portal Entry (Fixed to avoid overlap) */}
            <Link 
                to="/admin" 
                className="ac-admin-link hover:scale-105 active:scale-95 transition-all"
                style={{ position: 'fixed', top: '24px', right: '24px', left: 'auto', zIndex: 99999, opacity: 0.8 }}
                title="進入後台"
            >
                <Button variant="secondary" className="px-5 py-2.5 rounded-full shadow-lg border-2 border-white flex items-center gap-2">
                    <Lock size={18} /> 
                    <span className="font-bold tracking-widest hidden sm:inline">管理員</span>
                </Button>
            </Link>

            {/* Header / Announcement */}
            <div className="flex flex-col items-center mb-6 relative px-4">
                {/* Integrated Header Signboard */}
                <div className="bg-[#F9E076] px-6 py-3 sm:px-12 sm:py-4 rounded-[2.5rem] sm:rounded-[3rem] transform -rotate-2 border-[4px] sm:border-[6px] border-white shadow-xl z-10 flex items-center gap-3 sm:gap-6 relative max-w-[calc(100vw-2rem)]">

                    {/* Left Leaf */}
                    <img src={leafIcon} className="w-10 h-10 sm:w-14 sm:h-14 animate-bounce shrink-0" alt="leaf" />

                    <div className="flex flex-col items-center leading-none">
                        <h1 className="text-3xl sm:text-5xl font-black text-[#7C6044] tracking-widest drop-shadow-sm -mb-1 sm:-mb-2 whitespace-nowrap">
                            自由543
                        </h1>
                        <span className="text-sm sm:text-xl font-bold text-white tracking-[0.2em] drop-shadow-md">
                            Ding Bento
                        </span>
                    </div>

                    {/* Right Leaf */}
                    <img src={leafIcon} className="w-10 h-10 sm:w-14 sm:h-14 animate-bounce icon-flip shrink-0" alt="leaf" />
                </div>
            </div>

            <div className="max-w-3xl mx-auto w-full">
                <DialogBox title="公佈欄" className="mb-2 bg-ac-panel relative overflow-visible">

                    <div className="p-2 text-center">
                        <span className="inline-block bg-white text-ac-orange px-4 py-1 rounded-full border-2 border-ac-orange font-black text-lg tracking-widest shadow-sm rotate-1">
                            📢 最新公告
                        </span>
                    </div>
                    <div className="p-6 text-center text-xl font-bold text-ac-brown min-h-[60px] flex items-center justify-center whitespace-pre-line">
                        {data.announcement}
                    </div>
                </DialogBox>
            </div>


            {/* Shop Closed / Loading / Store Info Logic */}
            {isInitialLoad ? (
                <div className="max-w-3xl mx-auto w-full">
                    <div className="p-12 text-center opacity-70 bg-white rounded-3xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center min-h-[300px]">
                        <Loader className="animate-spin mb-4 text-ac-green" size={48} />
                        <h2 className="text-xl font-bold text-ac-brown mb-2">菜單努力加載中....</h2>
                        <p className="text-sm text-gray-400">請稍候...</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Shop Closed Message (Shown if not posted) */}
                    {!data.menu.posted && (
                        <div className="max-w-3xl mx-auto w-full">
                            <div className="py-16 text-center bg-white rounded-3xl border-2 border-dashed border-gray-300" style={{ opacity: 0.8 }}>
                                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🍃</div>
                                <h2 className="text-2xl font-black text-ac-brown mb-2" style={{ letterSpacing: '0.1em' }}>菜單尚未上架</h2>
                                <p className="text-gray-400 font-medium">菜單還沒準備好，請稍後再來！</p>
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
                                <div className="bg-[#FFFBEB] p-4 text-center border-b-4 border-ac-brown border-dashed animate-pop">
                                    <div className="inline-block bg-white text-ac-orange px-3 py-1 rounded-full border border-ac-orange font-black text-xs mb-2 shadow-sm">
                                        📢 貼心提醒 / 公告
                                    </div>
                                    <div className="text-ac-brown font-bold text-base leading-relaxed whitespace-pre-line px-4">
                                        {data.menu.remark}
                                    </div>
                                </div>
                            )}

                            {/* Body: Menu List (Simple List) */}

                            <div className="p-6 bg-[#FFF8E7]">
                                <div className="text-center mb-4">
                                    <div className="inline-flex items-center justify-center bg-ac-green text-white px-6 py-1 rounded-full shadow-md hover:scale-105 transition-transform cursor-default">
                                        <span className="font-bold text-lg tracking-widest leading-none pt-[2px]">今日菜單</span>
                                    </div>
                                    {selectedMember && (
                                        <p className="text-sm text-ac-brown mt-2 animate-bounce-subtle">
                                            👇 點擊下方品項即可加入購物車
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
                                
                                {/* Integrated Most Popular Section */}
                                {!isFirstOrderToday && (
                                    <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-300 w-full animate-pop">
                                        <div className="flex justify-center mb-4">
                                            <div className="bg-hot-yellow text-ac-brown px-6 py-1 rounded-full shadow-md border-2 border-white transform -rotate-1">
                                                <span className="font-black text-sm tracking-widest leading-none block whitespace-nowrap">今日最多人點 🔥</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap justify-center gap-4">
                                            {mostPopularItems.map((name) => {
                                                const menuItem = (data.menu.items || []).find(i => {
                                                    const menuName = i.name.trim().toLowerCase().replace(/[抄炒]/g, 'C');
                                                    const popName = name.trim().toLowerCase().replace(/[抄炒]/g, 'C');
                                                    
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
                                                                快速按我 +
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Footer: Closing Time */}
                                {data.menu.closingTime && (
                                    <div className="mt-6 text-center">
                                        <span className="inline-block bg-white border-2 border-red-200 text-red-500 px-4 py-1 rounded-lg font-bold text-sm shadow-sm">
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
                                                } catch (e) {
                                                    return `⏰ 結單時間：${cTime}`;
                                                }
                                            })()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


            {/* Member Selection */}
                    <div className="max-w-3xl mx-auto w-full animate-pop" style={{ animationDelay: '0.1s' }}>
                        <DialogBox title="選擇角色">
                            <div className="flex flex-col items-center gap-4 py-4 relative z-10 w-full">
                                <div className="flex items-center gap-2 w-full max-w-md relative z-50">
                                    <User className="text-ac-green shrink-0" />
                                    <div className="relative w-full">
                                        <input
                                            type="text"
                                            placeholder="-- 搜尋或選擇你的角色 --"
                                            value={selectedMember && !isDropdownOpen ? selectedMember : searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setIsDropdownOpen(true);
                                            }}
                                            onFocus={() => {
                                                setIsDropdownOpen(true);
                                                setSearchTerm('');
                                            }}
                                            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
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
                                                    if (searchTerm) setIsDropdownOpen(true);
                                                }}
                                                className="absolute right-12 top-1/2 -translate-y-1/2 ac-clear-btn z-20"
                                                title="清除內容"
                                            >
                                                <Trash2 size={18} strokeWidth={2.5} />
                                            </button>
                                        )}

                                        {isDropdownOpen && (
                                            <ul className="absolute z-999 w-full mt-1 bg-white border-2 border-ac-green rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden left-0 top-full">
                                                {filteredMembers.length > 0 ? (
                                                    filteredMembers.map(m => (
                                                        <li 
                                                            key={m}
                                                            className={`px-4 py-3 hover:bg-[#FFF8E7] cursor-pointer text-ac-brown font-bold border-b border-gray-100 last:border-0 ${selectedMember === m ? 'bg-[#FFF8E7]' : ''}`}
                                                            onMouseDown={() => {
                                                                handleMemberLogin(m);
                                                                setIsDropdownOpen(false);
                                                            }}
                                                        >
                                                            {m}
                                                        </li>
                                                    ))
                                                ) : (
                                                    <li className="px-4 py-3 text-gray-400 text-center cursor-default">找不到相符的角色</li>
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                </div>

                                {selectedMember && (
                                    <div className="flex flex-col w-full max-w-md gap-2 animate-slide-up relative z-10">
                                        
                                        {/* "What to eat?" Trigger Button */}
                                        {myTodayOrders.length === 0 && (
                                            <div className="mt-4 flex justify-center">
                                                <button 
                                                    onClick={startRandomPick}
                                                    className="inline-flex items-center gap-2 bg-[#FFFBEB] hover:bg-[#F9E076] text-ac-brown px-6 py-2 rounded-full border-2 border-dashed border-[#F9E076] font-bold transition-all hover:scale-105 active:scale-95 group shadow-sm"
                                                >
                                                    <span className="text-xl group-hover:rotate-12 transition-transform animate-pulse" style={{ textShadow: '0 0 10px rgba(249, 224, 118, 0.5)' }}>✨</span>
                                                    <span>不知道今天要吃什麼？</span>
                                                </button>
                                            </div>
                                        )}
                                        {/* Today's Orders & Delete Section */}
                                        {myTodayOrders.length > 0 && (
                                            <div className="bg-[#F0FFF4] p-3 rounded-xl border border-dashed border-ac-green mt-6 relative flex flex-col items-center z-10 shadow-inner">
                                                <div className="bg-white text-ac-brown px-6 py-1 rounded-full shadow-sm mb-4 border-2 border-white transform -rotate-1">
                                                    <span className="font-bold text-sm tracking-widest leading-none pt-[1px] block whitespace-nowrap">今日已點</span>
                                                </div>
                                                <div className="flex flex-col gap-3 w-full px-2">
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
                                                <div className="mt-4 pt-3 border-t-2 border-dashed border-ac-green/30 w-full text-center">
                                                    <div className="text-ac-orange font-black text-xl">
                                                        應繳金額：${myTodayTotal}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </DialogBox>
                    </div>

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
                                                <span className="text-xs text-ac-green bg-white/10 px-2 py-1 rounded-full">空</span>
                                            )}
                                        </div>
                                        <div className="font-bold text-lg tracking-wider">
                                            總計 <span className="text-[#F9E076] text-xl drop-shadow-sm">${cart.reduce((s, i) => s + i.price, 0)}</span>
                                        </div>
                                    </div>

                                    {/* Content (Only show if items exist or user clicks header to expand - keeping simple expanded view for now per request) */}
                                    {cart.length > 0 && (
                                        <div style={{ backgroundColor: '#FFF0F5' }} className="p-2 max-h-[40vh] overflow-y-auto animate-slide-up">
                                            <div className="flex flex-col gap-2">
                                                {cart.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-white/80 border border-dashed border-red-200 p-2 rounded-xl shadow-sm">
                                                        <span className="font-bold text-gray-700 pl-2">{item.name}</span>
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
                                                ))}

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
                                            ( 購物車還是空的喔 )
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}



                    <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)}>
                        <div className="flex flex-col items-center gap-4 text-center animate-pop">
                            <h3 className="text-xl font-bold text-ac-brown">重複點餐確認</h3>
                            <p className="text-ac-text leading-relaxed">
                                哎呀！{selectedMember}，你今天不是已經點過了嗎？<br />
                                確定要再加點嗎？<br />
                            </p>
                            <div className="flex gap-4">
                                <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
                                    再想想
                                </Button>
                                <Button onClick={executeOrder}>
                                    確定加點
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    <Modal isOpen={successModal} onClose={() => setSuccessModal(false)}>
                        <div className="flex flex-col items-center gap-4 text-center animate-pop">
                            <h3 className="text-xl font-bold text-ac-brown">點餐成功！</h3>
                            <div className="text-4xl animate-bounce">🍃</div>
                            <p className="text-ac-text leading-relaxed">
                                您的餐點已送出！<br />
                                請耐心等候美味便當送到喔！
                            </p>
                            <Button onClick={() => setSuccessModal(false)}>
                                太棒了！
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
                                    <div className="text-6xl">✨</div>
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
            {showScrollTop && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="fixed bottom-10 ac-scroll-top hover:scale-110 active:scale-95 transition-all animate-pop z-[99999]"
                    style={{ left: '0', right: '0', margin: '0 auto' }}
                    title="回到頂部"
                >
                    <ChevronUp size={24} color="white" strokeWidth={3} />
                </button>
            )}

        </div>
    );
};

export default Home;
