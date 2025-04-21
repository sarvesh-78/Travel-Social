import React, { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface ProfileProps {
  user: User;
}

interface UserProfile {
  username: string;
  bio: string;
  role: 'Local Guide' | 'Nomad';
  city_id: string | null;
}

interface City {
  id: string;
  name: string;
  country: string;
}

export function Profile({ user }: ProfileProps) {
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<City[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    username: '',
    bio: '',
    role: 'Nomad',
    city_id: null,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchCities();
  }, [user]);

  async function fetchProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, bio, role, city_id')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCities() {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, country')
        .order('name');
      if (error) throw error;
      setCities(data || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  }

  async function updateProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      if (!profile.username.trim()) {
        setError('Username is required');
        return;
      }

      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', profile.username)
        .neq('id', user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      if (existingUser) {
        setError('Username is already taken');
        return;
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            username: profile.username.trim(),
            bio: profile.bio.trim(),
            role: profile.role,
            city_id: profile.city_id,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (upsertError) throw upsertError;

      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile. Please try again.');
    }
  }

  if (loading) {
    return <div>Loading profile...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile Settings</h1>
      <form onSubmit={updateProfile} className="space-y-6 bg-white shadow rounded-lg p-6">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Username</label>
          <input
            type="text"
            required
            value={profile.username}
            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Bio</label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Role</label>
          <select
            value={profile.role}
            onChange={(e) => setProfile({ ...profile, role: e.target.value as UserProfile['role'] })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="Local Guide">Local Guide</option>
            <option value="Nomad">Nomad</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <select
            value={profile.city_id || ''}
            onChange={(e) => setProfile({ ...profile, city_id: e.target.value || null })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">Select a city</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}, {city.country}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
