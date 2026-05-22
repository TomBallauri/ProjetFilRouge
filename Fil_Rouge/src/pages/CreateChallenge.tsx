import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowLeft } from 'lucide-react';

const CATEGORIES = [
  { value: 'GAMING',     label: 'Gaming',       emoji: '🎮' },
  { value: 'SPORT',      label: 'Sport',        emoji: '⚽' },
  { value: 'CUISINE',    label: 'Cuisine',      emoji: '🍳' },
  { value: 'FITNESS',    label: 'Fitness',      emoji: '💪' },
  { value: 'CREATIVITY', label: 'Créativité',   emoji: '🎨' },
  { value: 'KNOWLEDGE',  label: 'Connaissance', emoji: '📚' },
  { value: 'SOCIAL',     label: 'Social',       emoji: '🤝' },
];

const DIFFICULTIES = [
  { value: 'EASY',   label: 'Facile',    coins: 50,  xp: 100,  border: 'border-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',   text: 'text-green-700 dark:text-green-400' },
  { value: 'MEDIUM', label: 'Moyen',     coins: 150, xp: 300,  border: 'border-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' },
  { value: 'HARD',   label: 'Difficile', coins: 350, xp: 700,  border: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400' },
  { value: 'EXPERT', label: 'Expert',    coins: 700, xp: 1500, border: 'border-red-400',    bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-700 dark:text-red-400' },
];

const CreateChallenge: React.FC = () => {
  const { user, darkMode } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', category: 'GAMING', difficulty: 'MEDIUM' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) { navigate('/login'); return null; }

  const selectedDiff = DIFFICULTIES.find(d => d.value === form.difficulty)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) { setError('Titre et description sont requis.'); return; }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur lors de la création'); return; }
      navigate('/challenges');
    } catch { setError('Erreur réseau'); }
    finally { setLoading(false); }
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border outline-none text-sm transition-colors
    ${darkMode
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'}`;

  return (
    <div className={`px-3 py-4 md:p-6 min-h-screen ${darkMode ? 'text-white' : 'text-gray-900'}`}>

      <button onClick={() => navigate('/challenges')}
        className={`flex items-center gap-1.5 mb-5 text-sm font-medium ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
        <ArrowLeft size={16} /> Retour aux défis
      </button>

      <div className={`max-w-lg mx-auto rounded-2xl shadow-lg p-5 md:p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 mb-5">
          <Trophy className="text-yellow-500" size={24} />
          Créer un défi
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Titre */}
          <div>
            <label htmlFor="challenge-title" className="block text-sm font-semibold mb-1.5">Titre du défi</label>
            <input
              id="challenge-title"
              type="text" maxLength={80} value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Courir 5km sans s'arrêter"
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="challenge-desc" className="block text-sm font-semibold mb-1.5">Description</label>
            <textarea
              id="challenge-desc"
              rows={3} maxLength={500} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Décris clairement ce qu'il faut accomplir..."
              className={`${inputClass} resize-none`}
            />
            <p className={`text-right text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {form.description.length}/500
            </p>
          </div>

          {/* Catégorie */}
          <div>
            <p className="block text-sm font-semibold mb-2">Catégorie</p>
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button"
                  onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all active:scale-95
                    ${form.category === cat.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : darkMode ? 'border-gray-600 hover:border-gray-500 text-gray-300' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="truncate w-full text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulté */}
          <div>
            <p className="block text-sm font-semibold mb-2">Difficulté & récompenses</p>
            <div className="grid grid-cols-2 gap-2">
              {DIFFICULTIES.map(diff => (
                <button key={diff.value} type="button"
                  onClick={() => setForm(f => ({ ...f, difficulty: diff.value }))}
                  className={`p-3 rounded-xl border-2 text-left transition-all active:scale-95
                    ${form.difficulty === diff.value
                      ? `${diff.border} ${diff.bg}`
                      : darkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className={`font-bold text-sm ${form.difficulty === diff.value ? diff.text : ''}`}>{diff.label}</p>
                  <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    🪙 {diff.coins} · ⚡ {diff.xp} XP
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Récap récompenses */}
          <div className={`flex items-center justify-center gap-6 p-3 rounded-xl text-sm font-bold ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <span className="text-yellow-600 dark:text-yellow-400">🪙 {selectedDiff.coins} coins</span>
            <span className={darkMode ? 'text-gray-600' : 'text-gray-300'}>·</span>
            <span className="text-purple-600 dark:text-purple-400">⚡ {selectedDiff.xp} XP</span>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 text-sm active:scale-95 shadow-sm">
            {loading ? 'Création...' : '🚀 Publier le défi'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateChallenge;
