export type EquippedCosmetic = {
  cosmeticId: number;
  equipped: boolean;
  cosmetic: {
    id: number;
    name: string;
    type: string;
    rarity: string;
    imageUrl?: string;
  };
};

// CSS ring classes for AVATAR_FRAME rarity
export const FRAME_CLASSES: Record<string, string> = {
  COMMON:    'ring-4 ring-offset-2 ring-gray-400',
  RARE:      'ring-4 ring-offset-2 ring-blue-400',
  EPIC:      'ring-4 ring-offset-2 ring-purple-500 shadow-lg shadow-purple-500/40',
  LEGENDARY: 'ring-4 ring-offset-2 ring-yellow-400 shadow-lg shadow-yellow-400/50',
};

// Banner gradient classes for BANNER rarity
export const BANNER_CLASSES: Record<string, string> = {
  COMMON:    'bg-gradient-to-r from-gray-400 to-gray-600',
  RARE:      'bg-gradient-to-r from-blue-500 to-cyan-600',
  EPIC:      'bg-gradient-to-r from-purple-600 to-pink-600',
  LEGENDARY: 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500',
};

// Title text color based on rarity
export const TITLE_CLASSES: Record<string, string> = {
  COMMON:    'text-gray-400',
  RARE:      'text-blue-400',
  EPIC:      'text-purple-400',
  LEGENDARY: 'text-yellow-400',
};

export function getEquipped(cosmetics: EquippedCosmetic[], type: string) {
  return cosmetics.find(c => c.cosmetic.type === type && c.equipped) ?? null;
}
