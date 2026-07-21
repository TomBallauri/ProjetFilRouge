import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { usePageTitle } from '../hooks/usePageTitle';
import { Mail, Calendar, Edit, Save, X, Trophy, Zap, CheckCircle, Clock, ShoppingBag, Settings, Moon, Sun, Bell, ChevronDown, Palette, SlidersHorizontal, Award, Star, CircleDollarSign, Frame, PanelTop, Tag, Package, Flame, BookOpen, Brain, Activity, ChevronRight, LogOut, ChevronLeft, Lock } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { FRAME_CLASSES, BANNER_CLASSES, TITLE_CLASSES, getEquipped } from '../lib/cosmetics';
import type { EquippedCosmetic } from '../lib/cosmetics';
import PageLoader from '../components/PageLoader';
import { isStrongPassword, PASSWORD_REQUIREMENTS_TEXT } from '../lib/passwordPolicy';

type OwnedCosmetic = EquippedCosmetic & { id: number; purchasedAt: string };

const TYPE_LABELS: Record<string, string> = {
  AVATAR_FRAME: "Cadre d'avatar", BANNER: 'Bannière', BADGE: 'Badge', TITLE: 'Titre',
};
const TYPE_ICONS: Record<string, React.FC<{ size?: number | string; color?: string; style?: React.CSSProperties; [k: string]: unknown }>> = {
  AVATAR_FRAME: Frame, BANNER: PanelTop, BADGE: Award, TITLE: Tag,
};
const RARITY_LABELS: Record<string, string> = {
  COMMON: 'Commun', RARE: 'Rare', EPIC: 'Épique', LEGENDARY: 'Légendaire',
};

type UserChallenge = {
  id: number;
  challengeId: number;
  status: string;
  startedAt: string;
  completedAt?: string;
  challenge: {
    title: string;
    description: string;
    category: string;
    difficulty: string;
    coinReward: number;
    xpReward: number;
    seriesName?: string | null;
  };
};

const fmt = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return n.toLocaleString();
};

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const EditProfile: React.FC = () => {
  usePageTitle('Profil');
  const {
    user, setUser, darkMode, toggleDarkMode,
    notifToggles, setNotifToggles, reduceMotion, setReduceMotion, language, setLanguage,
  } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();

  const showNotif = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const [formData, setFormData] = useState({
    username: user?.username || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
    banner: user?.banner || ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailChangeSending, setEmailChangeSending] = useState(false);
  const [emailChangeSent, setEmailChangeSent] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState('');

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        bio: user.bio || '',
        avatar: user.avatar || '',
        banner: user.banner || ''
      });
      setAvatarPreview(null);
      setBannerPreview(null);
      setAvatarFile(null);
      setBannerFile(null);
    }
  }, [user]);

  const profileStats = {
    memberSince: user ? new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : ''
  };

  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [challengesTotal, setChallengesTotal] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [totalInProgress, setTotalInProgress] = useState(0);
  const [challengesHasMore, setChallengesHasMore] = useState(false);
  const [loadingMoreChallenges, setLoadingMoreChallenges] = useState(false);
  const [ownedCosmetics, setOwnedCosmetics] = useState<OwnedCosmetic[]>([]);
  const [cosmeticLoading, setCosmeticLoading] = useState<number | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [openSection, setOpenSection] = useState<string | null>('appearance');
  const [openProfileSections, setOpenProfileSections] = useState({
    cosmetics: true, info: true, defis: true,
  });
  const toggleProfileSection = (key: keyof typeof openProfileSections) =>
    setOpenProfileSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) { setPageLoading(false); return; }
    setPageLoading(true);
    fetch('/api/users/me/profile-data', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setUserChallenges(data.challenges ?? []);
        setChallengesTotal(data.total ?? 0);
        setTotalCompleted(data.totalCompleted ?? 0);
        setTotalInProgress(data.totalInProgress ?? 0);
        setChallengesHasMore(data.hasMore ?? false);
        setOwnedCosmetics(data.cosmetics ?? []);
      })
      .catch(() => {})
      .finally(() => setPageLoading(false));
  }, [user]);

  const loadMoreChallenges = async () => {
    const token = localStorage.getItem('token');
    if (!token || loadingMoreChallenges) return;
    setLoadingMoreChallenges(true);
    try {
      const res = await fetch(`/api/users/me/challenges?limit=10&skip=${userChallenges.length}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const more: UserChallenge[] = Array.isArray(data) ? data : (data.challenges ?? []);
      setUserChallenges(prev => [...prev, ...more]);
      if (!Array.isArray(data)) setChallengesHasMore(data.hasMore ?? false);
    } catch { /* silent */ }
    finally { setLoadingMoreChallenges(false); }
  };

  const handleEquip = (cosmeticId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const cosmetic = ownedCosmetics.find(uc => uc.cosmeticId === cosmeticId);
    if (!cosmetic) return;
    if (cosmetic.cosmetic.type === 'BADGE') {
      const equippedBadges = ownedCosmetics.filter(uc => uc.cosmetic.type === 'BADGE' && uc.equipped).length;
      if (equippedBadges >= 3) {
        alert('Maximum 3 badges équipés. Déséquipez un badge d\'abord.');
        return;
      }
    }
    // Optimistic update — UI réagit immédiatement
    const rollback = ownedCosmetics;
    setOwnedCosmetics(prev => prev.map(uc => {
      if (cosmetic.cosmetic.type === 'BADGE') {
        return uc.cosmeticId === cosmeticId ? { ...uc, equipped: true } : uc;
      }
      if (uc.cosmetic.type === cosmetic.cosmetic.type) {
        return { ...uc, equipped: uc.cosmeticId === cosmeticId };
      }
      return uc;
    }));
    setCosmeticLoading(cosmeticId);
    fetch(`/api/users/me/cosmetics/${cosmeticId}/equip`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        if (!res.ok) {
          setOwnedCosmetics(rollback);
          const err = await res.json().catch(() => ({}));
          alert((err as { error?: string }).error ?? "Erreur lors de l'équipement");
        } else {
          globalThis.dispatchEvent(new CustomEvent('cosmetics-updated'));
        }
      })
      .catch(() => setOwnedCosmetics(rollback))
      .finally(() => setCosmeticLoading(null));
  };

  const handleUnequip = (cosmeticId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const rollback = ownedCosmetics;
    // Optimistic update
    setOwnedCosmetics(prev => prev.map(uc => uc.cosmeticId === cosmeticId ? { ...uc, equipped: false } : uc));
    setCosmeticLoading(cosmeticId);
    fetch(`/api/users/me/cosmetics/${cosmeticId}/unequip`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        if (!res.ok) {
          setOwnedCosmetics(rollback);
          const err = await res.json().catch(() => ({}));
          alert((err as { error?: string }).error ?? 'Erreur lors du déséquipement');
        } else {
          globalThis.dispatchEvent(new CustomEvent('cosmetics-updated'));
        }
      })
      .catch(() => setOwnedCosmetics(rollback))
      .finally(() => setCosmeticLoading(null));
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordSave = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showNotif("Les mots de passe ne correspondent pas.", 'error');
      return;
    }
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      showNotif("Veuillez remplir tous les champs.", 'error');
      return;
    }
    if (!isStrongPassword(passwordData.newPassword)) {
      showNotif(`Mot de passe trop faible : ${PASSWORD_REQUIREMENTS_TEXT}`, 'error');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showNotif(data.error || "Erreur lors du changement de mot de passe", 'error');
        return;
      }
      showNotif("Mot de passe mis à jour avec succès !", 'success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsEditing(false);
    } catch (err) {
      showNotif("Erreur réseau lors du changement de mot de passe", 'error');
    }
  };

  const handleRequestEmailChange = async () => {
    setEmailChangeError('');
    if (!validateEmail(newEmailInput)) {
      setEmailChangeError('Adresse email invalide.');
      return;
    }
    setEmailChangeSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users/me/email/request-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newEmail: newEmailInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailChangeError(data.error || "Erreur lors de la demande de changement d'email.");
        return;
      }
      setEmailChangeSent(true);
    } catch {
      setEmailChangeError("Erreur réseau lors de la demande de changement d'email.");
    } finally {
      setEmailChangeSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Format non supporté. JPEG, PNG ou WebP uniquement.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert('Image trop lourde (max 5 Mo)');
      return;
    }
    const url = URL.createObjectURL(file);
    if (type === 'avatar') {
      setAvatarPreview(url);
      setAvatarFile(file);
    } else {
      setBannerPreview(url);
      setBannerFile(file);
    }
  };

  const uploadToBackend = async (file: File, type: 'avatar' | 'banner'): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: form,
    });
    if (!res.ok) throw new Error('Erreur upload');
    const data = await res.json();
    return data.url;
  };

  const handleSave = async () => {
    try {
      let avatarUrl = formData.avatar;
      let bannerUrl = formData.banner;
      if (avatarFile) avatarUrl = await uploadToBackend(avatarFile, 'avatar');
      if (bannerFile) bannerUrl = await uploadToBackend(bannerFile, 'banner');

      const token = localStorage.getItem('token');
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          avatar: avatarUrl,
          banner: bannerUrl
        })
      });
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
      const data = await res.json();
      setUser(data.user);
      setIsEditing(false);
      setAvatarPreview(null);
      setBannerPreview(null);
      setAvatarFile(null);
      setBannerFile(null);
    } catch (err) {
      alert('Erreur lors de la sauvegarde du profil');
    }
  };

  // /uploads/... est proxifié vers le backend (vite en dev, vercel.json en prod) —
  // pas besoin de préfixer une origine en dur.
  const getFullImageUrl = (url: string | undefined | null) => url ?? '';

  const equippedFrame  = getEquipped(ownedCosmetics, 'AVATAR_FRAME');
  const equippedTitle  = getEquipped(ownedCosmetics, 'TITLE');
  const equippedBadge  = getEquipped(ownedCosmetics, 'BADGE');
  const equippedBanner = getEquipped(ownedCosmetics, 'BANNER');
  const frameClass  = equippedFrame  ? (FRAME_CLASSES[equippedFrame.cosmetic.rarity]   ?? '') : '';
  const titleClass  = equippedTitle  ? (TITLE_CLASSES[equippedTitle.cosmetic.rarity]   ?? '') : '';
  const bannerClass = equippedBanner ? (BANNER_CLASSES[equippedBanner.cosmetic.rarity] ?? '') : '';
  const hasBannerImage = !!(bannerPreview || formData.banner || user?.banner);

  if (pageLoading) return <PageLoader message="Chargement du profil..." />;

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', textAlign: 'center', padding: '40px 24px', fontFamily: 'var(--q-font)' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, marginBottom: 20,
          background: 'var(--q-accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mail size={28} style={{ color: 'var(--q-accent-deep)' }} />
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontFamily: 'var(--q-display)', color: 'var(--q-text)' }}>
          Profil non disponible
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--q-text2)', maxWidth: 280 }}>
          Connecte-toi pour accéder à ton profil et tes statistiques.
        </p>
        <Link to="/login" className="q-press"
          style={{ display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 24px',
            borderRadius: 14, border: 'none', cursor: 'pointer', textDecoration: 'none',
            background: 'linear-gradient(135deg, #00DDFF 0%, #067DBA 35%, #2B1FD0 65%, #B71AEB 100%)',
            color: '#fff', fontSize: 14, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(167,139,250,0.40)' }}>
          Se connecter
        </Link>
      </div>
    );
  }

  const cosmeticSuffix = ownedCosmetics.length > 1 ? 's' : '';
  const cosmeticsLabel = ownedCosmetics.length === 0
    ? 'Aucun cosmétique possédé'
    : `${ownedCosmetics.length} cosmétique${cosmeticSuffix} possédé${cosmeticSuffix}`;

  const seriesDayNumber = (title: string) => {
    const m = /^Jour\s+(\d+)/i.exec(title);
    return m ? parseInt(m[1], 10) : null;
  };
  // Au sein d'une même série, on affiche les jours en ordre croissant (1, 2, 3…) —
  // le tri par date de création n'est pas fiable car les défis IA sont créés en lot.
  const sortedUserChallenges = [...userChallenges].sort((a, b) => {
    if (a.challenge.seriesName && a.challenge.seriesName === b.challenge.seriesName) {
      const da = seriesDayNumber(a.challenge.title);
      const db = seriesDayNumber(b.challenge.title);
      if (da !== null && db !== null) return da - db;
    }
    return 0;
  });

  return (
    <div style={{ paddingBottom: 100, color: 'var(--q-text)', fontFamily: 'var(--q-font)' }}>

      {/* ── Banner ── */}
      <div
        className={`-mx-4 md:-mx-6 -mt-4 md:-mt-6 ${!hasBannerImage ? bannerClass : ''}`}
        style={{
          height: 190,
          position: 'relative',
          overflow: 'hidden',
          cursor: isEditing ? 'pointer' : 'default',
          ...(hasBannerImage
            ? { backgroundImage: `url(${bannerPreview || getFullImageUrl(formData.banner) || getFullImageUrl(user.banner)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: 'var(--q-vibrant-hero)' }),
        }}
        onClick={() => isEditing && bannerInputRef.current?.click()}
      >
        {isEditing && (
          <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }} onChange={e => handleFileChange(e, 'banner')} />
        )}
{/* Back button */}
        {!isEditing && (
          <button onClick={() => navigate(-1)} className="q-press"
            style={{ position: 'absolute', top: 54, left: 18, width: 40, height: 40, borderRadius: 20,
              background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(10px)', zIndex: 10 }}>
            <ChevronLeft size={18} color="#1F2030" />
          </button>
        )}
        {/* Edit overlay */}
        {isEditing && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <Edit size={32} color="#fff" />
          </div>
        )}
      </div>

      {/* ── Avatar + Identity ── */}
      <div style={{ padding: '0 18px', marginTop: -54, textAlign: 'center' }}>
        <div
          style={{ display: 'inline-block', position: 'relative', width: 104, height: 104, cursor: isEditing ? 'pointer' : 'default' }}
          onClick={() => isEditing && avatarInputRef.current?.click()}
        >
          {/* Avatar shrinks inward when a frame image is equipped — no overflow needed */}
          <div
            className={`absolute rounded-full overflow-hidden ${equippedFrame?.cosmetic.imageUrl ? '' : frameClass}`}
            style={{
              inset: equippedFrame?.cosmetic.imageUrl ? '6px' : '0',
              border: '5px solid var(--q-bg-flat)',
              boxShadow: '0 8px 24px rgba(251,146,60,0.35)',
            }}
          >
            <img
              src={avatarPreview || getFullImageUrl(formData.avatar) || getFullImageUrl(user.avatar)}
              alt="Profile"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {isEditing && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.40)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Edit size={28} color="#fff" />
              </div>
            )}
          </div>
          {/* Frame fills the full 104×104 container — no negative insets, no clipping */}
          {equippedFrame?.cosmetic.imageUrl && (
            <img
              src={getFullImageUrl(equippedFrame.cosmetic.imageUrl)}
              alt=""
              className="absolute inset-0 w-full h-full pointer-events-none select-none z-10"
              style={{ objectFit: 'fill' }}
            />
          )}
          {isEditing && (
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }} onChange={e => handleFileChange(e, 'avatar')} />
          )}
        </div>

        <div style={{ marginTop: 10 }}>
          {isEditing ? (
            <input type="text" name="username" value={formData.username} onChange={handleInputChange}
              style={{ fontSize: 22, fontFamily: 'var(--q-display)', letterSpacing: -0.3, color: 'var(--q-text)', background: 'transparent', border: 'none', borderBottom: '2px solid var(--q-accent)', textAlign: 'center', outline: 'none', width: '100%', maxWidth: 280 }} />
          ) : (
            <div style={{ fontSize: 24, fontFamily: 'var(--q-display)', color: 'var(--q-text)', letterSpacing: -0.3, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {user.username}
              {equippedBadge && (
                <span title={equippedBadge.cosmetic.name} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Award size={16} style={{ color: '#FACC15', flexShrink: 0 }} />
                </span>
              )}
            </div>
          )}
          {equippedTitle && (
            <p className={`text-xs font-semibold mt-1 ${titleClass}`}>{equippedTitle.cosmetic.name}</p>
          )}
          <div style={{ fontSize: 12, color: 'var(--q-text2)', fontWeight: 500, marginTop: 4 }}>
            @{user.username} · membre depuis {profileStats.memberSince}
          </div>
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--q-accent-soft)', padding: '6px 14px', borderRadius: 999 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--q-accent-deep)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Niveau {user.level ?? 1}
            </span>
          </div>
          {/* Bio */}
          {isEditing ? (
            <>
              <label
                htmlFor="profile-bio"
                style={{ display: 'block', marginTop: 14, marginBottom: 4, fontSize: 12, fontWeight: 700, color: 'var(--q-text2)', letterSpacing: 0.5, textTransform: 'uppercase' }}
              >
                Bio
              </label>
              <textarea
                id="profile-bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                maxLength={300}
                aria-describedby="profile-bio-hint"
                style={{
                  width: '100%', maxWidth: 320, background: 'var(--q-chrome)',
                  border: '2px solid var(--q-accent)', borderRadius: 12,
                  padding: '10px 14px', fontSize: 15, lineHeight: 1.6,
                  color: 'var(--q-text)', resize: 'none', outline: 'none',
                  fontFamily: 'inherit', letterSpacing: 0.01,
                }}
                rows={3}
                placeholder="Décris-toi en quelques mots…"
              />
              <p id="profile-bio-hint" style={{ fontSize: 11, color: 'var(--q-text3)', marginTop: 3 }}>
                {formData.bio.length}/300 caractères
              </p>
            </>
          ) : user.bio ? (
            <p style={{
              marginTop: 12, fontSize: 15, fontWeight: 400,
              color: 'var(--q-text)',
              lineHeight: 1.65, letterSpacing: 0.01,
              maxWidth: 320, margin: '12px auto 0',
              textAlign: 'center',
            }}>
              {user.bio}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Modifier / Save / Cancel ── */}
      <div style={{ textAlign: 'center', padding: '16px 18px 0' }}>
        {isEditing ? (
          <div style={{ display: 'inline-flex', gap: 8 }}>
            <button onClick={handleSave} className="q-press"
              style={{ height: 36, padding: '0 18px', borderRadius: 18, border: 'none', background: 'linear-gradient(135deg,#34D399,#38BDF8)', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={14} /> Enregistrer
            </button>
            <button onClick={() => { setIsEditing(false); setAvatarPreview(null); setBannerPreview(null); setAvatarFile(null); setBannerFile(null); }} className="q-press"
              style={{ height: 36, padding: '0 18px', borderRadius: 18, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={14} /> Annuler
            </button>
          </div>
        ) : (
          <button onClick={() => setIsEditing(true)} className="q-press"
            style={{ height: 36, padding: '0 20px', borderRadius: 18, border: 'none', background: 'var(--q-accent-soft)', color: 'var(--q-accent-deep)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Modifier le profil
          </button>
        )}
      </div>

      {/* ── Stats 3-col (mockup style) ── */}
      <div style={{ padding: '20px 18px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[
          { value: totalCompleted || userChallenges.filter(c => c.status === 'COMPLETED').length, label: 'Défis réussis' },
          { value: totalInProgress || userChallenges.filter(c => c.status === 'IN_PROGRESS').length, label: 'En cours' },
          { value: fmt(user.xp ?? 0), label: 'XP totale' },
        ].map(({ value, label }) => (
          <div key={label} style={{ borderRadius: 22, padding: 14, textAlign: 'center', background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--q-display)', color: 'var(--q-text)', letterSpacing: -0.4, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--q-text2)', marginTop: 5, letterSpacing: 0.3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Streak card ── */}
      {(() => {
        const streak = (user as any).currentStreak ?? 0;
        const longest = (user as any).longestStreak ?? 0;
        const multiplier = Math.min(3, Math.round((1 + Math.floor(streak / 7) * 0.05) * 100) / 100);
        return (
          <div style={{ padding: '12px 18px 0' }}>
            <div style={{ borderRadius: 22, padding: 16, background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 18, flexShrink: 0, fontSize: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: streak > 0 ? 'linear-gradient(135deg,#FB923C,#FACC15)' : 'rgba(148,163,184,0.15)',
                boxShadow: streak > 0 ? '0 6px 18px -4px rgba(251,146,60,0.55)' : 'none',
              }}>
                {streak > 0
                  ? <Flame size={26} color="#ffffff" aria-hidden="true" />
                  : <Moon size={26} color="#94A3B8" aria-hidden="true" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--q-display)', color: 'var(--q-text)' }}>
                    {streak} jour{streak !== 1 ? 's' : ''}
                  </span>
                  {multiplier > 1 && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                      background: 'linear-gradient(135deg,#FB923C,#FACC15)', color: '#fff' }}>
                      ×{multiplier}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--q-text2)', marginTop: 2 }}>
                  Record : {longest} jour{longest !== 1 ? 's' : ''} · ×{multiplier}
                </div>
                {/* Barre de progression vers le prochain +0.05× (cycle 7 jours) */}
                <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: 'rgba(251,146,60,0.2)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999,
                    width: `${((streak % 7) / 7) * 100}%`,
                    background: 'linear-gradient(90deg,#FB923C,#FACC15)',
                    transition: 'width 0.7s ease',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--q-text3)', marginTop: 4 }}>
                  {7 - (streak % 7)} jour{7 - (streak % 7) !== 1 ? 's' : ''} avant +0.05×
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── XP bar ── */}
      <div style={{ padding: '12px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, marginBottom: 5 }}>
          <span style={{ color: 'var(--q-text3)' }}>Vers le niveau {(user.level ?? 1) + 1}</span>
          <span style={{ color: 'var(--q-accent)' }}>{(user.xp ?? 0) % 1000} / 1000 XP</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--q-accent-soft)' }}>
          <div style={{ height: 6, borderRadius: 999, transition: 'width 0.3s ease', width: `${((user.xp ?? 0) % 1000) / 10}%`, background: 'var(--q-vibrant-hero)' }} />
        </div>
      </div>

      {/* ── Badges ── */}
      {(() => {
        const equippedBadges = ownedCosmetics.filter(uc => uc.cosmetic.type === 'BADGE' && uc.equipped);
        if (equippedBadges.length === 0) return null;
        const BADGE_GRADS: Record<string, { grad: string; glow: string }> = {
          COMMON:    { grad: 'linear-gradient(135deg,#34D399,#38BDF8)', glow: 'rgba(52,211,153,0.45)' },
          RARE:      { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.45)' },
          EPIC:      { grad: 'linear-gradient(135deg,#A78BFA,#EC4899)', glow: 'rgba(167,139,250,0.45)' },
          LEGENDARY: { grad: 'linear-gradient(135deg,#FACC15,#FB923C 50%,#EC4899)', glow: 'rgba(251,146,60,0.55)' },
        };
        return (
          <>
            <div style={{ padding: '22px 22px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--q-display)', letterSpacing: -0.2, color: 'var(--q-text)' }}>Badges</h2>
              <span style={{ fontSize: 12, color: 'var(--q-text2)', fontWeight: 600 }}>{equippedBadges.length} équipé{equippedBadges.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ padding: '0 18px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {equippedBadges.map(uc => {
                const g = BADGE_GRADS[uc.cosmetic.rarity] ?? BADGE_GRADS.COMMON;
                return (
                  <div key={uc.id} style={{ background: g.grad, position: 'relative', overflow: 'hidden',
                    border: '2px solid rgba(255,255,255,0.45)', borderRadius: 20, padding: '16px 10px 14px', textAlign: 'center',
                    boxShadow: `0 1px 0 rgba(255,255,255,0.35) inset, 0 10px 24px -10px ${g.glow}` }}>
                    <div style={{ position: 'absolute', right: -14, top: -14, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', left: -10, bottom: -16, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 22, margin: '0 auto',
                      background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
                      <Award size={22} style={{ color: '#A78BFA' }} />
                    </div>
                    <div style={{ position: 'relative', fontSize: 10, fontWeight: 700, color: '#fff', marginTop: 8, lineHeight: 1.2 }}>{uc.cosmetic.name}</div>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* ── Informations ── */}
      <div style={{ padding: '0 18px', marginTop: 16 }}>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
            <button onClick={() => toggleProfileSection('info')}
              className="q-press w-full flex items-center gap-3 p-4 text-left"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#38BDF8,#A78BFA)' }}>
                <Mail size={18} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: 'var(--q-text)' }}>Mes informations</p>
                <p className="text-xs truncate" style={{ color: 'var(--q-text2)' }}>{user.email}</p>
              </div>
              <ChevronDown size={16} style={{ color: 'var(--q-text3)', flexShrink: 0,
                transform: openProfileSections.info ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease' }} />
            </button>
            {openProfileSections.info && (
              <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--q-line)', paddingTop: 12 }}>
                {user.isAdmin && (
                  <div className="px-3 py-2 rounded-xl text-xs font-bold w-fit flex items-center gap-1.5"
                    style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent)' }}>
                    <Star size={12} /> Administrateur
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Mail size={15} style={{ color: 'var(--q-text3)', flexShrink: 0 }} />
                    <span className="text-sm" style={{ color: 'var(--q-text2)' }}>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={15} style={{ color: 'var(--q-text3)', flexShrink: 0 }} />
                    <span className="text-sm" style={{ color: 'var(--q-text2)' }}>Membre depuis {profileStats.memberSince}</span>
                  </div>
                </div>
                {isEditing && (
                  <div>
                    <p className="text-sm font-semibold mb-2" style={{ color: 'var(--q-text)' }}>Changer d'email</p>
                    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--q-accent-soft)', border: '1px solid var(--q-line)' }}>
                      {emailChangeSent ? (
                        <p className="text-sm" style={{ color: 'var(--q-text)' }}>
                          Un email de confirmation a été envoyé à <strong>{newEmailInput}</strong>. Clique sur le lien qu'il contient pour valider le changement.
                        </p>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--q-text2)' }}>
                              Nouvelle adresse email
                            </label>
                            <input type="email" value={newEmailInput}
                              onChange={e => { setNewEmailInput(e.target.value); setEmailChangeError(''); }}
                              placeholder={user.email}
                              className="w-full px-3 py-2 rounded-xl bg-transparent focus:outline-none text-sm"
                              style={{ border: '1px solid var(--q-accent)', color: 'var(--q-text)' }} />
                            {emailChangeError && <p className="text-red-500 text-xs mt-1">{emailChangeError}</p>}
                          </div>
                          <button onClick={handleRequestEmailChange} disabled={emailChangeSending}
                            className="q-press px-4 py-2 rounded-xl text-sm font-bold text-white"
                            style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)', opacity: emailChangeSending ? 0.7 : 1 }}>
                            {emailChangeSending ? 'Envoi...' : 'Envoyer le lien de confirmation'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {isEditing && (
                  <div>
                    <p className="text-sm font-semibold mb-2" style={{ color: 'var(--q-text)' }}>Modifier le mot de passe</p>
                    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--q-accent-soft)', border: '1px solid var(--q-line)' }}>
                      {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field, i) => (
                        <div key={field}>
                          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--q-text2)' }}>
                            {['Mot de passe actuel', 'Nouveau mot de passe', 'Confirmer le nouveau mot de passe'][i]}
                          </label>
                          <input type="password" name={field} value={passwordData[field]} onChange={handlePasswordChange}
                            className="w-full px-3 py-2 rounded-xl bg-transparent focus:outline-none text-sm"
                            style={{ border: '1px solid var(--q-accent)', color: 'var(--q-text)' }} />
                          {field === 'newPassword' && (
                            <p className="text-xs mt-1" style={{ color: 'var(--q-text2)' }}>{PASSWORD_REQUIREMENTS_TEXT}</p>
                          )}
                        </div>
                      ))}
                      <button onClick={handlePasswordSave}
                        className="q-press px-4 py-2 rounded-xl text-sm font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)' }}>
                        Enregistrer le mot de passe
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      {/* ── Cosmétiques ── */}
      <div style={{ padding: '0 18px', marginTop: 8 }}>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
            <button onClick={() => toggleProfileSection('cosmetics')}
              className="q-press w-full flex items-center gap-3 p-4 text-left"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#EC4899,#A78BFA)' }}>
                <ShoppingBag size={18} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: 'var(--q-text)' }}>Mes cosmétiques</p>
                <p className="text-xs" style={{ color: 'var(--q-text2)' }}>{cosmeticsLabel}</p>
              </div>
              <ChevronDown size={16} style={{ color: 'var(--q-text3)', flexShrink: 0,
                transform: openProfileSections.cosmetics ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease' }} />
            </button>
            {openProfileSections.cosmetics && (
              <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--q-line)', paddingTop: 12 }}>
                {ownedCosmetics.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--q-text3)' }}>
                    Aucun cosmétique possédé.{' '}
                    <Link to="/shop" style={{ color: 'var(--q-accent)' }} className="hover:underline">Visiter la boutique</Link>
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {(() => {
                      const equippedBadgeCount = ownedCosmetics.filter(uc => uc.cosmetic.type === 'BADGE' && uc.equipped).length;
                      return ownedCosmetics.map(uc => {
                        const rarityColor = TITLE_CLASSES[uc.cosmetic.rarity] ?? '';
                        const isLoading = cosmeticLoading === uc.cosmeticId;
                        const TypeIcon = TYPE_ICONS[uc.cosmetic.type] ?? Package;
                        const badgeCapped = !uc.equipped && uc.cosmetic.type === 'BADGE' && equippedBadgeCount >= 3;
                        return (
                          <div key={uc.id} className="rounded-2xl p-3 flex flex-col gap-2"
                            style={{ background: 'var(--q-chrome)',
                              border: uc.equipped ? '2px solid var(--q-accent)' : '1px solid var(--q-line)',
                              boxShadow: uc.equipped ? '0 0 0 3px var(--q-accent-soft), var(--q-shadow)' : 'var(--q-shadow)' }}>
                            <div className="text-center">
                              <div className="flex justify-center mb-1" style={{ color: 'var(--q-accent)' }}><TypeIcon size={22} /></div>
                              <p className="font-bold text-xs mt-1 truncate" style={{ color: 'var(--q-text)' }}>{uc.cosmetic.name}</p>
                              <p className={`text-xs font-semibold ${rarityColor}`}>{RARITY_LABELS[uc.cosmetic.rarity]}</p>
                              <p className="text-xs" style={{ color: 'var(--q-text3)' }}>{TYPE_LABELS[uc.cosmetic.type]}</p>
                            </div>
                            {uc.equipped ? (
                              <button onClick={() => handleUnequip(uc.cosmeticId)} disabled={isLoading}
                                className="q-press w-full py-1 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                                style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)' }}>
                                {isLoading ? '...' : 'Déséquiper'}
                              </button>
                            ) : (
                              <button onClick={() => handleEquip(uc.cosmeticId)} disabled={isLoading || badgeCapped}
                                className="q-press w-full py-1 rounded-xl text-xs font-bold disabled:opacity-40"
                                style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent)', cursor: badgeCapped ? 'not-allowed' : 'pointer' }}
                                title={badgeCapped ? 'Maximum 3 badges équipés' : undefined}>
                                {isLoading ? '...' : badgeCapped ? 'Max 3' : 'Équiper'}
                              </button>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      {/* ── Défis ── */}
      {userChallenges.length > 0 && (
        <div style={{ padding: '0 18px', marginTop: 8 }}>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
              <button onClick={() => toggleProfileSection('defis')}
                className="q-press w-full flex items-center gap-3 p-4 text-left"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#FACC15,#FB923C)' }}>
                  <Trophy size={18} color="#fff" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm" style={{ color: 'var(--q-text)' }}>Mes défis</p>
                  <p className="text-xs" style={{ color: 'var(--q-text2)' }}>
                    {totalCompleted || userChallenges.filter(c => c.status === 'COMPLETED').length} complétés · {totalInProgress || userChallenges.filter(c => c.status === 'IN_PROGRESS').length} en cours
                  </p>
                </div>
                <ChevronDown size={16} style={{ color: 'var(--q-text3)', flexShrink: 0,
                  transform: openProfileSections.defis ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease' }} />
              </button>
              {openProfileSections.defis && (
                <div className="border-t" style={{ borderColor: 'var(--q-line)' }}>
                  {sortedUserChallenges.slice(0, 5).map((uc, i) => (
                    <div key={uc.id} className="px-4 py-3 flex items-center justify-between gap-3"
                      style={{ borderTop: i > 0 ? '1px solid var(--q-line)' : 'none' }}>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--q-text)' }}>{uc.challenge.title}</p>
                        {uc.challenge.description && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--q-text2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {uc.challenge.description}
                          </p>
                        )}
                        <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--q-text3)' }}><CircleDollarSign size={10} className="inline flex-shrink-0" /> {uc.challenge.coinReward} · <Zap size={10} className="inline flex-shrink-0" /> {uc.challenge.xpReward} XP</p>
                      </div>
                      {uc.status === 'COMPLETED' ? (
                        <span className="flex items-center gap-1 text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded-full"
                          style={{ background: 'linear-gradient(135deg,#34D399,#38BDF8)', color: '#fff' }}>
                          <CheckCircle size={12} /> Complété
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded-full"
                          style={{ background: 'linear-gradient(135deg,#38BDF8,#A78BFA)', color: '#fff' }}>
                          <Clock size={12} /> En cours
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      {/* ── Historique ── */}
      {userChallenges.length > 0 && (
        <>
          <div style={{ padding: '22px 22px 10px' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--q-display)', letterSpacing: -0.2, color: 'var(--q-text)' }}>Historique</h2>
          </div>
          <div style={{ padding: '0 18px' }}>
            <div style={{ borderRadius: 22, overflow: 'hidden', background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
              {userChallenges.map((uc, i, a) => {
                const ok = uc.status === 'COMPLETED';
                return (
                  <div key={uc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: i < a.length - 1 ? '1px solid var(--q-line)' : 'none' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: ok ? 'rgba(52,211,153,0.18)' : 'rgba(251,146,60,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {ok ? <CheckCircle size={16} style={{ color: '#34D399' }} /> : <Clock size={16} style={{ color: '#FB923C' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--q-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{uc.challenge.title}</div>
                      {uc.challenge.description && (
                        <div style={{ fontSize: 12, color: 'var(--q-text2)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {uc.challenge.description}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--q-text3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {ok ? (
                          <>
                            <span>terminé ·</span>
                            <CircleDollarSign size={11} className="inline flex-shrink-0" /> {uc.challenge.coinReward}
                            <span>·</span>
                            <Zap size={11} className="inline flex-shrink-0" /> {uc.challenge.xpReward} XP
                          </>
                        ) : 'en cours'}
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--q-text3)', flexShrink: 0 }} />
                  </div>
                );
              })}
              {challengesHasMore && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--q-line)' }}>
                  <button onClick={loadMoreChallenges} disabled={loadingMoreChallenges}
                    className="q-press w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
                    style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {loadingMoreChallenges ? 'Chargement…' : `Charger plus (${challengesTotal - userChallenges.length} restants)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Paramètres ── */}
      <div style={{ padding: '22px 22px 10px' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--q-display)', letterSpacing: -0.2, color: 'var(--q-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={20} style={{ color: 'var(--q-accent)' }} /> Paramètres
        </h2>
      </div>
      <div style={{ padding: '0 18px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Apparence */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
          <button onClick={() => setOpenSection(openSection === 'appearance' ? null : 'appearance')}
            className="q-press w-full flex items-center gap-3 p-4 text-left"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--q-accent-soft)' }}>
              <Palette size={18} style={{ color: 'var(--q-accent-deep)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: 'var(--q-text)' }}>Apparence</p>
              <p className="text-xs" style={{ color: 'var(--q-text2)' }}>Thème, couleurs</p>
            </div>
            <ChevronDown size={16} style={{ color: 'var(--q-text3)', flexShrink: 0,
              transform: openSection === 'appearance' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease' }} />
          </button>
          {openSection === 'appearance' && (
            <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--q-line)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {darkMode ? <Moon size={16} style={{ color: 'var(--q-accent)' }} /> : <Sun size={16} style={{ color: 'var(--q-text2)' }} />}
                  <span className="text-sm font-semibold" style={{ color: 'var(--q-text)' }}>Mode sombre</span>
                </div>
                <button onClick={toggleDarkMode} role="switch" aria-checked={darkMode} aria-label="Mode sombre"
                  className="q-press relative flex-shrink-0"
                  style={{ width: 44, height: 26, borderRadius: 13, border: 'none', padding: 0, cursor: 'pointer',
                    background: darkMode ? 'var(--q-accent)' : 'var(--q-line)', transition: 'background 0.2s ease' }}>
                  <span style={{ position: 'absolute', top: 3, left: darkMode ? 21 : 3, width: 20, height: 20,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
          <button onClick={() => setOpenSection(openSection === 'notifications' ? null : 'notifications')}
            className="q-press w-full flex items-center gap-3 p-4 text-left"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#38BDF8,#A78BFA)' }}>
              <Bell size={18} color="#fff" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: 'var(--q-text)' }}>Notifications</p>
              <p className="text-xs" style={{ color: 'var(--q-text2)' }}>
                {Object.values(notifToggles).filter(Boolean).length} active{Object.values(notifToggles).filter(Boolean).length !== 1 ? 's' : ''}
              </p>
            </div>
            <ChevronDown size={16} style={{ color: 'var(--q-text3)', flexShrink: 0,
              transform: openSection === 'notifications' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease' }} />
          </button>
          {openSection === 'notifications' && (
            <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--q-line)' }}>
              {([
                { key: 'defis', label: 'Rappels de défis' },
                { key: 'messages', label: 'Nouveaux messages' },
                { key: 'updates', label: 'Mises à jour & nouveautés' },
              ] as { key: keyof typeof notifToggles; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: 'var(--q-text)' }}>{label}</span>
                  <button onClick={() => setNotifToggles(prev => ({ ...prev, [key]: !prev[key] }))}
                    role="switch" aria-checked={notifToggles[key]} aria-label={label}
                    className="q-press relative flex-shrink-0"
                    style={{ width: 44, height: 26, borderRadius: 13, border: 'none', padding: 0, cursor: 'pointer',
                      background: notifToggles[key] ? 'var(--q-accent)' : 'var(--q-line)', transition: 'background 0.2s ease' }}>
                    <span style={{ position: 'absolute', top: 3, left: notifToggles[key] ? 21 : 3, width: 20, height: 20,
                      borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Accessibilité */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
          <button onClick={() => setOpenSection(openSection === 'accessibility' ? null : 'accessibility')}
            className="q-press w-full flex items-center gap-3 p-4 text-left"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#34D399,#FACC15)' }}>
              <SlidersHorizontal size={18} color="#fff" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: 'var(--q-text)' }}>Accessibilité</p>
              <p className="text-xs" style={{ color: 'var(--q-text2)' }}>Langue, animations</p>
            </div>
            <ChevronDown size={16} style={{ color: 'var(--q-text3)', flexShrink: 0,
              transform: openSection === 'accessibility' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease' }} />
          </button>
          {openSection === 'accessibility' && (
            <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: 'var(--q-line)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: 'var(--q-text)' }}>Langue</span>
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="text-sm rounded-xl px-3 py-1.5 focus:outline-none"
                  style={{ background: 'var(--q-accent-soft)', color: 'var(--q-accent-deep)', border: '1px solid var(--q-line)', fontFamily: 'inherit' }}>
                  {['Français', 'English', 'Español', 'Deutsch'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: 'var(--q-text)' }}>Réduire les animations</span>
                <button onClick={() => setReduceMotion(r => !r)} role="switch" aria-checked={reduceMotion} aria-label="Réduire les animations"
                  className="q-press relative flex-shrink-0"
                  style={{ width: 44, height: 26, borderRadius: 13, border: 'none', padding: 0, cursor: 'pointer',
                    background: reduceMotion ? 'var(--q-accent)' : 'var(--q-line)', transition: 'background 0.2s ease' }}>
                  <span style={{ position: 'absolute', top: 3, left: reduceMotion ? 21 : 3, width: 20, height: 20,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Dashboard admin (visible uniquement pour les admins) ── */}
      {user?.isAdmin && (
        <div style={{ padding: '8px 18px 0' }}>
          <button
            onClick={() => navigate('/admin')}
            className="q-press w-full flex items-center justify-center gap-2"
            style={{ height: 48, borderRadius: 18, border: '1px solid var(--q-accent)',
              background: 'var(--q-accent-soft)', color: 'var(--q-accent-deep)',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            <Lock size={16} /> Dashboard admin
          </button>
        </div>
      )}

      {/* ── Déconnexion ── */}
      <div style={{ padding: '8px 18px 40px' }}>
        <button
          onClick={() => { setUser(null); localStorage.removeItem('token'); navigate('/'); }}
          className="q-press w-full flex items-center justify-center gap-2"
          style={{ height: 48, borderRadius: 18, border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.08)', color: '#EF4444',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <LogOut size={16} /> Se déconnecter
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">{notification?.msg}</div>
      {notification && (
        <output className={`fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-50 px-5 py-3 rounded-2xl shadow-lg text-white font-bold text-sm ${notification.type === 'success' ? '' : 'bg-red-500'}`}
          style={notification.type === 'success' ? { background: 'linear-gradient(135deg,#34D399,#38BDF8)', boxShadow: '0 8px 24px rgba(52,211,153,0.45)' } : {}}>
          {notification.msg}
        </output>
      )}
    </div>
  );
};

export default EditProfile;