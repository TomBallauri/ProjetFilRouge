import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

const CATEGORIES = ['GAMING', 'SPORT', 'CUISINE', 'FITNESS', 'CREATIVITY', 'KNOWLEDGE', 'SOCIAL', 'NATURE', 'MUSIC', 'WELLNESS', 'DIY', 'OTHERS'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];

export type EditableChallenge = {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  coinReward: number;
  xpReward: number;
  isPublic?: boolean;
};

type Props = {
  challenge: EditableChallenge | null;
  onClose: () => void;
  onSaved: (updated: EditableChallenge) => void;
  showNotif: (msg: string, type: 'success' | 'error') => void;
};

const inputStyle: React.CSSProperties = {
  background: 'var(--q-bg-flat)', border: '1px solid var(--q-line)', color: 'var(--q-text)',
};

const EditChallengeModal: React.FC<Props> = ({ challenge, onClose, onSaved, showNotif }) => {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('GAMING');
  const [difficulty, setDifficulty] = useState('EASY');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  // Réinitialise le formulaire à chaque nouveau défi ouvert (pas seulement au montage, la modale
  // reste montée entre deux ouvertures successives).
  useEffect(() => {
    if (!challenge) return;
    setTitle(challenge.title);
    setDescription(challenge.description);
    setCategory(challenge.category);
    setDifficulty(challenge.difficulty);
    setIsPublic(challenge.isPublic !== false);
  }, [challenge]);

  if (!challenge) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || saving) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), category, difficulty, isPublic, lang: i18n.language }),
      });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || t('editChallenge.error'), 'error'); return; }
      showNotif(t('editChallenge.success'), 'success');
      onSaved(data);
      onClose();
    } catch {
      showNotif(t('editChallenge.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t('editChallenge.title')}
      style={{
        position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16,
      }}
      onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl p-5"
        style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: '0 20px 60px -10px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>
            {t('editChallenge.title')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--q-text3)', padding: 4 }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <label className="block mb-3">
          <span className="text-xs font-bold" style={{ color: 'var(--q-text2)' }}>{t('editChallenge.titleLabel')}</span>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} required
            className="w-full mt-1 px-3 py-2 rounded-xl text-sm" style={inputStyle} />
          <p className="text-right text-[10px] mt-0.5" style={{ color: 'var(--q-text3)' }}>{title.length}/80</p>
        </label>

        <label className="block mb-3">
          <span className="text-xs font-bold" style={{ color: 'var(--q-text2)' }}>{t('editChallenge.descriptionLabel')}</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} required rows={3}
            className="w-full mt-1 px-3 py-2 rounded-xl text-sm resize-none" style={inputStyle} />
          <p className="text-right text-[10px] mt-0.5" style={{ color: 'var(--q-text3)' }}>{description.length}/500</p>
        </label>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-xs font-bold" style={{ color: 'var(--q-text2)' }}>{t('editChallenge.categoryLabel')}</span>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl text-sm" style={inputStyle}>
              {CATEGORIES.map(c => <option key={c} value={c}>{t(`common.category.${c}`)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold" style={{ color: 'var(--q-text2)' }}>{t('editChallenge.difficultyLabel')}</span>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl text-sm" style={inputStyle}>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{t(`common.difficulty.${d.toLowerCase()}`)}</option>)}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 mb-5 text-sm" style={{ color: 'var(--q-text)' }}>
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
          {t('editChallenge.isPublicLabel')}
        </label>

        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="q-press flex-1 py-2.5 rounded-full font-bold text-sm"
            style={{ background: 'var(--q-bg-flat)', color: 'var(--q-text2)' }}>
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={saving}
            className="q-press flex-1 py-2.5 rounded-full font-bold text-sm text-white disabled:opacity-60"
            style={{ background: 'var(--q-accent)' }}>
            {saving ? '...' : t('editChallenge.save')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditChallengeModal;
