import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Sparkles, Check, Trophy, ChevronDown, ChevronUp, Globe, Lock, CircleDollarSign, Zap } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface GeneratedChallenge {
  title: string;
  description: string;
  category: string;
  difficulty: string;
}

type TFunc = ReturnType<typeof useTranslation>['t'];
type NavigateFn = ReturnType<typeof useNavigate>;

// Le libellé de difficulté vient de common.difficulty.<clé en minuscule>.
const DIFFICULTY_STYLES: Record<string, { coins: number; xp: number; border: string; bg: string; text: string; badge: string }> = {
  EASY:   { coins: 50,  xp: 100,  border: 'border-green-500/60',  bg: 'bg-green-500/10',   text: 'text-green-400',  badge: 'bg-green-500/20 text-green-400' },
  MEDIUM: { coins: 150, xp: 300,  border: 'border-yellow-500/60', bg: 'bg-yellow-500/10', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400' },
  HARD:   { coins: 350, xp: 700,  border: 'border-orange-500/60', bg: 'bg-orange-500/10', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-400' },
  EXPERT: { coins: 700, xp: 1500, border: 'border-red-500/60',    bg: 'bg-red-500/10',    text: 'text-red-400',    badge: 'bg-red-500/20 text-red-400' },
};

const CATEGORY_EMOJIS: Record<string, string> = {
  GAMING: '🎮', SPORT: '⚽', CUISINE: '🍳', FITNESS: '💪',
  CREATIVITY: '🎨', KNOWLEDGE: '📚', SOCIAL: '🤝',
  NATURE: '🌱', MUSIC: '🎵', WELLNESS: '🧘', DIY: '🔨', OTHERS: '🎯',
};

const SUGGESTION_KEYS = ['sport', 'cooking', 'gaming', 'reading'] as const;

interface Theme {
  bg: string;
  surface: string;
  textMuted: string;
  borderColor: string;
}

const LIGHT_THEME: Theme = {
  bg: 'bg-gray-50',
  surface: 'bg-white border-gray-200',
  textMuted: 'text-gray-500',
  borderColor: 'border-gray-200',
};

const DARK_THEME: Theme = {
  bg: 'bg-gray-900',
  surface: 'bg-gray-800 border-gray-700',
  textMuted: 'text-gray-400',
  borderColor: 'border-gray-700/60',
};

function getTheme(darkMode: boolean): Theme {
  return darkMode ? DARK_THEME : LIGHT_THEME;
}

function pickChallengesArray(data: unknown): GeneratedChallenge[] | null {
  if (Array.isArray(data)) return data as GeneratedChallenge[];
  const challenges = (data as { challenges?: unknown } | null)?.challenges;
  if (Array.isArray(challenges)) return challenges as GeneratedChallenge[];
  return null;
}

function toggleSetMember(set: Set<number>, key: number): Set<number> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}

function getBubbleClasses(role: Message['role'], darkMode: boolean): string {
  if (role === 'user') return 'bg-blue-600 text-white rounded-br-md';
  return darkMode ? 'bg-gray-700/80 text-gray-100 rounded-bl-md' : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-100';
}

function getCardBorderClasses(isSelected: boolean, diff: { border: string; bg: string }, darkMode: boolean): string {
  if (isSelected) return `${diff.border} ${diff.bg}`;
  return darkMode ? 'border-gray-700/60' : 'border-gray-100 bg-gray-50/50';
}

function getCheckboxClasses(isSelected: boolean, darkMode: boolean): string {
  if (isSelected) return 'bg-blue-600 border-blue-600';
  return darkMode ? 'border-gray-500' : 'border-gray-300';
}

function getVisibilityToggleClasses(isPublic: boolean, darkMode: boolean): string {
  if (isPublic) return darkMode ? 'border-blue-500/50 bg-blue-500/10' : 'border-blue-200 bg-blue-50';
  return darkMode ? 'border-gray-600 bg-gray-700/40' : 'border-gray-200 bg-gray-50';
}

function getSwitchTrackClasses(isPublic: boolean, darkMode: boolean): string {
  if (isPublic) return 'bg-blue-500';
  return darkMode ? 'bg-gray-600' : 'bg-gray-300';
}

function getSaveButtonLabel(t: TFunc, saving: boolean, isPublic: boolean, count: number): string {
  if (saving) return t('aiGenerator.saving');
  if (isPublic) return t('aiGenerator.publishCount', { count });
  return t('aiGenerator.createPrivateCount', { count });
}

interface SendMessageParams {
  input: string;
  loading: boolean;
  messages: Message[];
  phase: 'chat' | 'selection';
  t: TFunc;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setChallenges: React.Dispatch<React.SetStateAction<GeneratedChallenge[]>>;
  setSelected: React.Dispatch<React.SetStateAction<Set<number>>>;
  setPhase: React.Dispatch<React.SetStateAction<'chat' | 'selection'>>;
  setPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setExpandedCards: React.Dispatch<React.SetStateAction<Set<number>>>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

async function sendChatMessage(params: SendMessageParams): Promise<void> {
  const {
    input, loading, messages, phase, t,
    setInput, setError, setMessages, setLoading,
    setChallenges, setSelected, setPhase, setPanelOpen, setExpandedCards, inputRef,
  } = params;

  const text = input.trim();
  if (!text || loading) return;
  setInput('');
  setError('');

  const newMessages: Message[] = [...messages, { role: 'user', content: text }];
  setMessages(newMessages);
  setLoading(true);

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/challenges/ai-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ history: newMessages }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.type === 'question' && data.content) {
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      setPhase('chat');
      return;
    }

    const arr = pickChallengesArray(data);
    if (!arr) {
      setMessages(prev => [...prev, { role: 'assistant', content: typeof data === 'string' ? data : JSON.stringify(data) }]);
      return;
    }

    const summary = phase === 'selection'
      ? t('aiGenerator.planUpdated', { count: arr.length })
      : t('aiGenerator.challengesCreated', { count: arr.length });
    setMessages(prev => [...prev, { role: 'assistant', content: summary }]);
    setChallenges(arr);
    setSelected(new Set(arr.map((_: GeneratedChallenge, i: number) => i)));
    setPhase('selection');
    setPanelOpen(true);
    setExpandedCards(new Set(arr.map((_: GeneratedChallenge, i: number) => i)));
  } catch {
    setError(t('aiGenerator.connectionError'));
  } finally {
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }
}

interface SaveSelectedParams {
  selected: Set<number>;
  challenges: GeneratedChallenge[];
  messages: Message[];
  isPublic: boolean;
  t: TFunc;
  navigate: NavigateFn;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
}

async function saveSelectedChallenges(params: SaveSelectedParams): Promise<void> {
  const { selected, challenges, messages, isPublic, t, navigate, setSaving, setError } = params;
  if (selected.size === 0) return;
  setSaving(true);
  setError('');
  try {
    const token = localStorage.getItem('token');
    const toSave = challenges.filter((_, i) => selected.has(i)).map(c => ({ ...c, isPublic }));
    const firstUserMsg = messages.find(m => m.role === 'user')?.content ?? '';
    const seriesName = toSave.length > 1 ? firstUserMsg.slice(0, 60).trim() || undefined : undefined;
    const res = await fetch('/api/challenges/bulk-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ challenges: toSave, ...(seriesName ? { seriesName } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    navigate('/challenges');
  } catch {
    setError(t('aiGenerator.saveError'));
  } finally {
    setSaving(false);
  }
}

function ChatHeader({ darkMode, phase, selectedCount, totalCount, theme, t, onBack }: {
  darkMode: boolean;
  phase: 'chat' | 'selection';
  selectedCount: number;
  totalCount: number;
  theme: Theme;
  t: TFunc;
  onBack: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b ${theme.borderColor}`}>
      <button onClick={onBack}
        className={`p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
        <ArrowLeft size={18} />
      </button>
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
        <Sparkles size={15} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-sm leading-tight">{t('aiGenerator.title')}</h1>
        <p className={`text-xs ${theme.textMuted}`}>{t('aiGenerator.subtitle')}</p>
      </div>
      {phase === 'selection' && (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
          {selectedCount}/{totalCount}
        </span>
      )}
    </div>
  );
}

function EmptyState({ darkMode, theme, t, suggestionKeys, onSuggestionClick }: {
  darkMode: boolean;
  theme: Theme;
  t: TFunc;
  suggestionKeys: readonly string[];
  onSuggestionClick: (key: string) => void;
}) {
  return (
    <div className={`rounded-2xl p-6 border text-center ${theme.surface} shadow-sm`}>
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-3">
        <Sparkles size={22} className="text-white" />
      </div>
      <h2 className="font-bold text-base mb-1">{t('aiGenerator.emptyTitle')}</h2>
      <p className={`text-sm ${theme.textMuted} mb-4`}>{t('aiGenerator.emptySubtitle')}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestionKeys.map(key => (
          <button key={key} onClick={() => onSuggestionClick(key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors
              ${darkMode ? 'border-gray-600 hover:border-purple-400 hover:text-purple-400 text-gray-300' : 'border-gray-200 hover:border-purple-400 hover:text-purple-600 text-gray-600'}`}>
            {t(`aiGenerator.suggestions.${key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg, darkMode }: { msg: Message; darkMode: boolean }) {
  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
      {msg.role === 'assistant' && (
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0 mb-0.5">
          <Sparkles size={11} className="text-white" />
        </div>
      )}
      <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${getBubbleClasses(msg.role, darkMode)}`}>
        {msg.content}
      </div>
    </div>
  );
}

function LoadingBubble({ darkMode }: { darkMode: boolean }) {
  return (
    <div className="flex items-end gap-2">
      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
        <Sparkles size={11} className="text-white" />
      </div>
      <div className={`px-3.5 py-3 rounded-2xl rounded-bl-md ${darkMode ? 'bg-gray-700/80' : 'bg-white shadow-sm border border-gray-100'}`}>
        <div className="flex gap-1 items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function MessagesList({ extraPb, messages, loading, darkMode, theme, t, suggestionKeys, onSuggestionClick, bottomRef }: {
  extraPb: string;
  messages: Message[];
  loading: boolean;
  darkMode: boolean;
  theme: Theme;
  t: TFunc;
  suggestionKeys: readonly string[];
  onSuggestionClick: (key: string) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className={`px-4 pt-4 space-y-3 ${extraPb}`}>
      {messages.length === 0 && (
        <EmptyState darkMode={darkMode} theme={theme} t={t} suggestionKeys={suggestionKeys} onSuggestionClick={onSuggestionClick} />
      )}

      {messages.map((msg, i) => (
        <MessageBubble key={i} msg={msg} darkMode={darkMode} />
      ))}

      {loading && <LoadingBubble darkMode={darkMode} />}
      <div ref={bottomRef} />
    </div>
  );
}

function ChallengeCard({ challenge, index, darkMode, isSelected, isExpanded, t, onToggleSelect, onToggleExpand }: {
  challenge: GeneratedChallenge;
  index: number;
  darkMode: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  t: TFunc;
  onToggleSelect: (i: number) => void;
  onToggleExpand: (i: number) => void;
}) {
  const diff = DIFFICULTY_STYLES[challenge.difficulty] ?? DIFFICULTY_STYLES.EASY;
  const diffLabel = t(`common.difficulty.${challenge.difficulty.toLowerCase()}`);
  return (
    <div className={`rounded-xl border transition-all ${getCardBorderClasses(isSelected, diff, darkMode)}`}>
      <div className="flex gap-3 items-center px-3 py-2.5 cursor-pointer" onClick={() => onToggleSelect(index)}>
        <div
          className={`rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${getCheckboxClasses(isSelected, darkMode)}`}
          style={{ width: 18, height: 18 }}>
          {isSelected && <Check size={10} className="text-white" />}
        </div>
        <span className="text-sm font-medium truncate flex-1">
          {CATEGORY_EMOJIS[challenge.category] ?? '🎯'} {challenge.title}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${diff.badge}`}>{diffLabel}</span>
        <button
          onClick={e => { e.stopPropagation(); onToggleExpand(index); }}
          className={`shrink-0 p-1 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {isExpanded && (
        <div className={`px-3 pb-3 border-t ${darkMode ? 'border-gray-700/60' : 'border-gray-200/60'}`}>
          <p className={`text-xs leading-relaxed pt-2 mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{challenge.description}</p>
          <p className={`text-xs font-semibold flex items-center gap-1 ${diff.text}`}><CircleDollarSign size={11} aria-hidden="true" /> {t('createChallenge.coinsAmount', { count: diff.coins })} <span style={{ opacity: 0.5 }}>·</span> <Zap size={11} aria-hidden="true" /> {diff.xp} XP</p>
        </div>
      )}
    </div>
  );
}

function VisibilityToggle({ isPublic, darkMode, theme, t, onToggle }: {
  isPublic: boolean;
  darkMode: boolean;
  theme: Theme;
  t: TFunc;
  onToggle: () => void;
}) {
  const icon = isPublic
    ? <Globe size={14} className="text-blue-400 shrink-0" />
    : <Lock size={14} className={`shrink-0 ${theme.textMuted}`} />;
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${getVisibilityToggleClasses(isPublic, darkMode)}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold">{isPublic ? t('createChallenge.public') : t('createChallenge.private')}</span>
        <span className={`text-xs ${theme.textMuted}`}>
          {isPublic ? t('aiGenerator.visibleByAll') : t('aiGenerator.visibleByYouOnly')}
        </span>
      </div>
      <div className={`w-9 h-5 rounded-full transition-colors shrink-0 relative ${getSwitchTrackClasses(isPublic, darkMode)}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isPublic ? 'left-4' : 'left-0.5'}`} />
      </div>
    </button>
  );
}

function SelectionPanel({
  darkMode, theme, t, panelOpen, setPanelOpen, challenges, selected, expandedCards,
  onToggleSelect, onToggleExpand, onToggleAll, isPublic, onToggleVisibility,
  error, saving, onSave,
}: {
  darkMode: boolean;
  theme: Theme;
  t: TFunc;
  panelOpen: boolean;
  setPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  challenges: GeneratedChallenge[];
  selected: Set<number>;
  expandedCards: Set<number>;
  onToggleSelect: (i: number) => void;
  onToggleExpand: (i: number) => void;
  onToggleAll: () => void;
  isPublic: boolean;
  onToggleVisibility: () => void;
  error: string;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className={`border-t ${theme.borderColor} ${darkMode ? 'bg-gray-800/80' : 'bg-white'}`}>
      <button
        onClick={() => setPanelOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors ${darkMode ? 'hover:bg-gray-700/40' : 'hover:bg-gray-50'}`}>
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-blue-400" />
          <span className="text-sm font-semibold">{t('aiGenerator.generatedChallenges')}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
            {selected.size}/{challenges.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); onToggleAll(); }}
            className={`text-xs font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            {selected.size === challenges.length ? t('aiGenerator.deselectAll') : t('aiGenerator.selectAll')}
          </button>
          {panelOpen ? <ChevronDown size={16} className={theme.textMuted} /> : <ChevronUp size={16} className={theme.textMuted} />}
        </div>
      </button>

      {panelOpen && (
        <div className="overflow-y-auto max-h-[32vh] px-3 pb-1 space-y-1.5">
          {challenges.map((ch, i) => (
            <ChallengeCard
              key={i}
              challenge={ch}
              index={i}
              darkMode={darkMode}
              isSelected={selected.has(i)}
              isExpanded={expandedCards.has(i)}
              t={t}
              onToggleSelect={onToggleSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}

      <div className="px-3 pt-1.5 pb-2.5 space-y-2">
        {/* Toggle public / privé */}
        <VisibilityToggle isPublic={isPublic} darkMode={darkMode} theme={theme} t={t} onToggle={onToggleVisibility} />

        {error && <p className="text-red-500 text-xs text-center">{error}</p>}
        <button onClick={onSave} disabled={saving || selected.size === 0}
          className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
          <Trophy size={15} />
          {getSaveButtonLabel(t, saving, isPublic, selected.size)}
        </button>
      </div>
    </div>
  );
}

function InputBar({ darkMode, theme, phase, error, input, setInput, inputRef, onSend, loading, t }: {
  darkMode: boolean;
  theme: Theme;
  phase: 'chat' | 'selection';
  error: string;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onSend: () => void;
  loading: boolean;
  t: TFunc;
}) {
  return (
    <div className={`px-3 py-2.5 border-t ${theme.borderColor} ${darkMode ? theme.bg : 'bg-gray-50'}`}>
      {error && phase === 'chat' && <p className="text-red-500 text-xs text-center mb-1.5">{error}</p>}
      <div className={`flex gap-2 items-end px-3 py-2 rounded-2xl border shadow-sm ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={e => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
          }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={phase === 'selection' ? t('aiGenerator.placeholderSelection') : t('aiGenerator.placeholderChat')}
          className={`flex-1 bg-transparent outline-none text-sm resize-none leading-relaxed py-1 ${darkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
          style={{ minHeight: 32, maxHeight: 100 }}
        />
        <button onClick={onSend} disabled={loading || !input.trim()}
          className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-40 shrink-0 active:scale-95">
          <Send size={14} className="text-white" />
        </button>
      </div>
    </div>
  );
}

const AIChallengeGenerator: React.FC = () => {
  const { t } = useTranslation();
  const { user, darkMode } = useStore();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'chat' | 'selection'>('chat');
  const [challenges, setChallenges] = useState<GeneratedChallenge[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [isPublic, setIsPublic] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    if (messages.length > 0 || loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  if (!user) return null;

  const theme = getTheme(darkMode);

  const sendMessage = () => sendChatMessage({
    input, loading, messages, phase, t,
    setInput, setError, setMessages, setLoading,
    setChallenges, setSelected, setPhase, setPanelOpen, setExpandedCards, inputRef,
  });

  const toggleSelect = (i: number) => setSelected(prev => toggleSetMember(prev, i));

  const toggleExpand = (i: number) => setExpandedCards(prev => toggleSetMember(prev, i));

  const toggleAll = () => {
    setSelected(selected.size === challenges.length ? new Set() : new Set(challenges.map((_, i) => i)));
  };

  const saveSelected = () => saveSelectedChallenges({
    selected, challenges, messages, isPublic, t, navigate, setSaving, setError,
  });

  const handleSuggestionClick = (key: string) => {
    setInput(t(`aiGenerator.suggestions.${key}`));
    inputRef.current?.focus();
  };

  const renderMessages = (extraPb: string) => (
    <MessagesList
      extraPb={extraPb}
      messages={messages}
      loading={loading}
      darkMode={darkMode}
      theme={theme}
      t={t}
      suggestionKeys={SUGGESTION_KEYS}
      onSuggestionClick={handleSuggestionClick}
      bottomRef={bottomRef}
    />
  );

  return (
    <div className={`max-w-2xl mx-auto ${darkMode ? 'text-white' : 'text-gray-900'}`}>

      {/* ── DESKTOP ── */}
      <div className={`hidden md:flex flex-col h-[calc(100vh-4rem)] overflow-hidden ${theme.bg}`}>
        <ChatHeader darkMode={darkMode} phase={phase} selectedCount={selected.size} totalCount={challenges.length} theme={theme} t={t} onBack={() => navigate('/challenges')} />
        <div className="flex-1 overflow-y-auto min-h-0">
          {renderMessages('pb-4')}
        </div>
        {phase === 'selection' && (
          <div className="shrink-0">
            <SelectionPanel
              darkMode={darkMode} theme={theme} t={t}
              panelOpen={panelOpen} setPanelOpen={setPanelOpen}
              challenges={challenges} selected={selected} expandedCards={expandedCards}
              onToggleSelect={toggleSelect} onToggleExpand={toggleExpand} onToggleAll={toggleAll}
              isPublic={isPublic} onToggleVisibility={() => setIsPublic(p => !p)}
              error={error} saving={saving} onSave={saveSelected}
            />
          </div>
        )}
        <div className="shrink-0">
          <InputBar darkMode={darkMode} theme={theme} phase={phase} error={error} input={input} setInput={setInput} inputRef={inputRef} onSend={sendMessage} loading={loading} t={t} />
        </div>
      </div>

      {/* ── MOBILE : fixed inset-0, même principe que desktop ── */}
      {/* paddingBottom 82px = espace pour la navbar pill */}
      <div
        className={`fixed md:hidden inset-0 flex flex-col z-10 ${theme.bg}`}
        style={{ paddingBottom: 82 }}
      >
        <ChatHeader darkMode={darkMode} phase={phase} selectedCount={selected.size} totalCount={challenges.length} theme={theme} t={t} onBack={() => navigate('/challenges')} />
        <div className="flex-1 overflow-y-auto min-h-0">
          {renderMessages('pb-4')}
        </div>
        {phase === 'selection' && (
          <div className="shrink-0">
            <SelectionPanel
              darkMode={darkMode} theme={theme} t={t}
              panelOpen={panelOpen} setPanelOpen={setPanelOpen}
              challenges={challenges} selected={selected} expandedCards={expandedCards}
              onToggleSelect={toggleSelect} onToggleExpand={toggleExpand} onToggleAll={toggleAll}
              isPublic={isPublic} onToggleVisibility={() => setIsPublic(p => !p)}
              error={error} saving={saving} onSave={saveSelected}
            />
          </div>
        )}
        <div className="shrink-0">
          <InputBar darkMode={darkMode} theme={theme} phase={phase} error={error} input={input} setInput={setInput} inputRef={inputRef} onSend={sendMessage} loading={loading} t={t} />
        </div>
      </div>

    </div>
  );
};

export default AIChallengeGenerator;
