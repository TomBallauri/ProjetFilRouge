import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isGroupUnread, computeBadge, mergeKnownGroups, detectNewMessages } from './useNotificationPolling';
import type { NotifData, NotifGroup } from '../lib/store';

const USER_ID = 1;
const OTHER_ID = 2;

const group = (overrides: Partial<NotifGroup> = {}): NotifGroup => ({
  groupId: 1,
  seriesName: 'Lecture',
  latestMessageId: 10,
  latestMessageUserId: OTHER_ID,
  ...overrides,
});

const notifData = (groups: NotifGroup[], overrides: Partial<NotifData> = {}): NotifData => ({
  pendingFriendRequests: 0,
  pendingSeriesInvites: 0,
  streakAtRisk: false,
  streakDays: 0,
  groups,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

describe('isGroupUnread', () => {
  it('is unread when there is no "seen" record at all', () => {
    expect(isGroupUnread(group(), USER_ID)).toBe(true);
  });

  it('is read once the seen id catches up to the latest message', () => {
    localStorage.setItem(`notif_seen_${USER_ID}`, JSON.stringify({ groups: { '1': 10 } }));
    expect(isGroupUnread(group({ latestMessageId: 10 }), USER_ID)).toBe(false);
  });

  it('is unread again once a newer message arrives past the seen id', () => {
    localStorage.setItem(`notif_seen_${USER_ID}`, JSON.stringify({ groups: { '1': 10 } }));
    expect(isGroupUnread(group({ latestMessageId: 11 }), USER_ID)).toBe(true);
  });

  it('never counts your own message as unread, regardless of seen state', () => {
    expect(isGroupUnread(group({ latestMessageUserId: USER_ID }), USER_ID)).toBe(false);
  });

  it('is read when there is no message at all', () => {
    expect(isGroupUnread(group({ latestMessageId: null }), USER_ID)).toBe(false);
  });
});

describe('computeBadge', () => {
  it('sums pending friend requests, series invites, and unread groups', () => {
    const data = notifData([group({ groupId: 1 }), group({ groupId: 2, latestMessageUserId: USER_ID })], {
      pendingFriendRequests: 2, pendingSeriesInvites: 1,
    });
    // group 1 unread (+1), group 2 is my own message (not counted) => 2 + 1 + 1 = 4
    expect(computeBadge(data, USER_ID)).toBe(4);
  });

  it('excludes groups already marked as seen', () => {
    localStorage.setItem(`notif_seen_${USER_ID}`, JSON.stringify({ groups: { '1': 10 } }));
    const data = notifData([group({ groupId: 1, latestMessageId: 10 })]);
    expect(computeBadge(data, USER_ID)).toBe(0);
  });
});

describe('mergeKnownGroups', () => {
  it('adds new groups to an empty accumulator', () => {
    const known = new Map<number, NotifGroup>();
    const result = mergeKnownGroups(known, [group({ groupId: 1 }), group({ groupId: 2 })]);
    expect(result.map(g => g.groupId).sort()).toEqual([1, 2]);
  });

  it('keeps a previously-known group when a later poll omits it', () => {
    // This is the regression this function exists to prevent: /api/notifications doesn't
    // guarantee every group on every poll, and a group missing from one poll must not lose
    // its accumulated state (that was the root cause of "the same read message keeps coming
    // back as unread" — see the isGroupUnread comparison depending on notifData.groups).
    const known = new Map<number, NotifGroup>();
    mergeKnownGroups(known, [group({ groupId: 1 }), group({ groupId: 2 })]);
    const result = mergeKnownGroups(known, [group({ groupId: 2 })]); // groupId 1 absent this time
    expect(result.map(g => g.groupId).sort()).toEqual([1, 2]);
  });

  it('updates a known group in place when it reappears with fresher data', () => {
    const known = new Map<number, NotifGroup>();
    mergeKnownGroups(known, [group({ groupId: 1, latestMessageId: 10 })]);
    const result = mergeKnownGroups(known, [group({ groupId: 1, latestMessageId: 11 })]);
    expect(result.find(g => g.groupId === 1)?.latestMessageId).toBe(11);
  });
});

describe('detectNewMessages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const fireEvent = (prev: NotifData, curr: NotifData, activeGroupChatId: number | null = null) => {
    const spy = vi.spyOn(globalThis, 'dispatchEvent');
    detectNewMessages(prev, curr, USER_ID, activeGroupChatId);
    return spy;
  };

  it('fires a toast when a group gets a new message from someone else', () => {
    const prev = notifData([group({ groupId: 1, latestMessageId: 10 })]);
    const curr = notifData([group({ groupId: 1, latestMessageId: 11 })]);
    const spy = fireEvent(prev, curr);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the message is from myself', () => {
    const prev = notifData([group({ groupId: 1, latestMessageId: 10, latestMessageUserId: USER_ID })]);
    const curr = notifData([group({ groupId: 1, latestMessageId: 11, latestMessageUserId: USER_ID })]);
    expect(fireEvent(prev, curr)).not.toHaveBeenCalled();
  });

  it('does not fire for the group whose chat is currently open', () => {
    const prev = notifData([group({ groupId: 1, latestMessageId: 10 })]);
    const curr = notifData([group({ groupId: 1, latestMessageId: 11 })]);
    expect(fireEvent(prev, curr, 1)).not.toHaveBeenCalled();
  });

  it('does not fire when the message is already marked as seen (race with GroupChatModal)', () => {
    // Regression test: the popup's own polling can mark a message as seen and then unmount
    // (chat closed) in the gap before the slower global poll runs — without this check, that
    // gap would resurface a toast for a message the user already read.
    localStorage.setItem(`notif_seen_${USER_ID}`, JSON.stringify({ groups: { '1': 11 } }));
    const prev = notifData([group({ groupId: 1, latestMessageId: 10 })]);
    const curr = notifData([group({ groupId: 1, latestMessageId: 11 })]);
    expect(fireEvent(prev, curr)).not.toHaveBeenCalled();
  });

  it('does not fire when nothing changed', () => {
    const prev = notifData([group({ groupId: 1, latestMessageId: 10 })]);
    const curr = notifData([group({ groupId: 1, latestMessageId: 10 })]);
    expect(fireEvent(prev, curr)).not.toHaveBeenCalled();
  });
});
