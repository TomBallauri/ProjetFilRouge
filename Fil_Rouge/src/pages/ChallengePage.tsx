import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useStore } from '../lib/store';
import type { User } from '../types/User';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trophy, Star, Zap, Search, Plus, CheckCircle, Clock, Flame, SlidersHorizontal, X, ChevronDown, ChevronUp, Gamepad2, Activity, UtensilsCrossed, Dumbbell, Palette, BookOpen, Users, Leaf, Music, Heart, Wrench, LayoutGrid, Sparkles, Send, MessageCircle, Mail, PartyPopper, Timer, Loader2, CircleDollarSign } from 'lucide-react';
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

const CATEGORY_GRAD: Record<string, { grad: string; glow: string; Icon: React.FC<{ size?: number | string }>; label: string }> = {
  GAMING:     { grad: 'linear-gradient(135deg,#A78BFA,#EC4899)', glow: 'rgba(167,139,250,0.5)', Icon: Gamepad2,        label: 'Gaming' },
  SPORT:      { grad: 'linear-gradient(135deg,#34D399,#38BDF8)', glow: 'rgba(52,211,153,0.5)',  Icon: Activity,        label: 'Sport' },
  CUISINE:    { grad: 'linear-gradient(135deg,#FACC15,#FB923C,#EC4899)', glow: 'rgba(251,146,60,0.5)', Icon: UtensilsCrossed, label: 'Cuisine' },
  FITNESS:    { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.5)',  Icon: Dumbbell,        label: 'Fitness' },
  CREATIVITY: { grad: 'linear-gradient(135deg,#EC4899,#A78BFA)', glow: 'rgba(236,72,153,0.5)',  Icon: Palette,         label: 'Créativité' },
  KNOWLEDGE:  { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.5)',  Icon: BookOpen,        label: 'Savoir' },
  SOCIAL:     { grad: 'linear-gradient(135deg,#FACC15,#FB923C)', glow: 'rgba(250,204,21,0.5)',  Icon: Users,           label: 'Social' },
  NATURE:     { grad: 'linear-gradient(135deg,#4ADE80,#16A34A)', glow: 'rgba(74,222,128,0.5)',  Icon: Leaf,            label: 'Nature' },
  MUSIC:      { grad: 'linear-gradient(135deg,#F472B6,#A78BFA)', glow: 'rgba(244,114,182,0.5)', Icon: Music,           label: 'Musique' },
  WELLNESS:   { grad: 'linear-gradient(135deg,#6EE7B7,#3B82F6)', glow: 'rgba(110,231,183,0.5)', Icon: Heart,           label: 'Bien-être' },
  DIY:        { grad: 'linear-gradient(135deg,#FB923C,#D97706)', glow: 'rgba(251,146,60,0.5)',  Icon: Wrench,          label: 'DIY' },
  OTHERS:     { grad: 'linear-gradient(135deg,#94A3B8,#64748B)', glow: 'rgba(148,163,184,0.5)', Icon: LayoutGrid,      label: 'Autres' },
};

const DIFF_GRAD: Record<string, { label: string; grad: string; glow: string; icon: React.ReactNode }> = {
  EASY:   { label: 'Facile',    grad: 'linear-gradient(135deg,#34D399,#38BDF8)', glow: 'rgba(52,211,153,0.45)',  icon: <Star size={11} aria-hidden="true" /> },
  MEDIUM: { label: 'Moyen',    grad: 'linear-gradient(135deg,#FACC15,#FB923C)', glow: 'rgba(251,146,60,0.45)',  icon: <Zap size={11} aria-hidden="true" /> },
  HARD:   { label: 'Difficile', grad: 'linear-gradient(135deg,#FB923C,#EC4899)', glow: 'rgba(251,146,60,0.45)', icon: <Flame size={11} aria-hidden="true" /> },
  EXPERT: { label: 'Expert',   grad: 'linear-gradient(135deg,#EC4899,#A78BFA)', glow: 'rgba(236,72,153,0.45)', icon: <Trophy size={11} aria-hidden="true" /> },
};

const CATEGORIES   = Object.keys(CATEGORY_GRAD);
const DIFFICULTIES = Object.keys(DIFF_GRAD);

// ── CelebrationOverlay ────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#A78BFA','#EC4899','#FACC15','#34D399','#38BDF8','#FB923C','#ffffff','#F472B6','#6EE7B7','#818CF8'];

interface CelebrationProps {
  coins: number; xp: number; isDailyBonus: boolean;
  multiplier?: number; streakUp?: number; onDismiss: () => void;
}

const CelebrationOverlay: React.FC<CelebrationProps> = ({ coins, xp, isDailyBonus, multiplier, streakUp, onDismiss }) => {
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
      role="dialog" aria-modal="true" aria-label="Récompenses obtenues"
      className="celebrate-backdrop fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', cursor: 'pointer' }}
      onClick={onDismiss}
      onKeyDown={e => { if (e.key === 'Escape') onDismiss(); }}
      tabIndex={-1}
    >
      {/* Glow blob behind the card */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(167,139,250,0.28) 0%, transparent 70%)',
        animation: 'celebrate-glow-pulse 2s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

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
            {isDailyBonus ? '⚡ Bonus du jour !' : '🎉 Défi validé !'}
          </p>
          <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.48)' }}>
            Continue comme ça, tu es incroyable !
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
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(250,204,21,0.65)' }}>Coins</span>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '16px 18px', borderRadius: 18,
            background: 'rgba(56,189,248,0.11)', border: '1px solid rgba(56,189,248,0.28)',
            animation: 'reward-item-pop 0.45s 0.52s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <Zap size={28} color="#38BDF8" aria-hidden="true" />
            <span className="font-black text-2xl text-white">+{displayXp}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(56,189,248,0.65)' }}>XP</span>
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
                    {streakUp - 1}j
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
                    {streakUp}j
                  </span>
                )}
              </div>

              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(251,146,60,0.65)' }}>Streak</span>
            </div>
          )}
        </div>

        {/* Daily bonus chip */}
        {isDailyBonus && multiplier && (
          <div style={{ animation: 'reward-item-pop 0.4s 0.82s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <span className="flex items-center gap-1.5 font-black text-sm text-amber-900 px-5 py-2 rounded-full"
              style={{ background: 'linear-gradient(135deg,#FACC15,#FB923C)', boxShadow: '0 6px 20px rgba(251,146,60,0.5)' }}>
              <Sparkles size={14} aria-hidden="true" /> ×{multiplier} bonus journalier
            </span>
          </div>
        )}

        {/* Dismiss hint */}
        <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, marginTop: 4, animation: 'reward-item-pop 0.3s 1.3s ease-out both' }}>
          Appuie n'importe où pour continuer
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
        Se connecter pour participer
      </button>
    );
    if (status === 'COMPLETED') return (
      <div className="w-full py-2.5 rounded-full text-center font-bold text-sm"
        style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)', color: '#fff',
          boxShadow: '0 4px 12px rgba(52,211,153,0.40)' }}>
        Défi complété !
      </div>
    );
    if (status === 'IN_PROGRESS') return (
      <button onClick={() => onComplete(challenge.id)} disabled={isLoading}
        className="q-press w-full py-2.5 rounded-full text-white font-bold text-sm disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)', boxShadow: '0 4px 12px rgba(52,211,153,0.40)' }}>
        {isLoading ? '...' : 'Marquer comme complété'}
      </button>
    );
    return (
      <button onClick={() => onStart(challenge.id)} disabled={isLoading}
        className="q-press w-full py-2.5 rounded-full text-white font-bold text-sm disabled:opacity-60"
        style={{ background: 'var(--q-vibrant-lavender)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
        {isLoading ? '...' : 'Commencer le défi'}
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
            <VibrantChip grad={diff.grad} glow={diff.glow}>{diff.icon}{diff.label}</VibrantChip>
            <VibrantChip grad={cat.grad} glow={cat.glow}><CatIcon size={11} aria-hidden="true" /> {cat.label}</VibrantChip>
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
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="font-bold" style={{ color: '#FB923C' }}>
          {challenge.coinReward}{isDaily ? ` → ${Math.floor(challenge.coinReward * 1.5)}` : ''} coins
        </span>
        <span className="font-bold" style={{ color: '#A78BFA' }}>
          <Zap size={11} aria-hidden="true" className="inline mr-0.5" />
          {challenge.xpReward}{isDaily ? ` → ${Math.floor(challenge.xpReward * 1.5)}` : ''} XP
        </span>
        {challenge._count && (
          <span className="ml-auto font-semibold" style={{ color: 'var(--q-text3)' }}>
            {challenge._count.participants} participant{challenge._count.participants > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {actionButton()}
      {onInvite && user && status !== 'COMPLETED' && (
        <button onClick={() => onInvite(challenge)}
          className="q-press w-full py-2 rounded-full font-bold text-xs flex items-center justify-center gap-1.5"
          style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent)', border: '1px solid var(--q-accent)' }}>
          <Users size={12} aria-hidden="true" /> Défi en groupe
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

const ChallengePage: React.FC = () => {
  usePageTitle('Défis');
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
  const [rewardPopup, setRewardPopup] = useState<{ coins: number; xp: number; isDailyBonus: boolean; multiplier?: number; streakUp?: number } | null>(null);
  const [inProgressOpen, setInProgressOpen] = useState(true);
  const [availableOpen, setAvailableOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [dailyChallengeId, setDailyChallengeId] = useState<number | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<Challenge | null>(null);
  const [isDailyFilter, setIsDailyFilter] = useState(false);
  const [groups, setGroups] = useState<ChallengeGroupType[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [completedGroupsOpen, setCompletedGroupsOpen] = useState(false);
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
  useEffect(() => { if (user) { fetchUserChallenges(); fetchGroups(); fetchInProgressItems(0); fetchCompletedItems(0); } }, [user, location.key]);

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
        setChallenges(prev => sortChallenges([...prev, ...newChallenges]));
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
      if (!res.ok) { showNotif(data.error || 'Erreur', 'error'); return; }
      setGroups(prev => [data, ...prev]);
      setInviteModal(null);
      setSelectedFriends([]);
      showNotif('Groupe créé ! Tes amis ont été invités.', 'success');
    } catch { showNotif('Erreur lors de la création', 'error'); }
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
  useEffect(() => {
    if (chatGroupId === null) return;
    const interval = setInterval(() => fetchChatMessages(chatGroupId), 2000);
    return () => clearInterval(interval);
  }, [chatGroupId]);

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
      if (!res.ok) { showNotif('Erreur', 'error'); return; }
      await fetchGroups();
      showNotif('Tu as rejoint le groupe !', 'success');
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
      if (!res.ok) { showNotif(data.error || 'Erreur', 'error'); return; }
      await fetchGroups();
      showNotif(data.allCompleted ? 'Groupe terminé ! Bravo à tous !' : 'Complété ! En attente des autres membres…', 'success');
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
      if (!res.ok) { showNotif(data.error || 'Erreur', 'error'); return; }
      await Promise.all([fetchUserChallenges(), fetchInProgressItems(0), fetchCompletedItems(0)]);
      showNotif('Défi commencé ! Bonne chance !', 'success');
    } finally { setActionLoading(null); }
  };

  const handleComplete = async (id: number) => {
    if (!user) { navigate('/login'); return; }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/challenges/${id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || 'Erreur', 'error'); return; }
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

  // Quand le filtre journalier est actif, on n'affiche que le défi du jour dans sa section
  const displayedInProgress = isDailyFilter && dailyChallenge
    ? inProgressItems.filter(uc => uc.challenge.id === dailyChallenge.id)
    : inProgressItems;
  const displayedCompleted = isDailyFilter && dailyChallenge
    ? completedItems.filter(uc => uc.challenge.id === dailyChallenge.id)
    : completedItems;

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
      if (!res.ok) { showNotif(data.error || 'Erreur', 'error'); return; }
      setGroups(prev => prev.map(g => g.id === inviteExistingGroup.id ? data : g));
      setInviteExistingGroup(null);
      setInviteExistingFriends([]);
      showNotif('Invitation(s) envoyée(s) !', 'success');
    } catch { showNotif('Erreur lors de l\'invitation', 'error'); }
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
                ? <><Mail size={10} aria-hidden="true" /> {g.creator.username} t'invite à ce défi en groupe</>
                : allDone
                  ? <><PartyPopper size={10} aria-hidden="true" /> Tous les membres ont terminé !</>
                  : <><Users size={10} aria-hidden="true" /> {completedCount}/{joinedMembers.length} membre{joinedMembers.length > 1 ? 's' : ''} ont terminé</>}
            </div>
          </div>
          {isPending && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)' }}>Invitation</span>
          )}
          {!isPending && (
            <button onClick={() => openChat(g.id)}
              className="q-press flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent)', border: '1px solid var(--q-accent)' }}>
              <MessageCircle size={11} aria-hidden="true" /> Tchat
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
              {groupActionLoading === g.id ? <Loader2 size={12} className="animate-spin" /> : <><CheckCircle size={11} /> Rejoindre</>}
            </button>
            <button onClick={() => handleDeclineGroup(g.id)} disabled={groupActionLoading === g.id}
              className="q-press flex-1 py-2 rounded-full font-bold text-xs disabled:opacity-60"
              style={{ background: 'var(--q-line)', color: 'var(--q-text2)' }}>
              Refuser
            </button>
          </div>
        )}
        {isJoined && !allDone && (
          <button onClick={() => handleCompleteGroup(g.id)} disabled={groupActionLoading === g.id}
            className="q-press w-full py-2 rounded-full font-bold text-xs text-white disabled:opacity-60 flex items-center justify-center gap-1"
            style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)' }}>
            {groupActionLoading === g.id
              ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              : <><CheckCircle size={11} aria-hidden="true" /> Marquer comme complété</>}
          </button>
        )}
        {isCompleted && !allDone && (
          <div className="w-full py-2 rounded-full font-bold text-xs text-center flex items-center justify-center gap-1"
            style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
            <CheckCircle size={11} aria-hidden="true" /> Complété — en attente des autres membres
          </div>
        )}
        {allDone && (
          <div className="w-full py-2 rounded-full font-bold text-xs text-center flex items-center justify-center gap-1"
            style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.2),rgba(56,189,248,0.2))', color: '#34D399' }}>
            <PartyPopper size={11} aria-hidden="true" /> Défi de groupe terminé !
          </div>
        )}
        {canInvite && (
          <button onClick={() => { setInviteExistingGroup(g); setInviteExistingFriends([]); if (friends.length === 0) fetchFriends(); }}
            className="q-press w-full py-2 rounded-full font-bold text-xs flex items-center justify-center gap-1 mt-1"
            style={{ background: 'var(--q-bg)', color: 'var(--q-text2)', border: '1px dashed var(--q-line)' }}>
            <Plus size={11} aria-hidden="true" /> Inviter des amis ({4 - g.members.length} place{4 - g.members.length > 1 ? 's' : ''} libre{4 - g.members.length > 1 ? 's' : ''})
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
              <h2 className="font-bold text-base" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>
                💬 Tchat du groupe
              </h2>
              <button onClick={() => { setChatGroupId(null); setChatMessages([]); }}
                aria-label="Fermer le tchat"
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
                  Aucun message — commence la conversation !
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
                        aria-label={`Voir le profil de ${msg.user.username}`}
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
                              {new Date(msg.createdAt).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <div className="p-3 text-sm break-words"
                          style={{
                            background: isMe ? 'var(--q-accent)' : 'linear-gradient(135deg,rgba(124,58,237,0.14),rgba(167,139,250,0.08))',
                            border: isMe ? 'none' : '1px solid rgba(124,58,237,0.22)',
                            color: isMe ? '#fff' : 'var(--q-text)',
                            borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            wordBreak: 'break-word',
                          }}>
                          {msg.content}
                        </div>
                        {isMe && (
                          <div className="text-right mt-1" style={{ paddingRight: 2 }}>
                            <span className="text-xs" style={{ color: 'var(--q-text3)' }}>
                              {new Date(msg.createdAt).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
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
              <label htmlFor="group-chat-input" className="sr-only">Écrire un message</label>
              <input
                id="group-chat-input"
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value.slice(0, 500))}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendChatMessage(); }}
                placeholder="Écrire un message..."
                maxLength={500}
                className="flex-1 py-2 px-4 rounded-full outline-none"
                style={{ background: 'var(--q-bg)', border: '1px solid var(--q-line)',
                  color: 'var(--q-text)', fontSize: 13, fontFamily: 'inherit' }}
              />
              <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatSending || chatInput.length > 500}
                aria-label="Envoyer le message"
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
          onClick={e => { if (e.target === e.currentTarget) setInviteModal(null); }}>
          <div className="w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4"
            style={{ background: 'var(--q-chrome)', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.55)', border: '1px solid var(--q-line)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-base" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>
                  Défi en groupe
                </div>
                <div className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--q-text2)' }}
                  title={inviteModal.title}>
                  {inviteModal.title.length > 40 ? inviteModal.title.slice(0, 40) + '…' : inviteModal.title}
                </div>
              </div>
              <button onClick={() => setInviteModal(null)} aria-label="Fermer"
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
                Membres du groupe
              </span>
              <span style={{ fontSize: 12, fontWeight: 700,
                color: selectedFriends.length >= 3 ? '#EF4444' : 'var(--q-accent)' }}>
                {1 + selectedFriends.length} / 4
              </span>
            </div>
            {friends.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--q-text3)' }}>
                Ajoute des amis pour les inviter !
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
              {groupCreating ? 'Création…' : selectedFriends.length > 0
                ? `Créer le groupe (${selectedFriends.length + 1} membres)`
                : 'Créer le groupe (solo)'}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal invitation dans un groupe existant ── */}
      {inviteExistingGroup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setInviteExistingGroup(null); }}>
          <div className="w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4"
            style={{ background: 'var(--q-chrome)', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.55)', border: '1px solid var(--q-line)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-base" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>
                  Inviter des amis
                </div>
                <div className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--q-text2)' }}
                  title={inviteExistingGroup.challenge.title}>
                  {inviteExistingGroup.challenge.title.length > 40 ? inviteExistingGroup.challenge.title.slice(0, 40) + '…' : inviteExistingGroup.challenge.title}
                </div>
              </div>
              <button onClick={() => setInviteExistingGroup(null)} aria-label="Fermer"
                className="q-press w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'var(--q-line)', color: 'var(--q-text2)' }}>
                <X size={15} aria-hidden="true" />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 12, background: 'var(--q-bg)', border: '1px solid var(--q-line)' }}>
              <span style={{ fontSize: 12, color: 'var(--q-text2)' }}>
                <Users size={12} style={{ display: 'inline', marginRight: 4 }} aria-hidden="true" />
                Places disponibles
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
                  {friends.length === 0 ? 'Ajoute des amis pour les inviter !' : 'Tous tes amis sont déjà dans ce groupe.'}
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
              {inviteExistingLoading ? 'Envoi…' : inviteExistingFriends.length > 0
                ? `Inviter (${inviteExistingFriends.length} ami${inviteExistingFriends.length > 1 ? 's' : ''})`
                : 'Sélectionne des amis'}
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
              Défis
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--q-text2)' }}>Relève des défis et gagne des récompenses</p>
          </div>
        </div>
        <button onClick={() => navigate('/challenges/create')}
          aria-label="Créer un défi"
          className="q-press flex items-center gap-1.5 px-4 py-2 rounded-full text-white font-bold text-sm transition-opacity hover:opacity-85"
          style={{ background: 'var(--q-vibrant-lavender)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
          <Plus size={15} aria-hidden="true" />
          <span className="hidden sm:inline" aria-hidden="true">Créer</span>
        </button>
      </div>

      {/* Stats utilisateur */}
      {user && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#FACC15,#FB923C)', boxShadow: '0 4px 12px rgba(251,146,60,0.40)' }}>
            <CircleDollarSign size={13} aria-hidden="true" />
            {(user.coins ?? 0).toLocaleString()}
          </span>
          <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: 'var(--q-vibrant-hero)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
            <Zap size={11} aria-hidden="true" /> Niv. {user.level ?? 1}
          </span>
          <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)', boxShadow: '0 4px 12px rgba(52,211,153,0.40)' }}>
            <CheckCircle size={11} aria-hidden="true" /> {userChallenges.filter(c => c.status === 'COMPLETED').length} complétés
          </span>
        </div>
      )}

      {/* ── Défis en groupe (actifs) ── */}
      {user && (groupsLoading || activeGroups.length > 0) && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} style={{ color: '#A78BFA' }} aria-hidden="true" />
            <span className="font-bold text-sm" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>
              Défis en groupe
            </span>
            {groupsLoading
              ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--q-text3)' }} aria-label="Chargement" />
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
              Suggestion du jour
            </p>
            <p className="text-xs" style={{ color: isDailyFilter ? 'rgba(255,255,255,0.85)' : 'var(--q-text2)' }}>
              {isDailyFilter ? 'Filtré — défi du jour uniquement' : '+50% de récompenses si complété aujourd\'hui'}
            </p>
          </div>
          {isDailyFilter
            ? <X size={16} style={{ color: '#fff', flexShrink: 0 }} aria-hidden="true" />
            : <span className="text-xs font-bold px-2 py-0.5 rounded-full text-amber-900 flex-shrink-0"
                style={{ background: '#FDE68A' }}>Voir</span>
          }
        </button>
      )}

      {/* Recherche + filtres */}
      <div className="rounded-2xl p-3 mb-3 flex gap-2" style={{ background: 'var(--q-chrome)', boxShadow: 'var(--q-shadow)', border: '1px solid var(--q-line)' }}>
        <div className="flex items-center gap-2 flex-1">
          <Search size={15} aria-hidden="true" style={{ color: 'var(--q-text3)' }} className="flex-shrink-0" />
          <label htmlFor="challenge-search" className="sr-only">Rechercher un défi</label>
          <input id="challenge-search" value={search} onChange={e => { setSearch(e.target.value); setIsDailyFilter(false); }}
            placeholder="Rechercher un défi..."
            className="flex-1 bg-transparent text-sm outline-none min-w-0"
            style={{ color: 'var(--q-text)', fontFamily: 'var(--q-font)' }} />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Effacer la recherche" style={{ color: 'var(--q-text3)' }}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <button onClick={() => setFiltersOpen(o => !o)}
          aria-expanded={filtersOpen}
          aria-label={`Filtres${activeFilters > 0 ? ` (${activeFilters} actif${activeFilters > 1 ? 's' : ''})` : ''}`}
          className="q-press flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold flex-shrink-0 transition-opacity"
          style={filtersOpen || activeFilters > 0
            ? { background: 'var(--q-accent)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }
            : { background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }}>
          <SlidersHorizontal size={13} aria-hidden="true" />
          <span aria-hidden="true">Filtres{activeFilters > 0 && ` (${activeFilters})`}</span>
        </button>
      </div>

      {/* Filtres dépliables */}
      {filtersOpen && (
        <div className="rounded-2xl p-4 mb-3 space-y-4" style={{ background: 'var(--q-chrome)', boxShadow: 'var(--q-shadow)', border: '1px solid var(--q-line)' }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--q-text3)' }}>Catégorie</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <button onClick={() => { setSelectedCategory(''); setIsDailyFilter(false); }}
                className="q-press flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
                style={selectedCategory
                  ? { background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }
                  : { background: 'var(--q-accent)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
                Tous
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
                    <CfgIcon size={11} /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--q-text3)' }}>Difficulté</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <button onClick={() => { setSelectedDifficulty(''); setIsDailyFilter(false); }}
                className="q-press flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
                style={selectedDifficulty
                  ? { background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }
                  : { background: 'var(--q-accent)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
                Tous
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
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {loading && <PageLoader message="Chargement des défis..." />}

      {!loading && filtered.length === 0 && displayedInProgress.length === 0 && displayedCompleted.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--q-text3)' }}>
          <Trophy size={44} className="mx-auto mb-3 opacity-30" />
          <p>{isDailyFilter ? 'Le défi du jour n\'est pas encore disponible.' : 'Aucun défi trouvé.'}</p>
          <button onClick={() => { setSearch(''); setSelectedCategory(''); setSelectedDifficulty(''); setIsDailyFilter(false); }}
            className="mt-3 text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: 'var(--q-accent)' }}>
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {!loading && (filtered.length > 0 || displayedInProgress.length > 0 || displayedCompleted.length > 0) && (
        <div className="space-y-7">

          {/* Banner explicatif quand filtre journalier actif */}
          {isDailyFilter && (
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.08))', border: '1px solid rgba(251,191,36,0.35)' }}>
              <Sparkles size={22} style={{ color: '#F59E0B', flexShrink: 0 }} aria-hidden="true" />
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--q-text)' }}>Suggestion du jour</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--q-text2)' }}>
                  Complète ce défi aujourd'hui pour +50% de coins et XP !
                </p>
              </div>
            </div>
          )}

          {displayedInProgress.length > 0 && (
            <section>
              <SectionHeader icon={<Clock size={16} style={{ color: '#38BDF8' }} />} label="En cours"
                count={isDailyFilter ? displayedInProgress.length : inProgressTotal}
                grad="linear-gradient(135deg,#38BDF8,#A78BFA)" onClick={() => setInProgressOpen(o => !o)} isOpen={inProgressOpen} />
              {inProgressOpen && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {displayedInProgress.map(uc => (
                      <ChallengeCard key={uc.id} challenge={uc.challenge} status="IN_PROGRESS" isLoading={actionLoading === uc.challenge.id}
                        user={user} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')}
                        onInvite={handleOpenInvite} isDaily={uc.challenge.id === dailyChallengeId} />
                    ))}
                  </div>
                  {!isDailyFilter && inProgressHasMore && (
                    <button onClick={() => fetchInProgressItems(inProgressItems.length)} disabled={loadingMoreInProgress}
                      className="q-press mt-4 w-full py-2.5 rounded-2xl border-2 border-dashed text-sm font-bold transition-opacity hover:opacity-70 disabled:opacity-40"
                      style={{ borderColor: '#38BDF8', color: '#38BDF8' }}>
                      {loadingMoreInProgress ? 'Chargement…' : `Charger plus (${inProgressTotal - inProgressItems.length} restants)`}
                    </button>
                  )}
                </>
              )}
            </section>
          )}

          {available.length > 0 && (
            <section>
              <SectionHeader icon={<Trophy size={16} style={{ color: '#FACC15' }} />} label="Disponibles" count={available.length}
                grad="linear-gradient(135deg,#FACC15,#FB923C)" onClick={() => setAvailableOpen(o => !o)} isOpen={availableOpen} />
              {availableOpen && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {available.map(c => (
                      <ChallengeCard key={c.id} challenge={c} status={null} isLoading={actionLoading === c.id}
                        user={user} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')}
                        onInvite={handleOpenInvite} isDaily={c.id === dailyChallengeId} />
                    ))}
                  </div>
                  {hasMore && (
                    <button onClick={() => fetchChallenges(challenges.length)} disabled={loadingMore}
                      className="q-press mt-4 w-full py-2.5 rounded-2xl border-2 border-dashed text-sm font-bold transition-opacity hover:opacity-70 disabled:opacity-40"
                      style={{ borderColor: 'var(--q-accent)', color: 'var(--q-accent)' }}>
                      {loadingMore ? 'Chargement…' : 'Charger plus'}
                    </button>
                  )}
                </>
              )}
            </section>
          )}

          {(displayedCompleted.length > 0 || (!isDailyFilter && completedGroups.length > 0)) && (
            <section>
              <SectionHeader icon={<CheckCircle size={16} style={{ color: '#34D399' }} />} label="Terminés"
                count={isDailyFilter ? displayedCompleted.length : completedTotal + completedGroups.length}
                grad="linear-gradient(135deg,#34D399,#38BDF8)" onClick={() => setCompletedOpen(o => !o)} isOpen={completedOpen} />
              {completedOpen && (
                <>
                  {displayedCompleted.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 opacity-75">
                      {displayedCompleted.map(uc => (
                        <ChallengeCard key={uc.id} challenge={uc.challenge} status="COMPLETED" isLoading={false}
                          user={user} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')}
                          isDaily={uc.challenge.id === dailyChallengeId} />
                      ))}
                    </div>
                  )}
                  {!isDailyFilter && completedHasMore && (
                    <button onClick={() => fetchCompletedItems(completedItems.length)} disabled={loadingMoreCompleted}
                      className="q-press mt-4 w-full py-2.5 rounded-2xl border-2 border-dashed text-sm font-bold transition-opacity hover:opacity-70 disabled:opacity-40"
                      style={{ borderColor: '#34D399', color: '#34D399' }}>
                      {loadingMoreCompleted ? 'Chargement…' : `Charger plus (${completedTotal - completedItems.length} restants)`}
                    </button>
                  )}
                  {/* Groupes terminés */}
                  {!isDailyFilter && completedGroups.length > 0 && (
                    <div className={displayedCompleted.length > 0 ? 'mt-4 pt-4' : ''} style={displayedCompleted.length > 0 ? { borderTop: '1px solid var(--q-line)' } : {}}>
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={14} style={{ color: '#A78BFA' }} aria-hidden="true" />
                        <span className="font-bold text-sm" style={{ color: 'var(--q-text2)', fontFamily: 'var(--q-display)' }}>Groupes terminés</span>
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
