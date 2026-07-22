import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';
import { useStore } from './lib/store';

// Chaque page est chargée à la demande : sans ça, tout (y compris le dashboard admin,
// réservé à une poignée d'utilisateurs) finissait dans le même bundle JS de départ.
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const UQuail = lazy(() => import('./pages/UQuail'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ConfirmEmailChangePage = lazy(() => import('./pages/ConfirmEmailChangePage'));
const ChallengePage = lazy(() => import('./pages/ChallengePage'));
const CreateChallenge = lazy(() => import('./pages/CreateChallenge'));
const AIChallengeGenerator = lazy(() => import('./pages/AIChallengeGenerator'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const GroupChatPage = lazy(() => import('./pages/GroupChatPage'));

function App() {
  const { darkMode, setUser, applyServerSettings } = useStore();

  useEffect(() => {
    // Répliqué sur <html> pour que les composants montés hors de l'arbre React (driver.js
    // pour le tutoriel, portails futurs...) héritent aussi des variables --q-* du bon thème.
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem('token');
            setUser(null);
          }
          return;
        }
        const data = await res.json();
        if (data?.user) {
          setUser(data.user);
          // Les préférences liées au compte (mode sombre, notifs...) priment sur celles du
          // navigateur, pour retrouver ses réglages même depuis un nouvel appareil.
          applyServerSettings(data.user.settings);
        }
      })
      .catch(() => {
        // Ignore network errors and keep persisted state until API is reachable.
      });
  }, [setUser, applyServerSettings]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<UQuail />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<div className="p-4">Settings (Coming Soon)</div>} />
            <Route path="challenges" element={<ChallengePage />} />
            <Route path="challenges/create" element={<CreateChallenge />} />
            <Route path="challenges/ai-create" element={<AIChallengeGenerator />} />
            <Route path="shop" element={<ShopPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="user/:id" element={<UserProfilePage />} />
            <Route path="friends" element={<FriendsPage />} />
            <Route path="groups/:groupId" element={<GroupChatPage />} />
          </Route>
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;