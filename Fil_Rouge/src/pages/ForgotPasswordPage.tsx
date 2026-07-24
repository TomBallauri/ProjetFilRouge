import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import { Mail, ArrowLeft, Zap } from 'lucide-react';
import BackButton from '../components/BackButton';

const LIGHT = {
  pageBg: 'radial-gradient(circle, rgba(0,0,0,0.04) 1.4px, transparent 1.7px) 0 0/16px 16px, linear-gradient(180deg, #F4F4FB 0%, #EAEAF5 100%)',
  cardBg: '#FFFFFF',
  cardBorder: 'rgba(0,0,0,0.08)',
  cardShadow: '0 1px 0 rgba(255,255,255,0.8) inset, 0 24px 48px -12px rgba(0,0,0,0.12)',
  titleColor: '#1F2030',
  subColor: '#6B6B7A',
  labelColor: '#6B6B7A',
  inputBg: 'rgba(0,0,0,0.04)',
  inputBorder: 'rgba(0,0,0,0.12)',
  inputColor: '#1F2030',
  iconColor: '#A0A0B0',
  linkColor: '#7C3AED',
  errorBg: 'rgba(239,68,68,0.07)',
  errorBorder: 'rgba(239,68,68,0.25)',
  errorColor: '#DC2626',
  successBg: 'rgba(52,211,153,0.08)',
  successBorder: 'rgba(52,211,153,0.25)',
  successColor: '#059669',
};

const DARK = {
  pageBg: 'radial-gradient(circle, rgba(255,255,255,0.07) 1.4px, transparent 1.7px) 0 0/16px 16px, linear-gradient(180deg, #1F2030 0%, #16172A 100%)',
  cardBg: '#2A2B3F',
  cardBorder: 'rgba(255,255,255,0.08)',
  cardShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 48px -12px rgba(0,0,0,0.55)',
  titleColor: '#EAEAF2',
  subColor: '#9B9BAA',
  labelColor: '#9B9BAA',
  inputBg: 'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(255,255,255,0.10)',
  inputColor: '#EAEAF2',
  iconColor: '#5A5A6A',
  linkColor: '#C8B3FF',
  errorBg: 'rgba(239,68,68,0.12)',
  errorBorder: 'rgba(239,68,68,0.30)',
  errorColor: '#FCA5A5',
  successBg: 'rgba(52,211,153,0.12)',
  successBorder: 'rgba(52,211,153,0.30)',
  successColor: '#6EE7B7',
};

const ForgotPasswordPage: React.FC = () => {
  const { darkMode } = useStore();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('auth.genericError'));
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.genericError'));
    } finally {
      setLoading(false);
    }
  };

  const dk = darkMode;
  const {
    pageBg, cardBg, cardBorder, cardShadow, titleColor, subColor, labelColor,
    inputBg, inputBorder, inputColor, iconColor, linkColor,
    errorBg, errorBorder, errorColor, successBg, successBorder, successColor,
  } = dk ? DARK : LIGHT;

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '11px 14px 11px 38px', borderRadius: 14,
    background: inputBg, border: `1px solid ${inputBorder}`,
    color: inputColor, fontSize: 14, fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.15s ease',
  };

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
            {t('forgotPassword.title')}
          </div>
          <div style={{ fontSize: 13, color: subColor, marginTop: 4, fontWeight: 500 }}>
            {sent ? t('forgotPassword.checkInbox') : t('forgotPassword.subtitle')}
          </div>
        </div>

        <div style={{
          background: cardBg, borderRadius: 26, padding: '28px 24px',
          border: `1px solid ${cardBorder}`, boxShadow: cardShadow,
        }}>
          {sent ? (
            <div>
              <div style={{ padding: '10px 14px', borderRadius: 12, background: successBg,
                border: `1px solid ${successBorder}`, color: successColor, fontSize: 13, marginBottom: 20 }}>
                <Trans i18nKey="forgotPassword.sentMessage" values={{ email }} components={{ strong: <strong /> }} />
              </div>
              <Link to="/login" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                color: linkColor, fontWeight: 700, textDecoration: 'none', fontSize: 13,
              }}>
                <ArrowLeft size={14} aria-hidden="true" /> {t('forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="email" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: labelColor, marginBottom: 6, letterSpacing: 0.3 }}>
                  {t('auth.email')}
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} aria-hidden="true" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: iconColor, pointerEvents: 'none' }} />
                  <input
                    id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required placeholder="ton@email.com" autoComplete="email" style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = '#A78BFA'}
                    onBlur={e => e.currentTarget.style.borderColor = inputBorder}
                  />
                </div>
              </div>

              {error && (
                <div role="alert" aria-live="assertive" style={{ padding: '10px 14px', borderRadius: 12, background: errorBg,
                  border: `1px solid ${errorBorder}`, color: errorColor, fontSize: 13 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} aria-busy={loading}
                style={{
                  width: '100%', height: 48, borderRadius: 16, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #00DDFF 0%, #067DBA 35%, #2B1FD0 65%, #B71AEB 100%)',
                  color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                  opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s ease',
                  boxShadow: '0 4px 16px rgba(167,139,250,0.40)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 4,
                }}>
                {loading
                  ? <output aria-label={t('common.loading')}><div aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} /></output>
                  : t('forgotPassword.sendLink')
                }
              </button>

              <Link to="/login" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                color: linkColor, fontWeight: 700, textDecoration: 'none', fontSize: 13, marginTop: 4,
              }}>
                <ArrowLeft size={14} aria-hidden="true" /> {t('forgotPassword.backToLogin')}
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
