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
  image_url?: string;
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
    image: null as File | null,
  });
  const [userRsvpStatus, setUserRsvpStatus] = useState<{ [eventId: string]: 'going' | 'interested' | 'none' }>({});
  const [newComment, setNewComment] = useState<{ [eventId: string]: string }>({});
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function fetchUser() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
        return;
      }
      setUser(user);
    }
    fetchUser();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [cityId]);

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

      const user = await supabase.auth.getUser();
      const userId = user?.data?.user?.id;
      const rsvpStatus: { [eventId: string]: 'going' | 'interested' | 'none' } = {};

      if (userId && data) {
        data.forEach((event: Event) => {
          const userRsvp = event.rsvps.find(rsvp => rsvp.user.username === userId);
          rsvpStatus[event.id] = userRsvp?.status as 'going' | 'interested' || 'none';
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
        await supabase.from('event_rsvps').delete().match({ event_id: eventId, user_id: user.id });
      } else {
        await supabase.from('event_rsvps').upsert({
          event_id: eventId,
          user_id: user.id,
          status,
        }, {
          onConflict: 'event_id,user_id',
        });
      }

      setUserRsvpStatus(prev => ({
        ...prev,
        [eventId]: status,
      }));
    } catch (error) {
      console.error('Error updating RSVP:', error);
    }
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let imageUrl = null;
      if (newEvent.image) {
        const fileExt = newEvent.image.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `events/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, newEvent.image);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        imageUrl = data.publicUrl;
      }

      // Insert the event into the database
      const { error } = await supabase.from('events').insert({
        city_id: cityId,
        title: newEvent.title,
        description: newEvent.description || null,
        date: newEvent.date.toISOString(),
        added_by: user.id,
        location_name: newEvent.location_name || null,
        location_address: newEvent.location_address || null,
        location_lat: newEvent.location_lat || null,
        location_lng: newEvent.location_lng || null,
        tags: newEvent.tags || [],
        max_attendees: newEvent.max_attendees || null,
        image_url: imageUrl,
      });

      if (error) throw error;

      // Refresh events and reset form
      fetchEvents();
      setShowAddForm(false);
      setNewEvent({
        title: '',
        description: '',
        date: new Date(),
        location_name: '',
        location_address: '',
        location_lat: 0,
        location_lng: 0,
        tags: [],
        max_attendees: 0,
        image: null,
      });
    } catch (error) {
      console.error('Error adding event:', error);
    }
  }

  async function handleAddComment(eventId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const content = newComment[eventId];
      if (!content) return;

      const { error } = await supabase.from('event_discussions').insert({
        event_id: eventId,
        content,
        author_id: user.id,
      });

      if (error) throw error;

      // Refresh events to show the new comment
      fetchEvents();

      // Clear the comment input for this event
      setNewComment((prev) => ({ ...prev, [eventId]: '' }));
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      // Find the event in the array
      const event = events.find(e => e.id === eventId);
      if (!event) throw new Error('Event not found');

      // Check if the logged-in user is the creator of the event
      if (event.added_by !== user.id) {
        throw new Error('You can only delete your own events');
      }

      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) throw error;

      // Refresh the list of events after deletion
      setEvents(events.filter(e => e.id !== eventId));
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  }

  if (loading) return <div>Loading events...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Community Events</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          {showAddForm ? 'Cancel' : 'Create Event'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddEvent} className="bg-white p-6 rounded-lg shadow space-y-4">
          <input type="text" placeholder="Title" className="w-full p-2 border rounded" required
            value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />

          <textarea placeholder="Description" className="w-full p-2 border rounded" required
            value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} />

          <div>
            <label className="block text-sm font-medium">Event Date</label>
            <DatePicker
              selected={newEvent.date}
              onChange={date => date && setNewEvent({ ...newEvent, date })}
              className="w-full p-2 border rounded"
            />
          </div>

          <input type="text" placeholder="Location Name" className="w-full p-2 border rounded"
            value={newEvent.location_name} onChange={e => setNewEvent({ ...newEvent, location_name: e.target.value })} />
          <input type="text" placeholder="Location Address" className="w-full p-2 border rounded"
            value={newEvent.location_address} onChange={e => setNewEvent({ ...newEvent, location_address: e.target.value })} />

          <div>
            <label className="block text-sm font-medium">Event Tags</label>
            <select
              multiple
              className="w-full p-2 border rounded"
              value={newEvent.tags}
              onChange={e => setNewEvent({ ...newEvent, tags: Array.from(e.target.selectedOptions, option => option.value) })}
            >
              <option value="festival">Festival</option>
              <option value="meetup">Meetup</option>
              <option value="local_experience">Local Experience</option>
              <option value="food">Food</option>
              <option value="culture">Culture</option>
              <option value="outdoor">Outdoor</option>
            </select>
          </div>

          <input type="file" accept="image/*"
            onChange={e => setNewEvent({ ...newEvent, image: e.target.files?.[0] || null })}
          />

          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Add Event
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6">
        {events.length === 0 ? (
          <p>No events available for this city. You can create one!</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold">{event.title}</h3>
              <p className="text-sm text-gray-500">{new Date(event.date).toLocaleDateString()}</p>

              {/* Display event image if available */}
              {event.image_url && (
                <img
                  src={event.image_url}
                  alt={event.title}
                  className="w-full h-64 object-cover rounded-lg mb-4"
                />
              )}

              <p>{event.description}</p>
              <div className="space-x-4 mt-4">
                {userRsvpStatus[event.id] === 'none' ? (
                  <>
                    <button
                      onClick={() => handleRSVP(event.id, 'going')}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Going
                    </button>
                    <button
                      onClick={() => handleRSVP(event.id, 'interested')}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Interested
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleRSVP(event.id, 'none')}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Leave
                  </button>
                )}
              </div>

              {/* Delete button (only for the creator of the event) */}
              {event.added_by === user?.id && (
                <button
                  onClick={() => handleDeleteEvent(event.id)}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete Event
                </button>
              )}

              <div className="mt-4">
                <h4 className="text-lg font-semibold">Discussions:</h4>
                {event.discussions.length === 0 ? (
                  <p>No discussions yet.</p>
                ) : (
                  event.discussions.map((discussion) => (
                    <div key={discussion.id} className="mt-2">
                      <p>
                        <strong>{discussion.author.username}:</strong> {discussion.content}
                      </p>
                    </div>
                  ))
                )}

                {/* Add new comment input */}
                <div className="mt-4 flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={newComment[event.id] || ''}
                    onChange={(e) =>
                      setNewComment({ ...newComment, [event.id]: e.target.value })
                    }
                    className="flex-1 p-2 border rounded"
                  />
                  <button
                    onClick={() => handleAddComment(event.id)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Comment
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}