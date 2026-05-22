import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Zap, Trophy, ArrowLeft, CheckCircle } from 'lucide-react';
import { BANNER_CLASSES, TITLE_CLASSES, getEquipped } from '../lib/cosmetics';
import type { EquippedCosmetic } from '../lib/cosmetics';
import UserAvatar from '../components/UserAvatar';

const BACKEND_URL = 'http://localhost:3001';

type PublicUser = {
  id: number;
  username: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  xp: number;
  level: number;
  createdAt: string;
  cosmetics: EquippedCosmetic[];
  _count: { challenges: number };
};

function resolveUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return `${BACKEND_URL}${url}`;
  return url;
}

type StatBoxProps = { value: React.ReactNode; label: React.ReactNode; color: string };
const StatBox: React.FC<StatBoxProps> = ({ value, label, color }) => (
  <div className={`rounded-xl p-3 text-center ${color}`}>
    <div className="text-xl font-bold flex items-center justify-center gap-1">{value}</div>
    <div className="text-xs font-semibold">{label}</div>
  </div>
);

type XpBarProps = { level: number; xpInLevel: number; darkMode: boolean };
const XpBar: React.FC<XpBarProps> = ({ level, xpInLevel, darkMode }) => (
  <div>
    <div className="flex justify-between text-xs font-semibold mb-1">
      <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Niveau {level} → {level + 1}</span>
      <span className={darkMode ? 'text-purple-400' : 'text-purple-600'}>{xpInLevel} / 1000 XP</span>
    </div>
    <div className={`w-full h-2 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
      <div className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
        style={{ width: `${xpInLevel / 10}%` }} />
    </div>
  </div>
);

async function loadProfile(id: string): Promise<{ data: PublicUser | null; notFound: boolean }> {
  const r = await fetch(`/api/users/${id}/profile`);
  if (r.status === 404) return { data: null, notFound: true };
  return { data: await r.json(), notFound: false };
}

const UserProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { darkMode } = useStore();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadProfile(id)
      .then(({ data, notFound: nf }) => { setNotFound(nf); setProfile(data); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
    </div>
  );

  if (notFound || !profile) return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-lg font-bold mb-2">Utilisateur introuvable</p>
      <button onClick={() => navigate(-1)} className="text-blue-500 hover:underline text-sm">Retour</button>
    </div>
  );

  const equippedTitle  = getEquipped(profile.cosmetics, 'TITLE');
  const equippedBadge  = getEquipped(profile.cosmetics, 'BADGE');
  const equippedBanner = getEquipped(profile.cosmetics, 'BANNER');

  const titleClass  = equippedTitle  ? TITLE_CLASSES[equippedTitle.cosmetic.rarity]   ?? '' : '';
  const bannerUrl   = resolveUrl(profile.banner);
  const bannerClass = equippedBanner ? BANNER_CLASSES[equippedBanner.cosmetic.rarity] ?? '' : '';
  const bannerBg    = bannerUrl ? '' : bannerClass;
  const bannerStyle = bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : {};
  const xpInLevel   = profile.xp % 1000;
  const card        = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const memberSince = new Date(profile.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className={`px-3 py-4 md:p-6 min-h-screen ${darkMode ? 'text-white' : 'text-gray-900'}`}>
      <button onClick={() => navigate(-1)}
        className={`flex items-center gap-1.5 mb-5 text-sm font-medium ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
        <ArrowLeft size={16} /> Retour
      </button>

      <div className={`${card} border rounded-2xl overflow-hidden shadow-md max-w-2xl mx-auto`}>
        <div className={`h-36 bg-cover bg-center ${bannerBg}`} style={bannerStyle} />

        <div className="px-6 pb-6">
          <div className="flex items-start gap-4 -mt-10 mb-4">
            <UserAvatar avatar={profile.avatar} username={profile.username} cosmetics={profile.cosmetics} size="lg" darkBorder={darkMode} />
            <div className="pt-10 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold truncate">{profile.username}</h1>
                {equippedBadge && <span className="text-lg" title={equippedBadge.cosmetic.name}>🏅</span>}
              </div>
              {equippedTitle && (
                <p className={`text-xs font-semibold mt-0.5 ${titleClass}`}>{equippedTitle.cosmetic.name}</p>
              )}
              <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Membre depuis {memberSince}
              </p>
            </div>
          </div>

          {profile.bio && (
            <p className={`text-sm mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{profile.bio}</p>
          )}

          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatBox value={profile.level} label={<><Zap size={11} /> Niveau</>} color={darkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-50 text-purple-700'} />
            <StatBox value={<><CheckCircle size={16} />{profile._count.challenges}</>} label="Défis" color={darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'} />
            <StatBox value={<><Trophy size={16} />{profile.xp.toLocaleString()}</>} label="XP total" color={darkMode ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-50 text-yellow-700'} />
          </div>

          <XpBar level={profile.level} xpInLevel={xpInLevel} darkMode={darkMode} />
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
