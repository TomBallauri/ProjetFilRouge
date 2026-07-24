import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { useVisibilityPausedInterval } from '../hooks/useVisibilityPausedInterval';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import UserAvatar from './UserAvatar';

type Member = {
  id: number; groupId: number; userId: number; status: string;
  user: { id: number; username: string; avatar?: string };
};
type Msg = {
  id: number; groupId: number; userId: number; content: string; createdAt: string;
  user: { id: number; username: string; avatar?: string };
};
type GroupData = {
  id: number; seriesName: string; createdBy: number;
  creator: { id: number; username: string; avatar?: string };
  members: Member[];
  messages: Msg[];
};

const token = () => localStorage.getItem('token') ?? '';

// Popup version of GroupChatPage, opened from anywhere (currently: the home page notification
// bell — see UQuail.tsx) without navigating away from the current page. Same data/polling logic
// as GroupChatPage, styled after the bottom-sheet chat dialog already used in ChallengePage's
// SeriesDropdown, which is the design this was modeled on.
const GroupChatModal: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, activeGroupChatId: gid, closeGroupChat } = useStore();

  const [group,    setGroup]    = useState<GroupData | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input,    setInput]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const bottomRef    = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef(0);

  // Marque le groupe comme lu dans le même store que la cloche/le badge par-série (voir
  // useNotificationPolling.ts / ChallengePage.tsx) — sans ça, ouvrir cette popup depuis le
  // toast (au lieu de la cloche, qui marque déjà tout comme vu à l'ouverture) laisserait le
  // badge affiché après fermeture alors que les messages ont bien été vus ici.
  const markSeen = (groupId: number, msgId: number) => {
    if (!user) return;
    const seenKey = `notif_seen_${user.id}`;
    const currentSeen = JSON.parse(localStorage.getItem(seenKey) ?? '{}');
    const seenGroups = { ...currentSeen.groups, [String(groupId)]: msgId };
    localStorage.setItem(seenKey, JSON.stringify({ ...currentSeen, groups: seenGroups }));
  };

  // Reset local state each time a different group is opened.
  useEffect(() => {
    if (gid === null) return;
    setGroup(null); setMessages([]); setInput(''); setError(''); setLoading(true);
    lastMsgIdRef.current = 0;
  }, [gid]);

  useEffect(() => {
    if (gid === null || !user) return;
    fetch(`/api/series-groups/${gid}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(async r => {
        if (!r.ok) { setError(t('groupChat.loadError')); return; }
        const data: GroupData = await r.json();
        setGroup(data);
        setMessages(data.messages);
        if (data.messages.length > 0) {
          const last = data.messages[data.messages.length - 1].id;
          lastMsgIdRef.current = last;
          localStorage.setItem(`sg_lm_${gid}`, String(last));
          markSeen(gid, last);
        }
      })
      .catch(() => setError(t('groupChat.networkError')))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, user, t]);

  // Polling toutes les 4s pendant que la popup est ouverte
  useVisibilityPausedInterval(() => {
    if (gid === null) return;
    fetch(`/api/series-groups/${gid}/messages`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then((data: Msg[] | null) => {
        if (!data || !Array.isArray(data)) return;
        const newest = data[data.length - 1]?.id ?? 0;
        if (newest > lastMsgIdRef.current) {
          setMessages(data);
          lastMsgIdRef.current = newest;
          localStorage.setItem(`sg_lm_${gid}`, String(newest));
          markSeen(gid, newest);
        }
      })
      .catch(() => {});
  }, 4_000, gid !== null && !!user);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (gid === null || !input.trim() || sending) return;
    const content = input.trim();
    const tempId  = -Date.now();
    const optimistic: Msg = {
      id: tempId, groupId: gid, userId: user!.id, content,
      createdAt: new Date().toISOString(),
      user: { id: user!.id, username: user!.username ?? '', avatar: user!.avatar },
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    setSending(true);
    try {
      const res = await fetch(`/api/series-groups/${gid}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ content }),
      });
      const msg: Msg = await res.json();
      if (res.ok) {
        setMessages(prev => prev.map(m => m.id === tempId ? msg : m));
        lastMsgIdRef.current = msg.id;
        localStorage.setItem(`sg_lm_${gid}`, String(msg.id));
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setInput(content);
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  if (gid === null) return null;

  const joinedCount = group?.members.filter(m => m.status === 'JOINED').length ?? 0;
  const myStatus = group?.members.find(m => m.userId === user?.id)?.status;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
      }}
      onClick={closeGroupChat}
      onKeyDown={e => { if (e.key === 'Escape') closeGroupChat(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={group?.seriesName ?? t('groupChat.pageTitle')}
        onClick={e => e.stopPropagation()} style={{
          width: '100%', maxWidth: 520,
          background: 'var(--q-chrome)',
          borderRadius: '24px 24px 0 0',
          border: '1px solid var(--q-line)',
          borderBottom: 'none',
          display: 'flex', flexDirection: 'column',
          maxHeight: '80vh',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.4)',
        }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 18px', borderBottom: '1px solid var(--q-line)', flexShrink: 0,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--q-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MessageCircle size={17} color="#fff" aria-hidden="true" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--q-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {group?.seriesName ?? t('groupChat.pageTitle')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--q-text3)' }}>{t('groupChat.memberCount', { count: joinedCount })}</div>
          </div>
          <button type="button" onClick={closeGroupChat} aria-label={t('groupChat.closeAriaLabel')} style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'var(--q-line)', color: 'var(--q-text2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'var(--q-text3)' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
          </div>
        ) : error || !group ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--q-text3)', fontSize: 13 }}>
            {error || t('groupChat.notFound')}
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="q-hidescroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--q-text3)', fontSize: 13 }}>
                  <MessageCircle size={32} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} aria-hidden="true" />
                  {t('groupChat.noMessages')}
                </div>
              )}
              {messages.map(msg => {
                const isMe = msg.userId === user?.id;
                return (
                  <div key={msg.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row', opacity: msg.id < 0 ? 0.6 : 1 }}>
                    {!isMe && <UserAvatar avatar={msg.user.avatar} username={msg.user.username} cosmetics={[]} size="sm" />}
                    <div style={{ maxWidth: '72%' }}>
                      {!isMe && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--q-text3)', marginBottom: 3 }}>{msg.user.username}</div>}
                      <div style={{
                        padding: '9px 13px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        background: isMe ? 'var(--q-accent)' : 'var(--q-bg-flat)',
                        border: isMe ? 'none' : '1px solid var(--q-line)',
                        color: isMe ? '#fff' : 'var(--q-text)',
                        fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--q-text3)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>
                        {new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {myStatus === 'JOINED' ? (
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--q-line)', display: 'flex', gap: 8, flexShrink: 0 }}>
                <label htmlFor="group-chat-modal-input" className="sr-only">{t('groupChat.messageLabel')}</label>
                <input
                  id="group-chat-modal-input"
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={t('groupChat.sendMessagePlaceholder')}
                  autoFocus
                  style={{
                    flex: 1, padding: '11px 14px', borderRadius: 14,
                    border: '1px solid var(--q-line)', background: 'var(--q-bg-flat)',
                    color: 'var(--q-text)', fontSize: 14, outline: 'none',
                  }}
                />
                <button type="button" onClick={handleSend} disabled={sending || !input.trim()} aria-label={t('groupChat.send')} style={{
                  width: 44, height: 44, borderRadius: 14, border: 'none', flexShrink: 0,
                  background: input.trim() ? 'var(--q-accent)' : 'var(--q-line)',
                  color: '#fff', cursor: input.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: sending ? 0.6 : 1, transition: 'background 0.2s',
                }}>
                  <Send size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--q-line)', textAlign: 'center', fontSize: 13, color: 'var(--q-text3)' }}>
                {t('groupChat.joinToParticipate')}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GroupChatModal;
