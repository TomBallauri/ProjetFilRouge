import React from 'react';
import { getEquipped } from '../lib/cosmetics';
import type { EquippedCosmetic } from '../lib/cosmetics';

const BACKEND_URL = 'http://localhost:3001';

// Compact rings (no ring-offset to avoid white gap on dark backgrounds)
const FRAME_RINGS: Record<string, string> = {
  COMMON:    'ring-2 ring-gray-400',
  RARE:      'ring-2 ring-blue-400',
  EPIC:      'ring-2 ring-purple-500 shadow-md shadow-purple-500/40',
  LEGENDARY: 'ring-2 ring-yellow-400 shadow-md shadow-yellow-400/50',
};

export const RANK_FRAME_CLASSES: Record<number, string> = {
  1: 'ring-2 ring-yellow-400 shadow-md shadow-yellow-400/40',
  2: 'ring-2 ring-gray-300',
  3: 'ring-2 ring-orange-400',
};

function resolveUrl(avatar?: string): string {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/uploads/')) return `${BACKEND_URL}${avatar}`;
  return avatar;
}

type Size = 'sm' | 'md' | 'xl' | 'lg';

const SIZE_MAP: Record<Size, { box: string; text: string; offset: number }> = {
  sm: { box: 'w-8 h-8',   text: 'text-xs', offset: 8  },
  md: { box: 'w-10 h-10', text: 'text-sm', offset: 10 },
  xl: { box: 'w-14 h-14', text: 'text-lg', offset: 12 },
  lg: { box: 'w-16 h-16', text: 'text-xl', offset: 14 },
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
  const hasImageFrame  = !!equippedFrame?.cosmetic.imageUrl;
  // Ring class: equipped CSS frame > rank default. Image frame = no ring needed.
  let ringClass = rankFrame;
  if (equippedFrame && !hasImageFrame) ringClass = FRAME_RINGS[equippedFrame.cosmetic.rarity] ?? '';
  if (hasImageFrame) ringClass = '';
  const avatarUrl = resolveUrl(avatar);
  const { box, text, offset } = SIZE_MAP[size];

  return (
    // Ring is on the OUTER div with rounded-full — NOT clipped by overflow-hidden
    <div className={`relative flex-shrink-0 ${box} rounded-full ${ringClass} ${className}`}>
      <div className="w-full h-full rounded-full overflow-hidden bg-gray-300">
        {avatarUrl
          ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
          : <div className={`w-full h-full flex items-center justify-center font-bold ${text} text-gray-600`}>{username[0]?.toUpperCase()}</div>
        }
      </div>
      {hasImageFrame && equippedFrame?.cosmetic.imageUrl && (
        <img
          src={resolveUrl(equippedFrame.cosmetic.imageUrl)}
          alt=""
          className="absolute pointer-events-none select-none z-10"
          style={{ inset: `-${offset}px`, width: `calc(100% + ${offset * 2}px)`, height: `calc(100% + ${offset * 2}px)`, objectFit: 'fill' }}
        />
      )}
    </div>
  );
};

export default UserAvatar;
