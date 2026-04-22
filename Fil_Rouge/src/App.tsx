import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AdminDashboard from './pages/AdminDashboard';
import GameForum from './pages/GameForum';
import TasksPage from './pages/TasksPage';
import TrendsPage from './pages/TrendsPage';
import GamesPage from './pages/GamePage';
import GamePresVal from './pages/GamePageDir/GamePresVal';
import GamePresLoL from './pages/GamePageDir/GamePresLoL';
import GamePresAL from './pages/GamePageDir/GamePresAL';
import GamePresCS2 from './pages/GamePageDir/GamePresCS2';
import GamePresFor from './pages/GamePageDir/GamePresFor';
import GamePresOW2 from './pages/GamePageDir/GamePresOW2';

import CompetitionPage from './pages/CompetitionPage';
import CompetitionPres from './pages/CompetitionPres';
import ProfilePage from './pages/ProfilePage';
import EditProfile from './pages/EditProfile';
import DiscussionsPage from './pages/DiscussionsPage';
import AuthPage from './pages/AuthPage';
import TeamsPage from './pages/TeamsPage';
import ForumTchat from './pages/ForumTchat';
import { useStore } from './lib/store';

function App() {
  const { darkMode } = useStore();

  return (
    <div className={darkMode ? 'dark' : ''}>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<GameForum />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="games" element={<GamesPage />} />
          <Route path="gamepresval" element={<GamePresVal />} />
          <Route path="gamepreslol" element={<GamePresLoL />} />
          <Route path="gamepresal" element={<GamePresAL />} />
          <Route path="gameprescs2" element={<GamePresCS2 />} />
          <Route path="gamepresfor" element={<GamePresFor />} />
          <Route path="gamepresow2" element={<GamePresOW2 />} />
          <Route path="discussions" element={<DiscussionsPage />} />
          <Route path="/tchat/:id" element={<ForumTchat />} />
          <Route path="competition" element={<CompetitionPage />} />
          <Route path="prescomp" element={<CompetitionPres />} />
          <Route path="teams" element={<TeamsPage/>} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="edit" element={<EditProfile />} />
          <Route path="settings" element={<div className="p-4">Settings (Coming Soon)</div>} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;