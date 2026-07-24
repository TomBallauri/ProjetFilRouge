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

type Size = 'xs' | 'sm' | 'md' | 'xl' | 'lg';

// frameInset: how many px the avatar shrinks inward to leave room for the frame image.
// The frame fills the full outer div — no negative insets, no overflow issues.
const SIZE_MAP: Record<Size, { box: string; text: string; frameInset: number }> = {
  xs: { box: 'w-7 h-7',   text: 'text-[10px]', frameInset: 2 },
  sm: { box: 'w-8 h-8',   text: 'text-xs', frameInset: 3 },
  md: { box: 'w-10 h-10', text: 'text-sm', frameInset: 3 },
  xl: { box: 'w-14 h-14', text: 'text-lg', frameInset: 4 },
  lg: { box: 'w-16 h-16', text: 'text-xl', frameInset: 5 },
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
  const { box, text, frameInset } = SIZE_MAP[size];

  // When a frame image is equipped, shrink the avatar inward so the frame
  // fits entirely within the outer div — no overflow, no cropping.
  const avatarInset = hasImageFrame ? frameInset : 0;

  return (
    <div className={`relative flex-shrink-0 ${box} rounded-full ${ringClass} ${className}`}>
      <div
        className="absolute rounded-full overflow-hidden bg-gray-300"
        style={{ inset: `${avatarInset}px` }}
      >
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
