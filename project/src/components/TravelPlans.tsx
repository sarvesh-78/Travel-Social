import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CommunityWiki from './CommunityWiki';
import { Hotel } from './Hotel';
import Transport from './transport.tsx';

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
  const [view, setView] = useState<"main" | "share" | "allPlans">("main"); // Track the current view
  const [newPlan, setNewPlan] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    images: [] as string[],
  });
  const [newComment, setNewComment] = useState<{ [planId: string]: string }>({});

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

      setView("main");
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

  async function handleAddComment(e: React.FormEvent, planId: string) {
    e.preventDefault();
    if (!newComment[planId]) {
      alert('Comment cannot be empty.');
      return;
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('No user found');

      const { error } = await supabase.from('travel_plan_comments').insert([
        {
          content: newComment[planId],
          plan_id: planId, // Correct column name
          user_id: user.id,
        },
      ]);

      if (error) throw error;

      // Clear the comment input and refresh the comments
      setNewComment({ ...newComment, [planId]: '' });
      fetchTravelPlans(); // Refresh the travel plans to include the new comment
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    }
  }

  if (loading) {
    return <div>Loading travel plans...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Navigation Buttons */}
      {view === "main" && (
        <div className="flex justify-between items-center">
          <button
            onClick={() => setView("allPlans")}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            View All Travel Plans
          </button>
          <button
            onClick={() => setView("share")}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Share Travel Plan
          </button>
        </div>
      )}

      {/* Main View */}
      {view === "main" && (
        <>
          <div className="mt-10">
            <h2 className="text-2xl font-bold text-gray-900">Transport</h2>
            <Transport city={cityId || ''} />
          </div>
          <CommunityWiki />
          <div className="mt-10">
            <h2 className="text-2xl font-bold text-gray-900">Highly Recommended</h2>
            <Hotel />
          </div>
        </>
      )}

      {/* All Travel Plans View */}
      {view === "allPlans" && (
        <div>
          <button
            onClick={() => setView("main")}
            className="mb-4 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
          >
            Back
          </button>
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

                  {/* Display Images */}
                  {plan.images && plan.images.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {plan.images.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`Travel Plan Image ${index + 1}`}
                          className="w-full h-64 object-cover rounded-lg shadow"
                        />
                      ))}
                    </div>
                  )}

                  {/* Comments Section */}
                  <div className="mt-6">
                    <h4 className="text-lg font-semibold text-gray-800">Comments</h4>
                    {plan.comments.length > 0 ? (
                      <ul className="mt-2 space-y-4">
                        {plan.comments.map((comment) => (
                          <li key={comment.id} className="border-t pt-2">
                            <p className="text-sm text-gray-700">{comment.content}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              By {comment.author.username} on {new Date(comment.created_at).toLocaleDateString()}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500 mt-2">No comments yet.</p>
                    )}

                    {/* Add Comment Form */}
                    <form
                      onSubmit={(e) => handleAddComment(e, plan.id)}
                      className="mt-4 flex items-center space-x-2"
                    >
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={newComment[plan.id] || ''}
                        onChange={(e) => setNewComment({ ...newComment, [plan.id]: e.target.value })}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                      >
                        Submit
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share Travel Plan View */}
      {view === "share" && (
        <div>
          <button
            onClick={() => setView("main")}
            className="mb-4 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
          >
            Back
          </button>
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
              <label className="block text-sm font-medium text-gray-700">Images</label>
              <div className="space-y-2">
                {newPlan.images.map((image, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Enter image URL"
                      value={image}
                      onChange={(e) => {
                        const updatedImages = [...newPlan.images];
                        updatedImages[index] = e.target.value;
                        setNewPlan({ ...newPlan, images: updatedImages });
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updatedImages = newPlan.images.filter((_, i) => i !== index);
                        setNewPlan({ ...newPlan, images: updatedImages });
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setNewPlan({ ...newPlan, images: [...newPlan.images, ''] })}
                className="mt-2 px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Add Image
              </button>
              <p className="text-sm text-gray-500 mt-1">You can add multiple image URLs.</p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setView("main")}
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
        </div>
      )}
    </div>
  );
}