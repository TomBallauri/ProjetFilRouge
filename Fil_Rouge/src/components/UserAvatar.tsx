import React from 'react';
import { getEquipped } from '../lib/cosmetics';
import type { EquippedCosmetic } from '../lib/cosmetics';

const FRAME_RINGS: Record<string, string> = {
  COMMON:    'ring-2 ring-gray-400',
  RARE:      'ring-2 ring-blue-400',
  EPIC:      'ring-2 ring-purple-500 shadow-md shadow-purple-500/40',
  LEGENDARY: 'ring-2 ring-yellow-400 shadow-md shadow-yellow-400/50',
};

function resolveUrl(url?: string): string {
  // /uploads/... est proxifié vers le backend (vite en dev, vercel.json en prod) —
  // pas besoin de préfixer une origine en dur.
  return url ?? '';
}

type Size = 'xs' | 'sm' | 'md' | 'xl' | 'lg' | '2xl';

const SIZE_MAP: Record<Size, { box: string; text: string }> = {
  xs:  { box: 'w-7 h-7',   text: 'text-[10px]' },
  sm:  { box: 'w-8 h-8',   text: 'text-xs' },
  md:  { box: 'w-10 h-10', text: 'text-sm' },
  xl:  { box: 'w-14 h-14', text: 'text-lg' },
  lg:  { box: 'w-16 h-16', text: 'text-xl' },
  '2xl': { box: 'w-20 h-20', text: 'text-2xl' },
};

type Props = {
  avatar?: string;
  username: string;
  cosmetics?: EquippedCosmetic[];
  size?: Size;
  rankFrame?: string;
  className?: string;
};

const UserAvatar: React.FC<Props> = ({
  avatar, username, cosmetics = [], size = 'md', rankFrame = '', className = ''
}) => {
  const equippedFrame = getEquipped(cosmetics, 'AVATAR_FRAME');
  const hasImageFrame = !!equippedFrame?.cosmetic.imageUrl;

  let ringClass = rankFrame;
  if (equippedFrame && !hasImageFrame) ringClass = FRAME_RINGS[equippedFrame.cosmetic.rarity] ?? '';
  if (hasImageFrame) ringClass = '';

  const avatarUrl = resolveUrl(avatar);
  const { box, text } = SIZE_MAP[size];

  return (
    <div className={`relative flex-shrink-0 ${box} rounded-full ${ringClass} ${className}`}>
      <div
        className={`absolute rounded-full overflow-hidden bg-gray-300 ${hasImageFrame ? 'inset-[12.5%]' : 'inset-0'}`}
      >
        {/* Cadre image = décor 288×288 carré plaqué sur une photo au masque circulaire.
            Même inset (12.5%) que ProfilePage.tsx/ShopPage.tsx pour une taille de décor cohérente partout. */}
        {avatarUrl
          ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
          : <div className={`w-full h-full flex items-center justify-center font-bold ${text} text-gray-600`}>
              {username[0]?.toUpperCase()}
            </div>
        }
      </div>

      {hasImageFrame && equippedFrame?.cosmetic.imageUrl && (
        <img
          src={resolveUrl(equippedFrame.cosmetic.imageUrl)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-10"
          style={{ objectFit: 'fill' }}
        />
      )}
    </div>
  );
};

export default UserAvatar;
