import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { useVisibilityPausedInterval } from '../hooks/useVisibilityPausedInterval';
import { isGroupUnread } from '../hooks/useNotificationPolling';
import { useStore } from '../lib/store';
import type { User } from '../types/User';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trophy, Star, Zap, Search, Plus, CheckCircle, Clock, Flame, SlidersHorizontal, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Gamepad2, Activity, UtensilsCrossed, Dumbbell, Palette, BookOpen, Users, Leaf, Music, Heart, Wrench, LayoutGrid, Sparkles, Send, MessageCircle, Mail, PartyPopper, Timer, Loader2, CircleDollarSign, UserPlus, Pencil, Trash2, Lock, CalendarCheck } from 'lucide-react';
import BackButton from '../components/BackButton';
import UserAvatar from '../components/UserAvatar';
import PageLoader from '../components/PageLoader';
import EditChallengeModal from '../components/EditChallengeModal';
import type { EquippedCosmetic } from '../lib/cosmetics';
import { startOfWeek, startOfDay, sameDay } from '../lib/completedChallengesStats';
import { seriesDayNumber, resolveSeriesDisplayName } from '../lib/challengeSort';

type Challenge = {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  category: string;
  coinReward: number;
  xpReward: number;
  isDefault: boolean;
  createdAt: string;
  seriesName?: string | null;
  seriesNameEn?: string | null;
  seriesNameFr?: string | null;
  originalLang?: string;
  creator?: { id: number; username: string; avatar?: string };
  _count?: { participants: number };
  // Renvoyé par GET /api/challenges/by-series/:name — nombre de jours restants avant que CE
  // défi (identifié par son numéro de jour dans le titre) ne se débloque pour l'utilisateur
  // connecté ; absent/null si déjà déverrouillé, si le défi n'a pas de numéro de jour, ou si le
  // jour précédent n'est pas encore validé (voir previousDayIncomplete — dans ce cas le compte à
  // rebours n'a pas encore commencé, donc pas de nombre de jours à afficher).
  daysUntilUnlock?: number | null;
  // Le jour N-1 de la série n'a pas encore été validé par cet utilisateur — le verrou de CE jour
  // n'a donc pas encore de date de déverrouillage connue (voir seriesLockInfo côté backend).
  previousDayIncomplete?: boolean;
};

type UserChallenge = { id: number; challengeId: number; status: string };
type UserChallengeWithData = { id: number; challengeId: number; status: string; startedAt: string; challenge: Challenge };

type GroupMember = {
  id: number; groupId: number; userId: number; status: string;
  user: { id: number; username: string; avatar?: string; cosmetics?: EquippedCosmetic[] };
};
type GroupMessageType = {
  id: number; groupId: number; userId: number; content: string; createdAt: string;
  user: { id: number; username: string; avatar?: string; cosmetics?: EquippedCosmetic[] };
};
type ChallengeGroupType = {
  id: number; challengeId: number; createdBy: number; createdAt: string;
  challenge: Pick<Challenge, 'id' | 'title' | 'description' | 'difficulty' | 'category' | 'coinReward' | 'xpReward'>;
  creator: { id: number; username: string; avatar?: string; cosmetics?: EquippedCosmetic[] };
  members: GroupMember[];
  messages: GroupMessageType[];
};
type Friend = { friendshipId: number; user: { id: number; username: string; avatar?: string; cosmetics?: EquippedCosmetic[] } };

const CATEGORY_GRAD: Record<string, { grad: string; glow: string; Icon: React.FC<{ size?: number | string }> }> = {
  GAMING:     { grad: 'linear-gradient(135deg,#A78BFA,#EC4899)', glow: 'rgba(167,139,250,0.5)', Icon: Gamepad2 },
  SPORT:      { grad: 'linear-gradient(135deg,#34D399,#38BDF8)', glow: 'rgba(52,211,153,0.5)',  Icon: Activity },
  CUISINE:    { grad: 'linear-gradient(135deg,#FACC15,#FB923C,#EC4899)', glow: 'rgba(251,146,60,0.5)', Icon: UtensilsCrossed },
  FITNESS:    { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.5)',  Icon: Dumbbell },
  CREATIVITY: { grad: 'linear-gradient(135deg,#EC4899,#A78BFA)', glow: 'rgba(236,72,153,0.5)',  Icon: Palette },
  KNOWLEDGE:  { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.5)',  Icon: BookOpen },
  SOCIAL:     { grad: 'linear-gradient(135deg,#FACC15,#FB923C)', glow: 'rgba(250,204,21,0.5)',  Icon: Users },
  NATURE:     { grad: 'linear-gradient(135deg,#4ADE80,#16A34A)', glow: 'rgba(74,222,128,0.5)',  Icon: Leaf },
  MUSIC:      { grad: 'linear-gradient(135deg,#F472B6,#A78BFA)', glow: 'rgba(244,114,182,0.5)', Icon: Music },
  WELLNESS:   { grad: 'linear-gradient(135deg,#6EE7B7,#3B82F6)', glow: 'rgba(110,231,183,0.5)', Icon: Heart },
  DIY:        { grad: 'linear-gradient(135deg,#FB923C,#D97706)', glow: 'rgba(251,146,60,0.5)',  Icon: Wrench },
  OTHERS:     { grad: 'linear-gradient(135deg,#94A3B8,#64748B)', glow: 'rgba(148,163,184,0.5)', Icon: LayoutGrid },
};

const DIFF_GRAD: Record<string, { grad: string; glow: string; icon: React.ReactNode }> = {
  EASY:   { grad: 'linear-gradient(135deg,#34D399,#38BDF8)', glow: 'rgba(52,211,153,0.45)',  icon: <Star size={11} aria-hidden="true" /> },
  MEDIUM: { grad: 'linear-gradient(135deg,#FACC15,#FB923C)', glow: 'rgba(251,146,60,0.45)',  icon: <Zap size={11} aria-hidden="true" /> },
  HARD:   { grad: 'linear-gradient(135deg,#FB923C,#EC4899)', glow: 'rgba(251,146,60,0.45)', icon: <Flame size={11} aria-hidden="true" /> },
  EXPERT: { grad: 'linear-gradient(135deg,#EC4899,#A78BFA)', glow: 'rgba(236,72,153,0.45)', icon: <Trophy size={11} aria-hidden="true" /> },
};

const CATEGORIES   = Object.keys(CATEGORY_GRAD);
const DIFFICULTIES = Object.keys(DIFF_GRAD);

// Style d'un membre de groupe de défi selon son statut — remplace un ternaire imbriqué
// (COMPLETED / JOINED / autre) par une lookup, réutilisé pour l'icône + les couleurs.
const GROUP_MEMBER_STATUS_STYLE: Record<string, { Icon: React.FC<{ size?: number | string; 'aria-hidden'?: boolean | 'true' | 'false' }>; color: string; bg: string }> = {
  COMPLETED: { Icon: CheckCircle, color: '#34D399', bg: 'rgba(52,211,153,0.15)' },
  JOINED:    { Icon: Timer,       color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
};
const GROUP_MEMBER_STATUS_DEFAULT = { Icon: Mail, color: 'var(--q-text3)', bg: 'var(--q-line)' };

// ── CelebrationOverlay ────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#A78BFA','#EC4899','#FACC15','#34D399','#38BDF8','#FB923C','#ffffff','#F472B6','#6EE7B7','#818CF8'];

interface CelebrationProps {
  coins: number; xp: number; isDailyBonus: boolean;
  multiplier?: number; streakUp?: number; onDismiss: () => void;
  groupSize?: number; groupBonusMultiplier?: number;
}

const CelebrationOverlay: React.FC<CelebrationProps> = ({ coins, xp, isDailyBonus, multiplier, streakUp, onDismiss, groupSize, groupBonusMultiplier }) => {
  const { t } = useTranslation();
  const [displayCoins, setDisplayCoins] = useState(0);
  const [displayXp, setDisplayXp]       = useState(0);
  const [streakPhase, setStreakPhase]   = useState<'before' | 'exiting' | 'after'>('before');

  const particles = useMemo(() => {
    const count = 54;
    return Array.from({ length: count }, (_, i) => {
      const base  = (i / count) * 360;
      const angle = base + (Math.random() * (360 / count) - (360 / count) / 2);
      const dist  = 110 + Math.random() * 210;
      return {
        id:    i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size:  5 + Math.round(Math.random() * 9),
        rect:  i % 3 === 2,
        cx:    Math.cos((angle * Math.PI) / 180) * dist,
        cy:    Math.sin((angle * Math.PI) / 180) * dist,
        cr:    Math.random() * 720 - 360,
        delay: Math.random() * 0.3,
        dur:   0.8 + Math.random() * 0.7,
      };
    });
  }, []);

  useEffect(() => {
    let raf: number;
    let startTime: number | null = null;
    const total = 1300;
    const timeout = setTimeout(() => {
      const tick = (now: number) => {
        if (!startTime) startTime = now;
        const t = Math.min((now - startTime) / total, 1);
        const ease = 1 - (1 - t) ** 3;
        setDisplayCoins(Math.round(ease * coins));
        setDisplayXp(Math.round(ease * xp));
        if (t < 1) { raf = requestAnimationFrame(tick); }
        else { setDisplayCoins(coins); setDisplayXp(xp); }
      };
      raf = requestAnimationFrame(tick);
    }, 380);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [coins, xp]);

  // Persona 5-style streak transition: old number exits then new number slams in
  useEffect(() => {
    if (streakUp === undefined) return;
    const t1 = setTimeout(() => setStreakPhase('exiting'), 1820);
    const t2 = setTimeout(() => setStreakPhase('after'),   2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [streakUp]);

  return (
    <div
      role="dialog" aria-modal="true" aria-label={t('challengePage.celebration.ariaLabel')}
      className="celebrate-backdrop fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', cursor: 'pointer' }}
      onClick={onDismiss}
      onKeyDown={e => { if (e.key === 'Escape') onDismiss(); }}
      tabIndex={-1}
    >

{/* Confetti particles — absolute in the fixed container = centered on screen */}
      {particles.map(p => (
        <div key={p.id} aria-hidden="true" style={{
          position: 'absolute',
          left: '50%', top: '50%',
          width: p.size,
          height: p.rect ? Math.round(p.size * 0.45) : p.size,
          marginLeft: -(p.size / 2),
          marginTop:  -(p.size / 2),
          borderRadius: p.rect ? 3 : '50%',
          background: p.color,
          pointerEvents: 'none',
          '--cx': `${p.cx}px`,
          '--cy': `${p.cy}px`,
          '--cr': `${p.cr}deg`,
          animation: `confetti-burst ${p.dur}s ${p.delay}s ease-out both`,
        } as React.CSSProperties} />
      ))}

      {/* Card */}
      <div
        className="celebrate-pop relative z-10 flex flex-col items-center gap-5 rounded-[30px]"
        style={{
          background: 'linear-gradient(158deg,#2a1547 0%,#180c30 100%)',
          boxShadow: '0 0 0 1.5px rgba(167,139,250,0.55), 0 40px 80px -16px rgba(0,0,0,0.85), 0 0 80px rgba(167,139,250,0.18)',
          padding: '40px 32px 28px',
          minWidth: 280, maxWidth: 340, width: '100%',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Shine sweep */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          <div className="celebrate-shine absolute inset-y-0 w-24"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.11), transparent)', left: '-96px' }} />
        </div>

        {/* Pulsing checkmark */}
        <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: 88, height: 88 }}>
          <div aria-hidden="true" className="celebrate-ring-1 absolute inset-0 rounded-full"
            style={{ border: '2.5px solid rgba(167,139,250,0.65)' }} />
          <div aria-hidden="true" className="celebrate-ring-2 absolute inset-0 rounded-full"
            style={{ border: '2.5px solid rgba(236,72,153,0.45)' }} />
          <div className="celebrate-check relative z-10 w-[68px] h-[68px] rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg,#A78BFA,#EC4899)',
              boxShadow: '0 0 0 5px rgba(167,139,250,0.22), 0 0 48px rgba(167,139,250,0.75)',
            }}>
            <CheckCircle size={32} color="#fff" strokeWidth={2.5} aria-hidden="true" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <p className="font-black leading-tight text-white"
            style={{ fontFamily: 'var(--q-display)', fontSize: '1.7rem', letterSpacing: '-0.025em' }}>
            {isDailyBonus ? t('challengePage.celebration.dailyBonusTitle') : t('challengePage.celebration.challengeValidatedTitle')}
          </p>
          <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.48)' }}>
            {t('challengePage.celebration.encouragement')}
          </p>
        </div>

        {/* Reward tiles */}
        <div className="flex gap-3 justify-center">
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '16px 18px', borderRadius: 18,
            background: 'rgba(250,204,21,0.11)', border: '1px solid rgba(250,204,21,0.28)',
            animation: 'reward-item-pop 0.45s 0.38s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <CircleDollarSign size={28} color="#FACC15" aria-hidden="true" />
            <span className="font-black text-2xl text-white">+{displayCoins}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(250,204,21,0.65)' }}>{t('challengePage.celebration.coins')}</span>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '16px 18px', borderRadius: 18,
            background: 'rgba(56,189,248,0.11)', border: '1px solid rgba(56,189,248,0.28)',
            animation: 'reward-item-pop 0.45s 0.52s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <Zap size={28} color="#38BDF8" aria-hidden="true" />
            <span className="font-black text-2xl text-white">+{displayXp}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#38BDF8' }}>XP</span>
          </div>

          {streakUp !== undefined && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '16px 18px', borderRadius: 18,
              background: 'rgba(251,146,60,0.11)', border: '1px solid rgba(251,146,60,0.28)',
              animation: 'reward-item-pop 0.45s 0.66s cubic-bezier(0.34,1.56,0.64,1) both',
              position: 'relative', overflow: 'visible',
            }}>
              <Flame size={28} color="#FB923C" aria-hidden="true"
                style={{ filter: streakPhase === 'after' ? 'drop-shadow(0 0 8px rgba(251,146,60,0.9))' : undefined,
                         transition: 'filter 0.3s ease' }} />

              {/* Number container — fixed height so layout stays stable */}
              <div style={{ position: 'relative', height: '2.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 52 }}>
                {/* Old value: shown initially, exits on 'exiting' phase */}
                {streakPhase !== 'after' && (
                  <span
                    key="streak-old"
                    style={{
                      position: 'absolute',
                      fontWeight: 900, fontSize: '1.5rem', color: '#fff',
                      animation: streakPhase === 'exiting'
                        ? 'streak-number-exit 0.28s cubic-bezier(0.55,0,1,0.45) both'
                        : undefined,
                    }}>
                    {t('common.daysAbbrev', { count: streakUp - 1 })}
                  </span>
                )}

                {/* New value: P5 slam on 'after' phase */}
                {streakPhase === 'after' && (
                  <span
                    key="streak-new"
                    style={{
                      position: 'absolute',
                      fontWeight: 900, fontSize: '1.75rem', fontStyle: 'italic',
                      color: '#FB923C',
                      letterSpacing: '-0.03em',
                      textShadow: '0 0 18px rgba(251,146,60,0.95), 0 0 36px rgba(251,146,60,0.55), -1.5px -1.5px 0 rgba(0,0,0,0.55), 1.5px -1.5px 0 rgba(0,0,0,0.55), -1.5px 1.5px 0 rgba(0,0,0,0.55), 1.5px 1.5px 0 rgba(0,0,0,0.55)',
                      animation: 'streak-number-slam 0.58s cubic-bezier(0.22,1,0.36,1) both',
                    }}>
                    {t('common.daysAbbrev', { count: streakUp })}
                  </span>
                )}
              </div>

              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#FB923C' }}>{t('challengePage.celebration.streak')}</span>
            </div>
          )}
        </div>

        {/* Daily bonus chip */}
        {isDailyBonus && multiplier && (
          <div style={{ animation: 'reward-item-pop 0.4s 0.82s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <span className="flex items-center gap-1.5 font-black text-sm text-amber-900 px-5 py-2 rounded-full"
              style={{ background: 'linear-gradient(135deg,#FACC15,#FB923C)', boxShadow: '0 6px 20px rgba(251,146,60,0.5)' }}>
              <Sparkles size={14} aria-hidden="true" /> {t('challengePage.celebration.dailyBonusChip', { multiplier })}
            </span>
          </div>
        )}

        {/* Group bonus chip */}
        {!!groupSize && groupSize > 1 && !!groupBonusMultiplier && (
          <div style={{ animation: 'reward-item-pop 0.4s 0.94s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <span className="flex items-center gap-1.5 font-black text-sm text-white px-5 py-2 rounded-full"
              style={{ background: 'linear-gradient(135deg,#38BDF8,#A78BFA)', boxShadow: '0 6px 20px rgba(167,139,250,0.5)' }}>
              <Users size={14} aria-hidden="true" /> {t('challengePage.celebration.groupBonusChip', { multiplier: groupBonusMultiplier.toFixed(1), count: groupSize })}
            </span>
          </div>
        )}

        {/* Dismiss hint */}
        <p aria-hidden="true" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 4, animation: 'reward-item-pop 0.3s 1.3s ease-out both' }}>
          {t('challengePage.celebration.dismissHint')}
        </p>
      </div>
    </div>
  );
};


function VibrantChip({ grad, glow, children }: Readonly<{ grad: string; glow: string; children: React.ReactNode }>) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold text-white flex-shrink-0"
      style={{ background: grad, boxShadow: `0 3px 10px -2px ${glow}` }}>
      {children}
    </span>
  );
}

function IconTile({ cat }: Readonly<{ cat: string }>) {
  const cfg = CATEGORY_GRAD[cat] ?? CATEGORY_GRAD.GAMING;
  const CatIcon = cfg.Icon;
  return (
    <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center relative overflow-hidden"
      style={{ background: cfg.grad, boxShadow: `0 6px 14px -4px ${cfg.glow}` }}>
      <div className="absolute right-[-8px] top-[-8px] w-7 h-7 rounded-full"
        style={{ background: 'rgba(255,255,255,0.20)' }} />
      <div className="relative z-10 text-white" aria-hidden="true"><CatIcon size={22} /></div>
    </div>
  );
}

type ChallengeCardProps = {
  challenge: Challenge;
  status: string | null;
  isLoading: boolean;
  user: User | null;
  onStart: (id: number) => void;
  onComplete: (id: number) => void;
  onLogin: () => void;
  onInvite?: (challenge: Challenge) => void;
  onEdit?: (challenge: Challenge) => void;
  onDelete?: (challenge: Challenge) => void;
  isDaily?: boolean;
  // Groupe déjà existant pour CE défi précis (voir groupByChallengeId côté parent) — distinct de
  // `onInvite` (qui ne fait qu'ouvrir la modale pour EN créer un) : sert à la fois à rendre visible,
  // même carte repliée, qu'un défi se joue déjà à plusieurs (ce qui n'était visible auparavant
  // qu'en comptant les participants une fois la carte dépliée), et à donner accès au tchat/à
  // l'invitation de membres supplémentaires sans passer par la section "Défis en groupe".
  activeGroup?: ChallengeGroupType | null;
  onOpenChat?: (groupId: number) => void;
  onInviteMore?: (group: ChallengeGroupType) => void;
  // Replié par défaut (voir open ci-dessous) sauf dans "À faire", pensée pour un coup d'œil sans
  // clic supplémentaire — la replier là-bas aurait annulé l'intérêt de la section.
  defaultOpen?: boolean;
  // Force le dépliage (ex: défi ciblé depuis "Ta journée" sur l'accueil, voir focusChallengeId
  // côté parent) — contrairement à `defaultOpen`, réagit même après le montage de la carte : le
  // ciblage arrive via un effet déclenché par la navigation, donc après le premier rendu.
  forceOpen?: boolean;
};

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, status, isLoading, user, onStart, onComplete, onLogin, onInvite, onEdit, onDelete, isDaily, activeGroup, onOpenChat, onInviteMore, defaultOpen, forceOpen }) => {
  const { t } = useTranslation();
  const diff = DIFF_GRAD[challenge.difficulty] ?? DIFF_GRAD.EASY;
  const cat  = CATEGORY_GRAD[challenge.category] ?? CATEGORY_GRAD.GAMING;
  const CatIcon = cat.Icon;
  const [expanded, setExpanded] = useState(false);
  // Le défi du jour se déplie automatiquement, où qu'il apparaisse (En cours/Disponibles) — c'est
  // le seul mis en avant visuellement (bordure dorée), le replier par défaut comme les autres
  // cacherait justement ce qui le rend spécial. `isDaily` peut arriver après le premier rendu (le
  // défi du jour se charge par un appel séparé) d'où l'effet, en plus de l'état initial.
  const [open, setOpen] = useState(!!defaultOpen || !!forceOpen || !!isDaily);
  useEffect(() => { if (forceOpen || isDaily) setOpen(true); }, [forceOpen, isDaily]);
  const hasLongDescription = challenge.description.length > 120;
  const joinedGroupMembers = activeGroup?.members.filter(m => m.status !== 'INVITED') ?? [];
  const activeGroupMemberCount = joinedGroupMembers.filter(m => m.status === 'JOINED' || m.status === 'COMPLETED').length;
  const activeGroupAllDone = joinedGroupMembers.length > 0 && joinedGroupMembers.every(m => m.status === 'COMPLETED');
  const canInviteMoreToGroup = !!activeGroup && !!user
    && (user.id === activeGroup.createdBy || activeGroup.members.some(m => m.userId === user.id && m.status === 'JOINED'))
    && activeGroup.members.length < 4 && !activeGroupAllDone;

  const actionButton = () => {
    if (!user) return (
      <button onClick={onLogin}
        className="q-press w-full py-2.5 rounded-full text-white font-bold text-sm transition-opacity hover:opacity-85"
        style={{ background: 'var(--q-accent)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
        {t('challengePage.card.loginToParticipate')}
      </button>
    );
    if (status === 'COMPLETED') return (
      <div className="w-full py-2.5 rounded-full text-center font-bold text-sm"
        style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)', color: '#fff',
          boxShadow: '0 4px 12px rgba(52,211,153,0.40)' }}>
        {t('challengePage.card.completed')}
      </div>
    );
    if (status === 'IN_PROGRESS') return (
      <button onClick={() => onComplete(challenge.id)} disabled={isLoading}
        className="q-press w-full py-2.5 rounded-full text-white font-bold text-sm disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)', boxShadow: '0 4px 12px rgba(52,211,153,0.40)' }}>
        {isLoading ? '...' : t('challengePage.card.markCompleted')}
      </button>
    );
    return (
      <button onClick={() => onStart(challenge.id)} disabled={isLoading}
        className="q-press w-full py-2.5 rounded-full text-white font-bold text-sm disabled:opacity-60"
        style={{ background: 'var(--q-vibrant-lavender)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
        {isLoading ? '...' : t('challengePage.card.start')}
      </button>
    );
  };

  return (
    // Enveloppe en padding (voir la même note dans SeriesDropdown plus bas) plutôt qu'un double
    // background-clip padding-box/border-box, qui souffre d'un bug de repaint sur certains
    // navigateurs quand un élément voisin change de hauteur (repli d'une autre section).
    <div className="transition-transform hover:-translate-y-0.5" style={{
      borderRadius: isDaily ? 17.5 : 16,
      padding: isDaily ? 1.5 : 0,
      background: isDaily ? 'var(--q-vibrant-gold)' : 'transparent',
      boxShadow: isDaily ? '0 8px 20px -8px rgba(251,146,60,0.55)' : 'none',
    }}>
    <div className="rounded-2xl"
      style={{
        border: isDaily ? 'none' : '1px solid var(--q-line)',
        background: 'var(--q-chrome)',
        boxShadow: 'var(--q-shadow)',
      }}>

      <div className="flex items-start gap-3 p-4">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-start gap-3 flex-1 min-w-0 text-left">
          <IconTile cat={challenge.category} />
          <div className="flex-1 min-w-0">
            {/* `flex-nowrap` + défilement horizontal plutôt que `flex-wrap` : sur une carte étroite
                (mobile, plusieurs badges dont "+50%"/"Groupe"), le retour à la ligne faisait
                grandir cette zone au-delà de la hauteur des icônes de statut à droite (rangée
                centrée verticalement), qui semblaient alors chevaucher les badges repassés en
                dessous. Un seul badge à la fois peut sortir du cadre, mais jamais de chevauchement. */}
            <div className="flex flex-nowrap gap-1.5 mb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <VibrantChip grad={diff.grad} glow={diff.glow}>{diff.icon}{t(`common.difficulty.${challenge.difficulty.toLowerCase()}`)}</VibrantChip>
              <VibrantChip grad={cat.grad} glow={cat.glow}><CatIcon size={11} aria-hidden="true" /> {t(`common.category.${challenge.category}`)}</VibrantChip>
              {/* Rendu visible même carte repliée — auparavant seul le compteur de participants
                  (une fois la carte dépliée) laissait deviner qu'un défi se jouait déjà à plusieurs. */}
              {activeGroup && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', boxShadow: '0 3px 10px -2px rgba(167,139,250,0.5)' }}>
                  <Users size={10} aria-hidden="true" />
                  {activeGroupMemberCount > 0 ? `${t('challengePage.card.group')} · ${activeGroupMemberCount}` : t('challengePage.card.group')}
                </span>
              )}
            </div>
            {/* `overflowWrap: 'anywhere'` — un texte SANS espace (ex: un titre au maximum des 80
                caractères autorisés, ou un spam d'un seul "mot" continu) ne trouve aucun point de
                coupure normal et débordait de la carte au lieu de simplement passer à la ligne. */}
            <h3 className="font-bold text-sm leading-snug" style={{ color: 'var(--q-text)', overflowWrap: 'anywhere' }}>{challenge.title}</h3>
          </div>
        </button>
        {/* Repliée, seule la bascule d'ouverture reste dans cette rangée — le statut et les
            actions auteur (crayon/poubelle) n'ont plus leur place ici : sur une carte étroite,
            ils se disputaient l'espace avec les badges au point de sembler les chevaucher.
            Elles rejoignent maintenant la rangée coins/XP, visible seulement une fois dépliée
            (voir plus bas), où il y a la place de les aligner proprement à droite. */}
        <button type="button" onClick={() => setOpen(o => !o)} aria-label={open ? t('challengePage.card.seeLess') : t('challengePage.card.seeMore')}
          className="flex-shrink-0" style={{ color: 'var(--q-text3)', display: 'flex', alignItems: 'center' }}>
          {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="text-xs leading-relaxed" style={{ color: 'var(--q-text2)' }}>
            <p className={expanded ? '' : 'line-clamp-2'} style={{ overflowWrap: 'anywhere' }}>{challenge.description}</p>
            {hasLongDescription && (
              <button type="button" onClick={() => setExpanded(e => !e)}
                className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-500 hover:text-sky-400 transition-colors">
                {expanded ? t('challengePage.card.seeLess') : t('challengePage.card.seeMore')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold" style={{ color: '#FB923C' }}>
              {challenge.coinReward}{isDaily ? ` → ${Math.floor(challenge.coinReward * 1.5)}` : ''} {t('challengePage.card.coins')}
            </span>
            <span className="font-bold" style={{ color: '#A78BFA' }}>
              <Zap size={11} aria-hidden="true" className="inline mr-0.5" />
              {challenge.xpReward}{isDaily ? ` → ${Math.floor(challenge.xpReward * 1.5)}` : ''} XP
            </span>
            {isDaily && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-900 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#FACC15,#FB923C)', boxShadow: '0 3px 10px -2px rgba(251,146,60,0.5)' }}>
                <Sparkles size={10} aria-hidden="true" /> +50%
              </span>
            )}
            {/* `_count.participants` compte 1 dès que le créateur seul a commencé le défi — pas
                un vrai groupe. On n'affiche le badge que si quelqu'un d'autre a aussi rejoint. */}
            {challenge._count && challenge._count.participants > 1 && (
              <span className="font-semibold" style={{ color: 'var(--q-text3)' }}>
                {t('challengePage.card.participants', { count: challenge._count.participants })}
              </span>
            )}
            {/* Statut + actions auteur, alignés à droite de cette même rangée — voir la note
                plus haut sur pourquoi ils ne sont plus dans l'en-tête repliée. */}
            <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
              {status === 'COMPLETED'   && <CheckCircle size={16} aria-hidden="true" className="text-emerald-400" />}
              {status === 'IN_PROGRESS' && <Clock size={16} aria-hidden="true" className="text-sky-400" />}
              {/* Auteur seulement — évite d'avoir à supprimer/recréer le défi pour corriger une coquille */}
              {user && challenge.creator?.id === user.id && (
                <>
                  {onEdit && (
                    <button type="button" onClick={() => onEdit(challenge)} aria-label={t('editChallenge.editButtonLabel')}
                      className="q-press" style={{
                        width: 26, height: 26, borderRadius: 8, border: '1px solid var(--q-line)',
                        background: 'var(--q-bg-flat)', color: 'var(--q-text2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      }}>
                      <Pencil size={12} aria-hidden="true" />
                    </button>
                  )}
                  {onDelete && (
                    <button type="button" onClick={() => onDelete(challenge)} aria-label={t('editChallenge.deleteButtonLabel')}
                      className="q-press" style={{
                        width: 26, height: 26, borderRadius: 8, border: '1px solid var(--q-line)',
                        background: 'var(--q-bg-flat)', color: '#EF4444',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      }}>
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {actionButton()}

          {/* Groupe déjà existant : tchat + invitation de membres supplémentaires, directement
              depuis la carte — auparavant seule la section "Défis en groupe" (repliable, donc
              plus si facile à retrouver) donnait accès à ces actions. */}
          {activeGroup ? (
            <div className="flex gap-2">
              {onOpenChat && (
                <button onClick={() => onOpenChat(activeGroup.id)}
                  className="q-press flex-1 py-2 rounded-full font-bold text-xs flex items-center justify-center gap-1.5"
                  style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent)', border: '1px solid var(--q-accent)' }}>
                  <MessageCircle size={12} aria-hidden="true" /> {t('challengePage.series.chat')}
                </button>
              )}
              {onInviteMore && canInviteMoreToGroup && (
                <button onClick={() => onInviteMore(activeGroup)}
                  className="q-press flex-1 py-2 rounded-full font-bold text-xs flex items-center justify-center gap-1.5"
                  style={{ background: 'var(--q-bg)', color: 'var(--q-text2)', border: '1px dashed var(--q-line)' }}>
                  <Plus size={12} aria-hidden="true" /> {t('challengePage.groupCard.inviteFriendsSlots', { count: 4 - activeGroup.members.length })}
                </button>
              )}
            </div>
          ) : onInvite && user && status !== 'COMPLETED' && (
            <button onClick={() => onInvite(challenge)}
              className="q-press w-full py-2 rounded-full font-bold text-xs flex items-center justify-center gap-1.5"
              style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent)', border: '1px solid var(--q-accent)' }}>
              <Users size={12} aria-hidden="true" /> {t('challengePage.card.groupChallenge')}
            </button>
          )}
        </div>
      )}
    </div>
    </div>
  );
};

type SectionHeaderProps = {
  icon: React.ReactNode; label: string; count: number; grad: string;
  onClick?: () => void; isOpen?: boolean;
  // Petite pastille rouge "notification" au niveau de la catégorie (ex: nouveau message dans un
  // groupe) — visible même section repliée, sans avoir à ouvrir chaque série pour le repérer.
  unreadCount?: number;
};
// Même habillage "carte" que les menus déroulants de la page profil (voir InfoSection dans
// ProfilePage.tsx) — icône dans une tuile dégradée, titre, badge de compte, chevron — plutôt que
// juste un titre nu flottant sur le fond de page, pour une UI cohérente entre les deux pages.
const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, label, count, grad, onClick, isOpen, unreadCount }) => {
  const content = (
    <>
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: grad }}>
        {icon}
      </div>
      <h2 className="flex-1 min-w-0 font-bold text-base truncate" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>{label}</h2>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: grad }}>{count}</span>
      {!!unreadCount && (
        <span aria-label={`${unreadCount}`} className="flex-shrink-0 text-xs font-bold text-white rounded-full flex items-center justify-center"
          style={{ background: '#EF4444', minWidth: 18, height: 18, padding: unreadCount > 9 ? '0 4px' : 0 }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className="q-press w-full flex items-center gap-3 p-4 text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
        {content}
        <span className="flex-shrink-0" style={{ color: 'var(--q-text3)' }}>
          {isOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </span>
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3 p-4">
      {content}
    </div>
  );
};


type SeriesGroupMember = { id: number; userId: number; status: string; confirmedAt?: string | null; user: { id: number; username: string; avatar?: string; cosmetics?: EquippedCosmetic[] } };
type SeriesGroupData = { id: number; seriesName: string; createdBy: number; completedAt?: string | null; members: SeriesGroupMember[]; progress?: { userId: number; done: number; total: number }[] };
type FriendEntry = { friendshipId: number; user: { id: number; username: string; avatar?: string; cosmetics?: EquippedCosmetic[] } };
type SeriesGroupMsg = { id: number; groupId: number; userId: number; content: string; createdAt: string; user: { id: number; username: string; avatar?: string; cosmetics?: EquippedCosmetic[] } };
type PendingSeriesInvite = { id: number; seriesName: string; creator: { id: number; username: string; avatar?: string; cosmetics?: EquippedCosmetic[] }; members: SeriesGroupMember[] };

const SeriesDropdown: React.FC<{
  name: string;
  displayName?: string;
  challenges: Challenge[];
  actionLoading: number | null;
  getUserStatus: (id: number) => string | null;
  onStart: (id: number) => void;
  onComplete: (id: number) => void;
  user: User | null;
  onJoined?: () => void;
  onGroupChange?: () => void;
  showNotif: (msg: string, type: 'success' | 'error') => void;
  onEdit?: (challenge: Challenge) => void;
  onDelete?: (challenge: Challenge) => void;
  // Rafraîchit les données complètes de cette série (voir seriesFullChallenges côté parent) —
  // utilisé après une complétion pour que `daysUntilUnlock` (voir Challenge.daysUntilUnlock)
  // reflète immédiatement le nouveau déverrouillage, sans attendre un rechargement de page.
  onRefreshSeries?: () => void;
  // Ouverture + scroll automatiques quand on arrive depuis une carte de la page d'accueil
  // ("Ta journée") — voir focusChallengeId dans ChallengePage.
  forceOpenSeries?: string | null;
  focusChallengeId?: number | null;
  // Un groupe de série actif (non validé) existe pour CETTE série (voir activeSeriesGroupNames
  // côté parent) — teinte l'en-tête en violet pour repérer d'un coup d'œil, sans avoir à ouvrir
  // chaque accordéon, quelles séries se jouent actuellement à plusieurs.
  hasGroup?: boolean;
}> = ({ name, displayName, challenges, actionLoading, getUserStatus, onStart, onComplete, user, onJoined, onGroupChange, showNotif, onEdit, onDelete, onRefreshSeries, forceOpenSeries, focusChallengeId, hasGroup }) => {
  const { t } = useTranslation();
  // `name` reste la clé stable (FR) utilisée pour les endpoints by-series/series-groups
  // (join/invite/kick/chat...) ; `label` est uniquement pour l'affichage traduit.
  const label = displayName ?? name;
  const { notifData, openGroupChat } = useStore();
  // Badge "nouveau message" sur l'en-tête repliée — sans ça, un message reçu dans un groupe
  // n'est visible qu'après avoir déjà ouvert la série (le compteur du panneau membre est à
  // l'intérieur), donc impossible de savoir quelle série a du nouveau depuis la liste.
  //
  // Rien n'empêche un même utilisateur d'appartenir à PLUSIEURS SeriesGroup pour le même
  // seriesName (ex: un ancien groupe resté vide + un nouveau créé plus tard) — le panneau membre
  // le gère déjà (GET /api/series-groups/by-series/:seriesName, "most JOINED members" côté
  // backend), mais un simple `.find()` ici prenait toujours le PREMIER groupe trouvé, quitte à
  // afficher "rien de neuf" alors qu'un doublon plus loin dans la liste avait le vrai message :
  // on regarde donc TOUS les groupes de cette série, pas juste le premier.
  const seriesNotifs = notifData?.groups.filter(g => g.seriesName === name) ?? [];
  const unreadSeriesNotif = user ? seriesNotifs.find(g => isGroupUnread(g, user.id)) : undefined;
  const hasUnreadMessage = !!unreadSeriesNotif;
  // Marque TOUS les groupes de cette série comme lus (pas seulement celui avec le message non lu)
  // dans le même store que la cloche de notifs (voir UQuail.tsx) — sans ça, ouvrir le tchat ici ne
  // fait disparaître le badge que de ce composant, pas de la notif globale, qui resterait affichée
  // jusqu'à l'ouverture du panneau d'accueil.
  const markSeriesSeen = () => {
    if (!user) return;
    const seenKey = `notif_seen_${user.id}`;
    const currentSeen = JSON.parse(localStorage.getItem(seenKey) ?? '{}');
    const seenGroups = { ...currentSeen.groups };
    for (const g of seriesNotifs) {
      if (g.latestMessageId) seenGroups[String(g.groupId)] = g.latestMessageId;
    }
    localStorage.setItem(seenKey, JSON.stringify({ ...currentSeen, groups: seenGroups }));
  };
  const [unreadHeaderCount, setUnreadHeaderCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<SeriesGroupData | null | undefined>(undefined); // undefined=loading, null=none
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Remplace window.confirm() — dialogue natif du navigateur, ni stylable ni traduit par l'app
  // (voir FriendsPage.tsx pour le même correctif).
  const [confirmKick, setConfirmKick] = useState<{ userId: number; username: string } | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [startingAll, setStartingAll] = useState(false);
  const [kickLoading, setKickLoading] = useState<number | null>(null);

  const token = () => localStorage.getItem('token') ?? '';

  // Récupère un compte précis de messages non lus pour le badge de l'en-tête repliée — seulement
  // quand `hasUnreadMessage` est vrai (donc peu coûteux : la plupart des séries n'ont rien de
  // neuf et ne déclenchent aucun appel), en comparant aux mêmes IDs "vus" que le badge lui-même
  // pour rester cohérent avec lui.
  useEffect(() => {
    if (!hasUnreadMessage || !user || !unreadSeriesNotif) { setUnreadHeaderCount(0); return; }
    let cancelled = false;
    fetch(`/api/series-groups/${unreadSeriesNotif.groupId}/messages`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then((data: SeriesGroupMsg[] | null) => {
        if (cancelled || !Array.isArray(data)) return;
        const seen = JSON.parse(localStorage.getItem(`notif_seen_${user.id}`) ?? '{}');
        const seenId = seen.groups?.[String(unreadSeriesNotif.groupId)] ?? 0;
        setUnreadHeaderCount(data.filter(m => m.id > seenId && m.userId !== user.id).length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnreadMessage, unreadSeriesNotif?.groupId, unreadSeriesNotif?.latestMessageId, user?.id]);

  // Le dropdown se re-rend souvent sans changement de `challenges` (frappe dans le tchat,
  // ticks de polling...) : useMemo évite de re-trier à chaque fois pour rien.
  const sorted = useMemo(() => [...challenges].sort((a, b) => {
    const n = (t: string) => Number.parseInt(/\d+/.exec(t)?.[0] ?? '0', 10);
    return n(a.title) - n(b.title);
  }), [challenges]);
  const doneCount = sorted.filter(c => getUserStatus(c.id) === 'COMPLETED').length;
  const startableCount = sorted.filter(c => getUserStatus(c.id) === null).length;
  const myMembership = group?.members.find(m => m.userId === user?.id);
  const joinedMembers = group?.members.filter(m => m.status === 'JOINED') ?? [];
  // Chaque membre doit valider individuellement sa participation — le groupe ne passe
  // "terminé" que lorsque tous les membres JOINED ont cliqué (voir handleCompleteSeries).
  const myProgress = group?.progress?.find(p => p.userId === user?.id);
  const myDone = !!myProgress && myProgress.total > 0 && myProgress.done === myProgress.total;
  const myConfirmed = !!myMembership?.confirmedAt;
  const pendingConfirmCount = joinedMembers.filter(m => !m.confirmedAt).length;

  const refreshGroup = () => {
    if (!user) return;
    setGroup(undefined);
    fetch(`/api/series-groups/by-series/${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(data => setGroup(data ?? null))
      .catch(() => setGroup(null));
  };

  // Rafraîchit la progression du groupe sans flash de chargement (utilisé après avoir complété un défi,
  // pour que le bouton "Marquer la série comme terminée" apparaisse tout de suite si c'était le dernier)
  const handleCompleteAndRefresh = async (id: number) => {
    await onComplete(id);
    // Sans ça, `daysUntilUnlock` (voir Challenge.daysUntilUnlock) reste celui du dernier
    // chargement de la série — le prochain jour à débloquer resterait affiché comme verrouillé
    // jusqu'au prochain rechargement complet de la page, alors que la complétion vient de faire
    // avancer la date de référence.
    onRefreshSeries?.();
    if (!group) return;
    fetch(`/api/series-groups/by-series/${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(data => setGroup(data ?? null))
      .catch(() => {});
  };

  // Ouvre automatiquement la série visée en arrivant depuis une carte de la page d'accueil.
  useEffect(() => {
    if (forceOpenSeries === name) setOpen(true);
  }, [forceOpenSeries, name]);

  // Une fois ouvert (et une fois la série ciblée), fait défiler jusqu'au défi précis — la liste
  // des défis est déjà en mémoire (prop `challenges`), donc pas besoin d'attendre un fetch : un
  // seul frame suffit pour que le DOM soit à jour après le changement de `open`.
  useEffect(() => {
    if (!open || forceOpenSeries !== name || focusChallengeId == null) return;
    const raf = requestAnimationFrame(() => {
      document.querySelector(`[data-challenge-id="${focusChallengeId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, forceOpenSeries, name, focusChallengeId]);

  // Refetch à chaque ouverture
  useEffect(() => {
    if (!open || !user) return;
    refreshGroup();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, name]);

  // Polling silencieux toutes les 10s pendant que le dropdown est ouvert
  useVisibilityPausedInterval(() => {
    fetch(`/api/series-groups/by-series/${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(data => setGroup(data ?? null))
      .catch(() => {});
  }, 10000, open && !!user);

  // Fetch friends when create or invite panel opens
  useEffect(() => {
    if ((!showCreate && !showInvite) || friends.length > 0) return;
    fetch('/api/friends', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(data => setFriends(Array.isArray(data) ? data.filter((f: FriendEntry) => f.user) : []));
  }, [showCreate, showInvite, friends.length]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/series-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ seriesName: name, friendIds: selectedFriends }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      refreshGroup();
      setShowCreate(false);
      setSelectedFriends([]);
    } catch (e: unknown) {
      showNotif(e instanceof Error ? e.message : t('challengePage.notif.genericError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async () => {
    if (!group) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/series-groups/${group.id}/join`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (res.ok) {
        setGroup(data); // response includes all members + progress — no findFirst ambiguity
        onJoined?.();
        onGroupChange?.();
      } else {
        showNotif(data.error ?? t('challengePage.notif.genericError'), 'error');
        if (res.status === 410) setGroup(null); // invitation supprimée côté serveur (expirée ou groupe déjà terminé)
      }
    } finally { setSaving(false); }
  };

  const handleLeave = async () => {
    if (!group) return;
    setSaving(true);
    try {
      await fetch(`/api/series-groups/${group.id}/leave`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
      setGroup(null);
      onGroupChange?.();
    } finally { setSaving(false); }
  };

  const handleStartAll = async () => {
    if (startingAll) return;
    setStartingAll(true);
    try {
      const res = await fetch(`/api/challenges/series/${encodeURIComponent(name)}/start-all`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) onJoined?.();
    } finally { setStartingAll(false); }
  };

  const handleCompleteSeries = async () => {
    if (!group) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/series-groups/${group.id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (res.ok) { setGroup(data); onGroupChange?.(); }
      else showNotif(data.error ?? t('challengePage.notif.genericError'), 'error');
    } finally { setSaving(false); }
  };

  const handleKick = async (targetUserId: number) => {
    if (!group) return;
    setKickLoading(targetUserId);
    try {
      const res = await fetch(`/api/series-groups/${group.id}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (res.ok) setGroup(data);
      else showNotif(data.error ?? t('challengePage.notif.genericError'), 'error');
    } finally { setKickLoading(null); }
  };

  const handleInvite = async () => {
    if (!group || !selectedFriends.length) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/series-groups/${group.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ friendIds: selectedFriends }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      refreshGroup();
      setShowInvite(false);
      setSelectedFriends([]);
    } catch (e: unknown) {
      showNotif(e instanceof Error ? e.message : t('challengePage.notif.genericError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleFriend = (id: number) =>
    setSelectedFriends(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ── Rendu de la validation de fin de série (extrait pour éviter un ternaire imbriqué) ──
  const renderCompletionStatus = (): React.ReactNode => {
    if (!group) return null;
    if (group.completedAt) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px', borderRadius: 12, marginTop: 12,
          background: 'linear-gradient(135deg,rgba(52,211,153,0.2),rgba(56,189,248,0.2))',
          color: '#34D399', fontSize: 13, fontWeight: 700,
        }}>
          <PartyPopper size={14} aria-hidden="true" /> {t('challengePage.series.seriesCompletedInGroup')}
        </div>
      );
    }
    if (myConfirmed) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px', borderRadius: 12, marginTop: 12,
          background: 'var(--q-accent-soft)', color: 'var(--q-text2)', fontSize: 12, fontWeight: 600,
        }}>
          {t('challengePage.series.waitingMembers', { count: pendingConfirmCount })}
        </div>
      );
    }
    if (myDone) {
      return (
        <button type="button" onClick={handleCompleteSeries} disabled={saving} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          width: '100%', padding: '10px', borderRadius: 12, border: 'none', marginTop: 12,
          background: 'linear-gradient(135deg,#34D399,#38BDF8)', color: '#fff',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1,
        }}>
          {saving ? '…' : <><CheckCircle size={14} aria-hidden="true" /> {t('challengePage.series.validateParticipation')}</>}
        </button>
      );
    }
    return null;
  };

  // ── Modale de confirmation "quitter le groupe" (hors du bloc JOINED pour ne pas disparaître au refetch) ──
  const renderLeaveDialog = (): React.ReactNode => {
    if (!confirmLeave) return null;
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }} onClick={() => setConfirmLeave(false)}>
        <div onClick={e => e.stopPropagation()} style={{
          background: 'var(--q-chrome)', borderRadius: 24,
          border: '1px solid var(--q-line)',
          padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Users size={22} color="#EF4444" aria-hidden="true" />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--q-text)', marginBottom: 8 }}>{t('challengePage.series.leaveConfirmTitle')}</div>
          <div style={{ fontSize: 13, color: 'var(--q-text2)', marginBottom: 24, lineHeight: 1.5 }}>
            <Trans i18nKey="challengePage.series.leaveConfirmBody" values={{ name: label }} components={{ strong: <strong style={{ color: 'var(--q-text)' }} /> }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setConfirmLeave(false)} style={{
              flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--q-line)',
              background: 'transparent', color: 'var(--q-text2)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>{t('common.cancel')}</button>
            <button type="button" onClick={() => { setConfirmLeave(false); handleLeave(); }} disabled={saving} style={{
              flex: 1, padding: '12px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg,#EF4444,#DC2626)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}>{saving ? '…' : t('challengePage.series.leave')}</button>
          </div>
        </div>
      </div>
    );
  };

  const renderKickDialog = (): React.ReactNode => {
    if (!confirmKick) return null;
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }} onClick={() => setConfirmKick(null)}>
        <div onClick={e => e.stopPropagation()} style={{
          background: 'var(--q-chrome)', borderRadius: 24,
          border: '1px solid var(--q-line)',
          padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Users size={22} color="#EF4444" aria-hidden="true" />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--q-text)', marginBottom: 8 }}>
            {t('challengePage.series.excludeTitle', { username: confirmKick.username })}
          </div>
          <div style={{ fontSize: 13, color: 'var(--q-text2)', marginBottom: 24, lineHeight: 1.5 }}>
            {t('challengePage.series.excludeConfirm', { username: confirmKick.username })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setConfirmKick(null)} style={{
              flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--q-line)',
              background: 'transparent', color: 'var(--q-text2)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>{t('common.cancel')}</button>
            <button type="button" onClick={() => { const userId = confirmKick.userId; setConfirmKick(null); handleKick(userId); }} disabled={kickLoading === confirmKick.userId} style={{
              flex: 1, padding: '12px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg,#EF4444,#DC2626)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              opacity: kickLoading === confirmKick.userId ? 0.6 : 1,
            }}>{kickLoading === confirmKick.userId ? '…' : t('challengePage.series.exclude')}</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Panneau membre (invitation, liste + progression, validation, actions) ──
  const renderJoinedPanel = (): React.ReactNode => {
    if (!group || myMembership?.status !== 'JOINED') return null;
    return (
      <div>
        {/* ── En-tête membre ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--q-text)' }}>
            <Users size={12} style={{ display: 'inline', marginRight: 4 }} aria-hidden="true" />
            {t('challengePage.series.membersCount', { count: group.members.filter(m => m.status === 'JOINED').length })}
          </span>
          {!group.completedAt && (
            <button type="button" onClick={() => { setShowInvite(p => !p); setSelectedFriends([]); }} style={{
              display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
              fontSize: 11, color: 'var(--q-accent)', cursor: 'pointer', fontWeight: 700,
            }}><UserPlus size={12} aria-hidden="true" /> {t('challengePage.series.invite')}</button>
          )}
        </div>

        {/* ── Panneau d'invitation post-création ── */}
        {showInvite && (
          <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--q-bg)', border: '1px solid var(--q-line)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--q-text)', marginBottom: 8 }}>{t('challengePage.series.inviteFriends')}</div>
            {friends.length === 0 && <div style={{ fontSize: 11, color: 'var(--q-text3)', marginBottom: 8 }}>{t('challengePage.series.noFriends')}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {friends
                .filter(f => !group.members.some(m => m.userId === f.user.id))
                .slice(0, 5)
                .map(f => {
                  const sel = selectedFriends.includes(f.user.id);
                  return (
                    <button key={f.user.id} type="button" onClick={() => toggleFriend(f.user.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10,
                      border: `1.5px solid ${sel ? 'var(--q-accent)' : 'var(--q-line)'}`,
                      background: sel ? 'var(--q-accent-soft)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                      <UserAvatar avatar={f.user.avatar} username={f.user.username} cosmetics={f.user.cosmetics ?? []} size="sm" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--q-text)', flex: 1 }}>{f.user.username}</span>
                      {sel && <CheckCircle size={13} style={{ color: 'var(--q-accent)' }} />}
                    </button>
                  );
                })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setShowInvite(false); setSelectedFriends([]); }} style={{
                flex: 1, padding: '7px', borderRadius: 10, border: '1px solid var(--q-line)',
                background: 'transparent', color: 'var(--q-text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{t('common.cancel')}</button>
              <button type="button" onClick={handleInvite} disabled={saving || !selectedFriends.length} style={{
                flex: 2, padding: '7px', borderRadius: 10, border: 'none',
                background: selectedFriends.length ? 'var(--q-accent)' : 'var(--q-line)',
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: selectedFriends.length ? 'pointer' : 'default',
                opacity: saving ? 0.6 : 1,
              }}>{saving ? '…' : t('challengePage.series.inviteCount', { count: selectedFriends.length })}</button>
            </div>
          </div>
        )}

        {/* ── Liste membres + progression ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {group.members.map(m => {
            const prog = group.progress?.find(p => p.userId === m.userId);
            const pct = prog ? Math.round((prog.done / (prog.total || 1)) * 100) : 0;
            const memberDone = !!prog && prog.total > 0 && prog.done === prog.total;
            const isCreator = group.createdBy === user?.id;
            const isMe = m.userId === user?.id;
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserAvatar avatar={m.user.avatar} username={m.user.username} cosmetics={m.user.cosmetics ?? []} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: m.status === 'INVITED' ? 'var(--q-text3)' : 'var(--q-text)' }}>
                      {m.user.username}{m.status === 'INVITED' ? t('challengePage.series.invitedSuffix') : ''}
                    </span>
                    {memberDone ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: m.confirmedAt ? '#34D399' : 'var(--q-text3)' }}>
                        <CheckCircle size={11} aria-hidden="true" /> {m.confirmedAt ? t('challengePage.series.validated') : t('challengePage.series.doneWaitingConfirm')}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--q-text3)', fontFamily: 'var(--q-mono)' }}>
                        {prog ? `${prog.done}/${prog.total}` : '—'}
                      </span>
                    )}
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: 'var(--q-line)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: memberDone ? '#34D399' : 'var(--q-accent)', transition: 'width 0.3s' }} />
                  </div>
                </div>
                {isCreator && !isMe && !group.completedAt && (
                  <button
                    type="button"
                    onClick={() => setConfirmKick({ userId: m.userId, username: m.user.username })}
                    disabled={kickLoading === m.userId}
                    title={t('challengePage.series.excludeTitle', { username: m.user.username })}
                    style={{
                      width: 26, height: 26, borderRadius: '50%', border: 'none', flexShrink: 0,
                      background: 'rgba(239,68,68,0.12)', color: '#EF4444',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: kickLoading === m.userId ? 'default' : 'pointer',
                      opacity: kickLoading === m.userId ? 0.5 : 1,
                      fontSize: 11, fontWeight: 800,
                    }}
                  >
                    {kickLoading === m.userId ? '…' : <X size={12} aria-hidden="true" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Validation de fin de série en groupe : chaque membre confirme individuellement ── */}
        {renderCompletionStatus()}

        {/* ── Boutons d'action (masqués une fois la série terminée en groupe) ── */}
        {!group.completedAt && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => { openGroupChat(group.id); markSeriesSeen(); }} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px', borderRadius: 12, border: 'none',
              background: 'var(--q-accent)', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', position: 'relative',
            }}>
              <MessageCircle size={14} aria-hidden="true" /> {t('challengePage.series.chat')}
              {hasUnreadMessage && (
                <span aria-label={t('challengePage.series.newMessageAriaLabel', { count: unreadHeaderCount })} style={{
                  background: '#EF4444', color: '#fff', borderRadius: 999,
                  fontSize: 10, fontWeight: 800, padding: unreadHeaderCount > 9 ? '1px 5px' : '1px 0',
                  minWidth: 16, textAlign: 'center', flexShrink: 0,
                  boxShadow: '0 0 0 2px var(--q-accent)',
                }}>
                  {unreadHeaderCount > 0 ? (unreadHeaderCount > 99 ? '99+' : unreadHeaderCount) : ''}
                </span>
              )}
            </button>
            <button type="button" onClick={() => setConfirmLeave(true)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px', borderRadius: 12,
              border: '1.5px solid rgba(239,68,68,0.35)',
              background: 'rgba(239,68,68,0.08)',
              color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              {t('challengePage.series.leaveGroup')}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Section groupe de série (loading / création / invité / membre) ──
  const renderGroupSection = (): React.ReactNode => {
    if (!user) return null;
    return (
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--q-line)', background: 'var(--q-accent-soft)' }}>
        {group === undefined && <div style={{ fontSize: 12, color: 'var(--q-text3)' }}>{t('challengePage.series.loading')}</div>}

        {group === null && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            color: 'var(--q-accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0,
          }}>
            <UserPlus size={14} aria-hidden="true" /> {t('challengePage.series.createGroup')}
          </button>
        )}

        {group === null && showCreate && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--q-text)', marginBottom: 8 }}>{t('challengePage.series.inviteFriends')}</div>
            {friends.length === 0 && <div style={{ fontSize: 11, color: 'var(--q-text3)', marginBottom: 8 }}>{t('challengePage.series.noFriends')}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {friends.slice(0, 3).map(f => {
                const sel = selectedFriends.includes(f.user.id);
                return (
                  <button key={f.user.id} type="button" onClick={() => toggleFriend(f.user.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10,
                    border: `1.5px solid ${sel ? 'var(--q-accent)' : 'var(--q-line)'}`,
                    background: sel ? 'var(--q-accent-soft)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                    <UserAvatar avatar={f.user.avatar} username={f.user.username} cosmetics={f.user.cosmetics ?? []} size="sm" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--q-text)' }}>{f.user.username}</span>
                    {sel && <CheckCircle size={13} style={{ color: 'var(--q-accent)', marginLeft: 'auto' }} />}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setShowCreate(false)} style={{
                flex: 1, padding: '7px', borderRadius: 10, border: '1px solid var(--q-line)',
                background: 'transparent', color: 'var(--q-text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{t('common.cancel')}</button>
              <button type="button" onClick={handleCreate} disabled={saving} style={{
                flex: 2, padding: '7px', borderRadius: 10, border: 'none',
                background: 'var(--q-accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                opacity: saving ? 0.6 : 1,
              }}>{saving ? '…' : t('challengePage.series.createGroupButton')}</button>
            </div>
          </div>
        )}

        {group && myMembership?.status === 'INVITED' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--q-text2)' }}>{t('challengePage.series.invitedToJoin')}</span>
            <button type="button" onClick={handleJoin} disabled={saving} style={{
              padding: '5px 12px', borderRadius: 999, border: 'none',
              background: 'var(--q-accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{saving ? '…' : t('challengePage.join')}</button>
          </div>
        )}

        {renderJoinedPanel()}

        {renderLeaveDialog()}

        {renderKickDialog()}
      </div>
    );
  };

  return (
    // Enveloppe en padding (plutôt qu'un double background-clip padding-box/border-box) pour la
    // bordure dégradée : cette dernière technique souffre d'un bug de repaint sur certains
    // navigateurs quand un élément voisin change de hauteur (ex: repli du panneau "À faire") —
    // le contour dégradé restait alors partiellement effacé jusqu'au prochain repaint forcé.
    <div style={{
      borderRadius: hasGroup ? 17.5 : 16,
      padding: hasGroup ? 1.5 : 0,
      background: hasGroup ? 'var(--q-vibrant-lavender)' : 'transparent',
      boxShadow: hasGroup ? '0 8px 20px -10px rgba(167,139,250,0.5)' : 'none',
    }}>
    <div style={{
      borderRadius: 16,
      border: hasGroup ? 'none' : '1px solid var(--q-line)',
      background: 'var(--q-chrome)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button type="button" onClick={() => setOpen(prev => !prev)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        {hasGroup ? (
          <Users size={15} color="#A78BFA" aria-hidden="true" style={{ flexShrink: 0 }} />
        ) : (
          <Sparkles size={15} color="var(--q-accent)" aria-hidden="true" style={{ flexShrink: 0 }} />
        )}
        {/* `whiteSpace: normal` plutôt que `nowrap` + ellipsis : un nom de série assez long
            ("I want to learn how to play as...") se retrouvait tronqué sans aucun moyen de lire
            la suite, contrairement à la description d'un défi qui a son bouton "voir plus". Pas
            besoin d'un bouton ici — l'en-tête grandit simplement de quelques px pour montrer le
            nom en entier sur 2 lignes au lieu d'une. */}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ minWidth: 0, fontSize: 13, fontWeight: 700, color: 'var(--q-text)', lineHeight: 1.3, overflowWrap: 'anywhere' }}>
            {label}
          </span>
          {hasUnreadMessage && (
            <span aria-label={t('challengePage.series.newMessageAriaLabel', { count: unreadHeaderCount })} style={{
              background: '#EF4444', color: '#fff', borderRadius: 999,
              height: 16, minWidth: 16, padding: unreadHeaderCount > 9 ? '0 4px' : 0,
              fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{unreadHeaderCount > 0 ? (unreadHeaderCount > 99 ? '99+' : unreadHeaderCount) : ''}</span>
          )}
        </span>
        <span style={{ fontSize: 11, color: 'var(--q-text3)', fontFamily: 'var(--q-mono)', flexShrink: 0, marginRight: 4 }}>
          {doneCount}/{challenges.length}
        </span>
        {open ? <ChevronUp size={15} style={{ color: 'var(--q-text3)', flexShrink: 0 }} /> : <ChevronDown size={15} style={{ color: 'var(--q-text3)', flexShrink: 0 }} />}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--q-line)' }}>

          {user && startableCount > 1 && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--q-line)' }}>
              <button type="button" onClick={handleStartAll} disabled={startingAll} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', padding: '9px', borderRadius: 12, border: 'none',
                background: 'var(--q-vibrant-lavender)', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: startingAll ? 0.6 : 1,
              }}>
                {startingAll ? '…' : t('challengePage.series.startAll', { count: startableCount })}
              </button>
            </div>
          )}

          {/* ── Section groupe de série ── */}
          {renderGroupSection()}

          {/* ── Liste des défis ── */}
          {sorted.map((c, i) => {
            const status = getUserStatus(c.id);
            const done = status === 'COMPLETED';
            const inProgress = status === 'IN_PROGRESS';
            const diff = DIFF_GRAD[c.difficulty];
            const cat = CATEGORY_GRAD[c.category];
            const actionLabel = inProgress ? t('challengePage.card.markCompleted') : t('challengePage.series.start');
            return (
              <div key={c.id} data-challenge-id={c.id}
                className={c.id === focusChallengeId ? 'q-focus-flash' : undefined}
                style={{
                  padding: '14px 14px',
                  borderTop: i > 0 || user ? '1px solid var(--q-line)' : 'none',
                  opacity: done ? 0.55 : 1,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  {/* `nowrap` + défilement horizontal plutôt que `wrap` : sur une carte étroite, le
                      retour à la ligne des badges grandissait cette rangée au-delà de la hauteur
                      des boutons crayon/poubelle (alignés au centre), qui semblaient alors la
                      chevaucher une fois repassés en dessous. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', flex: 1, minWidth: 0, scrollbarWidth: 'none' }}>
                    {diff && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#fff', background: diff.grad, flexShrink: 0 }}>{diff.icon} {t(`common.difficulty.${c.difficulty.toLowerCase()}`)}</span>}
                    {cat && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#fff', background: cat.grad, flexShrink: 0 }}><cat.Icon size={11} aria-hidden="true" /> {t(`common.category.${c.category}`)}</span>}
                  </div>
                  {/* Auteur seulement — évite d'avoir à supprimer/recréer la série pour corriger une coquille */}
                  {user && c.creator?.id === user.id && (
                    <span className="flex items-center gap-1.5" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      {onEdit && (
                        <button type="button" onClick={() => onEdit(c)} aria-label={t('editChallenge.editButtonLabel')}
                          className="q-press" style={{
                            width: 26, height: 26, borderRadius: 8, border: '1px solid var(--q-line)',
                            background: 'var(--q-bg-flat)', color: 'var(--q-text2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}>
                          <Pencil size={12} aria-hidden="true" />
                        </button>
                      )}
                      {onDelete && (
                        <button type="button" onClick={() => onDelete(c)} aria-label={t('editChallenge.deleteButtonLabel')}
                          className="q-press" style={{
                            width: 26, height: 26, borderRadius: 8, border: '1px solid var(--q-line)',
                            background: 'var(--q-bg-flat)', color: '#EF4444',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}>
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--q-text)', marginBottom: 4 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: 'var(--q-text2)', marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {c.description}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 12, fontWeight: 700 }}>
                  <span style={{ color: '#FB923C' }}>{c.coinReward} {t('challengePage.card.coins')}</span>
                  <span style={{ color: '#A78BFA' }}><Zap size={11} aria-hidden="true" className="inline mr-0.5" />{c.xpReward} XP</span>
                </div>
                {done ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34D399', fontSize: 12, fontWeight: 700 }}>
                    <CheckCircle size={14} aria-hidden="true" /> {t('challengePage.series.done')}
                  </div>
                ) : inProgress && (c.previousDayIncomplete || !!c.daysUntilUnlock) ? (
                  // Ce jour de la série n'est pas encore déverrouillé (voir seriesLockInfo côté
                  // backend) — grisé plutôt que cliquable pour rien : sans ça, l'utilisateur ne
                  // découvrait le blocage qu'après avoir cliqué et reçu le toast d'erreur. Deux cas
                  // distincts : le jour précédent n'est pas encore validé (pas de compte à rebours
                  // connu), ou il l'est et il ne reste qu'à attendre.
                  <div style={{
                    width: '100%', padding: '9px', borderRadius: 12,
                    background: 'var(--q-bg-flat)', border: '1px solid var(--q-line)',
                    color: 'var(--q-text3)', fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <Lock size={13} aria-hidden="true" />
                    {c.previousDayIncomplete
                      ? t('challengePage.series.finishPreviousDay')
                      : t('challengePage.series.unlocksIn', { count: c.daysUntilUnlock })}
                  </div>
                ) : (
                  <button type="button" disabled={actionLoading === c.id} onClick={() => inProgress ? handleCompleteAndRefresh(c.id) : onStart(c.id)} style={{
                    width: '100%', padding: '9px', borderRadius: 12, border: 'none',
                    background: inProgress ? 'linear-gradient(135deg,#34D399,#38BDF8)' : 'var(--q-vibrant-lavender)',
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    opacity: actionLoading === c.id ? 0.5 : 1,
                  }}>
                    {actionLoading === c.id ? '…' : actionLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
};

// Construit les query params de /api/challenges — extrait de fetchChallenges pour réduire sa
// complexité cognitive (pure fonction, ne dépend d'aucun state du composant).
function buildChallengesQueryParams(skip: number, filters: { category: string; difficulty: string; search: string; lang: string }): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.difficulty) params.set('difficulty', filters.difficulty);
  if (filters.search) params.set('search', filters.search);
  params.set('skip', String(skip));
  params.set('limit', '10');
  if (filters.lang !== 'fr') params.set('lang', filters.lang);
  return params;
}

const ChallengePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  usePageTitle(t('challengePage.pageTitle'));
  const { user, setUser, notifData } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [confirmDeleteChallenge, setConfirmDeleteChallenge] = useState<Challenge | null>(null);
  const [deletingChallenge, setDeletingChallenge] = useState(false);
  const [rewardPopup, setRewardPopup] = useState<{ coins: number; xp: number; isDailyBonus: boolean; multiplier?: number; streakUp?: number; groupSize?: number; groupBonusMultiplier?: number } | null>(null);
  // "À faire" reste ouverte par défaut — c'est la seule section pensée pour un coup d'œil sans
  // clic (voir renderTodaySection) ; la replier par défaut comme les autres viderait son intérêt.
  // Tout le reste démarre replié pour alléger l'affichage initial de la page.
  const [todayOpen, setTodayOpen] = useState(true);
  const [inProgressOpen, setInProgressOpen] = useState(false);
  const [availableOpen, setAvailableOpen] = useState(false);
  const [groupsSectionOpen, setGroupsSectionOpen] = useState(false);
  const [dailyChallengeId, setDailyChallengeId] = useState<number | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<Challenge | null>(null);
  const [isDailyFilter, setIsDailyFilter] = useState(false);
  const [groups, setGroups] = useState<ChallengeGroupType[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inviteModal, setInviteModal] = useState<Challenge | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);
  const [groupActionLoading, setGroupActionLoading] = useState<number | null>(null);
  // Défi ciblé en arrivant depuis une carte de la page d'accueil ("Ta journée", voir UQuail.tsx
  // qui passe focusChallengeId/focusSeriesName via navigate(..., { state })). Nettoyé de l'état
  // de navigation tout de suite (même schéma que showOnboarding dans Layout.tsx) pour ne pas
  // redéclencher le scroll/surbrillance sur un retour en arrière ou un rafraîchissement.
  const [focusChallengeId, setFocusChallengeId] = useState<number | null>(null);
  const [focusSeriesName, setFocusSeriesName] = useState<string | null>(null);
  const [groupCreating, setGroupCreating] = useState(false);
  const [chatGroupId, setChatGroupId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<GroupMessageType[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [chatMyId, setChatMyId] = useState<number | null>(null);
  const [pendingSeriesInvites, setPendingSeriesInvites] = useState<PendingSeriesInvite[]>([]);
  const [seriesInviteLoading, setSeriesInviteLoading] = useState<number | null>(null);
  const [mySeriesGroups, setMySeriesGroups] = useState<SeriesGroupData[]>([]);
  const [seriesFullChallenges, setSeriesFullChallenges] = useState<Record<string, Challenge[]>>({});
  // Dates de complétion (toutes, non paginées) — sert uniquement à afficher les pastilles de la
  // mini-grille "cette semaine" dans la section "À faire" (voir renderTodaySection ci-dessous).
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  // Détail (pas juste la date) des défis complétés cette semaine — chargé à part de
  // completedDates ci-dessus (voir /completed-in-range) pour afficher le contenu d'un jour passé
  // cliqué dans la mini-grille, sans avoir à traduire tout l'historique du compte.
  const [weekCompletions, setWeekCompletions] = useState<{ completedAt: string; challenge: Challenge }[]>([]);
  // Jour sélectionné dans la mini-grille (0=lundi..6=dimanche) — "aujourd'hui" par défaut.
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>((new Date().getDay() + 6) % 7);
  // Décalage (en semaines) de la mini-grille par rapport à la semaine en cours — permet de
  // naviguer vers les semaines suivantes (voir renderTodaySection) pour anticiper les défis de
  // série encore verrouillés au-delà des 7 prochains jours (voir upcomingByOffset).
  const [weekOffset, setWeekOffset] = useState(0);
  // Pagination client de "À faire" (10 par 10) — ces listes sont déjà entièrement en mémoire
  // (pas de pagination serveur ici), donc un simple compteur de lignes visibles suffit. Remis à
  // 10 à chaque changement de jour sélectionné pour ne pas garder la pagination d'un autre jour.
  const [todayVisibleCount, setTodayVisibleCount] = useState(10);
  useEffect(() => { setTodayVisibleCount(10); }, [selectedDayIndex]);

  // ── Invite dans un groupe existant ────────────────────────────────────────
  const [inviteExistingGroup, setInviteExistingGroup] = useState<ChallengeGroupType | null>(null);
  const [inviteExistingFriends, setInviteExistingFriends] = useState<number[]>([]);
  const [inviteExistingLoading, setInviteExistingLoading] = useState(false);

  // ── Sections indépendantes (En cours / Terminés) ──────────────────────────
  const [inProgressItems, setInProgressItems] = useState<UserChallengeWithData[]>([]);
  const [inProgressHasMore, setInProgressHasMore] = useState(false);
  const [loadingMoreInProgress, setLoadingMoreInProgress] = useState(false);
  const [completedItems, setCompletedItems] = useState<UserChallengeWithData[]>([]);

  const token = localStorage.getItem('token');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchChallenges(0); }, [search, selectedCategory, selectedDifficulty, location.key, i18n.language]);
  useEffect(() => {
    if (!user || !token) return;
    setGroupsLoading(true);
    const langParam = i18n.language !== 'fr' ? `?lang=${i18n.language}` : '';
    fetch(`/api/users/me/dashboard${langParam}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setUserChallenges(Array.isArray(data.challenges) ? data.challenges : []);
        setInProgressItems(data.inProgress?.challenges ?? []);
        setInProgressHasMore(data.inProgress?.hasMore ?? false);
        setCompletedItems(data.completed?.challenges ?? []);
        setGroups(data.groups ?? []);
        setPendingSeriesInvites(data.pendingSeriesInvites ?? []);
      })
      .catch(() => {})
      .finally(() => setGroupsLoading(false));
    fetchMySeriesGroups();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.key, i18n.language]);

  // Le poll global des notifications (toutes les 20s, voir useNotificationPolling) détecte une
  // nouvelle invitation à une série avant ce composant, mais ne met à jour que le compteur
  // global (cloche) — sans ce second effet, une invitation reçue pendant que cette page est déjà
  // ouverte ne s'affichait qu'après un rechargement complet. `notifData.pendingSeriesInvites`
  // ne change (en valeur, donc en dépendance d'effet) que lorsque le nombre réel évolue.
  useEffect(() => {
    if (!token || notifData?.pendingSeriesInvites === undefined) return;
    fetch('/api/series-groups/pending-invites', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setPendingSeriesInvites(Array.isArray(data) ? data : []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifData?.pendingSeriesInvites]);

  // Lit la cible passée par la page d'accueil (voir focusChallengeId ci-dessus) et nettoie
  // l'état de navigation tout de suite pour ne pas la rejouer sur un retour en arrière. Le minuteur
  // ci-dessous n'est qu'un filet de sécurité (défi supprimé entre-temps, erreur réseau...) — sans
  // lui la mise en surbrillance resterait active indéfiniment si la cible n'apparaît jamais ; il
  // est volontairement long (bien plus que le temps de chargement normal) car l'effet de défilement
  // ci-dessous se charge lui-même de nettoyer dès que la carte est trouvée, voir plus bas.
  useEffect(() => {
    const navState = location.state as { focusChallengeId?: number; focusSeriesName?: string | null } | null;
    if (!navState?.focusChallengeId) return;
    setFocusChallengeId(navState.focusChallengeId);
    setFocusSeriesName(navState.focusSeriesName ?? null);
    navigate(location.pathname, { replace: true, state: {} });
    const timeout = setTimeout(() => { setFocusChallengeId(null); setFocusSeriesName(null); }, 15000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Défi solo ciblé (pas de série à ouvrir, forcément dans "En cours" — voir actionableToday, qui
  // ne retient que les défis en cours) : défile jusqu'à sa carte dès qu'elle apparaît dans le DOM.
  // Un seul essai juste après `groupsLoading` ne suffisait pas : la carte peut encore ne pas exister
  // à ce moment précis (verrou de série pas encore résolu via seriesFullChallenges, section "En
  // cours" repliée par défaut...), et la cible n'était alors jamais retentée avant que le minuteur
  // de sécurité ci-dessus ne l'efface — d'où des redirections "qui ne marchent pas" quand le
  // chargement prenait un peu plus de temps. On force maintenant "En cours" ouverte (comme
  // `forceOpenSeries` le fait déjà pour une série) pour garantir que la carte existe bien dans le
  // DOM, et on redéclenche à chaque arrivée de donnée pertinente plutôt qu'une seule fois.
  useEffect(() => {
    if (!focusChallengeId || focusSeriesName) return;
    setInProgressOpen(true);
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-challenge-id="${focusChallengeId}"]`);
      if (!el) return; // pas encore rendu — un prochain changement de dépendance retentera
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setFocusChallengeId(null), 2200);
    });
    return () => cancelAnimationFrame(raf);
  }, [focusChallengeId, focusSeriesName, groupsLoading, inProgressItems, seriesFullChallenges]);

  // Défi de série ciblé (depuis "À faire", voir focusChallengeInPage) : force "En cours" ouverte
  // pour que la SeriesDropdown concernée existe dans le DOM — elle gère ensuite elle-même son
  // propre déploiement et défilement (voir forceOpenSeries dans SeriesDropdown). Sans ce sous-
  // effet, le clic pouvait cibler une série alors que la section est repliée par défaut.
  useEffect(() => {
    if (!focusSeriesName) return;
    setInProgressOpen(true);
  }, [focusSeriesName]);

  // Groupes de série de l'utilisateur — sert uniquement à savoir si une série a un groupe
  // encore non validé (completedAt null), pour la garder dans "En cours" tant que
  // "Marquer la série comme terminée" n'a pas été cliqué par un membre.
  const fetchMySeriesGroups = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/series-groups/mine', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMySeriesGroups(Array.isArray(data) ? data : []);
    } catch { /* silencieux : classement retombe sur la progression perso */ }
  };

  // Défis complets d'une série (non paginés) — évite qu'une série à groupe actif n'apparaisse/
  // disparaisse selon ce qui a été chargé par "Charger plus" dans les listes en cours/terminés.
  const fetchSeriesChallenges = async (name: string) => {
    if (!token) return;
    try {
      const langParam = i18n.language !== 'fr' ? `?lang=${i18n.language}` : '';
      const res = await fetch(`/api/challenges/by-series/${encodeURIComponent(name)}${langParam}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setSeriesFullChallenges(prev => ({ ...prev, [name]: data }));
    } catch { /* silencieux */ }
  };

  // Dès qu'une série est repérée (via n'importe quelle liste partielle déjà chargée, ou via un
  // groupe de série), on récupère sa liste complète une bonne fois pour toutes — pour que son
  // compteur (x/y) et sa section (disponible/en cours/terminé) ne dépendent plus de la pagination.
  useEffect(() => {
    if (!user) return;
    const names = new Set<string>();
    for (const c of challenges) if (c.seriesName) names.add(c.seriesName);
    for (const uc of inProgressItems) if (uc.challenge.seriesName) names.add(uc.challenge.seriesName);
    for (const uc of completedItems) if (uc.challenge.seriesName) names.add(uc.challenge.seriesName);
    for (const g of mySeriesGroups) {
      if (!g.completedAt && g.members.some(m => m.userId === user.id && m.status === 'JOINED')) names.add(g.seriesName);
    }
    names.forEach(n => { if (!seriesFullChallenges[n]) fetchSeriesChallenges(n); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenges, inProgressItems, completedItems, mySeriesGroups, user]);

  useEffect(() => {
    // Le token est nécessaire pour que le backend écarte les défis déjà complétés par CET
    // utilisateur (sinon la suggestion peut retomber sur un défi déjà fait — voir challenges.routes.js).
    const langParam = i18n.language !== 'fr' ? `?lang=${i18n.language}` : '';
    fetch(`/api/challenges/daily-suggestion${langParam}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.id) {
          setDailyChallengeId(data.id);
          setDailyChallenge(data);
        }
      })
      .catch(() => {});
  }, [i18n.language, token]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    // Le défi du jour vit dans la section "Disponible" (repliée par défaut, voir availableOpen
    // plus haut) — sans ce dépli, le lien "voir le défi du jour" amenait sur une page où il fallait
    // encore un clic pour révéler la carte (et sa pastille +50%, visible uniquement une fois la
    // carte ouverte via son propre `isDaily`, voir ChallengeCard).
    if (params.has('daily')) { setIsDailyFilter(true); setAvailableOpen(true); }
  }, [location.search]);

  // Déplie "En cours" et "Disponible" dès qu'un filtre (recherche/catégorie/difficulté) devient
  // actif — sinon les résultats existaient bien mais restaient invisibles derrière deux sections
  // repliées par défaut, obligeant à cliquer puis scroller pour les trouver. Replie "À faire" en
  // même temps : cette section n'est PAS filtrée (volontairement — voir son propre commentaire,
  // elle reste "quoi faire aujourd'hui" même hors résultat de recherche) et son contenu non filtré
  // ne fait que gêner la lecture des résultats juste en dessous pendant une recherche active. Ne se
  // déclenche qu'au passage inactif → actif (via le ref), pas à chaque frappe : si l'utilisateur
  // rouvre "À faire" ou replie "En cours"/"Disponible" à la main pendant qu'il tape, la frappe
  // suivante ne doit pas annuler son choix.
  const hadActiveFilterRef = useRef(false);
  useEffect(() => {
    const active = !!(search.trim() || selectedCategory || selectedDifficulty);
    if (active && !hadActiveFilterRef.current) {
      setTodayOpen(false);
      setInProgressOpen(true);
      setAvailableOpen(true);
    }
    hadActiveFilterRef.current = active;
  }, [search, selectedCategory, selectedDifficulty]);

  useEffect(() => {
    if (!user || !token) { setCompletedDates([]); return; }
    fetch('/api/users/me/challenges/completed-dates', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((data: { dates: string[] } | null) => setCompletedDates(data?.dates ?? []))
      .catch(() => {});
  }, [user, token]);

  useEffect(() => {
    if (!user || !token) { setWeekCompletions([]); return; }
    // Suit `weekOffset` (voir mini-grille dans renderTodaySection) — sinon consulter un jour
    // passé d'une semaine différente de la semaine en cours continuait à afficher les complétions
    // de LA semaine en cours (fenêtre de dates jamais mise à jour).
    const from = startOfWeek(new Date());
    from.setDate(from.getDate() + weekOffset * 7);
    const to = new Date(from); to.setDate(to.getDate() + 7); // exclusif, voir `lte` côté backend
    const langParam = i18n.language !== 'fr' ? `&lang=${i18n.language}` : '';
    fetch(`/api/users/me/challenges/completed-in-range?from=${from.toISOString()}&to=${to.toISOString()}${langParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { completedAt: string; challenge: Challenge }[] | null) => setWeekCompletions(data ?? []))
      .catch(() => {});
  }, [user, token, i18n.language, weekOffset]);

  const sortChallenges = (arr: Challenge[]) => [...arr].sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category, 'fr');
    if (catCmp !== 0) return catCmp;
    return a.title.localeCompare(b.title, 'fr', { numeric: true, sensitivity: 'base' });
  });

  const fetchChallenges = async (skip: number) => {
    const isAppend = skip > 0;
    if (isAppend) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = buildChallengesQueryParams(skip, { category: selectedCategory, difficulty: selectedDifficulty, search, lang: i18n.language });
      const res = await fetch(`/api/challenges?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      // Handle both plain array and paginated { challenges, hasMore } formats
      const newChallenges: Challenge[] = Array.isArray(data) ? data : (data.challenges ?? []);
      const more = Array.isArray(data) ? false : (data.hasMore ?? false);
      if (isAppend) {
        // On trie le nouveau lot entre eux, mais on l'ajoute après ce qui est déjà affiché
        // au lieu de re-trier toute la liste : sinon les nouvelles cartes s'intercalaient au
        // milieu/en haut de la liste déjà visible au lieu d'apparaître en bas de page.
        setChallenges(prev => [...prev, ...sortChallenges(newChallenges)]);
      } else {
        setChallenges(sortChallenges(newChallenges));
      }
      setHasMore(more);
    } catch { if (!isAppend) setChallenges([]); }
    finally { if (isAppend) setLoadingMore(false); else setLoading(false); }
  };

  const fetchUserChallenges = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/users/me/challenges?limit=50', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUserChallenges(Array.isArray(data) ? data : (data.challenges ?? []));
    } catch { setUserChallenges([]); }
  };

  const fetchInProgressItems = async (skip: number) => {
    if (!token) return;
    if (skip > 0) setLoadingMoreInProgress(true);
    try {
      const langParam = i18n.language !== 'fr' ? `&lang=${i18n.language}` : '';
      const res = await fetch(`/api/users/me/challenges?status=IN_PROGRESS&limit=10&skip=${skip}${langParam}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const items: UserChallengeWithData[] = Array.isArray(data) ? data : (data.challenges ?? []);
      if (skip > 0) setInProgressItems(prev => [...prev, ...items]);
      else setInProgressItems(items);
      if (!Array.isArray(data)) setInProgressHasMore(data.hasMore ?? false);
    } catch { if (skip === 0) setInProgressItems([]); }
    finally { if (skip > 0) setLoadingMoreInProgress(false); }
  };

  // Alimente uniquement `completedItems`, utilisé pour l'effet de bord de computeSoloCompleted qui
  // garde une série au groupe pas encore validé dans "En cours" — ces défis complétés ne sont plus
  // affichés directement sur cette page (voir la section "Terminés" du profil), donc pas besoin de
  // pagination/état de chargement ici.
  const fetchCompletedItems = async (skip: number) => {
    if (!token) return;
    try {
      const langParam = i18n.language !== 'fr' ? `&lang=${i18n.language}` : '';
      const res = await fetch(`/api/users/me/challenges?status=COMPLETED&limit=10&skip=${skip}${langParam}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const items: UserChallengeWithData[] = Array.isArray(data) ? data : (data.challenges ?? []);
      if (skip > 0) setCompletedItems(prev => [...prev, ...items]);
      else setCompletedItems(items);
    } catch { if (skip === 0) setCompletedItems([]); }
  };

  const fetchGroups = async () => {
    if (!token) return;
    setGroupsLoading(true);
    try {
      const res = await fetch('/api/groups', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch { setGroups([]); }
    finally { setGroupsLoading(false); }
  };

  const fetchFriends = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setFriends(Array.isArray(data) ? data : []);
    } catch { setFriends([]); }
  };

  const handleJoinSeriesInvite = async (groupId: number) => {
    if (!token) return;
    setSeriesInviteLoading(groupId);
    try {
      const res = await fetch(`/api/series-groups/${groupId}/join`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setPendingSeriesInvites(prev => prev.filter(g => g.id !== groupId));
        globalThis.dispatchEvent(new CustomEvent('series-invite-updated'));
        showNotif(t('challengePage.notif.joinedGroup'), 'success');
        await fetchUserChallenges();
        await fetchInProgressItems(0);
      } else {
        if (res.status === 410) setPendingSeriesInvites(prev => prev.filter(g => g.id !== groupId));
        const data = await res.json().catch(() => null);
        showNotif(data?.error || t('challengePage.notif.connectionError'), 'error');
      }
    } catch { showNotif(t('challengePage.notif.connectionError'), 'error'); }
    finally { setSeriesInviteLoading(null); }
  };

  const handleDeclineSeriesInvite = async (groupId: number) => {
    if (!token) return;
    setSeriesInviteLoading(groupId);
    try {
      const res = await fetch(`/api/series-groups/${groupId}/leave`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setPendingSeriesInvites(prev => prev.filter(g => g.id !== groupId));
        globalThis.dispatchEvent(new CustomEvent('series-invite-updated'));
      }
    } catch { showNotif(t('challengePage.notif.genericError'), 'error'); }
    finally { setSeriesInviteLoading(null); }
  };

  const getUserStatus = (id: number) => userChallenges.find(c => c.challengeId === id)?.status ?? null;

  const showNotif = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleDeleteChallenge = async () => {
    if (!confirmDeleteChallenge || deletingChallenge) return;
    const id = confirmDeleteChallenge.id;
    setDeletingChallenge(true);
    try {
      const res = await fetch(`/api/challenges/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || t('editChallenge.deleteError'), 'error'); return; }
      setChallenges(prev => prev.filter(c => c.id !== id));
      setInProgressItems(prev => prev.filter(uc => uc.challenge.id !== id));
      setCompletedItems(prev => prev.filter(uc => uc.challenge.id !== id));
      setDailyChallenge(prev => prev?.id === id ? null : prev);
      if (editingChallenge?.id === id) setEditingChallenge(null);
      // Cache séparé des défis de série (voir seriesFullChallenges) — sans ce nettoyage, un défi
      // de série supprimé n'aurait disparu qu'après un rechargement complet de la page.
      setSeriesFullChallenges(prev => {
        const next: typeof prev = {};
        for (const [name, list] of Object.entries(prev)) next[name] = list.filter(c => c.id !== id);
        return next;
      });
      showNotif(t('editChallenge.deleteSuccess'), 'success');
    } catch {
      showNotif(t('editChallenge.deleteError'), 'error');
    } finally {
      setDeletingChallenge(false);
      setConfirmDeleteChallenge(null);
    }
  };

  const handleOpenInvite = (challenge: Challenge) => {
    if (!user) { navigate('/login'); return; }
    setInviteModal(challenge);
    setSelectedFriends([]);
    if (friends.length === 0) fetchFriends();
  };

  const handleCreateGroup = async () => {
    if (!inviteModal || !token || groupCreating) return;
    setGroupCreating(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: inviteModal.id, friendIds: selectedFriends }),
      });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || t('challengePage.notif.genericError'), 'error'); return; }
      setGroups(prev => [data, ...prev]);
      setInviteModal(null);
      setSelectedFriends([]);
      showNotif(t('challengePage.notif.groupCreated'), 'success');
    } catch { showNotif(t('challengePage.notif.groupCreateError'), 'error'); }
    finally { setGroupCreating(false); }
  };

  const fetchChatMessages = async (groupId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setChatMessages(data);
    } catch { /* silent */ }
    finally { setChatLoading(false); }
  };

  const openChat = async (groupId: number) => {
    setChatGroupId(groupId);
    setChatMessages([]);
    setChatInput('');
    setChatLoading(true);
    // Re-fetch l'utilisateur depuis le serveur pour avoir le bon ID (évite les données périmées)
    if (token) {
      try {
        const r = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const d = await r.json();
          if (d?.user?.id) { setChatMyId(Number(d.user.id)); setUser(d.user); }
        }
      } catch { /* silent */ }
    } else {
      setChatMyId(user?.id ?? null);
    }
    fetchChatMessages(groupId).then(() => {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior }), 50);
    });
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !chatGroupId || !token || chatSending || !user) return;
    const content = chatInput.trim();
    setChatInput('');
    // Affichage instantané (optimiste)
    const tempId = Date.now();
    const optimistic: GroupMessageType = {
      id: tempId, groupId: chatGroupId, userId: user.id, content,
      createdAt: new Date().toISOString(),
      user: { id: user.id, username: user.username, avatar: user.avatar, cosmetics: user.cosmetics ?? [] },
    };
    setChatMessages(prev => [...prev, optimistic]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 30);
    setChatSending(true);
    try {
      const res = await fetch(`/api/groups/${chatGroupId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok) {
        // Remplace le message optimiste par la vraie donnée
        setChatMessages(prev => prev.map(m => m.id === tempId ? data : m));
      } else {
        // Annule si erreur
        setChatMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch {
      setChatMessages(prev => prev.filter(m => m.id !== tempId));
    }
    finally { setChatSending(false); }
  };

  // Polling toutes les 2s quand le chat est ouvert (identique à ForumTchat)
  useVisibilityPausedInterval(() => {
    if (chatGroupId !== null) fetchChatMessages(chatGroupId);
  }, 2000, chatGroupId !== null);

  // Scroll vers le bas uniquement si l'utilisateur est déjà proche du bas
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container || !chatEndRef.current) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 80) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chatMessages]);

  const handleJoinGroup = async (groupId: number) => {
    if (!token) return;
    setGroupActionLoading(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showNotif(data?.error || t('challengePage.notif.genericError'), 'error');
        if (res.status === 410) await fetchGroups();
        return;
      }
      await fetchGroups();
      showNotif(t('challengePage.notif.joinedGroup'), 'success');
    } finally { setGroupActionLoading(null); }
  };

  const handleDeclineGroup = async (groupId: number) => {
    if (!token) return;
    setGroupActionLoading(groupId);
    try {
      await fetch(`/api/groups/${groupId}/leave`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setGroups(prev => prev.filter(g => g.id !== groupId));
    } finally { setGroupActionLoading(null); }
  };

  const toggleDailyFilter = () => {
    const next = !isDailyFilter;
    setIsDailyFilter(next);
    if (next) {
      setSelectedCategory('');
      setSelectedDifficulty('');
      setSearch('');
    }
  };

  const handleStart = async (id: number) => {
    if (!user) { navigate('/login'); return; }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/challenges/${id}/start`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || t('challengePage.notif.genericError'), 'error'); return; }
      await Promise.all([fetchUserChallenges(), fetchInProgressItems(0), fetchCompletedItems(0)]);
      showNotif(t('challengePage.notif.challengeStarted'), 'success');
    } finally { setActionLoading(null); }
  };

  const handleComplete = async (id: number) => {
    if (!user) { navigate('/login'); return; }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/challenges/${id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || t('challengePage.notif.genericError'), 'error'); return; }
      const prevStreak = user?.currentStreak ?? 0;
      if (data.user) setUser(data.user);
      await Promise.all([fetchUserChallenges(), fetchInProgressItems(0), fetchCompletedItems(0)]);
      const newStreak = data.user?.currentStreak ?? prevStreak;
      setRewardPopup({
        coins: data.coinsEarned ?? 0,
        xp: data.xpEarned ?? 0,
        isDailyBonus: !!data.isDailyBonus,
        multiplier: data.dailyMultiplier,
        streakUp: newStreak > prevStreak ? newStreak : undefined,
        groupSize: data.groupSize,
        groupBonusMultiplier: data.groupBonusMultiplier,
      });
      setTimeout(() => setRewardPopup(null), 4500);
    } finally { setActionLoading(null); }
  };

  // Réutilisé pour les défis de série ci-dessous (computeResolvedSeriesGroupings) — sinon la
  // recherche ne filtrait que les défis solo, jamais les séries (`seriesFullChallenges` en est
  // totalement indépendant).
  const matchesSearch = (c: Challenge): boolean => {
    const q = search.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  };

  // Contrairement à `matchesSearch` (voir plus bas : par choix, ne filtre QUE "Disponibles" —
  // "En cours"/"Terminés" restent affichés tels quels pour ne pas perdre de vue ce qu'on est en
  // train de faire), les filtres catégorie/difficulté doivent s'appliquer PARTOUT (À faire, En
  // cours, Disponibles) — appliqués ci-dessous à chaque source de données, y compris les séries
  // déjà résolues (voir computeResolvedSeriesGroupings) qui, sans ça, ignoraient totalement ces
  // filtres une fois chargées.
  const matchesCategoryDifficulty = (c: Challenge): boolean =>
    (!selectedCategory || c.category === selectedCategory) && (!selectedDifficulty || c.difficulty === selectedDifficulty);

  const filtered = isDailyFilter && dailyChallenge
    ? [dailyChallenge]
    : challenges.filter(matchesSearch);

  const available = filtered.filter(c => getUserStatus(c.id) === null);

  // Le backend pagine désormais par "groupe" (une série entière = 1 objet, comme un défi
  // solo) : on doit donc lui donner le nombre de groupes déjà chargés, pas le nombre brut
  // de lignes Challenge (qui compterait une série de 5 jours comme 5).
  const loadedChallengeGroupCount = new Set(challenges.map(c => c.seriesName ?? `solo-${c.id}`)).size;
  // Même logique pour "En cours", paginé séparément via /api/users/me/challenges.
  const loadedInProgressGroupCount = new Set(inProgressItems.map(uc => uc.challenge.seriesName ?? `solo-${uc.challenge.id}`)).size;

  // Quand le filtre journalier est actif, on n'affiche que le défi du jour dans sa section —
  // sinon, catégorie/difficulté s'appliquent (voir matchesCategoryDifficulty ci-dessus), la
  // recherche texte non (choix existant, propre à "Disponibles").
  const displayedInProgress = (isDailyFilter && dailyChallenge
    ? inProgressItems.filter(uc => uc.challenge.id === dailyChallenge.id)
    : inProgressItems
  ).filter(uc => matchesCategoryDifficulty(uc.challenge));
  const displayedCompleted = (isDailyFilter && dailyChallenge
    ? completedItems.filter(uc => uc.challenge.id === dailyChallenge.id)
    : completedItems
  ).filter(uc => matchesCategoryDifficulty(uc.challenge));

  // Séries dont le groupe existe encore mais n'a pas été validé (pas de completedAt) :
  // on les garde dans "En cours" tant qu'un membre n'a pas cliqué "Marquer la série
  // comme terminée", même si l'utilisateur a personnellement fini tous ses défis.
  const activeSeriesGroupNames = new Set(
    mySeriesGroups
      .filter(g => !g.completedAt && g.members.some(m => m.userId === user?.id && m.status === 'JOINED'))
      .map(g => g.seriesName)
  );

  // Série où l'utilisateur n'a que le statut INVITED (pas encore rejoint) : /api/series-groups/mine
  // renvoie tous les groupes dont il est membre, quel que soit le statut — sans cette exclusion,
  // une série dont les défis sont publics apparaissait comme un accordéon normal (avec progression,
  // détails des défis) alors que l'utilisateur ne l'a même pas encore rejointe. Seule la bannière
  // dédiée "Invitations de série" (renderPendingSeriesInvites) doit la représenter tant que ce n'est
  // pas accepté — voir computeResolvedSeriesGroupings ci-dessous.
  const invitedNotJoinedSeriesNames = new Set(
    mySeriesGroups
      .filter(g => g.members.some(m => m.userId === user?.id && m.status === 'INVITED'))
      .map(g => g.seriesName)
  );

  // Regroupe la liste des défis "résolus" en entier (voir fetchSeriesChallenges) par série,
  // en fonction de leur statut de complétion — extrait pour ne pas garder ces boucles/conditions
  // directement dans le corps du composant (cf. computeSoloAvailable/computeSoloInProgress/
  // computeSoloCompleted ci-dessous pour le repli partiel sur ce qui n'est pas encore résolu).
  const computeResolvedSeriesGroupings = () => {
    const seriesMap = new Map<string, Challenge[]>();
    const inProgressSeriesMap = new Map<string, Challenge[]>();
    const completedSeriesMap = new Map<string, Challenge[]>();
    const resolvedSeriesNames = new Set<string>();
    if (isDailyFilter) return { seriesMap, inProgressSeriesMap, completedSeriesMap, resolvedSeriesNames };
    for (const [name, full] of Object.entries(seriesFullChallenges)) {
      if (!full.length) continue;
      // Invitation pas encore acceptée : la série reste "résolue" (le repli solo ne doit pas
      // essayer de la reconstituer non plus) mais n'apparaît dans AUCUNE des 3 sections — seule
      // la bannière d'invitation dédiée la représente tant que ce n'est pas rejoint.
      if (invitedNotJoinedSeriesNames.has(name)) { resolvedSeriesNames.add(name); continue; }
      // Catégorie/difficulté doivent filtrer les 3 sections (voir matchesCategoryDifficulty) — le
      // statut de complétion (allDone/anyProgress) se base sur la série ENTIÈRE (véritable état
      // d'avancement), mais seuls les jours qui correspondent au filtre sont réellement affichés ;
      // si aucun jour ne correspond, la série entière disparaît (comme un défi solo filtré).
      const visibleFull = full.filter(matchesCategoryDifficulty);
      resolvedSeriesNames.add(name);
      if (visibleFull.length === 0) continue;
      const statuses = full.map(c => getUserStatus(c.id));
      const allDone = statuses.every(s => s === 'COMPLETED');
      const anyProgress = statuses.some(s => s === 'IN_PROGRESS' || s === 'COMPLETED');
      if (allDone && !activeSeriesGroupNames.has(name)) completedSeriesMap.set(name, visibleFull);
      else if (anyProgress || activeSeriesGroupNames.has(name)) inProgressSeriesMap.set(name, visibleFull);
      // Recherche : comme pour les défis solo (voir `filtered` ci-dessus), seule la section
      // "Disponibles" est filtrée par le texte recherché — "En cours"/"Terminés" restent
      // affichés tels quels, une série entière disparaît si aucun de ses défis ne correspond.
      else if (visibleFull.some(matchesSearch)) seriesMap.set(name, visibleFull);
    }
    return { seriesMap, inProgressSeriesMap, completedSeriesMap, resolvedSeriesNames };
  };

  // Groupement par série : dès qu'une série a été chargée en entier (voir fetchSeriesChallenges),
  // elle est affichée comme UNE seule carte basée sur sa liste complète — plus stable que de la
  // reconstruire à partir des pages partielles de "disponibles"/"en cours"/"terminés", qui pouvait
  // la faire apparaître/disparaître ou changer de compteur selon ce qui avait été chargé par
  // "Charger plus". Tant que la liste complète n'est pas encore chargée, on retombe sur un
  // regroupement partiel à partir de ce qui est déjà en mémoire (ci-dessous).
  const { seriesMap, inProgressSeriesMap, completedSeriesMap, resolvedSeriesNames } = computeResolvedSeriesGroupings();

  // Groupement par série — "Disponibles" (repli partiel pour les séries pas encore résolues) —
  // extrait en fonction séparée pour isoler la complexité de la boucle du reste du composant.
  const computeSoloAvailable = (): Challenge[] => {
    const isSolo = (c: Challenge): boolean => {
      if (c.seriesName && resolvedSeriesNames.has(c.seriesName)) return false;
      if (c.seriesName && !isDailyFilter) {
        if (!seriesMap.has(c.seriesName)) seriesMap.set(c.seriesName, []);
        seriesMap.get(c.seriesName)!.push(c);
        return false;
      }
      return true;
    };
    const result: Challenge[] = [];
    for (const c of available) {
      if (isSolo(c)) result.push(c);
    }
    return result;
  };
  const soloAvailable = computeSoloAvailable();
  const seriesEntries = Array.from(seriesMap.entries());

  // Groupement par série — "En cours" (repli partiel) — même principe que ci-dessus.
  const computeSoloInProgress = (): UserChallengeWithData[] => {
    const isSolo = (uc: UserChallengeWithData): boolean => {
      const n = uc.challenge.seriesName;
      if (n && resolvedSeriesNames.has(n)) return false;
      if (n && !isDailyFilter) {
        if (!inProgressSeriesMap.has(n)) inProgressSeriesMap.set(n, []);
        inProgressSeriesMap.get(n)!.push(uc.challenge);
        return false;
      }
      return true;
    };
    const result: UserChallengeWithData[] = [];
    for (const uc of displayedInProgress) {
      if (isSolo(uc)) result.push(uc);
    }
    return result;
  };
  const soloInProgress = computeSoloInProgress();

  // Groupement par série — "Terminés" (repli partiel), extrait pour isoler ses branches du reste
  // du composant.
  // Classe un défi terminé dans la bonne map de série (ou le garde "solo") — extrait en
  // fonction séparée (mêmes branches/priorités que l'original, réécrites en retours anticipés
  // séquentiels au lieu d'un if/else-if/else) pour isoler sa complexité de la boucle englobante.
  const computeSoloCompleted = (): UserChallengeWithData[] => {
    const isSolo = (uc: UserChallengeWithData): boolean => {
      const n = isDailyFilter ? null : uc.challenge.seriesName;
      if (n && resolvedSeriesNames.has(n)) return false;
      if (n && activeSeriesGroupNames.has(n)) {
        // Groupe pas encore validé par tous les membres : reste "En cours" même si
        // l'utilisateur a personnellement fini tous ses défis de la série.
        if (!inProgressSeriesMap.has(n)) inProgressSeriesMap.set(n, []);
        inProgressSeriesMap.get(n)!.push(uc.challenge);
        return false;
      }
      if (n && !seriesMap.has(n) && !inProgressSeriesMap.has(n)) {
        if (!completedSeriesMap.has(n)) completedSeriesMap.set(n, []);
        completedSeriesMap.get(n)!.push(uc.challenge);
        return false;
      }
      return true;
    };
    const result: UserChallengeWithData[] = [];
    for (const uc of displayedCompleted) {
      if (isSolo(uc)) result.push(uc);
    }
    return result;
  };
  // Le résultat (liste des défis solo terminés) n'est plus affiché sur cette page (voir la section
  // "Terminés" du profil) — seul l'effet de bord sur `inProgressSeriesMap` ci-dessus est encore
  // utile (garde une série au groupe pas encore validé dans "En cours"), d'où l'appel sans
  // récupérer le retour.
  computeSoloCompleted();

  const inProgressSeriesEntries = Array.from(inProgressSeriesMap.entries());

  // "En cours" vient de userChallenges (tout ce que l'utilisateur a déjà démarré), pas de la liste
  // paginée /api/challenges — la recherche/catégorie/difficulté ne l'atteignaient donc jamais :
  // taper un nom de série dans la barre de recherche ne changeait rien à ce qui s'affichait ici,
  // même quand cette série était déjà en cours. Filtré ici côté client avec les mêmes critères que
  // le backend (titre/description/nom de série, catégorie, difficulté — voir GET /api/challenges).
  const hasActiveFilters = !!search.trim() || !!selectedCategory || !!selectedDifficulty;
  // `c.title`/`c.description` reflètent déjà la langue d'interface courante (traduits côté
  // backend au moment du fetch, voir withTranslatedChallenge) — mais `seriesNameForGroup` est la
  // clé stable du groupe, TOUJOURS dans sa langue d'origine (voir le commentaire sur `name` dans
  // SeriesDropdown) : chercher un nom de série dans l'autre langue ne matchait donc jamais rien
  // pour une série d'origine différente. Complété avec seriesNameEn/seriesNameFr (même cache de
  // traduction que resolveSeriesDisplayName) pour couvrir les deux sens.
  const matchesActiveFilters = (c: Challenge, seriesNameForGroup: string | null): boolean => {
    if (selectedCategory && c.category !== selectedCategory) return false;
    if (selectedDifficulty && c.difficulty !== selectedDifficulty) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.title.toLowerCase().includes(q)
      || c.description.toLowerCase().includes(q)
      || (seriesNameForGroup ?? '').toLowerCase().includes(q)
      || (c.seriesNameEn ?? '').toLowerCase().includes(q)
      || (c.seriesNameFr ?? '').toLowerCase().includes(q);
  };
  const filteredInProgressSeriesEntries = hasActiveFilters
    ? inProgressSeriesEntries.filter(([name, chs]) => chs.some(c => matchesActiveFilters(c, name)))
    : inProgressSeriesEntries;
  const filteredSoloInProgress = hasActiveFilters
    ? soloInProgress.filter(uc => matchesActiveFilters(uc.challenge, null))
    : soloInProgress;

  // Une série au groupe non validé peut être injectée dans inProgressSeriesMap même quand
  // displayedInProgress est vide (l'utilisateur a fini tous ses défis perso) : les sections
  // "En cours"/"Terminés" doivent donc se baser sur ces listes dérivées, pas sur les compteurs bruts.
  const hasInProgressContent = filteredSoloInProgress.length > 0 || filteredInProgressSeriesEntries.length > 0;
  // Compteur d'en-tête basé sur ce qui est réellement affiché (et non sur les totaux bruts du
  // backend, qui ne savent pas qu'une série au groupe non validé est déplacée vers "En cours").
  const visibleInProgressCount = filteredSoloInProgress.length + filteredInProgressSeriesEntries.reduce((sum, [, chs]) => sum + chs.length, 0);

  // Groupe actif par défi solo (voir ChallengeCard.activeGroup) — un défi n'a jamais qu'un seul
  // ChallengeGroup à la fois (contrainte créée par POST /api/groups), donc une simple Map suffit.
  const groupByChallengeId = useMemo(() => {
    const map = new Map<number, ChallengeGroupType>();
    for (const g of groups) map.set(g.challengeId, g);
    return map;
  }, [groups]);

  // Le badge "En cours" ne doit compter que les messages non lus des groupes réellement affichés
  // dans cette section (pas le total global de tous les groupes rejoints, y compris les séries
  // déjà terminées et déplacées vers le profil — voir completedSeriesMap) : sans ce filtre, la
  // pastille pouvait signaler un non-lu venant d'une série absente de la liste, sans qu'aucune
  // ligne ne l'explique.
  const inProgressSeriesNames = new Set(inProgressSeriesEntries.map(([name]) => name));
  const inProgressGroupsUnreadCount = user && notifData
    ? notifData.groups.filter(g => inProgressSeriesNames.has(g.seriesName) && isGroupUnread(g, user.id)).length
    : 0;

  const openExistingGroupInvite = (g: ChallengeGroupType) => {
    setInviteExistingGroup(g);
    setInviteExistingFriends([]);
    if (friends.length === 0) fetchFriends();
  };

  // ── Section "À faire" : simple index qui redirige vers "En cours"/"Terminés" ──
  // Réutilise TELLES QUELLES les listes déjà calculées pour "En cours" (soloInProgress,
  // inProgressSeriesEntries, voir plus haut) plutôt que de maintenir un second calcul séparé à
  // partir des données brutes — deux calculs parallèles pouvaient diverger (un défi de série visible
  // dans "En cours" mais absent d'"À faire", notamment pour un compte avec beaucoup de séries), et
  // "À faire" n'a plus qu'à afficher une ligne compacte cliquable plutôt que sa propre carte
  // complète (statut de groupe, tchat, invitation...) qui dupliquait ce que "En cours" fait déjà.
  type TodayRow = { id: number; title: string; description: string; category: string; difficulty: string; seriesName: string | null; isEstimate?: boolean };
  const actionableToday: TodayRow[] = useMemo(() => {
    const result: TodayRow[] = soloInProgress.map(uc => ({
      id: uc.challenge.id, title: uc.challenge.title, description: uc.challenge.description, category: uc.challenge.category, difficulty: uc.challenge.difficulty, seriesName: null,
    }));
    for (const [seriesName, chs] of inProgressSeriesEntries) {
      for (const c of chs) {
        // `inProgressSeriesEntries` porte TOUTE la série dès qu'un seul jour a de la progression
        // (voir computeResolvedSeriesGroupings), pas seulement les jours réellement démarrés par cet
        // utilisateur — une série créée via l'admin (contrairement aux séries IA, démarrées d'un
        // coup via bulk-save) ne démarre chaque jour qu'individuellement. Sans cette vérification de
        // statut, un jour jamais commencé (ex: Jour 1 jamais cliqué, alors que Jour 4 est en cours)
        // apparaissait à tort comme "à faire aujourd'hui".
        if (getUserStatus(c.id) !== 'IN_PROGRESS' || c.daysUntilUnlock || c.previousDayIncomplete) continue;
        result.push({ id: c.id, title: c.title, description: c.description, category: c.category, difficulty: c.difficulty, seriesName });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloInProgress, inProgressSeriesEntries, userChallenges]);

  // Planning prévisionnel : projette une date pour CHAQUE jour restant non complété d'une série,
  // même quand le backend ne confirme rien encore (voir seriesLockInfo, previousDayIncomplete) —
  // en supposant que l'utilisateur enchaîne un jour par jour à partir d'aujourd'hui. Seul le tout
  // premier jour restant d'une série a une donnée réelle du backend (jour actionnable aujourd'hui,
  // offset 0, ou compte à rebours confirmé si le jour précédent est déjà complété) ; chaque jour
  // suivant est déduit en ajoutant 1 (`isEstimate: true`). Recalculé à chaque rendu à partir de
  // l'état réel : si un jour n'est pas fait à temps, tout le planning se décale tout seul au
  // rendu suivant, sans qu'on ait besoin de mémoriser un retard nulle part.
  const upcomingByOffset = useMemo(() => {
    const map = new Map<number, TodayRow[]>();
    for (const [seriesName, chs] of inProgressSeriesEntries) {
      const remaining = [...chs]
        .filter(c => getUserStatus(c.id) !== 'COMPLETED')
        .sort((a, b) => (seriesDayNumber(a.title) ?? 0) - (seriesDayNumber(b.title) ?? 0));
      let runningOffset = 0;
      remaining.forEach((c, i) => {
        runningOffset = i === 0 ? (c.daysUntilUnlock && c.daysUntilUnlock > 0 ? c.daysUntilUnlock : 0) : runningOffset + 1;
        if (runningOffset <= 0) return; // 1er jour restant, actionnable aujourd'hui — déjà dans actionableToday
        if (!map.has(runningOffset)) map.set(runningOffset, []);
        map.get(runningOffset)!.push({ id: c.id, title: c.title, description: c.description, category: c.category, difficulty: c.difficulty, seriesName, isEstimate: i > 0 });
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgressSeriesEntries, userChallenges]);

  // Bascule le focus sur un défi déjà affiché plus bas sur CETTE MÊME page (pas de navigation —
  // contrairement à UQuail.tsx qui doit passer par location.state pour venir d'une autre page) :
  // réutilise le même mécanisme de scroll/surbrillance/ouverture forcée des sections, voir les
  // effets sur focusChallengeId/focusSeriesName plus haut.
  const focusChallengeInPage = (challengeId: number, seriesName: string | null) => {
    setFocusChallengeId(challengeId);
    setFocusSeriesName(seriesName);
  };

  // Mini-calendrier (lundi → dimanche de la semaine affichée, décalée de `weekOffset`) : une
  // pastille marque les jours où l'utilisateur a déjà complété au moins un défi (voir
  // completedDates ci-dessus).
  const weekDays = useMemo(() => {
    const today = startOfDay(new Date());
    const start = startOfWeek(today);
    start.setDate(start.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      return {
        date: d,
        isToday: sameDay(d, today),
        isFuture: d > today,
        hasCompleted: completedDates.some(iso => sameDay(new Date(iso), d)),
      };
    });
  }, [completedDates, weekOffset]);

  // Revient sur "aujourd'hui" en changeant de semaine si elle contient le jour courant, sinon sur
  // le lundi de la semaine affichée — sans ça, `selectedDayIndex` gardait l'index de la semaine
  // précédente (ex: index du vendredi) et pointait sur le mauvais jour une fois la semaine changée.
  useEffect(() => {
    const idx = weekDays.findIndex(d => d.isToday);
    setSelectedDayIndex(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  const selectedDay = weekDays[selectedDayIndex] ?? weekDays[0];
  // Diff en jours calendaires réels entre le jour sélectionné et aujourd'hui — plutôt qu'une
  // différence d'index dans `weekDays` (qui ne marche que pour la semaine en cours : dès qu'on
  // navigue vers une autre semaine via `weekOffset`, "aujourd'hui" n'a plus forcément d'index dans
  // le tableau affiché).
  const futureOffset = Math.round((selectedDay.date.getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  // Défis complétés le jour sélectionné (uniquement pertinent pour un jour passé — voir
  // renderTodaySection, qui affiche actionableToday à la place quand isToday est vrai).
  const selectedDayCompletions = useMemo(
    () => weekCompletions.filter(c => sameDay(new Date(c.completedAt), selectedDay.date)),
    [weekCompletions, selectedDay]
  );

  const handleInviteToGroup = async () => {
    if (!inviteExistingGroup || !token || inviteExistingLoading) return;
    setInviteExistingLoading(true);
    try {
      const res = await fetch(`/api/groups/${inviteExistingGroup.id}/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendIds: inviteExistingFriends }),
      });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || t('challengePage.notif.genericError'), 'error'); return; }
      setGroups(prev => prev.map(g => g.id === inviteExistingGroup.id ? data : g));
      setInviteExistingGroup(null);
      setInviteExistingFriends([]);
      showNotif(t('challengePage.notif.invitationsSent'), 'success');
    } catch { showNotif(t('challengePage.notif.invitationError'), 'error'); }
    finally { setInviteExistingLoading(false); }
  };

  // Rendu d'une invitation à un groupe de défi solo (hors série) en attente — seul cas encore
  // affiché dans la section "Groupes" (voir renderGroupsSection) depuis que les groupes déjà
  // rejoints en ont été retirés (déjà visibles via le panneau groupe de ChallengeCard).
  const renderGroupCard = (g: ChallengeGroupType) => {
    if (!user) return null;
    return (
      <div key={g.id} className="rounded-2xl p-3" style={{
        background: 'var(--q-chrome)', border: '1px solid #A78BFA',
        boxShadow: '0 0 0 2px rgba(167,139,250,0.25)',
      }}>
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm" style={{ color: 'var(--q-text)' }}>{g.challenge.title}</div>
            <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--q-text2)' }}>
              <Mail size={10} aria-hidden="true" /> {t('challengePage.groupCard.invitedYouText', { username: g.creator.username })}
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)' }}>{t('challengePage.groupCard.invitation')}</span>
        </div>
        {/* Membres */}
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {g.members.map(m => {
            const memberStyle = GROUP_MEMBER_STATUS_STYLE[m.status] ?? GROUP_MEMBER_STATUS_DEFAULT;
            const StatusIcon = memberStyle.Icon;
            return (
              <div key={m.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: memberStyle.bg,
                  color: memberStyle.color,
                }}>
                <StatusIcon size={10} aria-hidden="true" /> {m.user.username}
              </div>
            );
          })}
        </div>
        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => handleJoinGroup(g.id)} disabled={groupActionLoading === g.id}
            className="q-press flex-1 py-2 rounded-full font-bold text-xs text-white disabled:opacity-60 flex items-center justify-center gap-1"
            style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)' }}>
            {groupActionLoading === g.id ? <Loader2 size={12} className="animate-spin" /> : <><CheckCircle size={11} /> {t('challengePage.join')}</>}
          </button>
          <button onClick={() => handleDeclineGroup(g.id)} disabled={groupActionLoading === g.id}
            className="q-press flex-1 py-2 rounded-full font-bold text-xs disabled:opacity-60"
            style={{ background: 'var(--q-line)', color: 'var(--q-text2)' }}>
            {t('challengePage.decline')}
          </button>
        </div>
      </div>
    );
  };

  const activeFilters = [selectedCategory, selectedDifficulty, isDailyFilter ? 'daily' : ''].filter(Boolean).length;

  // ── Tchat de groupe (pattern identique à ForumTchat) ──
  const renderChatModal = (): React.ReactNode => {
    if (chatGroupId === null) return null;
    const chatEmptyState = chatMessages.length === 0 ? (
      <p className="text-center text-sm" style={{ color: 'var(--q-text3)', paddingTop: 24 }}>
        {t('challengePage.chatModal.noMessages')}
      </p>
    ) : null;
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
        <div className="flex flex-col w-full max-w-sm rounded-3xl overflow-hidden"
          style={{ background: 'var(--q-chrome)', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.55)',
            border: '1px solid var(--q-line)', height: '75vh', maxHeight: 600 }}>

          {/* Header */}
          <div className="flex items-center justify-between p-4"
            style={{ borderBottom: '1px solid var(--q-line)', flexShrink: 0 }}>
            <h2 className="font-bold text-base flex items-center gap-1.5" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>
              <MessageCircle size={16} aria-hidden="true" /> {t('challengePage.chatModal.title')}
            </h2>
            <button onClick={() => { setChatGroupId(null); setChatMessages([]); }}
              aria-label={t('challengePage.chatModal.closeAriaLabel')}
              className="q-press p-1.5 rounded-full"
              style={{ background: 'var(--q-line)', color: 'var(--q-text2)' }}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          {/* Messages — identique à ForumTchat */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatLoading ? (
              <div className="space-y-4 animate-pulse">
                {[0, 1, 2].map(i => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                    <div className="flex gap-2 max-w-[70%]" style={{ flexDirection: i % 2 === 0 ? 'row' : 'row-reverse' }}>
                      <div className="w-8 h-8 rounded-full flex-shrink-0 self-end" style={{ background: 'var(--q-line)' }} />
                      <div className="p-3 rounded-[18px]" style={{ background: 'var(--q-line)', width: 100 + i * 40 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : chatEmptyState}
            {chatMessages.map(msg => {
              const isMe = Number(msg.userId) === Number(chatMyId ?? user?.id ?? -1);
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[80%] gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar cliquable vers le profil */}
                    <button
                      onClick={() => msg.user.id === user?.id ? navigate('/profile') : navigate(`/user/${msg.user.id}`)}
                      aria-label={t('challengePage.chatModal.viewProfileAriaLabel', { username: msg.user.username })}
                      className="flex-shrink-0 self-end"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <UserAvatar
                        avatar={msg.user.avatar}
                        username={msg.user.username}
                        cosmetics={msg.user.cosmetics ?? []}
                        size="sm"
                      />
                    </button>
                    <div>
                      {!isMe && (
                        <div className="flex items-center gap-2 mb-1" style={{ paddingLeft: 2 }}>
                          <button
                            onClick={() => navigate(`/user/${msg.user.id}`)}
                            className="font-semibold text-xs hover:underline"
                            style={{ color: 'var(--q-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            {msg.user.username}
                          </button>
                          <span className="text-xs" style={{ color: 'var(--q-text3)' }}>
                            {new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      <div className="p-3 text-sm break-words"
                        style={{
                          background: isMe ? 'var(--q-accent)' : 'var(--q-chrome)',
                          border: isMe ? 'none' : '1px solid var(--q-line)',
                          color: isMe ? '#fff' : 'var(--q-text)',
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          wordBreak: 'break-word',
                        }}>
                        {msg.content}
                      </div>
                      {isMe && (
                        <div className="text-right mt-1" style={{ paddingRight: 2 }}>
                          <span className="text-xs" style={{ color: 'var(--q-text3)' }}>
                            {new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input — identique à ForumTchat */}
          {chatInput.length > 400 && (
            <div className="px-4 pt-1 text-right" style={{ fontSize: 11, color: chatInput.length >= 500 ? '#EF4444' : 'var(--q-text3)' }}>
              {chatInput.length}/500
            </div>
          )}
          <div className="p-3 flex items-center gap-2"
            style={{ borderTop: '1px solid var(--q-line)', flexShrink: 0 }}>
            <label htmlFor="group-chat-input" className="sr-only">{t('challengePage.chatModal.writeMessageSrLabel')}</label>
            <input
              id="group-chat-input"
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value.slice(0, 500))}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendChatMessage(); }}
              placeholder={t('challengePage.chatModal.placeholder')}
              maxLength={500}
              className="flex-1 py-2 px-4 rounded-full outline-none"
              style={{ background: 'var(--q-bg)', border: '1px solid var(--q-line)',
                color: 'var(--q-text)', fontSize: 13, fontFamily: 'inherit' }}
            />
            <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatSending || chatInput.length > 500}
              aria-label={t('challengePage.chatModal.sendAriaLabel')}
              className={`p-2 rounded-full ${chatInput.trim() ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'}`}>
              <Send size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Modal invitation groupe ──
  const renderInviteModal = (): React.ReactNode => {
    if (!inviteModal) return null;
    const createGroupButtonLabel = selectedFriends.length > 0
      ? t('challengePage.inviteModal.createWithMembers', { count: selectedFriends.length + 1 })
      : t('challengePage.inviteModal.createSolo');
    const friendsList = friends.length === 0 ? (
      <p className="text-sm text-center py-4" style={{ color: 'var(--q-text3)' }}>
        {t('challengePage.inviteModal.noFriends')}
      </p>
    ) : (
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {friends.map(f => {
          const sel = selectedFriends.includes(f.user.id);
          const maxReached = !sel && selectedFriends.length >= 3;
          return (
            <button key={f.friendshipId}
              onClick={() => {
                if (maxReached) return;
                setSelectedFriends(prev => sel ? prev.filter(id => id !== f.user.id) : [...prev, f.user.id]);
              }}
              disabled={maxReached}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all disabled:opacity-40"
              style={{
                background: sel ? 'var(--q-accent-soft)' : 'var(--q-bg)',
                border: `1px solid ${sel ? 'var(--q-accent)' : 'var(--q-line)'}`,
                color: 'var(--q-text)',
                cursor: maxReached ? 'not-allowed' : 'pointer',
              }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: 'var(--q-vibrant-lavender)' }}>
                {f.user.username[0].toUpperCase()}
              </div>
              <span className="font-semibold text-sm">{f.user.username}</span>
              {sel && <span className="ml-auto text-xs font-bold" style={{ color: 'var(--q-accent)' }}>✓</span>}
            </button>
          );
        })}
      </div>
    );
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) setInviteModal(null); }}
        onKeyDown={e => { if (e.key === 'Escape') setInviteModal(null); }}>
        <div className="w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4"
          style={{ background: 'var(--q-chrome)', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.55)', border: '1px solid var(--q-line)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-base" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>
                {t('challengePage.inviteModal.title')}
              </div>
              <div className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--q-text2)' }}
                title={inviteModal.title}>
                {inviteModal.title.length > 40 ? inviteModal.title.slice(0, 40) + '…' : inviteModal.title}
              </div>
            </div>
            <button onClick={() => setInviteModal(null)} aria-label={t('challengePage.inviteModal.closeAriaLabel')}
              className="q-press w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--q-line)', color: 'var(--q-text2)' }}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          {/* Compteur membres */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: 12, background: 'var(--q-bg)',
            border: '1px solid var(--q-line)' }}>
            <span style={{ fontSize: 12, color: 'var(--q-text2)' }}>
              <Users size={12} style={{ display: 'inline', marginRight: 4 }} aria-hidden="true" />
              {t('challengePage.inviteModal.groupMembers')}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700,
              color: selectedFriends.length >= 3 ? '#EF4444' : 'var(--q-accent)' }}>
              {1 + selectedFriends.length} / 4
            </span>
          </div>
          {friendsList}
          <button onClick={handleCreateGroup}
            disabled={groupCreating}
            className="q-press w-full py-3 rounded-full font-bold text-sm text-white disabled:opacity-60"
            style={{ background: 'var(--q-vibrant-lavender)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
            {groupCreating ? t('challengePage.inviteModal.creating') : createGroupButtonLabel}
          </button>
        </div>
      </div>
    );
  };

  // ── Modal invitation dans un groupe existant ──
  const renderInviteExistingModal = (): React.ReactNode => {
    if (!inviteExistingGroup) return null;
    const inviteExistingButtonLabel = inviteExistingFriends.length > 0
      ? t('challengePage.inviteExistingModal.inviteCount', { count: inviteExistingFriends.length })
      : t('challengePage.inviteExistingModal.selectFriends');
    const alreadyIn = new Set(inviteExistingGroup.members.map(m => m.userId));
    const eligible = friends.filter(f => !alreadyIn.has(f.user.id));
    const eligibleList = eligible.length === 0 ? (
      <p className="text-sm text-center py-4" style={{ color: 'var(--q-text3)' }}>
        {friends.length === 0 ? t('challengePage.inviteModal.noFriends') : t('challengePage.inviteExistingModal.allFriendsIn')}
      </p>
    ) : (
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {eligible.map(f => {
          const sel = inviteExistingFriends.includes(f.user.id);
          const maxReached = !sel && inviteExistingGroup.members.length + inviteExistingFriends.length >= 4;
          return (
            <button key={f.friendshipId}
              onClick={() => {
                if (maxReached) return;
                setInviteExistingFriends(prev => sel ? prev.filter(id => id !== f.user.id) : [...prev, f.user.id]);
              }}
              disabled={maxReached}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all disabled:opacity-40"
              style={{
                background: sel ? 'var(--q-accent-soft)' : 'var(--q-bg)',
                border: `1px solid ${sel ? 'var(--q-accent)' : 'var(--q-line)'}`,
                color: 'var(--q-text)', cursor: maxReached ? 'not-allowed' : 'pointer',
              }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: 'var(--q-vibrant-lavender)' }}>
                {f.user.username[0].toUpperCase()}
              </div>
              <span className="font-semibold text-sm">{f.user.username}</span>
              {sel && <span className="ml-auto text-xs font-bold" style={{ color: 'var(--q-accent)' }}>✓</span>}
            </button>
          );
        })}
      </div>
    );
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) setInviteExistingGroup(null); }}
        onKeyDown={e => { if (e.key === 'Escape') setInviteExistingGroup(null); }}>
        <div className="w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4"
          style={{ background: 'var(--q-chrome)', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.55)', border: '1px solid var(--q-line)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-base" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>
                {t('challengePage.inviteExistingModal.title')}
              </div>
              <div className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--q-text2)' }}
                title={inviteExistingGroup.challenge.title}>
                {inviteExistingGroup.challenge.title.length > 40 ? inviteExistingGroup.challenge.title.slice(0, 40) + '…' : inviteExistingGroup.challenge.title}
              </div>
            </div>
            <button onClick={() => setInviteExistingGroup(null)} aria-label={t('challengePage.inviteModal.closeAriaLabel')}
              className="q-press w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--q-line)', color: 'var(--q-text2)' }}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: 12, background: 'var(--q-bg)', border: '1px solid var(--q-line)' }}>
            <span style={{ fontSize: 12, color: 'var(--q-text2)' }}>
              <Users size={12} style={{ display: 'inline', marginRight: 4 }} aria-hidden="true" />
              {t('challengePage.inviteExistingModal.availableSlots')}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700,
              color: inviteExistingFriends.length >= (4 - inviteExistingGroup.members.length) ? '#EF4444' : 'var(--q-accent)' }}>
              {inviteExistingGroup.members.length + inviteExistingFriends.length} / 4
            </span>
          </div>
          {eligibleList}
          <button onClick={handleInviteToGroup}
            disabled={inviteExistingLoading || inviteExistingFriends.length === 0}
            className="q-press w-full py-3 rounded-full font-bold text-sm text-white disabled:opacity-60"
            style={{ background: 'var(--q-vibrant-lavender)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
            {inviteExistingLoading ? t('challengePage.inviteExistingModal.sending') : inviteExistingButtonLabel}
          </button>
        </div>
      </div>
    );
  };

  // ── Groupes : invitations en attente uniquement (série ou défi unique) ──
  // Les groupes déjà rejoints (actifs ou terminés) ne sont plus listés ici : ils sont déjà
  // visibles directement sur la carte de leur série (bordure/badge "hasGroup", panneau membre) ou
  // de leur défi (bouton "Tchat"/"Inviter" sur ChallengeCard, voir activeGroup) — les répéter ici
  // n'apportait rien de plus et faisait apparaître/disparaître toute la section à chaque
  // chargement de page (voir `groupsLoading` ci-dessous, qui attend maintenant la fin du fetch
  // avant de décider quoi que ce soit, plutôt que d'afficher un conteneur qui se démonte une fois
  // vide). Seules les invitations EN ATTENTE (série via pendingSeriesInvites, ou défi unique via
  // ce filtre sur `groups`) restent affichées : c'est la seule action qui n'a pas déjà sa place
  // ailleurs (accepter/refuser, avant même que le défi/la série n'apparaisse dans une liste).
  const pendingSoloGroupInvites = user ? groups.filter(g => g.members.find(m => m.userId === user.id)?.status === 'INVITED') : [];
  const renderGroupsSection = (): React.ReactNode => {
    const totalInvites = pendingSeriesInvites.length + pendingSoloGroupInvites.length;
    if (!user || groupsLoading || totalInvites === 0) return null;

    return (
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
        <SectionHeader icon={<Users size={18} color="#fff" aria-hidden="true" />} label={t('challengePage.groupsSectionTitle')}
          count={totalInvites} grad="linear-gradient(135deg,#A78BFA,#EC4899)"
          onClick={() => setGroupsSectionOpen(o => !o)} isOpen={groupsSectionOpen} />
        {groupsSectionOpen && (
          <div className="flex flex-col gap-2 px-4 pb-4 border-t" style={{ borderColor: 'var(--q-line)', paddingTop: 12 }}>
            {pendingSeriesInvites.map(invite => (
              <div key={invite.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 14, border: '1.5px solid rgba(167,139,250,0.35)',
                background: 'linear-gradient(135deg,rgba(167,139,250,0.06),rgba(236,72,153,0.04))',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg,#A78BFA,#EC4899)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={16} color="#fff" aria-hidden="true" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--q-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {invite.seriesName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--q-text3)', marginTop: 1 }}>
                    <Trans i18nKey="challengePage.seriesInvites.invitedBy" values={{ username: invite.creator.username }} components={{ strong: <span style={{ color: 'var(--q-accent)', fontWeight: 600 }} /> }} />
                    {' · '}{t('challengePage.seriesInvites.membersJoined', { count: invite.members.filter(m => m.status === 'JOINED').length })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleDeclineSeriesInvite(invite.id)}
                    disabled={seriesInviteLoading === invite.id}
                    style={{
                      padding: '7px 12px', borderRadius: 10,
                      border: '1px solid var(--q-line)', background: 'transparent',
                      color: 'var(--q-text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      opacity: seriesInviteLoading === invite.id ? 0.5 : 1,
                    }}>{t('challengePage.decline')}</button>
                  <button
                    onClick={() => handleJoinSeriesInvite(invite.id)}
                    disabled={seriesInviteLoading === invite.id}
                    style={{
                      padding: '7px 14px', borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg,#A78BFA,#EC4899)',
                      color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      opacity: seriesInviteLoading === invite.id ? 0.5 : 1,
                    }}>
                    {seriesInviteLoading === invite.id ? '…' : t('challengePage.join')}
                  </button>
                </div>
              </div>
            ))}
            {pendingSoloGroupInvites.map(g => renderGroupCard(g))}
          </div>
        )}
      </div>
    );
  };

  // ── Suggestion du jour chip ──
  const renderDailyChip = (): React.ReactNode => {
    if (!dailyChallengeId) return null;
    return (
      <button onClick={toggleDailyFilter}
        className="q-press w-full rounded-2xl p-3 flex items-center gap-3 mb-3 text-left transition-all"
        style={isDailyFilter
          ? { background: 'linear-gradient(135deg,#FACC15,#FB923C)', boxShadow: '0 8px 20px -4px rgba(251,146,60,0.5)', border: '1px solid transparent' }
          : { background: 'var(--q-chrome)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: 'var(--q-shadow)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={isDailyFilter
            ? { background: 'rgba(255,255,255,0.25)' }
            : { background: 'linear-gradient(135deg,#FACC15,#FB923C)', boxShadow: '0 4px 12px rgba(251,146,60,0.35)' }}>
          <Sparkles size={18} style={{ color: isDailyFilter ? '#fff' : '#78350F' }} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm" style={{ color: isDailyFilter ? '#fff' : 'var(--q-text)' }}>
            {t('challengePage.dailySuggestion')}
          </p>
          <p className="text-xs" style={{ color: isDailyFilter ? 'rgba(255,255,255,0.85)' : 'var(--q-text2)' }}>
            {isDailyFilter ? t('challengePage.dailyFilteredOnly') : t('challengePage.dailyBonusHint')}
          </p>
        </div>
        {isDailyFilter
          ? <X size={16} style={{ color: '#fff', flexShrink: 0 }} aria-hidden="true" />
          : <span className="text-xs font-bold px-2 py-0.5 rounded-full text-amber-900 flex-shrink-0"
              style={{ background: '#FDE68A' }}>{t('challengePage.see')}</span>
        }
      </button>
    );
  };

  // ── Section "À faire" : vue compacte "aujourd'hui + cette semaine" ──
  // Objectif : éviter d'avoir à dérouler toutes les sections Disponibles/En cours/Terminés pour
  // repérer ce qui reste à faire — regroupe ici uniquement ce qui est réellement actionnable
  // aujourd'hui (voir actionableToday ci-dessus), avec une mini-grille de la semaine en repère visuel.
  const renderTodaySection = (): React.ReactNode => {
    // Le filtre "défi du jour" a déjà son propre bandeau dédié plus bas (voir la bannière
    // "isDailyFilter" et renderDailyChip) — garder "À faire" affichée en même temps montrait deux
    // fois la même information (la suggestion du jour) sans rapport avec le filtre actif.
    if (!user || isDailyFilter) return null;

  // Ligne compacte partagée par les 3 états d'"À faire" — remplace l'ancienne carte complète
  // (statut de groupe, tchat, invitation, édition...) qui dupliquait "En cours"/"Terminés" pour un
  // gain d'information minime : un clic redirige directement vers la vraie carte dans "En cours".
  // `onRowClick` absent (voir le jour passé ci-dessous, depuis que "Terminés" n'existe plus sur
  // cette page) → ligne purement informative, sans chevron ni interaction.
  const renderTodayRow = (item: TodayRow, rightIcon: React.ReactNode, opts?: { sublabel?: React.ReactNode; onRowClick?: () => void }) => {
    const diff = DIFF_GRAD[item.difficulty] ?? DIFF_GRAD.EASY;
    const cat = CATEGORY_GRAD[item.category] ?? CATEGORY_GRAD.GAMING;
    const CatIcon = cat.Icon;
    const onRowClick = opts?.onRowClick;
    const Tag = (onRowClick ? 'button' : 'div') as React.ElementType;
    const isDaily = item.id === dailyChallengeId;
    return (
      <Tag key={item.id} type={onRowClick ? 'button' : undefined} onClick={onRowClick}
        className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left${onRowClick ? ' q-press transition-transform hover:-translate-y-0.5' : ''}`}
        style={{
          background: 'var(--q-chrome)',
          border: isDaily ? '1px solid #FACC15' : '1px solid var(--q-line)',
          boxShadow: isDaily ? '0 0 0 2px #FACC15, var(--q-shadow)' : 'var(--q-shadow)',
        }}>
        <IconTile cat={item.category} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-nowrap gap-1.5 mb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <VibrantChip grad={diff.grad} glow={diff.glow}>{diff.icon}{t(`common.difficulty.${item.difficulty.toLowerCase()}`)}</VibrantChip>
            <VibrantChip grad={cat.grad} glow={cat.glow}><CatIcon size={11} aria-hidden="true" /> {t(`common.category.${item.category}`)}</VibrantChip>
            {isDaily && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-900 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#FACC15,#FB923C)', boxShadow: '0 3px 10px -2px rgba(251,146,60,0.5)' }}>
                <Sparkles size={10} aria-hidden="true" /> +50%
              </span>
            )}
          </div>
          <div className="font-bold text-sm truncate" style={{ color: 'var(--q-text)' }}>{item.title}</div>
          {item.description && (
            <div className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--q-text2)' }}>{item.description}</div>
          )}
          {opts?.sublabel}
        </div>
        {rightIcon}
        {onRowClick && <ChevronRight size={16} style={{ color: 'var(--q-text3)', flexShrink: 0 }} aria-hidden="true" />}
      </Tag>
    );
  };

  const todayCount = actionableToday.length;
  const upcomingForSelected = upcomingByOffset.get(futureOffset) ?? [];
  // Le badge reflète ce qui est réellement affiché sous la grille pour le jour sélectionné —
  // sinon "À faire" garde le compteur d'aujourd'hui même en consultant un autre jour, ce qui
  // ne correspond à rien de visible à l'écran.
  const displayedCount = selectedDay.isToday ? todayCount
    : selectedDay.isFuture ? upcomingForSelected.length
    : selectedDayCompletions.length;

  // Bouton "Charger plus" partagé par les 3 états — ces listes sont déjà entièrement en mémoire
  // (voir todayVisibleCount plus haut), donc "charger plus" ne fait qu'augmenter le nombre de
  // lignes affichées, sans nouvel appel réseau.
  const renderLoadMoreToday = (total: number) => total > todayVisibleCount && (
    <button onClick={() => setTodayVisibleCount(c => c + 10)}
      className="q-press mt-1 w-full py-2.5 rounded-2xl border-2 border-dashed text-sm font-bold transition-opacity hover:opacity-70"
      style={{ borderColor: '#34D399', color: '#34D399' }}>
      {t('challengePage.loadMore')}
    </button>
  );

  // Le contenu sous la grille dépend du jour sélectionné (par défaut aujourd'hui) : les défis
  // actionnables pour aujourd'hui, l'historique pour un jour passé, ou les prochains jours de
  // série à débloquer pour un jour futur (voir upcomingByOffset — déterministe, donc jamais un
  // "spoiler" de contenu qui n'existe pas encore). Affichés 10 par 10 (voir todayVisibleCount).
  let body: React.ReactNode;
  if (selectedDay.isToday) {
    body = todayCount > 0 ? (
      <div className="flex flex-col gap-2">
        {actionableToday.slice(0, todayVisibleCount).map(item => renderTodayRow(item, <Clock size={16} aria-hidden="true" style={{ color: '#38BDF8', flexShrink: 0 }} />,
          { onRowClick: () => focusChallengeInPage(item.id, item.seriesName) }))}
        {renderLoadMoreToday(actionableToday.length)}
      </div>
    ) : (
      <div className="rounded-2xl p-4 text-center text-sm" style={{ background: 'var(--q-chrome)', border: '1px dashed var(--q-line)', color: 'var(--q-text2)' }}>
        {t('challengePage.today.empty')}
      </div>
    );
  } else if (selectedDay.isFuture) {
    body = upcomingForSelected.length > 0 ? (
      <div className="flex flex-col gap-2">
        {upcomingForSelected.slice(0, todayVisibleCount).map(item => renderTodayRow(
          item,
          <Lock size={16} aria-hidden="true" style={{ color: 'var(--q-text3)', flexShrink: 0 }} />,
          {
            onRowClick: () => focusChallengeInPage(item.id, item.seriesName),
            // "Estimé" (isEstimate) pour tout jour au-delà du 1er restant d'une série : sa date
            // dépend d'avoir bouclé les jours précédents pile un par jour, ce que le backend ne
            // peut pas confirmer à l'avance (voir upcomingByOffset) — d'où le libellé différent.
            sublabel: <div className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--q-text3)' }}>
              {t(item.isEstimate ? 'challengePage.series.unlocksInEstimate' : 'challengePage.series.unlocksIn', { count: futureOffset })}
            </div>,
          },
        ))}
        {renderLoadMoreToday(upcomingForSelected.length)}
      </div>
    ) : (
      <div className="rounded-2xl p-4 text-center text-sm" style={{ background: 'var(--q-chrome)', border: '1px dashed var(--q-line)', color: 'var(--q-text2)' }}>
        {t('challengePage.today.futureEmpty')}
      </div>
    );
  } else {
    body = selectedDayCompletions.length > 0 ? (
      <div className="flex flex-col gap-2">
        {selectedDayCompletions.slice(0, todayVisibleCount).map(({ challenge }, i) => renderTodayRow(
          { id: challenge.id, title: challenge.title, description: challenge.description, category: challenge.category, difficulty: challenge.difficulty, seriesName: challenge.seriesName ?? null },
          <CheckCircle key={i} size={16} aria-hidden="true" className="text-emerald-400 flex-shrink-0" />,
        ))}
        {renderLoadMoreToday(selectedDayCompletions.length)}
      </div>
    ) : (
      <div className="rounded-2xl p-4 text-center text-sm" style={{ background: 'var(--q-chrome)', border: '1px dashed var(--q-line)', color: 'var(--q-text2)' }}>
        {t('challengePage.today.pastEmpty')}
      </div>
    );
  }

    return (
      <section data-tour="page-defis-today" className="rounded-2xl overflow-hidden mb-4"
        style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
        <SectionHeader icon={<CalendarCheck size={18} color="#fff" aria-hidden="true" />} label={t('challengePage.today.title')}
          count={displayedCount} grad="linear-gradient(135deg,#34D399,#38BDF8)"
          onClick={() => setTodayOpen(o => !o)} isOpen={todayOpen} />

        {todayOpen && (
          <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--q-line)', paddingTop: 12 }}>
            {/* Navigation semaine par semaine — permet notamment de voir les semaines à venir,
                au-delà des 7 jours de la semaine en cours (voir upcomingByOffset plus haut). */}
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => setWeekOffset(o => o - 1)}
                aria-label={t('challengePage.today.prevWeek')}
                className="q-press" style={{
                  width: 26, height: 26, borderRadius: 8, border: 'none', flexShrink: 0,
                  background: 'var(--q-bg-flat)', color: 'var(--q-text2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              <span className="text-xs font-bold" style={{ color: 'var(--q-text)' }}>
                {weekDays[0].date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
                {' – '}
                {weekDays[6].date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
              </span>
              <button type="button" onClick={() => setWeekOffset(o => o + 1)}
                aria-label={t('challengePage.today.nextWeek')}
                className="q-press" style={{
                  width: 26, height: 26, borderRadius: 8, border: 'none', flexShrink: 0,
                  background: 'var(--q-bg-flat)', color: 'var(--q-text2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {weekDays.map((d, i) => (
                <button key={d.date.toISOString()} type="button" onClick={() => setSelectedDayIndex(i)}
                  aria-pressed={i === selectedDayIndex}
                  aria-label={d.date.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
                  className="q-press flex flex-col items-center gap-1 py-2 rounded-xl transition-opacity"
                  style={{
                    background: d.isToday ? 'var(--q-vibrant-lavender)' : 'var(--q-bg-flat)',
                    border: i === selectedDayIndex && !d.isToday ? '1px solid var(--q-accent)' : '1px solid var(--q-line)',
                    boxShadow: d.isToday
                      ? '0 4px 12px -2px rgba(124,58,237,0.4)'
                      : (i === selectedDayIndex ? '0 0 0 2px var(--q-accent-soft)' : 'none'),
                    opacity: d.isFuture ? 0.55 : 1,
                    cursor: 'pointer',
                  }}>
                  <span className="text-[10px] font-bold uppercase" style={{ color: d.isToday ? 'rgba(255,255,255,0.85)' : 'var(--q-text3)' }}>
                    {d.date.toLocaleDateString(i18n.language, { weekday: 'short' })}
                  </span>
                  <span className="text-xs font-bold" style={{ color: d.isToday ? '#fff' : 'var(--q-text)' }}>
                    {d.date.getDate()}
                  </span>
                  <span aria-hidden="true" style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: d.hasCompleted ? (d.isToday ? '#fff' : '#34D399') : 'transparent',
                  }} />
                </button>
              ))}
            </div>

            {!selectedDay.isToday && (
              <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--q-text3)' }}>
                {selectedDay.date.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            )}

            {body}
          </div>
        )}
      </section>
    );
  };

  // ── Filtres dépliables (catégorie / difficulté) ──
  const renderFiltersPanel = (): React.ReactNode => {
    if (!filtersOpen) return null;
    return (
      <div className="rounded-2xl p-4 mb-3 space-y-4" style={{ background: 'var(--q-chrome)', boxShadow: 'var(--q-shadow)', border: '1px solid var(--q-line)' }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--q-text3)' }}>{t('challengePage.categoryLabel')}</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <button onClick={() => { setSelectedCategory(''); setIsDailyFilter(false); }}
              className="q-press flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
              style={selectedCategory
                ? { background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }
                : { background: 'var(--q-accent)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
              {t('challengePage.all')}
            </button>
            {CATEGORIES.map(c => {
              const cfg = CATEGORY_GRAD[c];
              const CfgIcon = cfg.Icon;
              const active = selectedCategory === c;
              return (
                <button key={c} onClick={() => { setSelectedCategory(c === selectedCategory ? '' : c); setIsDailyFilter(false); }}
                  className="q-press inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
                  style={active
                    ? { background: cfg.grad, color: '#fff', boxShadow: `0 4px 12px ${cfg.glow}` }
                    : { background: 'var(--q-accent-soft)', color: 'var(--q-text2)' }}>
                  <CfgIcon size={11} /> {t(`common.category.${c}`)}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--q-text3)' }}>{t('challengePage.difficultyLabel')}</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <button onClick={() => { setSelectedDifficulty(''); setIsDailyFilter(false); }}
              className="q-press flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
              style={selectedDifficulty
                ? { background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }
                : { background: 'var(--q-accent)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
              {t('challengePage.all')}
            </button>
            {DIFFICULTIES.map(d => {
              const cfg = DIFF_GRAD[d];
              const active = selectedDifficulty === d;
              return (
                <button key={d} onClick={() => { setSelectedDifficulty(d === selectedDifficulty ? '' : d); setIsDailyFilter(false); }}
                  className="q-press px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
                  style={active
                    ? { background: cfg.grad, color: '#fff', boxShadow: `0 4px 12px ${cfg.glow}` }
                    : { background: 'var(--q-accent-soft)', color: 'var(--q-text2)' }}>
                  {t(`common.difficulty.${d.toLowerCase()}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Section "En cours" ──
  const renderInProgressSection = (): React.ReactNode => {
    if (!hasInProgressContent) return null;
    return (
      <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
        <SectionHeader icon={<Clock size={18} color="#fff" aria-hidden="true" />} label={t('challengePage.sectionInProgress')}
          count={isDailyFilter ? displayedInProgress.length : visibleInProgressCount}
          grad="linear-gradient(135deg,#38BDF8,#A78BFA)" onClick={() => setInProgressOpen(o => !o)} isOpen={inProgressOpen}
          unreadCount={inProgressGroupsUnreadCount} />
        {inProgressOpen && (
          <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--q-line)', paddingTop: 12 }}>
            {filteredInProgressSeriesEntries.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {filteredInProgressSeriesEntries.map(([name, seriesChallenges]) => (
                  <SeriesDropdown key={name} name={name} displayName={resolveSeriesDisplayName(seriesChallenges, i18n.language)} challenges={seriesChallenges}
                    actionLoading={actionLoading} getUserStatus={getUserStatus}
                    onStart={handleStart} onComplete={handleComplete} user={user}
                    onJoined={async () => { await fetchUserChallenges(); await fetchInProgressItems(0); }}
                    onGroupChange={fetchMySeriesGroups} showNotif={showNotif}
                    onEdit={setEditingChallenge} onDelete={setConfirmDeleteChallenge}
                    onRefreshSeries={() => fetchSeriesChallenges(name)}
                    forceOpenSeries={focusSeriesName} focusChallengeId={focusChallengeId}
                    hasGroup={activeSeriesGroupNames.has(name)} />
                ))}
              </div>
            )}
            {filteredSoloInProgress.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredSoloInProgress.map(uc => (
                  <div key={uc.id} data-challenge-id={uc.challenge.id}
                    className={uc.challenge.id === focusChallengeId ? 'q-focus-flash' : undefined}>
                    <ChallengeCard challenge={uc.challenge} status="IN_PROGRESS" isLoading={actionLoading === uc.challenge.id}
                      user={user} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')}
                      onInvite={handleOpenInvite} onEdit={setEditingChallenge} onDelete={setConfirmDeleteChallenge}
                      activeGroup={groupByChallengeId.get(uc.challenge.id) ?? null} onOpenChat={openChat} onInviteMore={openExistingGroupInvite}
                      forceOpen={uc.challenge.id === focusChallengeId}
                      isDaily={uc.challenge.id === dailyChallengeId} />
                  </div>
                ))}
              </div>
            )}
            {!isDailyFilter && inProgressHasMore && (
              <button onClick={() => fetchInProgressItems(loadedInProgressGroupCount)} disabled={loadingMoreInProgress}
                className="q-press mt-4 w-full py-2.5 rounded-2xl border-2 border-dashed text-sm font-bold transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ borderColor: '#38BDF8', color: '#38BDF8' }}>
                {loadingMoreInProgress ? t('challengePage.loadingMore') : t('challengePage.loadMore')}
              </button>
            )}
          </div>
        )}
      </section>
    );
  };

  // ── Section "Disponibles" ──
  const renderAvailableSection = (): React.ReactNode => {
    if (available.length === 0) return null;
    return (
      <section data-tour="page-defis-available" className="rounded-2xl overflow-hidden" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
        <SectionHeader icon={<Trophy size={18} color="#fff" aria-hidden="true" />} label={t('challengePage.sectionAvailable')} count={available.length}
          grad="linear-gradient(135deg,#FACC15,#FB923C)" onClick={() => setAvailableOpen(o => !o)} isOpen={availableOpen} />
        {availableOpen && (
          <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--q-line)', paddingTop: 12 }}>
            {/* Séries (défis IA groupés) */}
            {seriesEntries.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {seriesEntries.map(([name, seriesChallenges]) => (
                  <SeriesDropdown key={name} name={name} displayName={resolveSeriesDisplayName(seriesChallenges, i18n.language)} challenges={seriesChallenges}
                    actionLoading={actionLoading} getUserStatus={getUserStatus}
                    onStart={handleStart} onComplete={handleComplete} user={user}
                    onJoined={async () => { await fetchUserChallenges(); await fetchInProgressItems(0); }}
                    onGroupChange={fetchMySeriesGroups} showNotif={showNotif}
                    onEdit={setEditingChallenge} onDelete={setConfirmDeleteChallenge}
                    onRefreshSeries={() => fetchSeriesChallenges(name)}
                    hasGroup={activeSeriesGroupNames.has(name)} />
                ))}
              </div>
            )}
            {/* Défis individuels */}
            {soloAvailable.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {soloAvailable.map(c => (
                  <ChallengeCard key={c.id} challenge={c} status={null} isLoading={actionLoading === c.id}
                    user={user} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')}
                    onInvite={handleOpenInvite} onEdit={setEditingChallenge} onDelete={setConfirmDeleteChallenge}
                    activeGroup={groupByChallengeId.get(c.id) ?? null} onOpenChat={openChat} onInviteMore={openExistingGroupInvite}
                    isDaily={c.id === dailyChallengeId} />
                ))}
              </div>
            )}
            {!isDailyFilter && hasMore && (
              <button onClick={() => fetchChallenges(loadedChallengeGroupCount)} disabled={loadingMore}
                className="q-press mt-4 w-full py-2.5 rounded-2xl border-2 border-dashed text-sm font-bold transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ borderColor: 'var(--q-accent)', color: 'var(--q-accent)' }}>
                {loadingMore ? t('challengePage.loadingMore') : t('challengePage.loadMore')}
              </button>
            )}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="py-4 md:p-6 min-h-screen" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-font)' }}>

      {/* ── Tchat de groupe (pattern identique à ForumTchat) ── */}
      {renderChatModal()}

      {/* ── Modal invitation groupe ── */}
      {renderInviteModal()}

      {/* ── Modal invitation dans un groupe existant ── */}
      {renderInviteExistingModal()}

      {/* ── Modal de modification d'un défi (auteur uniquement) ── */}
      <EditChallengeModal
        challenge={editingChallenge}
        onClose={() => setEditingChallenge(null)}
        showNotif={showNotif}
        onSaved={(updated) => {
          // Patch en place plutôt qu'un refetch : évite de faire sauter le scroll / réinitialiser
          // la pagination des listes "en cours" / "disponibles" / "terminés" pour un simple edit.
          const patch = (c: Challenge): Challenge => c.id === updated.id ? { ...c, ...updated } : c;
          setChallenges(prev => prev.map(patch));
          setInProgressItems(prev => prev.map(uc => uc.challenge.id === updated.id ? { ...uc, challenge: patch(uc.challenge) } : uc));
          setCompletedItems(prev => prev.map(uc => uc.challenge.id === updated.id ? { ...uc, challenge: patch(uc.challenge) } : uc));
          setDailyChallenge(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
          // Les défis de série ne viennent PAS des listes ci-dessus mais d'un cache séparé
          // (voir seriesFullChallenges / fetchSeriesChallenges) — sans ce patch, une modif sur un
          // défi de série n'apparaissait qu'après un rechargement complet de la page.
          setSeriesFullChallenges(prev => {
            const next: typeof prev = {};
            for (const [name, list] of Object.entries(prev)) next[name] = list.map(patch);
            return next;
          });
        }}
      />

      {/* ── Confirmation de suppression d'un défi (auteur uniquement) ── */}
      {confirmDeleteChallenge && (
        <div role="dialog" aria-modal="true" aria-label={t('editChallenge.deleteConfirmTitle')} style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => !deletingChallenge && setConfirmDeleteChallenge(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--q-chrome)', borderRadius: 24,
            border: '1px solid var(--q-line)',
            padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={22} color="#EF4444" aria-hidden="true" />
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--q-text)', marginBottom: 8 }}>{t('editChallenge.deleteConfirmTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--q-text2)', marginBottom: 24, lineHeight: 1.5 }}>
              {t('editChallenge.deleteConfirmBody', { title: confirmDeleteChallenge.title })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setConfirmDeleteChallenge(null)} disabled={deletingChallenge} style={{
                flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--q-line)',
                background: 'transparent', color: 'var(--q-text2)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                opacity: deletingChallenge ? 0.6 : 1,
              }}>{t('common.cancel')}</button>
              <button type="button" onClick={handleDeleteChallenge} disabled={deletingChallenge} style={{
                flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg,#EF4444,#DC2626)',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                opacity: deletingChallenge ? 0.6 : 1,
              }}>{deletingChallenge ? '…' : t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      <div aria-live="polite" aria-atomic="true" className="sr-only">{notification?.msg}</div>
      {notification && (
        <output className={`fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-50 px-5 py-3 rounded-2xl shadow-lg text-white font-bold text-sm ${notification.type === 'success' ? '' : 'bg-red-500'}`}
          style={notification.type === 'success' ? { background: 'linear-gradient(135deg,#34D399,#38BDF8)', boxShadow: '0 8px 24px rgba(52,211,153,0.45)' } : {}}>
          {notification.msg}
        </output>
      )}

      {/* ── Reward celebration overlay ── */}
      {rewardPopup && (
        <CelebrationOverlay
          coins={rewardPopup.coins}
          xp={rewardPopup.xp}
          isDailyBonus={rewardPopup.isDailyBonus}
          multiplier={rewardPopup.multiplier}
          streakUp={rewardPopup.streakUp}
          groupSize={rewardPopup.groupSize}
          groupBonusMultiplier={rewardPopup.groupBonusMultiplier}
          onDismiss={() => setRewardPopup(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'var(--q-display)', color: 'var(--q-text)' }}>
              <Trophy className="text-yellow-400" size={26} aria-hidden="true" />
              {t('challengePage.heading')}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--q-text2)' }}>{t('challengePage.subtitle')}</p>
          </div>
        </div>
        <button onClick={() => navigate('/challenges/create')}
          data-tour="create-challenge"
          aria-label={t('challengePage.createAriaLabel')}
          className="q-press flex items-center gap-1.5 px-4 py-2 rounded-full text-white font-bold text-sm transition-opacity hover:opacity-85"
          style={{ background: 'var(--q-vibrant-lavender)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
          <Plus size={15} aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">{t('challengePage.createButton')}</span>
        </button>
      </div>

      {/* Stats utilisateur */}
      {user && (
        <div data-tour="page-defis" className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#FACC15,#FB923C)', boxShadow: '0 4px 12px rgba(251,146,60,0.40)' }}>
            <CircleDollarSign size={13} aria-hidden="true" />
            {(user.coins ?? 0).toLocaleString()}
          </span>
          <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: 'var(--q-vibrant-hero)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
            <Zap size={11} aria-hidden="true" /> {t('navbar.level', { level: user.level ?? 1 })}
          </span>
          <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)', boxShadow: '0 4px 12px rgba(52,211,153,0.40)' }}>
            <CheckCircle size={11} aria-hidden="true" /> {t('challengePage.completedCount', { count: userChallenges.filter(c => c.status === 'COMPLETED').length })}
          </span>
        </div>
      )}

      {/* ── Groupes (invitations, actifs, terminés) ── */}
      {renderGroupsSection()}

      {/* ── Suggestion du jour chip ── */}
      {renderDailyChip()}

      {/* Recherche + filtres */}
      <div className="rounded-2xl p-3 mb-3 flex gap-2" style={{ background: 'var(--q-chrome)', boxShadow: 'var(--q-shadow)', border: '1px solid var(--q-line)' }}>
        <div className="flex items-center gap-2 flex-1">
          <Search size={15} aria-hidden="true" style={{ color: 'var(--q-text3)' }} className="flex-shrink-0" />
          <label htmlFor="challenge-search" className="sr-only">{t('challengePage.searchAriaLabel')}</label>
          <input id="challenge-search" value={search} onChange={e => { setSearch(e.target.value); setIsDailyFilter(false); }}
            placeholder={t('challengePage.searchPlaceholder')}
            className="flex-1 bg-transparent text-sm outline-none min-w-0"
            style={{ color: 'var(--q-text)', fontFamily: 'var(--q-font)' }} />
          {search && (
            <button onClick={() => setSearch('')} aria-label={t('challengePage.clearSearchAriaLabel')} style={{ color: 'var(--q-text3)' }}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <button onClick={() => setFiltersOpen(o => !o)}
          aria-expanded={filtersOpen}
          aria-label={activeFilters > 0 ? t('challengePage.filtersActive', { count: activeFilters }) : t('challengePage.filters')}
          className="q-press flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold flex-shrink-0 transition-opacity"
          style={filtersOpen || activeFilters > 0
            ? { background: 'var(--q-accent)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }
            : { background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }}>
          <SlidersHorizontal size={13} aria-hidden="true" />
          <span aria-hidden="true">{t('challengePage.filters')}{activeFilters > 0 && ` (${activeFilters})`}</span>
        </button>
      </div>

      {/* Filtres dépliables */}
      {renderFiltersPanel()}

      {/* ── À faire (aujourd'hui + calendrier de la semaine) ── */}
      {renderTodaySection()}

      {loading && <PageLoader message={t('challengePage.loadingChallenges')} />}

      {!loading && filtered.length === 0 && !hasInProgressContent && (
        <div className="text-center py-16" style={{ color: 'var(--q-text3)' }}>
          <Trophy size={44} className="mx-auto mb-3 opacity-30" />
          <p>{isDailyFilter ? t('challengePage.dailyNotAvailable') : t('challengePage.noChallengesFound')}</p>
          <button onClick={() => { setSearch(''); setSelectedCategory(''); setSelectedDifficulty(''); setIsDailyFilter(false); }}
            className="mt-3 text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: 'var(--q-accent)' }}>
            {t('challengePage.resetFilters')}
          </button>
        </div>
      )}

      {!loading && (filtered.length > 0 || hasInProgressContent) && (
        <div className="space-y-7">

          {/* Banner explicatif quand filtre journalier actif */}
          {isDailyFilter && (
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.08))', border: '1px solid rgba(251,191,36,0.35)' }}>
              <Sparkles size={22} style={{ color: '#F59E0B', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--q-text)' }}>{t('challengePage.dailySuggestion')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--q-text2)' }}>
                  {t('challengePage.dailyBonusBanner')}
                </p>
              </div>
            </div>
          )}

          {renderInProgressSection()}

          {renderAvailableSection()}

        </div>
      )}
    </div>
  );
};

export default ChallengePage;
