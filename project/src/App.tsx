import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './components/Auth';
import { Navigation } from './components/Navigation';
import { Cities } from './components/Cities';
import { Posts } from './components/Posts';
import { Events } from './components/Events';
import { Profile } from './components/Profile';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';

function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for changes on auth state (sign in, sign out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {user && <Navigation user={user} />}
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route
              path="/"
              element={
                !user ? (
                  <div className="flex items-center justify-center">
                    <Auth />
                  </div>
                ) : (
                  <Navigate to="/cities" replace />
                )
              }
            />
            <Route
              path="/cities"
              element={user ? <Cities /> : <Navigate to="/" replace />}
            />
            <Route
              path="/cities/:cityId/posts"
              element={user ? <Posts /> : <Navigate to="/" replace />}
            />
            <Route
              path="/cities/:cityId/events"
              element={user ? <Events /> : <Navigate to="/" replace />}
            />
            <Route
              path="/profile"
              element={user ? <Profile user={user} /> : <Navigate to="/" replace />}
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;