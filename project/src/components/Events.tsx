import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location_name: string;
  location_address: string;
  location_lat: number;
  location_lng: number;
  tags: string[];
  max_attendees: number;
  added_by: string;
  rsvps: {
    status: string;
    user: {
      username: string;
    };
  }[];
  discussions: {
    id: string;
    content: string;
    created_at: string;
    author: {
      username: string;
    };
  }[];
  author: {
    username: string;
    role: string;
  };
}

export function Events() {
  const { cityId } = useParams<{ cityId: string }>();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: new Date(),
    location_name: '',
    location_address: '',
    location_lat: 0,
    location_lng: 0,
    tags: [] as string[],
    max_attendees: 0,
  });
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [discussion, setDiscussion] = useState('');

  // This will hold the RSVP status for each event for the logged-in user
  const [userRsvpStatus, setUserRsvpStatus] = useState<{ [eventId: string]: 'going' | 'interested' | 'none' }>({});

  useEffect(() => {
    fetchEvents();
  }, [cityId]);

  // Fetch events and the user's RSVP status
  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`*,
          author:profiles!events_added_by_fkey(username, role),
          rsvps:event_rsvps(
            status,
            user:profiles(username)
          ),
          discussions:event_discussions(
            id,
            content,
            created_at,
            author:profiles(username)
          )
        `)
        .eq('city_id', cityId)
        .order('date', { ascending: true });

      if (error) throw error;

      // Setting the RSVP status for the logged-in user
      const user = await supabase.auth.getUser();
      const userId = user?.data?.user?.id;
      const rsvpStatus: { [eventId: string]: 'going' | 'interested' | 'none' } = {};

      if (userId && data) {
        data.forEach((event: Event) => {
          const userRsvp = event.rsvps.find(rsvp => rsvp.user.username === userId);
          if (userRsvp) {
            rsvpStatus[event.id] = userRsvp.status as 'going' | 'interested';
          } else {
            rsvpStatus[event.id] = 'none';
          }
        });
      }

      setEvents(data || []);
      setUserRsvpStatus(rsvpStatus);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRSVP(eventId: string, status: 'going' | 'interested' | 'none') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
  
      if (status === 'none') {
        const { error } = await supabase.from('event_rsvps').delete().match({
          event_id: eventId,
          user_id: user.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_rsvps').upsert({
          event_id: eventId,
          user_id: user.id,
          status,
        }, {
          onConflict: 'event_id,user_id',
        });
        if (error) throw error;
      }
  
      // 👇 Immediately update RSVP status locally for instant UI feedback
      setUserRsvpStatus(prev => ({
        ...prev,
        [eventId]: status,
      }));
    } catch (error) {
      console.error('Error updating RSVP:', error);
    }
  }

  if (loading) {
    return <div>Loading events...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Community Events</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          Create Event
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddEvent} className="bg-white p-6 rounded-lg shadow space-y-4">
          {/* Form Fields here */}
        </form>
      )}

      <div className="grid grid-cols-1 gap-6">
        {events.length === 0 ? (
          <p>No events available for this city. You can create one!</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
              <p className="text-sm text-gray-500">{event.date}</p>
              <p className="mt-2 text-gray-700">{event.description}</p>
              <div className="mt-2">
                <strong>Tags:</strong> {event.tags.join(', ')}
              </div>

              <div className="mt-4">
                {userRsvpStatus[event.id] === 'going' ? (
                  <button
                    onClick={() => handleRSVP(event.id, 'none')}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    Cancel RSVP
                  </button>
                ) : userRsvpStatus[event.id] === 'interested' ? (
                  <button
                    onClick={() => handleRSVP(event.id, 'none')}
                    className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
                  >
                    Cancel RSVP
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleRSVP(event.id, 'going')}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                    >
                      RSVP as Going
                    </button>
                    <button
                      onClick={() => handleRSVP(event.id, 'interested')}
                      className="ml-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      RSVP as Interested
                    </button>
                  </>
                )}
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold">Discussion:</div>
                {event.discussions.map((discussion) => (
                  <div key={discussion.id} className="text-sm text-gray-700 mt-2">
                    <strong>{discussion.author.username}:</strong> {discussion.content}
                  </div>
                ))}
                <textarea
                  value={discussion}
                  onChange={(e) => setDiscussion(e.target.value)}
                  className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Add your comment"
                />
                <button
                  onClick={() => handleAddDiscussion(event.id)}
                  className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Add Discussion
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

