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

function detectNewMessages(prev: NotifData, curr: NotifData, myUserId?: number) {
  const prevMap = new Map(prev.groups.map(g => [g.groupId, g.latestMessageId]));
  for (const g of curr.groups) {
    const prevId = prevMap.get(g.groupId);
    if (g.latestMessageId && prevId !== undefined && g.latestMessageId !== prevId && g.latestMessageUserId !== myUserId)
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

function computeBadge(data: NotifData, myUserId: number): number {
  // Friend requests and invites: always actionable — count until user acts.
  // Streak: shown in panel + toast, not in badge (amber bell is the visual cue).
  // Group messages: use "seen" tracking — but never count your own message as unread.
  const seen = JSON.parse(localStorage.getItem(lsSeenKey(myUserId)) ?? '{}');
  const unreadGroups = data.groups.filter(g =>
    g.latestMessageId && g.latestMessageUserId !== myUserId &&
    g.latestMessageId > ((seen.groups?.[String(g.groupId)]) ?? 0)
  ).length;
  return data.pendingFriendRequests + data.pendingSeriesInvites + unreadGroups;
}

// ── main hook ───────────────────────────────────────────────────────────────

export function useNotificationPolling() {
  const { user, setNotifData, setNotifCount } = useStore();
  const prevRef   = useRef<NotifData | null>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    // Repart de zéro à chaque changement de compte (même sans rechargement de page) — sinon
    // le premier poll du nouvel utilisateur se compare aux données en mémoire du précédent
    // et déclenche de faux toasts ("retiré du groupe", "nouvelle demande d'ami"...).
    prevRef.current   = null;
    firstLoad.current = true;
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
            detectNewMessages(prev, data, userId);
            warnStreakIfNeeded(data, prev.streakAtRisk, userId);
          }

          syncGroupsCache(data, isFirst, userId);
          if (isFirst) warnStreakIfNeeded(data, null, userId);

          firstLoad.current = false;
          prevRef.current   = data;
          setNotifData(data);
          setNotifCount(computeBadge(data, userId));
        })
        .catch(() => {});
    };

    load();
    const id = setInterval(load, 5_000);
    return () => clearInterval(id);
  }, [user?.id, setNotifData, setNotifCount]);
}
