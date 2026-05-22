import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Home, Trophy, MessageSquare, Lock, Menu, X, ShoppingBag, Star } from 'lucide-react';

const Sidebar: React.FC = () => {
  const { darkMode, user } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Ferme le menu mobile à chaque changement de page
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const menuItems = [
    { path: '/',            label: 'Accueil',    icon: <Home size={20} /> },
    { path: '/challenges',  label: 'Défis',      icon: <Trophy size={20} /> },
    { path: '/leaderboard', label: 'Classement', icon: <Star size={20} /> },
    { path: '/shop',        label: 'Boutique',   icon: <ShoppingBag size={20} /> },
    { path: '/discussions', label: 'Discussions', icon: <MessageSquare size={20} /> },
    ...(user?.isAdmin ? [{ path: '/admin', label: 'Dashboard', icon: <Lock size={20} /> }] : []),
  ];

  const inactiveClass = darkMode
    ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

  const navLink = (item: typeof menuItems[0], onClick?: () => void) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl mx-2 font-medium text-sm transition-all
        ${isActive ? 'bg-blue-600 text-white shadow-sm' : inactiveClass}`
      }
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  );

  const sidebarBg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  return (
    <>
      {/* Bouton hamburger — mobile uniquement */}
      <button
        onClick={() => setMobileOpen(true)}
        className={`fixed top-3 left-3 z-40 md:hidden p-2 rounded-lg shadow ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-700'}`}
        aria-label="Ouvrir le menu"
      >
        <Menu size={20} />
      </button>

      {/* Sidebar desktop — toujours visible */}
      <aside className={`hidden md:flex flex-col w-56 shrink-0 border-r ${sidebarBg} sticky top-0 h-screen`}>
        <nav className="flex flex-col gap-1 pt-4 pb-6 flex-1">
          {menuItems.map(item => navLink(item))}
        </nav>
      </aside>

      {/* Overlay mobile */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 bg-black/50 z-40 md:hidden w-full cursor-default"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Drawer mobile */}
      <div className={`fixed top-0 left-0 h-full w-64 z-50 transform transition-transform duration-300 md:hidden flex flex-col
        ${sidebarBg} border-r shadow-xl
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Header drawer */}
        <div className={`flex items-center justify-between px-4 py-3.5 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <span className="font-bold text-base">Menu</span>
          <button onClick={() => setMobileOpen(false)}
            className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            aria-label="Fermer le menu">
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-1 pt-3 pb-6 flex-1 overflow-y-auto">
          {menuItems.map(item => navLink(item, () => setMobileOpen(false)))}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
