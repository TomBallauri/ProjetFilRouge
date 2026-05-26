import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Home, Trophy, MessageSquare, Lock, ShoppingBag, Star, User } from 'lucide-react';

type TabItem = { path: string; label: string; icon: React.ReactNode; end: boolean };

const Sidebar: React.FC = () => {
  const { darkMode, user } = useStore();
  const location = useLocation();

  const menuItems: TabItem[] = [
    { path: '/',            label: 'Accueil',     icon: <Home size={20} />,         end: true },
    { path: '/challenges',  label: 'Défis',       icon: <Trophy size={20} />,       end: false },
    { path: '/leaderboard', label: 'Classement',  icon: <Star size={20} />,         end: false },
    { path: '/shop',        label: 'Boutique',    icon: <ShoppingBag size={20} />,  end: false },
    { path: '/discussions', label: 'Discussions', icon: <MessageSquare size={20} />,end: false },
    ...(user?.isAdmin ? [{ path: '/admin', label: 'Dashboard', icon: <Lock size={20} />, end: false }] : []),
  ];

  const mobileTabs: TabItem[] = [
    { path: '/',            label: 'Accueil',    icon: <Home size={20} />,        end: true },
    { path: '/challenges',  label: 'Défis',      icon: <Trophy size={20} />,      end: false },
    { path: '/discussions', label: 'Communauté', icon: <MessageSquare size={20} />, end: false },
    { path: '/leaderboard', label: 'Classement', icon: <Star size={20} />,        end: false },
    { path: '/profile',     label: 'Profil',     icon: <User size={20} />,        end: false },
  ];

  const isActiveTab = (path: string, end: boolean): boolean =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  const sidebarBg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inactiveClass = darkMode
    ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

  return (
    <>
      {/* ── Desktop sidebar — always visible on md+ ── */}
      <aside className={`hidden md:flex flex-col w-56 shrink-0 border-r ${sidebarBg} sticky top-0 h-screen`}>
        <nav className="flex flex-col gap-1 pt-4 pb-6 flex-1">
          {menuItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl mx-2 font-medium text-sm transition-all
                ${isActive ? 'bg-blue-600 text-white shadow-sm' : inactiveClass}`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ── Mobile bottom tab bar — hidden on md+ ── */}
      <div className="fixed md:hidden z-40" style={{ bottom: 14, left: 12, right: 12 }}>
        <nav style={{
          background: darkMode ? 'rgba(42,43,63,0.92)' : 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: 26, padding: 6,
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          boxShadow: 'var(--q-shadow)',
          border: '1px solid var(--q-line)',
          fontFamily: 'var(--q-font)',
        }}>
          {mobileTabs.map(tab => {
            const active = isActiveTab(tab.path, tab.end);
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end}
                className="q-press"
                style={{
                  flex: 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 2, height: 44, borderRadius: 20, cursor: 'pointer',
                  background: active ? 'var(--q-accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--q-text2)',
                  boxShadow: active
                    ? '0 4px 12px rgba(124,58,237,0.4)'
                    : 'none',
                  textDecoration: 'none',
                }}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.2 }}>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
