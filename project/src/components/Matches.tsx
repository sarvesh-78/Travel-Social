import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  username: string;
  bio: string;
  role: 'resident' | 'traveler';
  city_id: string | null;
  interests: string[];
  city: {
    name: string;
    country: string;
  } | null;
}

export function Matches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchMatches();
    }
  }, [currentUser]);

  async function fetchCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          city:cities(name, country)
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setCurrentUser(data);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  }

  async function fetchMatches() {
    if (!currentUser) return;

    try {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          city:cities(name, country)
        `)
        .neq('id', currentUser.id);

      // Only add city_id filter if user has a city
      if (currentUser.city_id) {
        query = query.eq('city_id', currentUser.city_id);
      }

      // Add interests filter only if user has interests
      if (currentUser.interests && currentUser.interests.length > 0) {
        if (currentUser.city_id) {
          // If we have both city and interests, use OR condition
          query = query.or(`city_id.eq.${currentUser.city_id},interests.overlaps.{${currentUser.interests.map(i => `"${i}"`).join(',')}}`);
        } else {
          // If we only have interests, just filter by interests
          query = query.overlaps('interests', currentUser.interests);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setMatches(data || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartChat(matchId: string) {
    try {
      // Check if chat already exists
      const { data: existingChat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .or(`and(user1_id.eq.${currentUser?.id},user2_id.eq.${matchId}),and(user1_id.eq.${matchId},user2_id.eq.${currentUser?.id})`)
        .maybeSingle();

      if (chatError) throw chatError;

      if (existingChat) {
        navigate(`/chat/${existingChat.id}`);
        return;
      }

      // Create new chat
      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert({
          user1_id: currentUser?.id < matchId ? currentUser?.id : matchId,
          user2_id: currentUser?.id < matchId ? matchId : currentUser?.id,
        })
        .select()
        .single();

      if (createError) throw createError;
      navigate(`/chat/${newChat.id}`);
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  }

  if (loading) {
    return <div>Finding matches...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Find Travel Buddies</h1>
        <p className="mt-2 text-gray-600">
          Connect with travelers and locals who share your interests
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {matches.map((match) => (
          <div
            key={match.id}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {match.username}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {match.role.charAt(0).toUpperCase() + match.role.slice(1)}
                  </p>
                </div>
                <button
                  onClick={() => handleStartChat(match.id)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </button>
              </div>

              {match.city && (
                <p className="mt-2 text-sm text-gray-600">
                  📍 {match.city.name}, {match.city.country}
                </p>
              )}

              {match.bio && (
                <p className="mt-2 text-gray-600 line-clamp-3">{match.bio}</p>
              )}

              {match.interests && match.interests.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {match.interests.map((interest) => (
                    <span
                      key={interest}
                      className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {matches.length === 0 && (
          <div className="col-span-2 text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">
              No matches found. Try updating your interests or city to find more connections!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}