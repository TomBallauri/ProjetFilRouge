import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { useVisibilityPausedInterval } from '../hooks/useVisibilityPausedInterval';
import { useStore } from '../lib/store';
import type { User } from '../types/User';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trophy, Star, Zap, Search, Plus, CheckCircle, Clock, Flame, SlidersHorizontal, X, ChevronDown, ChevronUp, Gamepad2, Activity, UtensilsCrossed, Dumbbell, Palette, BookOpen, Users, Leaf, Music, Heart, Wrench, LayoutGrid, Sparkles, Send, MessageCircle, Mail, PartyPopper, Timer, Loader2, CircleDollarSign, UserPlus } from 'lucide-react';
import BackButton from '../components/BackButton';
import UserAvatar from '../components/UserAvatar';
import PageLoader from '../components/PageLoader';
import type { EquippedCosmetic } from '../lib/cosmetics';

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
  creator?: { id: number; username: string; avatar?: string };
  _count?: { participants: number };
};

type UserChallenge = { id: number; challengeId: number; status: string };
type UserChallengeWithData = { id: number; challengeId: number; status: string; startedAt: string; challenge: Challenge };

type GroupMember = {
  id: number; groupId: number; userId: number; status: string;
  user: { id: number; username: string; avatar?: string };
};
type GroupMessageType = {
  id: number; groupId: number; userId: number; content: string; createdAt: string;
  user: { id: number; username: string; avatar?: string; cosmetics?: EquippedCosmetic[] };
};
type ChallengeGroupType = {
  id: number; challengeId: number; createdBy: number; createdAt: string;
  challenge: Pick<Challenge, 'id' | 'title' | 'description' | 'difficulty' | 'category' | 'coinReward' | 'xpReward'>;
  creator: { id: number; username: string; avatar?: string };
  members: GroupMember[];
  messages: GroupMessageType[];
};
type Friend = { friendshipId: number; user: { id: number; username: string; avatar?: string } };

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
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
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
  isDaily?: boolean;
};

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, status, isLoading, user, onStart, onComplete, onLogin, onInvite, isDaily }) => {
  const { t } = useTranslation();
  const diff = DIFF_GRAD[challenge.difficulty] ?? DIFF_GRAD.EASY;
  const cat  = CATEGORY_GRAD[challenge.category] ?? CATEGORY_GRAD.GAMING;
  const CatIcon = cat.Icon;
  const [expanded, setExpanded] = useState(false);
  const hasLongDescription = challenge.description.length > 120;

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
    <div className="flex flex-col gap-3 p-4 rounded-2xl transition-transform hover:-translate-y-0.5"
      style={{
        background: 'var(--q-chrome)',
        boxShadow: isDaily ? '0 0 0 2px #FACC15, var(--q-shadow)' : 'var(--q-shadow)',
        border: isDaily ? '1px solid #FACC15' : '1px solid var(--q-line)',
      }}>

      <div className="flex items-center gap-3">
        <IconTile cat={challenge.category} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            <VibrantChip grad={diff.grad} glow={diff.glow}>{diff.icon}{t(`common.difficulty.${challenge.difficulty.toLowerCase()}`)}</VibrantChip>
            <VibrantChip grad={cat.grad} glow={cat.glow}><CatIcon size={11} aria-hidden="true" /> {t(`common.category.${challenge.category}`)}</VibrantChip>
            {isDaily && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-900"
                style={{ background: 'linear-gradient(135deg,#FACC15,#FB923C)', boxShadow: '0 3px 10px -2px rgba(251,146,60,0.5)' }}>
                <Sparkles size={10} aria-hidden="true" /> +50%
              </span>
            )}
          </div>
          {status === 'COMPLETED'   && <CheckCircle size={16} aria-hidden="true" className="text-emerald-400 float-right mt-0.5" />}
          {status === 'IN_PROGRESS' && <Clock size={16} aria-hidden="true" className="text-sky-400 float-right mt-0.5" />}
        </div>
      </div>

      <div className="flex-1">
        <h3 className="font-bold text-sm leading-snug" style={{ color: 'var(--q-text)' }}>{challenge.title}</h3>
        <div className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--q-text2)' }}>
          <p className={expanded ? '' : 'line-clamp-2'}>{challenge.description}</p>
          {hasLongDescription && (
            <button type="button" onClick={() => setExpanded(e => !e)}
              className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-500 hover:text-sky-400 transition-colors">
              {expanded ? t('challengePage.card.seeLess') : t('challengePage.card.seeMore')}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="font-bold" style={{ color: '#FB923C' }}>
          {challenge.coinReward}{isDaily ? ` → ${Math.floor(challenge.coinReward * 1.5)}` : ''} {t('challengePage.card.coins')}
        </span>
        <span className="font-bold" style={{ color: '#A78BFA' }}>
          <Zap size={11} aria-hidden="true" className="inline mr-0.5" />
          {challenge.xpReward}{isDaily ? ` → ${Math.floor(challenge.xpReward * 1.5)}` : ''} XP
        </span>
        {challenge._count && (
          <span className="ml-auto font-semibold" style={{ color: 'var(--q-text3)' }}>
            {t('challengePage.card.participants', { count: challenge._count.participants })}
          </span>
        )}
      </div>

      {actionButton()}
      {onInvite && user && status !== 'COMPLETED' && (
        <button onClick={() => onInvite(challenge)}
          className="q-press w-full py-2 rounded-full font-bold text-xs flex items-center justify-center gap-1.5"
          style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent)', border: '1px solid var(--q-accent)' }}>
          <Users size={12} aria-hidden="true" /> {t('challengePage.card.groupChallenge')}
        </button>
      )}
    </div>
  );
};

type SectionHeaderProps = {
  icon: React.ReactNode; label: string; count: number; grad: string;
  onClick?: () => void; isOpen?: boolean;
};
const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, label, count, grad, onClick, isOpen }) => {
  const badge = (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white ml-1"
      style={{ background: grad }}>{count}</span>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className="flex items-center gap-2 mb-3 w-full group">
        <span>{icon}</span>
        <h2 className="font-bold text-base" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>{label}</h2>
        {badge}
        <span className="ml-auto" style={{ color: 'var(--q-text3)' }}>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 mb-3">
      <span>{icon}</span>
      <h2 className="font-bold text-base" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>{label}</h2>
      {badge}
    </div>
  );
};


type SeriesGroupMember = { id: number; userId: number; status: string; confirmedAt?: string | null; user: { id: number; username: string; avatar?: string } };
type SeriesGroupData = { id: number; seriesName: string; createdBy: number; completedAt?: string | null; members: SeriesGroupMember[]; progress?: { userId: number; done: number; total: number }[] };
type FriendEntry = { friendshipId: number; user: { id: number; username: string; avatar?: string } };
type SeriesGroupMsg = { id: number; groupId: number; userId: number; content: string; createdAt: string; user: { id: number; username: string; avatar?: string } };
type PendingSeriesInvite = { id: number; seriesName: string; creator: { id: number; username: string; avatar?: string }; members: SeriesGroupMember[] };

const SeriesDropdown: React.FC<{
  name: string;
  challenges: Challenge[];
  actionLoading: number | null;
  getUserStatus: (id: number) => string | null;
  onStart: (id: number) => void;
  onComplete: (id: number) => void;
  user: User | null;
  onJoined?: () => void;
  onGroupChange?: () => void;
}> = ({ name, challenges, actionLoading, getUserStatus, onStart, onComplete, user, onJoined, onGroupChange }) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<SeriesGroupData | null | undefined>(undefined); // undefined=loading, null=none
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [startingAll, setStartingAll] = useState(false);
  const [kickLoading, setKickLoading] = useState<number | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messages, setMessages] = useState<SeriesGroupMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef(0);

  const token = () => localStorage.getItem('token') ?? '';

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
    if (!group) return;
    fetch(`/api/series-groups/by-series/${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(data => setGroup(data ?? null))
      .catch(() => {});
  };

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

  // Restaure lastMsgId depuis localStorage quand le groupe est chargé
  useEffect(() => {
    if (!group?.id) return;
    const stored = localStorage.getItem(`sg_lm_${group.id}`);
    if (stored) lastMsgIdRef.current = Number(stored) || 0;
  }, [group?.id]);

  // Chargement initial des messages + reset non-lus quand le chat s'ouvre
  useEffect(() => {
    if (!showChat || !group || myMembership?.status !== 'JOINED') return;
    setUnreadMessages(0);
    fetch(`/api/series-groups/${group.id}/messages`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        setMessages(data);
        if (data.length > 0) {
          lastMsgIdRef.current = data[data.length - 1].id;
          localStorage.setItem(`sg_lm_${group.id}`, String(data[data.length - 1].id));
        }
      })
      .catch(() => {});
  }, [showChat, group?.id, myMembership?.status]);

  // Polling messages toutes les 4s quand le dropdown est ouvert
  useVisibilityPausedInterval(() => {
    const groupId = group?.id;
    if (!groupId) return;
    fetch(`/api/series-groups/${groupId}/messages`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then((data: SeriesGroupMsg[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const latestId = data[data.length - 1].id;
        if (latestId > lastMsgIdRef.current) {
          const isBaseline = lastMsgIdRef.current === 0;
          const newCount = isBaseline ? 0 : data.filter(m => m.id > lastMsgIdRef.current).length;
          setMessages(data);
          lastMsgIdRef.current = latestId;
          localStorage.setItem(`sg_lm_${groupId}`, String(latestId));
          if (!showChat && newCount > 0) {
            setUnreadMessages(u => u + newCount);
          }
        }
      })
      .catch(() => {});
  }, 4000, open && !!group && myMembership?.status === 'JOINED');

  // Auto-scroll vers le bas quand de nouveaux messages arrivent (seulement si le chat est ouvert)
  useEffect(() => {
    if (showChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showChat]);

  const handleSendMessage = async () => {
    if (!group || !chatInput.trim() || chatSending) return;
    const content = chatInput.trim();
    // Optimistic update — message visible immédiatement
    const tempId = -Date.now();
    const optimistic: SeriesGroupMsg = {
      id: tempId, groupId: group.id, userId: user?.id ?? 0, content,
      createdAt: new Date().toISOString(),
      user: { id: user?.id ?? 0, username: user?.username ?? '', avatar: user?.avatar },
    };
    setMessages(prev => [...prev, optimistic]);
    setChatInput('');
    setChatSending(true);
    try {
      const res = await fetch(`/api/series-groups/${group.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ content }),
      });
      const msg = await res.json();
      if (res.ok) {
        // Remplacer le message temporaire par le vrai
        setMessages(prev => prev.map(m => m.id === tempId ? msg : m));
        lastMsgIdRef.current = msg.id;
        if (group) localStorage.setItem(`sg_lm_${group.id}`, String(msg.id));
      } else {
        // Rollback si erreur serveur
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setChatInput(content);
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setChatInput(content);
    } finally { setChatSending(false); }
  };

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
      alert(e instanceof Error ? e.message : t('challengePage.notif.genericError'));
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
        alert(data.error ?? t('challengePage.notif.genericError'));
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
      else alert(data.error ?? t('challengePage.notif.genericError'));
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
      else alert(data.error ?? t('challengePage.notif.genericError'));
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
      alert(e instanceof Error ? e.message : t('challengePage.notif.genericError'));
    } finally {
      setSaving(false);
    }
  };

  const toggleFriend = (id: number) =>
    setSelectedFriends(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--q-line)', background: 'var(--q-chrome)', overflow: 'hidden' }}>
      {/* Header */}
      <button type="button" onClick={() => setOpen(prev => !prev)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <Sparkles size={15} color="var(--q-accent)" aria-hidden="true" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: 'var(--q-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
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
          {user && (
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
                          <UserAvatar avatar={f.user.avatar} username={f.user.username} cosmetics={[]} size="sm" />
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

              {group && myMembership?.status === 'JOINED' && (
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
                                <UserAvatar avatar={f.user.avatar} username={f.user.username} cosmetics={[]} size="sm" />
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
                          <UserAvatar avatar={m.user.avatar} username={m.user.username} cosmetics={[]} size="sm" />
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
                              onClick={() => { if (globalThis.confirm(t('challengePage.series.excludeConfirm', { username: m.user.username }))) handleKick(m.userId); }}
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
                  {group.completedAt ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '10px', borderRadius: 12, marginTop: 12,
                      background: 'linear-gradient(135deg,rgba(52,211,153,0.2),rgba(56,189,248,0.2))',
                      color: '#34D399', fontSize: 13, fontWeight: 700,
                    }}>
                      <PartyPopper size={14} aria-hidden="true" /> {t('challengePage.series.seriesCompletedInGroup')}
                    </div>
                  ) : myConfirmed ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '10px', borderRadius: 12, marginTop: 12,
                      background: 'var(--q-accent-soft)', color: 'var(--q-text2)', fontSize: 12, fontWeight: 600,
                    }}>
                      {t('challengePage.series.waitingMembers', { count: pendingConfirmCount })}
                    </div>
                  ) : myDone && (
                    <button type="button" onClick={handleCompleteSeries} disabled={saving} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      width: '100%', padding: '10px', borderRadius: 12, border: 'none', marginTop: 12,
                      background: 'linear-gradient(135deg,#34D399,#38BDF8)', color: '#fff',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1,
                    }}>
                      {saving ? '…' : <><CheckCircle size={14} aria-hidden="true" /> {t('challengePage.series.validateParticipation')}</>}
                    </button>
                  )}

                  {/* ── Boutons d'action (masqués une fois la série terminée en groupe) ── */}
                  {!group.completedAt && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" onClick={() => { setShowChat(true); setUnreadMessages(0); }} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '10px', borderRadius: 12, border: 'none',
                        background: 'var(--q-accent)', color: '#fff',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer', position: 'relative',
                      }}>
                        <MessageCircle size={14} aria-hidden="true" /> {t('challengePage.series.chat')}
                        {unreadMessages > 0 && (
                          <span style={{
                            background: '#EF4444', color: '#fff', borderRadius: 999,
                            fontSize: 10, fontWeight: 800, padding: '1px 5px',
                            minWidth: 16, textAlign: 'center', flexShrink: 0,
                            boxShadow: '0 0 0 2px var(--q-accent)',
                          }}>
                            {unreadMessages > 99 ? '99+' : unreadMessages}
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
              )}

              {/* ── Confirmation quitter (hors du bloc JOINED pour ne pas disparaître au refetch) ── */}
              {confirmLeave && (
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
                      <Trans i18nKey="challengePage.series.leaveConfirmBody" values={{ name }} components={{ strong: <strong style={{ color: 'var(--q-text)' }} /> }} />
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
              )}

              {/* ── Modale tchat plein écran (hors du bloc JOINED pour ne pas disparaître au refetch) ── */}
              {showChat && (
                <div style={{
                  position: 'fixed', inset: 0, zIndex: 100,
                  background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                  padding: '0',
                }} onClick={() => setShowChat(false)}>
                  <div onClick={e => e.stopPropagation()} style={{
                    width: '100%', maxWidth: 520,
                    background: 'var(--q-chrome)',
                    borderRadius: '24px 24px 0 0',
                    border: '1px solid var(--q-line)',
                    borderBottom: 'none',
                    display: 'flex', flexDirection: 'column',
                    maxHeight: '80vh',
                    boxShadow: '0 -8px 48px rgba(0,0,0,0.4)',
                  }}>
                    {/* Header modale */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '16px 18px', borderBottom: '1px solid var(--q-line)', flexShrink: 0,
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--q-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MessageCircle size={17} color="#fff" aria-hidden="true" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--q-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <div style={{ fontSize: 11, color: 'var(--q-text3)' }}>{t('challengePage.seriesInvites.membersJoined', { count: group?.members.filter(m => m.status === 'JOINED').length ?? 0 })}</div>
                      </div>
                      <button type="button" onClick={() => setShowChat(false)} style={{
                        width: 32, height: 32, borderRadius: '50%', border: 'none',
                        background: 'var(--q-line)', color: 'var(--q-text2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                      }}>
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>

                    {/* Messages */}
                    <div className="q-hidescroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {messages.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--q-text3)', fontSize: 13 }}>
                          <MessageCircle size={32} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
                          {t('challengePage.series.noMessagesYet')}
                        </div>
                      )}
                      {messages.map(msg => {
                        const isMe = msg.user.id === user?.id;
                        return (
                          <div key={msg.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                            {!isMe && <UserAvatar avatar={msg.user.avatar} username={msg.user.username} cosmetics={[]} size="sm" />}
                            <div style={{ maxWidth: '72%' }}>
                              {!isMe && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--q-text3)', marginBottom: 3 }}>{msg.user.username}</div>}
                              <div style={{
                                padding: '9px 13px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                                background: isMe ? 'var(--q-accent)' : 'var(--q-bg-flat)',
                                border: isMe ? 'none' : '1px solid var(--q-line)',
                                color: isMe ? '#fff' : 'var(--q-text)',
                                fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word',
                              }}>
                                {msg.content}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--q-text3)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>
                                {new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{ padding: '12px 18px', borderTop: '1px solid var(--q-line)', display: 'flex', gap: 8, flexShrink: 0 }}>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        placeholder={t('challengePage.series.writeMessagePlaceholder')}
                        autoFocus
                        style={{
                          flex: 1, padding: '11px 14px', borderRadius: 14,
                          border: '1px solid var(--q-line)', background: 'var(--q-bg-flat)',
                          color: 'var(--q-text)', fontSize: 14, outline: 'none',
                        }}
                      />
                      <button type="button" onClick={handleSendMessage} disabled={chatSending || !chatInput.trim()} style={{
                        width: 44, height: 44, borderRadius: 14, border: 'none', flexShrink: 0,
                        background: chatInput.trim() ? 'var(--q-accent)' : 'var(--q-line)',
                        color: '#fff', cursor: chatInput.trim() ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: chatSending ? 0.6 : 1, transition: 'background 0.2s',
                      }}>
                        <Send size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Liste des défis ── */}
          {sorted.map((c, i) => {
            const status = getUserStatus(c.id);
            const done = status === 'COMPLETED';
            const inProgress = status === 'IN_PROGRESS';
            const diff = DIFF_GRAD[c.difficulty];
            const cat = CATEGORY_GRAD[c.category];
            return (
              <div key={c.id} style={{
                padding: '14px 14px',
                borderTop: i > 0 || user ? '1px solid var(--q-line)' : 'none',
                opacity: done ? 0.55 : 1,
              }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {diff && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#fff', background: diff.grad }}>{diff.icon} {t(`common.difficulty.${c.difficulty.toLowerCase()}`)}</span>}
                  {cat && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#fff', background: cat.grad }}><cat.Icon size={11} aria-hidden="true" /> {t(`common.category.${c.category}`)}</span>}
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
                ) : (
                  <button type="button" disabled={actionLoading === c.id} onClick={() => inProgress ? handleCompleteAndRefresh(c.id) : onStart(c.id)} style={{
                    width: '100%', padding: '9px', borderRadius: 12, border: 'none',
                    background: inProgress ? 'linear-gradient(135deg,#34D399,#38BDF8)' : 'var(--q-vibrant-lavender)',
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    opacity: actionLoading === c.id ? 0.5 : 1,
                  }}>
                    {actionLoading === c.id ? '…' : inProgress ? t('challengePage.card.markCompleted') : t('challengePage.series.start')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ChallengePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  usePageTitle(t('challengePage.pageTitle'));
  const { user, setUser } = useStore();
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
  const [rewardPopup, setRewardPopup] = useState<{ coins: number; xp: number; isDailyBonus: boolean; multiplier?: number; streakUp?: number; groupSize?: number; groupBonusMultiplier?: number } | null>(null);
  const [inProgressOpen, setInProgressOpen] = useState(true);
  const [availableOpen, setAvailableOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [dailyChallengeId, setDailyChallengeId] = useState<number | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<Challenge | null>(null);
  const [isDailyFilter, setIsDailyFilter] = useState(false);
  const [groups, setGroups] = useState<ChallengeGroupType[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inviteModal, setInviteModal] = useState<Challenge | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);
  const [groupActionLoading, setGroupActionLoading] = useState<number | null>(null);
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

  // ── Invite dans un groupe existant ────────────────────────────────────────
  const [inviteExistingGroup, setInviteExistingGroup] = useState<ChallengeGroupType | null>(null);
  const [inviteExistingFriends, setInviteExistingFriends] = useState<number[]>([]);
  const [inviteExistingLoading, setInviteExistingLoading] = useState(false);

  // ── Sections indépendantes (En cours / Terminés) ──────────────────────────
  const [inProgressItems, setInProgressItems] = useState<UserChallengeWithData[]>([]);
  const [inProgressTotal, setInProgressTotal] = useState(0);
  const [inProgressHasMore, setInProgressHasMore] = useState(false);
  const [loadingMoreInProgress, setLoadingMoreInProgress] = useState(false);
  const [completedItems, setCompletedItems] = useState<UserChallengeWithData[]>([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedHasMore, setCompletedHasMore] = useState(false);
  const [loadingMoreCompleted, setLoadingMoreCompleted] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => { fetchChallenges(0); }, [search, selectedCategory, selectedDifficulty, location.key]);
  useEffect(() => {
    if (!user || !token) return;
    setGroupsLoading(true);
    fetch('/api/users/me/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setUserChallenges(Array.isArray(data.challenges) ? data.challenges : []);
        setInProgressItems(data.inProgress?.challenges ?? []);
        setInProgressTotal(data.inProgress?.total ?? 0);
        setInProgressHasMore(data.inProgress?.hasMore ?? false);
        setCompletedItems(data.completed?.challenges ?? []);
        setCompletedTotal(data.completed?.total ?? 0);
        setCompletedHasMore(data.completed?.hasMore ?? false);
        setGroups(data.groups ?? []);
        setPendingSeriesInvites(data.pendingSeriesInvites ?? []);
      })
      .catch(() => {})
      .finally(() => setGroupsLoading(false));
    fetchMySeriesGroups();
  }, [user, location.key]);

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
      const res = await fetch(`/api/challenges/by-series/${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${token}` } });
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
    fetch('/api/challenges/daily-suggestion')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.id) {
          setDailyChallengeId(data.id);
          setDailyChallenge(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('daily')) setIsDailyFilter(true);
  }, [location.search]);

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
      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedDifficulty) params.set('difficulty', selectedDifficulty);
      if (search) params.set('search', search);
      params.set('skip', String(skip));
      params.set('limit', '10');
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
      const res = await fetch(`/api/users/me/challenges?status=IN_PROGRESS&limit=10&skip=${skip}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const items: UserChallengeWithData[] = Array.isArray(data) ? data : (data.challenges ?? []);
      if (skip > 0) setInProgressItems(prev => [...prev, ...items]);
      else setInProgressItems(items);
      if (!Array.isArray(data)) {
        setInProgressTotal(data.total ?? items.length);
        setInProgressHasMore(data.hasMore ?? false);
      }
    } catch { if (skip === 0) setInProgressItems([]); }
    finally { if (skip > 0) setLoadingMoreInProgress(false); }
  };

  const fetchCompletedItems = async (skip: number) => {
    if (!token) return;
    if (skip > 0) setLoadingMoreCompleted(true);
    try {
      const res = await fetch(`/api/users/me/challenges?status=COMPLETED&limit=10&skip=${skip}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const items: UserChallengeWithData[] = Array.isArray(data) ? data : (data.challenges ?? []);
      if (skip > 0) setCompletedItems(prev => [...prev, ...items]);
      else setCompletedItems(items);
      if (!Array.isArray(data)) {
        setCompletedTotal(data.total ?? items.length);
        setCompletedHasMore(data.hasMore ?? false);
      }
    } catch { if (skip === 0) setCompletedItems([]); }
    finally { if (skip > 0) setLoadingMoreCompleted(false); }
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
    } catch {}
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
      } catch {}
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
      user: { id: user.id, username: user.username, avatar: user.avatar, cosmetics: (user as any).cosmetics ?? [] },
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

  const handleCompleteGroup = async (groupId: number) => {
    if (!token) return;
    setGroupActionLoading(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || t('challengePage.notif.genericError'), 'error'); return; }
      await fetchGroups();
      showNotif(data.allCompleted ? t('challengePage.notif.groupAllCompleted') : t('challengePage.notif.groupCompletedWaiting'), 'success');
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

  const filtered = isDailyFilter && dailyChallenge
    ? [dailyChallenge]
    : challenges.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase())
      );

  const available = filtered.filter(c => getUserStatus(c.id) === null);

  // Le backend pagine désormais par "groupe" (une série entière = 1 objet, comme un défi
  // solo) : on doit donc lui donner le nombre de groupes déjà chargés, pas le nombre brut
  // de lignes Challenge (qui compterait une série de 5 jours comme 5).
  const loadedChallengeGroupCount = new Set(challenges.map(c => c.seriesName ?? `solo-${c.id}`)).size;
  // Même logique pour "En cours"/"Terminés", paginés séparément via /api/users/me/challenges.
  const loadedInProgressGroupCount = new Set(inProgressItems.map(uc => uc.challenge.seriesName ?? `solo-${uc.challenge.id}`)).size;
  const loadedCompletedGroupCount = new Set(completedItems.map(uc => uc.challenge.seriesName ?? `solo-${uc.challenge.id}`)).size;

  // Quand le filtre journalier est actif, on n'affiche que le défi du jour dans sa section
  const displayedInProgress = isDailyFilter && dailyChallenge
    ? inProgressItems.filter(uc => uc.challenge.id === dailyChallenge.id)
    : inProgressItems;
  const displayedCompleted = isDailyFilter && dailyChallenge
    ? completedItems.filter(uc => uc.challenge.id === dailyChallenge.id)
    : completedItems;

  // Séries dont le groupe existe encore mais n'a pas été validé (pas de completedAt) :
  // on les garde dans "En cours" tant qu'un membre n'a pas cliqué "Marquer la série
  // comme terminée", même si l'utilisateur a personnellement fini tous ses défis.
  const activeSeriesGroupNames = new Set(
    mySeriesGroups
      .filter(g => !g.completedAt && g.members.some(m => m.userId === user?.id && m.status === 'JOINED'))
      .map(g => g.seriesName)
  );

  // Groupement par série : dès qu'une série a été chargée en entier (voir fetchSeriesChallenges),
  // elle est affichée comme UNE seule carte basée sur sa liste complète — plus stable que de la
  // reconstruire à partir des pages partielles de "disponibles"/"en cours"/"terminés", qui pouvait
  // la faire apparaître/disparaître ou changer de compteur selon ce qui avait été chargé par
  // "Charger plus". Tant que la liste complète n'est pas encore chargée, on retombe sur un
  // regroupement partiel à partir de ce qui est déjà en mémoire (ci-dessous).
  const seriesMap = new Map<string, Challenge[]>();
  const inProgressSeriesMap = new Map<string, Challenge[]>();
  const completedSeriesMap = new Map<string, Challenge[]>();
  const resolvedSeriesNames = new Set<string>();

  if (!isDailyFilter) {
    for (const [name, full] of Object.entries(seriesFullChallenges)) {
      if (!full.length) continue;
      const statuses = full.map(c => getUserStatus(c.id));
      const allDone = statuses.every(s => s === 'COMPLETED');
      const anyProgress = statuses.some(s => s === 'IN_PROGRESS' || s === 'COMPLETED');
      if (allDone && !activeSeriesGroupNames.has(name)) completedSeriesMap.set(name, full);
      else if (anyProgress || activeSeriesGroupNames.has(name)) inProgressSeriesMap.set(name, full);
      else seriesMap.set(name, full);
      resolvedSeriesNames.add(name);
    }
  }

  // Groupement par série — "Disponibles" (repli partiel pour les séries pas encore résolues)
  const soloAvailable: Challenge[] = [];
  for (const c of available) {
    if (c.seriesName && resolvedSeriesNames.has(c.seriesName)) continue;
    if (c.seriesName && !isDailyFilter) {
      if (!seriesMap.has(c.seriesName)) seriesMap.set(c.seriesName, []);
      seriesMap.get(c.seriesName)!.push(c);
    } else {
      soloAvailable.push(c);
    }
  }
  const seriesEntries = Array.from(seriesMap.entries());

  // Groupement par série — "En cours" (repli partiel)
  const soloInProgress: UserChallengeWithData[] = [];
  for (const uc of displayedInProgress) {
    const n = uc.challenge.seriesName;
    if (n && resolvedSeriesNames.has(n)) continue;
    if (n && !isDailyFilter) {
      if (!inProgressSeriesMap.has(n)) inProgressSeriesMap.set(n, []);
      inProgressSeriesMap.get(n)!.push(uc.challenge);
    } else {
      soloInProgress.push(uc);
    }
  }

  // Groupement par série — "Terminés" (repli partiel)
  const soloCompleted: UserChallengeWithData[] = [];
  for (const uc of displayedCompleted) {
    const n = isDailyFilter ? null : uc.challenge.seriesName;
    if (n && resolvedSeriesNames.has(n)) continue;
    if (n && activeSeriesGroupNames.has(n)) {
      // Groupe pas encore validé par tous les membres : reste "En cours" même si
      // l'utilisateur a personnellement fini tous ses défis de la série.
      if (!inProgressSeriesMap.has(n)) inProgressSeriesMap.set(n, []);
      inProgressSeriesMap.get(n)!.push(uc.challenge);
    } else if (n && !seriesMap.has(n) && !inProgressSeriesMap.has(n)) {
      if (!completedSeriesMap.has(n)) completedSeriesMap.set(n, []);
      completedSeriesMap.get(n)!.push(uc.challenge);
    } else {
      soloCompleted.push(uc);
    }
  }

  const inProgressSeriesEntries = Array.from(inProgressSeriesMap.entries());
  const completedSeriesEntries = Array.from(completedSeriesMap.entries());

  // Une série au groupe non validé peut être injectée dans inProgressSeriesMap même quand
  // displayedInProgress est vide (l'utilisateur a fini tous ses défis perso) : les sections
  // "En cours"/"Terminés" doivent donc se baser sur ces listes dérivées, pas sur les compteurs bruts.
  const hasInProgressContent = soloInProgress.length > 0 || inProgressSeriesEntries.length > 0;
  const hasCompletedContent = soloCompleted.length > 0 || completedSeriesEntries.length > 0;

  // Compteurs d'en-tête basés sur ce qui est réellement affiché (et non sur les totaux bruts
  // du backend, qui ne savent pas qu'une série au groupe non validé est déplacée vers "En cours").
  const visibleInProgressCount = soloInProgress.length + inProgressSeriesEntries.reduce((sum, [, chs]) => sum + chs.length, 0);
  const visibleCompletedCount = soloCompleted.length + completedSeriesEntries.reduce((sum, [, chs]) => sum + chs.length, 0);

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

  // ── Groupes (calculés au niveau composant pour être partagés) ─────────────
  const activeGroups = user ? groups.filter(g => {
    const joined = g.members.filter(m => m.status !== 'INVITED');
    return joined.length === 0 || joined.some(m => m.status !== 'COMPLETED');
  }) : [];
  const completedGroups = user ? groups.filter(g => {
    const joined = g.members.filter(m => m.status !== 'INVITED');
    return joined.length > 0 && joined.every(m => m.status === 'COMPLETED');
  }) : [];

  const renderGroupCard = (g: ChallengeGroupType) => {
    if (!user) return null;
    const myMember = g.members.find(m => m.userId === user.id);
    const isPending = myMember?.status === 'INVITED';
    const isJoined = myMember?.status === 'JOINED';
    const isCompleted = myMember?.status === 'COMPLETED';
    const joinedMembers = g.members.filter(m => m.status !== 'INVITED');
    const completedCount = joinedMembers.filter(m => m.status === 'COMPLETED').length;
    const allDone = joinedMembers.length > 0 && completedCount === joinedMembers.length;
    const canInvite = (isJoined || user.id === g.createdBy) && g.members.length < 4 && !allDone;
    return (
      <div key={g.id} className="rounded-2xl p-3" style={{
        background: 'var(--q-chrome)', border: `1px solid ${isPending ? '#A78BFA' : 'var(--q-line)'}`,
        boxShadow: isPending ? '0 0 0 2px rgba(167,139,250,0.25)' : 'var(--q-shadow)',
      }}>
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm" style={{ color: 'var(--q-text)' }}>{g.challenge.title}</div>
            <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--q-text2)' }}>
              {isPending
                ? <><Mail size={10} aria-hidden="true" /> {t('challengePage.groupCard.invitedYouText', { username: g.creator.username })}</>
                : allDone
                  ? <><PartyPopper size={10} aria-hidden="true" /> {t('challengePage.groupCard.allCompleted')}</>
                  : <><Users size={10} aria-hidden="true" /> {t('challengePage.groupCard.membersCompleted', { count: joinedMembers.length, completed: completedCount, total: joinedMembers.length })}</>}
            </div>
          </div>
          {isPending && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)' }}>{t('challengePage.groupCard.invitation')}</span>
          )}
          {!isPending && (
            <button onClick={() => openChat(g.id)}
              className="q-press flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent)', border: '1px solid var(--q-accent)' }}>
              <MessageCircle size={11} aria-hidden="true" /> {t('challengePage.series.chat')}
            </button>
          )}
        </div>
        {/* Membres */}
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {g.members.map(m => {
            const StatusIcon = m.status === 'COMPLETED' ? CheckCircle : m.status === 'JOINED' ? Timer : Mail;
            const iconColor = m.status === 'COMPLETED' ? '#34D399' : m.status === 'JOINED' ? '#38BDF8' : 'var(--q-text3)';
            return (
              <div key={m.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: m.status === 'COMPLETED' ? 'rgba(52,211,153,0.15)' : m.status === 'JOINED' ? 'rgba(56,189,248,0.12)' : 'var(--q-line)',
                  color: iconColor,
                }}>
                <StatusIcon size={10} aria-hidden="true" /> {m.user.username}
              </div>
            );
          })}
        </div>
        {/* Actions */}
        {isPending && (
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
        )}
        {isJoined && !allDone && (
          <button onClick={() => handleCompleteGroup(g.id)} disabled={groupActionLoading === g.id}
            className="q-press w-full py-2 rounded-full font-bold text-xs text-white disabled:opacity-60 flex items-center justify-center gap-1"
            style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)' }}>
            {groupActionLoading === g.id
              ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              : <><CheckCircle size={11} aria-hidden="true" /> {t('challengePage.card.markCompleted')}</>}
          </button>
        )}
        {isCompleted && !allDone && (
          <div className="w-full py-2 rounded-full font-bold text-xs text-center flex items-center justify-center gap-1"
            style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
            <CheckCircle size={11} aria-hidden="true" /> {t('challengePage.groupCard.completedWaitingOthers')}
          </div>
        )}
        {allDone && (
          <div className="w-full py-2 rounded-full font-bold text-xs text-center flex items-center justify-center gap-1"
            style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.2),rgba(56,189,248,0.2))', color: '#34D399' }}>
            <PartyPopper size={11} aria-hidden="true" /> {t('challengePage.groupCard.groupChallengeCompleted')}
          </div>
        )}
        {canInvite && (
          <button onClick={() => { setInviteExistingGroup(g); setInviteExistingFriends([]); if (friends.length === 0) fetchFriends(); }}
            className="q-press w-full py-2 rounded-full font-bold text-xs flex items-center justify-center gap-1 mt-1"
            style={{ background: 'var(--q-bg)', color: 'var(--q-text2)', border: '1px dashed var(--q-line)' }}>
            <Plus size={11} aria-hidden="true" /> {t('challengePage.groupCard.inviteFriendsSlots', { count: 4 - g.members.length })}
          </button>
        )}
      </div>
    );
  };

  const activeFilters = [selectedCategory, selectedDifficulty, isDailyFilter ? 'daily' : ''].filter(Boolean).length;

  return (
    <div className="py-4 md:p-6 min-h-screen" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-font)' }}>

      {/* ── Tchat de groupe (pattern identique à ForumTchat) ── */}
      {chatGroupId !== null && (
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
              ) : chatMessages.length === 0 ? (
                <p className="text-center text-sm" style={{ color: 'var(--q-text3)', paddingTop: 24 }}>
                  {t('challengePage.chatModal.noMessages')}
                </p>
              ) : null}
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
      )}

      {/* ── Modal invitation groupe ── */}
      {inviteModal && (
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
            {friends.length === 0 ? (
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
            )}
            <button onClick={handleCreateGroup}
              disabled={groupCreating}
              className="q-press w-full py-3 rounded-full font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--q-vibrant-lavender)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
              {groupCreating ? t('challengePage.inviteModal.creating') : selectedFriends.length > 0
                ? t('challengePage.inviteModal.createWithMembers', { count: selectedFriends.length + 1 })
                : t('challengePage.inviteModal.createSolo')}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal invitation dans un groupe existant ── */}
      {inviteExistingGroup && (
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
            {(() => {
              const alreadyIn = new Set(inviteExistingGroup.members.map(m => m.userId));
              const eligible = friends.filter(f => !alreadyIn.has(f.user.id));
              return eligible.length === 0 ? (
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
            })()}
            <button onClick={handleInviteToGroup}
              disabled={inviteExistingLoading || inviteExistingFriends.length === 0}
              className="q-press w-full py-3 rounded-full font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'var(--q-vibrant-lavender)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
              {inviteExistingLoading ? t('challengePage.inviteExistingModal.sending') : inviteExistingFriends.length > 0
                ? t('challengePage.inviteExistingModal.inviteCount', { count: inviteExistingFriends.length })
                : t('challengePage.inviteExistingModal.selectFriends')}
            </button>
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

      {/* ── Invitations de groupes de série en attente ── */}
      {pendingSeriesInvites.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail size={15} style={{ color: '#A78BFA' }} aria-hidden="true" />
            <span className="font-bold text-sm" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>
              {t('challengePage.seriesInvites.title')}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: '#EF4444' }}>{pendingSeriesInvites.length}</span>
          </div>
          <div className="flex flex-col gap-2">
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
          </div>
        </div>
      )}

      {/* ── Défis en groupe (actifs) ── */}
      {user && (groupsLoading || activeGroups.length > 0) && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} style={{ color: '#A78BFA' }} aria-hidden="true" />
            <span className="font-bold text-sm" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>
              {t('challengePage.activeGroupsTitle')}
            </span>
            {groupsLoading
              ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--q-text3)' }} aria-label={t('challengePage.loadingAriaLabel')} />
              : activeGroups.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)' }}>{activeGroups.length}</span>
              )}
          </div>
          {!groupsLoading && activeGroups.map(g => renderGroupCard(g))}
        </div>
      )}

      {/* ── Suggestion du jour chip ── */}
      {dailyChallengeId && (
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
      )}

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
      {filtersOpen && (
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
      )}

      {loading && <PageLoader message={t('challengePage.loadingChallenges')} />}

      {!loading && filtered.length === 0 && !hasInProgressContent && !hasCompletedContent && (
        <div className="text-center py-16" style={{ color: 'var(--q-text3)' }}>
          <Trophy size={44} className="mx-auto mb-3 opacity-30" />
          <p>{isDailyFilter ? t('challengePage.dailyNotAvailable') : t('challengePage.noChallengesFound')}</p>
          <button onClick={() => { setSearch(''); setSelectedCategory(''); setSelectedDifficulty(''); setIsDailyFilter(false); }}
            className="mt-3 text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: 'var(--q-accent)' }}>
            {t('challengePage.resetFilters')}
          </button>
        </div>
      )}

      {!loading && (filtered.length > 0 || hasInProgressContent || hasCompletedContent) && (
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

          {hasInProgressContent && (
            <section>
              <SectionHeader icon={<Clock size={16} style={{ color: '#38BDF8' }} />} label={t('challengePage.sectionInProgress')}
                count={isDailyFilter ? displayedInProgress.length : visibleInProgressCount}
                grad="linear-gradient(135deg,#38BDF8,#A78BFA)" onClick={() => setInProgressOpen(o => !o)} isOpen={inProgressOpen} />
              {inProgressOpen && (
                <>
                  {inProgressSeriesEntries.length > 0 && (
                    <div className="flex flex-col gap-2 mb-3">
                      {inProgressSeriesEntries.map(([name, seriesChallenges]) => (
                        <SeriesDropdown key={name} name={name} challenges={seriesChallenges}
                          actionLoading={actionLoading} getUserStatus={getUserStatus}
                          onStart={handleStart} onComplete={handleComplete} user={user}
                          onJoined={async () => { await fetchUserChallenges(); await fetchInProgressItems(0); }}
                          onGroupChange={fetchMySeriesGroups} />
                      ))}
                    </div>
                  )}
                  {soloInProgress.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {soloInProgress.map(uc => (
                        <ChallengeCard key={uc.id} challenge={uc.challenge} status="IN_PROGRESS" isLoading={actionLoading === uc.challenge.id}
                          user={user} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')}
                          onInvite={handleOpenInvite} isDaily={uc.challenge.id === dailyChallengeId} />
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
                </>
              )}
            </section>
          )}

          {available.length > 0 && (
            <section data-tour="page-defis-available">
              <SectionHeader icon={<Trophy size={16} style={{ color: '#FACC15' }} />} label={t('challengePage.sectionAvailable')} count={available.length}
                grad="linear-gradient(135deg,#FACC15,#FB923C)" onClick={() => setAvailableOpen(o => !o)} isOpen={availableOpen} />
              {availableOpen && (
                <>
                  {/* Séries (défis IA groupés) */}
                  {seriesEntries.length > 0 && (
                    <div className="flex flex-col gap-2 mb-3">
                      {seriesEntries.map(([name, seriesChallenges]) => (
                        <SeriesDropdown key={name} name={name} challenges={seriesChallenges}
                          actionLoading={actionLoading} getUserStatus={getUserStatus}
                          onStart={handleStart} onComplete={handleComplete} user={user}
                          onJoined={async () => { await fetchUserChallenges(); await fetchInProgressItems(0); }}
                          onGroupChange={fetchMySeriesGroups} />
                      ))}
                    </div>
                  )}
                  {/* Défis individuels */}
                  {soloAvailable.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {soloAvailable.map(c => (
                        <ChallengeCard key={c.id} challenge={c} status={null} isLoading={actionLoading === c.id}
                          user={user} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')}
                          onInvite={handleOpenInvite} isDaily={c.id === dailyChallengeId} />
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
                </>
              )}
            </section>
          )}

          {(hasCompletedContent || (!isDailyFilter && completedGroups.length > 0)) && (
            <section>
              <SectionHeader icon={<CheckCircle size={16} style={{ color: '#34D399' }} />} label={t('challengePage.sectionCompleted')}
                count={isDailyFilter ? displayedCompleted.length : visibleCompletedCount + completedGroups.length}
                grad="linear-gradient(135deg,#34D399,#38BDF8)" onClick={() => setCompletedOpen(o => !o)} isOpen={completedOpen} />
              {completedOpen && (
                <>
                  {completedSeriesEntries.length > 0 && (
                    <div className="flex flex-col gap-2 mb-3">
                      {completedSeriesEntries.map(([name, seriesChallenges]) => (
                        <SeriesDropdown key={name} name={name} challenges={seriesChallenges}
                          actionLoading={actionLoading} getUserStatus={getUserStatus}
                          onStart={handleStart} onComplete={handleComplete} user={user}
                          onJoined={async () => { await fetchUserChallenges(); await fetchInProgressItems(0); }}
                          onGroupChange={fetchMySeriesGroups} />
                      ))}
                    </div>
                  )}
                  {soloCompleted.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 opacity-75">
                      {soloCompleted.map(uc => (
                        <ChallengeCard key={uc.id} challenge={uc.challenge} status="COMPLETED" isLoading={false}
                          user={user} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')}
                          isDaily={uc.challenge.id === dailyChallengeId} />
                      ))}
                    </div>
                  )}
                  {!isDailyFilter && completedHasMore && (
                    <button onClick={() => fetchCompletedItems(loadedCompletedGroupCount)} disabled={loadingMoreCompleted}
                      className="q-press mt-4 w-full py-2.5 rounded-2xl border-2 border-dashed text-sm font-bold transition-opacity hover:opacity-70 disabled:opacity-40"
                      style={{ borderColor: '#34D399', color: '#34D399' }}>
                      {loadingMoreCompleted ? t('challengePage.loadingMore') : t('challengePage.loadMore')}
                    </button>
                  )}
                  {/* Groupes terminés */}
                  {!isDailyFilter && completedGroups.length > 0 && (
                    <div className={displayedCompleted.length > 0 ? 'mt-4 pt-4' : ''} style={displayedCompleted.length > 0 ? { borderTop: '1px solid var(--q-line)' } : {}}>
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={14} style={{ color: '#A78BFA' }} aria-hidden="true" />
                        <span className="font-bold text-sm" style={{ color: 'var(--q-text2)', fontFamily: 'var(--q-display)' }}>{t('challengePage.groupsCompleted')}</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)' }}>{completedGroups.length}</span>
                      </div>
                      <div className="space-y-2 opacity-75">
                        {completedGroups.map(g => renderGroupCard(g))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

        </div>
      )}
    </div>
  );
};

export default ChallengePage;
