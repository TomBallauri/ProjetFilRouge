import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Moon, Sun, User, LogOut, Zap, Trophy, ShoppingBag, Joystick, CircleDollarSign } from 'lucide-react';
import UserAvatar from './UserAvatar';
import type { EquippedCosmetic } from '../lib/cosmetics';

const fmt = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return n.toLocaleString('fr-FR');
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
    <nav aria-label="Navigation globale" className="hidden md:block sticky top-0 z-10 shadow-sm border-b"
      style={{ background: 'var(--q-chrome)', borderColor: 'var(--q-line)', fontFamily: 'var(--q-font)' }}>
      <div className="flex justify-between items-center px-3 py-2 md:px-6">

        {/* Logo */}
        <Link to="/" className="text-lg md:text-xl font-bold flex items-center gap-1.5 ml-12 md:ml-0 shrink-0"
          style={{ fontFamily: 'var(--q-display)', color: 'var(--q-text)' }}>
          <span className="hidden sm:inline" style={{ color: 'var(--q-accent)' }}>U-</span>
          <span className="hidden sm:inline">Quail</span>
        </Link>

        {/* Droite */}
        <div className="flex items-center gap-2 md:gap-3">

          {user && (
            <div className="flex items-center gap-2">
              {/* Coins pill */}
              <Link to="/shop" title="Boutique"
                className="q-press flex items-center gap-1 px-2.5 py-1.5 rounded-full font-bold text-xs transition-opacity hover:opacity-80"
                style={{ background: 'linear-gradient(135deg, #FACC15, #FB923C)', color: '#fff',
                  boxShadow: '0 4px 12px -2px rgba(251,146,60,0.45)' }}>
                <ShoppingBag size={12} className="hidden sm:block shrink-0" aria-hidden="true" />
                <CircleDollarSign size={12} aria-hidden="true" /> <span className="whitespace-nowrap">{(user.coins ?? 0).toLocaleString('fr-FR')}</span>
              </Link>

              {/* Niveau + XP — mini vibrant hero card */}
              <Link to="/leaderboard"
                title={`${xpInLevel} / 1000 XP — encore ${xpToNext} XP pour le niveau ${(user.level ?? 1) + 1}`}
                className="q-press flex flex-col justify-center gap-0.5 px-2.5 py-1.5 rounded-xl font-bold text-xs transition-opacity hover:opacity-80 min-w-[58px] relative overflow-hidden"
                style={{ background: 'var(--q-vibrant-hero)', color: '#fff',
                  boxShadow: '0 4px 12px -2px rgba(124,58,237,0.45)' }}>
                <span className="flex items-center gap-1 leading-none relative z-10">
                  <Zap size={11} aria-hidden="true" />
                  Niv.{user.level ?? 1}
                </span>
                <div className="w-full h-1 rounded-full relative z-10" style={{ background: 'rgba(255,255,255,0.30)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${xpPercent}%`, background: 'rgba(255,255,255,0.90)' }} />
                </div>
              </Link>
            </div>
          )}

          {/* Dark mode toggle — white pill with colored icon */}
          <button onClick={toggleDarkMode}
            className="q-press flex items-center justify-center w-8 h-8 rounded-full transition-opacity hover:opacity-80"
            style={{ background: 'var(--q-chrome)', boxShadow: 'var(--q-shadow)', color: darkMode ? '#FACC15' : '#A78BFA',
              border: '1px solid var(--q-line)' }}
            aria-label="Changer le thème">
            {darkMode ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          </button>

          {/* Avatar / menu profil */}
          <div className="relative" ref={dropdownRef}>
            <button className="q-press flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
              data-tour="nav-avatar"
              onClick={() => setDropdownOpen(o => !o)} aria-label="Profil" aria-expanded={dropdownOpen} aria-haspopup="menu">
              {user ? (
                <UserAvatar avatar={user.avatar} username={user.username ?? ''} cosmetics={navCosmetics} size="sm" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }}>
                  <User size={16} aria-hidden="true" />
                </div>
              )}
            </button>

            {dropdownOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-52 rounded-2xl shadow-2xl py-1 z-30 overflow-hidden"
                style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>

                {user ? (
                  <>
                    {/* Hero mini-card at top */}
                    <div className="mx-2 mb-1 rounded-xl px-3 py-2.5 relative overflow-hidden"
                      style={{ background: 'var(--q-vibrant-hero)' }}>
                      <div className="absolute right-0 top-0 w-16 h-16 rounded-full translate-x-4 -translate-y-4"
                        style={{ background: 'rgba(255,255,255,0.18)' }} />
                      <p className="font-bold text-sm text-white truncate relative z-10">{user.username}</p>
                      <p className="text-xs text-white/70 truncate relative z-10">{user.email}</p>
                      <div className="flex gap-2 mt-1 text-xs font-bold text-white/90 relative z-10">
                        <span className="flex items-center gap-1"><CircleDollarSign size={11} aria-hidden="true" /> {(user.coins ?? 0).toLocaleString('fr-FR')}</span>
                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>·</span>
                        <span>Niv. {user.level ?? 1}</span>
                      </div>
                    </div>

                    <Link to="/challenges" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
                      style={{ color: 'var(--q-text)' }}>
                      <Trophy size={15} className="text-yellow-500" aria-hidden="true" /> Mes défis
                    </Link>
                    <Link to="/shop" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
                      style={{ color: 'var(--q-text)' }}>
                      <ShoppingBag size={15} className="text-pink-500" aria-hidden="true" /> Boutique
                    </Link>
                    <Link to="/profile" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
                      style={{ color: 'var(--q-text)' }}>
                      <User size={15} className="text-violet-500" aria-hidden="true" /> Profil
                    </Link>
                    <div className="mx-3 my-1 h-px" style={{ background: 'var(--q-line)' }} />
                    <button
                      onClick={() => { setUser(null); localStorage.removeItem('token'); setDropdownOpen(false); globalThis.location.reload(); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <LogOut size={15} aria-hidden="true" /> Déconnexion
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors hover:opacity-80"
                      style={{ color: 'var(--q-accent)' }}>
                      Se connecter
                    </Link>
                    <Link to="/register" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors hover:opacity-80"
                      style={{ color: 'var(--q-accent)' }}>
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
