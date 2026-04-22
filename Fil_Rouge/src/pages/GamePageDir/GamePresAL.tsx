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
  id: 'apex-legends',
    title: 'Apex Legends',
    developer: 'Respawn Entertainment',
    releaseDate: '04/02/2019',
    genre: 'Battle Royale',
    platforms: ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch'],
    rating: 6.6,
    reviewsCount: 5000000,
    playersCount: 130000000,
    description: `Apex Legends est un battle royale héroïque où des équipes de trois joueurs utilisent des personnages aux capacités uniques pour être les derniers survivants. Avec son système de ping révolutionnaire et son gameplay fluide, Apex a élevé le genre.`,
    features: [
      '20+ légendes uniques',
      'Système de ping innovant',
      'Gameplay fluide et rapide',
      'Mises à jour saisonnières',
      'Mode arenas compétitif'
    ],
    systemRequirements: {
      minimum: {
        os: 'Windows 10 64-bit',
        processor: 'Intel Core i3-6300',
        memory: '6 GB RAM',
        graphics: 'Nvidia GeForce GT 640',
        storage: '75 GB'
      },
      recommended: {
        os: 'Windows 10 64-bit',
        processor: 'Intel Core i5-3570K',
        memory: '8 GB RAM',
        graphics: 'Nvidia GeForce GTX 970',
        storage: '75 GB'
      }
    },
    media: {
      coverImage: 'https://images7.alphacoders.com/991/991702.jpg',
      screenshots: [
        'https://i.pinimg.com/736x/88/e5/87/88e587ea8cd0afa74bb4e12536cd7b6c.jpg',
        'https://i.pinimg.com/736x/87/ff/52/87ff526fb7625db8f83d185deacde40a.jpg',
        'https://i.pinimg.com/736x/c8/fe/31/c8fe31a4604536744bfaf7ad6055ac20.jpg'
      ],
      trailer: 'https://www.youtube.com/embed/oQtHENM_GZU'
    }
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
                src="https://i.pinimg.com/736x/bc/93/1b/bc931b47a7edf6322785f1a6427a3653.jpg" 
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
                    src="https://i.pinimg.com/736x/7e/35/59/7e355945a50146d2e8cecd38926c6625.jpg" 
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
                {['Battle Royale', 'Légendes', 'Escouade', 'Ping System', 'Cross-Platform'].map((tag, index) => (
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