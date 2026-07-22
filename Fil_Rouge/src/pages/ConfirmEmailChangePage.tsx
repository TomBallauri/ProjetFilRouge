import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { Mail, Zap } from 'lucide-react';
import BackButton from '../components/BackButton';

const ConfirmEmailChangePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { darkMode, user, setUser } = useStore();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setStatus('error'); setError(t('resetPassword.invalidToken')); return; }
    fetch('/api/auth/confirm-email-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('auth.genericError'));
        if (user && data.user) setUser({ ...user, ...data.user });
        setStatus('success');
      })
      .catch(err => {
        setError(err.message || t('auth.genericError'));
        setStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const dk = darkMode;
  const pageBg = dk
    ? 'radial-gradient(circle, rgba(255,255,255,0.07) 1.4px, transparent 1.7px) 0 0/16px 16px, linear-gradient(180deg, #1F2030 0%, #16172A 100%)'
    : 'radial-gradient(circle, rgba(0,0,0,0.04) 1.4px, transparent 1.7px) 0 0/16px 16px, linear-gradient(180deg, #F4F4FB 0%, #EAEAF5 100%)';
  const cardBg      = dk ? '#2A2B3F' : '#FFFFFF';
  const cardBorder  = dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const cardShadow  = dk
    ? '0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 48px -12px rgba(0,0,0,0.55)'
    : '0 1px 0 rgba(255,255,255,0.8) inset, 0 24px 48px -12px rgba(0,0,0,0.12)';
  const titleColor  = dk ? '#EAEAF2' : '#1F2030';
  const subColor    = dk ? '#9B9BAA' : '#6B6B7A';
  const linkColor   = dk ? '#C8B3FF' : '#7C3AED';
  const errorBg     = dk ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.07)';
  const errorBorder = dk ? 'rgba(239,68,68,0.30)' : 'rgba(239,68,68,0.25)';
  const errorColor  = dk ? '#FCA5A5' : '#DC2626';
  const successBg     = dk ? 'rgba(52,211,153,0.12)' : 'rgba(52,211,153,0.08)';
  const successBorder = dk ? 'rgba(52,211,153,0.30)' : 'rgba(52,211,153,0.25)';
  const successColor  = dk ? '#6EE7B7' : '#059669';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', fontFamily: '"Quicksand", ui-rounded, system-ui, sans-serif',
      background: pageBg, position: 'relative', overflowX: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 24, left: 20 }}>
        <BackButton />
      </div>

      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 18, marginBottom: 14,
            background: 'linear-gradient(135deg, #00DDFF 0%, #067DBA 35%, #2B1FD0 65%, #B71AEB 100%)',
            boxShadow: '0 8px 24px rgba(167,139,250,0.45)',
          }}>
            <Zap size={28} color="#fff" aria-hidden="true" />
          </div>
          <div style={{ fontSize: 28, fontFamily: '"DM Serif Display", Georgia, serif', color: titleColor, letterSpacing: -0.5 }}>
            {t('confirmEmailChange.title')}
          </div>
          <div style={{ fontSize: 13, color: subColor, marginTop: 4, fontWeight: 500 }}>
            {t('confirmEmailChange.subtitle')}
          </div>
        </div>

        <div style={{
          background: cardBg, borderRadius: 26, padding: '28px 24px',
          border: `1px solid ${cardBorder}`, boxShadow: cardShadow, textAlign: 'center',
        }}>
          {status === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
              <div aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.25)', borderTopColor: '#7C3AED', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13, color: subColor }}>{t('confirmEmailChange.inProgress')}</p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div style={{ padding: '10px 14px', borderRadius: 12, background: successBg,
                border: `1px solid ${successBorder}`, color: successColor, fontSize: 13, marginBottom: 20,
                display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                <Mail size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                {t('confirmEmailChange.success')}
              </div>
              <Link to="/profile" style={{ color: linkColor, fontWeight: 700, textDecoration: 'none', fontSize: 13 }}>
                {t('confirmEmailChange.backToProfile')}
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div role="alert" aria-live="assertive" style={{ padding: '10px 14px', borderRadius: 12, background: errorBg,
                border: `1px solid ${errorBorder}`, color: errorColor, fontSize: 13, marginBottom: 20, textAlign: 'left' }}>
                {error}
              </div>
              <Link to="/profile" style={{ color: linkColor, fontWeight: 700, textDecoration: 'none', fontSize: 13 }}>
                {t('confirmEmailChange.backToProfile')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmEmailChangePage;
