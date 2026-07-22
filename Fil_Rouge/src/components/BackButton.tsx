import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';

const BackButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <button
      onClick={() => navigate(-1)}
      className={`q-press flex-shrink-0 ${className}`}
      style={{
        width: 40, height: 40, borderRadius: 20,
        border: '1px solid rgba(167,139,250,0.25)',
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(14px)',
        color: 'var(--q-accent-deep)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 0 rgba(255,255,255,0.10) inset, 0 4px 14px -2px rgba(167,139,250,0.35)',
        cursor: 'pointer',
      }}
      aria-label={t('common.back')}
    >
      <ChevronLeft size={18} aria-hidden="true" />
    </button>
  );
};

export default BackButton;
