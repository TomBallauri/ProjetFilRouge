import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { MessageSquare, Search, Plus, X, Filter, ThumbsUp, Clock, Tag as TagIcon, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Discussion {
  id: string;
  title: string;
  content: string;
  author: {
    name: string;
    avatar: string;
  };
  game: string;
  category: string;
  createdAt: string;
  views: number;
  likes: number;
  replies: number;
  tags: Tag[];
}

const DiscussionsPage: React.FC = () => {
  const { user, darkMode } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGame, setFilterGame] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'likes'>('date');
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedGame, setSelectedGame] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');

  const [likedDiscussions, setLikedDiscussions] = useState<number[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);

  const games = ["Valorant", "League of Legends", "CS2", "Fortnite", "Apex Legends"];
  const categories = ["Guides", "Discussion", "Question", "Actualités", "Recherche d'équipe"];

  const resetForm = () => {
    setTitle('');
    setContent('');
    setSelectedGame('');
    setSelectedCategory('');
    setSelectedTags([]);
    setNewTagName('');
  };

  const addTag = (tag: Tag) => {
    if (!selectedTags.some(t => t.id === tag.id)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const removeTag = (tagId: string) => {
    setSelectedTags(selectedTags.filter(tag => tag.id !== tagId));
  };

  const addNewTag = () => {
    if (!newTagName.trim()) return;
    const newTag: Tag = {
      id: `new-${Date.now()}`,
      name: newTagName,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    };
    addTag(newTag);
    setNewTagName('');
  };

  const filteredDiscussions = discussions
    .filter(discussion => {
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !search ||
        discussion.title.toLowerCase().includes(search) ||
        discussion.game.toLowerCase().includes(search) ||
        discussion.category.toLowerCase().includes(search) ||
        (discussion.tags && discussion.tags.some(tag => tag.name.toLowerCase().includes(search)));
      const matchesGame = filterGame === 'ALL' || discussion.game === filterGame;
      const matchesCategory = filterCategory === 'ALL' || discussion.category === filterCategory;
      return matchesSearch && matchesGame && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'likes') {
        return b.likes - a.likes;
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  if (!user) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold mb-4">Discussions</h1>
        <p className="mb-6">Connectez-vous pour participer aux discussions.</p>
        <a 
          href="/login" 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Connexion
        </a>
      </div>
    );
  }

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      alert("Utilisateur non défini !");
      return;
    }

    const newDiscussion = {
      title,
      content,
      game: selectedGame,
      category: selectedCategory,
      tags: selectedTags.map(tag => tag.name),
      createdAt: new Date().toISOString(),
      createdBy: Number(user?.id),
    };

    try {
      const response = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDiscussion)
      });
      if (!response.ok) throw new Error('Erreur lors de la création');
      const savedDiscussion = await response.json();

      setDiscussions([
        {
          ...savedDiscussion,
          author: {
            name: user?.username || "Anonyme",
            avatar: user?.avatar || "https://thispersondoesnotexist.com/"
          },
          views: 0,
          likes: 0,
          replies: 0,
          tags: selectedTags,
        },
        ...discussions
      ]);
      resetForm();
      setShowForm(false);
    } catch (error) {
      alert('Erreur lors de la création de la discussion');
    }
  };

  useEffect(() => {
    fetch('/api/discussions')
      .then(res => res.json())
      .then(data => {
        const mapped = data.map((d: any) => ({
          ...d,
          author: d.user
            ? {
                name: d.user.username || d.user.name || "Anonyme",
                avatar: d.user.avatar || "https://thispersondoesnotexist.com/"
              }
            : {
                name: "Anonyme",
                avatar: "https://thispersondoesnotexist.com/"
              },
          tags: Array.isArray(d.tags)
            ? d.tags
            : typeof d.tags === "string"
              ? JSON.parse(d.tags)
              : [],
          views: d.views || 0,
          likes: d.likes || 0,
          replies: d._count?.posts ?? 0,
        }));
        setDiscussions(mapped);
      });
  }, []);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleLike = async (discussionId: number) => {
    if (likedDiscussions.includes(discussionId)) return;
    const res = await fetch(`/api/topics/${discussionId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    if (res.ok) {
      setDiscussions(discussions =>
        discussions.map(d =>
          Number(d.id) === discussionId
            ? { ...d, likes: d.likes + 1 }
            : d
        )
      );
      setLikedDiscussions([...likedDiscussions, discussionId]);
    }
  };

  return (
    <div className={`p-4 md:p-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-0 inline-block border-b-4 border-gray-300 pb-2">
          Discussions
        </h1>
        <button
          onClick={() => {
            if (!user) {
              navigate('/login');
            } else {
              setShowForm(!showForm);
            }
          }}
          className="flex items-center justify-center w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {showForm ? (
            <>
              <X size={16} className="mr-2" />
              Annuler
            </>
          ) : (
            <>
              <Plus size={16} className="mr-2" />
              Nouvelle discussion
            </>
          )}
        </button>
      </div>
      {showForm && (
        <div className={`mb-6 p-4 md:p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <h2 className="text-lg md:text-xl font-semibold mb-4">Créer une nouvelle discussion</h2>
          <form onSubmit={handleCreateDiscussion} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Titre</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full px-3 py-2 rounded-md ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contenu</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className={`w-full px-3 py-2 rounded-md ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Jeu</label>
                <select
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md ${
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  required
                >
                  <option value="">Sélectionnez un jeu</option>
                  {games.map((game) => (
                    <option key={game} value={game}>
                      {game}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Catégorie</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md ${
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  required
                >
                  <option value="">Sélectionnez une catégorie</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="flex items-center px-2 py-1 rounded-full text-sm"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => removeTag(tag.id)}
                      className="ml-1 hover:text-red-500 focus:outline-none"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Ajouter un nouveau tag"
                    className={`w-full px-3 py-2 rounded-md ${
                      darkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  <button
                    type="button"
                    onClick={addNewTag}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col md:flex-row justify-end space-y-2 md:space-y-0 md:space-x-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className={`w-full md:w-auto px-4 py-2 rounded ${
                  darkMode
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                } transition-colors`}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <Send size={16} className="mr-2" />
                Publier
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center mb-4">
          <div className="relative flex-grow mb-4 md:mb-0 md:mr-4">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher des discussions..."
              className={`w-full pl-10 pr-3 py-2 rounded-md ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-3 py-2 rounded ${
              showFilters 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                : darkMode 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } transition-colors`}
          >
            <Filter size={16} className="mr-2" />
            Filtres
          </button>
        </div>
        {showFilters && (
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} mb-4`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Jeu</label>
                <select
                  value={filterGame}
                  onChange={(e) => setFilterGame(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="ALL">Tous les jeux</option>
                  {games.map(game => (
                    <option key={game} value={game}>{game}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Catégorie</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="ALL">Toutes les catégories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Trier par</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as 'date' | 'likes')}
                  className={`w-full px-3 py-2 rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="date">Plus récent</option>
                  <option value="likes">Plus de likes</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-4">
        {filteredDiscussions.map((discussion) => (
          <div
            key={discussion.id}
            onClick={() => {
              if (!user) {
                navigate('/login');
              } else {
                navigate(`/tchat/${discussion.id}`);
              }
            }}
            role="button"
            tabIndex={0}
            className={`w-full text-left ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            } rounded-lg shadow p-6 transition-all duration-200 hover:shadow-lg cursor-pointer`}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (!user) {
                  navigate('/login');
                } else {
                  navigate(`/tchat/${discussion.id}`);
                }
              }
            }}
          >
            <div className="flex items-start space-x-4">
              <img
                src={discussion.author?.avatar || "https://thispersondoesnotexist.com/"}
                alt={discussion.author?.name || "Anonyme"}
                className="w-10 h-10 rounded-full"
              />
              <div className="flex-grow">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{discussion.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      by {discussion.author.name} • {formatDate(discussion.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 mr-2">
                    <span className={`px-2 py-1 rounded-full text-sm ${
                      darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {discussion.game}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-sm ${
                      darkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {discussion.category}
                    </span>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-4">{discussion.content}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {discussion.tags.map((tag, idx) => (
                    <span
                      key={tag.id || tag.name + idx}
                      className="flex items-center px-2 py-1 rounded-full text-sm"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color
                      }}
                    >
                      <TagIcon size={12} className="mr-1" />
                      {tag.name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center">
                    <button
                      disabled={likedDiscussions.includes(Number(discussion.id))}
                      onClick={e => {
                        e.stopPropagation();
                        handleLike(Number(discussion.id));
                      }}
                      className={`flex items-center transition ${
                        likedDiscussions.includes(Number(discussion.id))
                          ? 'text-blue-600 opacity-100 cursor-not-allowed'
                          : 'hover:text-blue-600'
                      }`}
                      aria-label="Liker"
                    >
                      <ThumbsUp
                        size={16}
                        className="mr-1"
                        fill={likedDiscussions.includes(Number(discussion.id)) ? "#2563eb" : "none"}
                        stroke={likedDiscussions.includes(Number(discussion.id)) ? "#2563eb" : "currentColor"}
                      />
                      <span>{discussion.likes}</span>
                    </button>
                  </div>
                  <div className="flex items-center">
                    <MessageSquare size={16} className="mr-1" />
                    <span>{discussion.replies}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock size={16} className="ml(1" />
                    <span>{formatDate(discussion.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiscussionsPage;