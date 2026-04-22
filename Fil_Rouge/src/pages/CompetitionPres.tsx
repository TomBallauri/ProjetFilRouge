import React from 'react';
import { useStore } from '../lib/store';
import { Calendar, Users, Award, Clock, MapPin, Twitch, Youtube, ChevronLeft} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CompetitionPres: React.FC = () => {
  const { darkMode } = useStore();
  const navigate = useNavigate();

  const tournament = {
    id: 1,
    name: 'Championnat du Monde CS2',
    game: 'Counter-Strike 2',
    gameLogo: 'https://cdn.cloudflare.steamstatic.com/steam/apps/730/capsule_231x87.jpg',
    prizePool: '2 500 000$',
    startDate: '15/11/2023',
    endDate: '20/11/2023',
    location: 'Paris, France',
    participants: 32,
    registered: 28,
    organizer: 'ESL',
    description: 'Le championnat du monde de Counter-Strike 2 réunit les meilleures équipes internationales pour une compétition intense sur 5 jours. Format à double élimination avec phases de groupes et bracket final.',
    rules: [
      'Format Best of 3',
      'Maps pool officiel Valve',
      'Veto système 1-2-2-1',
      '128-tick servers',
      'Anti-cheat ESL activé'
    ],
    schedule: [
      { day: 'Jour 1', events: ['Phase de groupes - Matchs A à D', 'Cérémonie d\'ouverture'] },
      { day: 'Jour 2', events: ['Phase de groupes - Matchs E à H', 'Début bracket upper'] },
      { day: 'Jour 3', events: ['Bracket lower', 'Quarts de finale upper'] },
      { day: 'Jour 4', events: ['Demi-finales', 'Finale lower'] },
      { day: 'Jour 5', events: ['Grande Finale', 'Cérémonie de clôture'] }
    ],
    streams: [
      { platform: 'Twitch', url: 'https://www.twitch.tv/esl_csgo', icon: <Twitch size={20} /> },
      { platform: 'YouTube', url: 'https://youtube.com/eslcs', icon: <Youtube size={20} /> }
    ],
    coverImage: 'https://wallpapers.com/images/hd/4k-counter-strike-global-offensive-background-kxn0bi89qker07el.jpg'
  };

  return (
    <div className={`min-h-screen rounded-md ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <div className="relative">
        <div className="h-64 w-full bg-cover bg-center text-white " style={{ backgroundImage: `url(${tournament.coverImage})` }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-4">{tournament.name}</h1>
              <p className="text-xl">{tournament.game}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-blue-500 hover:text-blue-600 transition-colors mb-6"
        >
          <ChevronLeft size={20} className="mr-2" />
          Retour
        </button>
        <div className={`rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 shadow`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center">
              <Award size={20} className="mr-2 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Prize Pool</p>
                <p className="font-semibold">{tournament.prizePool}</p>
              </div>
            </div>
            <div className="flex items-center">
              <Calendar size={20} className="mr-2 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                <p className="font-semibold">{tournament.startDate} - {tournament.endDate}</p>
              </div>
            </div>
            <div className="flex items-center">
              <MapPin size={20} className="mr-2 text-red-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lieu</p>
                <p className="font-semibold">{tournament.location}</p>
              </div>
            </div>
            <div className="flex items-center">
              <Users size={20} className="mr-2 text-green-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Participants</p>
                <p className="font-semibold">{tournament.registered}/{tournament.participants}</p>
              </div>
            </div>
          </div>
          <p className="mb-6">{tournament.description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 ">
            <div>
              <h4 className="font-semibold mb-3">Règles</h4>
              <ul className="space-y-2">
                {tournament.rules.map((rule, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 md:mt-0 border-l-4 pl-6 border-solid border-gray-300 dark:border-gray-600">
              <h4 className="font-semibold mb-3">Programme</h4>
              <div className="space-y-4">
                {tournament.schedule.map((day, index) => (
                  <div key={index}>
                    <p className="font-medium">{day.day}</p>
                    <ul className="mt-1 space-y-1">
                      {day.events.map((event, i) => (
                        <li key={i} className="flex items-start">
                          <Clock size={16} className="mr-2 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                          <span>{event}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-8">
            <h4 className="font-semibold mb-3">Streams Officiels</h4>
            <div className="flex flex-wrap gap-3">
              {tournament.streams.map((stream, index) => (
                <a
                  key={index}
                  href={stream.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-4 py-2 rounded-lg flex items-center ${
                    darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                  } transition-colors`}
                >
                  <span className="mr-2">{stream.icon}</span>
                  <span>Regarder sur {stream.platform}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitionPres;