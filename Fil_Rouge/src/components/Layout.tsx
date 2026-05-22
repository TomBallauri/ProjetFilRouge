import React from 'react';
import { Outlet } from 'react-router-dom';
import { useStore } from '../lib/store';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Footer: React.FC = () => {
  const { darkMode } = useStore();
  return (
    <footer className={`w-full text-center py-3 text-xs ${darkMode ? 'bg-gray-900 text-gray-500' : 'bg-gray-50 text-gray-400'} border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
      © {new Date().getFullYear()} ChallengeHub — Tous droits réservés.
    </footer>
  );
};

const Layout: React.FC = () => {
  const { darkMode } = useStore();

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-3 py-4 md:px-6 md:py-6">
            <Outlet />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
