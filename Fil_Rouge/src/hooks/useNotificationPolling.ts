import { useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import type { NotifData } from '../lib/store';

const LS_GROUPS       = 'notif_groups';
const LS_STREAK_DATE  = 'streak_warned_date';
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

function syncGroupsCache(data: NotifData, isFirstPoll: boolean) {
  if (isFirstPoll) {
    const saved: SavedGroup[] = JSON.parse(localStorage.getItem(LS_GROUPS) ?? '[]');
    const currIds = new Set(data.groups.map(g => g.groupId));
    for (const sg of saved) {
      if (!currIds.has(sg.id))
        fireToast(`Tu as été retiré du groupe "${sg.name}".`, 'excluded');
    }
  }
  localStorage.setItem(LS_GROUPS, JSON.stringify(
    data.groups.map(g => ({ id: g.groupId, name: g.seriesName }))
  ));
}

// ── streak reminder ─────────────────────────────────────────────────────────

function warnStreakIfNeeded(data: NotifData, prevAtRisk: boolean | null) {
  if (!data.streakAtRisk || data.streakDays === 0) return;

  if (prevAtRisk === null) {
    // First load: warn once per calendar day
    const today = new Date().toDateString();
    if (localStorage.getItem(LS_STREAK_DATE) === today) return;
    localStorage.setItem(LS_STREAK_DATE, today);
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

function computeBadge(data: NotifData, myUserId?: number): number {
  // Friend requests and invites: always actionable — count until user acts.
  // Streak: shown in panel + toast, not in badge (amber bell is the visual cue).
  // Group messages: use "seen" tracking — but never count your own message as unread.
  const seen = JSON.parse(localStorage.getItem('notif_seen') ?? '{}');
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
            detectNewMessages(prev, data, user?.id);
            warnStreakIfNeeded(data, prev.streakAtRisk);
          }

          syncGroupsCache(data, isFirst);
          if (isFirst) warnStreakIfNeeded(data, null);

          firstLoad.current = false;
          prevRef.current   = data;
          setNotifData(data);
          setNotifCount(computeBadge(data, user?.id));
        })
        .catch(() => {});
    };

    load();
    const id = setInterval(load, 5_000);
    return () => clearInterval(id);
  }, [user?.id, setNotifData, setNotifCount]);
}
