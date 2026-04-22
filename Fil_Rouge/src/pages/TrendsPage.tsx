import React from 'react';
import { useStore } from '../lib/store';
import { TrendingUp, MessageSquare, ThumbsUp, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TrendsPage: React.FC = () => {
  const { darkMode } = useStore();
  const navigate = useNavigate();

  const trendingTopics = [
    {
      title: "Nouveau Battle Pass Fortnite",
      category: "Battle Royale",
      views: 15243,
      comments: 342,
      likes: 892,
      timeAgo: "2 heures"
    },
    {
      title: "Meta actuelle de League of Legends",
      category: "MOBA",
      views: 12453,
      comments: 567,
      likes: 1023,
      timeAgo: "3 heures"
    },
    {
      title: "Guide des armes CS2",
      category: "FPS",
      views: 9876,
      comments: 234,
      likes: 567,
      timeAgo: "5 heures"
    },
    {
      title: "Tier List Valorant",
      category: "FPS Tactique",
      views: 8765,
      comments: 432,
      likes: 765,
      timeAgo: "6 heures"
    }
  ];

  return (
    <div className={`p-6 ${darkMode ? 'text-white' : ' text-gray-900'}`}>
      <div className={`p-8 mb-8 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <TrendingUp className="mr-2 text-blue-500" />
          Tendances
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Découvrez ce qui fait vibrer la communauté en ce moment
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <h2 className="text-3xl font-bold mb-6 inline-block border-b-4 border-gray-300 pb-4">Sujets populaires</h2>
          <div className="space-y-4">
            {trendingTopics.map((topic, index) => (
                <div 
                key={index} 
                onClick={() => navigate('/tchat')}
                className={`${
                  darkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'
                } p-4 rounded-lg shadow transition-all duration-200 cursor-pointer`}
                >
                <div className="flex justify-between items-start">
                  <div>
                  <h3 className="font-medium text-lg mb-1">{topic.title}</h3>
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {topic.category}
                  </span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{topic.timeAgo}</span>
                </div>
                <div className="flex items-center mt-4 space-x-6 text-gray-600 dark:text-gray-400">
                  <div className="flex items-center">
                  <Eye size={16} className="mr-1" />
                  <span>{topic.views}</span>
                  </div>
                  <div className="flex items-center">
                  <MessageSquare size={16} className="mr-1" />
                  <span>{topic.comments}</span>
                  </div>
                  <div className="flex items-center">
                  <ThumbsUp size={16} className="mr-1" />
                  <span>{topic.likes}</span>
                  </div>
                </div>
                </div>
            ))}
          </div>
        </div>
        </div>
      </div>
  );
};

export default TrendsPage;