import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, ArrowLeft, Sparkles, Globe, Lock, Plus, Trash2, Check,
  Gamepad2, Activity, UtensilsCrossed, Dumbbell, Palette,
  BookOpen, Users, Leaf, Music, Heart, Wrench, LayoutGrid, CircleDollarSign, Zap, Rocket,
  type LucideIcon,
} from 'lucide-react';

// ── Category meta (icon + gradient + glow) — le libellé affiché vient de
// common.category.<clé> (voir CatTile), pour rester traduisible. ──────────────
const CAT_META: Record<string, { grad: string; glow: string; Icon: LucideIcon }> = {
  GAMING:     { grad: 'linear-gradient(135deg,#A78BFA,#EC4899)', glow: 'rgba(167,139,250,0.55)', Icon: Gamepad2 },
  SPORT:      { grad: 'linear-gradient(135deg,#34D399,#38BDF8)', glow: 'rgba(52,211,153,0.55)',  Icon: Activity },
  CUISINE:    { grad: 'linear-gradient(135deg,#FACC15,#FB923C)', glow: 'rgba(251,146,60,0.55)',  Icon: UtensilsCrossed },
  FITNESS:    { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.55)',  Icon: Dumbbell },
  CREATIVITY: { grad: 'linear-gradient(135deg,#EC4899,#A78BFA)', glow: 'rgba(236,72,153,0.55)',  Icon: Palette },
  KNOWLEDGE:  { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.55)',  Icon: BookOpen },
  SOCIAL:     { grad: 'linear-gradient(135deg,#FACC15,#FB923C)', glow: 'rgba(250,204,21,0.55)',  Icon: Users },
  NATURE:     { grad: 'linear-gradient(135deg,#4ADE80,#16A34A)', glow: 'rgba(74,222,128,0.55)',  Icon: Leaf },
  MUSIC:      { grad: 'linear-gradient(135deg,#F472B6,#A78BFA)', glow: 'rgba(244,114,182,0.55)', Icon: Music },
  WELLNESS:   { grad: 'linear-gradient(135deg,#6EE7B7,#3B82F6)', glow: 'rgba(110,231,183,0.55)', Icon: Heart },
  DIY:        { grad: 'linear-gradient(135deg,#FB923C,#D97706)', glow: 'rgba(251,146,60,0.55)',  Icon: Wrench },
  OTHERS:     { grad: 'linear-gradient(135deg,#94A3B8,#64748B)', glow: 'rgba(148,163,184,0.55)', Icon: LayoutGrid },
};

// Idem : le libellé vient de common.difficulty.<value en minuscule>.
const DIFFICULTIES = [
  { value: 'EASY',   coins: 50,  xp: 100,  border: 'border-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',   text: 'text-green-600 dark:text-green-400' },
  { value: 'MEDIUM', coins: 150, xp: 300,  border: 'border-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'HARD',   coins: 350, xp: 700,  border: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
  { value: 'EXPERT', coins: 700, xp: 1500, border: 'border-red-400',    bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-600 dark:text-red-400' },
];

// L'id est purement local (clé React stable pour que supprimer une carte au milieu de la
// liste ne mélange pas l'état des cartes suivantes) — jamais envoyé au serveur, voir handleSubmit.
type ChallengeForm = { id: string; title: string; description: string; category: string; difficulty: string };
const emptyChallenge = (): ChallengeForm => ({ id: crypto.randomUUID(), title: '', description: '', category: 'GAMING', difficulty: 'MEDIUM' });

type SubmitResult = { ok: true } | { ok: false; kind: 'network' } | { ok: false; kind: 'http'; error?: string };

// Construit le endpoint + payload adaptés au cas mono ou multi défis.
function buildSubmitRequest(challenges: ChallengeForm[], seriesName: string, isPublic: boolean) {
  const toSave = challenges.map(({ id: _id, ...c }) => ({ ...c, isPublic }));
  const endpoint = challenges.length === 1 ? '/api/challenges' : '/api/challenges/bulk-save';
  const trimmedSeries = seriesName.trim();
  const body = challenges.length === 1
    ? JSON.stringify({ ...toSave[0] })
    : JSON.stringify({ challenges: toSave, ...(trimmedSeries ? { seriesName: trimmedSeries } : {}) });
  return { endpoint, body };
}

// Envoie la création au backend ; isolé du composant pour ne pas alourdir sa
// complexité (try/catch + vérif réponse) — voir handleSubmit.
async function submitChallenges(challenges: ChallengeForm[], seriesName: string, isPublic: boolean): Promise<SubmitResult> {
  const token = localStorage.getItem('token');
  const { endpoint, body } = buildSubmitRequest(challenges, seriesName, isPublic);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, kind: 'http', error: data.error };
    return { ok: true };
  } catch {
    return { ok: false, kind: 'network' };
  }
}

// ── Category icon tile ─────────────────────────────────────────────────────────
function CatTile({ value, selected, onClick }: { value: string; selected: boolean; onClick: () => void }) {
  const { t } = useTranslation();
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
        {t(`common.category.${value}`)}
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
  const { t } = useTranslation();
  const diff = DIFFICULTIES.find(d => d.value === data.difficulty)!;
  const inputClass = `w-full px-3 py-2.5 rounded-xl border outline-none text-sm transition-colors
    ${darkMode
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'}`;
  const inactiveDifficultyClass = darkMode
    ? 'border-gray-600 hover:border-gray-500 text-gray-300'
    : 'border-gray-200 hover:border-gray-300 text-gray-600';

  return (
    <div className={`rounded-2xl border p-4 space-y-4 ${darkMode ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200 shadow-sm'}`}>
      {/* Card header */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
          {t('createChallenge.challengeNumber', { number: index + 1 })}
        </span>
        {total > 1 && (
          <button type="button" onClick={onRemove}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Titre */}
      <div data-tour="create-title">
        <label className="block text-xs font-semibold mb-1 opacity-70">{t('createChallenge.titleLabel')}</label>
        <input type="text" maxLength={80} value={data.title}
          onChange={e => onChange({ ...data, title: e.target.value })}
          placeholder={total > 1 ? t('createChallenge.titlePlaceholderMulti', { number: index + 1 }) : t('createChallenge.titlePlaceholderSingle')}
          className={inputClass} />
      </div>

      {/* Description */}
      <div data-tour="create-description">
        <label className="block text-xs font-semibold mb-1 opacity-70">{t('createChallenge.descriptionLabel')}</label>
        <textarea rows={2} maxLength={500} value={data.description}
          onChange={e => onChange({ ...data, description: e.target.value })}
          placeholder={t('createChallenge.descriptionPlaceholder')}
          className={`${inputClass} resize-none`} />
        <p className="text-right text-[10px] mt-0.5 opacity-40">{data.description.length}/500</p>
      </div>

      {/* Catégorie */}
      <div data-tour="create-category">
        <p className="text-xs font-semibold mb-2 opacity-70">{t('createChallenge.categoryLabel')}</p>
        <div className="grid grid-cols-4 gap-2">
          {Object.keys(CAT_META).map(v => (
            <CatTile key={v} value={v} selected={data.category === v}
              onClick={() => onChange({ ...data, category: v })} />
          ))}
        </div>
      </div>

      {/* Difficulté */}
      <div>
        <p className="text-xs font-semibold mb-2 opacity-70">{t('createChallenge.difficultyLabel')}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {DIFFICULTIES.map(d => (
            <button key={d.value} type="button"
              onClick={() => onChange({ ...data, difficulty: d.value })}
              className={`py-2 rounded-xl border-2 text-center transition-all active:scale-95 text-xs font-bold
                ${data.difficulty === d.value ? `${d.border} ${d.bg} ${d.text}` : inactiveDifficultyClass}`}>
              {t(`common.difficulty.${d.value.toLowerCase()}`)}
            </button>
          ))}
        </div>
        <p className={`text-xs mt-1.5 text-center font-semibold ${diff.text}`}>
          <span className="flex items-center justify-center gap-1"><CircleDollarSign size={11} aria-hidden="true" /> {t('createChallenge.coinsAmount', { count: diff.coins })} <span style={{ opacity: 0.5 }}>·</span> <Zap size={11} aria-hidden="true" /> {diff.xp} XP</span>
        </p>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const CreateChallenge: React.FC = () => {
  const { user, darkMode } = useStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [challenges, setChallenges] = useState<ChallengeForm[]>([emptyChallenge()]);
  const [seriesName, setSeriesName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) { navigate('/login'); return null; }

  // ── Constantes de thème (une seule bascule dark/light au lieu de ternaires
  // dispersés dans tout le JSX) ────────────────────────────────────────────
  const THEME = darkMode
    ? {
        text: 'text-white',
        backLink: 'text-gray-400 hover:text-white',
        card: 'bg-gray-800/60 border-gray-700',
        input: 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500',
        addChallengeBtn: 'border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-400',
        muted: 'text-gray-400',
        lockIcon: 'text-gray-400',
        toggleInactive: 'bg-gray-600',
        visibilityActive: 'border-blue-500/50 bg-blue-500/10',
        visibilityInactive: 'border-gray-600 bg-gray-700/40',
      }
    : {
        text: 'text-gray-900',
        backLink: 'text-gray-500 hover:text-gray-900',
        card: 'bg-white border-gray-200 shadow-sm',
        input: 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white',
        addChallengeBtn: 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600',
        muted: 'text-gray-500',
        lockIcon: 'text-gray-500',
        toggleInactive: 'bg-gray-300',
        visibilityActive: 'border-blue-200 bg-blue-50',
        visibilityInactive: 'border-gray-200 bg-gray-50',
      };

  const visibilityBorderClass = isPublic ? THEME.visibilityActive : THEME.visibilityInactive;
  const toggleTrackClass = isPublic ? 'bg-blue-500' : THEME.toggleInactive;

  // ── Contenu dépendant de isPublic (une seule bascule au lieu de 4 ternaires) ──
  const visibilityContent = isPublic
    ? {
        icon: <Globe size={16} className="text-blue-400 shrink-0" />,
        label: t('createChallenge.public'),
        description: t('createChallenge.visibleByAll'),
        togglePos: 'left-5',
      }
    : {
        icon: <Lock size={16} className={`shrink-0 ${THEME.lockIcon}`} />,
        label: t('createChallenge.private'),
        description: t('createChallenge.visibleByYouOnly'),
        togglePos: 'left-0.5',
      };

  const publishLabel = challenges.length > 1
    ? t('createChallenge.publishMultiple', { count: challenges.length })
    : t('createChallenge.publishSingle');
  const submitButtonContent = isPublic
    ? <span className="flex items-center justify-center gap-1.5"><Rocket size={15} /> {publishLabel}</span>
    : <span className="flex items-center justify-center gap-1.5"><Lock size={15} /> {t('createChallenge.createPrivate')}</span>;

  const updateChallenge = (i: number, f: ChallengeForm) =>
    setChallenges(prev => prev.map((c, idx) => idx === i ? f : c));

  const addChallenge = () => setChallenges(prev => [...prev, emptyChallenge()]);

  const removeChallenge = (i: number) =>
    setChallenges(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = challenges.find(c => !c.title.trim() || !c.description.trim());
    if (invalid) { setError(t('createChallenge.missingFields')); return; }
    setLoading(true);
    setError('');
    const result = await submitChallenges(challenges, seriesName, isPublic);
    setLoading(false);
    if (!result.ok) {
      setError(result.kind === 'network' ? t('createChallenge.networkError') : (result.error || t('createChallenge.createError')));
      return;
    }
    navigate('/challenges');
  };

  return (
    <div className={`px-3 py-4 md:p-6 ${THEME.text}`}>

      <button onClick={() => navigate('/challenges')}
        className={`flex items-center gap-1.5 mb-5 text-sm font-medium ${THEME.backLink} transition-colors`}>
        <ArrowLeft size={16} /> {t('createChallenge.backToChallenges')}
      </button>

      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="text-yellow-500" size={22} />
            {challenges.length > 1 ? t('createChallenge.createMultiple', { count: challenges.length }) : t('createChallenge.createSingle')}
          </h1>
          <button onClick={() => navigate('/challenges/ai-create')}
            data-tour="create-ai"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90 transition-opacity">
            <Sparkles size={13} /> {t('createChallenge.aiButton')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Liste des défis */}
          {challenges.map((c, i) => (
            <ChallengeCard key={c.id} index={i} total={challenges.length}
              data={c} darkMode={darkMode}
              onChange={f => updateChallenge(i, f)}
              onRemove={() => removeChallenge(i)} />
          ))}

          {/* Nom de la série (optionnel, quand plusieurs défis) */}
          {challenges.length > 1 && (
            <div className={`rounded-xl border p-3 ${THEME.card}`}>
              <label htmlFor="series-name" className="block text-xs font-semibold mb-1.5 opacity-70">
                {t('createChallenge.seriesNameLabel')} <span className="opacity-50 font-normal">({t('createChallenge.optional')})</span>
              </label>
              <input
                id="series-name"
                type="text"
                maxLength={80}
                value={seriesName}
                onChange={e => setSeriesName(e.target.value)}
                placeholder={t('createChallenge.seriesNamePlaceholder')}
                className={`w-full px-3 py-2.5 rounded-xl border outline-none text-sm transition-colors ${THEME.input}`}
              />
              <p className="text-xs mt-1 opacity-40">{t('createChallenge.seriesNameHint')}</p>
            </div>
          )}

          {/* Bouton ajouter un défi */}
          <button type="button" onClick={addChallenge}
            className={`w-full py-3 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]
              ${THEME.addChallengeBtn}`}>
            <Plus size={16} /> {t('createChallenge.addChallenge')}
          </button>

          {/* Visibilité */}
          <button type="button" onClick={() => setIsPublic(p => !p)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${visibilityBorderClass}`}>
            <div className="flex items-center gap-3">
              {visibilityContent.icon}
              <div className="text-left">
                <p className="text-sm font-semibold">{visibilityContent.label}</p>
                <p className={`text-xs ${THEME.muted}`}>
                  {visibilityContent.description}
                </p>
              </div>
            </div>
            <div className={`w-10 h-5 rounded-full transition-colors shrink-0 relative ${toggleTrackClass}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${visibilityContent.togglePos}`} />
            </div>
          </button>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 text-sm active:scale-95">
            {loading ? t('createChallenge.creating') : submitButtonContent}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateChallenge;
