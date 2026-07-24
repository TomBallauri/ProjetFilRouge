import React from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

type Props = WithTranslation & { children: React.ReactNode };
type State = { hasError: boolean };

// Filet de sécurité global : sans ça, une erreur de rendu (n'importe où dans l'arbre) fait
// disparaître toute l'app derrière un écran blanc, sans aucune indication ni moyen de
// récupérer sans un rechargement manuel devinable par l'utilisateur.
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { t } = this.props;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: '40px 24px', fontFamily: '"Quicksand", ui-rounded, system-ui, sans-serif',
        background: 'var(--q-bg)', color: 'var(--q-text)',
      }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, marginBottom: 20,
          background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle size={28} color="#EF4444" aria-hidden="true" />
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontFamily: '"DM Serif Display", Georgia, serif' }}>
          {t('common.errorBoundaryTitle')}
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--q-text2)', maxWidth: 320 }}>
          {t('common.errorBoundaryBody')}
        </p>
        <button onClick={() => globalThis.location.reload()} className="q-press"
          style={{ height: 44, padding: '0 24px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #00DDFF 0%, #067DBA 35%, #2B1FD0 65%, #B71AEB 100%)',
            color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(167,139,250,0.40)' }}>
          {t('common.errorBoundaryReload')}
        </button>
      </div>
    );
  }
}

const TranslatedErrorBoundary = withTranslation()(ErrorBoundary);
export default TranslatedErrorBoundary;
