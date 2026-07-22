import { prisma } from './prisma.js';

// Guard : renvoie false si le client Prisma n'a pas encore été régénéré
export const seriesGroupReady = () => !!prisma.seriesGroup;
export const sgMsgReady = () => !!prisma.seriesGroupMessage;

// Les invitations de groupe (série ou défi) expirent 24h après leur envoi
export const GROUP_INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const isInviteExpired = (invitedAt) => Date.now() - new Date(invitedAt).getTime() > GROUP_INVITE_TTL_MS;

// Nettoyage paresseux : supprime les invitations INVITED devenues obsolètes avant de lire/écrire les groupes
export async function expireStaleInvites() {
  const cutoff = new Date(Date.now() - GROUP_INVITE_TTL_MS);
  await Promise.all([
    seriesGroupReady()
      ? prisma.seriesGroupMember.deleteMany({ where: { status: 'INVITED', invitedAt: { lt: cutoff } } })
      : Promise.resolve(),
    prisma.challengeGroupMember.deleteMany({ where: { status: 'INVITED', invitedAt: { lt: cutoff } } }),
  ]);
}

// Pour le listing (pas de messages — chargés séparément à l'ouverture du chat)
export const GROUP_LIST_INCLUDE = {
  challenge: { select: { id: true, title: true, description: true, difficulty: true, category: true, coinReward: true, xpReward: true } },
  creator: { select: { id: true, username: true, avatar: true } },
  members: {
    include: { user: { select: { id: true, username: true, avatar: true } } },
    orderBy: { invitedAt: 'asc' }
  },
};

export const GROUP_INCLUDE = {
  ...GROUP_LIST_INCLUDE,
  messages: {
    include: { user: { select: { id: true, username: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
    take: 50
  }
};
