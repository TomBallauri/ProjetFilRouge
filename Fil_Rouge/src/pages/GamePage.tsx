import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { Gamepad2, Search, Star, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GamesPage: React.FC = () => {
  const { darkMode } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const games = [
    {
      title: "Valorant",
      category: "FPS Tactique",
      players: 12543,
      rating: 4.7,
      image: "https://i.pinimg.com/736x/67/c0/7e/67c07ead929b049e453bedda45980b79.jpg",
      route: "/gamepresval" 
    },
    {
      title: "League of Legends",
      category: "MOBA",
      players: 34567,
      rating: 4.7,
      image: "https://i.pinimg.com/736x/d1/b1/1d/d1b11d5e4dbae547ac0d651476cec488.jpg",
      route: "/gamepreslol" 
    },
    {
      title: "Counter-Strike 2",
      category: "FPS",
      players: 45678,
      rating: 5.1,
      image: "https://i.pinimg.com/736x/3c/1e/87/3c1e871625f3c31c9b7d10ed179205e9.jpg",
      route: "/gameprescs2" 
    },
    {
      title: "Fortnite",
      category: "Battle Royale",
      rating: 4.9,
      image: "https://i.pinimg.com/736x/4b/ab/34/4bab34086b84ee2a0e1b66b1e82ed0be.jpg",
      route: "/gamepresfor" 
    },
    {
      title: "Apex Legends",
      category: "Battle Royale",
      players: 18765,
      rating: 6.6,
      image: "https://i.pinimg.com/736x/bc/93/1b/bc931b47a7edf6322785f1a6427a3653.jpg",
      route: "/gamepresal"
    },
    {
      title: "Overwatch 2",
      category: "FPS",
      players: 15678,
      rating: 1.8,
      image: "https://i.pinimg.com/736x/6a/a2/4c/6aa24c0ce2d5823abd694787b125449c.jpg",
      route: "/gamepresow2"
    }
  ];

  const filteredGames = games.filter(game =>
    game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    game.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`p-6 ${darkMode ? 'text-white' : ' text-gray-900'}`}>
      <div className={`p-8 mb-8 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <Gamepad2 className="mr-2 text-blue-500" />
          Jeux Vidéos
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Explorez notre sélection de jeux et rejoignez les communautés
        </p>
      </div>
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Rechercher un jeu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-3 rounded-lg ${
              darkMode 
                ? 'bg-gray-800 text-white' 
                : 'bg-white text-gray-900'
            } border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.map((game, index) => (
          <div 
            key={index}
            onClick={() => navigate(game.route)}
            className={`${
              darkMode ? 'bg-gray-800' : 'bg-white'
            } rounded-lg shadow overflow-hidden transition-transform duration-200 hover:transform hover:scale-105 cursor-pointer`}
          >
            <div 
              className="h-[450px] bg-cover bg-center"
              style={{ backgroundImage: `url(${game.image})` }}
            />
            <div className="p-4">
              <h3 className="text-xl font-semibold mb-2">{game.title}</h3>
              <span className={`inline-block px-2 py-1 rounded-full text-sm ${
                darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800'
              } mb-3`}>
                {game.category}
              </span>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="flex flex-col justify-center items-center h-full p-2 bg-gray-100 dark:bg-gray-700 rounded">
                  <Star size={28} className="mb-2 text-yellow-400" />
                  <span className="text-lg font-semibold text-black dark:text-white">{game.rating}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-100 dark:bg-gray-700 rounded">
                  <Trophy size={24} className="mb-1 text-yellow-500" />
                  <span className="text-lg font-semibold text-black dark:text-white">Tournois</span>
                  <span className="text-sm text-gray-500 mt-1">À venir</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GamesPage;