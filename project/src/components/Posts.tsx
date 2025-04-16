import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageSquare, ThumbsUp, ThumbsDown, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Post {
  id: string;
  title: string;
  content: string;
  flair: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  author: {
    username: string;
    role: string;
  };
  comments: Comment[];
  user_vote?: 'up' | 'down' | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: {
    username: string;
    role: string;
  };
}

export function Posts() {
  const { cityId } = useParams<{ cityId: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    flair: 'food_spot',
  });
  const [cityName, setCityName] = useState('');
  const [commentContent, setCommentContent] = useState<{ [key: string]: string }>({});
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchCityName();
    fetchPosts();
  }, [cityId]);

  async function fetchCityName() {
    if (!cityId) return;
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('name')
        .eq('id', cityId)
        .single();

      if (error) throw error;
      if (data) setCityName(data.name);
    } catch (error) {
      console.error('Error fetching city:', error);
    }
  }

  async function fetchPosts() {
    if (!cityId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(username, role),
          comments(
            id,
            content,
            created_at,
            author:profiles!comments_author_id_fkey(username, role)
          )
        `)
        .eq('city_id', cityId)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Fetch user's votes if logged in
      if (user && postsData) {
        const { data: votesData, error: votesError } = await supabase
          .from('post_votes')
          .select('post_id, vote_type')
          .eq('user_id', user.id)
          .in('post_id', postsData.map(post => post.id));

        if (votesError) throw votesError;

        const votesMap = (votesData || []).reduce((acc, vote) => ({
          ...acc,
          [vote.post_id]: vote.vote_type,
        }), {});

        setPosts(postsData.map(post => ({
          ...post,
          user_vote: votesMap[post.id] || null,
        })));
      } else {
        setPosts(postsData || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPost(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase.from('posts').insert([{
        ...newPost,
        city_id: cityId,
        author_id: user.id,
      }]);

      if (error) throw error;
      setShowAddForm(false);
      setNewPost({ title: '', content: '', flair: 'food_spot' });
      fetchPosts();
    } catch (error) {
      console.error('Error adding post:', error);
    }
  }

  async function handleAddComment(postId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const content = commentContent[postId];
      if (!content?.trim()) return;

      const { error } = await supabase.from('comments').insert([{
        content: content.trim(),
        post_id: postId,
        author_id: user.id,
      }]);

      if (error) throw error;
      setCommentContent({ ...commentContent, [postId]: '' });
      fetchPosts();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  }

  async function handleVote(postId: string, voteType: 'up' | 'down') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const isRemovingVote = post.user_vote === voteType;

      // Update the post_votes table
      if (isRemovingVote) {
        await supabase
          .from('post_votes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId);
      } else {
        await supabase
          .from('post_votes')
          .upsert({
            user_id: user.id,
            post_id: postId,
            vote_type: voteType,
          }, {
            onConflict: 'user_id,post_id',
          });
      }

      // Update the posts table vote counts
      const updates: any = {};
      if (post.user_vote === 'up' && voteType === 'down') {
        updates.upvotes = post.upvotes - 1;
        updates.downvotes = post.downvotes + 1;
      } else if (post.user_vote === 'down' && voteType === 'up') {
        updates.upvotes = post.upvotes + 1;
        updates.downvotes = post.downvotes - 1;
      } else if (isRemovingVote) {
        updates[voteType === 'up' ? 'upvotes' : 'downvotes'] = 
          voteType === 'up' ? post.upvotes - 1 : post.downvotes - 1;
      } else {
        updates[voteType === 'up' ? 'upvotes' : 'downvotes'] = 
          voteType === 'up' ? post.upvotes + 1 : post.downvotes + 1;
      }

      await supabase
        .from('posts')
        .update(updates)
        .eq('id', postId);

      fetchPosts();
    } catch (error) {
      console.error('Error voting:', error);
    }
  }

  if (loading) {
    return <div>Loading posts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">r/{cityName.toLowerCase().replace(/\s+/g, '')}</h1>
          <p className="text-gray-600">Discover local insights and travel tips</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Post
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddPost} className="bg-white p-6 rounded-lg shadow">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                required
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Content</label>
              <textarea
                required
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Flair</label>
              <select
                value={newPost.flair}
                onChange={(e) => setNewPost({ ...newPost, flair: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="food_spot">Food Spot</option>
                <option value="hidden_gem">Hidden Gem</option>
                <option value="travel_plan">Travel Plan</option>
                <option value="question">Question</option>
                <option value="review">Review</option>
                <option value="tip">Tip</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-3">
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
              Post
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{post.title}</h2>
                  <div className="flex items-center mt-1">
                    <span className="text-sm text-gray-500">
                      Posted by {post.author.username} ({post.author.role})
                    </span>
                    <span className="mx-2 text-gray-300">•</span>
                    <span className="text-sm text-gray-500">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 text-sm font-medium text-indigo-600 bg-indigo-100 rounded-full">
                  {post.flair.replace('_', ' ')}
                </span>
              </div>
              <p className="text-gray-600">{post.content}</p>
              <div className="mt-4 flex items-center space-x-4">
                <button 
                  onClick={() => handleVote(post.id, 'up')}
                  className={`flex items-center ${
                    post.user_vote === 'up' ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'
                  }`}
                >
                  <ThumbsUp className="h-5 w-5 mr-1" />
                  <span>{post.upvotes}</span>
                </button>
                <button 
                  onClick={() => handleVote(post.id, 'down')}
                  className={`flex items-center ${
                    post.user_vote === 'down' ? 'text-red-600' : 'text-gray-500 hover:text-red-600'
                  }`}
                >
                  <ThumbsDown className="h-5 w-5 mr-1" />
                  <span>{post.downvotes}</span>
                </button>
                <button 
                  onClick={() => setShowComments({ ...showComments, [post.id]: !showComments[post.id] })}
                  className="flex items-center text-gray-500 hover:text-indigo-600"
                >
                  <MessageSquare className="h-5 w-5 mr-1" />
                  <span>{post.comments.length} Comments</span>
                </button>
              </div>
            </div>

            {showComments[post.id] && (
              <div className="border-t border-gray-200 p-6 space-y-4">
                <div className="space-y-4">
                  {post.comments.map((comment) => (
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
                </div>

                <div className="mt-4 flex space-x-2">
                  <input
                    type="text"
                    value={commentContent[post.id] || ''}
                    onChange={(e) => setCommentContent({ 
                      ...commentContent, 
                      [post.id]: e.target.value 
                    })}
                    placeholder="Add a comment..."
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => handleAddComment(post.id)}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                  >
                    Comment
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}