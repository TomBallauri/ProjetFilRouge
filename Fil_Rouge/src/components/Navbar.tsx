import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Moon, Sun, User, LogOut, Zap, Trophy, ShoppingBag, Joystick } from 'lucide-react';
import UserAvatar from './UserAvatar';
import type { EquippedCosmetic } from '../lib/cosmetics';

const fmt = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return n.toLocaleString();
};

const Navbar: React.FC = () => {
  const { user, setUser, darkMode, toggleDarkMode } = useStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [navCosmetics, setNavCosmetics] = useState<EquippedCosmetic[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!user?.id) { setNavCosmetics([]); return; }
    fetch(`/api/users/${user.id}/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.cosmetics) setNavCosmetics(data.cosmetics); })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => {
      fetch(`/api/users/${user.id}/profile`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.cosmetics) setNavCosmetics(data.cosmetics); })
        .catch(() => {});
    };
    globalThis.addEventListener('cosmetics-updated', refresh);
    return () => globalThis.removeEventListener('cosmetics-updated', refresh);
  }, [user?.id]);

  const xpInLevel = user ? (user.xp ?? 0) % 1000 : 0;
  const xpPercent = xpInLevel / 10;
  const xpToNext = 1000 - xpInLevel;

  return (
    <nav className={`sticky top-0 z-10 shadow-md ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
      <div className="flex justify-between items-center px-3 py-2.5 md:px-6">

        {/* Logo — ml-12 sur mobile pour dégager le bouton hamburger (fixed left-3) */}
        <Link to="/" className="text-lg md:text-xl font-bold flex items-center gap-1 ml-12 md:ml-0 shrink-0">
          <Joystick size={22} className="shrink-0" />
          <span className="text-blue-500 hidden sm:inline">Game</span>
          <span className="hidden sm:inline">Forum</span>
        </Link>

        {/* Droite */}
        <div className="flex items-center gap-1.5 md:gap-3">

          {/* Coins + Niveau — visible partout, taille adaptée */}
          {user && (
            <div className="flex items-stretch gap-1.5">
              {/* Coins */}
              <Link
                to="/shop"
                className={`flex items-center justify-center gap-1 px-2 md:px-2.5 py-1 rounded-lg text-xs md:text-sm font-bold ${darkMode ? 'bg-yellow-900/40 text-yellow-300 hover:bg-yellow-900/60' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'} transition-colors`}
              >
                <ShoppingBag size={13} className="hidden sm:block shrink-0" />
                🪙 <span>{fmt(user.coins ?? 0)}</span>
              </Link>

              {/* Niveau + barre XP */}
              <Link
                to="/leaderboard"
                title={`${xpInLevel} / 1000 XP — encore ${xpToNext} XP pour le niveau ${(user.level ?? 1) + 1}`}
                className={`flex flex-col justify-center gap-0.5 px-2 md:px-2.5 py-1 rounded-lg text-xs md:text-sm font-bold min-w-[52px] md:min-w-[60px] ${darkMode ? 'bg-purple-900/40 text-purple-300 hover:bg-purple-900/60' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'} transition-colors`}
              >
                <span className="flex items-center gap-1 leading-none">
                  <Zap size={12} />
                  Niv.{user.level ?? 1}
                </span>
                <div className={`w-full h-1 rounded-full ${darkMode ? 'bg-purple-900' : 'bg-purple-200'}`}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-400 transition-all duration-500"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
              </Link>
            </div>
          )}

          {/* Dark mode */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Changer le thème"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Avatar / menu profil */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="flex items-center justify-center rounded-full transition-all"
              onClick={() => setDropdownOpen(o => !o)}
              aria-label="Profil"
            >
              {user ? (
                <UserAvatar avatar={user.avatar} username={user.username ?? ''} cosmetics={navCosmetics} size="sm" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                  <User size={18} />
                </div>
              )}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl shadow-xl border py-1 z-30 overflow-hidden
                bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700">

                {user ? (
                  <>
                    {/* Infos utilisateur en haut du menu */}
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                      <p className="font-bold text-sm truncate">{user.username}</p>
                      <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{user.email}</p>
                      <div className="flex gap-3 mt-1.5 text-xs font-semibold">
                        <span className="text-yellow-600 dark:text-yellow-400">🪙 {(user.coins ?? 0).toLocaleString()}</span>
                        <span className="text-purple-600 dark:text-purple-400">Niv. {user.level ?? 1}</span>
                      </div>
                    </div>

                    <Link to="/challenges" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <Trophy size={15} className="text-yellow-500" /> Mes défis
                    </Link>
                    <Link to="/shop" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <ShoppingBag size={15} className="text-pink-500" /> Boutique
                    </Link>
                    <Link to="/profile" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <User size={15} className="text-blue-500" /> Profil
                    </Link>
                    <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'} mt-1`} />
                    <button
                      onClick={() => { setUser(null); localStorage.removeItem('token'); setDropdownOpen(false); globalThis.location.reload(); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut size={15} /> Déconnexion
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm font-medium">
                      Se connecter
                    </Link>
                    <Link to="/register" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm font-medium">
                      S'inscrire
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
