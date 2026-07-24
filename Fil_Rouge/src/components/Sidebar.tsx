import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { useNotificationPolling, computeBadgeBreakdown } from '../hooks/useNotificationPolling';
import { Home, Trophy, Lock, ShoppingBag, Star, User, Users, Sparkles, Zap, Flame } from 'lucide-react';

type TabItem = { path: string; labelKey: string; icon: React.ReactNode; end: boolean };

type DailyChallenge = {
  id: number;
  title: string;
  difficulty: string;
  category: string;
  coinReward: number;
  xpReward: number;
  dailyBonusMultiplier: number;
};

const DIFF_COLORS: Record<string, string> = {
  EASY:   '#34D399',
  MEDIUM: '#FACC15',
  HARD:   '#FB923C',
  EXPERT: '#EC4899',
};

const DIFF_LABEL_KEYS: Record<string, string> = {
  EASY:   'common.difficulty.easy',
  MEDIUM: 'common.difficulty.medium',
  HARD:   'common.difficulty.hard',
  EXPERT: 'common.difficulty.expert',
};

const DIFF_ICONS: Record<string, typeof Zap> = {
  EASY:   Star,
  MEDIUM: Zap,
  HARD:   Flame,
  EXPERT: Flame,
};

const Sidebar: React.FC = () => {
  const { darkMode, user, notifData } = useStore();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);

  // Lance le polling global des notifications (résultat stocké dans le store)
  useNotificationPolling();

  // Compte par onglet plutôt qu'un total unique : une demande d'ami ne doit pas afficher
  // son badge sur "Défis", et une invitation de série ne doit pas l'afficher sur "Amis".
  const badgeCounts = user && notifData ? computeBadgeBreakdown(notifData, user.id) : { friends: 0, challenges: 0 };
  const badgeCountFor = (path: string): number =>
    path === '/friends' ? badgeCounts.friends : path === '/challenges' ? badgeCounts.challenges : 0;

  useEffect(() => {
    const langParam = i18n.language !== 'fr' ? `?lang=${i18n.language}` : '';
    fetch(`/api/challenges/daily-suggestion${langParam}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setDailyChallenge(data))
      .catch(() => {});
  }, [i18n.language]);

  const menuItems: TabItem[] = [
    { path: '/',            labelKey: 'sidebar.home',        icon: <Home size={20} />,         end: true },
    { path: '/challenges',  labelKey: 'sidebar.challenges',  icon: <Trophy size={20} />,       end: false },
    { path: '/friends',     labelKey: 'sidebar.friends',     icon: <Users size={20} />,        end: false },
    { path: '/leaderboard', labelKey: 'sidebar.leaderboard', icon: <Star size={20} />,         end: false },
    { path: '/shop',        labelKey: 'sidebar.shop',        icon: <ShoppingBag size={20} />,  end: false },
    ...(user?.isAdmin ? [{ path: '/admin', labelKey: 'sidebar.dashboard', icon: <Lock size={20} />, end: false }] : []),
  ];

  const mobileTabs: TabItem[] = [
    { path: '/',           labelKey: 'sidebar.home',       icon: <Home size={20} />,        end: true },
    { path: '/challenges', labelKey: 'sidebar.challenges', icon: <Trophy size={20} />,      end: false },
    { path: '/friends',    labelKey: 'sidebar.friends',    icon: <Users size={20} />,       end: false },
    { path: '/shop',       labelKey: 'sidebar.shop',       icon: <ShoppingBag size={20} />, end: false },
    { path: '/profile',    labelKey: 'sidebar.profile',    icon: <User size={20} />,        end: false },
  ];

  const isActiveTab = (path: string, end: boolean): boolean =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  // Points d'ancrage pour le tutoriel de bienvenue (voir OnboardingTour) — desktop et mobile
  // partagent le même id, le composant de tour choisit celui qui est réellement visible.
  const TOUR_IDS: Record<string, string> = {
    '/': 'nav-accueil', '/challenges': 'nav-defis', '/friends': 'nav-amis',
    '/shop': 'nav-boutique', '/profile': 'nav-profil', '/leaderboard': 'nav-classement',
  };

  const sidebarBg = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inactiveClass = darkMode
    ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

  const DiffIcon = DIFF_ICONS[dailyChallenge?.difficulty ?? ''] ?? Star;

  return (
    <>
      {/* ── Desktop sidebar — always visible on md+ ── */}
      <aside className={`hidden md:flex flex-col w-56 shrink-0 border-r ${sidebarBg} sticky top-0 h-screen`}>
        <nav aria-label={t('sidebar.mainNav')} className="flex flex-col gap-1 pt-4 pb-4 flex-1">
          {menuItems.map(item => {
            const badgeCount = badgeCountFor(item.path);
            const hasBadge = badgeCount > 0;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                data-tour={TOUR_IDS[item.path]}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl mx-2 font-medium text-sm transition-all
                  ${isActive ? 'bg-blue-600 text-white shadow-sm' : inactiveClass}`
                }
              >
                <span aria-hidden="true" style={{ position: 'relative', display: 'inline-flex' }}>
                  {item.icon}
                  {hasBadge && (
                    <span style={{
                      position: 'absolute', top: -5, right: -7,
                      minWidth: 16, height: 16, borderRadius: 999,
                      background: '#EF4444', color: '#fff',
                      fontSize: 9, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px', border: '2px solid var(--q-chrome)',
                    }}>{badgeCount > 9 ? '9+' : badgeCount}</span>
                  )}
                </span>
                <span>{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* ── Suggestion du jour ── */}
        {dailyChallenge && (
          <div className="px-2 pb-4">
            <div className={`h-px mb-3 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="flex items-center gap-1.5 px-2 mb-2">
              <Sparkles size={13} style={{ color: 'var(--q-amber-text)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--q-amber-text)' }}>
                {t('sidebar.dailySuggestion')}
              </span>
            </div>
            <NavLink to={`/challenges?daily=${dailyChallenge.id}`} tabIndex={0}>
              <div
                className="rounded-xl p-3 cursor-pointer transition-all"
                style={{
                  background: darkMode
                    ? 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))'
                    : 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                  border: `1px solid ${darkMode ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.4)'}`,
                }}
              >
                <p
                  className="text-sm font-semibold mb-2 leading-snug"
                  style={{
                    color: darkMode ? '#F9FAFB' : '#1F2937',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {dailyChallenge.title}
                </p>

                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold text-gray-900"
                    style={{ background: DIFF_COLORS[dailyChallenge.difficulty] ?? '#94A3B8' }}
                  >
                    <DiffIcon size={10} aria-hidden="true" />
                    {DIFF_LABEL_KEYS[dailyChallenge.difficulty] ? t(DIFF_LABEL_KEYS[dailyChallenge.difficulty]) : dailyChallenge.difficulty}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold bg-amber-400 text-gray-900">
                    <Sparkles size={10} aria-hidden="true" />
                    +50%
                  </span>
                </div>

                <p className="text-xs" style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }}>
                  {t('sidebar.dailyRewards', { coins: dailyChallenge.coinReward, xp: dailyChallenge.xpReward })}
                  <span className="block font-medium" style={{ color: 'var(--q-amber-text)' }}>{t('sidebar.ifDoneToday')}</span>
                </p>
              </div>
            </NavLink>
          </div>
        )}
      </aside>

      {/* ── Mobile bottom tab bar — hidden on md+ ── */}
      <div className="fixed md:hidden z-40" style={{ bottom: 14, left: 12, right: 12 }}>
        <nav aria-label={t('sidebar.mobileNav')} style={{
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
            const badgeCount = badgeCountFor(tab.path);
            const hasBadge = badgeCount > 0;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end}
                data-tour={TOUR_IDS[tab.path]}
                className="q-press"
                style={{
                  flex: 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 2, height: 44, borderRadius: 20, cursor: 'pointer',
                  background: active ? 'var(--q-accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--q-text2)',
                  boxShadow: active ? '0 4px 12px rgba(124,58,237,0.4)' : 'none',
                  textDecoration: 'none', position: 'relative',
                }}
              >
                <span aria-hidden="true" style={{ position: 'relative', display: 'inline-flex' }}>
                  {tab.icon}
                  {hasBadge && (
                    <span style={{
                      position: 'absolute', top: -4, right: -6,
                      minWidth: 15, height: 15, borderRadius: 999,
                      background: '#EF4444', color: '#fff',
                      fontSize: 8, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px',
                    }}>{badgeCount > 9 ? '9+' : badgeCount}</span>
                  )}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.2 }}>{t(tab.labelKey)}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
