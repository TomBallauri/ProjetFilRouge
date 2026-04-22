import React from 'react';
import { Trophy } from 'lucide-react';

const CompetitionPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] bg-gradient-to-br from-blue-100 via-blue-200 to-blue-300 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-8 border-blue-300 dark:border-gray-700 rounded-3xl">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 flex flex-col items-center w-full max-w-xs border-2 border-blue-400 dark:border-yellow-400">
        <Trophy size={48} className="mb-4 text-yellow-500 dark:text-yellow-400" />
        <h1 className="text-2xl font-bold text-blue-600 dark:text-yellow-400 mb-2">Coming soon !</h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm text-center max-w-xs">
          La page des compétitions arrive bientôt.<br />Restez connectés pour découvrir les prochains tournois et événements !
        </p>
      </div>
    </div>
  );
};

export default CompetitionPage;