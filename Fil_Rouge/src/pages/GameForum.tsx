import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { useNavigate } from 'react-router-dom';

const GameForum: React.FC = () => {
  const navigate = useNavigate();
  const { user, darkMode } = useStore();
  const [loading, setLoading] = useState(true);
  const [recentTopics, setRecentTopics] = useState<any[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user) {
      fetch('/api/topics?limit=6&sort=desc')
        .then(res => res.json())
        .then(data => setRecentTopics(data))
        .catch(() => setRecentTopics([]));
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 bg-[url(./assets/bg-white.)]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-10 space-y-6">
        <div className={`p-4 min-h-[120px] rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} border ${darkMode ? 'border-gray-700' : 'border-gray-200'} shadow flex justify-center items-center`}>
          <h1 className="text-2xl font-bold text-blue-500 text-center w-full">Bienvenue sur GameForum</h1>
        </div>  
        <p className="mb-6">Connectez-vous pour rejoindre la communauté.</p>
        <div className="flex justify-center space-x-4">
          <a 
            href="/login" 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Connexion
          </a>
          <a 
            href="/register" 
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            Inscription
          </a>
        </div>
      </div>
    );
  }

  const featuredGames = [
    'Valorant',
    'League of Legends',
    'Fortnite',
    'Apex Legends'
  ];

  return (
    <div className={`p-6 ${darkMode ? 'text-white' : ' text-gray-900'}`}>
      <div className={`p-4 sm:p-8 mb-8 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} border ${darkMode ? 'border-gray-700' : 'border-gray-200'} shadow`} style={{ height: 'auto' }}>
        <h1 className="text-2xl sm:text-4xl font-bold mb-4 text-blue-500">Bienvenue sur GameForum</h1>
        <p className="text-lg sm:text-2xl font-bold">Rejoignez la plus grande communauté de gamers francophones. Discutez, partagez et restez informé des dernières actualités gaming.</p>
      </div>
      <section className="mb-12">
        <h2 className="text-3xl font-bold mb-6 inline-block border-b-4 border-gray-300 pb-4">Rejoindre la communauté</h2>
        <section className="mb-12">
          <h3 className="text-3xl font-bold mb-6 inline-block border-b-4 border-gray-300 pb-2">Jeux en vedette</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ">
            {featuredGames.map((game, index) => {
              const gameImages: { [key: string]: string } = {
                'Valorant': 'https://i.pinimg.com/736x/67/c0/7e/67c07ead929b049e453bedda45980b79.jpg',
                'League of Legends': 'https://i.pinimg.com/736x/d1/b1/1d/d1b11d5e4dbae547ac0d651476cec488.jpg',
                'Counter-Strike 2': 'https://i.pinimg.com/736x/3c/1e/87/3c1e871625f3c31c9b7d10ed179205e9.jpg',
                'Fortnite': 'https://i.pinimg.com/736x/4b/ab/34/4bab34086b84ee2a0e1b66b1e82ed0be.jpg',
                'Apex Legends': 'https://i.pinimg.com/736x/bc/93/1b/bc931b47a7edf6322785f1a6427a3653.jpg',
                'Overwatch 2': 'https://i.pinimg.com/736x/6a/a2/4c/6aa24c0ce2d5823abd694787b125449c.jpg'
              };

              let route = `/presgame?game=${encodeURIComponent(game)}`;
              if (game === 'Valorant') route = '/gamepresval';
              if (game === 'League of Legends') route = '/gamepreslol';
              if (game === 'Apex Legends') route = '/gamepresal';
              if (game === 'Fortnite') route = '/gamepresfor';

              return (
                <div 
                  key={index} 
                  className={`rounded-lg overflow-hidden shadow-lg border ${
                    darkMode ? 'border-gray-700 bg-gray-800 hover:bg-gray-700' : 'border-gray-200 bg-white hover:bg-gray-100'
                  } transition-colors cursor-pointer`}
                  onClick={() => navigate(route)}
                >
                  <img 
                    src={gameImages[game] || 'https://via.placeholder.com/150'} 
                    alt={game} 
                    className="w-full h-80 object-cover"
                  />
                  <div className="p-4">
                    <h4 className="text-lg font-semibold">{game}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Découvrez les dernières actualités et stratégies.</p>
                    <span className="inline-block mt-3 px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      Populaire
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </section>
      <section>
        <h2 className="text-3xl font-bold mb-6 inline-block border-b-4 border-gray-300 pb-2">Activité récente</h2>
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentTopics.length === 0 ? (
              <div className="col-span-3 text-center text-gray-400 py-8">
                Aucun topic récent trouvé.
              </div>
            ) : (
              recentTopics.map((topic, index) => (
                <div
                  key={topic.id || index}
                  className={`p-6 rounded-lg shadow-md border ${
                    darkMode
                      ? 'border-gray-700 bg-gray-800 hover:bg-gray-800'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  } transition-transform transform hover:scale-105 cursor-pointer`}
                  onClick={() => navigate(`/tchat/${topic.id}`)}
                >
                  <p className="text-lg font-medium">{topic.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {topic.category ? topic.category : 'Sans catégorie'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {topic.createdAt
                      ? new Date(topic.createdAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default GameForum;