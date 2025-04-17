import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, MapPin, MessageSquare, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TravelPlan {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  images: string[];
  created_at: string;
  author: {
    username: string;
    role: string;
  };
  comments: {
    id: string;
    content: string;
    created_at: string;
    author: {
      username: string;
    };
  }[];
}

export function TravelPlans() {
  const { cityId } = useParams<{ cityId: string }>();
  const [plans, setPlans] = useState<TravelPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [newPlan, setNewPlan] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    images: [] as string[],
  });

  useEffect(() => {
    fetchTravelPlans();
  }, [cityId]);

  async function fetchTravelPlans() {
    try {
      const { data, error } = await supabase
        .from('travel_plans')
        .select(`
          *,
          author:profiles!travel_plans_user_id_fkey(username, role),
          comments:travel_plan_comments(
            id,
            content,
            created_at,
            author:profiles(username)
          )
        `)
        .eq('city_id', cityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching travel plans:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPlan(e: React.FormEvent) {
    e.preventDefault();
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('No user found');

      const { error } = await supabase.from('travel_plans').insert([
        {
          title: newPlan.title,
          description: newPlan.description || null,
          start_date: newPlan.start_date,
          end_date: newPlan.end_date,
          images: newPlan.images.length > 0 ? newPlan.images : null,
          city_id: cityId,
          user_id: user.id,
        },
      ]);

      if (error) throw error;

      setShowAddForm(false);
      setNewPlan({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        images: [],
      });
      fetchTravelPlans();
    } catch (error) {
      console.error('Error adding travel plan:', error);
      alert('Failed to add travel plan. Please try again.');
    }
  }

  async function handleAddComment(planId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase.from('travel_plan_comments').insert({
        content: comment,
        plan_id: planId,
        user_id: user.id,
      });

      if (error) throw error;
      setComment('');
      fetchTravelPlans();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  }

  if (loading) {
    return <div>Loading travel plans...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Travel Plans</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Share Travel Plan
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddPlan} className="bg-white p-6 rounded-lg shadow space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              required
              value={newPlan.title}
              onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              required
              value={newPlan.description}
              onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                required
                value={newPlan.start_date}
                onChange={(e) => setNewPlan({ ...newPlan, start_date: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                required
                value={newPlan.end_date}
                onChange={(e) => setNewPlan({ ...newPlan, end_date: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Image URLs</label>
            <div className="mt-1 space-y-2">
              {newPlan.images.map((url, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => {
                      const newImages = [...newPlan.images];
                      newImages[index] = e.target.value;
                      setNewPlan({ ...newPlan, images: newImages });
                    }}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="https://example.com/image.jpg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newImages = newPlan.images.filter((_, i) => i !== index);
                      setNewPlan({ ...newPlan, images: newImages });
                    }}
                    className="p-2 text-red-600 hover:text-red-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setNewPlan({ ...newPlan, images: [...newPlan.images, ''] })}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                + Add Image URL
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Create Plan
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{plan.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    By {plan.author.username} ({plan.author.role})
                  </p>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="h-5 w-5 mr-2" />
                  {new Date(plan.start_date).toLocaleDateString()} - {new Date(plan.end_date).toLocaleDateString()}
                </div>
              </div>

              <p className="text-gray-600 whitespace-pre-wrap">{plan.description}</p>

              {plan.images && plan.images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {plan.images.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Travel plan image ${index + 1}`}
                      className="rounded-lg object-cover w-full h-48"
                    />
                  ))}
                </div>
              )}

              <div className="mt-4">
                <button
                  onClick={() => setSelectedPlan(selectedPlan === plan.id ? null : plan.id)}
                  className="flex items-center text-sm text-gray-500 hover:text-gray-700"
                >
                  <MessageSquare className="h-5 w-5 mr-2" />
                  {plan.comments.length} Comments
                </button>

                {selectedPlan === plan.id && (
                  <div className="mt-4 space-y-4">
                    {plan.comments.map((comment) => (
                      <div key={comment.id} className="pl-4 border-l-2 border-gray-200">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {comment.author.username}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 text-gray-600">{comment.content}</p>
                      </div>
                    ))}

                    <div className="mt-4 flex space-x-2">
                      <input
                        type="text"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleAddComment(plan.id)}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                      >
                        Comment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}