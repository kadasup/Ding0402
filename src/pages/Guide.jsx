import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp } from 'lucide-react';
import imgUserOrder from '../assets/guide/guide-user-order.png';
import imgUserHistory from '../assets/guide/guide-user-history.png';
import imgAdminPublish from '../assets/guide/guide-admin-publish.png';
import imgAdminProgress from '../assets/guide/guide-admin-progress.png';
import imgAdminClear from '../assets/guide/guide-admin-clear.png';

const Guide = () => {
  const navigate = useNavigate();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="ac-panel flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black tracking-widest text-ac-brown">
          系統操作說明
        </h1>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-ac-gray-200 text-ac-brown font-bold rounded-lg hover:bg-ac-gray-300 transition-colors"
        >
          返回首頁
        </button>
      </div>

      {/* General User Section */}
      <div className="ac-panel mb-8">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-ac-gray-200">
          <span className="text-3xl">🧑‍💻</span>
          <h2 className="text-xl font-black text-ac-green tracking-widest">一般使用者</h2>
        </div>

        <div className="space-y-6">
          <div className="ac-card p-4 bg-ac-gray-100 rounded-xl">
            <h3 className="text-lg font-bold text-ac-brown mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-ac-green text-white flex items-center justify-center text-sm">1</span>
              <span>如何點餐？</span>
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>於首頁查看「今日菜單」。</li>
              <li>點擊您想吃的餐點，選擇「您的名字」即可完成點餐。</li>
              <li>若需取消或修改，點擊自己的名字即可取消該筆選擇，再重新點選即可。</li>
            </ul>
            <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img src={imgUserOrder} alt="如何點餐截圖" className="w-full h-auto object-cover" />
            </div>
          </div>

          <div className="ac-card p-4 bg-ac-gray-100 rounded-xl">
            <h3 className="text-lg font-bold text-ac-brown mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-ac-green text-white flex items-center justify-center text-sm">2</span>
              <span>如何查看點餐紀錄？</span>
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>點餐完成後，紀錄會即時更新於「今日點餐狀況」區塊。</li>
              <li>即使管理員關閉或下架菜單，您依然可以在首頁下方查看今日您已點的歷史紀錄，方便核對。</li>
            </ul>
            <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img src={imgUserHistory} alt="如何查看點餐紀錄截圖" className="w-full h-auto object-cover" />
            </div>
          </div>
        </div>
      </div>

      {/* Admin Section */}
      <div className="ac-panel mb-8">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-ac-gray-200">
          <span className="text-3xl">👑</span>
          <h2 className="text-xl font-black text-ac-red tracking-widest">管理人員 (<span className="text-sm cursor-pointer" onClick={() => navigate('/admin')}>前往後台</span>)</h2>
        </div>

        <div className="space-y-6">
          <div className="ac-card p-4 bg-ac-gray-100 rounded-xl">
            <h3 className="text-lg font-bold text-ac-brown mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-ac-red text-white flex items-center justify-center text-sm">1</span>
              <span>上架與發布菜單</span>
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>進入後台，可手動新增菜單資訊，或使用「AI菜單辨識」功能上傳菜單圖片自動產生餐點與價格。</li>
              <li>確認餐點資料無誤後，點擊「發布今日菜單」，即可讓一般使用者在首頁開始點餐。</li>
            </ul>
            <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img src={imgAdminPublish} alt="上架與發布菜單截圖" className="w-full h-auto object-cover" />
            </div>
          </div>

          <div className="ac-card p-4 bg-ac-gray-100 rounded-xl">
            <h3 className="text-lg font-bold text-ac-brown mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-ac-red text-white flex items-center justify-center text-sm">2</span>
              <span>管理點餐進度</span>
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>可於後台控制「開放點餐」或「截止點餐」，截止後使用者將無法再進行點餐動作。</li>
              <li>隨時可在後台「今日訂單」區塊檢視所有人的點單詳情，方便向店家叫餐。</li>
            </ul>
            <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img src={imgAdminProgress} alt="管理點餐進度截圖" className="w-full h-auto object-cover" />
            </div>
          </div>

          <div className="ac-card p-4 bg-ac-gray-100 rounded-xl">
            <h3 className="text-lg font-bold text-ac-brown mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-ac-red text-white flex items-center justify-center text-sm">3</span>
              <span>結算與清除資料</span>
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>當日點餐結束或隔日重新開始前，請點擊「清除今日訂單」，將系統還原為未發布狀態。</li>
              <li>資料會與雲端表格 (Google Sheets) 同步，確保歷史紀錄保存無誤。</li>
            </ul>
            <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img src={imgAdminClear} alt="結算與清除資料截圖" className="w-full h-auto object-cover" />
            </div>
          </div>
        </div>
      </div>

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
          title="回到 Top"
          aria-label="回到 Top"
        >
          <ChevronUp size={24} color="white" strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

export default Guide;
