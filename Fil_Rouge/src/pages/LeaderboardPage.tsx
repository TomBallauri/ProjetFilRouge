import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { Trophy, Medal } from 'lucide-react';
import { getEquipped, TITLE_CLASSES } from '../lib/cosmetics';
import type { EquippedCosmetic } from '../lib/cosmetics';
import UserAvatar, { RANK_FRAME_CLASSES } from '../components/UserAvatar';

type LeaderboardUser = {
  id: number;
  username: string;
  avatar?: string;
  coins: number;
  xp: number;
  level: number;
  _count: { challenges: number };
  cosmetics: EquippedCosmetic[];
};

const PODIUM_CONFIG: Record<number, { badge: string; icon: React.ReactNode; order: string; label: string }> = {
  1: { badge: 'bg-yellow-400 text-white', icon: <Trophy size={14} />, order: 'order-2', label: '1er' },
  2: { badge: 'bg-gray-400 text-white',   icon: <Medal size={14} />,  order: 'order-1', label: '2ème' },
  3: { badge: 'bg-orange-400 text-white', icon: <Medal size={14} />,  order: 'order-3', label: '3ème' },
};

type SortKey = 'xp' | 'coins' | 'challenges';

function getSortLabel(u: LeaderboardUser, sortBy: SortKey): string {
  if (sortBy === 'xp') return `${u.xp.toLocaleString()} XP`;
  if (sortBy === 'coins') return `🪙 ${u.coins.toLocaleString()}`;
  return `${u._count.challenges} défis`;
}

function sortUsers(users: LeaderboardUser[], sortBy: SortKey): LeaderboardUser[] {
  return [...users].sort((a, b) => {
    if (sortBy === 'xp') return b.xp - a.xp;
    if (sortBy === 'coins') return b.coins - a.coins;
    return b._count.challenges - a._count.challenges;
  });
}

function getUserTitle(cosmetics: EquippedCosmetic[], className = 'text-xs'): React.ReactNode {
  const t = getEquipped(cosmetics, 'TITLE');
  if (!t) return null;
  const name = t.cosmetic.name.replace(/^Titre\s*:\s*/i, '');
  return <p className={`font-semibold ${className} ${TITLE_CLASSES[t.cosmetic.rarity] ?? ''}`}>{name}</p>;
}

const SORT_TABS: { key: SortKey; label: string }[] = [
  { key: 'xp',         label: '⚡ XP' },
  { key: 'coins',      label: '🪙 Coins' },
  { key: 'challenges', label: '🏆 Défis' },
];

const PODIUM_SLOTS = [
  { rank: 2, idx: 1 },
  { rank: 1, idx: 0 },
  { rank: 3, idx: 2 },
];

const LeaderboardPage: React.FC = () => {
  const { user, darkMode } = useStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('xp');

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const sorted = sortUsers(users, sortBy);
  const myRank = user ? sorted.findIndex(u => u.id === user.id) + 1 : null;
  const card = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inactiveSortClass = darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100';

  const goToProfile = (u: LeaderboardUser) => {
    if (u.id === user?.id) navigate('/profile');
    else navigate(`/user/${u.id}`);
  };

  const renderRankBadge = (rank: number) => {
    const cfg = PODIUM_CONFIG[rank];
    if (cfg) return <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${cfg.badge}`}>{rank}</span>;
    return <span className={`text-sm font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>#{rank}</span>;
  };

  const renderBody = () => {
    if (loading) return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
      </div>
    );
    if (sorted.length === 0) return (
      <div className="text-center py-16 text-gray-400">
        <Trophy size={48} className="mx-auto mb-3 opacity-30" />
        <p>Aucun joueur classé pour l'instant.</p>
      </div>
    );
    return (
      <>
        {sorted.length >= 3 && (
          <div className="flex items-end justify-center gap-4 mb-6">
            {PODIUM_SLOTS.map(({ rank, idx }) => {
              const u = sorted[idx];
              const cfg = PODIUM_CONFIG[rank];
              return (
                <button key={u.id} onClick={() => goToProfile(u)}
                  className={`flex flex-col items-center gap-1 ${cfg.order} hover:scale-105 transition-transform`}>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>#{rank}</span>
                  <div className="relative">
                    <UserAvatar
                      avatar={u.avatar}
                      username={u.username}
                      cosmetics={u.cosmetics ?? []}
                      size={rank === 1 ? 'lg' : 'xl'}
                      rankFrame={RANK_FRAME_CLASSES[rank]}
                    />
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${cfg.badge}`}>
                      {cfg.icon}
                    </div>
                  </div>
                  <p className="font-bold text-sm text-center max-w-[80px] truncate mt-1">{u.username}</p>
                  {getUserTitle(u.cosmetics ?? [])}
                  <p className={`text-xs font-bold ${cfg.badge.split(' ')[1]} px-2 py-0.5 rounded-full`}>{cfg.label}</p>
                  <p className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{getSortLabel(u, sortBy)}</p>
                </button>
              );
            })}
          </div>
        )}
        <div className={`${card} border rounded-xl overflow-hidden`}>
          <table className="hidden md:table w-full">
            <thead>
              <tr className={`text-xs ${darkMode ? 'bg-gray-700/60 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                <th className="px-4 py-3 text-left w-12">Rang</th>
                <th className="px-4 py-3 text-left">Joueur</th>
                <th className="px-4 py-3 text-center">Niveau</th>
                <th className="px-4 py-3 text-center">⚡ XP</th>
                <th className="px-4 py-3 text-center">🪙 Coins</th>
                <th className="px-4 py-3 text-center">🏆 Défis</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u, idx) => {
                const rank = idx + 1;
                const isMe = user?.id === u.id;
                const rowBg = isMe ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30';
                return (
                  <tr key={u.id} onClick={() => goToProfile(u)}
                    className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'} ${rowBg} transition-colors cursor-pointer`}>
                    <td className="px-4 py-3 text-center">{renderRankBadge(rank)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          avatar={u.avatar}
                          username={u.username}
                          cosmetics={u.cosmetics ?? []}
                          size="sm"
                          rankFrame={rank <= 3 ? RANK_FRAME_CLASSES[rank] : ''}
                        />
                        <div>
                          <p className={`font-semibold text-sm ${isMe ? 'text-blue-500' : ''}`}>{u.username}{isMe && ' (vous)'}</p>
                          {getUserTitle(u.cosmetics ?? [])}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${darkMode ? 'bg-purple-900/40 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>Niv. {u.level}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-purple-500">{u.xp.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-yellow-500">{u.coins.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold">{u._count.challenges}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
            {sorted.map((u, idx) => {
              const rank = idx + 1;
              const isMe = user?.id === u.id;
              const rowBg = isMe ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30';
              return (
                <button key={u.id} onClick={() => goToProfile(u)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left ${rowBg} transition-colors`}>
                  <div className="w-7 text-center flex-shrink-0">{renderRankBadge(rank)}</div>
                  <UserAvatar
                    avatar={u.avatar}
                    username={u.username}
                    cosmetics={u.cosmetics ?? []}
                    size="sm"
                    rankFrame={rank <= 3 ? RANK_FRAME_CLASSES[rank] : ''}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm truncate ${isMe ? 'text-blue-500' : ''}`}>{u.username}{isMe && ' (vous)'}</p>
                    {getUserTitle(u.cosmetics ?? [])}
                    <div className="flex gap-2 text-xs mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded-full font-semibold ${darkMode ? 'bg-purple-900/40 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>Niv.{u.level}</span>
                      <span className="text-purple-500 font-semibold">⚡ {u.xp.toLocaleString()}</span>
                      <span className="text-yellow-500 font-semibold">🪙 {u.coins.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold">{u._count.challenges}</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>défis</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className={`px-3 py-4 md:p-6 min-h-screen ${darkMode ? 'text-white' : 'text-gray-900'}`}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Trophy className="text-yellow-500" size={28} />
            Classement
          </h1>
          <p className={`text-sm mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Les meilleurs joueurs de la plateforme
          </p>
        </div>
        {myRank && myRank > 0 && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${card} border self-start sm:self-auto`}>
            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Votre rang</span>
            <span className="text-xl font-bold text-blue-500">#{myRank}</span>
          </div>
        )}
      </div>

      {/* Sort tabs */}
      <div className={`${card} border rounded-xl p-1.5 mb-5 flex gap-1`}>
        {SORT_TABS.map(tab => (
          <button key={tab.key} onClick={() => setSortBy(tab.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${sortBy === tab.key ? 'bg-blue-600 text-white shadow-sm' : inactiveSortClass}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {renderBody()}
    </div>
  );
};

export default LeaderboardPage;
