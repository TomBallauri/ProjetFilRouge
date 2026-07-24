import React, { useState, useEffect, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Check, X, Users, Trophy, Flame, Search, Clock, AlertTriangle } from 'lucide-react';
import UserAvatar from '../components/UserAvatar';
import BackButton from '../components/BackButton';
import PageLoader from '../components/PageLoader';

type Friend = {
  friendshipId: number;
  since: string;
  user: { id: number; username: string; avatar?: string; level: number; xp: number };
};

type FriendRequest = {
  id: number;
  createdAt: string;
  sender: { id: number; username: string; avatar?: string; level: number };
};

type SearchUser = {
  id: number;
  username: string;
  avatar?: string;
  level: number;
  xp: number;
  currentStreak: number;
  friendStatus: 'NONE' | 'PENDING' | 'ACCEPTED';
  friendshipId: number | null;
  isSender: boolean | null;
};

const token = () => localStorage.getItem('token') ?? '';

// Points d'ancrage pour le tutoriel de bienvenue (voir OnboardingTour).
const TOUR_ID_BY_TAB: Record<string, string> = { search: 'friends-search', requests: 'friends-requests' };

const FriendsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useStore();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [tab, setTab] = useState<'friends' | 'search' | 'requests'>('friends');
  const [loading, setLoading] = useState(true);

  // Recherche
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Remplace window.confirm() : ce dialogue natif ne peut pas être stylé (chrome du navigateur
  // visible, boutons OK/Annuler non traduits par l'app — traduits par le navigateur lui-même
  // selon sa propre langue, d'où le mélange anglais/français observé).
  const [confirmRemove, setConfirmRemove] = useState<{ id: number; username: string } | null>(null);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        fetch('/api/friends', { headers: { Authorization: `Bearer ${token()}` } }),
        fetch('/api/friends/requests', { headers: { Authorization: `Bearer ${token()}` } }),
      ]);
      const friendsData = await friendsRes.json();
      const requestsData = await requestsRes.json();
      setFriends(Array.isArray(friendsData) ? friendsData : []);
      setRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const acceptRequest = async (id: number) => {
    await fetch(`/api/friends/accept/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
    fetchAll();
  };

  // Accepter directement depuis l'onglet recherche (au lieu de devoir aller sur l'onglet
  // Demandes) : le bouton "Accepter" y était affiché mais ne faisait rien au clic.
  const acceptFromSearch = async (u: SearchUser) => {
    if (!u.friendshipId) return;
    const res = await fetch(`/api/friends/accept/${u.friendshipId}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) {
      setSearchResults(prev => prev.map(s => s.id === u.id ? { ...s, friendStatus: 'ACCEPTED' } : s));
      fetchAll();
    }
  };

  const declineOrRemove = async (id: number) => {
    await fetch(`/api/friends/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    fetchAll();
  };

  const removeFriend = (id: number, username: string) => {
    setConfirmRemove({ id, username });
  };

  const confirmRemoveFriend = async () => {
    if (!confirmRemove) return;
    const { id } = confirmRemove;
    setConfirmRemove(null);
    await declineOrRemove(id);
  };

  const sendRequest = async (targetId: number) => {
    setPendingIds(prev => new Set(prev).add(targetId));
    try {
      const res = await fetch(`/api/friends/request/${targetId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        setPendingIds(prev => { const s = new Set(prev); s.delete(targetId); return s; });
      } else {
        // Mettre à jour localement le résultat de recherche
        setSearchResults(prev => prev.map(u =>
          u.id === targetId ? { ...u, friendStatus: 'PENDING', isSender: true } : u
        ));
      }
    } catch {
      setPendingIds(prev => { const s = new Set(prev); s.delete(targetId); return s; });
    }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(val.trim())}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (!res.ok) {
          setSearchError(t('friends.searchServerError'));
          setSearchResults([]);
          return;
        }
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setSearchError(t('friends.searchUnreachable'));
        setSearchResults([]);
      }
      finally { setSearchLoading(false); }
    }, 350);
  };

  if (!user) return null;

  const tabs: { id: typeof tab; label: React.ReactNode }[] = [
    { id: 'friends', label: t('friends.myFriendsTab', { count: friends.length }) },
    { id: 'search', label: <span className="flex items-center gap-1.5"><Search size={13} aria-hidden="true" />{t('friends.searchTab')}</span> },
    {
      id: 'requests',
      label: (
        <span className="flex items-center gap-1.5">
          {t('friends.requestsTab')}
          {requests.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-[var(--q-accent)] text-white text-[10px] font-bold flex items-center justify-center">
              {requests.length}
            </span>
          )}
        </span>
      )
    },
  ];

  // Extracted so the `loading ? ... : ...` ternaries below aren't nested conditionals.
  const friendsListContent = friends.length === 0 ? (
    <div style={{ textAlign: 'center', padding: '50px 18px', color: 'var(--q-text3)' }}>
      <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} aria-hidden="true" />
      <p style={{ fontWeight: 600, color: 'var(--q-text2)', marginBottom: 6 }}>{t('friends.noFriendsYet')}</p>
      <p style={{ fontSize: 13 }}>
        <Trans i18nKey="friends.noFriendsHint" components={{
          btn: <button onClick={() => setTab('search')} aria-label={t('friends.searchTab')}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--q-accent)', fontWeight: 700, fontSize: 13 }} />
        }} />
      </p>
    </div>
  ) : (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {friends.map(({ friendshipId, user: f }) => (
        <div key={friendshipId} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          borderRadius: 20, background: 'var(--q-chrome)',
          border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)',
        }}>
          <button onClick={() => navigate(`/user/${f.id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
            <UserAvatar avatar={f.avatar} username={f.username} cosmetics={[]} size="sm" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--q-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--q-text2)', marginTop: 2,
                display: 'flex', alignItems: 'center', gap: 4 }}>
                <Trophy size={10} aria-hidden="true" /> {t('navbar.level', { level: f.level })}
                <span style={{ color: 'var(--q-line)' }}>·</span>
                {f.xp.toLocaleString(i18n.language)} XP
              </div>
            </div>
          </button>
          <button onClick={() => removeFriend(friendshipId, f.username)}
            aria-label={t('friends.removeFromFriends', { username: f.username })}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--q-text3)', padding: 6, borderRadius: 10,
              transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--q-text3)')}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );

  const requestsListContent = requests.length === 0 ? (
    <div style={{ textAlign: 'center', padding: '50px 18px', color: 'var(--q-text3)' }}>
      <UserPlus size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} aria-hidden="true" />
      <p style={{ fontWeight: 600, color: 'var(--q-text2)' }}>{t('friends.noPendingRequests')}</p>
    </div>
  ) : (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {requests.map(req => (
        <div key={req.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          borderRadius: 20, background: 'var(--q-chrome)',
          border: '1px solid var(--q-accent)', boxShadow: '0 0 0 2px rgba(167,139,250,0.15)',
        }}>
          <button onClick={() => navigate(`/user/${req.sender.id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
            <UserAvatar avatar={req.sender.avatar} username={req.sender.username} cosmetics={[]} size="sm" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--q-text)' }}>{req.sender.username}</div>
              <div style={{ fontSize: 11, color: 'var(--q-text2)', marginTop: 2 }}>
                {t('navbar.level', { level: req.sender.level })}
              </div>
            </div>
          </button>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => acceptRequest(req.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px',
                borderRadius: 999, background: 'var(--q-accent)', color: '#fff',
                fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(167,139,250,0.4)' }}>
              <Check size={13} aria-hidden="true" /> {t('userProfile.accept')}
            </button>
            <button onClick={() => declineOrRemove(req.id)}
              aria-label={t('friends.declineRequest')}
              style={{ padding: 8, borderRadius: 10, background: 'var(--q-line)',
                border: 'none', cursor: 'pointer', color: 'var(--q-text3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ background: 'var(--q-bg)', minHeight: '100%', paddingBottom: 100, fontFamily: 'var(--q-font)' }}>

      {/* Header */}
      <div style={{ padding: '24px 0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={24} aria-hidden="true" style={{ color: 'var(--q-accent)', flexShrink: 0 }} />
              <div style={{ fontSize: 24, fontFamily: 'var(--q-display)', color: 'var(--q-text)', fontWeight: 700, letterSpacing: -0.3 }}>
                {t('sidebar.friends')}
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--q-text2)', marginTop: 3 }}>
              {t('friends.headerSubtitle', { count: friends.length })}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '14px 0 6px' }}>
        <div style={{ background: 'var(--q-chrome)', borderRadius: 18, padding: 4, display: 'flex',
          boxShadow: 'var(--q-shadow)', border: '1px solid var(--q-line)' }}>
          {tabs.map(({ id, label }) => {
            const on = tab === id;
            const tourId = TOUR_ID_BY_TAB[id];
            return (
              <button key={id} onClick={() => setTab(id)}
                data-tour={tourId}
                aria-pressed={on}
                style={{ flex: 1, height: 36, border: 'none', borderRadius: 14,
                  background: on ? 'var(--q-accent)' : 'transparent',
                  color: on ? '#fff' : 'var(--q-text2)',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: on ? '0 2px 8px rgba(167,139,250,0.5)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RECHERCHE ── */}
      {tab === 'search' && (
        <div style={{ marginTop: 12 }}>
          {/* Input */}
          <div data-tour="friends-search-input" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            borderRadius: 18, background: 'var(--q-chrome)', border: '1px solid var(--q-line)',
            boxShadow: 'var(--q-shadow)', marginBottom: 14 }}>
            <Search size={16} aria-hidden="true" style={{ color: 'var(--q-text3)', flexShrink: 0 }} />
            <label htmlFor="friend-search" className="sr-only">{t('friends.searchLabel')}</label>
            <input
              id="friend-search"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              placeholder={t('friends.searchPlaceholder')}
              autoFocus
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 14, color: 'var(--q-text)', fontFamily: 'inherit' }}
            />
            {query && (
              <button onClick={() => { setQuery(''); setSearchResults([]); }} aria-label={t('common.clear')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--q-text3)', padding: 2 }}>
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Résultats */}
          {searchError && (
            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: 13, marginBottom: 8 }}>
              <AlertTriangle size={13} aria-hidden="true" style={{ display: 'inline', marginRight: 4 }} /> {searchError}
            </div>
          )}
          {searchLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid transparent',
                borderTopColor: 'var(--q-accent)', borderRightColor: 'var(--q-accent)',
                animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
          {!searchLoading && query.trim().length >= 2 && searchResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 18px', color: 'var(--q-text3)' }}>
              <Users size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} aria-hidden="true" />
              <p style={{ fontSize: 14 }}>{t('friends.noPlayerFound', { query })}</p>
            </div>
          )}
          {!searchLoading && query.trim().length < 2 && query.length > 0 && (
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--q-text3)', padding: '20px 0' }}>
              {t('friends.typeAtLeast2')}
            </p>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {searchResults.map(u => {
                const isLoading = pendingIds.has(u.id) && u.friendStatus === 'NONE';
                return (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 20, background: 'var(--q-chrome)',
                    border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)',
                  }}>
                    <button onClick={() => navigate(`/user/${u.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
                        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                      <UserAvatar avatar={u.avatar} username={u.username} cosmetics={[]} size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--q-text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.username}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: 11, color: 'var(--q-text2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Trophy size={10} aria-hidden="true" /> {t('navbar.level', { level: u.level })}
                          </span>
                          {u.currentStreak > 0 && (
                            <span style={{ fontSize: 11, color: '#FB923C', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Flame size={10} aria-hidden="true" /> {t('common.daysAbbrev', { count: u.currentStreak })}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    {/* Bouton selon le statut */}
                    {u.friendStatus === 'ACCEPTED' && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#34D399', padding: '4px 10px',
                        borderRadius: 999, background: 'rgba(52,211,153,0.12)', flexShrink: 0 }}>
                        ✓ {t('friends.friendBadge')}
                      </span>
                    )}
                    {u.friendStatus === 'PENDING' && u.isSender && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--q-text3)', padding: '4px 10px',
                        borderRadius: 999, background: 'var(--q-line)', flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} aria-hidden="true" /> {t('friends.pending')}
                      </span>
                    )}
                    {u.friendStatus === 'PENDING' && !u.isSender && (
                      <button onClick={() => acceptFromSearch(u)}
                        style={{ fontSize: 11, fontWeight: 700, color: '#fff', padding: '6px 12px',
                          borderRadius: 999, background: 'var(--q-accent)', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                        {t('userProfile.accept')}
                      </button>
                    )}
                    {u.friendStatus === 'NONE' && (
                      <button onClick={() => sendRequest(u.id)} disabled={isLoading}
                        aria-label={t('friends.addAsFriend', { username: u.username })}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
                          color: '#fff', padding: '7px 13px', borderRadius: 999, flexShrink: 0,
                          background: isLoading ? 'var(--q-line)' : 'linear-gradient(135deg,#A78BFA,#EC4899)',
                          border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                          boxShadow: isLoading ? 'none' : '0 4px 12px rgba(167,139,250,0.4)',
                          transition: 'all 0.15s ease' }}>
                        {isLoading
                          ? <Clock size={12} aria-hidden="true" />
                          : <><UserPlus size={12} aria-hidden="true" /> {t('friends.add')}</>
                        }
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LISTE AMIS ── */}
      {tab === 'friends' && (
        loading ? <PageLoader /> : friendsListContent
      )}

      {/* ── DEMANDES REÇUES ── */}
      {tab === 'requests' && (
        loading ? <PageLoader /> : requestsListContent
      )}

      {/* ── Confirmation de suppression d'ami ── */}
      {confirmRemove && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setConfirmRemove(null)}
          onKeyDown={e => { if (e.key === 'Escape') setConfirmRemove(null); }}
        >
          <div
            onClick={e => e.stopPropagation()}
            role="alertdialog" aria-modal="true" aria-label={t('friends.confirmRemove', { username: confirmRemove.username })}
            style={{
              width: '100%', maxWidth: 340, borderRadius: 24, padding: 22, textAlign: 'center',
              background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)',
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 14px',
              background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={22} color="#EF4444" aria-hidden="true" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--q-text)', marginBottom: 20 }}>
              {t('friends.confirmRemove', { username: confirmRemove.username })}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmRemove(null)} autoFocus
                style={{ flex: 1, padding: '11px', borderRadius: 14, border: '1.5px solid var(--q-line)',
                  background: 'transparent', color: 'var(--q-text2)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button onClick={confirmRemoveFriend}
                style={{ flex: 1, padding: '11px', borderRadius: 14, border: 'none',
                  background: '#EF4444', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {t('friends.confirmRemoveButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendsPage;
