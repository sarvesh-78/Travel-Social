import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './components/Auth';
import { Navigation } from './components/Navigation';
import { Cities } from './components/Cities';
import { Posts } from './components/Posts';
import { Events } from './components/Events';
import { Hotel } from './components/Hotel';
import { TravelPlans } from './components/TravelPlans';
import { TravelVlogs } from './components/TravelVlogs';
import Transport from './components/transport.tsx';
import { Matches } from './components/Matches';
import { Chat } from './components/Chat';
import { Profile } from './components/Profile';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Loading state to prevent rendering before session check

  useEffect(() => {
    // Check if there's an active session when the component mounts
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    fetchSession();

    // Listen for authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>; // Show loading state until user session is resolved
  }

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
                  // Ensure correct redirect behavior
                  <Navigate to="/cities" replace />
                )
              }
            />
            <Route
              path="/cities"
              element={user ? <Cities /> : <Navigate to="/" replace />}
            />
            <Route
              path="/vlogs"
              element={user ? <TravelVlogs /> : <Navigate to="/" replace />}
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
              path="/cities/:cityId/travel-plans"
              element={user ? <TravelPlans /> : <Navigate to="/" replace />}
            />
            <Route
              path="/cities/:cityId/hotels"
              element={user ? <Hotel /> : <Navigate to="/" replace />}
            />
            <Route
              path="/cities/:cityId/transport"
              element={user ? <Transport /> : <Navigate to="/" replace />}
            />
            <Route
              path="/matches"
              element={user ? <Matches /> : <Navigate to="/" replace />}
            />
            <Route
              path="/chat/:chatId"
              element={user ? <Chat /> : <Navigate to="/" replace />}
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
