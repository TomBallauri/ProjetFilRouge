import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { usePageTitle } from '../hooks/usePageTitle';
import { useVisibilityPausedInterval } from '../hooks/useVisibilityPausedInterval';
import { ArrowLeft, Send, Users, Loader2 } from 'lucide-react';
import UserAvatar from '../components/UserAvatar';

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

const getSendButtonStyle = (canSend: boolean): React.CSSProperties => ({
  width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
  background: canSend ? 'var(--q-accent)' : 'var(--q-bg-flat)',
  color: canSend ? '#fff' : 'var(--q-text3)',
  cursor: canSend ? 'pointer' : 'default',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s',
  boxShadow: canSend ? '0 2px 8px rgba(124,58,237,0.35)' : 'none',
});

const GroupChatPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  usePageTitle(t('groupChat.pageTitle'));
  const { groupId } = useParams<{ groupId: string }>();
  const navigate     = useNavigate();
  const { user }     = useStore();

  const [group,    setGroup]    = useState<GroupData | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input,    setInput]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const bottomRef    = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef(0);
  const gid = Number(groupId);

  useEffect(() => {
    if (!user || !gid) return;
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
        }
      })
      .catch(() => setError(t('groupChat.networkError')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, user]);

  // Polling toutes les 8s pour les nouveaux messages
  useVisibilityPausedInterval(() => {
    if (!gid) return;
    fetch(`/api/series-groups/${gid}/messages`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then((data: Msg[] | null) => {
        if (!data || !Array.isArray(data)) return;
        const newest = data[data.length - 1]?.id ?? 0;
        if (newest > lastMsgIdRef.current) {
          setMessages(data);
          lastMsgIdRef.current = newest;
          localStorage.setItem(`sg_lm_${gid}`, String(newest));
        }
      })
      .catch(() => {});
  }, 8_000, !!gid && !!user);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
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

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const joined = group?.members.filter(m => m.status === 'JOINED') ?? [];
  const myStatus = group?.members.find(m => m.userId === user?.id)?.status;
  const canSend = !!input.trim() && !sending;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--q-text3)', fontFamily: 'var(--q-font)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginRight: 10 }} aria-hidden="true" />
        {t('common.loading')}
      </div>
    );
  }

  if (error || !group) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--q-text3)', fontFamily: 'var(--q-font)' }}>
        <p style={{ marginBottom: 16 }}>{error || t('groupChat.notFound')}</p>
        <button onClick={() => navigate(-1)} style={{ background: 'var(--q-accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
          {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', fontFamily: 'var(--q-font)', maxWidth: 700, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 0 12px', borderBottom: '1px solid var(--q-line)',
        flexShrink: 0,
      }}>
        <button onClick={() => navigate(-1)} aria-label={t('common.back')} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 12,
          color: 'var(--q-text2)', display: 'flex', alignItems: 'center',
        }}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--q-text)', letterSpacing: -0.3, lineHeight: 1.2 }}>
            {group.seriesName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 12, color: 'var(--q-text3)' }}>
            <Users size={12} aria-hidden="true" />
            {t('groupChat.memberCount', { count: joined.length })}
          </div>
        </div>
        {/* Avatars des membres */}
        <div style={{ display: 'flex', marginLeft: 'auto' }}>
          {joined.slice(0, 4).map((m, i) => (
            <div key={m.userId} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: joined.length - i, borderRadius: '50%', border: '2px solid var(--q-chrome)' }}>
              <UserAvatar avatar={m.user.avatar} username={m.user.username} size="xs" cosmetics={[]} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--q-text3)', fontSize: 13, marginTop: 40 }}>
            {t('groupChat.noMessages')}
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.userId === user?.id;
          const prev = messages[i - 1];
          const showAvatar = !isMe && (!prev || prev.userId !== msg.userId);
          const time = new Date(msg.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={msg.id} style={{
              display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row',
              alignItems: 'flex-end', gap: 8, paddingLeft: isMe ? 0 : 36,
              opacity: msg.id < 0 ? 0.6 : 1,
            }}>
              {!isMe && (
                <div style={{ width: 28, flexShrink: 0, alignSelf: 'flex-end', marginBottom: 2 }}>
                  {showAvatar && <UserAvatar avatar={msg.user.avatar} username={msg.user.username} size="xs" cosmetics={[]} />}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
                {showAvatar && !isMe && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--q-text3)', marginBottom: 2, marginLeft: 4 }}>
                    {msg.user.username}
                  </span>
                )}
                <div style={{
                  background: isMe ? 'var(--q-accent)' : 'var(--q-chrome)',
                  color: isMe ? '#fff' : 'var(--q-text)',
                  border: isMe ? 'none' : '1px solid var(--q-line)',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  padding: '8px 12px', fontSize: 14, lineHeight: 1.5,
                  boxShadow: isMe ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
                <span style={{ fontSize: 9, color: 'var(--q-text3)', marginTop: 2, marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0 }}>
                  {time}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      {myStatus === 'JOINED' ? (
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          padding: '10px 0', borderTop: '1px solid var(--q-line)', flexShrink: 0,
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('groupChat.sendMessagePlaceholder')}
            rows={1}
            aria-label={t('groupChat.messageLabel')}
            style={{
              flex: 1, resize: 'none', border: '1.5px solid var(--q-line)',
              borderRadius: 16, padding: '10px 14px', fontSize: 14, lineHeight: 1.5,
              background: 'var(--q-chrome)', color: 'var(--q-text)', fontFamily: 'inherit',
              outline: 'none', maxHeight: 120, overflowY: 'auto',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            aria-label={t('groupChat.send')}
            style={getSendButtonStyle(canSend)}
          >
            <Send size={17} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--q-line)', textAlign: 'center', fontSize: 13, color: 'var(--q-text3)' }}>
          {t('groupChat.joinToParticipate')}
        </div>
      )}
    </div>
  );
};

export default GroupChatPage;
