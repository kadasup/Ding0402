import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { DingProvider, useDing } from './context/DingContext';

const Home = lazy(() => import('./pages/Home'));
const Admin = lazy(() => import('./pages/Admin'));
const Guide = lazy(() => import('./pages/Guide'));

const GlobalFeedback = () => {
  const { ui } = useDing();
  const toastTypeClass = ui?.toast?.type === 'error' ? 'error' : ui?.toast?.type === 'success' ? 'success' : 'info';

  return (
    <>
      {ui?.pending && (
        <div className="global-loading-mask">
          <div className="global-loading-panel">
            <span className="global-loading-spinner" />
            <span>{ui.statusText || '處理中，請稍候...'}</span>
          </div>
        </div>
      )}

      {ui?.toast && (
        <div className={`global-toast ${toastTypeClass}`} onClick={ui.clearToast}>
          {ui.toast.message}
        </div>
      )}
    </>
  );
};

const AppShell = () => {
  return (
    <Router>
      <div className="min-h-screen py-8 px-4 font-sans text-ac-brown">
        <Suspense
          fallback={
            <div className="ac-panel max-w-md mx-auto text-center">
              <h2 className="text-xl font-black text-ac-brown mb-2">頁面載入中</h2>
              <p className="text-sm text-gray-500">請稍候，我們正在準備內容...</p>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/guide" element={<Guide />} />
          </Routes>
        </Suspense>

        <div className="text-center mt-12 opacity-50 text-sm font-bold tracking-widest text-ac-green">
          自由543 © 2026
        </div>
      </div>
      <GlobalFeedback />
    </Router>
  );
};

const App = () => {
  return (
    <DingProvider>
      <AppShell />
    </DingProvider>
  );
};

export default App;
