import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { MessageSquare, Search, Plus, X, ThumbsUp, Clock, Tag as TagIcon, Send, ChevronRight, SlidersHorizontal } from 'lucide-react';
import BackButton from '../components/BackButton';
import PageLoader from '../components/PageLoader';
import { usePageTitle } from '../hooks/usePageTitle';
import { useNavigate, Link } from 'react-router-dom';
import { getEquipped, TITLE_CLASSES } from '../lib/cosmetics';
import type { EquippedCosmetic } from '../lib/cosmetics';
import UserAvatar from '../components/UserAvatar';

interface Tag { id: string; name: string; color: string; }

interface Discussion {
  id: string;
  title: string;
  content: string;
  author: { name: string; avatar: string; cosmetics: EquippedCosmetic[]; };
  game: string;
  category: string;
  createdAt: string;
  views: number;
  likes: number;
  replies: number;
  tags: Tag[];
}

const GAMES = ['Valorant', 'League of Legends', 'CS2', 'Fortnite', 'Apex Legends'];
const CATEGORIES = ['Guides', 'Discussion', 'Question', 'Actualités', "Recherche d'équipe"];

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 14px', borderRadius: 12,
  background: 'var(--q-bg)', border: '1px solid var(--q-line)',
  color: 'var(--q-text)', fontSize: 13, fontFamily: 'var(--q-font)', outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none' as const,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--q-text2)', marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase',
};

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const DiscussionsPage: React.FC = () => {
  usePageTitle('Discussions');
  const { user } = useStore();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGame, setFilterGame] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'likes'>('date');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedGame, setSelectedGame] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');

  const [likedDiscussions, setLikedDiscussions] = useState<number[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/discussions')
      .then(res => res.json())
      .then(data => {
        const mapped = data.map((d: any) => ({
          ...d,
          author: d.user
            ? { name: d.user.username || d.user.name || 'Anonyme', avatar: d.user.avatar || '', cosmetics: d.user.cosmetics || [] }
            : { name: 'Anonyme', avatar: '', cosmetics: [] },
          tags: Array.isArray(d.tags) ? d.tags : typeof d.tags === 'string' ? JSON.parse(d.tags) : [],
          views: d.views || 0, likes: d.likes || 0, replies: d._count?.posts ?? 0,
        }));
        setDiscussions(mapped);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredDiscussions = discussions
    .filter(d => {
      const s = searchTerm.trim().toLowerCase();
      const matchSearch = !s || d.title.toLowerCase().includes(s) || d.game.toLowerCase().includes(s) || d.category.toLowerCase().includes(s) || d.tags.some(t => t.name.toLowerCase().includes(s));
      const matchGame = filterGame === 'ALL' || d.game === filterGame;
      const matchCat = filterCategory === 'ALL' || d.category === filterCategory;
      return matchSearch && matchGame && matchCat;
    })
    .sort((a, b) => sortBy === 'likes' ? b.likes - a.likes : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, game: selectedGame, category: selectedCategory, tags: selectedTags.map(t => t.name), createdAt: new Date().toISOString(), createdBy: Number(user.id) }),
      });
      if (!response.ok) throw new Error();
      const saved = await response.json();
      setDiscussions([{ ...saved, author: { name: user.username || 'Anonyme', avatar: user.avatar || '', cosmetics: [] }, views: 0, likes: 0, replies: 0, tags: selectedTags }, ...discussions]);
      setTitle(''); setContent(''); setSelectedGame(''); setSelectedCategory(''); setSelectedTags([]); setNewTagName('');
      setShowForm(false);
    } catch {
      alert('Erreur lors de la création de la discussion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (discussionId: number) => {
    if (likedDiscussions.includes(discussionId)) return;
    const res = await fetch(`/api/topics/${discussionId}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user?.id }) });
    if (res.ok) {
      setDiscussions(prev => prev.map(d => Number(d.id) === discussionId ? { ...d, likes: d.likes + 1 } : d));
      setLikedDiscussions(prev => [...prev, discussionId]);
    }
  };

  const addTag = () => {
    if (!newTagName.trim()) return;
    const newTag: Tag = { id: `new-${Date.now()}`, name: newTagName.trim(), color: '#A78BFA' };
    if (!selectedTags.some(t => t.id === newTag.id)) setSelectedTags([...selectedTags, newTag]);
    setNewTagName('');
  };

  if (loading) return <PageLoader message="Chargement des discussions..." />;

  return (
    <div style={{ paddingTop: 16, paddingBottom: 100, fontFamily: 'var(--q-font)', color: 'var(--q-text)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ fontFamily: 'var(--q-display)', color: 'var(--q-text)' }}>
              <MessageSquare size={26} aria-hidden="true" style={{ color: 'var(--q-accent)' }} />
              Discussions
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--q-text2)' }}>Échange avec la communauté</p>
          </div>
        </div>
        {user ? (
          <button onClick={() => setShowForm(f => !f)} aria-expanded={showForm} className="q-press flex items-center gap-1.5 px-4 py-2 rounded-full text-white font-bold text-sm"
            style={{ background: showForm ? 'var(--q-text3)' : 'var(--q-accent)', boxShadow: showForm ? 'none' : '0 4px 12px rgba(167,139,250,0.40)', transition: 'all 0.15s' }}>
            {showForm ? <><X size={15} aria-hidden="true" /> Annuler</> : <><Plus size={15} aria-hidden="true" /><span className="hidden sm:inline">Nouvelle discussion</span></>}
          </button>
        ) : (
          <Link to="/login" className="q-press flex items-center gap-1.5 px-4 py-2 rounded-full text-white font-bold text-sm"
            style={{ background: 'var(--q-accent)', boxShadow: '0 4px 12px rgba(167,139,250,0.40)' }}>
            <Plus size={15} aria-hidden="true" /> Participer
          </Link>
        )}
      </div>

      {/* ── Formulaire création ── */}
      {showForm && (
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
          <h2 className="font-bold mb-4" style={{ fontSize: 16, fontFamily: 'var(--q-display)', color: 'var(--q-text)' }}>Nouvelle discussion</h2>
          <form onSubmit={handleCreateDiscussion} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Titre</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Donne un titre à ta discussion" style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--q-accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--q-line)'} />
            </div>
            <div>
              <label style={labelStyle}>Contenu</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} required rows={4} placeholder="Décris ta discussion..."
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--q-accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--q-line)'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Jeu</label>
                <select value={selectedGame} onChange={e => setSelectedGame(e.target.value)} required style={selectStyle}>
                  <option value="">Sélectionner...</option>
                  {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Catégorie</label>
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} required style={selectStyle}>
                  <option value="">Sélectionner...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Tags</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {selectedTags.map(tag => (
                  <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }}>
                    {tag.name}
                    <button type="button" aria-label={`Retirer le tag ${tag.name}`} onClick={() => setSelectedTags(prev => prev.filter(t => t.id !== tag.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--q-accent)', padding: 0, display: 'flex' }}><X size={12} aria-hidden="true" /></button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <label htmlFor="new-tag-input" className="sr-only">Ajouter un tag</label>
                <input id="new-tag-input" type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Ajouter un tag..." style={{ ...inputStyle, flex: 1 }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--q-accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--q-line)'} />
                <button type="button" onClick={addTag} aria-label="Ajouter le tag" className="q-press" style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--q-accent-soft)', color: 'var(--q-accent)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setShowForm(false)} className="q-press" style={{ padding: '10px 18px', borderRadius: 12, background: 'var(--q-bg)', border: '1px solid var(--q-line)', color: 'var(--q-text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Annuler
              </button>
              <button type="submit" disabled={submitting} className="q-press" style={{ padding: '10px 20px', borderRadius: 12, background: 'var(--q-accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.7 : 1 }}>
                <Send size={14} aria-hidden="true" /> Publier
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Recherche + filtres ── */}
      <div className="rounded-2xl p-3 mb-3" style={{ background: 'var(--q-chrome)', boxShadow: 'var(--q-shadow)', border: '1px solid var(--q-line)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={15} aria-hidden="true" style={{ color: 'var(--q-text3)', flexShrink: 0 }} />
            <label htmlFor="discussions-search" className="sr-only">Rechercher une discussion</label>
            <input id="discussions-search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Rechercher une discussion..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--q-text)', fontFamily: 'var(--q-font)' }} />
            {searchTerm && <button onClick={() => setSearchTerm('')} aria-label="Effacer la recherche" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--q-text3)', display: 'flex' }}><X size={14} aria-hidden="true" /></button>}
          </div>
          <button onClick={() => setShowFilters(f => !f)} aria-expanded={showFilters} className="q-press" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: showFilters ? 'var(--q-accent)' : 'var(--q-bg)', color: showFilters ? '#fff' : 'var(--q-text2)', transition: 'all 0.15s' }}>
            <SlidersHorizontal size={13} aria-hidden="true" /> Filtres
          </button>
        </div>
        {showFilters && (
          <div style={{ paddingTop: 12, marginTop: 12, borderTop: '1px solid var(--q-line)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            <div>
              <label style={labelStyle}>Jeu</label>
              <select value={filterGame} onChange={e => setFilterGame(e.target.value)} style={selectStyle}>
                <option value="ALL">Tous les jeux</option>
                {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Catégorie</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={selectStyle}>
                <option value="ALL">Toutes</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Trier par</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as 'date' | 'likes')} style={selectStyle}>
                <option value="date">Plus récent</option>
                <option value="likes">Plus de likes</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Liste des discussions ── */}
      {filteredDiscussions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 18px', color: 'var(--q-text3)' }}>
          <div style={{ marginBottom: 12 }}><MessageSquare size={44} style={{ margin: '0 auto', opacity: 0.3 }} aria-hidden="true" /></div>
          <p style={{ fontSize: 14 }}>{searchTerm ? 'Aucune discussion trouvée.' : 'Soyez le premier à lancer une discussion !'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredDiscussions.map(discussion => {
            const liked = likedDiscussions.includes(Number(discussion.id));
            const titleCosmetic = getEquipped(discussion.author.cosmetics ?? [], 'TITLE');
            return (
              <button key={discussion.id} onClick={() => navigate(user ? `/tchat/${discussion.id}` : '/login')}
                aria-label={`Ouvrir la discussion : ${discussion.title}`}
                style={{ width: '100%', textAlign: 'left', background: 'var(--q-chrome)', border: '1px solid var(--q-line)', borderRadius: 20, padding: '14px 16px', cursor: 'pointer', boxShadow: 'var(--q-shadow)', transition: 'opacity 0.15s' }}
                className="q-press">
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <UserAvatar avatar={discussion.author.avatar} username={discussion.author.name || 'A'} cosmetics={discussion.author.cosmetics ?? []} size="md" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--q-text)', lineHeight: 1.3 }}>{discussion.title}</h3>
                      <ChevronRight size={16} aria-hidden="true" style={{ color: 'var(--q-text3)', flexShrink: 0, marginTop: 2 }} />
                    </div>
                    {/* Author + date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--q-text2)', fontWeight: 600 }}>{discussion.author.name}</span>
                      {titleCosmetic && (
                        <span className={`text-xs font-semibold ${TITLE_CLASSES[titleCosmetic.cosmetic.rarity] ?? ''}`}>
                          {titleCosmetic.cosmetic.name.replace(/^Titre\s*:\s*/i, '')}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--q-text3)' }}>· {formatDate(discussion.createdAt)}</span>
                    </div>
                    {/* Preview */}
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--q-text2)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {discussion.content}
                    </p>
                    {/* Tags + badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {discussion.game && (
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(56,189,248,0.15)', color: '#38BDF8' }}>{discussion.game}</span>
                      )}
                      {discussion.category && (
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'var(--q-accent-soft)', color: 'var(--q-accent-deep)' }}>{discussion.category}</span>
                      )}
                      {discussion.tags.map((tag, idx) => (
                        <span key={tag.id || tag.name + idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: `${tag.color}22`, color: tag.color }}>
                          <TagIcon size={10} aria-hidden="true" />{tag.name}
                        </span>
                      ))}
                    </div>
                    {/* Stats */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <button onClick={e => { e.stopPropagation(); handleLike(Number(discussion.id)); }} disabled={liked}
                        aria-label={`${liked ? 'Vous avez aimé cette discussion' : 'Liker cette discussion'} — ${discussion.likes} like${discussion.likes !== 1 ? 's' : ''}`}
                        aria-pressed={liked}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: liked ? 'not-allowed' : 'pointer', padding: 0, fontSize: 12, fontWeight: 600, color: liked ? 'var(--q-accent)' : 'var(--q-text3)', transition: 'color 0.15s' }}>
                        <ThumbsUp size={14} aria-hidden="true" fill={liked ? 'var(--q-accent)' : 'none'} stroke={liked ? 'var(--q-accent)' : 'currentColor'} />
                        <span aria-hidden="true">{discussion.likes}</span>
                      </button>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--q-text3)', fontWeight: 600 }}>
                        <MessageSquare size={14} aria-hidden="true" /><span aria-label={`${discussion.replies} réponse${discussion.replies !== 1 ? 's' : ''}`}>{discussion.replies}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--q-text3)', fontWeight: 600 }}>
                        <Clock size={14} aria-hidden="true" />{formatDate(discussion.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DiscussionsPage;
