import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { Trophy, Star, Zap, Search, Plus, CheckCircle, Clock, Flame, SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';

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

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  EASY:   { label: 'Facile',    color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-100 dark:bg-green-900/30',   icon: <Star size={12} /> },
  MEDIUM: { label: 'Moyen',    color: 'text-yellow-600 dark:text-yellow-400',  bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: <Zap size={12} /> },
  HARD:   { label: 'Difficile', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: <Flame size={12} /> },
  EXPERT: { label: 'Expert',   color: 'text-red-600 dark:text-red-400',        bg: 'bg-red-100 dark:bg-red-900/30',       icon: <Trophy size={12} /> },
};

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string }> = {
  GAMING:     { label: 'Gaming',       emoji: '🎮' },
  SPORT:      { label: 'Sport',        emoji: '⚽' },
  CUISINE:    { label: 'Cuisine',      emoji: '🍳' },
  FITNESS:    { label: 'Fitness',      emoji: '💪' },
  CREATIVITY: { label: 'Créativité',   emoji: '🎨' },
  KNOWLEDGE:  { label: 'Connaissance', emoji: '📚' },
  SOCIAL:     { label: 'Social',       emoji: '🤝' },
};

const CATEGORIES  = Object.keys(CATEGORY_CONFIG);
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];

type ChallengeCardProps = {
  challenge: Challenge;
  status: string | null;
  isLoading: boolean;
  user: ReturnType<typeof useStore>['user'];
  darkMode: boolean;
  card: string;
  onStart: (id: number) => void;
  onComplete: (id: number) => void;
  onLogin: () => void;
};

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, status, isLoading, user, darkMode, card, onStart, onComplete, onLogin }) => {
  const diff = DIFFICULTY_CONFIG[challenge.difficulty] ?? DIFFICULTY_CONFIG.EASY;
  const cat  = CATEGORY_CONFIG[challenge.category]    ?? { label: challenge.category, emoji: '🏆' };

  const actionButton = () => {
    if (!user) return (
      <button onClick={onLogin} className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors text-sm">
        Se connecter pour participer
      </button>
    );
    if (status === 'COMPLETED') return (
      <div className="w-full py-2.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold text-center text-sm">
        ✅ Défi complété !
      </div>
    );
    if (status === 'IN_PROGRESS') return (
      <button onClick={() => onComplete(challenge.id)} disabled={isLoading}
        className="w-full py-2.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors text-sm disabled:opacity-60 active:scale-95">
        {isLoading ? '...' : '✅ Marquer comme complété'}
      </button>
    );
    return (
      <button onClick={() => onStart(challenge.id)} disabled={isLoading}
        className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors text-sm disabled:opacity-60 active:scale-95">
        {isLoading ? '...' : '🚀 Commencer le défi'}
      </button>
    );
  };

  return (
    <div className={`${card} border rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${diff.bg} ${diff.color}`}>
            {diff.icon}{diff.label}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
            {cat.emoji} {cat.label}
          </span>
        </div>
        {status === 'COMPLETED'   && <CheckCircle size={18} className="text-green-500 flex-shrink-0" />}
        {status === 'IN_PROGRESS' && <Clock size={18} className="text-blue-500 flex-shrink-0" />}
      </div>

      <div className="flex-1">
        <h3 className="font-bold text-base leading-snug">{challenge.title}</h3>
        <p className={`mt-1 text-sm line-clamp-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{challenge.description}</p>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="font-bold text-yellow-600 dark:text-yellow-400">🪙 {challenge.coinReward}</span>
        <span className={`font-bold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
          <Zap size={13} className="inline mr-0.5" />{challenge.xpReward} XP
        </span>
        {challenge._count && (
          <span className={`ml-auto text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {challenge._count.participants} participant{challenge._count.participants > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {actionButton()}
    </div>
  );
};

type SectionHeaderProps = {
  icon: React.ReactNode; label: string; count: number; color: string; darkMode: boolean;
  onClick?: () => void; isOpen?: boolean;
};
const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, label, count, color, darkMode, onClick, isOpen }) => {
  const badge = (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className="flex items-center gap-2 mb-3 w-full group">
        <span className={color}>{icon}</span>
        <h2 className="font-bold text-base">{label}</h2>
        {badge}
        <span className={`ml-auto ${darkMode ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`}>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={color}>{icon}</span>
      <h2 className="font-bold text-base">{label}</h2>
      {badge}
    </div>
  );
};

const ChallengePage: React.FC = () => {
  const { user, setUser, darkMode } = useStore();
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
  const card = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  return (
    <div className={`px-3 py-4 md:p-6 min-h-screen ${darkMode ? 'text-white' : 'text-gray-900'}`}>

      {/* Notification toast */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Trophy className="text-yellow-500" size={26} />
            Défis
          </h1>
          <p className={`text-sm mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Relève des défis et gagne des récompenses
          </p>
        </div>
        <button
          onClick={() => navigate('/challenges/create')}
          className="flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-sm shadow-sm"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Créer</span>
        </button>
      </div>

      {/* Stats utilisateur */}
      {user && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <div className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${darkMode ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-50 text-yellow-700'}`}>
            🪙 {(user.coins ?? 0).toLocaleString()} coins
          </div>
          <div className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${darkMode ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>
            <Zap size={12} /> Niv. {user.level ?? 1}
          </div>
          <div className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${darkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-50 text-green-700'}`}>
            <CheckCircle size={12} /> {userChallenges.filter(c => c.status === 'COMPLETED').length} complétés
          </div>
        </div>
      )}

      {/* Barre de recherche + filtre mobile */}
      <div className={`${card} border rounded-xl p-3 mb-3 flex gap-2`}>
        <div className="flex items-center gap-2 flex-1">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un défi..."
            className={`flex-1 bg-transparent text-sm outline-none min-w-0 ${darkMode ? 'placeholder-gray-500' : 'placeholder-gray-400'}`}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold flex-shrink-0 transition-colors ${filtersOpen || activeFilters > 0 ? 'bg-blue-600 text-white' : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
        >
          <SlidersHorizontal size={14} />
          Filtres{activeFilters > 0 && ` (${activeFilters})`}
        </button>
      </div>

      {/* Filtres dépliables */}
      {filtersOpen && (
        <div className={`${card} border rounded-xl p-3 mb-3 space-y-3`}>
          {/* Catégories */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-gray-400">Catégorie</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${!selectedCategory ? 'bg-blue-600 text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >Tous</button>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setSelectedCategory(c === selectedCategory ? '' : c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${selectedCategory === c ? 'bg-blue-600 text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {CATEGORY_CONFIG[c].emoji} {CATEGORY_CONFIG[c].label}
                </button>
              ))}
            </div>
          </div>
          {/* Difficulté */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-gray-400">Difficulté</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedDifficulty('')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${!selectedDifficulty ? 'bg-blue-600 text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >Tous</button>
              {DIFFICULTIES.map(d => {
                const cfg = DIFFICULTY_CONFIG[d];
                return (
                  <button key={d} onClick={() => setSelectedDifficulty(d === selectedDifficulty ? '' : d)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${selectedDifficulty === d ? `${cfg.bg} ${cfg.color}` : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Trophy size={44} className="mx-auto mb-3 opacity-30" />
          <p>Aucun défi trouvé.</p>
          <button onClick={() => { setSearch(''); setSelectedCategory(''); setSelectedDifficulty(''); }}
            className="mt-3 text-sm text-blue-500 hover:underline">Réinitialiser les filtres</button>
        </div>
      ) : (
        <div className="space-y-6">

          {/* En cours */}
          {inProgress.length > 0 && (
            <section>
              <SectionHeader icon={<Clock size={16} />} label="En cours" count={inProgress.length} color="text-blue-500" darkMode={darkMode} onClick={() => setInProgressOpen(o => !o)} isOpen={inProgressOpen} />
              {inProgressOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {inProgress.map(c => <ChallengeCard key={c.id} challenge={c} status="IN_PROGRESS" isLoading={actionLoading === c.id} user={user} darkMode={darkMode} card={card} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')} />)}
                </div>
              )}
            </section>
          )}

          {/* Disponibles */}
          {available.length > 0 && (
            <section>
              <SectionHeader icon={<Trophy size={16} />} label="Disponibles" count={available.length} color="text-yellow-500" darkMode={darkMode} onClick={() => setAvailableOpen(o => !o)} isOpen={availableOpen} />
              {availableOpen && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {available.slice(0, visibleAvailable).map(c => <ChallengeCard key={c.id} challenge={c} status={null} isLoading={actionLoading === c.id} user={user} darkMode={darkMode} card={card} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')} />)}
                  </div>
                  {available.length > visibleAvailable && (
                    <button
                      onClick={() => setVisibleAvailable(v => v + 9)}
                      className={`mt-4 w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold transition-colors ${darkMode ? 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300' : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'}`}
                    >
                      Charger plus ({available.length - visibleAvailable} restants)
                    </button>
                  )}
                </>
              )}
            </section>
          )}

          {/* Terminés — replié par défaut */}
          {completed.length > 0 && (
            <section>
              <SectionHeader
                icon={<CheckCircle size={16} />}
                label="Terminés"
                count={completed.length}
                color="text-green-500"
                darkMode={darkMode}
                onClick={() => setCompletedOpen(o => !o)}
                isOpen={completedOpen}
              />
              {completedOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 opacity-75">
                  {completed.map(c => <ChallengeCard key={c.id} challenge={c} status="COMPLETED" isLoading={false} user={user} darkMode={darkMode} card={card} onStart={handleStart} onComplete={handleComplete} onLogin={() => navigate('/login')} />)}
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
