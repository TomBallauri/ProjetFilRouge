import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { Users, Trophy, Calendar, Search, ChevronDown, ChevronUp, Twitter, Instagram, Globe } from 'lucide-react';

const TeamsPage: React.FC = () => {
  const { darkMode } = useStore();
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGame, setFilterGame] = useState('ALL');
  const [filterRegion, setFilterRegion] = useState('ALL');

  // Mock data for teams
  const teams = [
    {
      media: {
          coverImage: 'https://img.freepik.com/photos-gratuite/amis-vue-cote-gagnant-jeu-video_23-2149349984.jpg?semt=ais_hybrid&w=740',
        },
      id: 1,
      name: 'Team Vitality',
      logo: '',
      game: 'Counter-Strike 2',
      region: 'Europe',
      established: 2013,
      players: [
        { name: 'ZywOo', role: 'AWPer', nationality: 'FR' },
        { name: 'Spinx', role: 'Rifler', nationality: 'IL' },
        { name: 'flameZ', role: 'Rifler', nationality: 'IL' },
        { name: 'apEX', role: 'IGL', nationality: 'FR' },
        { name: 'Magisk', role: 'Support', nationality: 'DK' }
      ],
      achievements: [
        { title: 'Major Paris 2023', year: 2023 },
        { title: 'IEM Rio 2023', year: 2023 },
        { title: 'EPL S17', year: 2023 }
      ],
      socials: {
        twitter: 'https://twitter.com/TeamVitality',
        instagram: 'https://instagram.com/TeamVitality',
        website: 'https://vitality.gg'
      },
      upcomingMatches: [
        { opponent: 'FaZe Clan', date: '15/11/2023', event: 'BLAST Premier' },
        { opponent: 'G2 Esports', date: '18/11/2023', event: 'IEM Cologne' }
      ],
      stats: {
        winRate: '72%',
        recentForm: ['W', 'W', 'L', 'W', 'W'],
        worldRanking: 1
      }
    },
    {
      id: 2,
      name: 'T1',
      logo: '',
      game: 'League of Legends',
      region: 'Korea',
      established: 2002,
      players: [
        { name: 'Faker', role: 'Mid', nationality: 'KR' },
        { name: 'Zeus', role: 'Top', nationality: 'KR' },
        { name: 'Oner', role: 'Jungle', nationality: 'KR' },
        { name: 'Gumayusi', role: 'ADC', nationality: 'KR' },
        { name: 'Keria', role: 'Support', nationality: 'KR' }
      ],
      achievements: [
        { title: 'Worlds 2023', year: 2023 },
        { title: 'LCK Summer 2023', year: 2023 },
        { title: 'MSI 2022', year: 2022 }
      ],
      socials: {
        twitter: 'https://twitter.com/T1LoL',
        instagram: 'https://instagram.com/T1',
        website: 'https://t1.gg'
      },
      upcomingMatches: [
        { opponent: 'Gen.G', date: '20/11/2023', event: 'LCK Finals' },
        { opponent: 'DRX', date: '25/11/2023', event: 'KeSPA Cup' }
      ],
      stats: {
        winRate: '68%',
        recentForm: ['W', 'L', 'W', 'W', 'W'],
        worldRanking: 2
      }
    }
  ];

  const games = ['ALL', 'Counter-Strike 2', 'League of Legends', 'Valorant', 'Fortnite', 'Dota 2'];
  const regions = ['ALL', 'Europe', 'North America', 'Korea', 'China', 'Brazil', 'Japan'];

  const filteredTeams = teams.filter(team => {
    return (
      (searchTerm === '' || team.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterGame === 'ALL' || team.game === filterGame) &&
      (filterRegion === 'ALL' || team.region === filterRegion)
    );
  });

  const toggleTeam = (id: number) => {
    setExpandedTeam(expandedTeam === id ? null : id);
  };

  return (
    <div className={`min-h-screen rounded-md ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Coming Soon Banner */}
      <div className={`relative ${darkMode ? 'bg-yellow-600' : 'bg-yellow-400'} py-4 text-center`}>
        <h1 className="text-2xl font-bold">COMING SOON!</h1>
        <p className="text-sm">Cette section sera bientôt disponible. Voici un aperçu...</p>
      </div>

      {/* Hero Section */}
      <div className="relative">
        <div className="h-64 w-full bg-gradient-to-r from-purple-600 to-blue-600 relative">
          <img 
            src={teams[0]?.media?.coverImage || ''} 
            alt="Cover Image" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-4xl font-bold mb-4">Équipes Esport</h1>
              <p className="text-xl">Découvrez les meilleures équipes professionnelles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Content (only show first team) */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">Aperçu de la fonctionnalité à venir</h2>
          <p className="mt-2">Voici un exemple de ce que vous pourrez voir bientôt</p>
        </div>

        {/* Show only the first team as preview */}
        {filteredTeams.slice(0, 1).map(team => (
          <div 
            key={team.id}
            className={`rounded-lg overflow-hidden shadow-lg transition-all duration-200 mx-auto max-w-2xl ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            {/* Team Header */}
            <div 
              className="p-6 cursor-pointer"
              onClick={() => toggleTeam(team.id)}
            >
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-xs text-gray-500 dark:text-gray-300">Logo</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold">{team.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      {team.game}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      {team.region}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Stats */}
            <div className="px-6 pb-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`p-2 rounded ${
                  darkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
                  <p className="font-semibold">{team.stats.winRate}</p>
                </div>
                <div className={`p-2 rounded ${
                  darkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Forme</p>
                  <div className="flex justify-center space-x-1">
                    {team.stats.recentForm.map((result, i) => (
                      <span 
                        key={i}
                        className={`w-5 h-5 flex items-center justify-center rounded text-xs ${
                          result === 'W' 
                            ? 'bg-green-500 text-white' 
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={`p-2 rounded ${
                  darkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Classement</p>
                  <p className="font-semibold">#{team.stats.worldRanking}</p>
                </div>
              </div>
            </div>

            {/* Expandable Content */}
            {expandedTeam === team.id && (
              <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
                {/* Players */}
                <div className="mt-4">
                  <h3 className="font-semibold mb-2 flex items-center">
                    <Users size={18} className="mr-2" />
                    Joueurs
                  </h3>
                  <ul className="space-y-2">
                    {team.players.slice(0, 3).map((player, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <div className="flex items-center">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 ${
                            darkMode ? 'bg-gray-700' : 'bg-gray-200'
                          }`}>
                            {player.nationality}
                          </span>
                          <span>{player.name}</span>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          darkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`}>
                          {player.role}
                        </span>
                      </li>
                    ))}
                    <li className="text-sm text-gray-500 dark:text-gray-400">
                      + {team.players.length - 3} autres joueurs...
                    </li>
                  </ul>
                </div>

                {/* Socials */}
                <div className="mt-6 flex space-x-3 justify-center">
                  <div className={`p-2 rounded-full ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    <Twitter size={18} />
                  </div>
                  <div className={`p-2 rounded-full ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    <Instagram size={18} />
                  </div>
                  <div className={`p-2 rounded-full ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    <Globe size={18} />
                  </div>
                </div>
              </div>
            )}

            {/* Toggle Button */}
            <div className="px-6 pb-4">
              <button
                onClick={() => toggleTeam(team.id)}
                className={`w-full py-2 rounded-b-lg flex items-center justify-center ${
                  darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                } transition-colors`}
              >
                {expandedTeam === team.id ? (
                  <ChevronUp size={18} className="mr-1" />
                ) : (
                  <ChevronDown size={18} className="mr-1" />
                )}
                {expandedTeam === team.id ? 'Réduire' : 'Voir plus'}
              </button>
            </div>
          </div>
        ))}

        {/* Coming Soon Message */}
        <div className={`mt-12 p-8 rounded-lg text-center ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        } shadow`}>
          <h3 className="text-2xl font-bold mb-4">Fonctionnalité en cours de développement</h3>
          <p className="mb-4">Nous travaillons dur pour vous offrir une expérience complète de suivi des équipes esport.</p>
          <div className={`inline-block px-6 py-3 rounded-full ${
            darkMode ? 'bg-yellow-600' : 'bg-yellow-400'
          } font-semibold`}>
            Bientôt disponible!
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamsPage;