import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Moon, Sun, User, LogOut } from 'lucide-react';
import { Joystick } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, setUser, darkMode, toggleDarkMode } = useStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

if (user && user.email !== 'demo@example.com') {
  console.log('user in Navbar:', user);
}

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  return (
    <nav
      className={`px-4 py-3 ${
        darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
      } shadow-md sticky top-0 z-10`}
    >
      <div className="container mx-auto flex justify-between items-center">
        <Link
          to="/"
          className="text-xl font-bold flex items-center space-x-0.5 ml-6"
        >
          <Joystick size={30} />
          <span className="text-blue-500">Game</span>
          <span>Forum</span>
        </Link>

        <div className="hidden md:flex space-x-4 w-full max-w-md">
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="relative">
            <button
              className="p-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center"
              onClick={() => setDropdownOpen((open) => !open)}
              aria-label="Profil"
            >
              {user && user.avatar ? (
                <img
                  src={user.avatar}
                  alt="Profil"
                  className="w-8 h-8 rounded-full object-cover border-2 border-blue-400"
                />
              ) : (
                <User size={20} />
              )}
            </button>
            {dropdownOpen && (
              <div
                ref={dropdownRef}
                id="profile-dropdown"
                className="absolute right-[-40%] mt-2 w-48 bg-white dark:bg-gray-800 rounded shadow-lg py-2 z-20"
              >
                {!user ? (
                  <>
                    <Link
                      to="/login"
                      className="block px-4 py-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Se connecter
                    </Link>
                    <Link
                      to="/register"
                      className="block px-4 py-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md"
                      onClick={() => setDropdownOpen(false)}
                    >
                      S'inscrire
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Profil
                    </Link>
                    <button
                      onClick={() => {
                        setUser(null);
                        localStorage.removeItem('token');
                        setDropdownOpen(false);
                        window.location.reload();
                      }}
                      className="w-full text-left block px-4 py-2 text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <div className="flex items-center">
                        <LogOut size={16} className="mr-2" />
                        <span>Logout</span>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;


