import React from 'react';
import { useTranslation } from 'react-i18next';

const PageLoader: React.FC<{ message?: string }> = ({ message }) => {
  const { t } = useTranslation();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 0', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        border: '3px solid transparent',
        borderTopColor: 'var(--q-accent)',
        borderRightColor: 'var(--q-accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ fontSize: 13, color: 'var(--q-text2)', fontWeight: 600, margin: 0 }}>
        {message ?? t('common.loading')}
      </p>
    </div>
  );
};

export default PageLoader;
