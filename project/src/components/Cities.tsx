import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface City {
  id: string;
  name: string;
  country: string;
  description: string;
  image_url: string;
  posts: { count: number };
  profiles: { count: number };
}

export function Cities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinedCities, setJoinedCities] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCities();
    fetchJoinedCities();
  }, []);

  async function fetchCities() {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*, posts:posts(count), profiles:profiles(count)')
        .order('name');

      if (error) throw error;
      setCities(data || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchJoinedCities() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('city_members')
        .select('city_id')
        .eq('profile_id', user.id);

      if (error) throw error;
      const cityIds = data?.map((entry) => entry.city_id) || [];
      setJoinedCities(cityIds);
    } catch (error) {
      console.error('Error fetching joined cities:', error);
    }
  }

  async function handleJoinCity(cityId: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('city_members').insert({
        profile_id: user.id,
        city_id: cityId,
      });

      if (error) throw error;

      setJoinedCities((prev) => [...prev, cityId]);
    } catch (error) {
      console.error('Error joining city:', error);
    }
  }

  async function handleLeaveCity(cityId: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('city_members')
        .delete()
        .match({ profile_id: user.id, city_id: cityId });

      if (error) throw error;

      setJoinedCities((prev) => prev.filter((id) => id !== cityId));
    } catch (error) {
      console.error('Error leaving city:', error);
    }
  }

  if (loading) {
    return <div>Loading communities...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Communities</h1>
        <p className="mt-2 text-gray-600">
          Join travel communities and connect with locals and travelers worldwide
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((city) => {
          const isJoined = joinedCities.includes(city.id);

          return (
            <div
              key={city.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="h-48 overflow-hidden">
                <img
                  src={city.image_url || 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b'}
                  alt={city.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      r/{city.name.toLowerCase().replace(/\s+/g, '')}
                    </h2>
                    <p className="text-sm text-gray-500">{city.country}</p>
                  </div>
                  <button
                    onClick={() =>
                      isJoined ? handleLeaveCity(city.id) : handleJoinCity(city.id)
                    }
                    className={`px-4 py-1 text-sm font-medium rounded-full ${
                      isJoined
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    }`}
                  >
                    {isJoined ? 'Leave' : 'Join'}
                  </button>
                </div>

                {city.description && (
                  <p className="mt-2 text-gray-600 line-clamp-2">{city.description}</p>
                )}

                <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{city.profiles.count} members</span>
                  </div>
                  <div className="flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    <span>{city.posts.count} posts</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => navigate(`/cities/${city.id}/posts`)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                  >
                    Posts
                  </button>
                  <button
                    onClick={() => navigate(`/cities/${city.id}/events`)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                  >
                    Events
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
