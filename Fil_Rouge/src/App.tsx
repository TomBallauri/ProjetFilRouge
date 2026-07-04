import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AdminDashboard from './pages/AdminDashboard';
import GameForum from './pages/GameForum';
import TasksPage from './pages/TasksPage';
import TrendsPage from './pages/TrendsPage';
import ProfilePage from './pages/ProfilePage';
import EditProfile from './pages/EditProfile';
import DiscussionsPage from './pages/DiscussionsPage';
import AuthPage from './pages/AuthPage';
import ForumTchat from './pages/ForumTchat';
import ChallengePage from './pages/ChallengePage';
import CreateChallenge from './pages/CreateChallenge';
import AIChallengeGenerator from './pages/AIChallengeGenerator';
import ShopPage from './pages/ShopPage';
import LeaderboardPage from './pages/LeaderboardPage';
import UserProfilePage from './pages/UserProfilePage';
import FriendsPage from './pages/FriendsPage';
import GroupChatPage from './pages/GroupChatPage';
import { useStore } from './lib/store';

function App() {
  const { darkMode, setUser } = useStore();

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
        if (data?.user) setUser(data.user);
      })
      .catch(() => {
        // Ignore network errors and keep persisted state until API is reachable.
      });
  }, [setUser]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<GameForum />} />
          <Route path="discussions" element={<DiscussionsPage />} />
          <Route path="/tchat/:id" element={<ForumTchat />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="edit" element={<EditProfile />} />
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
    </div>
  );
}

export default App;