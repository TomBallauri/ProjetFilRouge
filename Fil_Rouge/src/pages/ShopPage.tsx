import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, CheckCircle, SlidersHorizontal, Search, X, CircleDollarSign, Frame, PanelTop, Award, Tag, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import BackButton from '../components/BackButton';
import { usePageTitle } from '../hooks/usePageTitle';
import PageLoader from '../components/PageLoader';
import { FRAME_CLASSES, BANNER_CLASSES, TITLE_CLASSES } from '../lib/cosmetics';
import type { User } from '../types/User';

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

// Le libellé affiché vient de common.rarity.<clé> / shop.type.<clé> (voir usages ci-dessous),
// pour rester traduisible — seule la présentation (couleurs, icônes) reste ici.
const RARITY: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  COMMON:    { color: 'text-gray-500 dark:text-gray-400',    bg: 'bg-gray-100 dark:bg-gray-700',          border: 'border-gray-300 dark:border-gray-600', glow: '' },
  RARE:      { color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20',         border: 'border-blue-400',                      glow: 'hover:shadow-blue-200 dark:hover:shadow-blue-900' },
  EPIC:      { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20',    border: 'border-purple-400',                    glow: 'hover:shadow-purple-200 dark:hover:shadow-purple-900' },
  LEGENDARY: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20',   border: 'border-yellow-400',                    glow: 'hover:shadow-yellow-200 dark:hover:shadow-yellow-900' },
};

const TYPE: Record<string, { icon: LucideIcon }> = {
  AVATAR_FRAME: { icon: Frame },
  BANNER:       { icon: PanelTop },
  BADGE:        { icon: Award },
  TITLE:        { icon: Tag },
};

const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const TYPES    = ['AVATAR_FRAME', 'BANNER', 'BADGE', 'TITLE'];

function resolveUrl(url?: string): string {
  // /uploads/... est proxifié vers le backend (vite en dev, vercel.json en prod) —
  // pas besoin de préfixer une origine en dur.
  return url ?? '';
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
      <div className={`w-full min-h-14 rounded-lg my-2 py-2 flex flex-col items-center justify-center gap-1 ${r.bg}`}>
        <div className="w-7 h-7 rounded-full bg-gray-400/60 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">A</div>
        <span className={`text-xs font-bold text-center leading-tight px-2 ${titleClass}`}>{titleText}</span>
      </div>
    );
  }

  if (cosmetic.type === 'BADGE') {
    return (
      <div className={`w-16 h-16 mx-auto my-2 rounded-full flex items-center justify-center ${r.bg}`}>
        <Award size={28} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={`w-16 h-16 mx-auto my-2 rounded-full flex items-center justify-center ${r.bg}`}>
      <Package size={22} aria-hidden="true" />
    </div>
  );
};

type CosmeticCardProps = {
  cosmetic: Cosmetic;
  alreadyOwned: boolean;
  canAfford: boolean;
  isLoading: boolean;
  user: User | null;
  darkMode: boolean;
  card: string;
  onBuy: (c: Cosmetic) => void;
  onLogin: () => void;
};

const CosmeticCard: React.FC<CosmeticCardProps> = ({ cosmetic, alreadyOwned, canAfford, isLoading, user, darkMode, card, onBuy, onLogin }) => {
  const { t } = useTranslation();
  const r = RARITY[cosmetic.rarity] ?? RARITY.COMMON;
  const typeMeta = TYPE[cosmetic.type] ?? { icon: Package };
  const typeLabel = TYPE[cosmetic.type] ? t(`shop.type.${cosmetic.type}`) : cosmetic.type;

  const actionZone = () => {
    if (alreadyOwned) return (
      <div className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold">
        <CheckCircle size={13} aria-hidden="true" /> {t('shop.owned')}
      </div>
    );
    if (!user) return (
      <button onClick={onLogin} className="w-full py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors active:scale-95">
        {t('shop.login')}
      </button>
    );
    const btnColor = canAfford ? 'bg-pink-600 hover:bg-pink-700' : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed';
    const buyLabel = canAfford ? t('shop.buy') : t('shop.insufficient');
    return (
      <button onClick={() => onBuy(cosmetic)} disabled={!canAfford || isLoading}
        className={`w-full py-1.5 rounded-lg text-white text-xs font-bold transition-all active:scale-95 ${btnColor} disabled:opacity-60`}>
        {isLoading ? '...' : buyLabel}
      </button>
    );
  };

  return (
    <div className={`${card} border-2 ${r.border} ${r.glow} rounded-xl p-3 flex flex-col gap-2 hover:shadow-lg transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.bg} ${r.color}`}>{t(`common.rarity.${cosmetic.rarity}`)}</span>
        <typeMeta.icon size={16} aria-hidden="true" />
      </div>
      <CosmeticPreview cosmetic={cosmetic} />
      <div className="text-center">
        <p className="font-bold text-sm leading-tight">{cosmetic.name}</p>
        <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{typeLabel}</p>
      </div>
      <div className={`pt-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'} mt-auto`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1"><CircleDollarSign size={13} aria-hidden="true" /> {cosmetic.price}</span>
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
  const { t, i18n } = useTranslation();
  usePageTitle(t('shop.pageTitle'));
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCosmetics(); if (user) fetchOwned(); }, [i18n.language]);

  const fetchCosmetics = async () => {
    setLoading(true);
    try {
      const langParam = i18n.language !== 'fr' ? `?lang=${i18n.language}` : '';
      const r = await fetch(`/api/cosmetics${langParam}`);
      setCosmetics(await r.json());
    }
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
    if ((user.coins ?? 0) < c.price) { showNotif(t('shop.missingCoins', { amount: c.price - (user.coins ?? 0) }), 'error'); return; }
    setBuyLoading(c.id);
    try {
      const res = await fetch(`/api/cosmetics/${c.id}/buy`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || t('shop.error'), 'error'); return; }
      if (data.user) setUser(data.user);
      await fetchOwned();
      showNotif(t('shop.purchased', { name: c.name, price: c.price }), 'success');
    } finally { setBuyLoading(null); }
  };

  const filtered = applyFilters(cosmetics, search, filterType, filterRarity);

  const activeFilters = [filterType, filterRarity].filter(Boolean).length;
  const card = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const filterBtnInactive = darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600';
  const filterBtnClass = filtersOpen || activeFilters > 0 ? 'bg-pink-600 text-white' : filterBtnInactive;
  // Style des puces de filtre inactives (type et rareté) — un seul calcul réutilisé
  // partout au lieu d'un ternaire dark/light dupliqué à chaque bouton.
  const inactiveChipClass = darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200';

  let content: React.ReactNode;
  if (loading) {
    content = <PageLoader message={t('shop.loading')} />;
  } else if (filtered.length === 0) {
    content = (
      <div className="text-center py-16 text-gray-400">
        <ShoppingBag size={44} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
        <p>{t('shop.noItems')}</p>
      </div>
    );
  } else {
    content = (
      <div data-tour="shop-items" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
    );
  }

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
              {t('shop.pageTitle')}
            </h1>
            <p className={`text-sm mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('shop.subtitle')}
            </p>
          </div>
        </div>
        {user && (
          <div data-tour="page-boutique" style={{ display: 'flex', alignItems: 'center', gap: 6,
            background: 'linear-gradient(135deg,#FACC15,#FB923C)',
            color: '#fff',
            padding: '7px 12px', borderRadius: 999, fontWeight: 700, fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            boxShadow: '0 4px 12px rgba(251,146,60,0.40)' }}>
            <CircleDollarSign size={14} aria-hidden="true" /> {(user.coins ?? 0).toLocaleString(i18n.language)}
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
            placeholder={t('shop.searchPlaceholder')}
            aria-label={t('shop.searchPlaceholder')}
            className={`flex-1 bg-transparent text-sm outline-none min-w-0 ${darkMode ? 'placeholder-gray-500' : 'placeholder-gray-400'}`}
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label={t('shop.clearSearch')} className="text-gray-400 hover:text-gray-600">
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold flex-shrink-0 transition-colors ${filterBtnClass}`}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          {t('shop.filters')}{activeFilters > 0 && ` (${activeFilters})`}
        </button>
      </div>

      {/* Filtres dépliables */}
      {filtersOpen && (
        <div className={`${card} border rounded-xl p-3 mb-3 space-y-3`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-gray-400">{t('shop.typeLabel')}</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFilterType('')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${!filterType ? 'bg-pink-600 text-white' : inactiveChipClass}`}>
                {t('shop.allTypes')}
              </button>
              {TYPES.map(ty => {
                const TypeIcon = TYPE[ty]?.icon ?? Package;
                return (
                  <button key={ty} onClick={() => setFilterType(ty === filterType ? '' : ty)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${filterType === ty ? 'bg-pink-600 text-white' : inactiveChipClass}`}>
                    <TypeIcon size={13} aria-hidden="true" /> {t(`shop.type.${ty}`)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2 text-gray-400">{t('shop.rarityLabel')}</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFilterRarity('')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${!filterRarity ? 'bg-pink-600 text-white' : inactiveChipClass}`}>
                {t('shop.allRarities')}
              </button>
              {RARITIES.map(r => {
                const cfg = RARITY[r];
                return (
                  <button key={r} onClick={() => setFilterRarity(r === filterRarity ? '' : r)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${filterRarity === r ? `${cfg.bg} ${cfg.color} border ${cfg.border}` : inactiveChipClass}`}>
                    {t(`common.rarity.${r}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {content}
    </div>
  );
};

export default ShopPage;
