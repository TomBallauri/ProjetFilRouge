import React from 'react';
import { Outlet } from 'react-router-dom';
import { useStore } from '../lib/store';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Footer: React.FC = () => {
  const { darkMode } = useStore();
  return (
    <footer className={`w-full text-center py-3 text-xs border-t ${darkMode ? 'border-white/5 text-[--q-text3]' : 'border-black/5 text-[--q-text3]'}`}
      style={{ background: 'var(--q-chrome)' }}>
      © {new Date().getFullYear()} ChallengeHub — Tous droits réservés.
    </footer>
  );
};

const Layout: React.FC = () => {
  const { darkMode } = useStore();

  return (
    <div className={`min-h-screen flex flex-col q-bg ${darkMode ? 'dark' : ''}`} style={{ background: 'var(--q-bg)' }}>
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-3 md:px-6 pt-4 md:pt-6 pb-28 md:pb-6">
            <Outlet />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
