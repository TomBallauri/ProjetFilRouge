import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Users, Trophy, MessageSquare, UserX, Flame } from 'lucide-react';

type Toast = { id: number; message: string; type: string; link?: string };

const ICON: Record<string, React.ReactNode> = {
  friend:   <Users         size={15} />,
  invite:   <Trophy        size={15} />,
  message:  <MessageSquare size={15} />,
  excluded: <UserX         size={15} />,
  streak:   <Flame         size={15} />,
};

const COLOR: Record<string, string> = {
  friend:   '#A78BFA',
  invite:   '#34D399',
  message:  '#38BDF8',
  excluded: '#FB923C',
  streak:   '#FB923C',
};

const NotifToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const navigate = useNavigate();

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type, link } = (e as CustomEvent<{ message: string; type: string; link?: string }>).detail;
      const id = Date.now();
      setToasts(prev => [...prev.slice(-2), { id, message, type, link }]);
      setTimeout(() => dismiss(id), 4500);
    };
    globalThis.addEventListener('notif-toast', handler);
    return () => globalThis.removeEventListener('notif-toast', handler);
  }, [dismiss]);

  if (!toasts.length) return null;

  return (
    <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => { dismiss(t.id); if (t.link) navigate(t.link); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
            background: 'var(--q-chrome)', border: '1px solid var(--q-line)',
            borderRadius: 14, padding: '10px 14px',
            boxShadow: '0 8px 24px -4px rgba(0,0,0,0.3)',
            fontSize: 13, fontWeight: 600, color: 'var(--q-text)',
            fontFamily: 'var(--q-font)',
            animation: 'notif-toast-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
            maxWidth: 280, width: '100%',
            cursor: t.link ? 'pointer' : 'default',
          }}
        >
          <span style={{ color: COLOR[t.type] ?? 'var(--q-accent)', flexShrink: 0 }}>
            {ICON[t.type] ?? <Bell size={15} />}
          </span>
          <span style={{ flex: 1 }}>{t.message}</span>
          {t.link && <span style={{ fontSize: 11, color: 'var(--q-text3)', flexShrink: 0 }}>Ouvrir →</span>}
        </button>
      ))}
    </div>
  );
};

export default NotifToastContainer;
