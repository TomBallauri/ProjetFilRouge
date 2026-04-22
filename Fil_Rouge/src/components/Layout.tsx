import React from 'react';
import { Outlet } from 'react-router-dom';
import { useStore } from '../lib/store';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Footer: React.FC = () => (
  <footer className="w-full text-center py-4 bg-white/80 dark:bg-gray-900/80 mt-8 shadow">
    © {new Date().getFullYear()} Fil Rouge. Tous droits réservés.
  </footer>
);

const Layout: React.FC = () => {
  const { darkMode } = useStore();

  return (
    <div className={`min-h-screen flex flex-col bg-cover bg-center bg-[url(./assets/bg-white.jpg)] ${darkMode ? 'bg-[url(./assets/bg.jpg)]' : 'bg-gray-50'}`}>
      <Navbar />
      <div className="min-h-screen flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;