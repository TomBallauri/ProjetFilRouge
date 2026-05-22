import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { Mail, Calendar, Edit, Save, X, Trophy, Zap, CheckCircle, Clock, ShoppingBag } from 'lucide-react';
import type { User } from '../types/User';
import { useNavigate, Link } from 'react-router-dom';
import { FRAME_CLASSES, BANNER_CLASSES, TITLE_CLASSES, getEquipped } from '../lib/cosmetics';
import type { EquippedCosmetic } from '../lib/cosmetics';

type OwnedCosmetic = EquippedCosmetic & { id: number; purchasedAt: string };

const TYPE_LABELS: Record<string, string> = {
  AVATAR_FRAME: "Cadre d'avatar", BANNER: 'Bannière', BADGE: 'Badge', TITLE: 'Titre',
};
const TYPE_EMOJIS: Record<string, string> = {
  AVATAR_FRAME: '🖼️', BANNER: '🏳️', BADGE: '🏅', TITLE: '📛',
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
    category: string;
    difficulty: string;
    coinReward: number;
    xpReward: number;
  };
};

const fmt = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return n.toLocaleString();
};

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BACKEND_URL = "http://localhost:3001";

const EditProfile: React.FC = () => {
  const { user, darkMode, setUser } = useStore() as { user: User | null; darkMode: boolean; setUser: (u: User) => void };
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
    banner: user?.banner || ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [emailError, setEmailError] = useState('');

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
        email: user.email || '',
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

  const [recentActivities, setRecentActivities] = useState<{ id: number; title: string; content: string; date: string }[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [ownedCosmetics, setOwnedCosmetics] = useState<OwnedCosmetic[]>([]);
  const [cosmeticLoading, setCosmeticLoading] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;
    fetch('/api/users/me/challenges', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setUserChallenges(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch('/api/users/me/cosmetics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setOwnedCosmetics(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user]);

  const refreshCosmetics = async (token: string) => {
    const data = await fetch('/api/users/me/cosmetics', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    setOwnedCosmetics(Array.isArray(data) ? data : []);
    globalThis.dispatchEvent(new CustomEvent('cosmetics-updated'));
  };

  const handleEquip = async (cosmeticId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setCosmeticLoading(cosmeticId);
    try {
      const res = await fetch(`/api/users/me/cosmetics/${cosmeticId}/equip`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error ?? "Erreur lors de l'équipement");
        return;
      }
      await refreshCosmetics(token);
    } catch {
      alert('Erreur réseau lors de l\'équipement');
    } finally {
      setCosmeticLoading(null);
    }
  };

  const handleUnequip = async (cosmeticId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setCosmeticLoading(cosmeticId);
    try {
      const res = await fetch(`/api/users/me/cosmetics/${cosmeticId}/unequip`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error ?? 'Erreur lors du déséquipement');
        return;
      }
      await refreshCosmetics(token);
    } catch {
      alert('Erreur réseau lors du déséquipement');
    } finally {
      setCosmeticLoading(null);
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, email: value }));
    setEmailError(validateEmail(value) ? '' : 'Adresse email invalide.');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordSave = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      alert("Veuillez remplir tous les champs.");
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
        alert(data.error || "Erreur lors du changement de mot de passe");
        return;
      }
      alert("Mot de passe mis à jour avec succès !");
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      alert("Erreur réseau lors du changement de mot de passe");
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
      body: form,
    });
    if (!res.ok) throw new Error('Erreur upload');
    const data = await res.json();
    return `${BACKEND_URL}${data.url}`;
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

  const getFullImageUrl = (url: string | undefined | null) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads/')) return `${BACKEND_URL}${url}`;
    return url;
  };

  useEffect(() => {
    const fetchUserTopics = async () => {
      if (!user) return;
      try {
        // Récupère tous les topics créés par le user (createdBy)
        const res = await fetch(`/api/users/${user.id}/topics`);
        if (!res.ok) return;
        const topics = await res.json();
        setRecentActivities(
          topics.map((topic: any) => ({
            id: topic.id,
            title: topic.title,
            content: topic.content ? topic.content.slice(0, 80) + (topic.content.length > 80 ? "..." : "") : "",
            date: new Date(topic.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
          }))
        );
      } catch {}
    };
    fetchUserTopics();
  }, [user]);
  
  const handleDeleteTopic = async (topicId: number) => {
    if (!window.confirm("Supprimer ce topic ? Cette action est irréversible.")) return;
    try {
      const res = await fetch(`/api/topics/${topicId}/${user?.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setRecentActivities(acts => acts.filter(a => a.id !== topicId));
        alert("Topic supprimé !");
      } else {
        alert("Erreur lors de la suppression.");
      }
    } catch {
      alert("Erreur réseau lors de la suppression.");
    }
  };

  const equippedFrame  = getEquipped(ownedCosmetics, 'AVATAR_FRAME');
  const equippedTitle  = getEquipped(ownedCosmetics, 'TITLE');
  const equippedBadge  = getEquipped(ownedCosmetics, 'BADGE');
  const equippedBanner = getEquipped(ownedCosmetics, 'BANNER');
  const frameClass  = equippedFrame  ? (FRAME_CLASSES[equippedFrame.cosmetic.rarity]   ?? '') : '';
  const titleClass  = equippedTitle  ? (TITLE_CLASSES[equippedTitle.cosmetic.rarity]   ?? '') : '';
  const bannerClass = equippedBanner ? (BANNER_CLASSES[equippedBanner.cosmetic.rarity] ?? '') : '';
  const hasBannerImage = !!(bannerPreview || formData.banner || user?.banner);

  if (!user) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold mb-4">Profil non disponible</h1>
        <p className="mb-6">Veuillez vous connecter pour voir votre profil.</p>
        <a 
          href="/login" 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Connexion
        </a>
      </div>
    );
  }

  return (
    <div className={`p-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg overflow-hidden`}>
        <div
          className={`h-48 bg-cover bg-center relative group cursor-pointer ${!hasBannerImage ? bannerClass : ''}`}
          style={hasBannerImage ? {
            backgroundImage: `url(${bannerPreview || getFullImageUrl(formData.banner) || getFullImageUrl(user.banner)})`
          } : {}}
          onClick={() => isEditing && bannerInputRef.current?.click()}
        >
          {isEditing && (
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={e => handleFileChange(e, 'banner')}
            />
          )}
          {isEditing && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer">
              <Edit size={32} className="text-white" />
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent"></div>
        </div>

        <div className="relative px-6 pb-6">
          <div className="flex items-center -mt-12">
            <div className="relative group">
              <div
                className={`w-24 h-24 rounded-full border-4 border-white dark:border-gray-800 overflow-hidden bg-gray-100 cursor-pointer ${equippedFrame?.cosmetic.imageUrl ? '' : frameClass}`}
                onClick={() => isEditing && avatarInputRef.current?.click()}
              >
                <img
                  src={
                    avatarPreview ||
                    getFullImageUrl(formData.avatar) ||
                    getFullImageUrl(user.avatar)
                  }
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
                {isEditing && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer">
                    <Edit size={28} className="text-white" />
                  </div>
                )}
              </div>
              {equippedFrame?.cosmetic.imageUrl && (
                <img
                  src={equippedFrame.cosmetic.imageUrl}
                  alt=""
                  className="absolute pointer-events-none select-none z-10"
                  style={{ inset: '-14px', width: 'calc(100% + 28px)', height: 'calc(100% + 28px)' }}
                />
              )}
              {isEditing && (
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={e => handleFileChange(e, 'avatar')}
                />
              )}
            </div>
            <div className="ml-4 pt-12">
              {isEditing ? (
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="text-2xl font-bold bg-transparent border-b border-blue-500 focus:outline-none"
                />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{user.username}</h1>
                  {equippedBadge && <span className="text-lg" title={equippedBadge.cosmetic.name}>🏅</span>}
                </div>
              )}
              {equippedTitle && (
                <p className={`text-xs font-semibold mt-0.5 ${titleClass}`}>{equippedTitle.cosmetic.name}</p>
              )}
            </div>
          </div>
          
          <div className="pt-6">
            {isEditing ? (
              <div className="flex space-x-2">
                <button 
                  onClick={handleSave}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center hover:bg-green-700 transition-colors"
                >
                  <Save size={16} className="mr-2" />
                  Enregistrer
                </button>
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setAvatarPreview(null);
                    setBannerPreview(null);
                    setAvatarFile(null);
                    setBannerFile(null);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center hover:bg-red-700 transition-colors"
                >
                  <X size={16} className="mr-2" />
                  Annuler
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center hover:bg-blue-700 transition-colors"
              >
                <Edit size={16} className="mr-2" />
                Modifier le profil
              </button>
            )}
          </div>
        </div>

        {/* Gamification stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 mt-6">
          <div className={`rounded-xl p-4 text-center ${darkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>
            <div className="text-2xl font-bold">{user.level ?? 1}</div>
            <div className="text-xs font-semibold mt-0.5 flex items-center justify-center gap-1">
              <Zap size={12} /> Niveau
            </div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-purple-400' : 'text-purple-500'}`}>
              {fmt(user.xp ?? 0)} XP
            </div>
          </div>
          <div className={`rounded-xl p-4 text-center ${darkMode ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-50 text-yellow-700'}`}>
            <div className="text-2xl font-bold truncate">{fmt(user.coins ?? 0)}</div>
            <div className="text-xs font-semibold mt-0.5">🪙 Coins</div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-yellow-400' : 'text-yellow-500'}`}>
              Monnaie virtuelle
            </div>
          </div>
          <div className={`rounded-xl p-4 text-center ${darkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700'}`}>
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              <CheckCircle size={20} />
              {userChallenges.filter(c => c.status === 'COMPLETED').length}
            </div>
            <div className="text-xs font-semibold mt-0.5">Défis complétés</div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-green-400' : 'text-green-500'}`}>
              {userChallenges.length} au total
            </div>
          </div>
          <div className={`rounded-xl p-4 text-center ${darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              <Clock size={20} />
              {userChallenges.filter(c => c.status === 'IN_PROGRESS').length}
            </div>
            <div className="text-xs font-semibold mt-0.5">En cours</div>
            <div className={`text-xs mt-1 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`}>
              Défis actifs
            </div>
          </div>
        </div>

        {/* XP progress bar */}
        <div className="px-6 mt-4">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Progression vers le niveau {(user.level ?? 1) + 1}</span>
            <span className={darkMode ? 'text-purple-400' : 'text-purple-600'}>{(user.xp ?? 0) % 1000} / 1000 XP</span>
          </div>
          <div className={`w-full h-2 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <div
              className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
              style={{ width: `${((user.xp ?? 0) % 1000) / 10}%` }}
            />
          </div>
        </div>

        {/* Cosmétiques */}
        <div className="px-6 mt-6 mb-2">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <ShoppingBag size={20} className="text-pink-500" /> Mes cosmétiques
          </h2>
          {ownedCosmetics.length === 0 ? (
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Aucun cosmétique possédé.{' '}
              <Link to="/shop" className="text-pink-500 hover:underline">Visiter la boutique</Link>
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {ownedCosmetics.map(uc => {
                const rarityColor = TITLE_CLASSES[uc.cosmetic.rarity] ?? 'text-gray-400';
                const isLoading = cosmeticLoading === uc.cosmeticId;
                const equippedBorder = uc.equipped
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white';
                return (
                  <div key={uc.id} className={`rounded-xl border-2 p-3 flex flex-col gap-2 ${equippedBorder}`}>
                    <div className="text-center">
                      <span className="text-2xl">{TYPE_EMOJIS[uc.cosmetic.type] ?? '🎁'}</span>
                      <p className="font-bold text-xs mt-1 truncate">{uc.cosmetic.name}</p>
                      <p className={`text-xs ${rarityColor}`}>{RARITY_LABELS[uc.cosmetic.rarity]}</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{TYPE_LABELS[uc.cosmetic.type]}</p>
                    </div>
                    {uc.equipped ? (
                      <button onClick={() => handleUnequip(uc.cosmeticId)} disabled={isLoading}
                        className="w-full py-1 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60">
                        {isLoading ? '...' : 'Déséquiper'}
                      </button>
                    ) : (
                      <button onClick={() => handleEquip(uc.cosmeticId)} disabled={isLoading}
                        className="w-full py-1 rounded-lg text-xs font-bold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-60">
                        {isLoading ? '...' : 'Équiper'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 ml-6 mr-6 mb-6 ">
          <div className="md:col-span-2 space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Informations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Mail className="text-gray-400" size={20} />
                  {isEditing ? (
                    <div className="w-full">
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleEmailChange}
                        className="bg-transparent border-b border-blue-500 focus:outline-none flex-1 w-full"
                      />
                      {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
                    </div>
                  ) : (
                    <span>{user.email}</span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <Calendar className="text-gray-400" size={20} />
                  <span>Membre depuis {profileStats.memberSince}</span>
                </div>
              </div>
              
              <div className="mt-4">
                {user.isAdmin && (
                  <div className="mb-2 px-3 py-2 rounded bg-purple-100 text-purple-800 font-semibold w-fit">
                    Ce compte est administrateur
                  </div>
                )}
                <h3 className="text-lg font-medium mb-2">Bio</h3>
                {isEditing ? (
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    className="w-full bg-transparent border border-blue-500 rounded-lg p-2 focus:outline-none"
                    rows={3}
                  />
                ) : (
                  <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {user.bio}
                  </p>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4">Modifier le mot de passe</h2>
                <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 space-y-4`}>
                  <div>
                    <label className="block text-sm font-medium mb-1">Mot de passe actuel</label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className="w-full px-3 py-2 rounded-md bg-transparent border border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nouveau mot de passe</label>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className="w-full px-3 py-2 rounded-md bg-transparent border border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Confirmer le nouveau mot de passe</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className="w-full px-3 py-2 rounded-md bg-transparent border border-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handlePasswordSave}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Enregistrer le mot de passe
                  </button>
                </div>
              </div>
            )}

            {/* Challenges history */}
            {userChallenges.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Trophy size={20} className="text-yellow-500" /> Vos défis
                </h2>
                <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg divide-y ${darkMode ? 'divide-gray-600' : 'divide-gray-200'}`}>
                  {userChallenges.slice(0, 5).map(uc => (
                    <div key={uc.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{uc.challenge.title}</p>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          🪙 {uc.challenge.coinReward} · ⚡ {uc.challenge.xpReward} XP
                        </p>
                      </div>
                      {uc.status === 'COMPLETED' ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400 flex-shrink-0">
                          <CheckCircle size={14} /> Complété
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
                          <Clock size={14} /> En cours
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold mb-4">Vos topics récents</h2>
              <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg divide-y ${darkMode ? 'divide-gray-600' : 'divide-gray-200'}`}>
                {recentActivities.length === 0 && (
                  <div className="p-4 text-gray-400">Aucun topic créé récemment.</div>
                )}
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="p-4 flex justify-between items-center w-full hover:bg-blue-50 dark:hover:bg-gray-600 transition"
                  >
                    <button
                      className="flex-1 text-left"
                      onClick={() => navigate(`/tchat/${activity.id}`)}
                      style={{ cursor: "pointer" }}
                      type="button"
                    >
                      <span className="font-semibold">{activity.title}</span>
                      {activity.content && (
                        <span className="ml-2 text-gray-500 italic">– {activity.content}</span>
                      )}
                      <span className="ml-2 text-sm text-gray-500">{activity.date}</span>
                    </button>
                    <button
                      className="ml-3 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition w-9 h-9"
                      onClick={e => {
                        e.stopPropagation();
                        navigate(`/tchat/${activity.id}`, { state: { openEdit: true } });
                      }}
                      title="Modifier"
                      type="button"
                    >
                      <Edit size={20} />
                    </button>
                    <button
                      className="ml-2 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition w-9 h-9"
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteTopic(activity.id);
                      }}
                      title="Supprimer"
                      type="button"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;