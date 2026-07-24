import { useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import type { NotifData } from '../lib/store';

// Clés localStorage préfixées par userId : sans ça, se connecter à un autre compte sur le
// même navigateur relit l'état (groupes, notifs vues, rappel de streak) du compte précédent
// et déclenche de faux toasts ("tu as été retiré du groupe...") pour des groupes qui
// n'appartiennent même pas au compte actuellement connecté.
const lsGroupsKey      = (userId: number) => `notif_groups_${userId}`;
const lsStreakDateKey  = (userId: number) => `streak_warned_date_${userId}`;
const lsSeenKey        = (userId: number) => `notif_seen_${userId}`;
type SavedGroup = { id: number; name: string };

function fireToast(message: string, type: string, link?: string) {
  globalThis.dispatchEvent(new CustomEvent('notif-toast', { detail: { message, type, link } }));
}

// ── per-poll diff helpers ───────────────────────────────────────────────────

export function detectNewMessages(prev: NotifData, curr: NotifData, myUserId: number, activeGroupChatId: number | null) {
  const prevMap = new Map(prev.groups.map(g => [g.groupId, g.latestMessageId]));
  for (const g of curr.groups) {
    const prevId = prevMap.get(g.groupId);
    // Pas de toast pour le groupe dont le tchat est déjà ouvert (voir GroupChatModal) — le
    // message y apparaît déjà en direct. Et pas de toast non plus si le message est déjà
    // marqué "vu" (même vérif que les badges) : le tchat a pu être fermé juste avant ce poll,
    // entre le moment où GroupChatModal a marqué le message lu et celui où ce poll (toutes les
    // 20s) s'exécute — sans ce check, on se reprend une notif pour un message déjà lu.
    if (g.latestMessageId && prevId !== undefined && g.latestMessageId !== prevId &&
      g.groupId !== activeGroupChatId && isGroupUnread(g, myUserId))
      fireToast(`Nouveau message dans "${g.seriesName}"`, 'message', `/groups/${g.groupId}`);
  }
}

function detectRemovedGroups(prevGroups: NotifData['groups'], currIds: Set<number>) {
  for (const g of prevGroups) {
    if (!currIds.has(g.groupId))
      fireToast(`Tu as été retiré du groupe "${g.seriesName}".`, 'excluded');
  }
}

// ── kick detection via localStorage (catches kicks between sessions) ────────

function syncGroupsCache(data: NotifData, isFirstPoll: boolean, userId: number) {
  const key = lsGroupsKey(userId);
  if (isFirstPoll) {
    const saved: SavedGroup[] = JSON.parse(localStorage.getItem(key) ?? '[]');
    const currIds = new Set(data.groups.map(g => g.groupId));
    for (const sg of saved) {
      if (!currIds.has(sg.id))
        fireToast(`Tu as été retiré du groupe "${sg.name}".`, 'excluded');
    }
  }
  localStorage.setItem(key, JSON.stringify(
    data.groups.map(g => ({ id: g.groupId, name: g.seriesName }))
  ));
}

// ── streak reminder ─────────────────────────────────────────────────────────

function warnStreakIfNeeded(data: NotifData, prevAtRisk: boolean | null, userId: number) {
  if (!data.streakAtRisk || data.streakDays === 0) return;

  if (prevAtRisk === null) {
    // First load: warn once per calendar day
    const key = lsStreakDateKey(userId);
    const today = new Date().toDateString();
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
  } else if (prevAtRisk) {
    // Already at risk last poll — don't spam
    return;
  }

  fireToast(
    `Ta streak de ${data.streakDays}j est en danger ! Fais un défi aujourd'hui.`,
    'streak',
    '/challenges'
  );
}

// ── badge count ─────────────────────────────────────────────────────────────

// Shared with ChallengePage's per-series "new message" badge, so the little red dot on a
// given series and the count on the sidebar bell are always based on the same "seen" state.
export function isGroupUnread(g: NotifData['groups'][number], myUserId: number): boolean {
  const seen = JSON.parse(localStorage.getItem(lsSeenKey(myUserId)) ?? '{}');
  return !!g.latestMessageId && g.latestMessageUserId !== myUserId &&
    g.latestMessageId > ((seen.groups?.[String(g.groupId)]) ?? 0);
}

export function computeBadge(data: NotifData, myUserId: number): number {
  const { friends, challenges } = computeBadgeBreakdown(data, myUserId);
  return friends + challenges;
}

// Même décompte que computeBadge, mais scindé par onglet de nav : les demandes d'ami
// appartiennent à "Amis", les invitations de série + messages non lus à "Défis" — sinon
// une demande d'ami affiche son badge sur l'onglet "Défis", ce qui est trompeur (voir Sidebar).
// Streak : affichée dans le panneau + toast, pas dans un badge de nav (la cloche ambre suffit).
export function computeBadgeBreakdown(data: NotifData, myUserId: number): { friends: number; challenges: number } {
  const unreadGroups = data.groups.filter(g => isGroupUnread(g, myUserId)).length;
  return { friends: data.pendingFriendRequests, challenges: data.pendingSeriesInvites + unreadGroups };
}

// Fusionne les groupes connus entre polls plutôt que de tout remplacer par le contenu du
// dernier poll : /api/notifications ne renvoie pas forcément tous les groupes à chaque appel,
// et un groupe simplement absent d'UN poll ne doit pas repasser "lu" pour autant — sinon le
// badge (cloche + par-série sur ChallengePage) disparaît sans que rien n'ait été lu. Mute `known`
// en place (comme l'appelant s'y attend avec le ref) et retourne aussi la liste à jour.
export function mergeKnownGroups(
  known: Map<number, NotifData['groups'][number]>,
  incoming: NotifData['groups'][number][]
): NotifData['groups'][number][] {
  for (const g of incoming) known.set(g.groupId, g);
  return [...known.values()];
}

// ── main hook ───────────────────────────────────────────────────────────────

export function useNotificationPolling() {
  const { user, setNotifData, setNotifCount, activeGroupChatId } = useStore();
  const prevRef      = useRef<NotifData | null>(null);
  const firstLoad    = useRef(true);
  // `load` ci-dessous est capturé une seule fois par le setInterval (tant que user.id ne change
  // pas) — un ref est nécessaire pour que le polling voie la valeur à jour de activeGroupChatId
  // à chaque tick, plutôt que celle figée au moment où l'effet a démarré.
  const activeGroupChatIdRef = useRef<number | null>(null);
  activeGroupChatIdRef.current = activeGroupChatId;
  // Accumule les groupes connus entre polls, par groupId : /api/notifications ne renvoie pas
  // forcément TOUS les groupes à chaque appel (ex: portée limitée aux groupes récemment actifs),
  // et un groupe simplement absent d'un poll ne doit pas repasser "lu" pour autant — sinon le
  // badge (cloche + par-série sur ChallengePage) disparaît sans que rien n'ait été lu. La
  // détection d'exclusion de groupe, elle, continue d'utiliser les données brutes du poll
  // (prev/curr ci-dessous), pas cet accumulateur qui ne rétrécit jamais.
  const knownGroupsRef = useRef<Map<number, NotifData['groups'][number]>>(new Map());

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    // Repart de zéro à chaque changement de compte (même sans rechargement de page) — sinon
    // le premier poll du nouvel utilisateur se compare aux données en mémoire du précédent
    // et déclenche de faux toasts ("retiré du groupe", "nouvelle demande d'ami"...).
    prevRef.current   = null;
    firstLoad.current = true;
    knownGroupsRef.current = new Map();
    const userId = user.id;

    const load = () => {
      fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then((data: NotifData | null) => {
          if (!data) return;
          const prev    = prevRef.current;
          const isFirst = firstLoad.current;

          if (!isFirst && prev) {
            const currIds = new Set(data.groups.map(g => g.groupId));
            if (data.pendingFriendRequests > prev.pendingFriendRequests)
              fireToast("Nouvelle demande d'ami !", 'friend', '/friends');
            if (data.pendingSeriesInvites > prev.pendingSeriesInvites)
              fireToast("Tu as été invité dans un groupe série !", 'invite', '/challenges');
            detectRemovedGroups(prev.groups, currIds);
            detectNewMessages(prev, data, userId, activeGroupChatIdRef.current);
            warnStreakIfNeeded(data, prev.streakAtRisk, userId);
          }

          syncGroupsCache(data, isFirst, userId);
          if (isFirst) warnStreakIfNeeded(data, null, userId);

          firstLoad.current = false;
          prevRef.current   = data;

          const merged: NotifData = { ...data, groups: mergeKnownGroups(knownGroupsRef.current, data.groups) };
          setNotifData(merged);
          setNotifCount(computeBadge(merged, userId));
        })
        .catch(() => {});
    };

    // 20s (au lieu de 5s) : un poll toutes les 5s par onglet ouvert multipliait
    // inutilement la charge serveur pour un besoin qui n'est pas temps réel.
    // On coupe aussi l'intervalle en arrière-plan — un onglet caché n'a pas besoin
    // de vérifier les notifications, et on relance immédiatement au retour au premier plan.
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!id) id = setInterval(load, 20_000); };
    const stop  = () => { if (id) { clearInterval(id); id = null; } };
    const onVisibilityChange = () => {
      if (document.hidden) { stop(); return; }
      load();
      start();
    };

    load();
    start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // user?.id (pas l'objet user entier) est volontaire : ne relancer le polling que si le
    // compte connecté change, pas à chaque mise à jour d'un autre champ (coins, xp...).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, setNotifData, setNotifCount]);
}
