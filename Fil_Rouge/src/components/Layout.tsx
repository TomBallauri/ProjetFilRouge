import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib/store';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import NotifToastContainer from './NotifToastContainer';
import OnboardingTour from './OnboardingTour';

const Footer: React.FC = () => {
  const { darkMode } = useStore();
  const { t } = useTranslation();
  return (
    <footer className={`w-full text-center pt-3 pb-24 md:py-3 text-xs border-t ${darkMode ? 'border-white/5 text-[--q-text3]' : 'border-black/5 text-[--q-text3]'}`}
      style={{ background: 'var(--q-chrome)' }}>
      {t('layout.footer', { year: new Date().getFullYear() })}
    </footer>
  );
};

const Layout: React.FC = () => {
  const { darkMode, openTour } = useStore();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = React.useRef<HTMLElement>(null);

  useEffect(() => {
    // Déclenché juste après une inscription (voir AuthPage) — on nettoie l'état de navigation
    // pour ne pas rouvrir le tutoriel si l'utilisateur revient en arrière ou rafraîchit.
    if ((location.state as { showOnboarding?: boolean } | null)?.showOnboarding) {
      openTour();
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    // Le scroll de l'app se fait dans <main> (overflow-y-auto), pas sur la fenêtre — changer
    // de route sans ça laisse la nouvelle page au même défilement que la précédente (ex:
    // "Revoir le tutoriel" depuis le bas du profil ramène sur l'accueil... toujours scrollé en bas).
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className={`min-h-screen flex flex-col q-bg ${darkMode ? 'dark' : ''}`} style={{ background: 'var(--q-bg)' }}>
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto" aria-label={t('layout.mainContent')}>
          <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 md:pt-6 pb-28 md:pb-6">
            <Outlet />
          </div>
        </main>
      </div>
      <Footer />
      <NotifToastContainer />
      <OnboardingTour />
    </div>
  );
};

export default Layout;
