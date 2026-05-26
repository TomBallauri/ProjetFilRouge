import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, CheckCircle, SlidersHorizontal, Search, X } from 'lucide-react';
import BackButton from '../components/BackButton';
import { usePageTitle } from '../hooks/usePageTitle';
import { FRAME_CLASSES, BANNER_CLASSES, TITLE_CLASSES } from '../lib/cosmetics';

type Cosmetic = {
  id: number;
  name: string;
  description: string;
  type: string;
  imageUrl?: string;
  price: number;
  rarity: string;
};

type UserCosmetic = { cosmeticId: number };

const RARITY: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  COMMON:    { label: 'Commun',     color: 'text-gray-500 dark:text-gray-400',    bg: 'bg-gray-100 dark:bg-gray-700',          border: 'border-gray-300 dark:border-gray-600', glow: '' },
  RARE:      { label: 'Rare',       color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20',         border: 'border-blue-400',                      glow: 'hover:shadow-blue-200 dark:hover:shadow-blue-900' },
  EPIC:      { label: 'Épique',     color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20',    border: 'border-purple-400',                    glow: 'hover:shadow-purple-200 dark:hover:shadow-purple-900' },
  LEGENDARY: { label: 'Légendaire', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20',   border: 'border-yellow-400',                    glow: 'hover:shadow-yellow-200 dark:hover:shadow-yellow-900' },
};

const TYPE: Record<string, { label: string; emoji: string }> = {
  AVATAR_FRAME: { label: "Cadre d'avatar", emoji: '🖼️' },
  BANNER:       { label: 'Bannière',        emoji: '🏳️' },
  BADGE:        { label: 'Badge',           emoji: '🏅' },
  TITLE:        { label: 'Titre',           emoji: '📛' },
};

const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const TYPES    = ['AVATAR_FRAME', 'BANNER', 'BADGE', 'TITLE'];

const BACKEND_URL = 'http://localhost:3001';
function resolveUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return `${BACKEND_URL}${url}`;
  return url;
}

function applyFilters(cosmetics: Cosmetic[], search: string, type: string, rarity: string): Cosmetic[] {
  const q = search.toLowerCase();
  return cosmetics.filter(c => {
    if (type && c.type !== type) return false;
    if (rarity && c.rarity !== rarity) return false;
    if (q && !c.name.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) return false;
    return true;
  });
}

const CosmeticPreview: React.FC<{ cosmetic: Cosmetic }> = ({ cosmetic }) => {
  const r = RARITY[cosmetic.rarity] ?? RARITY.COMMON;

  if (cosmetic.type === 'AVATAR_FRAME') {
    const frameClass = FRAME_CLASSES[cosmetic.rarity] ?? '';
    if (cosmetic.imageUrl) {
      const frameInset = 5;
      return (
        <div className="relative w-16 h-16 mx-auto my-2">
          <div className="absolute rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xl font-bold"
            style={{ inset: frameInset }}>
            A
          </div>
          <img src={resolveUrl(cosmetic.imageUrl)} alt="" aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none select-none z-10"
            style={{ objectFit: 'fill' }} />
        </div>
      );
    }
    return (
      <div className={`w-16 h-16 mx-auto my-2 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xl font-bold ${frameClass}`}>
        A
      </div>
    );
  }

  if (cosmetic.type === 'BANNER') {
    const bannerClass = BANNER_CLASSES[cosmetic.rarity] ?? 'bg-gray-400';
    return (
      <div
        className={`w-full h-14 rounded-lg my-2 overflow-hidden ${cosmetic.imageUrl ? '' : bannerClass}`}
        style={cosmetic.imageUrl ? { backgroundImage: `url(${cosmetic.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      />
    );
  }

  if (cosmetic.type === 'TITLE') {
    const titleClass = TITLE_CLASSES[cosmetic.rarity] ?? 'text-gray-400';
    const titleText = cosmetic.name.replace(/^Titre\s*:\s*/i, '');
    return (
      <div className={`w-full h-14 rounded-lg my-2 flex flex-col items-center justify-center gap-1 ${r.bg}`}>
        <div className="w-7 h-7 rounded-full bg-gray-400/60 flex items-center justify-center text-white text-xs font-bold">A</div>
        <span className={`text-xs font-bold ${titleClass}`}>{titleText}</span>
      </div>
    );
  }

  if (cosmetic.type === 'BADGE') {
    return (
      <div className={`w-16 h-16 mx-auto my-2 rounded-full flex items-center justify-center text-4xl ${r.bg}`}>
        🏅
      </div>
    );
  }

  return (
    <div className={`w-16 h-16 mx-auto my-2 rounded-full flex items-center justify-center text-2xl ${r.bg}`}>
      🎁
    </div>
  );
};

type CosmeticCardProps = {
  cosmetic: Cosmetic;
  alreadyOwned: boolean;
  canAfford: boolean;
  isLoading: boolean;
  user: ReturnType<typeof useStore>['user'];
  darkMode: boolean;
  card: string;
  onBuy: (c: Cosmetic) => void;
  onLogin: () => void;
};

const CosmeticCard: React.FC<CosmeticCardProps> = ({ cosmetic, alreadyOwned, canAfford, isLoading, user, darkMode, card, onBuy, onLogin }) => {
  const r = RARITY[cosmetic.rarity] ?? RARITY.COMMON;
  const t = TYPE[cosmetic.type] ?? { label: cosmetic.type, emoji: '🎁' };

  const actionZone = () => {
    if (alreadyOwned) return (
      <div className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold">
        <CheckCircle size={13} aria-hidden="true" /> Possédé
      </div>
    );
    if (!user) return (
      <button onClick={onLogin} className="w-full py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors active:scale-95">
        Connexion
      </button>
    );
    const btnColor = canAfford ? 'bg-pink-600 hover:bg-pink-700' : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed';
    return (
      <button onClick={() => onBuy(cosmetic)} disabled={!canAfford || isLoading}
        className={`w-full py-1.5 rounded-lg text-white text-xs font-bold transition-all active:scale-95 ${btnColor} disabled:opacity-60`}>
        {isLoading ? '...' : canAfford ? 'Acheter' : 'Insuffisant'}
      </button>
    );
  };

  return (
    <div className={`${card} border-2 ${r.border} ${r.glow} rounded-xl p-3 flex flex-col gap-2 hover:shadow-lg transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.bg} ${r.color}`}>{r.label}</span>
        <span className="text-base">{t.emoji}</span>
      </div>
      <CosmeticPreview cosmetic={cosmetic} />
      <div className="text-center">
        <p className="font-bold text-sm leading-tight">{cosmetic.name}</p>
        <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.label}</p>
      </div>
      <div className={`pt-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'} mt-auto`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-sm text-yellow-600 dark:text-yellow-400">🪙 {cosmetic.price}</span>
          {!canAfford && !alreadyOwned && user && (
            <span className="text-xs text-red-400">-{cosmetic.price - (user.coins ?? 0)}</span>
          )}
        </div>
        {actionZone()}
      </div>
    </div>
  );
};

const ShopPage: React.FC = () => {
  usePageTitle('Boutique');
  const { user, setUser, darkMode } = useStore();
  const navigate = useNavigate();
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [owned, setOwned] = useState<UserCosmetic[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buyLoading, setBuyLoading] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const token = localStorage.getItem('token');

  useEffect(() => { fetchCosmetics(); if (user) fetchOwned(); }, []);

  const fetchCosmetics = async () => {
    setLoading(true);
    try { const r = await fetch('/api/cosmetics'); setCosmetics(await r.json()); }
    finally { setLoading(false); }
  };

  const fetchOwned = async () => {
    if (!token) return;
    try { const r = await fetch('/api/users/me/cosmetics', { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); setOwned(Array.isArray(d) ? d : []); }
    catch { setOwned([]); }
  };

  const isOwned = (id: number) => owned.some(o => o.cosmeticId === id);

  const showNotif = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleBuy = async (c: Cosmetic) => {
    if (!user) { navigate('/login'); return; }
    if ((user.coins ?? 0) < c.price) { showNotif(`Il te manque ${c.price - (user.coins ?? 0)} coins !`, 'error'); return; }
    setBuyLoading(c.id);
    try {
      const res = await fetch(`/api/cosmetics/${c.id}/buy`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || 'Erreur', 'error'); return; }
      if (data.user) setUser(data.user);
      await fetchOwned();
      showNotif(`"${c.name}" acheté ! -${c.price} 🪙`, 'success');
    } finally { setBuyLoading(null); }
  };

  const filtered = applyFilters(cosmetics, search, filterType, filterRarity);

  const activeFilters = [filterType, filterRarity].filter(Boolean).length;
  const card = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const filterBtnInactive = darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600';
  const filterBtnClass = filtersOpen || activeFilters > 0 ? 'bg-pink-600 text-white' : filterBtnInactive;

  return (
    <div className={`px-3 py-4 md:p-6 min-h-screen ${darkMode ? 'text-white' : 'text-gray-900'}`}>

      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <ShoppingBag className="text-pink-500" size={26} aria-hidden="true" />
              Boutique
            </h1>
            <p className={`text-sm mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Dépense tes coins pour te démarquer
            </p>
          </div>
        </div>
        {user && (
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm ${darkMode ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-50 text-yellow-700'}`}>
            🪙 {(user.coins ?? 0).toLocaleString()}
          </div>
        )}
      </div>

      {/* Barre recherche + filtres */}
      <div className={`${card} border rounded-xl p-3 mb-3 flex gap-2`}>
        <div className="flex items-center gap-2 flex-1">
          <Search size={16} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un article..."
            aria-label="Rechercher un article"
            className={`flex-1 bg-transparent text-sm outline-none min-w-0 ${darkMode ? 'placeholder-gray-500' : 'placeholder-gray-400'}`}
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Effacer la recherche" className="text-gray-400 hover:text-gray-600">
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold flex-shrink-0 transition-colors ${filterBtnClass}`}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Filtres{activeFilters > 0 && ` (${activeFilters})`}
        </button>
      </div>

      {/* Filtres dépliables */}
      {filtersOpen && (
        <div className={`${card} border rounded-xl p-3 mb-3 space-y-3`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-gray-400">Type</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFilterType('')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${!filterType ? 'bg-pink-600 text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Tous
              </button>
              {TYPES.map(t => (
                <button key={t} onClick={() => setFilterType(t === filterType ? '' : t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${filterType === t ? 'bg-pink-600 text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {TYPE[t]?.emoji} {TYPE[t]?.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-gray-400">Rareté</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFilterRarity('')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${!filterRarity ? 'bg-pink-600 text-white' : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Toutes
              </button>
              {RARITIES.map(r => {
                const cfg = RARITY[r];
                return (
                  <button key={r} onClick={() => setFilterRarity(r === filterRarity ? '' : r)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${filterRarity === r ? `${cfg.bg} ${cfg.color} border ${cfg.border}` : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingBag size={44} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>Aucun article disponible.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(cosmetic => (
            <CosmeticCard
              key={cosmetic.id}
              cosmetic={cosmetic}
              alreadyOwned={isOwned(cosmetic.id)}
              canAfford={(user?.coins ?? 0) >= cosmetic.price}
              isLoading={buyLoading === cosmetic.id}
              user={user}
              darkMode={darkMode}
              card={card}
              onBuy={handleBuy}
              onLogin={() => navigate('/login')}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ShopPage;
