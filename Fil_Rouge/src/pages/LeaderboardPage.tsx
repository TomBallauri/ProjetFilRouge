import React, { useState, useEffect } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { Flame, Users, ChevronRight, Globe } from 'lucide-react';
import { getEquipped, TITLE_CLASSES } from '../lib/cosmetics';
import type { EquippedCosmetic } from '../lib/cosmetics';
import UserAvatar from '../components/UserAvatar';
import BackButton from '../components/BackButton';
import PageLoader from '../components/PageLoader';

type LeaderboardUser = {
  id: number;
  username: string;
  avatar?: string;
  coins: number;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  _count: { challenges: number };
  cosmetics: EquippedCosmetic[];
};

function getSeason(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'Saison de printemps';
  if (m >= 5 && m <= 7) return "Saison d'été";
  if (m >= 8 && m <= 10) return "Saison d'automne";
  return "Saison d'hiver";
}

function getUserTitle(cosmetics: EquippedCosmetic[]): React.ReactNode {
  const t = getEquipped(cosmetics, 'TITLE');
  if (!t) return null;
  const name = t.cosmetic.name.replace(/^Titre\s*:\s*/i, '');
  return <span className={`text-xs font-semibold ${TITLE_CLASSES[t.cosmetic.rarity] ?? ''}`}>{name}</span>;
}

/* Podium order: 2nd left, 1st center, 3rd right */
const PODIUM_SLOTS = [
  { rank: 2, idx: 1 },
  { rank: 1, idx: 0 },
  { rank: 3, idx: 2 },
];
const BAR_H: Record<number, number> = { 1: 100, 2: 76, 3: 60 };
const MEDAL_COLOR: Record<number, { bg: string; border: string; color: string }> = {
  1: { bg: '#fff', border: '#FACC15', color: '#92400E' },
  2: { bg: '#fff', border: '#A78BFA', color: '#7C3AED' },
  3: { bg: '#fff', border: '#FB923C', color: '#9A3412' },
};

const token = () => localStorage.getItem('token') ?? '';

const LeaderboardPage: React.FC = () => {
  usePageTitle('Classement');
  const { user } = useStore();
  const navigate = useNavigate();
  const [globalUsers, setGlobalUsers] = useState<LeaderboardUser[]>([]);
  const [friendUsers, setFriendUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsFetched, setFriendsFetched] = useState(false);
  const [scope, setScope] = useState<'amis' | 'monde'>('monde');

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => setGlobalUsers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (scope === 'amis' && !friendsFetched) {
      setFriendsLoading(true);
      fetch('/api/leaderboard/friends', { headers: { Authorization: `Bearer ${token()}` } })
        .then(r => r.json())
        .then(data => { setFriendUsers(Array.isArray(data) ? data : []); setFriendsFetched(true); })
        .finally(() => setFriendsLoading(false));
    }
  }, [scope, friendsFetched]);

  const users     = scope === 'amis' ? friendUsers : globalUsers;
  const isLoading = loading || (scope === 'amis' && friendsLoading);
  const myRank    = user ? users.findIndex(u => u.id === user.id) + 1 : 0;
  const myStreak  = user ? (users.find(u => u.id === user.id)?.currentStreak ?? 0) : 0;
  const top3      = users.slice(0, 3);
  const rest      = users.slice(3);

  const goToProfile = (u: LeaderboardUser) => {
    if (u.id === user?.id) navigate('/profile');
    else navigate(`/user/${u.id}`);
  };

  return (
    <div style={{ background: 'var(--q-bg)', minHeight: '100%', paddingBottom: 110, fontFamily: 'var(--q-font)' }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BackButton />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--q-text3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 1 }}>
              Classement
            </div>
            <div style={{ fontSize: 22, fontFamily: 'var(--q-display)', color: 'var(--q-text)', fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.15 }}>
              {getSeason()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--q-text3)', marginTop: 2 }}>
              <Flame size={11} color="#FB923C" aria-hidden="true" />
              Classé par série de jours (streak)
            </div>
          </div>
          {myRank > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'linear-gradient(135deg,#FACC15,#FB923C)',
              color: '#fff', padding: '5px 10px', borderRadius: 999,
              fontSize: 12, fontWeight: 800, flexShrink: 0,
              boxShadow: '0 4px 10px -2px rgba(251,146,60,0.5)',
            }}>
              <Flame size={13} aria-hidden="true" />
              {myStreak > 0 ? `${myStreak}j` : `#${myRank}`}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ padding: '16px 0 8px' }}>
        <div style={{
          background: 'var(--q-chrome)', borderRadius: 20, padding: 4,
          display: 'flex', gap: 2,
          boxShadow: 'var(--q-shadow)', border: '1px solid var(--q-line)',
        }}>
          {([
            { id: 'amis',  label: 'Amis',  Icon: Users },
            { id: 'monde', label: 'Monde', Icon: Globe },
          ] as const).map(({ id, label, Icon }) => {
            const on = scope === id;
            return (
              <button key={id} onClick={() => setScope(id)} aria-pressed={on}
                style={{
                  flex: 1, height: 38, border: 'none', borderRadius: 16,
                  background: on ? 'var(--q-accent)' : 'transparent',
                  color: on ? '#fff' : 'var(--q-text2)',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: on ? '0 2px 8px rgba(124,58,237,0.4)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  transition: 'all 0.15s ease',
                }}>
                <Icon size={13} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && <PageLoader message="Chargement du classement..." />}

      {/* ── Empty ── */}
      {!isLoading && users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 18px' }}>
          <div style={{ marginBottom: 12, opacity: 0.3 }}>
            {scope === 'amis'
              ? <Users size={48} style={{ margin: '0 auto', color: 'var(--q-text3)' }} aria-hidden="true" />
              : <Globe size={48} style={{ margin: '0 auto', color: 'var(--q-text3)' }} aria-hidden="true" />}
          </div>
          <p style={{ fontSize: 14, color: 'var(--q-text3)', fontWeight: 600 }}>
            {scope === 'amis' ? 'Ajoute des amis pour les voir ici !' : "Aucun joueur classé pour l'instant."}
          </p>
        </div>
      )}

      {!isLoading && users.length > 0 && (
        <>
          {/* ── Podium ── */}
          {top3.length >= 3 && (
            <div style={{ padding: '8px 0 0' }}>
              <div style={{
                background: 'var(--q-vibrant-gold)',
                borderRadius: 28, padding: '24px 16px 0',
                position: 'relative', overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.25)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.35) inset, 0 14px 32px -10px rgba(250,204,21,0.55)',
              }}>
                {/* Decorative orbs */}
                <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: -20, bottom: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', pointerEvents: 'none' }} />

                {/* 3 columns */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
                  {PODIUM_SLOTS.map(({ rank, idx }) => {
                    const u = top3[idx];
                    if (!u) return null;
                    const medal = MEDAL_COLOR[rank];
                    const avatarSize = rank === 1 ? 'lg' : 'md';
                    return (
                      <button key={u.id} onClick={() => goToProfile(u)}
                        aria-label={`Profil de ${u.username} — rang ${rank}`}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, gap: 0 }}>

                        {/* Avatar + rank badge */}
                        <div style={{ position: 'relative', display: 'inline-flex', marginBottom: 6 }}>
                          <UserAvatar
                            avatar={u.avatar} username={u.username} cosmetics={u.cosmetics ?? []}
                            size={avatarSize}
                            className={rank === 1 ? 'ring-4 ring-white/60' : 'ring-2 ring-white/40'}
                          />
                          <div style={{
                            position: 'absolute', bottom: -3, right: -3,
                            width: 24, height: 24, borderRadius: 12,
                            background: medal.bg, color: medal.color,
                            fontSize: 11, fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `2.5px solid ${medal.border}`,
                            fontFamily: 'var(--q-display)',
                          }}>{rank}</div>
                        </div>

                        {/* Name */}
                        <div style={{
                          fontSize: rank === 1 ? 13 : 11, fontWeight: 700, color: '#fff',
                          textAlign: 'center', maxWidth: 80,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: 2,
                        }}>
                          {u.username.split(' ')[0]}
                        </div>

                        {/* Title (cosmetic) */}
                        {getUserTitle(u.cosmetics ?? []) && (
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
                            {getUserTitle(u.cosmetics ?? [])}
                          </div>
                        )}

                        {/* Streak — c'est le critère de classement, pas l'XP */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--q-mono)', marginBottom: 8 }}>
                          <Flame size={11} aria-hidden="true" />
                          {u.currentStreak}j
                        </div>

                        {/* Step bar */}
                        <div style={{
                          width: '100%', height: BAR_H[rank],
                          background: 'rgba(255,255,255,0.25)',
                          borderRadius: '16px 16px 4px 4px',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(0,0,0,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--q-display)', fontSize: rank === 1 ? 28 : 22,
                          fontWeight: 800, color: 'rgba(255,255,255,0.9)',
                        }}>
                          {rank}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── List ── */}
          {(() => {
            const listUsers  = top3.length >= 3 ? rest : users;
            const rankOffset = top3.length >= 3 ? 4 : 1;
            if (listUsers.length === 0) return null;
            return (
              <div style={{ padding: '14px 0 0' }}>
                <div style={{
                  borderRadius: 22, overflow: 'hidden',
                  background: 'var(--q-chrome)',
                  border: '1px solid var(--q-line)',
                  boxShadow: 'var(--q-shadow)',
                }}>
                  {listUsers.map((u, i) => {
                    const rank = i + rankOffset;
                    const isMe = user?.id === u.id;
                    return (
                      <button key={u.id} onClick={() => goToProfile(u)}
                        aria-label={`${u.username}${isMe ? ' (vous)' : ''}, rang ${rank}`}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px',
                          borderTop: i > 0 ? '1px solid var(--q-line)' : 'none',
                          background: isMe ? 'var(--q-accent-soft)' : 'transparent',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}>

                        {/* Rank */}
                        <span style={{
                          width: 26, textAlign: 'center', flexShrink: 0,
                          fontSize: 12, fontWeight: 700,
                          color: rank <= 3 ? '#FB923C' : 'var(--q-text3)',
                          fontFamily: 'var(--q-mono)',
                        }}>{rank}</span>

                        {/* Avatar */}
                        <UserAvatar
                          avatar={u.avatar} username={u.username} cosmetics={u.cosmetics ?? []}
                          size="sm"
                          className={isMe ? 'ring-2 ring-[var(--q-accent)]' : ''}
                        />

                        {/* Name + XP */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: isMe ? 700 : 600,
                            color: 'var(--q-text)',
                            display: 'flex', alignItems: 'center', gap: 5,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {u.username}
                            {isMe && (
                              <span style={{ fontSize: 10, color: 'var(--q-accent)', fontWeight: 700, flexShrink: 0 }}>
                                (toi)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--q-text2)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Flame size={10} color={u.currentStreak > 0 ? '#FB923C' : 'var(--q-text3)'} aria-hidden="true" />
                            <span style={{ color: u.currentStreak > 0 ? '#FB923C' : 'var(--q-text3)', fontWeight: 600 }}>
                              {u.currentStreak}j
                            </span>
                          </div>
                        </div>

                        {/* Chevron */}
                        <ChevronRight size={15} style={{ color: 'var(--q-text3)', flexShrink: 0 }} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        </>
      )}
    </div>
  );
};

export default LeaderboardPage;
