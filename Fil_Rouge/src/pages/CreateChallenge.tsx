import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, ArrowLeft, Sparkles, Globe, Lock, Plus, Trash2, Check,
  Gamepad2, Activity, UtensilsCrossed, Dumbbell, Palette,
  BookOpen, Users, Leaf, Music, Heart, Wrench, LayoutGrid,
} from 'lucide-react';

// ── Category meta (icon + gradient + glow) ────────────────────────────────────
const CAT_META: Record<string, { label: string; grad: string; glow: string; Icon: React.FC<{ size?: number }> }> = {
  GAMING:     { label: 'Gaming',     grad: 'linear-gradient(135deg,#A78BFA,#EC4899)', glow: 'rgba(167,139,250,0.55)', Icon: Gamepad2 },
  SPORT:      { label: 'Sport',      grad: 'linear-gradient(135deg,#34D399,#38BDF8)', glow: 'rgba(52,211,153,0.55)',  Icon: Activity },
  CUISINE:    { label: 'Cuisine',    grad: 'linear-gradient(135deg,#FACC15,#FB923C)', glow: 'rgba(251,146,60,0.55)',  Icon: UtensilsCrossed },
  FITNESS:    { label: 'Fitness',    grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.55)',  Icon: Dumbbell },
  CREATIVITY: { label: 'Créativité', grad: 'linear-gradient(135deg,#EC4899,#A78BFA)', glow: 'rgba(236,72,153,0.55)',  Icon: Palette },
  KNOWLEDGE:  { label: 'Savoir',     grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.55)',  Icon: BookOpen },
  SOCIAL:     { label: 'Social',     grad: 'linear-gradient(135deg,#FACC15,#FB923C)', glow: 'rgba(250,204,21,0.55)',  Icon: Users },
  NATURE:     { label: 'Nature',     grad: 'linear-gradient(135deg,#4ADE80,#16A34A)', glow: 'rgba(74,222,128,0.55)',  Icon: Leaf },
  MUSIC:      { label: 'Musique',    grad: 'linear-gradient(135deg,#F472B6,#A78BFA)', glow: 'rgba(244,114,182,0.55)', Icon: Music },
  WELLNESS:   { label: 'Bien-être',  grad: 'linear-gradient(135deg,#6EE7B7,#3B82F6)', glow: 'rgba(110,231,183,0.55)', Icon: Heart },
  DIY:        { label: 'DIY',        grad: 'linear-gradient(135deg,#FB923C,#D97706)', glow: 'rgba(251,146,60,0.55)',  Icon: Wrench },
  OTHERS:     { label: 'Autres',     grad: 'linear-gradient(135deg,#94A3B8,#64748B)', glow: 'rgba(148,163,184,0.55)', Icon: LayoutGrid },
};

const DIFFICULTIES = [
  { value: 'EASY',   label: 'Facile',    coins: 50,  xp: 100,  border: 'border-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',   text: 'text-green-600 dark:text-green-400' },
  { value: 'MEDIUM', label: 'Moyen',     coins: 150, xp: 300,  border: 'border-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'HARD',   label: 'Difficile', coins: 350, xp: 700,  border: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
  { value: 'EXPERT', label: 'Expert',    coins: 700, xp: 1500, border: 'border-red-400',    bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-600 dark:text-red-400' },
];

type ChallengeForm = { title: string; description: string; category: string; difficulty: string };
const emptyChallenge = (): ChallengeForm => ({ title: '', description: '', category: 'GAMING', difficulty: 'MEDIUM' });

// ── Category icon tile ─────────────────────────────────────────────────────────
function CatTile({ value, selected, onClick }: { value: string; selected: boolean; onClick: () => void }) {
  const meta = CAT_META[value];
  const Icon = meta.Icon;
  return (
    <button type="button" onClick={onClick}
      className="flex flex-col items-center gap-1.5 transition-all duration-200 active:scale-95 focus:outline-none">
      {/* Icon container */}
      <div className="relative">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 relative overflow-hidden"
          style={{
            background: selected ? meta.grad : 'rgba(148,163,184,0.15)',
            transform: selected ? 'scale(1.08)' : 'scale(1)',
            boxShadow: selected ? `0 8px 20px -4px ${meta.glow}` : 'none',
          }}>
          {selected && <div className="absolute right-[-8px] top-[-8px] w-8 h-8 rounded-full bg-white/20" />}
          <Icon size={24} style={{ color: selected ? '#fff' : 'rgba(148,163,184,0.6)', position: 'relative' }} />
        </div>
        {/* Badge check */}
        {selected && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
            <Check size={10} className="text-white" />
          </div>
        )}
      </div>
      {/* Label */}
      <span className={`text-[10px] font-semibold text-center leading-tight transition-colors ${
        selected ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
      }`}>
        {meta.label}
      </span>
    </button>
  );
}

// ── Single challenge card ──────────────────────────────────────────────────────
function ChallengeCard({
  index, total, data, darkMode,
  onChange, onRemove,
}: {
  index: number; total: number; data: ChallengeForm; darkMode: boolean;
  onChange: (f: ChallengeForm) => void; onRemove: () => void;
}) {
  const diff = DIFFICULTIES.find(d => d.value === data.difficulty)!;
  const inputClass = `w-full px-3 py-2.5 rounded-xl border outline-none text-sm transition-colors
    ${darkMode
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'}`;

  return (
    <div className={`rounded-2xl border p-4 space-y-4 ${darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
      {/* Card header */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
          Défi {index + 1}
        </span>
        {total > 1 && (
          <button type="button" onClick={onRemove}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Titre */}
      <div>
        <label className="block text-xs font-semibold mb-1 opacity-70">Titre</label>
        <input type="text" maxLength={80} value={data.title}
          onChange={e => onChange({ ...data, title: e.target.value })}
          placeholder={total > 1 ? `Ex: Jour ${index + 1}: Courir 5km` : "Ex: Courir 5km sans s'arrêter"}
          className={inputClass} />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold mb-1 opacity-70">Description</label>
        <textarea rows={2} maxLength={500} value={data.description}
          onChange={e => onChange({ ...data, description: e.target.value })}
          placeholder="Décris clairement ce qu'il faut accomplir..."
          className={`${inputClass} resize-none`} />
        <p className="text-right text-[10px] mt-0.5 opacity-40">{data.description.length}/500</p>
      </div>

      {/* Catégorie */}
      <div>
        <p className="text-xs font-semibold mb-2 opacity-70">Catégorie</p>
        <div className="grid grid-cols-4 gap-2">
          {Object.keys(CAT_META).map(v => (
            <CatTile key={v} value={v} selected={data.category === v}
              onClick={() => onChange({ ...data, category: v })} />
          ))}
        </div>
      </div>

      {/* Difficulté */}
      <div>
        <p className="text-xs font-semibold mb-2 opacity-70">Difficulté</p>
        <div className="grid grid-cols-4 gap-1.5">
          {DIFFICULTIES.map(d => (
            <button key={d.value} type="button"
              onClick={() => onChange({ ...data, difficulty: d.value })}
              className={`py-2 rounded-xl border-2 text-center transition-all active:scale-95 text-xs font-bold
                ${data.difficulty === d.value ? `${d.border} ${d.bg} ${d.text}` : darkMode ? 'border-gray-600 hover:border-gray-500 text-gray-300' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
              {d.label}
            </button>
          ))}
        </div>
        <p className={`text-xs mt-1.5 text-center font-semibold ${diff.text}`}>
          🪙 {diff.coins} coins · ⚡ {diff.xp} XP
        </p>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const CreateChallenge: React.FC = () => {
  const { user, darkMode } = useStore();
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<ChallengeForm[]>([emptyChallenge()]);
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) { navigate('/login'); return null; }

  const updateChallenge = (i: number, f: ChallengeForm) =>
    setChallenges(prev => prev.map((c, idx) => idx === i ? f : c));

  const addChallenge = () => setChallenges(prev => [...prev, emptyChallenge()]);

  const removeChallenge = (i: number) =>
    setChallenges(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = challenges.find(c => !c.title.trim() || !c.description.trim());
    if (invalid) { setError('Titre et description requis pour chaque défi.'); return; }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const toSave = challenges.map(c => ({ ...c, isPublic }));
      const endpoint = challenges.length === 1 ? '/api/challenges' : '/api/challenges/bulk-save';
      const body = challenges.length === 1
        ? JSON.stringify({ ...toSave[0] })
        : JSON.stringify({ challenges: toSave });
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur lors de la création'); return; }
      navigate('/challenges');
    } catch { setError('Erreur réseau'); }
    finally { setLoading(false); }
  };

  return (
    <div className={`px-3 py-4 md:p-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>

      <button onClick={() => navigate('/challenges')}
        className={`flex items-center gap-1.5 mb-5 text-sm font-medium ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
        <ArrowLeft size={16} /> Retour aux défis
      </button>

      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="text-yellow-500" size={22} />
            Créer {challenges.length > 1 ? `${challenges.length} défis` : 'un défi'}
          </h1>
          <button onClick={() => navigate('/challenges/ai-create')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90 transition-opacity">
            <Sparkles size={13} /> IA
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Liste des défis */}
          {challenges.map((c, i) => (
            <ChallengeCard key={i} index={i} total={challenges.length}
              data={c} darkMode={darkMode}
              onChange={f => updateChallenge(i, f)}
              onRemove={() => removeChallenge(i)} />
          ))}

          {/* Bouton ajouter un défi */}
          <button type="button" onClick={addChallenge}
            className={`w-full py-3 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]
              ${darkMode ? 'border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400' : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600'}`}>
            <Plus size={16} /> Ajouter un défi
          </button>

          {/* Visibilité */}
          <button type="button" onClick={() => setIsPublic(p => !p)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all
              ${isPublic
                ? darkMode ? 'border-blue-500/50 bg-blue-500/10' : 'border-blue-200 bg-blue-50'
                : darkMode ? 'border-gray-600 bg-gray-700/40' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-3">
              {isPublic
                ? <Globe size={16} className="text-blue-400 shrink-0" />
                : <Lock size={16} className={`shrink-0 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />}
              <div className="text-left">
                <p className="text-sm font-semibold">{isPublic ? 'Public' : 'Privé'}</p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {isPublic ? 'Visible par tous' : 'Visible uniquement par toi'}
                </p>
              </div>
            </div>
            <div className={`w-10 h-5 rounded-full transition-colors shrink-0 relative ${isPublic ? 'bg-blue-500' : darkMode ? 'bg-gray-600' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isPublic ? 'left-5' : 'left-0.5'}`} />
            </div>
          </button>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 text-sm active:scale-95">
            {loading ? 'Création...' : isPublic
              ? `🚀 Publier ${challenges.length > 1 ? `${challenges.length} défis` : 'le défi'}`
              : `🔒 Créer en privé`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateChallenge;
