import React from 'react';
import { useStore } from '../lib/store';

const Footer: React.FC = () => {
  const { darkMode } = useStore();

  return (
    <footer className="w-full py-4 bg-gray-900 text-center mt-8">
      <span className={darkMode ? 'text-blue-400' : 'text-gray-700'}>
        © {new Date().getFullYear()} Projet Fil Rouge — Tous droits réservés.
      </span>
    </footer>
  );
};

export default Footer;