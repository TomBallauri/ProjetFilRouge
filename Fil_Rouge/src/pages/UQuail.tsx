import React, { useState, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { usePageTitle } from '../hooks/usePageTitle';
import { useNavigate, Link } from 'react-router-dom';
import {
  Flame, Zap, ChevronRight, Sparkles, Trophy, ShoppingBag,
  Gamepad2, Activity, Music, Palette, BookOpen,
  UtensilsCrossed, MessageSquare, Bell, CircleDollarSign,
  Dumbbell, Users, Leaf, Heart, Wrench, LayoutGrid,
  Star, Award, Crown, Moon,
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
    seriesName?: string | null;
  };
};

type PublicChallenge = {
  id: number; title: string; description: string;
  difficulty: string; category: string;
  coinReward: number; xpReward: number;
  _count?: { participants: number };
};

type TopUser = { id: number; username: string; avatar?: string; currentStreak: number; level: number; xp: number; cosmetics: import('../lib/cosmetics').EquippedCosmetic[] };

// ── helpers ────────────────────────────────────────────────────────────────

// Retourne une clé de traduction (voir uquail.levelTitles.*) plutôt que le texte
// directement — cette fonction est appelée hors composant, sans accès à `t`.
function getLevelTitleKey(level: number): string {
  if (level < 3)  return 'uquail.levelTitles.novice';
  if (level < 7)  return 'uquail.levelTitles.apprentice';
  if (level < 12) return 'uquail.levelTitles.disciple';
  if (level < 18) return 'uquail.levelTitles.expert';
  if (level < 25) return 'uquail.levelTitles.veteran';
  return 'uquail.levelTitles.master';
}


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

// ── Category metadata (le libellé vient de common.category.<clé>) ──────────

type CatMeta = { grad: string; glow: string; icon: React.ReactNode };

const CAT_META: Record<string, CatMeta> = {
  GAMING:     { grad: GRAD.sky,      glow: GLOW.sky,      icon: <Gamepad2 size={22} /> },
  SPORT:      { grad: GRAD.mint,     glow: GLOW.mint,     icon: <Activity size={22} /> },
  CUISINE:    { grad: GRAD.peach,    glow: GLOW.peach,    icon: <UtensilsCrossed size={22} /> },
  FITNESS:    { grad: GRAD.sky,      glow: GLOW.sky,      icon: <Dumbbell size={22} /> },
  CREATIVITY: { grad: GRAD.rose,     glow: GLOW.rose,     icon: <Palette size={22} /> },
  KNOWLEDGE:  { grad: GRAD.sky,      glow: GLOW.sky,      icon: <BookOpen size={22} /> },
  SOCIAL:     { grad: GRAD.butter,   glow: GLOW.butter,   icon: <Users size={22} /> },
  NATURE:     { grad: 'linear-gradient(135deg,#4ADE80,#16A34A)', glow: 'rgba(74,222,128,0.5)',  icon: <Leaf size={22} /> },
  MUSIC:      { grad: GRAD.rose,     glow: GLOW.rose,     icon: <Music size={22} /> },
  WELLNESS:   { grad: GRAD.mint,     glow: GLOW.mint,     icon: <Heart size={22} /> },
  DIY:        { grad: GRAD.peach,    glow: GLOW.peach,    icon: <Wrench size={22} /> },
  OTHERS:     { grad: GRAD.lavender, glow: GLOW.lavender, icon: <LayoutGrid size={22} /> },
};
const DEFAULT_CAT: CatMeta = { grad: GRAD.lavender, glow: GLOW.lavender, icon: <Trophy size={22} /> };

// ── Podium (widget "Classement" accueil) ────────────────────────────────────
// Ordre d'affichage : 2e à gauche, 1er au centre, 3e à droite.
const PODIUM_SLOTS = [
  { rank: 2, idx: 1 },
  { rank: 1, idx: 0 },
  { rank: 3, idx: 2 },
];
const PODIUM_BAR_H: Record<number, number> = { 1: 68, 2: 50, 3: 40 };
const PODIUM_MEDAL: Record<number, { bg: string; border: string; color: string }> = {
  1: { bg: '#fff', border: '#FACC15', color: '#92400E' },
  2: { bg: '#fff', border: '#A78BFA', color: '#7C3AED' },
  3: { bg: '#fff', border: '#FB923C', color: '#9A3412' },
};

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

const UQuail: React.FC = () => {
  const { t, i18n } = useTranslation();
  usePageTitle(t('uquail.pageTitle'));
  const { user, notifData, notifCount, setNotifCount } = useStore();
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<UserChallenge[]>([]);
  const [homeCosmetics, setHomeCosmetics] = useState<EquippedCosmetic[]>([]);
  const [dailyChallenge, setDailyChallenge] = useState<PublicChallenge | null>(null);
  const [dailyStatus, setDailyStatus] = useState<'none' | 'in_progress' | 'completed'>('none');
  const [loadingMain, setLoadingMain] = useState(true);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [panelUnreadGroups, setPanelUnreadGroups] = useState<{ groupId: number; seriesName: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (token) {
      const listLangParam = i18n.language !== 'fr' ? `&lang=${i18n.language}` : '';
      fetch(`/api/users/me/challenges?limit=20${listLangParam}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then((data: { challenges: UserChallenge[] } | UserChallenge[]) => {
          const list = Array.isArray(data) ? data : (data.challenges ?? []);
          setChallenges(list);

          const langParam = i18n.language !== 'fr' ? `?lang=${i18n.language}` : '';
          fetch(`/api/challenges/daily-suggestion${langParam}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null)
            .then((daily: PublicChallenge | null) => {
              if (daily?.id) {
                setDailyChallenge(daily);
                const uc = list.find(c => c.challengeId === daily.id);
                if (uc) setDailyStatus(uc.status === 'COMPLETED' ? 'completed' : 'in_progress');
              }
            })
            .catch(() => {})
            .finally(() => setLoadingMain(false));
        })
        .catch(() => setLoadingMain(false));
    } else {
      setLoadingMain(false);
    }
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => setTopUsers(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch(() => {});
  }, [user, i18n.language]);

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
    const features = [
      { grad: GRAD.lavender, glow: GLOW.lavender, icon: <Trophy size={20} aria-hidden="true" />, title: t('uquail.feature1Title'), desc: t('uquail.feature1Desc') },
      { grad: GRAD.butter,   glow: GLOW.butter,   icon: <Zap size={20} aria-hidden="true" />,    title: t('uquail.feature2Title'), desc: t('uquail.feature2Desc') },
      { grad: GRAD.mint,     glow: GLOW.mint,     icon: <ShoppingBag size={20} aria-hidden="true" />, title: t('uquail.feature3Title'), desc: t('uquail.feature3Desc') },
    ];
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
              {t('uquail.heroTitleLine1')}<br />{t('uquail.heroTitleLine2')}
            </h1>
            <p className="text-white/80 text-sm md:text-base mb-6 max-w-lg leading-relaxed">
              {t('uquail.heroSubtitle')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register"
                className="q-press px-6 py-3 rounded-2xl text-sm font-bold"
                style={{ background: '#fff', color: '#7C3AED' }}>
                {t('uquail.registerFree')}
              </Link>
              <Link to="/login"
                className="q-press px-6 py-3 rounded-2xl text-sm font-bold text-white"
                style={{ background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.40)' }}>
                {t('auth.login')}
              </Link>
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {features.map(({ grad, glow, icon, title, desc }) => (
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
  const seriesDayNumber = (title: string) => {
    const m = /^Jour\s+(\d+)/i.exec(title);
    return m ? parseInt(m[1], 10) : null;
  };
  // Au sein d'une même série, on affiche les jours dans l'ordre (2, 3, 4…) plutôt que par
  // date de création — la sauvegarde en masse des défis IA les crée tous "en cours" en
  // parallèle, ce qui ne garantit pas que le jour le plus ancien apparaisse en premier.
  const inProgress = challenges
    .filter(c => c.status === 'IN_PROGRESS')
    .sort((a, b) => {
      if (a.challenge.seriesName && a.challenge.seriesName === b.challenge.seriesName) {
        const da = seriesDayNumber(a.challenge.title);
        const db = seriesDayNumber(b.challenge.title);
        if (da !== null && db !== null) return da - db;
      }
      return 0;
    });
  const levelTitle = t(getLevelTitleKey(user.level ?? 1));

  const streak = (user as any).currentStreak ?? 0;
  const multiplier = Math.min(3, Math.round((1 + Math.floor(streak / 7) * 0.05) * 100) / 100);
  const nextMilestone = [7, 14, 30, 60, 100].find(m => m > streak) ?? 100;
  const streakProgress = (streak % 7) / 7;

  // Extracted so the loadingMain ternary below isn't a nested conditional.
  const todayFallback = inProgress.length === 0 ? (
    <button onClick={() => navigate('/challenges')}
      className="q-press w-full rounded-3xl flex items-center gap-4 p-4 mb-5 text-left"
      style={{ background: 'var(--q-chrome)', border: '1px dashed var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', boxShadow: '0 6px 14px -4px rgba(167,139,250,0.5)' }}>
        <Trophy size={22} className="text-white" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--q-text)' }}>
          {t('uquail.noChallengeInProgress')}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--q-text2)' }}>
          {t('uquail.startNow')}
        </p>
      </div>
      <ChevronRight size={16} className="ml-auto flex-shrink-0" style={{ color: 'var(--q-text3)' }} aria-hidden="true" />
    </button>
  ) : (
    <div className="flex flex-col gap-3 mb-5">
      {inProgress.slice(0, 3).map((uc, i) => {
        const meta = CAT_META[uc.challenge.category] ?? DEFAULT_CAT;
        const catLabel = t(`common.category.${uc.challenge.category}`, { defaultValue: t('uquail.defaultChallenge') });
        const day = daysSince(uc.startedAt);
        const total = 30;
        const progress = Math.min(1, day / total);
        return (
          <button key={uc.id} onClick={() => navigate('/challenges')}
            aria-label={t('uquail.viewChallenge', { title: uc.challenge.title })}
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
                  {catLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#FFDDC2', color: '#D46B0F', border: '1px solid #FFDDC2' }}>
                  <Flame size={10} style={{ color: '#D46B0F' }} aria-hidden="true" /> {t('common.daysAbbrev', { count: day })}
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
                  {t('uquail.dayOf', { day, total })}
                </span>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--q-text3)', flexShrink: 0 }} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );

  // Extracted so the "≥3 users" ternary below isn't a nested conditional.
  const leaderboardFallback = topUsers.length > 0 ? (
    <div className="relative z-10 flex flex-col gap-2.5">
      {topUsers.map((u, i) => (
        <div key={u.id} className="flex items-center gap-3">
          <span className="text-white font-black w-5 text-center" style={{ fontFamily: 'var(--q-display)', fontSize: 15, opacity: i === 0 ? 1 : 0.75 }}>
            {i + 1}
          </span>
          <UserAvatar avatar={u.avatar} username={u.username} cosmetics={u.cosmetics ?? []} size="sm" />
          <span className="flex-1 font-bold text-sm text-white truncate" style={{ opacity: i === 0 ? 1 : 0.85 }}>
            {u.username}
          </span>
          <span className="flex items-center gap-1 text-xs font-bold text-white/90">
            <Flame size={12} color="#fff" aria-hidden="true" /> {t('common.daysAbbrev', { count: u.currentStreak })}
          </span>
        </div>
      ))}
    </div>
  ) : (
    <div className="relative z-10 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.25)' }}>
        <Trophy size={22} color="#fff" aria-hidden="true" />
      </div>
      <div>
        <p className="text-white font-bold text-sm">{t('uquail.seeTopPlayers')}</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>{t('uquail.rankedByStreak')}</p>
      </div>
      <ChevronRight size={18} color="rgba(255,255,255,0.8)" className="ml-auto flex-shrink-0" aria-hidden="true" />
    </div>
  );

  return (
    <div style={{ color: 'var(--q-text)', fontFamily: 'var(--q-font)', paddingBottom: 32 }}>

      {/* ── Greeting header ── */}
      <div className="flex items-center justify-between mb-5">
        {/* Left: avatar + name */}
        <div className="flex items-center gap-3">
          <UserAvatar avatar={user.avatar} username={user.username ?? ''} cosmetics={homeCosmetics} size="md" />
          <div>
            <div style={{ fontSize: 13, color: 'var(--q-text2)', fontWeight: 500 }}>{t('uquail.greeting')}</div>
            <div style={{ fontSize: 20, fontFamily: 'var(--q-display)', color: 'var(--q-text)', letterSpacing: -0.2, lineHeight: 1.1 }}>
              {user.username}
            </div>
          </div>
        </div>
        {/* Right: coins pill + bell */}
        <div className="flex items-center gap-2">
          <Link to="/shop" className="q-press"
            style={{ display: 'flex', alignItems: 'center', gap: 5,
              background: 'linear-gradient(135deg,#FACC15,#FB923C)',
              color: '#fff', padding: '6px 12px', borderRadius: 999,
              fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums',
              textDecoration: 'none', boxShadow: '0 4px 12px -2px rgba(251,146,60,0.45)' }}>
            <CircleDollarSign size={14} aria-hidden="true" /> {(user.coins ?? 0).toLocaleString(i18n.language)}
          </Link>
          <div data-tour="home-notif" style={{ position: 'relative' }}>
            <button className="q-press" aria-label={t('common.notifications')} onClick={() => {
              const willOpen = !notifPanelOpen;
              setNotifPanelOpen(willOpen);
              if (willOpen && notifData && user) {
                // Clé préfixée par userId — sinon la lecture "vu" d'un compte contamine
                // le compte suivant connecté sur le même navigateur (voir useNotificationPolling.ts).
                const seenKey = `notif_seen_${user.id}`;
                // Read once, use twice
                const currentSeen = JSON.parse(localStorage.getItem(seenKey) ?? '{}');
                // Snapshot unread groups BEFORE marking as seen so the panel can display them
                setPanelUnreadGroups(
                  notifData.groups.filter(g =>
                    g.latestMessageId && g.latestMessageUserId !== user?.id &&
                    g.latestMessageId > ((currentSeen.groups?.[String(g.groupId)]) ?? 0)
                  )
                );
                // Mark group messages as seen — friend/invite counts persist until acted on
                const seenGroups: Record<string, number> = {};
                notifData.groups.forEach(g => { seenGroups[String(g.groupId)] = g.latestMessageId ?? 0; });
                localStorage.setItem(seenKey, JSON.stringify({ ...currentSeen, groups: seenGroups }));
                // Immediate badge update — next poll will reconfirm
                setNotifCount(notifData.pendingFriendRequests + notifData.pendingSeriesInvites);
              }
            }} style={{
              width: 40, height: 40, borderRadius: 20, flexShrink: 0,
              border: '1px solid rgba(250,204,21,0.35)',
              background: 'var(--q-chrome)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px -2px rgba(250,204,21,0.35)',
              cursor: 'pointer',
            }}>
              <Bell size={18} style={{ color: 'var(--q-amber-text)' }} aria-hidden="true" />
            </button>
            {notifCount > 0 && (
              <span aria-label={t('uquail.notifCount', { count: notifCount })} style={{
                position: 'absolute', top: -4, right: -4,
                width: 18, height: 18, borderRadius: '50%',
                background: '#EF4444',
                color: '#fff', fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--q-chrome)',
                pointerEvents: 'none',
              }}>{notifCount > 9 ? '9+' : notifCount}</span>
            )}
            {notifPanelOpen && (
              <div role="dialog" aria-label={t('common.notifications')} style={{
                position: 'absolute', top: 48, right: 0, zIndex: 200,
                width: 290, borderRadius: 18,
                background: 'var(--q-chrome)', border: '1px solid var(--q-line)',
                boxShadow: '0 16px 40px -8px rgba(0,0,0,0.4)',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--q-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--q-text)' }}>{t('common.notifications')}</span>
                  <button onClick={() => setNotifPanelOpen(false)} aria-label={t('common.close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--q-text3)', padding: 0, fontSize: 16, lineHeight: 1 }}>✕</button>
                </div>

                {/* Streak at risk */}
                {notifData?.streakAtRisk && (
                  <button onClick={() => { setNotifPanelOpen(false); navigate('/challenges'); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(251,146,60,0.08)', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--q-line)', textAlign: 'left' }}>
                    <Flame size={16} color="#FB923C" aria-hidden="true" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--q-text)' }}>{t('uquail.streakAtRiskTitle')}</div>
                      <div style={{ fontSize: 11, color: 'var(--q-text3)', marginTop: 1 }}>{t('uquail.streakAtRiskDesc', { count: notifData.streakDays })}</div>
                    </div>
                  </button>
                )}

                {/* Unread group messages — snapshot taken at panel open */}
                {panelUnreadGroups.map(g => (
                  <button key={g.groupId} onClick={() => { setNotifPanelOpen(false); navigate(`/groups/${g.groupId}`); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--q-line)', textAlign: 'left' }}>
                    <MessageSquare size={15} color="var(--q-accent)" aria-hidden="true" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--q-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.seriesName}</div>
                      <div style={{ fontSize: 11, color: 'var(--q-text3)', marginTop: 1 }}>{t('uquail.newGroupMessages')}</div>
                    </div>
                  </button>
                ))}

                {/* Pending friend requests */}
                {(notifData?.pendingFriendRequests ?? 0) > 0 && (
                  <button onClick={() => { setNotifPanelOpen(false); navigate('/friends'); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--q-line)', textAlign: 'left' }}>
                    <Users size={15} color="var(--q-accent)" aria-hidden="true" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--q-text)' }}>{t('uquail.friendRequestCount', { count: notifData!.pendingFriendRequests })}</div>
                      <div style={{ fontSize: 11, color: 'var(--q-text3)', marginTop: 1 }}>{t('uquail.awaitingYourResponse')}</div>
                    </div>
                  </button>
                )}

                {/* Pending series invites */}
                {(notifData?.pendingSeriesInvites ?? 0) > 0 && (
                  <button onClick={() => { setNotifPanelOpen(false); navigate('/challenges'); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--q-line)', textAlign: 'left' }}>
                    <Trophy size={15} color="var(--q-accent)" aria-hidden="true" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--q-text)' }}>{t('uquail.groupInviteCount', { count: notifData!.pendingSeriesInvites })}</div>
                      <div style={{ fontSize: 11, color: 'var(--q-text3)', marginTop: 1 }}>{t('uquail.joinGroupSeries')}</div>
                    </div>
                  </button>
                )}

                {/* Empty state */}
                {!notifData?.streakAtRisk && (notifData?.pendingFriendRequests ?? 0) === 0 && (notifData?.pendingSeriesInvites ?? 0) === 0 && panelUnreadGroups.length === 0 && (
                  <div style={{ padding: '20px 14px', fontSize: 13, color: 'var(--q-text3)', textAlign: 'center' }}>
                    {t('uquail.allCaughtUp')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Hero XP card ── */}
      <div data-tour="home-xp" className="rounded-3xl p-5 mb-5 relative overflow-hidden"
        style={{ background: 'var(--q-vibrant-hero)',
          boxShadow: '0 14px 32px -10px rgba(124,58,237,0.45)',
          }}>
        <div className="absolute right-[-30px] top-[-30px] w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        <div className="flex items-start justify-between relative z-10">
          <div className="flex-1 pr-3">
            <div className="text-xs font-bold uppercase tracking-widest opacity-90 mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {t('userProfile.level', { level: user.level ?? 1 })} · {levelTitle}
            </div>
            <div className="text-xl md:text-2xl font-bold text-white"
              style={{ fontFamily: 'var(--q-display)', letterSpacing: -0.3, lineHeight: 1.15 }}>
              <Trans i18nKey="uquail.xpToNextLevel" values={{ xp: 1000 - xpInLevel, level: (user.level ?? 1) + 1 }} components={{ br: <br /> }} />
            </div>
          </div>
          <div role="img" aria-label={t('uquail.progressLabel', { percent: Math.round(xpPercent * 100), level: (user.level ?? 1) + 1 })}>
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
            <Trans i18nKey="uquail.challengesInProgress" count={inProgress.length} components={{ b: <b className="text-white" /> }} />
          </span>
          <span className="flex items-center gap-1.5">
            <Zap size={13} style={{ color: '#FFE57C' }} aria-hidden="true" />
            <Trans i18nKey="uquail.xpThisLevel" values={{ xp: xpInLevel }} components={{ b: <b className="text-white" /> }} />
          </span>
        </div>
      </div>

      {/* ── Streak ── */}
      <div data-tour="home-streak" className="mb-5 rounded-3xl overflow-hidden"
        style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
        <div className="flex items-center gap-3 p-4">
          {/* Icône principale */}
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: streak > 0 ? 'linear-gradient(135deg,#FB923C,#FACC15)' : 'rgba(148,163,184,0.15)',
                boxShadow: streak > 0 ? '0 6px 18px -4px rgba(251,146,60,0.6)' : 'none' }}>
              {streak > 0
                ? <Flame size={28} color="#fff" />
                : <Moon size={24} color="rgba(148,163,184,0.7)" />}
            </div>
            {streak > 0 && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-orange-500 border-2 flex items-center justify-center"
                style={{ borderColor: 'var(--q-chrome)', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                {streak}
              </div>
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-base font-bold" style={{ color: 'var(--q-text)' }}>
                {streak > 0 ? t('uquail.streakDaysInARow', { count: streak }) : t('uquail.noStreakYet')}
              </span>
              {multiplier > 1 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'linear-gradient(135deg,#FB923C,#FACC15)', color: '#fff' }}>
                  ×{multiplier}
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--q-text2)' }}>
              {streak > 0
                ? t('uquail.nextMilestone', { count: nextMilestone })
                : t('uquail.completeToStart')}
            </div>
            {/* Barre progression vers le prochain palier de 7j */}
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(251,146,60,0.2)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${streakProgress * 100}%`, background: 'linear-gradient(90deg,#FB923C,#FACC15)' }} />
            </div>
          </div>
        </div>

        {/* Paliers */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
          {([
            { days: 7,   Icon: Zap },
            { days: 14,  Icon: Star },
            { days: 30,  Icon: Award },
            { days: 60,  Icon: Crown },
            { days: 100, Icon: Trophy },
          ] as const).map(({ days, Icon }) => {
            const done = streak >= days;
            const isCurrent = streak < days && (days === nextMilestone);
            const idleBg = isCurrent ? 'rgba(251,146,60,0.15)' : 'rgba(148,163,184,0.08)';
            const idleIconColor = isCurrent ? '#FB923C' : 'var(--q-text3)';
            const idleLabelColor = isCurrent ? '#FB923C' : 'var(--q-text2)';
            return (
              <div key={days}
                className="flex flex-col items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl text-center transition-all"
                style={{
                  background: done ? 'linear-gradient(135deg,#FB923C,#FACC15)' : idleBg,
                  minWidth: 56,
                  border: isCurrent ? '1px solid rgba(251,146,60,0.4)' : '1px solid transparent',
                }}>
                <Icon size={16} color={done ? '#fff' : idleIconColor} />
                <span className="text-[10px] font-bold"
                  style={{ color: done ? '#fff' : idleLabelColor }}>
                  {t('common.daysAbbrev', { count: days })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Ta journée ── */}
      <div data-tour="home-today">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-bold"
          style={{ fontFamily: 'var(--q-display)', letterSpacing: -0.3, color: 'var(--q-text)' }}>
          {t('uquail.yourDay')}
        </h2>
        {inProgress.length > 0 && (
          <Link to="/challenges" className="text-xs font-semibold hover:underline" style={{ color: 'var(--q-accent)' }}>
            {t('uquail.seeAll')}
          </Link>
        )}
      </div>

      {loadingMain ? (
        <div className="flex flex-col gap-3 mb-5 animate-pulse">
          {[0, 1].map(i => (
            <div key={i} className="rounded-3xl flex items-center gap-3 p-3.5"
              style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)' }}>
              <div className="w-[50px] h-[50px] rounded-2xl flex-shrink-0" style={{ background: 'var(--q-line)' }} />
              <div className="flex-1 space-y-2">
                <div className="h-3 rounded-full w-1/3" style={{ background: 'var(--q-line)' }} />
                <div className="h-3.5 rounded-full w-2/3" style={{ background: 'var(--q-line)' }} />
                <div className="h-1.5 rounded-full w-full" style={{ background: 'var(--q-line)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : todayFallback}
      </div>

      {/* ── Quick nav cards — desktop only (mobile has bottom tab bar) ── */}
      <div className="hidden md:block">
      {inProgress.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { to: '/challenges', grad: GRAD.lavender, glow: GLOW.lavender, icon: <Trophy size={18} aria-hidden="true" />, label: t('sidebar.challenges') },
            { to: '/leaderboard', grad: GRAD.butter, glow: GLOW.butter, icon: <Zap size={18} aria-hidden="true" />, label: t('sidebar.leaderboard') },
            { to: '/shop', grad: GRAD.mint, glow: GLOW.mint, icon: <ShoppingBag size={18} aria-hidden="true" />, label: t('sidebar.shop') },
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
            { to: '/challenges', grad: GRAD.lavender, glow: GLOW.lavender, icon: <Trophy size={20} aria-hidden="true" />, label: t('uquail.discoverChallenges'), sub: t('uquail.tryNewChallenge') },
            { to: '/leaderboard', grad: GRAD.butter, glow: GLOW.butter, icon: <Zap size={20} aria-hidden="true" />, label: t('sidebar.leaderboard'), sub: t('uquail.seeTopPlayers') },
            { to: '/shop', grad: GRAD.mint, glow: GLOW.mint, icon: <ShoppingBag size={20} aria-hidden="true" />, label: t('sidebar.shop'), sub: t('uquail.spendYourCoins') },
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

      {/* ── Classement (mobile only — desktop has sidebar) ── */}
      <div data-tour="home-leaderboard" className="md:hidden mb-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xl font-bold"
            style={{ fontFamily: 'var(--q-display)', letterSpacing: -0.3, color: 'var(--q-text)' }}>
            {t('sidebar.leaderboard')}
          </h2>
          <Link to="/leaderboard" className="text-xs font-semibold hover:underline" style={{ color: 'var(--q-accent)' }}>
            {t('uquail.seeLeaderboard')}
          </Link>
        </div>
        <Link to="/leaderboard"
          className="block rounded-3xl p-4 relative overflow-hidden hover:opacity-95 transition-opacity"
          style={{ background: GRAD.butter, boxShadow: `0 14px 32px -10px ${GLOW.butter}` }}>
          <div className="absolute right-[-28px] bottom-[-30px] w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
          <div className="absolute right-8 top-[-20px] w-16 h-16 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
          {topUsers.length >= 3 ? (
            <div className="relative z-10 flex items-end justify-center gap-2">
              {PODIUM_SLOTS.map(({ rank, idx }) => {
                const u = topUsers[idx];
                if (!u) return null;
                const medal = PODIUM_MEDAL[rank];
                return (
                  <div key={u.id} className="flex-1 flex flex-col items-center min-w-0">
                    <div className="relative inline-flex mb-1.5">
                      <UserAvatar avatar={u.avatar} username={u.username} cosmetics={u.cosmetics ?? []}
                        size={rank === 1 ? 'md' : 'sm'}
                        className={rank === 1 ? 'ring-4 ring-white/60' : 'ring-2 ring-white/40'} />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: medal.bg, color: medal.color, border: `2px solid ${medal.border}`,
                          fontSize: 10, fontWeight: 800, fontFamily: 'var(--q-display)' }}>
                        {rank}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-white truncate max-w-full" style={{ opacity: rank === 1 ? 1 : 0.85 }}>
                      {u.username}
                    </div>
                    <div className="text-[10px] mb-2 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--q-mono)' }}>
                      <Flame size={9} aria-hidden="true" /> {t('common.daysAbbrev', { count: u.currentStreak })}
                    </div>
                    <div className="w-full flex items-center justify-center font-black"
                      style={{ height: PODIUM_BAR_H[rank], background: 'rgba(255,255,255,0.25)',
                        borderRadius: '16px 16px 4px 4px',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(0,0,0,0.08)',
                        fontFamily: 'var(--q-display)', fontSize: rank === 1 ? 24 : 18, color: 'rgba(255,255,255,0.9)' }}>
                      {rank}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : leaderboardFallback}
        </Link>
      </div>

      {/* ── Suggestion du jour ── */}
      <div data-tour="home-daily">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-bold"
          style={{ fontFamily: 'var(--q-display)', letterSpacing: -0.3, color: 'var(--q-text)' }}>
          {t('sidebar.dailySuggestion')}
        </h2>
        {dailyChallenge && (
          <Link to={`/challenges?daily=${dailyChallenge.id}`}
            className="text-xs font-semibold hover:underline" style={{ color: 'var(--q-accent)' }}>
            {t('uquail.seeChallenge')}
          </Link>
        )}
      </div>
      <Link to={dailyChallenge ? `/challenges?daily=${dailyChallenge.id}` : '/challenges'}
        className="block rounded-3xl p-4 mb-5 relative overflow-hidden hover:opacity-95 transition-opacity"
        style={{ background: 'var(--q-vibrant-lavender)', boxShadow: '0 14px 32px -10px rgba(167,139,250,0.55)' }}>
        <div className="absolute right-[-28px] bottom-[-30px] w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        <div className="absolute right-8 top-[-20px] w-16 h-16 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />

        {dailyChallenge ? (
          <div className="flex items-start gap-3 relative z-10">
            {/* Category icon */}
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: (CAT_META[dailyChallenge.category] ?? DEFAULT_CAT).grad,
                boxShadow: `0 6px 14px -4px ${(CAT_META[dailyChallenge.category] ?? DEFAULT_CAT).glow}` }}>
              <div className="text-white" aria-hidden="true">
                {(CAT_META[dailyChallenge.category] ?? DEFAULT_CAT).icon}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {t('uquail.recommendedChallenge')}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-900">
                  <Sparkles size={9} aria-hidden="true" style={{ color: '#fff' }} /> {t('uquail.bonusRewards')}
                </span>
                {dailyStatus === 'completed' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-900">
                    {t('uquail.completed')}
                  </span>
                )}
                {dailyStatus === 'in_progress' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-400 text-sky-900">
                    {t('uquail.inProgress')}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-white leading-snug mb-2"
                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {dailyChallenge.title}
              </p>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
                <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  {t(`common.difficulty.${dailyChallenge.difficulty.toLowerCase()}`, { defaultValue: dailyChallenge.difficulty })}
                </span>
                <span>{t('sidebar.dailyRewards', { coins: dailyChallenge.coinReward, xp: dailyChallenge.xpReward })}</span>
              </div>
            </div>
            <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.8)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          </div>
        ) : (
          <div className="flex gap-3 items-center relative z-10 animate-pulse">
            <div className="w-12 h-12 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.25)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-2.5 rounded-full w-1/4" style={{ background: 'rgba(255,255,255,0.3)' }} />
              <div className="h-4 rounded-full w-3/4" style={{ background: 'rgba(255,255,255,0.3)' }} />
              <div className="h-3 rounded-full w-1/2" style={{ background: 'rgba(255,255,255,0.2)' }} />
            </div>
          </div>
        )}
      </Link>
      </div>

    </div>
  );
};

export default UQuail;
