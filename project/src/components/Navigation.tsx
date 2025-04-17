import React from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Home, User as UserIcon, Calendar, Map } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NavigationProps {
  user: User;
}

export function Navigation({ user }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { cityId } = useParams();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link
              to="/cities"
              className="flex items-center px-4 text-gray-700 hover:text-indigo-600"
            >
              <Home className="h-5 w-5 mr-2" />
              <span className="font-medium">TravelHub</span>
            </Link>

            {cityId && (
              <div className="flex ml-6 space-x-4">
                <Link
                  to={`/cities/${cityId}/posts`}
                  className={`flex items-center px-3 py-2 text-sm font-medium ${
                    location.pathname.endsWith('/posts')
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-indigo-600'
                  }`}
                >
                  Posts
                </Link>
                <Link
                  to={`/cities/${cityId}/events`}
                  className={`flex items-center px-3 py-2 text-sm font-medium ${
                    location.pathname.endsWith('/events')
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-indigo-600'
                  }`}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Events
                </Link>
                <Link
                  to={`/cities/${cityId}/travel-plans`}
                  className={`flex items-center px-3 py-2 text-sm font-medium ${
                    location.pathname.endsWith('/travel-plans')
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-indigo-600'
                  }`}
                >
                  <Map className="h-4 w-4 mr-1" />
                  Travel Plans
                </Link>
              </div>
            )}
          </div>
          
          <div className="flex items-center">
            <Link
              to="/profile"
              className={`flex items-center px-4 ${
                location.pathname === '/profile'
                  ? 'text-indigo-600'
                  : 'text-gray-700 hover:text-indigo-600'
              }`}
            >
              <UserIcon className="h-5 w-5 mr-2" />
              <span>{user.email}</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="ml-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}