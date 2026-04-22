import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Gamepad2, Home, Trophy, MessageSquare, Users, Lock, Menu, X, ChevronLeft, ChevronRight} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { darkMode } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleSidebar = () => setCollapsed(!collapsed);
  const openMobileSidebar = () => setIsMobileOpen(true);
  const closeMobileSidebar = () => setIsMobileOpen(false);

  const { user } = useStore();
  const menuItems = [
    { path: '/', label: 'Accueil', icon: <Home size={20} /> },
    { path: '/discussions', label: 'Discussions', icon: <MessageSquare size={20} /> },
    { path: '/games', label: 'Jeux', icon: <Gamepad2 size={20} /> },
    { path: '/competition', label: 'Compétition', icon: <Trophy size={20} /> },
    { path: '/teams', label: 'Équipes', icon: <Users size={20} /> },
    ...(user?.isAdmin
      ? [{ path: '/admin', label: 'Dashboard', icon: <Lock size={20} /> }]
      : []),
  ];

  return (
    <>

      <aside
        className={`${
          darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
        } ${
          collapsed ? 'w-16' : 'w-64'
        } h-full min-h-screen transition-all duration-300 shadow-md hidden md:block relative`}
      >
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-9 bg-white dark:bg-gray-800 rounded-full p-2 shadow-md border border-gray-200 dark:border-gray-700"
          aria-label={collapsed ? "Ouvrir le menu" : "Fermer le menu"}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        <div className="pt-8 pb-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-r-4 border-blue-500'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    } transition-colors`
                  }
                  onClick={closeMobileSidebar}
                >
                  <span className="mr-3">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={closeMobileSidebar}
        />
      )}
      
      <div
        className={`fixed top-0 left-0 h-full w-64 transform ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 z-50 ${
          darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
        } md:hidden shadow-xl`}
      >
        <button
          onClick={closeMobileSidebar}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          aria-label="Fermer le menu"
        >
          <X size={24} />
        </button>
        <div className="pt-14 pb-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-r-4 border-blue-500'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    } transition-colors`
                  }
                  onClick={closeMobileSidebar}
                >
                  <span className="mr-3">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        onClick={openMobileSidebar}
        className="fixed top-3 z-30 md:hidden p-2 rounded-md "
        aria-label="Ouvrir le menu"
      >
        <Menu size={24} />
      </button>
    </>
  );
};

export default Sidebar;