import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { DingProvider } from './context/DingContext';
import Home from './pages/Home';
import Admin from './pages/Admin';

const App = () => {
  return (
    <DingProvider>
      <Router>
        <div className="min-h-screen py-8 px-4 font-sans text-ac-brown">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>

          <div className="text-center mt-12 opacity-50 text-sm font-bold tracking-widest text-ac-green">
            自由543 © 2025
          </div>
        </div>
      </Router>
    </DingProvider>
  );
};

export default App;
