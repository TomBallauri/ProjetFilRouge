import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { usePageTitle } from '../hooks/usePageTitle';
import { useNavigate, Link } from 'react-router-dom';
import {
  Flame, Zap, ChevronRight, Sparkles, Trophy, ShoppingBag,
  Gamepad2, Activity, Music, Palette, BookOpen,
  UtensilsCrossed, MessageSquare, Bell, CircleDollarSign,
  Dumbbell, Users, Leaf, Heart, Wrench, LayoutGrid,
} from 'lucide-react';
import UserAvatar from '../components/UserAvatar';
import type { EquippedCosmetic } from '../lib/cosmetics';

// ── types ──────────────────────────────────────────────────────────────────

type UserChallenge = {
  id: number;
  challengeId: number;
  status: string;
  startedAt: string;
  completedAt?: string;
  challenge: {
    title: string;
    category: string;
    difficulty: string;
    coinReward: number;
    xpReward: number;
  };
};

type Topic = { id: number; title: string; category?: string; createdAt?: string };

// ── helpers ────────────────────────────────────────────────────────────────

function getLevelTitle(level: number): string {
  if (level < 3)  return 'Novice';
  if (level < 7)  return 'Apprenti';
  if (level < 12) return 'Disciple';
  if (level < 18) return 'Expert';
  if (level < 25) return 'Vétéran';
  return 'Maître';
}

const fmt = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return n.toLocaleString();
};

const daysSince = (dateStr: string): number =>
  Math.max(1, Math.ceil((Date.now() - new Date(dateStr).getTime()) / 86_400_000));

// ── design tokens (gradients) ───────────────────────────────────────────────

const GRAD: Record<string, string> = {
  lavender: 'linear-gradient(135deg,#A78BFA,#EC4899)',
  mint:     'linear-gradient(135deg,#34D399,#38BDF8)',
  peach:    'linear-gradient(135deg,#FACC15,#FB923C,#EC4899)',
  sky:      'linear-gradient(135deg,#38BDF8,#A78BFA)',
  butter:   'linear-gradient(135deg,#FACC15,#FB923C)',
  rose:     'linear-gradient(135deg,#EC4899,#A78BFA)',
};

const GLOW: Record<string, string> = {
  lavender: 'rgba(167,139,250,0.55)', mint:   'rgba(52,211,153,0.55)',
  peach:    'rgba(251,146,60,0.55)',  sky:    'rgba(56,189,248,0.55)',
  butter:   'rgba(250,204,21,0.55)',  rose:   'rgba(236,72,153,0.55)',
};

// ── Category metadata ───────────────────────────────────────────────────────

type CatMeta = { grad: string; glow: string; icon: React.ReactNode; label: string };

const CAT_META: Record<string, CatMeta> = {
  GAMING:     { grad: GRAD.sky,      glow: GLOW.sky,      icon: <Gamepad2 size={22} />,        label: 'Gaming' },
  SPORT:      { grad: GRAD.mint,     glow: GLOW.mint,     icon: <Activity size={22} />,         label: 'Sport' },
  CUISINE:    { grad: GRAD.peach,    glow: GLOW.peach,    icon: <UtensilsCrossed size={22} />,  label: 'Cuisine' },
  FITNESS:    { grad: GRAD.sky,      glow: GLOW.sky,      icon: <Dumbbell size={22} />,         label: 'Fitness' },
  CREATIVITY: { grad: GRAD.rose,     glow: GLOW.rose,     icon: <Palette size={22} />,          label: 'Créativité' },
  KNOWLEDGE:  { grad: GRAD.sky,      glow: GLOW.sky,      icon: <BookOpen size={22} />,         label: 'Savoir' },
  SOCIAL:     { grad: GRAD.butter,   glow: GLOW.butter,   icon: <Users size={22} />,            label: 'Social' },
  NATURE:     { grad: 'linear-gradient(135deg,#4ADE80,#16A34A)', glow: 'rgba(74,222,128,0.5)',  icon: <Leaf size={22} />,   label: 'Nature' },
  MUSIC:      { grad: GRAD.rose,     glow: GLOW.rose,     icon: <Music size={22} />,            label: 'Musique' },
  WELLNESS:   { grad: GRAD.mint,     glow: GLOW.mint,     icon: <Heart size={22} />,            label: 'Bien-être' },
  DIY:        { grad: GRAD.peach,    glow: GLOW.peach,    icon: <Wrench size={22} />,           label: 'DIY' },
  OTHERS:     { grad: GRAD.lavender, glow: GLOW.lavender, icon: <LayoutGrid size={22} />,       label: 'Autres' },
};
const DEFAULT_CAT: CatMeta = { grad: GRAD.lavender, glow: GLOW.lavender, icon: <Trophy size={22} />, label: 'Défi' };

// ── Sub-components ─────────────────────────────────────────────────────────

type XpRingProps = Readonly<{
  value: number; size: number; stroke: number;
  color: string; trackColor: string; children?: React.ReactNode;
}>;
const XpRing: React.FC<XpRingProps> = ({ value, size, stroke, color, trackColor, children }) => {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const off = C * (1 - Math.max(0, Math.min(1, value)));
  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true" focusable="false">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={C} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.3,1.2,.3,1)' }} />
      </svg>
      {children && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      )}
    </div>
  );
};

type IconTileProps = Readonly<{ cat: string; size?: number }>;
const IconTile: React.FC<IconTileProps> = ({ cat, size = 50 }) => {
  const meta = CAT_META[cat] ?? DEFAULT_CAT;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      background: meta.grad, color: '#fff',
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 6px 14px -4px ${meta.glow}`,
      flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', right: -8, top: -8, width: size * 0.55, height: size * 0.55,
        borderRadius: '50%', background: 'rgba(255,255,255,0.20)' }} />
      <div style={{ position: 'relative' }} aria-hidden="true">{meta.icon}</div>
    </div>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────

const GameForum: React.FC = () => {
  usePageTitle('Accueil');
  const { user, darkMode } = useStore();
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<UserChallenge[]>([]);
  const [recentTopics, setRecentTopics] = useState<Topic[]>([]);
  const [homeCosmetics, setHomeCosmetics] = useState<EquippedCosmetic[]>([]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/users/me/challenges', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => setChallenges(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
    fetch('/api/topics?limit=6&sort=desc')
      .then(r => r.json())
      .then(data => setRecentTopics(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user?.id) { setHomeCosmetics([]); return; }
    fetch(`/api/users/${user.id}/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.cosmetics) setHomeCosmetics(data.cosmetics); })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => {
      fetch(`/api/users/${user.id}/profile`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.cosmetics) setHomeCosmetics(data.cosmetics); })
        .catch(() => {});
    };
    globalThis.addEventListener('cosmetics-updated', refresh);
    return () => globalThis.removeEventListener('cosmetics-updated', refresh);
  }, [user?.id]);

  // ── Not logged in ──────────────────────────────────────────────────────

  if (!user) {
    return (
      <div style={{ color: 'var(--q-text)', fontFamily: 'var(--q-font)' }}>
        {/* Hero gradient card */}
        <div className="rounded-3xl p-6 md:p-10 mb-5 relative overflow-hidden"
          style={{ background: 'var(--q-vibrant-hero)',
            boxShadow: '0 14px 32px -10px rgba(124,58,237,0.45)',
            }}>
          <div className="absolute right-[-40px] top-[-40px] w-56 h-56 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div className="absolute left-[-20px] bottom-[-30px] w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
          <div className="relative z-10">
            <p className="text-xs font-bold text-white/80 uppercase tracking-widest mb-3">ChallengeHub</p>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4"
              style={{ fontFamily: 'var(--q-display)', letterSpacing: -0.5, lineHeight: 1.08 }}>
              Relevez des défis,<br />évoluez ensemble.
            </h1>
            <p className="text-white/80 text-sm md:text-base mb-6 max-w-lg leading-relaxed">
              Rejoignez la communauté, complétez des défis, gagnez des récompenses et grimpez dans le classement.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register"
                className="q-press px-6 py-3 rounded-2xl text-sm font-bold"
                style={{ background: '#fff', color: '#7C3AED' }}>
                S'inscrire gratuitement
              </Link>
              <Link to="/login"
                className="q-press px-6 py-3 rounded-2xl text-sm font-bold text-white"
                style={{ background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.40)' }}>
                Se connecter
              </Link>
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { grad: GRAD.lavender, glow: GLOW.lavender, icon: <Trophy size={20} aria-hidden="true" />, title: 'Défis variés', desc: 'Gaming, sport, musique, science — des centaines de défis pour tous les goûts.' },
            { grad: GRAD.butter,   glow: GLOW.butter,   icon: <Zap size={20} aria-hidden="true" />,    title: 'Montez de niveau', desc: 'Progressez, gagnez de l\'XP et débloquez des cosmétiques exclusifs.' },
            { grad: GRAD.mint,     glow: GLOW.mint,     icon: <ShoppingBag size={20} aria-hidden="true" />, title: 'Boutique', desc: 'Dépensez vos coins pour personnaliser votre profil avec des cadres et titres rares.' },
          ].map(({ grad, glow, icon, title, desc }) => (
            <div key={title} className="rounded-3xl p-5 relative overflow-hidden"
              style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 text-white"
                style={{ background: grad, boxShadow: `0 4px 12px -2px ${glow}` }}>
                {icon}
              </div>
              <h3 className="font-bold text-base mb-1" style={{ color: 'var(--q-text)' }}>{title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--q-text2)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Logged in ──────────────────────────────────────────────────────────

  const xpInLevel  = (user.xp ?? 0) % 1000;
  const xpPercent  = xpInLevel / 1000;
  const inProgress = challenges.filter(c => c.status === 'IN_PROGRESS');
  const levelTitle = getLevelTitle(user.level ?? 1);

  return (
    <div style={{ color: 'var(--q-text)', fontFamily: 'var(--q-font)', paddingBottom: 32 }}>

      {/* ── Greeting header ── */}
      <div className="flex items-center justify-between mb-5">
        {/* Left: avatar + name */}
        <div className="flex items-center gap-3">
          <UserAvatar avatar={user.avatar} username={user.username ?? ''} cosmetics={homeCosmetics} size="md" />
          <div>
            <div style={{ fontSize: 13, color: 'var(--q-text2)', fontWeight: 500 }}>Bonjour,</div>
            <div style={{ fontSize: 20, fontFamily: 'var(--q-display)', color: 'var(--q-text)', letterSpacing: -0.2, lineHeight: 1.1 }}>
              {user.username}
            </div>
          </div>
        </div>
        {/* Right: coins pill + bell */}
        <div className="flex items-center gap-2">
          <Link to="/shop" style={{ display: 'flex', alignItems: 'center', gap: 6,
            background: darkMode ? '#765c13' : '#fff1b8',
            color: darkMode ? '#fef3c7' : '#5c3e10',
            padding: '7px 12px', borderRadius: 999, fontWeight: 700, fontSize: 13,
            fontVariantNumeric: 'tabular-nums', textDecoration: 'none' }}>
            <CircleDollarSign size={14} aria-hidden="true" /> {fmt(user.coins ?? 0)}
          </Link>
          <button className="q-press" aria-label="Notifications" style={{
            width: 40, height: 40, borderRadius: 20, flexShrink: 0,
            border: '1px solid rgba(250,204,21,0.35)',
            background: 'var(--q-chrome)', color: '#CA8A04',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px -2px rgba(250,204,21,0.35)',
            cursor: 'pointer',
          }}>
            <Bell size={18} color="#CA8A04" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Hero XP card ── */}
      <div className="rounded-3xl p-5 mb-5 relative overflow-hidden"
        style={{ background: 'var(--q-vibrant-hero)',
          boxShadow: '0 14px 32px -10px rgba(124,58,237,0.45)',
          }}>
        <div className="absolute right-[-30px] top-[-30px] w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        <div className="flex items-start justify-between relative z-10">
          <div className="flex-1 pr-3">
            <div className="text-xs font-bold uppercase tracking-widest opacity-90 mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Niveau {user.level ?? 1} · {levelTitle}
            </div>
            <div className="text-xl md:text-2xl font-bold text-white"
              style={{ fontFamily: 'var(--q-display)', letterSpacing: -0.3, lineHeight: 1.15 }}>
              Encore {1000 - xpInLevel} XP<br />pour le niveau {(user.level ?? 1) + 1}
            </div>
          </div>
          <div role="img" aria-label={`Progression : ${Math.round(xpPercent * 100)}% vers le niveau ${(user.level ?? 1) + 1}`}>
            <XpRing value={xpPercent} size={54} stroke={5} color="#fff" trackColor="rgba(255,255,255,0.25)">
              <div className="text-xs font-bold text-white" aria-hidden="true">{Math.round(xpPercent * 100)}%</div>
            </XpRing>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 relative z-10">
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.25)' }}>
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${xpPercent * 100}%`, background: 'rgba(255,255,255,0.90)',
               }} />
          </div>
        </div>
        {/* Stats row */}
        <div className="flex gap-5 mt-3 text-xs font-medium relative z-10" style={{ color: 'rgba(255,255,255,0.85)' }}>
          <span className="flex items-center gap-1.5">
            <Flame size={13} style={{ color: '#FFE57C' }} aria-hidden="true" />
            <b className="text-white">{inProgress.length}</b> défi{inProgress.length === 1 ? '' : 's'} en cours
          </span>
          <span className="flex items-center gap-1.5">
            <Zap size={13} style={{ color: '#FFE57C' }} aria-hidden="true" />
            <b className="text-white">{xpInLevel}</b> XP ce niveau
          </span>
        </div>
      </div>

      {/* ── Ta journée ── */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-bold"
          style={{ fontFamily: 'var(--q-display)', letterSpacing: -0.3, color: 'var(--q-text)' }}>
          Ta journée
        </h2>
        {inProgress.length > 0 && (
          <Link to="/challenges" className="text-xs font-semibold hover:underline" style={{ color: 'var(--q-accent)' }}>
            Voir tout
          </Link>
        )}
      </div>

      {inProgress.length === 0 ? (
        <button onClick={() => navigate('/challenges')}
          className="q-press w-full rounded-3xl flex items-center gap-4 p-4 mb-5 text-left"
          style={{ background: 'var(--q-chrome)', border: '1px dashed var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', boxShadow: '0 6px 14px -4px rgba(167,139,250,0.5)' }}>
            <Trophy size={22} className="text-white" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--q-text)' }}>
              Aucun défi en cours
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--q-text2)' }}>
              Commence un défi dès maintenant !
            </p>
          </div>
          <ChevronRight size={16} className="ml-auto flex-shrink-0" style={{ color: 'var(--q-text3)' }} aria-hidden="true" />
        </button>
      ) : (
        <div className="flex flex-col gap-3 mb-5">
          {inProgress.slice(0, 3).map((uc, i) => {
            const meta = CAT_META[uc.challenge.category] ?? DEFAULT_CAT;
            const day = daysSince(uc.startedAt);
            const total = 30;
            const progress = Math.min(1, day / total);
            return (
              <button key={uc.id} onClick={() => navigate('/challenges')}
                aria-label={`Voir le défi : ${uc.challenge.title}`}
                className="q-press rounded-3xl w-full text-left flex gap-3 items-center p-3.5"
                style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)',
                  animationDelay: `${i * 70}ms`, cursor: 'pointer' }}>
                <IconTile cat={uc.challenge.category} size={50} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white px-2.5 py-0.5 rounded-full uppercase tracking-wide"
                      style={{ background: meta.grad, boxShadow: `0 3px 10px -2px ${meta.glow}` }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff',
                        boxShadow: '0 0 4px rgba(255,255,255,0.7)', flexShrink: 0, display: 'inline-block' }} />
                      {meta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#FFDDC2', color: '#D46B0F', border: '1px solid #FFDDC2' }}>
                      <Flame size={10} style={{ color: '#D46B0F' }} aria-hidden="true" /> {day}j
                    </span>
                  </div>
                  <div className="text-sm font-bold mb-1.5 truncate" style={{ color: 'var(--q-text)', letterSpacing: -0.1 }}>
                    {uc.challenge.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(42,42,51,0.08)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${progress * 100}%`, background: meta.grad }} />
                    </div>
                    <span className="text-[11px] font-semibold flex-shrink-0 tabular-nums" style={{ color: 'var(--q-text2)' }}>
                      J{day}/{total}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--q-text3)', flexShrink: 0 }} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      {/* ── Quick nav cards — desktop only (mobile has bottom tab bar) ── */}
      <div className="hidden md:block">
      {inProgress.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { to: '/challenges', grad: GRAD.lavender, glow: GLOW.lavender, icon: <Trophy size={18} aria-hidden="true" />, label: 'Défis' },
            { to: '/leaderboard', grad: GRAD.butter, glow: GLOW.butter, icon: <Zap size={18} aria-hidden="true" />, label: 'Classement' },
            { to: '/shop', grad: GRAD.mint, glow: GLOW.mint, icon: <ShoppingBag size={18} aria-hidden="true" />, label: 'Boutique' },
          ].map(({ to, grad, glow, icon, label }) => (
            <Link key={to} to={to}
              className="q-press rounded-2xl p-3 flex flex-col items-center gap-1.5 transition-opacity hover:opacity-90"
              style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                style={{ background: grad, boxShadow: `0 4px 10px -2px ${glow}` }}>
                {icon}
              </div>
              <span className="text-xs font-bold" style={{ color: 'var(--q-text)' }}>{label}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {[
            { to: '/challenges', grad: GRAD.lavender, glow: GLOW.lavender, icon: <Trophy size={20} aria-hidden="true" />, label: 'Découvrir les défis', sub: 'Relever un nouveau challenge' },
            { to: '/leaderboard', grad: GRAD.butter, glow: GLOW.butter, icon: <Zap size={20} aria-hidden="true" />, label: 'Classement', sub: 'Voir les meilleurs joueurs' },
            { to: '/shop', grad: GRAD.mint, glow: GLOW.mint, icon: <ShoppingBag size={20} aria-hidden="true" />, label: 'Boutique', sub: 'Dépenser tes coins' },
          ].map(({ to, grad, glow, icon, label, sub }) => (
            <Link key={to} to={to}
              className="q-press rounded-3xl p-4 flex items-center gap-3 transition-opacity hover:opacity-90"
              style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: grad, boxShadow: `0 4px 12px -2px ${glow}` }}>
                {icon}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate" style={{ color: 'var(--q-text)' }}>{label}</div>
                <div className="text-xs truncate" style={{ color: 'var(--q-text2)' }}>{sub}</div>
              </div>
              <ChevronRight size={15} style={{ color: 'var(--q-text3)', flexShrink: 0, marginLeft: 'auto' }} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
      </div>

      {/* ── Suggestion du jour ── */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-bold"
          style={{ fontFamily: 'var(--q-display)', letterSpacing: -0.3, color: 'var(--q-text)' }}>
          Suggestion du jour
        </h2>
      </div>
      <div className="rounded-3xl p-4 mb-5 flex gap-3 items-center relative overflow-hidden"
        style={{ background: 'var(--q-vibrant-lavender)',
          boxShadow: '0 14px 32px -10px rgba(167,139,250,0.55)',
          }}>
        <div className="absolute right-[-28px] bottom-[-30px] w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        <div className="absolute right-8 top-[-20px] w-16 h-16 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
          style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 8px rgba(124,58,237,0.25)' }}>
          <Sparkles size={22} style={{ color: '#7C3AED' }} aria-hidden="true" />
        </div>
        <div className="flex-1 relative z-10">
          <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Défi recommandé
          </div>
          <Link to="/challenges" className="text-sm font-semibold text-white leading-snug hover:underline">
            Explore un nouveau défi aujourd'hui — monte en niveau plus vite !
          </Link>
        </div>
      </div>

      {/* ── Recent topics ── */}
      {recentTopics.length > 0 && (
        <>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl font-bold"
              style={{ fontFamily: 'var(--q-display)', letterSpacing: -0.3, color: 'var(--q-text)' }}>
              Activité récente
            </h2>
            <Link to="/discussions" className="text-xs font-semibold hover:underline" style={{ color: 'var(--q-accent)' }}>
              Voir tout
            </Link>
          </div>
          <div className="rounded-3xl overflow-hidden"
            style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
            {recentTopics.slice(0, 4).map((topic, i) => (
              <button key={topic.id} onClick={() => navigate(`/tchat/${topic.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-opacity hover:opacity-80"
                style={{ borderTop: i > 0 ? '1px solid var(--q-line)' : 'none', background: 'transparent' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }}>
                  <MessageSquare size={15} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--q-text)' }}>{topic.title}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--q-text3)' }}>
                    {topic.createdAt
                      ? new Date(topic.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                      : ''}
                    {topic.category ? ` · ${topic.category}` : ''}
                  </p>
                </div>
                <ChevronRight size={15} style={{ color: 'var(--q-text3)', flexShrink: 0 }} aria-hidden="true" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default GameForum;
