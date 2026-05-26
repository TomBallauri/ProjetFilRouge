import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Eye, EyeOff, Mail, Lock, User, Zap } from 'lucide-react';
import BackButton from '../components/BackButton';

type AuthMode = 'login' | 'register';

const AuthPage: React.FC<{ mode: AuthMode }> = ({ mode }) => {
  const navigate = useNavigate();
  const { setUser, darkMode } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'register'
        ? { username: name || email.split('@')[0], email, password }
        : { email, password };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : {};
      if (!response.ok) throw new Error(data.error || (mode === 'register' ? "Échec de l'inscription" : 'Échec de la connexion'));
      if (data.token) localStorage.setItem('token', data.token);
      setUser(data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';
  const submitLabel = isLogin ? 'Se connecter' : 'Créer mon compte';

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
  const labelColor  = dk ? '#9B9BAA' : '#6B6B7A';
  const inputBg     = dk ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const inputBorder = dk ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)';
  const inputColor  = dk ? '#EAEAF2' : '#1F2030';
  const iconColor   = dk ? '#5A5A6A' : '#A0A0B0';
  const linkColor   = dk ? '#C8B3FF' : '#7C3AED';
  const switchColor = dk ? '#9B9BAA' : '#6B6B7A';
  const errorBg     = dk ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.07)';
  const errorBorder = dk ? 'rgba(239,68,68,0.30)' : 'rgba(239,68,68,0.25)';
  const errorColor  = dk ? '#FCA5A5' : '#DC2626';

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
      background: pageBg, position: 'relative',
    }}>

      {/* Back button */}
      <div style={{ position: 'absolute', top: 24, left: 20 }}>
        <BackButton />
      </div>

      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 18, marginBottom: 14,
            background: 'linear-gradient(135deg, #00DDFF 0%, #067DBA 35%, #2B1FD0 65%, #B71AEB 100%)',
            boxShadow: '0 8px 24px rgba(167,139,250,0.45)',
          }}>
            <Zap size={28} color="#fff" />
          </div>
          <div style={{ fontSize: 28, fontFamily: '"DM Serif Display", Georgia, serif', color: titleColor, letterSpacing: -0.5 }}>
            {isLogin ? 'Content de te revoir' : "Rejoins l'aventure"}
          </div>
          <div style={{ fontSize: 13, color: subColor, marginTop: 4, fontWeight: 500 }}>
            {isLogin ? 'Connecte-toi à ton compte' : 'Crée ton compte gratuitement'}
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: cardBg, borderRadius: 26, padding: '28px 24px',
          border: `1px solid ${cardBorder}`, boxShadow: cardShadow,
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Pseudo (register only) */}
            {!isLogin && (
              <div>
                <label htmlFor="name" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: labelColor, marginBottom: 6, letterSpacing: 0.3 }}>
                  Pseudo
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: iconColor, pointerEvents: 'none' }} />
                  <input
                    id="name" type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ton pseudo" style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = '#A78BFA'}
                    onBlur={e => e.currentTarget.style.borderColor = inputBorder}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: labelColor, marginBottom: 6, letterSpacing: 0.3 }}>
                Adresse e-mail
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: iconColor, pointerEvents: 'none' }} />
                <input
                  id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required placeholder="ton@email.com" style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = '#A78BFA'}
                  onBlur={e => e.currentTarget.style.borderColor = inputBorder}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: labelColor, marginBottom: 6, letterSpacing: 0.3 }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: iconColor, pointerEvents: 'none' }} />
                <input
                  id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  style={{ ...inputStyle, padding: '11px 42px 11px 38px' }}
                  onFocus={e => e.currentTarget.style.borderColor = '#A78BFA'}
                  onBlur={e => e.currentTarget.style.borderColor = inputBorder}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: iconColor, padding: 2, display: 'flex' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: errorBg,
                border: `1px solid ${errorBorder}`, color: errorColor, fontSize: 13 }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
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
                ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
                : submitLabel
              }
            </button>
          </form>

          {/* Switch mode */}
          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: switchColor }}>
            {isLogin ? (
              <>Pas encore de compte ?{' '}
                <Link to="/register" style={{ color: linkColor, fontWeight: 700, textDecoration: 'none' }}>S'inscrire</Link>
              </>
            ) : (
              <>Déjà un compte ?{' '}
                <Link to="/login" style={{ color: linkColor, fontWeight: 700, textDecoration: 'none' }}>Se connecter</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
