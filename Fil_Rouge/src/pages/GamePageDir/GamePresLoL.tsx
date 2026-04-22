import React, { useState } from 'react';
import { useStore } from '../../lib/store';
import { Star, Users, Gamepad2, ChevronDown, ChevronUp, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GamePres: React.FC = () => {
  const { darkMode } = useStore();
  const [showFullDescription, setShowFullDescription] = useState(false); 
  const navigate = useNavigate(); 
  const [activeTab, setActiveTab] = useState('overview'); 

  const game = {
 id: 'league-of-legends',
    title: 'League of Legends',
    developer: 'Riot Games',
    releaseDate: '27/10/2009',
    genre: 'MOBA',
    platforms: ['PC'],
    rating: 4.7,
    reviewsCount: 8500000,
    playersCount: 750000000,
    description: `League of Legends est un MOBA compétitif où deux équipes de cinq champions s'affrontent pour détruire la base adverse. Avec plus de 150 champions disponibles, chaque partie offre une expérience unique.`,
    features: [
      '150+ champions uniques',
      'Cartes variées',
      'Mode classé compétitif',
      'Mises à jour fréquentes',
      'Écosystème esport florissant'
    ],
    systemRequirements: {
      minimum: {
        os: 'Windows 7 64-bit',
        processor: 'Intel Core i3-530',
        memory: '4 GB RAM',
        graphics: 'Nvidia GeForce 9600GT',
        storage: '16 GB'
      },
      recommended: {
        os: 'Windows 10 64-bit',
        processor: 'Intel Core i5-3300',
        memory: '8 GB RAM',
        graphics: 'Nvidia GeForce GTX 660',
        storage: '16 GB'
      }
    },
    media: {
      coverImage: 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/ffe8f50201af51a0956875d2aeeb9e662eb0b228-3840x2160.png',
      screenshots: [
        'https://i.pinimg.com/736x/47/a4/06/47a40662a45246e9fb8d24491ab9f6b5.jpg',
        'https://i.pinimg.com/736x/9a/f3/ea/9af3ea8a68b1641f84f69c9218555f9e.jpg',
        'https://i.pinimg.com/736x/56/70/2e/56702e71636100cef9e2e849cca57767.jpg'
      ],
      trailer: 'https://www.youtube.com/embed/vzHrjOMfHPY'
    },
    tournaments: [
      {
        id: 1,
        name: 'World Championship 2023',
        date: '10/10/2023',
        prize: '2 250 000$',
        participants: 24
      },
      {
        id: 2,
        name: 'LEC Summer Split',
        date: '17/06/2023',
        prize: '200 000€',
        participants: 10
      }
    ]
  };

  const toggleDescription = () => {
    setShowFullDescription(!showFullDescription);
  };

  return (
    <div className={`min-h-screen rounded-md ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <div className="relative">
        <div className="h-96 w-full overflow-hidden">
          <img 
            src={game.media.coverImage} 
            alt={game.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0"></div>
        </div>
        <div className="container mx-auto px-4 relative -mt-20">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-48 h-64 rounded-lg overflow-hidden shadow-xl border-4 border-white dark:border-gray-800">
              <img 
                src="https://i.pinimg.com/736x/d1/b1/1d/d1b11d5e4dbae547ac0d651476cec488.jpg" 
                alt={`${game.title} logo`} 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-4 text-white">{game.title}</h1>
              <div className="flex flex-wrap items-center gap-4 mb-4 text-gray-300">
                <span className="flex items-center text-yellow-500">
                  <Star size={18} className="mr-1" />
                  {game.rating}/10 ({game.reviewsCount.toLocaleString()} avis)
                </span>
                <span className="flex items-center">
                  <Users size={18} className="mr-1" />
                  {game.playersCount.toLocaleString()} joueurs
                </span>
                <span className="flex items-center">
                  <Gamepad2 size={18} className="mr-1" />
                  {game.genre}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {game.platforms.map((platform, index) => (
                  <span 
                    key={index}
                    className={`px-3 py-1 rounded-full text-sm ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`}
                  >
                    {platform}
                  </span>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">

        <div className="container mx-auto pb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-blue-500 hover:text-blue-600 transition-colors"
          >
            <ChevronLeft size={20} className="mr-2" />
            Retour
          </button>
        </div>

        <div className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} mb-8`}>
          <div className="flex space-x-8">
            {['overview', 'media'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 px-1 font-medium ${
                  activeTab === tab
                    ? darkMode
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-blue-600 border-b-2 border-blue-600'
                    : darkMode
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-500 hover:text-gray-800'
                } transition-colors capitalize`}
              >
                {tab === 'overview' ? 'Aperçu' : 'Médias'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {activeTab === 'overview' && (
              <>
                <div className={`rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 shadow mb-6`}>
                  <h2 className="text-2xl font-bold mb-4">Description</h2>
                  <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {game.description}
                  </p>
                  <button
                    onClick={toggleDescription}
                    className="flex items-center text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {showFullDescription ? (
                      <>
                        <ChevronUp size={16} className="mr-1" />
                        Voir moins
                      </>
                    ) : (
                      <>
                        <ChevronDown size={16} className="mr-1" />
                        Voir plus
                      </>
                    )}
                  </button>
                </div>

                <div className={`rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 shadow mb-6`}>
                  <h2 className="text-2xl font-bold mb-4">Fonctionnalités</h2>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {game.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 shadow`}>
                  <h2 className="text-2xl font-bold mb-4">Configuration requise</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-3">Minimum</h3>
                      <ul className="space-y-2">
                        {Object.entries(game.systemRequirements.minimum).map(([key, value]) => (
                          <li key={key} className="flex justify-between">
                            <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{key}:</span>
                            <span className={darkMode ? 'text-gray-300' : 'text-gray-800'}>{value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-3">Recommandé</h3>
                      <ul className="space-y-2">
                        {Object.entries(game.systemRequirements.recommended).map(([key, value]) => (
                          <li key={key} className="flex justify-between">
                            <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{key}:</span>
                            <span className={darkMode ? 'text-gray-300' : 'text-gray-800'}>{value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'media' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-4">Trailer</h2>
                  <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
                    <iframe 
                      src={game.media.trailer} 
                      title={`${game.title} Trailer`}
                      className="w-full h-96"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-4">Captures d'écran</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {game.media.screenshots.map((screenshot, index) => (
                      <div key={index} className="rounded-lg overflow-hidden shadow-lg">
                        <img 
                          src={screenshot} 
                          alt={`${game.title} screenshot ${index + 1}`} 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            <div className={`rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 shadow`}>
              <h2 className="text-xl font-semibold mb-4">Statistiques</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Joueurs actifs</h3>
                  <p className="text-2xl font-bold">1.2M</p>
                </div>
                <div>

                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Note communautaire</h3>
                  <div className="flex items-center">
                    <Star size={20} className="text-yellow-500 mr-1" />
                    <span className="text-2xl font-bold">{game.rating}/10</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 shadow`}>
              <h2 className="text-xl font-semibold mb-4">Développeur</h2>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
                  <img 
                    src="https://i.pinimg.com/736x/af/e9/ca/afe9caf7daea0349e5e1a2104b3d9852.jpg" 
                    alt={game.developer} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-medium">{game.developer}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sortie: {game.releaseDate}</p>
                </div>
              </div>
            </div>

            <div className={`rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 shadow`}>
              <h2 className="text-xl font-semibold mb-4">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {['MOBA', 'Stratégie', 'Équipe', 'Compétitif', 'Esport'].map((tag, index) => (
                  <span 
                    key={index}
                    className={`px-3 py-1 rounded-full text-sm ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePres;