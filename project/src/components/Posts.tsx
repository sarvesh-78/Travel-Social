import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
    id: string;
  };
  comments: Comment[];
  image_url?: string;
  user_vote?: 'up' | 'down';
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    flair: 'food_spot',
  });
  const [cityName, setCityName] = useState('');
  const [user, setUser] = useState<any>(null);
  const [newComment, setNewComment] = useState<{ [postId: string]: string }>({});
  const [commentContent, setCommentContent] = useState<{ [postId: string]: string }>({});

  useEffect(() => {
    async function fetchUser() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
        return;
      }
      if (!user) {
        window.location.href = '/login'; // Redirect to login page
      } else {
        setUser(user);
      }
    }
    fetchUser();
  }, []);

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
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(username, role, id),
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

      setPosts(postsData || []);
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
      if (!user) throw new Error('Not logged in');

      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        imageUrl = data.publicUrl;
      }

      const { error } = await supabase.from('posts').insert({
        title: newPost.title,
        content: newPost.content,
        flair: newPost.flair,
        city_id: cityId,
        author_id: user.id,
        image_url: imageUrl,
      });

      if (error) throw error;

      // Refresh posts and reset form
      fetchPosts();
      setShowAddForm(false);
      setNewPost({
        title: '',
        content: '',
        flair: 'food_spot',
      });
      setImageFile(null);
    } catch (error) {
      console.error('Error adding post:', error);
    }
  }

  async function handleDeletePost(postId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      console.log('Deleting post with ID:', postId);

      // Find the post in the array
      const post = posts.find(p => p.id === postId);
      if (!post) throw new Error('Post not found');

      // Check if the logged-in user is the author of the post
      if (post.author.id !== user.id) {
        throw new Error('You can only delete your own posts');
      }

      // Delete the post from the posts table
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;

      // Refresh the list of posts after deletion
      setPosts(posts.filter(p => p.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
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
      fetchPosts(); // Refresh posts to show the new comment
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

      // Fetch the user's existing vote for this post
      const { data: existingVote, error: fetchError } = await supabase
        .from('post_votes')
        .select('vote_type')
        .eq('user_id', user.id)
        .eq('post_id', postId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // Ignore "No rows found" error (code PGRST116), handle other errors
        console.error('Error fetching existing vote:', fetchError);
        return;
      }

      const isRemovingVote = existingVote?.vote_type === voteType; // Check if the user is removing their vote

      if (isRemovingVote) {
        // Remove the vote
        const { error: deleteError } = await supabase
          .from('post_votes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId);

        if (deleteError) {
          console.error('Error removing vote:', deleteError);
          return;
        }

        // Update the posts table vote counts
        const updates = {
          [voteType === 'up' ? 'upvotes' : 'downvotes']: Math.max(
            voteType === 'up' ? post.upvotes - 1 : post.downvotes - 1,
            0
          ),
        };

        const { error: updateError } = await supabase
          .from('posts')
          .update(updates)
          .eq('id', postId);

        if (updateError) {
          console.error('Error updating post votes:', updateError);
          return;
        }
      } else {
        // Add or switch the vote
        const { error: upsertError } = await supabase
          .from('post_votes')
          .upsert({
            user_id: user.id,
            post_id: postId,
            vote_type: voteType,
          }, {
            onConflict: 'user_id,post_id',
          });

        if (upsertError) {
          console.error('Error upserting vote:', upsertError);
          return;
        }

        // Update the posts table vote counts
        const updates: any = {};
        if (existingVote?.vote_type === 'up' && voteType === 'down') {
          // Switch from upvote to downvote
          updates.upvotes = Math.max(post.upvotes - 1, 0);
          updates.downvotes = post.downvotes + 1;
        } else if (existingVote?.vote_type === 'down' && voteType === 'up') {
          // Switch from downvote to upvote
          updates.upvotes = post.upvotes + 1;
          updates.downvotes = Math.max(post.downvotes - 1, 0);
        } else {
          // New vote
          updates[voteType === 'up' ? 'upvotes' : 'downvotes'] = voteType === 'up' ? post.upvotes + 1 : post.downvotes + 1;
        }

        const { error: updateError } = await supabase
          .from('posts')
          .update(updates)
          .eq('id', postId);

        if (updateError) {
          console.error('Error updating post votes:', updateError);
          return;
        }
      }

      fetchPosts(); // Refresh posts to reflect the updated votes
    } catch (error) {
      console.error('Error voting:', error);
    }
  }

  if (!user) {
    return <div>Loading user...</div>;
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
        <form onSubmit={handleAddPost} className="bg-white p-6 rounded-lg shadow space-y-4">
          <input
            type="text"
            placeholder="Title"
            className="w-full p-2 border rounded"
            required
            value={newPost.title}
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
          />
          <textarea
            placeholder="Content"
            className="w-full p-2 border rounded"
            required
            value={newPost.content}
            onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
          />
          <select
            className="w-full p-2 border rounded"
            value={newPost.flair}
            onChange={(e) => setNewPost({ ...newPost, flair: e.target.value })}
          >
            <option value="food_spot">Food Spot</option>
            <option value="travel_tip">Travel Tip</option>
            <option value="local_event">Local Event</option>
          </select>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Add Post
          </button>
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
                {user && post.author.id === user.id && (
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-gray-600">{post.content}</p>
              {post.image_url && <img src={post.image_url} alt={post.title} className="mt-4 w-full h-auto" />}

              <div className="flex space-x-4 mt-4">
                <button
                  onClick={() => handleVote(post.id, 'up')}
                  className={`px-4 py-2 rounded ${post.user_vote === 'up' ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  Upvote ({post.upvotes})
                </button>
                <button
                  onClick={() => handleVote(post.id, 'down')}
                  className={`px-4 py-2 rounded ${post.user_vote === 'down' ? 'bg-red-700 text-white' : 'bg-red-600 text-white hover:bg-red-700'}`}
                >
                  Downvote ({post.downvotes})
                </button>
              </div>

              {/* Comments Section */}
              <div className="mt-4">
                <h4 className="text-lg font-semibold">Comments:</h4>
                {post.comments.length === 0 ? (
                  <p>No comments yet.</p>
                ) : (
                  post.comments.map((comment) => (
                    <div key={comment.id} className="mt-2">
                      <p>
                        <strong>{comment.author.username}:</strong> {comment.content}
                      </p>
                    </div>
                  ))
                )}

                {/* Add Comment Input */}
                <div className="mt-4 flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={commentContent[post.id] || ''}
                    onChange={(e) =>
                      setCommentContent({ ...commentContent, [post.id]: e.target.value })
                    }
                    className="flex-1 p-2 border rounded"
                  />
                  <button
                    onClick={() => handleAddComment(post.id)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Comment
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}