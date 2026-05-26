import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Award, ChevronLeft } from 'lucide-react';
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

const fmt = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return n.toLocaleString();
};

const BADGE_GRADS: Record<string, { grad: string; glow: string }> = {
  COMMON:    { grad: 'linear-gradient(135deg,#34D399,#38BDF8)', glow: 'rgba(52,211,153,0.45)' },
  RARE:      { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', glow: 'rgba(56,189,248,0.45)' },
  EPIC:      { grad: 'linear-gradient(135deg,#A78BFA,#EC4899)', glow: 'rgba(167,139,250,0.45)' },
  LEGENDARY: { grad: 'linear-gradient(135deg,#FACC15,#FB923C 50%,#EC4899)', glow: 'rgba(251,146,60,0.55)' },
};

const UserProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/users/${id}/profile`)
      .then(r => { if (r.status === 404) { setNotFound(true); return null; } return r.json(); })
      .then(data => { if (data) setProfile(data); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid transparent',
        borderTopColor: 'var(--q-accent)', borderRightColor: 'var(--q-accent)',
        animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (notFound || !profile) return (
    <div style={{ textAlign: 'center', padding: '60px 24px', fontFamily: 'var(--q-font)' }}>
      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--q-text)', marginBottom: 8 }}>Utilisateur introuvable</p>
      <button onClick={() => navigate(-1)} style={{ fontSize: 14, color: 'var(--q-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Retour</button>
    </div>
  );

  const equippedTitle  = getEquipped(profile.cosmetics, 'TITLE');
  const equippedBanner = getEquipped(profile.cosmetics, 'BANNER');
  const equippedBadges = profile.cosmetics.filter(c => c.cosmetic.type === 'BADGE' && c.equipped);

  const titleClass  = equippedTitle  ? (TITLE_CLASSES[equippedTitle.cosmetic.rarity] ?? '') : '';
  const bannerUrl   = resolveUrl(profile.banner);
  const bannerClass = equippedBanner ? (BANNER_CLASSES[equippedBanner.cosmetic.rarity] ?? '') : '';
  const xpInLevel   = profile.xp % 1000;
  const memberSince = new Date(profile.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div style={{ paddingBottom: 100, color: 'var(--q-text)', fontFamily: 'var(--q-font)' }}>

      {/* ── Banner ── */}
      <div
        className={`-mx-3 md:-mx-6 -mt-4 md:-mt-6 ${bannerUrl ? '' : bannerClass}`}
        style={{
          height: 190, position: 'relative', overflow: 'hidden',
          ...(bannerUrl
            ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: 'var(--q-vibrant-hero)' }),
        }}
      >
        {/* Orbs (shown when no image) */}
        {!bannerUrl && <>
          <div style={{ position: 'absolute', right: -40, top: 20, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: -30, bottom: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', pointerEvents: 'none' }} />
        </>}
        {/* Back button */}
        <button onClick={() => navigate(-1)} className="q-press"
          style={{ position: 'absolute', top: 54, left: 18, width: 40, height: 40, borderRadius: 20,
            background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)' }}>
          <ChevronLeft size={18} color="#1F2030" />
        </button>
      </div>

      {/* ── Avatar + Identity ── */}
      <div style={{ padding: '0 18px', marginTop: -54, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', position: 'relative',
          border: '5px solid var(--q-bg-flat)', borderRadius: '50%',
          boxShadow: '0 8px 24px rgba(167,139,250,0.35)' }}>
          <UserAvatar avatar={profile.avatar} username={profile.username} cosmetics={profile.cosmetics} size="lg" />
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 24, fontFamily: 'var(--q-display)', color: 'var(--q-text)', letterSpacing: -0.3 }}>
              {profile.username}
            </span>
            {equippedBadges.length > 0 && (
              <Award size={18} style={{ color: '#FACC15', flexShrink: 0 }} />
            )}
          </div>
          {equippedTitle && (
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }} className={titleClass}>
              {equippedTitle.cosmetic.name.replace(/^Titre\s*:\s*/i, '')}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--q-text2)', fontWeight: 500, marginTop: 4 }}>
            Membre depuis {memberSince}
          </div>
          {profile.bio && (
            <div style={{ fontSize: 13, color: 'var(--q-text2)', marginTop: 8, maxWidth: 320, margin: '8px auto 0' }}>
              {profile.bio}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--q-accent-soft)', padding: '6px 14px', borderRadius: 999 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--q-accent-deep)',
              textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Niveau {profile.level}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats 3-col ── */}
      <div style={{ padding: '20px 18px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[
          { value: profile.level,                      label: 'Niveau' },
          { value: profile._count.challenges,           label: 'Défis' },
          { value: fmt(profile.xp),                    label: 'XP totale' },
        ].map(({ value, label }) => (
          <div key={label} style={{ borderRadius: 22, padding: 14, textAlign: 'center',
            background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--q-display)',
              color: 'var(--q-text)', letterSpacing: -0.4, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--q-text2)', marginTop: 5, letterSpacing: 0.3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── XP bar ── */}
      <div style={{ padding: '12px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, marginBottom: 5 }}>
          <span style={{ color: 'var(--q-text3)' }}>Vers le niveau {profile.level + 1}</span>
          <span style={{ color: 'var(--q-accent)' }}>{xpInLevel} / 1000 XP</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--q-accent-soft)' }}>
          <div style={{ height: 6, borderRadius: 999, transition: 'width 0.3s ease',
            width: `${xpInLevel / 10}%`, background: 'var(--q-vibrant-hero)' }} />
        </div>
      </div>

      {/* ── Badges équipés ── */}
      {equippedBadges.length > 0 && (
        <>
          <div style={{ padding: '22px 22px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--q-display)', letterSpacing: -0.2, color: 'var(--q-text)' }}>Badges</h2>
            <span style={{ fontSize: 12, color: 'var(--q-text2)', fontWeight: 600 }}>
              {equippedBadges.length} équipé{equippedBadges.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ padding: '0 18px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {equippedBadges.map(uc => {
              const g = BADGE_GRADS[uc.cosmetic.rarity] ?? BADGE_GRADS.COMMON;
              return (
                <div key={uc.cosmeticId} style={{ background: g.grad, position: 'relative', overflow: 'hidden',
                  border: '2px solid rgba(255,255,255,0.45)', borderRadius: 20, padding: '16px 10px 14px', textAlign: 'center',
                  boxShadow: `0 1px 0 rgba(255,255,255,0.35) inset, 0 10px 24px -10px ${g.glow}` }}>
                  <div style={{ position: 'absolute', right: -14, top: -14, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', left: -10, bottom: -16, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
                  <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 22, margin: '0 auto',
                    background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
                    <Award size={22} style={{ color: '#A78BFA' }} />
                  </div>
                  <div style={{ position: 'relative', fontSize: 10, fontWeight: 700, color: '#fff', marginTop: 8, lineHeight: 1.2 }}>
                    {uc.cosmetic.name}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Défis réussis (résumé) ── */}
      <div style={{ padding: '22px 18px 0' }}>
        <div style={{ borderRadius: 22, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--q-chrome)', border: '1px solid var(--q-line)', boxShadow: 'var(--q-shadow)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg,#FACC15,#FB923C)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--q-text)' }}>
              {profile._count.challenges} défi{profile._count.challenges !== 1 ? 's' : ''} complété{profile._count.challenges !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 11, color: 'var(--q-text2)', marginTop: 1 }}>
              {fmt(profile.xp)} XP accumulée
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default UserProfilePage;
