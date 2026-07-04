import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Lock, Users, Trophy, Sparkles, ChevronLeft, ChevronDown, Upload } from "lucide-react";
import { useStore } from "../lib/store";
import { usePageTitle } from "../hooks/usePageTitle";
import PageLoader from "../components/PageLoader";

const token = () => localStorage.getItem('token') ?? '';
const authFetch = (url: string, init: RequestInit = {}) =>
  fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...init.headers,
    },
  });

type AdminUser = {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  coins: number;
  xp: number;
  level: number;
  currentStreak: number;
  createdAt: string;
};

type AdminChallenge = {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  category: string;
  coinReward: number;
  xpReward: number;
  isPublic: boolean;
  isDefault: boolean;
  seriesName: string | null;
  creator: { id: number; username: string } | null;
  _count: { participants: number };
};

type AdminCosmetic = {
  id: number;
  name: string;
  description: string;
  type: string;
  imageUrl: string | null;
  price: number;
  rarity: string;
};

const CATEGORIES = ['GAMING', 'SPORT', 'CUISINE', 'FITNESS', 'CREATIVITY', 'KNOWLEDGE', 'SOCIAL', 'NATURE', 'MUSIC', 'WELLNESS', 'DIY', 'OTHERS'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];
const COSMETIC_TYPES = ['AVATAR_FRAME', 'BANNER', 'BADGE', 'TITLE'];
const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const RARITY_BASE_PRICE: Record<string, number> = { COMMON: 250, RARE: 500, EPIC: 1000, LEGENDARY: 2000 };

const TABS = [
  { id: 'users', label: 'Utilisateurs', icon: Users },
  { id: 'challenges', label: 'Défis', icon: Trophy },
  { id: 'cosmetics', label: 'Cosmétiques', icon: Sparkles },
] as const;
type Tab = typeof TABS[number]['id'];

// ── styles partagés (tokens de design de l'appli) ───────────────────────────
const card: React.CSSProperties = { background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' };
const inputStyle: React.CSSProperties = { background: 'var(--q-bg-flat)', border: '1px solid var(--q-line)', color: 'var(--q-text)' };
const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--q-accent)]";
const primaryBtn = "q-press flex-1 text-sm font-bold px-3 py-2.5 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed";

let fieldSeq = 0;

function Field({ label, children }: Readonly<{ label: string; children: (id: string) => React.ReactNode }>) {
  const [id] = useState(() => `admin-field-${++fieldSeq}`);
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold block mb-1" style={{ color: 'var(--q-text2)' }}>
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function Select({ id, value, onChange, options }: Readonly<{ id: string; value: string; onChange: (v: string) => void; options: readonly string[] }>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[options.indexOf(value)]?.focus();
  }, [open, options, value]);

  const onOptionKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); optionRefs.current[(idx + 1) % options.length]?.focus(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); optionRefs.current[(idx - 1 + options.length) % options.length]?.focus(); return; }
    if (e.key === 'Home') { e.preventDefault(); optionRefs.current[0]?.focus(); return; }
    if (e.key === 'End') { e.preventDefault(); optionRefs.current[options.length - 1]?.focus(); }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${inputCls} flex items-center justify-between gap-2`}
        style={inputStyle}
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={16} aria-hidden="true"
          style={{ color: 'var(--q-text3)', flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 right-0 z-20 mt-1 rounded-xl max-h-56 overflow-y-auto overflow-x-hidden"
          style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}
        >
          {options.map((opt, idx) => {
            const selected = opt === value;
            return (
              <li key={opt} role="presentation">
                <button
                  ref={(el) => { optionRefs.current[idx] = el; }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onChange(opt); setOpen(false); triggerRef.current?.focus(); }}
                  onKeyDown={(e) => onOptionKeyDown(e, idx)}
                  className="w-full text-left px-3 py-2.5 text-sm"
                  style={{ background: selected ? 'var(--q-accent)' : 'transparent', color: selected ? '#fff' : 'var(--q-text)' }}
                >
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatChip({ value, label }: Readonly<{ value: React.ReactNode; label: string }>) {
  return (
    <div className="text-center">
      <div className="font-bold text-sm" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-mono)' }}>{value}</div>
      <div className="text-[10px]" style={{ color: 'var(--q-text3)' }}>{label}</div>
    </div>
  );
}

function Modal({ title, onClose, children }: Readonly<{ title: string; onClose: () => void; children: React.ReactNode }>) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <button type="button" aria-label="Fermer" onClick={onClose}
        className="absolute inset-0 w-full h-full cursor-default border-none bg-transparent" />
      <div
        className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto"
        style={card}
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-display)' }}>{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="q-press w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--q-line)', color: 'var(--q-text2)' }}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const AdminDashboard: React.FC = () => {
  usePageTitle('Admin');
  const navigate = useNavigate();
  const { user } = useStore();
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [cosmetics, setCosmetics] = useState<AdminCosmetic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notif, setNotif] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [editingChallenge, setEditingChallenge] = useState<Partial<AdminChallenge> | null>(null);
  const [editingCosmetic, setEditingCosmetic] = useState<Partial<AdminCosmetic> | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<AdminUser> | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const showNotif = (msg: string, type: 'success' | 'error') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3500);
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: form });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || "Erreur lors de l'upload", 'error'); return; }
      setEditingCosmetic(c => ({ ...c, imageUrl: data.url }));
    } catch {
      showNotif("Erreur lors de l'upload de l'image", 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  // Un seul point d'accès : les non-admins sont renvoyés à l'accueil.
  useEffect(() => {
    if (user && !user.isAdmin) navigate('/');
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    const endpoints: Record<Tab, { url: string; auth?: boolean; setter: (data: any) => void }> = {
      users: { url: '/api/users', auth: true, setter: setUsers },
      challenges: { url: '/api/admin/challenges', auth: true, setter: setChallenges },
      cosmetics: { url: '/api/cosmetics', setter: setCosmetics },
    };
    const { url, auth, setter } = endpoints[tab];
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await (auth ? authFetch(url) : fetch(url));
        if (!res.ok) throw new Error(`Échec du chargement de l'onglet ${tab}`);
        setter(await res.json());
      } catch {
        setError("Impossible de charger ces données.");
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, user]);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = TABS[(idx + dir + TABS.length) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  // ── Users ──────────────────────────────────────────────────────────────
  const handleDeleteUser = async (id: number) => {
    if (!globalThis.confirm("Supprimer cet utilisateur ?")) return;
    const res = await authFetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) { setUsers(prev => prev.filter(u => u.id !== id)); showNotif('Utilisateur supprimé.', 'success'); }
    else { const d = await res.json().catch(() => ({})); showNotif(d.error || "Erreur", 'error'); }
  };
  const handleToggleAdmin = async (u: AdminUser) => {
    const res = await authFetch(`/api/users/${u.id}`, { method: "PUT", body: JSON.stringify({ isAdmin: !u.isAdmin }) });
    const data = await res.json();
    if (data.user) {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isAdmin: data.user.isAdmin } : x));
      showNotif(data.user.isAdmin ? `${u.username} est maintenant admin.` : `Rôle admin retiré à ${u.username}.`, 'success');
    } else {
      showNotif(data.error || "Erreur lors du changement de rôle", 'error');
    }
  };
  const handleSaveUser = async () => {
    if (!editingUser?.id) return;
    const res = await authFetch(`/api/users/${editingUser.id}`, {
      method: "PUT",
      body: JSON.stringify({
        coins: editingUser.coins, xp: editingUser.xp,
        level: editingUser.level, currentStreak: editingUser.currentStreak,
      }),
    });
    const data = await res.json();
    if (!res.ok) { showNotif(data.error || "Erreur", 'error'); return; }
    setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...data.user } : u));
    setEditingUser(null);
    showNotif('Utilisateur mis à jour.', 'success');
  };

  // ── Challenges ─────────────────────────────────────────────────────────
  const handleDeleteChallenge = async (id: number) => {
    if (!globalThis.confirm("Supprimer ce défi ?")) return;
    const res = await authFetch(`/api/admin/challenges/${id}`, { method: "DELETE" });
    if (res.ok) { setChallenges(prev => prev.filter(c => c.id !== id)); showNotif('Défi supprimé.', 'success'); }
    else { const d = await res.json().catch(() => ({})); showNotif(d.error || "Erreur", 'error'); }
  };
  const handleSaveChallenge = async () => {
    if (!editingChallenge) return;
    const isNew = editingChallenge.id == null;
    const url = isNew ? '/api/admin/challenges' : `/api/admin/challenges/${editingChallenge.id}`;
    const res = await authFetch(url, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(editingChallenge) });
    const data = await res.json();
    if (!res.ok) { showNotif(data.error || "Erreur", 'error'); return; }
    if (isNew) setChallenges(prev => [data, ...prev]);
    else setChallenges(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c));
    setEditingChallenge(null);
    showNotif(isNew ? 'Défi créé.' : 'Défi mis à jour.', 'success');
  };

  // ── Cosmetics ──────────────────────────────────────────────────────────
  const handleDeleteCosmetic = async (id: number) => {
    if (!globalThis.confirm("Supprimer ce cosmétique ?")) return;
    const res = await authFetch(`/api/admin/cosmetics/${id}`, { method: "DELETE" });
    if (res.ok) { setCosmetics(prev => prev.filter(c => c.id !== id)); showNotif('Cosmétique supprimé.', 'success'); }
    else { const d = await res.json().catch(() => ({})); showNotif(d.error || "Erreur", 'error'); }
  };
  const handleSaveCosmetic = async () => {
    if (!editingCosmetic) return;
    const isNew = editingCosmetic.id == null;
    const url = isNew ? '/api/admin/cosmetics' : `/api/admin/cosmetics/${editingCosmetic.id}`;
    const res = await authFetch(url, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(editingCosmetic) });
    const data = await res.json();
    if (!res.ok) { showNotif(data.error || "Erreur", 'error'); return; }
    if (isNew) setCosmetics(prev => [data, ...prev]);
    else setCosmetics(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c));
    setEditingCosmetic(null);
    showNotif(isNew ? 'Cosmétique créé.' : 'Cosmétique mis à jour.', 'success');
  };

  if (!user?.isAdmin) return null;

  const gridCls = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3";
  const emptyMsg = (label: string) => (
    <p className="text-sm text-center py-12" style={{ color: 'var(--q-text3)' }}>Aucun {label} pour le moment.</p>
  );

  return (
    <div style={{ background: 'var(--q-bg)', minHeight: '100vh', fontFamily: 'var(--q-font)', paddingBottom: 40 }}>
      <div style={{ padding: '20px 18px 0', maxWidth: 1100, margin: '0 auto' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <button
            onClick={() => navigate('/profile')}
            className="q-press flex-shrink-0"
            style={{
              width: 40, height: 40, borderRadius: 20,
              border: '1px solid rgba(167,139,250,0.25)',
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(14px)',
              color: 'var(--q-accent-deep)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 0 rgba(255,255,255,0.10) inset, 0 4px 14px -2px rgba(167,139,250,0.35)',
              cursor: 'pointer',
            }}
            aria-label="Retour au profil"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--q-text3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Administration
            </div>
            <div style={{ fontSize: 22, fontFamily: 'var(--q-display)', color: 'var(--q-text)', fontWeight: 700, letterSpacing: -0.4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={18} style={{ color: 'var(--q-accent)' }} aria-hidden="true" /> Dashboard admin
            </div>
          </div>
        </div>

        {/* ── Tabs : grille de tuiles, tout visible sans scroll ni troncature ── */}
        <div role="tablist" aria-label="Sections d'administration" className="grid grid-cols-3 gap-2 mb-4">
          {TABS.map(({ id, label, icon: Icon }, idx) => {
            const active = tab === id;
            return (
              <button
                key={id}
                ref={(el) => { tabRefs.current[id] = el; }}
                role="tab"
                id={`tab-${id}`}
                aria-selected={active}
                aria-controls={`panel-${id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(e) => onTabKeyDown(e, idx)}
                className="q-press flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3"
                style={{
                  border: '1px solid var(--q-line)',
                  background: active ? 'var(--q-accent)' : 'var(--q-chrome)',
                  color: active ? '#fff' : 'var(--q-text2)',
                  cursor: 'pointer',
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Contenu ── */}
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          <h2 className="sr-only">{TABS.find(t => t.id === tab)?.label}</h2>

          {loading && <PageLoader message="Chargement..." />}
          {error && <p role="alert" className="text-sm text-center py-6" style={{ color: '#EF4444' }}>{error}</p>}

          {!loading && !error && tab === "users" && (
            users.length === 0 ? emptyMsg('utilisateur') : (
              <div className={gridCls}>
                {users.map((u) => (
                  <div key={u.id} className="rounded-2xl p-4" style={card}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate" style={{ color: 'var(--q-text)' }}>{u.username}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--q-text2)' }}>{u.email}</p>
                      </div>
                      {u.isAdmin && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 text-white" style={{ background: 'var(--q-accent)' }}>
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between gap-2 mb-3">
                      <StatChip value={u.coins} label="coins" />
                      <StatChip value={`Niv ${u.level}`} label="niveau" />
                      <StatChip value={`${u.currentStreak}j`} label="streak" />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        className={primaryBtn}
                        style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent-deep)' }}
                        onClick={() => setEditingUser(u)}
                      >
                        Éditer
                      </button>
                      <button
                        className={primaryBtn}
                        style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent-deep)' }}
                        disabled={u.id === user.id}
                        title={u.id === user.id ? "Tu ne peux pas changer ton propre rôle" : undefined}
                        onClick={() => handleToggleAdmin(u)}
                      >
                        {u.isAdmin ? "Retirer admin" : "Donner admin"}
                      </button>
                      <button
                        className={primaryBtn}
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                        disabled={u.id === user.id}
                        title={u.id === user.id ? "Tu ne peux pas supprimer ton propre compte" : undefined}
                        onClick={() => handleDeleteUser(u.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {!loading && !error && tab === "challenges" && (
            <div>
              <button
                className="q-press w-full sm:w-auto mb-4 px-4 py-3 rounded-2xl font-bold text-sm text-white"
                style={{ background: 'var(--q-accent)' }}
                onClick={() => setEditingChallenge({
                  title: '', description: '', difficulty: 'EASY', category: 'OTHERS',
                  coinReward: 50, xpReward: 100, isPublic: true, isDefault: false, seriesName: '',
                })}
              >
                + Créer un défi
              </button>
              {challenges.length === 0 ? emptyMsg('défi') : (
                <div className={gridCls}>
                  {challenges.map((c) => (
                    <div key={c.id} className="rounded-2xl p-4" style={card}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: 'var(--q-text)' }}>{c.title}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--q-text2)' }}>
                            {c.category} · {c.difficulty}{c.seriesName ? ` · ${c.seriesName}` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: c.isPublic ? 'rgba(52,211,153,0.15)' : 'var(--q-line)', color: c.isPublic ? '#34D399' : 'var(--q-text3)' }}>
                          {c.isPublic ? 'Public' : 'Privé'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs mb-3" style={{ color: 'var(--q-text2)' }}>
                        <span>{c.coinReward} coins</span>
                        <span>{c.xpReward} XP</span>
                        <span>{c._count?.participants ?? 0} participant{(c._count?.participants ?? 0) > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button className={primaryBtn} style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent-deep)' }}
                          onClick={() => setEditingChallenge({ ...c, seriesName: c.seriesName ?? '' })}>
                          Éditer
                        </button>
                        <button className={primaryBtn} style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                          onClick={() => handleDeleteChallenge(c.id)}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !error && tab === "cosmetics" && (
            <div>
              <button
                className="q-press w-full sm:w-auto mb-4 px-4 py-3 rounded-2xl font-bold text-sm text-white"
                style={{ background: 'var(--q-accent)' }}
                onClick={() => setEditingCosmetic({ name: '', description: '', type: 'BADGE', imageUrl: '', price: 100, rarity: 'COMMON' })}
              >
                + Créer un cosmétique
              </button>
              {cosmetics.length === 0 ? emptyMsg('cosmétique') : (
                <div className={gridCls}>
                  {cosmetics.map((c) => (
                    <div key={c.id} className="rounded-2xl p-4" style={card}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: 'var(--q-text)' }}>{c.name}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--q-text2)' }}>{c.type} · {c.rarity}</p>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--q-text)', fontFamily: 'var(--q-mono)' }}>
                          {c.price}💰
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button className={primaryBtn} style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent-deep)' }}
                          onClick={() => setEditingCosmetic(c)}>
                          Éditer
                        </button>
                        <button className={primaryBtn} style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                          onClick={() => handleDeleteCosmetic(c.id)}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {editingChallenge && (
        <Modal title={editingChallenge.id == null ? "Créer un défi" : "Éditer le défi"} onClose={() => setEditingChallenge(null)}>
          <div className="flex flex-col gap-3">
            <Field label="Titre">{id => (
              <input id={id} required className={inputCls} style={inputStyle} value={editingChallenge.title ?? ''}
                onChange={e => setEditingChallenge(c => ({ ...c, title: e.target.value }))} />
            )}</Field>
            <Field label="Description">{id => (
              <textarea id={id} required rows={3} className={inputCls} style={inputStyle} value={editingChallenge.description ?? ''}
                onChange={e => setEditingChallenge(c => ({ ...c, description: e.target.value }))} />
            )}</Field>
            <div className="flex flex-col sm:flex-row gap-3">
              <Field label="Catégorie">{id => (
                <Select id={id} value={editingChallenge.category ?? 'OTHERS'} options={CATEGORIES}
                  onChange={v => setEditingChallenge(c => ({ ...c, category: v }))} />
              )}</Field>
              <Field label="Difficulté">{id => (
                <Select id={id} value={editingChallenge.difficulty ?? 'EASY'} options={DIFFICULTIES}
                  onChange={v => setEditingChallenge(c => ({ ...c, difficulty: v }))} />
              )}</Field>
            </div>
            <div className="flex gap-3">
              <Field label="Coins">{id => (
                <input id={id} type="number" min={0} className={inputCls} style={inputStyle} value={editingChallenge.coinReward ?? 0}
                  onChange={e => setEditingChallenge(c => ({ ...c, coinReward: Number(e.target.value) }))} />
              )}</Field>
              <Field label="XP">{id => (
                <input id={id} type="number" min={0} className={inputCls} style={inputStyle} value={editingChallenge.xpReward ?? 0}
                  onChange={e => setEditingChallenge(c => ({ ...c, xpReward: Number(e.target.value) }))} />
              )}</Field>
            </div>
            <Field label="Nom de série (optionnel)">{id => (
              <input id={id} className={inputCls} style={inputStyle} value={editingChallenge.seriesName ?? ''}
                onChange={e => setEditingChallenge(c => ({ ...c, seriesName: e.target.value }))} />
            )}</Field>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--q-text)' }}>
              <input type="checkbox" checked={editingChallenge.isPublic !== false}
                onChange={e => setEditingChallenge(c => ({ ...c, isPublic: e.target.checked }))} />
              <span>Public</span>
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--q-text)' }}>
              <input type="checkbox" checked={!!editingChallenge.isDefault}
                onChange={e => setEditingChallenge(c => ({ ...c, isDefault: e.target.checked }))} />
              <span>Défi par défaut (bibliothèque de base)</span>
            </label>
            <button className="q-press mt-2 px-4 py-2.5 rounded-2xl font-bold text-sm text-white"
              style={{ background: 'var(--q-accent)' }} onClick={handleSaveChallenge}>
              Enregistrer
            </button>
          </div>
        </Modal>
      )}

      {editingCosmetic && (
        <Modal title={editingCosmetic.id == null ? "Créer un cosmétique" : "Éditer le cosmétique"} onClose={() => setEditingCosmetic(null)}>
          <div className="flex flex-col gap-3">
            <Field label="Nom">{id => (
              <input id={id} required className={inputCls} style={inputStyle} value={editingCosmetic.name ?? ''}
                onChange={e => setEditingCosmetic(c => ({ ...c, name: e.target.value }))} />
            )}</Field>
            <Field label="Description">{id => (
              <textarea id={id} required rows={2} className={inputCls} style={inputStyle} value={editingCosmetic.description ?? ''}
                onChange={e => setEditingCosmetic(c => ({ ...c, description: e.target.value }))} />
            )}</Field>
            <div className="flex flex-col sm:flex-row gap-3">
              <Field label="Type">{id => (
                <Select id={id} value={editingCosmetic.type ?? 'BADGE'} options={COSMETIC_TYPES}
                  onChange={v => setEditingCosmetic(c => ({
                    ...c, type: v,
                    // Seuls les cadres et bannières affichent une image (voir ShopPage) —
                    // on efface l'image si elle ne servirait plus à rien pour ce type.
                    imageUrl: (v === 'AVATAR_FRAME' || v === 'BANNER') ? c.imageUrl : '',
                  }))} />
              )}</Field>
              <Field label="Rareté">{id => (
                <Select id={id} value={editingCosmetic.rarity ?? 'COMMON'} options={RARITIES}
                  onChange={v => setEditingCosmetic(c => ({ ...c, rarity: v, price: RARITY_BASE_PRICE[v] ?? c.price }))} />
              )}</Field>
            </div>
            <Field label="Prix">{id => (
              <input id={id} type="number" min={0} className={inputCls} style={inputStyle} value={editingCosmetic.price ?? 0}
                onChange={e => setEditingCosmetic(c => ({ ...c, price: Number(e.target.value) }))} />
            )}</Field>
            {(editingCosmetic.type === 'AVATAR_FRAME' || editingCosmetic.type === 'BANNER') && (
              <Field label="Image (optionnel)">{id => {
                let uploadLabel = 'Choisir une image sur cet ordinateur';
                if (uploadingImage) uploadLabel = 'Envoi…';
                else if (editingCosmetic.imageUrl) uploadLabel = "Changer l'image";
                return (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    {editingCosmetic.imageUrl && (
                      <img src={editingCosmetic.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                        style={{ border: '1px solid var(--q-line)' }} />
                    )}
                    <label
                      htmlFor={id}
                      className="q-press flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-xl text-sm font-semibold py-2.5"
                      style={inputStyle}
                    >
                      <Upload size={14} aria-hidden="true" />
                      {uploadLabel}
                    </label>
                  </div>
                  <input
                    id={id}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingImage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                      e.target.value = '';
                    }}
                  />
                  {editingCosmetic.imageUrl && (
                    <button type="button" onClick={() => setEditingCosmetic(c => ({ ...c, imageUrl: '' }))}
                      className="text-xs font-semibold self-start underline" style={{ color: 'var(--q-text3)' }}>
                      Retirer l'image
                    </button>
                  )}
                </div>
                );
              }}</Field>
            )}
            <button className="q-press mt-2 px-4 py-2.5 rounded-2xl font-bold text-sm text-white"
              style={{ background: 'var(--q-accent)' }} onClick={handleSaveCosmetic}>
              Enregistrer
            </button>
          </div>
        </Modal>
      )}

      {editingUser && (
        <Modal title={`Éditer ${editingUser.username}`} onClose={() => setEditingUser(null)}>
          <div className="flex flex-col gap-3">
            <Field label="Coins">{id => (
              <input id={id} type="number" min={0} className={inputCls} style={inputStyle} value={editingUser.coins ?? 0}
                onChange={e => setEditingUser(u => ({ ...u, coins: Number(e.target.value) }))} />
            )}</Field>
            <div className="flex flex-col sm:flex-row gap-3">
              <Field label="XP">{id => (
                <input id={id} type="number" min={0} className={inputCls} style={inputStyle} value={editingUser.xp ?? 0}
                  onChange={e => setEditingUser(u => ({ ...u, xp: Number(e.target.value) }))} />
              )}</Field>
              <Field label="Niveau">{id => (
                <input id={id} type="number" min={1} className={inputCls} style={inputStyle} value={editingUser.level ?? 1}
                  onChange={e => setEditingUser(u => ({ ...u, level: Number(e.target.value) }))} />
              )}</Field>
            </div>
            <Field label="Streak (jours)">{id => (
              <input id={id} type="number" min={0} className={inputCls} style={inputStyle} value={editingUser.currentStreak ?? 0}
                onChange={e => setEditingUser(u => ({ ...u, currentStreak: Number(e.target.value) }))} />
            )}</Field>
            <button className="q-press mt-2 px-4 py-2.5 rounded-2xl font-bold text-sm text-white"
              style={{ background: 'var(--q-accent)' }} onClick={handleSaveUser}>
              Enregistrer
            </button>
          </div>
        </Modal>
      )}

      <div aria-live="polite" aria-atomic="true" className="sr-only">{notif?.msg}</div>
      {notif && (
        <output
          className="fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-[110] px-5 py-3 rounded-2xl shadow-lg text-white font-bold text-sm"
          style={{ background: notif.type === 'success' ? 'linear-gradient(135deg,#34D399,#38BDF8)' : '#EF4444' }}
        >
          {notif.msg}
        </output>
      )}
    </div>
  );
};

export default AdminDashboard;
