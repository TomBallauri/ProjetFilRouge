import React, { useState, useEffect } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { Flame, Users, ChevronRight, Trophy } from 'lucide-react';
import { getEquipped, TITLE_CLASSES } from '../lib/cosmetics';
import type { EquippedCosmetic } from '../lib/cosmetics';
import UserAvatar from '../components/UserAvatar';
import BackButton from '../components/BackButton';

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

function getUserTitle(cosmetics: EquippedCosmetic[]): React.ReactNode {
  const t = getEquipped(cosmetics, 'TITLE');
  if (!t) return null;
  const name = t.cosmetic.name.replace(/^Titre\s*:\s*/i, '');
  return <span className={`text-xs font-semibold ${TITLE_CLASSES[t.cosmetic.rarity] ?? ''}`}>{name}</span>;
}

const MEDAL_COLORS: Record<number, { solid: string; deep: string }> = {
  1: { solid: '#FACC15', deep: '#FDE047' },
  2: { solid: '#A78BFA', deep: '#C8B3FF' },
  3: { solid: '#FB923C', deep: '#FDBA74' },
};

const PODIUM_SLOTS = [
  { rank: 2, idx: 1 },
  { rank: 1, idx: 0 },
  { rank: 3, idx: 2 },
];

const BAR_H: Record<number, number> = { 1: 100, 2: 76, 3: 60 };

const LeaderboardPage: React.FC = () => {
  usePageTitle('Classement');
  const { user } = useStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'amis' | 'guilde' | 'monde'>('monde');

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...users].sort((a, b) => b.xp - a.xp);
  const myRank = user ? sorted.findIndex(u => u.id === user.id) + 1 : 0;
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const goToProfile = (u: LeaderboardUser) => {
    if (u.id === user?.id) navigate('/profile');
    else navigate(`/user/${u.id}`);
  };

  return (
    <div style={{ background: 'var(--q-bg)', minHeight: '100%', paddingBottom: 100, fontFamily: 'var(--q-font)' }}>

      {/* ── Header ── */}
      <div style={{ padding: '24px 0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={26} aria-hidden="true" style={{ color: '#FACC15', flexShrink: 0 }} />
              <div style={{ fontSize: 26, fontFamily: 'var(--q-display)', color: 'var(--q-text)', letterSpacing: -0.3, lineHeight: 1.1, fontWeight: 700 }}>
                Classement
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--q-text2)', marginTop: 3 }}>
              Grimpe dans le classement et prouve ta valeur
            </div>
          </div>
          {myRank > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(250,204,21,0.15)', color: '#FDE047',
              padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
              <Flame size={12} color="#FDE047" aria-hidden="true" /> #{myRank}
            </div>
          )}
        </div>
      </div>

      {/* ── Scope tabs ── */}
      <div style={{ padding: '14px 0 6px' }}>
        <div style={{ background: 'var(--q-chrome)', borderRadius: 18, padding: 4, display: 'flex',
          boxShadow: 'var(--q-shadow)', border: '1px solid var(--q-line)' }}>
          {(['amis', 'guilde', 'monde'] as const).map(id => {
            const on = scope === id;
            return (
              <button key={id} onClick={() => setScope(id)}
                aria-pressed={on}
                style={{ flex: 1, height: 36, border: 'none', borderRadius: 14,
                  background: on ? 'var(--q-accent)' : 'transparent',
                  color: on ? '#fff' : 'var(--q-text2)',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', textTransform: 'capitalize',
                  boxShadow: on ? `0 2px 8px rgba(167,139,250,0.5)` : 'none',
                  transition: 'all 0.15s ease' }}>
                {id}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid transparent',
            borderTopColor: 'var(--q-accent)', borderRightColor: 'var(--q-accent)',
            animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 18px', color: 'var(--q-text3)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <p style={{ fontSize: 14 }}>Aucun joueur classé pour l'instant.</p>
        </div>
      ) : (
        <>
          {/* ── Podium ── */}
          {top3.length >= 3 && (
            <div style={{ padding: '14px 0 0' }}>
              <div style={{
                background: 'var(--q-vibrant-gold)',
                borderRadius: 26, padding: '22px 16px 16px',
                position: 'relative', overflow: 'hidden',

                boxShadow: '0 1px 0 rgba(255,255,255,0.35) inset, 0 14px 32px -10px rgba(250,204,21,0.55)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10,
              }}>
                {/* Orbs */}
                <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: -20, bottom: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', pointerEvents: 'none' }} />

                {PODIUM_SLOTS.map(({ rank, idx }) => {
                  const u = top3[idx];
                  if (!u) return null;
                  const medal = MEDAL_COLORS[rank];
                  return (
                    <button key={u.id} onClick={() => goToProfile(u)}
                      aria-label={`Voir le profil de ${u.username} — rang ${rank}`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                        position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <div style={{ position: 'relative', display: 'inline-flex' }}>
                        <UserAvatar avatar={u.avatar} username={u.username} cosmetics={u.cosmetics ?? []}
                          size={rank === 1 ? 'lg' : 'xl'}
                          className="ring-2 ring-white/50" />
                        {/* Rank badge */}
                        <div style={{ position: 'absolute', bottom: -3, right: -3, width: 24, height: 24, borderRadius: 12,
                          background: '#fff', color: medal.deep, fontSize: 11, fontWeight: 800,
                          fontFamily: 'var(--q-display)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `2.5px solid ${medal.solid}` }}>{rank}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 6, textAlign: 'center',
                        maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.username.split(' ')[0]}
                      </div>
                      {getUserTitle(u.cosmetics ?? []) && (
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>
                          {getUserTitle(u.cosmetics ?? [])}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--q-mono)' }}>
                        {u.xp.toLocaleString('fr')} XP
                      </div>
                      {/* Bar */}
                      <div style={{ marginTop: 8, width: '100%', height: BAR_H[rank],
                        background: 'rgba(255,255,255,0.25)',
                        borderRadius: '16px 16px 4px 4px',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(0,0,0,0.08)',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8,
                        fontFamily: 'var(--q-display)', fontSize: 22, color: '#fff' }}>
                        {rank}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Rest of list ── */}
          {rest.length > 0 && (
            <div style={{ padding: '14px 0 0' }}>
              <div style={{ borderRadius: 22, overflow: 'hidden',
                background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
                {rest.map((u, i) => {
                  const rank = i + 4;
                  const isMe = user?.id === u.id;
                  return (
                    <button key={u.id} onClick={() => goToProfile(u)}
                      aria-label={`Voir le profil de ${u.username}${isMe ? ' (vous)' : ''}`}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                        borderBottom: i < rest.length - 1 ? `1px solid var(--q-line)` : 'none',
                        background: isMe ? 'var(--q-accent-soft)' : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        borderTop: 'none' }}>
                      <div style={{ width: 26, textAlign: 'center', fontFamily: 'var(--q-mono)', fontSize: 12,
                        color: 'var(--q-text2)', fontWeight: 700, flexShrink: 0 }}>{rank}</div>
                      <UserAvatar avatar={u.avatar} username={u.username} cosmetics={u.cosmetics ?? []}
                        size="sm" className={isMe ? 'ring-2 ring-[var(--q-accent)]' : ''} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: isMe ? 700 : 600, color: 'var(--q-text)',
                          display: 'flex', alignItems: 'center', gap: 6 }}>
                          {u.username}
                          {isMe && <span style={{ fontSize: 11, color: 'var(--q-accent-deep)', fontWeight: 700 }}>(toi)</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--q-text2)', marginTop: 1, fontFamily: 'var(--q-mono)' }}>
                          {u.xp.toLocaleString('fr')} XP
                        </div>
                      </div>
                      <div style={{ color: 'var(--q-text3)', flexShrink: 0 }} aria-hidden="true">
                        <ChevronRight size={14} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Guild card ── */}
          <div style={{ padding: '18px 0 0' }}>
            <div style={{ padding: 16, borderRadius: 22,
              background: 'linear-gradient(135deg,#EC4899,#A78BFA)',
              position: 'relative', overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.35) inset, 0 14px 32px -10px rgba(236,72,153,0.55)' }}>
              <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: -10, bottom: -30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.95)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={18} color="#EC4899" aria-hidden="true" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontFamily: 'var(--q-display)', color: '#fff', letterSpacing: -0.2 }}>
                    Classement Guildes
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                    {sorted.length} joueurs · {sorted.reduce((s, u) => s + u.xp, 0).toLocaleString('fr')} XP collectifs
                  </div>
                </div>
                <div style={{ color: '#fff' }} aria-hidden="true"><ChevronRight size={16} /></div>
              </div>
              <div style={{ position: 'relative', marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.92)',
                  textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>
                  Défi collectif en cours
                </div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginBottom: 6 }}>
                  Atteindre 50 000 XP avant le 30 juin
                </div>
                {/* Progress bar */}
                <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: '#fff',
                    width: `${Math.min(100, (sorted.reduce((s, u) => s + u.xp, 0) / 50000) * 100)}%`,
                    transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LeaderboardPage;
