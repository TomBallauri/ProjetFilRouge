import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { Trophy, Star, Zap, Search, Plus, CheckCircle, Clock, Flame, SlidersHorizontal, X, ChevronDown, ChevronUp, Gamepad2, Activity, UtensilsCrossed, Dumbbell, Palette, BookOpen, Users } from 'lucide-react';
import BackButton from '../components/BackButton';

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

// Category → vibrant gradient + glow
const CATEGORY_GRAD: Record<string, { grad: string; glow: string; Icon: React.FC<{ size?: number }>; label: string }> = {
  GAMING:     { grad: 'linear-gradient(135deg,#A78BFA,#EC4899)', glow: 'rgba(167,139,250,0.5)', Icon: Gamepad2,        label: 'Gaming' },
  SPORT:      { grad: 'linear-gradient(135deg,#34D399,#38BDF8)', glow: 'rgba(52,211,153,0.5)',  Icon: Activity,        label: 'Sport' },
  CUISINE:    { grad: 'linear-gradient(135deg,#FACC15,#FB923C,#EC4899)', glow: 'rgba(251,146,60,0.5)', Icon: UtensilsCrossed, label: 'Cuisine' },
  FITNESS:    { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.5)',  Icon: Dumbbell,        label: 'Fitness' },
  CREATIVITY: { grad: 'linear-gradient(135deg,#EC4899,#A78BFA)', glow: 'rgba(236,72,153,0.5)',  Icon: Palette,         label: 'Créativité' },
  KNOWLEDGE:  { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.5)',  Icon: BookOpen,        label: 'Connaissance' },
  SOCIAL:     { grad: 'linear-gradient(135deg,#FACC15,#FB923C)', glow: 'rgba(250,204,21,0.5)',  Icon: Users,           label: 'Social' },
};

// Difficulty → label + gradient
const DIFF_GRAD: Record<string, { label: string; grad: string; glow: string; icon: React.ReactNode }> = {
  EASY:   { label: 'Facile',    grad: 'linear-gradient(135deg,#34D399,#38BDF8)', glow: 'rgba(52,211,153,0.45)',  icon: <Star size={11} /> },
  MEDIUM: { label: 'Moyen',    grad: 'linear-gradient(135deg,#FACC15,#FB923C)', glow: 'rgba(251,146,60,0.45)',  icon: <Zap size={11} /> },
  HARD:   { label: 'Difficile', grad: 'linear-gradient(135deg,#FB923C,#EC4899)', glow: 'rgba(251,146,60,0.45)', icon: <Flame size={11} /> },
  EXPERT: { label: 'Expert',   grad: 'linear-gradient(135deg,#EC4899,#A78BFA)', glow: 'rgba(236,72,153,0.45)', icon: <Trophy size={11} /> },
};

const CATEGORIES   = Object.keys(CATEGORY_GRAD);
const DIFFICULTIES = Object.keys(DIFF_GRAD);

// Vibrant chip — white text, gradient background
function VibrantChip({ grad, glow, children }: Readonly<{ grad: string; glow: string; children: React.ReactNode }>) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
      style={{ background: grad, boxShadow: `0 3px 10px -2px ${glow}`,
        border: '1px solid rgba(255,255,255,0.25)' }}>
      {children}
    </span>
  );
}

// Vibrant icon tile (matches QIconTile from design)
function IconTile({ cat }: Readonly<{ cat: string }>) {
  const cfg = CATEGORY_GRAD[cat] ?? CATEGORY_GRAD.GAMING;
  const CatIcon = cfg.Icon;
  return (
    <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center relative overflow-hidden"
      style={{ background: cfg.grad, boxShadow: `0 6px 14px -4px ${cfg.glow}`,
        border: '1px solid rgba(255,255,255,0.25)' }}>
      <div className="absolute right-[-8px] top-[-8px] w-7 h-7 rounded-full"
        style={{ background: 'rgba(255,255,255,0.20)' }} />
      <div className="relative z-10 text-white"><CatIcon size={22} /></div>
    </div>
  );
}

type ChallengeCardProps = {
  challenge: Challenge;
  status: string | null;
  isLoading: boolean;
  user: ReturnType<typeof useStore>['user'];
  onStart: (id: number) => void;
  onComplete: (id: number) => void;
  onLogin: () => void;
};

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, status, isLoading, user, onStart, onComplete, onLogin }) => {
  const diff = DIFF_GRAD[challenge.difficulty] ?? DIFF_GRAD.EASY;
  const cat  = CATEGORY_GRAD[challenge.category] ?? CATEGORY_GRAD.GAMING;
  const CatIcon = cat.Icon;

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
        ✅ Défi complété !
      </div>
    );
    if (status === 'IN_PROGRESS') return (
      <button onClick={() => onComplete(challenge.id)} disabled={isLoading}
        className="q-press w-full py-2.5 rounded-full text-white font-bold text-sm disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)', boxShadow: '0 4px 12px rgba(52,211,153,0.40)' }}>
        {isLoading ? '...' : '✅ Marquer comme complété'}
      </button>
    );
    return (
      <button onClick={() => onStart(challenge.id)} disabled={isLoading}
        className="q-press w-full py-2.5 rounded-full text-white font-bold text-sm disabled:opacity-60"
        style={{ background: 'var(--q-vibrant-lavender)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
        {isLoading ? '...' : '🚀 Commencer le défi'}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl transition-transform hover:-translate-y-0.5"
      style={{ background: 'var(--q-chrome)', boxShadow: 'var(--q-shadow)', border: '1px solid var(--q-line)' }}>

      <div className="flex items-center gap-3">
        <IconTile cat={challenge.category} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            <VibrantChip grad={diff.grad} glow={diff.glow}>{diff.icon}{diff.label}</VibrantChip>
            <VibrantChip grad={cat.grad} glow={cat.glow}><CatIcon size={11} /> {cat.label}</VibrantChip>
          </div>
          {status === 'COMPLETED'   && <CheckCircle size={16} className="text-emerald-400 float-right mt-0.5" />}
          {status === 'IN_PROGRESS' && <Clock size={16} className="text-sky-400 float-right mt-0.5" />}
        </div>
      </div>

      <div className="flex-1">
        <h3 className="font-bold text-sm leading-snug" style={{ color: 'var(--q-text)' }}>{challenge.title}</h3>
        <p className="mt-1 text-xs line-clamp-2" style={{ color: 'var(--q-text2)' }}>{challenge.description}</p>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="font-bold" style={{ color: '#FB923C' }}>🪙 {challenge.coinReward}</span>
        <span className="font-bold" style={{ color: '#A78BFA' }}>
          <Zap size={11} className="inline mr-0.5" />{challenge.xpReward} XP
        </span>
        {challenge._count && (
          <span className="ml-auto font-semibold" style={{ color: 'var(--q-text3)' }}>
            {challenge._count.participants} participant{challenge._count.participants > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {actionButton()}
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
  const { user, setUser } = useStore();
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [visibleAvailable, setVisibleAvailable] = useState(9);
  const [inProgressOpen, setInProgressOpen] = useState(true);
  const [availableOpen, setAvailableOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => { fetchChallenges(); }, [selectedCategory, selectedDifficulty]);
  useEffect(() => { if (user) fetchUserChallenges(); }, [user]);
  useEffect(() => { setVisibleAvailable(9); }, [search, selectedCategory, selectedDifficulty]);

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedDifficulty) params.set('difficulty', selectedDifficulty);
      const res = await fetch(`/api/challenges?${params}`);
      setChallenges(await res.json());
    } catch { setChallenges([]); }
    finally { setLoading(false); }
  };

  const fetchUserChallenges = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/users/me/challenges', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUserChallenges(Array.isArray(data) ? data : []);
    } catch { setUserChallenges([]); }
  };

  const getUserStatus = (id: number) => userChallenges.find(c => c.challengeId === id)?.status ?? null;

  const showNotif = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleStart = async (id: number) => {
    if (!user) { navigate('/login'); return; }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/challenges/${id}/start`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || 'Erreur', 'error'); return; }
      await fetchUserChallenges();
      showNotif('Défi commencé ! Bonne chance ! 🚀', 'success');
    } finally { setActionLoading(null); }
  };

  const handleComplete = async (id: number) => {
    if (!user) { navigate('/login'); return; }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/challenges/${id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || 'Erreur', 'error'); return; }
      if (data.user) setUser(data.user);
      await fetchUserChallenges();
      showNotif(`Bravo ! +${data.coinsEarned} 🪙 +${data.xpEarned} XP ⚡`, 'success');
    } finally { setActionLoading(null); }
  };

  const filtered = challenges.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  const inProgress = user ? filtered.filter(c => getUserStatus(c.id) === 'IN_PROGRESS') : [];
  const completed  = user ? filtered.filter(c => getUserStatus(c.id) === 'COMPLETED')   : [];
  const available  = filtered.filter(c => getUserStatus(c.id) === null);

  const activeFilters = [selectedCategory, selectedDifficulty].filter(Boolean).length;

  return (
    <div className="px-3 py-4 md:p-6 min-h-screen" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-font)' }}>

      {/* Notification toast */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-50 px-5 py-3 rounded-2xl shadow-lg text-white font-bold text-sm ${notification.type === 'success' ? '' : 'bg-red-500'}`}
          style={notification.type === 'success' ? { background: 'linear-gradient(135deg,#34D399,#38BDF8)', boxShadow: '0 8px 24px rgba(52,211,153,0.45)' } : {}}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'var(--q-display)', color: 'var(--q-text)' }}>
              <Trophy className="text-yellow-400" size={26} />
              Défis
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--q-text2)' }}>Relève des défis et gagne des récompenses</p>
          </div>
        </div>
        <button onClick={() => navigate('/challenges/create')}
          className="q-press flex items-center gap-1.5 px-4 py-2 rounded-full text-white font-bold text-sm transition-opacity hover:opacity-85"
          style={{ background: 'var(--q-vibrant-lavender)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
          <Plus size={15} />
          <span className="hidden sm:inline">Créer</span>
        </button>
      </div>

      {/* Stats utilisateur — vibrant pills */}
      {user && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#FACC15,#FB923C)', boxShadow: '0 4px 12px rgba(251,146,60,0.40)' }}>
            🪙 {(user.coins ?? 0).toLocaleString()} coins
          </span>
          <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: 'var(--q-vibrant-hero)', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
            <Zap size={11} /> Niv. {user.level ?? 1}
          </span>
          <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)', boxShadow: '0 4px 12px rgba(52,211,153,0.40)' }}>
            <CheckCircle size={11} /> {userChallenges.filter(c => c.status === 'COMPLETED').length} complétés
          </span>
        </div>
      )}

      {/* Recherche + filtres */}
      <div className="rounded-2xl p-3 mb-3 flex gap-2" style={{ background: 'var(--q-chrome)', boxShadow: 'var(--q-shadow)', border: '1px solid var(--q-line)' }}>
        <div className="flex items-center gap-2 flex-1">
          <Search size={15} style={{ color: 'var(--q-text3)' }} className="flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un défi..."
            className="flex-1 bg-transparent text-sm outline-none min-w-0"
            style={{ color: 'var(--q-text)', fontFamily: 'var(--q-font)' }} />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--q-text3)' }}>
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={() => setFiltersOpen(o => !o)}
          className="q-press flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold flex-shrink-0 transition-opacity"
          style={filtersOpen || activeFilters > 0
            ? { background: 'var(--q-accent)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }
            : { background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }}>
          <SlidersHorizontal size={13} />
          Filtres{activeFilters > 0 && ` (${activeFilters})`}
        </button>
      </div>

      {/* Filtres dépliables */}
      {filtersOpen && (
        <div className="rounded-2xl p-4 mb-3 space-y-4" style={{ background: 'var(--q-chrome)', boxShadow: 'var(--q-shadow)', border: '1px solid var(--q-line)' }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--q-text3)' }}>Catégorie</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setSelectedCategory('')}
                className="q-press px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
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
                  <button key={c} onClick={() => setSelectedCategory(c === selectedCategory ? '' : c)}
                    className="q-press inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
                    style={active
                      ? { background: cfg.grad, color: '#fff', boxShadow: `0 4px 12px ${cfg.glow}`, border: '1px solid rgba(255,255,255,0.25)' }
                      : { background: 'var(--q-accent-soft)', color: 'var(--q-text2)' }}>
                    <CfgIcon size={11} /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--q-text3)' }}>Difficulté</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setSelectedDifficulty('')}
                className="q-press px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
                style={selectedDifficulty
                  ? { background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }
                  : { background: 'var(--q-accent)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.40)' }}>
                Tous
              </button>
              {DIFFICULTIES.map(d => {
                const cfg = DIFF_GRAD[d];
                const active = selectedDifficulty === d;
                return (
                  <button key={d} onClick={() => setSelectedDifficulty(d === selectedDifficulty ? '' : d)}
                    className="q-press px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
                    style={active
                      ? { background: cfg.grad, color: '#fff', boxShadow: `0 4px 12px ${cfg.glow}`, border: '1px solid rgba(255,255,255,0.25)' }
                      : { background: 'var(--q-accent-soft)', color: 'var(--q-text2)' }}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: 'var(--q-accent)', borderRightColor: 'var(--q-accent)' }} />
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--q-text3)' }}>
          <Trophy size={44} className="mx-auto mb-3 opacity-30" />
          <p>Aucun défi trouvé.</p>
          <button onClick={() => { setSearch(''); setSelectedCategory(''); setSelectedDifficulty(''); }}
            className="mt-3 text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: 'var(--q-accent)' }}>
            Réinitialiser les filtres
          </button>
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <div className="space-y-7">

          {inProgress.length > 0 && (
            <section>
              <SectionHeader icon={<Clock size={16} style={{ color: '#38BDF8' }} />} label="En cours" count={inProgress.length}
                grad="linear-gradient(135deg,#38BDF8,#A78BFA)" onClick={() => setInProgressOpen(o => !o)} isOpen={inProgressOpen} />
              {inProgressOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {inProgress.map(c => <ChallengeCard key={c.id} challenge={c} status="IN_PROGRESS" isLoading={actionLoading === c.id} user={user} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')} />)}
                </div>
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
                    {available.slice(0, visibleAvailable).map(c => <ChallengeCard key={c.id} challenge={c} status={null} isLoading={actionLoading === c.id} user={user} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')} />)}
                  </div>
                  {available.length > visibleAvailable && (
                    <button onClick={() => setVisibleAvailable(v => v + 9)}
                      className="q-press mt-4 w-full py-2.5 rounded-2xl border-2 border-dashed text-sm font-bold transition-opacity hover:opacity-70"
                      style={{ borderColor: 'var(--q-accent)', color: 'var(--q-accent)' }}>
                      Charger plus ({available.length - visibleAvailable} restants)
                    </button>
                  )}
                </>
              )}
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <SectionHeader icon={<CheckCircle size={16} style={{ color: '#34D399' }} />} label="Terminés" count={completed.length}
                grad="linear-gradient(135deg,#34D399,#38BDF8)" onClick={() => setCompletedOpen(o => !o)} isOpen={completedOpen} />
              {completedOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 opacity-75">
                  {completed.map(c => <ChallengeCard key={c.id} challenge={c} status="COMPLETED" isLoading={false} user={user} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')} />)}
                </div>
              )}
            </section>
          )}

        </div>
      )}
    </div>
  );
};

export default ChallengePage;
