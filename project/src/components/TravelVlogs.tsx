import React, { useEffect, useState } from 'react';
import { Plus, X,ThumbsUp, ThumbsDown, MessageSquare, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TravelVlog {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  created_at: string;
  like_count: number;
  dislike_count: number;
  author: {
    username: string;
    role: string;
  };
  city: {
    name: string;
    country: string;
  } | null;
  user_reaction?: 'like' | 'dislike' | null;
  comments: {
    id: string;
    content: string;
    created_at: string;
    author: {
      username: string;
    };
  }[];
}

export function TravelVlogs() {
  const [vlogs, setVlogs] = useState<TravelVlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [cities, setCities] = useState<{ id: string; name: string; country: string }[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({});
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({});
  const [newVlog, setNewVlog] = useState({
    title: '',
    description: '',
    video_url: '',
    thumbnail_url: '',
    city_id: '',
  });

  useEffect(() => {
    fetchVlogs();
    fetchCities();
  }, []);

  async function fetchVlogs() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('travel_vlogs')
        .select(`
          *,
          author:profiles!travel_vlogs_user_id_fkey(username, role),
          city:cities(name, country),comments:vlog_comments(
            id,
            content,
            created_at,
            author:profiles(username)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (user && data) {
        // Fetch user's reactions
        const { data: reactionsData, error: reactionsError } = await supabase
          .from('vlog_reactions')
          .select('vlog_id, reaction_type')
          .eq('user_id', user.id)
          .in('vlog_id', data.map(vlog => vlog.id));

        if (reactionsError) throw reactionsError;

        const reactionsMap = (reactionsData || []).reduce((acc, reaction) => ({
          ...acc,
          [reaction.vlog_id]: reaction.reaction_type,
        }), {});

        setVlogs(data.map(vlog => ({
          ...vlog,
          user_reaction: reactionsMap[vlog.id] || null,
        })));
      } else {
        setVlogs(data || []);
      }
    } catch (error) {
      console.error('Error fetching vlogs:', error);
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  }

  async function uploadVideo(file: File): Promise<string> {
    try {
      console.log('Uploading video:', file.name);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData, error: urlError } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      if (urlError || !publicUrlData.publicUrl) throw urlError;

      console.log('Video uploaded successfully:', publicUrlData.publicUrl);
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading video:', error);
      throw error;
    }
  }

  async function handleAddVlog(e: React.FormEvent) {
    e.preventDefault();
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let videoUrl = newVlog.video_url;

      if (videoFile) {
        videoUrl = await uploadVideo(videoFile);
      }

      const { error } = await supabase.from('travel_vlogs').insert([{
        ...newVlog,
        video_url: videoUrl,
        user_id: user.id,
        city_id: newVlog.city_id || null,
        thumbnail_url: newVlog.thumbnail_url || null, // Ensure thumbnail_url is included
      }]);

      if (error) throw error;

      setShowAddForm(false);
      setNewVlog({
        title: '',
        description: '',
        video_url: '',
        thumbnail_url: '',
        city_id: '',
      });
      setVideoFile(null);
      setVideoPreviewUrl(null);
      fetchVlogs();
    } catch (error) {
      alert(`Error adding vlog: ${error.message}`);
      console.error('Error adding vlog:', error);
    } finally {
      setUploading(false);
    }
  }

  async function handleReaction(vlogId: string, reactionType: 'like' | 'dislike') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const vlog = vlogs.find(v => v.id === vlogId);
      if (!vlog) return;

      const isRemovingReaction = vlog.user_reaction === reactionType;

      if (isRemovingReaction) {
        // Remove reaction
        await supabase
          .from('vlog_reactions')
          .delete()
          .eq('user_id', user.id)
          .eq('vlog_id', vlogId);

        // Update counts
        await supabase
          .from('travel_vlogs')
          .update({
            [`${reactionType}_count`]: vlog[`${reactionType}_count`] - 1
          })
          .eq('id', vlogId);
      } else {
        // Remove existing reaction if any
        if (vlog.user_reaction) {
          await supabase
            .from('vlog_reactions')
            .delete()
            .eq('user_id', user.id)
            .eq('vlog_id', vlogId);

          // Decrement old reaction count
          await supabase
            .from('travel_vlogs')
            .update({
              [`${vlog.user_reaction}_count`]: vlog[`${vlog.user_reaction}_count`] - 1
            })
            .eq('id', vlogId);
        }

        // Add new reaction
        await supabase
          .from('vlog_reactions')
          .insert({
            user_id: user.id,
            vlog_id: vlogId,
            reaction_type: reactionType
          });

        // Increment new reaction count
        await supabase
          .from('travel_vlogs')
          .update({
            [`${reactionType}_count`]: vlog[`${reactionType}_count`] + 1
          })
          .eq('id', vlogId);
      }

      fetchVlogs();
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  }

  async function handleAddComment(vlogId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const content = newComment[vlogId];
      if (!content?.trim()) return;

      const { error } = await supabase
        .from('vlog_comments')
        .insert({
          content: content.trim(),
          vlog_id: vlogId,
          user_id: user.id
        });

      if (error) throw error;

      setNewComment({ ...newComment, [vlogId]: '' });
      fetchVlogs();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  }

  function getVideoEmbedUrl(url: string): string {
    try {
      const videoUrl = new URL(url);
      if (videoUrl.hostname.includes('youtube.com') || videoUrl.hostname.includes('youtu.be')) {
        const videoId = url.includes('youtu.be')
          ? url.split('/').pop()
          : new URLSearchParams(videoUrl.search).get('v');
        return `https://www.youtube-nocookie.com/embed/${videoId}`;
      }
      return url;
    } catch {
      return url;
    }
  }

  if (loading) {
    return <div>Loading travel vlogs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Travel Vlogs</h1>
          <p className="mt-2 text-gray-600">Watch and share travel experiences from around the world</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Share Vlog
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddVlog} className="bg-white p-6 rounded-lg shadow space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              required
              value={newVlog.title}
              onChange={(e) => setNewVlog({ ...newVlog, title: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={newVlog.description}
              onChange={(e) => setNewVlog({ ...newVlog, description: e.target.value })}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Upload Video</label>
              <div className="mt-1 flex items-center space-x-4">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {uploading && <span className="text-sm text-gray-500">Uploading...</span>}
              </div>
            </div>

            {videoPreviewUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                <video
                  src={videoPreviewUrl}
                  controls
                  className="w-full rounded-lg"
                  style={{ maxHeight: '400px' }}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Or Enter Video URL</label>
              <input
                type="url"
                value={newVlog.video_url}
                onChange={(e) => setNewVlog({ ...newVlog, video_url: e.target.value })}
                placeholder="YouTube or video URL"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                You can either upload a video or provide a YouTube URL
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Thumbnail URL</label>
            <input
              type="url"
              value={newVlog.thumbnail_url}
              onChange={(e) => setNewVlog({ ...newVlog, thumbnail_url: e.target.value })}
              placeholder="Image URL for video thumbnail"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">City (Optional)</label>
            <select
              value={newVlog.city_id}
              onChange={(e) => setNewVlog({ ...newVlog, city_id: e.target.value })}
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

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setVideoFile(null);
                setVideoPreviewUrl(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || (!videoFile && !newVlog.video_url)}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Share Vlog'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-2 gap-6">
        {vlogs.map((vlog) => (
          <div key={vlog.id} className="bg-white shadow rounded-lg overflow-hidden">
            <div className="aspect-w-16 aspect-h-9">
              {vlog.video_url.includes('youtube.com') || vlog.video_url.includes('youtu.be') ? (
                // YouTube Embed
                <iframe
                  src={getVideoEmbedUrl(vlog.video_url)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  className="w-full h-full"
                />
              ) : (
                // Uploaded Video
                <video
                  src={vlog.video_url}
                  controls
                  poster={vlog.thumbnail_url || undefined} // Use thumbnail_url for the poster
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900">{vlog.title}</h3>
              {vlog.description && (
                <p className="mt-1 text-sm text-gray-600">{vlog.description}</p>
              )}
              <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
              <div className="mt-4 flex items-center space-x-4">
                <button
                  onClick={() => handleReaction(vlog.id, 'like')}
                  className={`flex items-center space-x-1 ${
                    vlog.user_reaction === 'like' ? 'text-green-600' : 'text-gray-500 hover:text-green-600'
                  }`}
                >
                  <ThumbsUp className="h-5 w-5" />
                  <span>{vlog.like_count || 0}</span>
                </button>
                <button
                  onClick={() => handleReaction(vlog.id, 'dislike')}
                  className={`flex items-center space-x-1 ${
                    vlog.user_reaction === 'dislike' ? 'text-red-600' : 'text-gray-500 hover:text-red-600'
                  }`}
                >
                  <ThumbsDown className="h-5 w-5" />
                  <span>{vlog.dislike_count || 0}</span>
                </button>
                <button
                  onClick={() => setShowComments({ ...showComments, [vlog.id]: !showComments[vlog.id] })}
                  className="flex items-center space-x-1 text-gray-500 hover:text-gray-700"
                >
                  <MessageSquare className="h-5 w-5" />
                  <span>{vlog.comments.length}</span>
                </button>
              </div>

              {showComments[vlog.id] && (
                <div className="mt-4 space-y-4">
                  {vlog.comments.map((comment) => (
                    <div key={comment.id} className="pl-4 border-l-2 border-gray-200">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {comment.author.username}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{comment.content}</p>
                    </div>
                  ))}

                  <div className="mt-4 flex space-x-2">
                    <input
                      type="text"
                      value={newComment[vlog.id] || ''}
                      onChange={(e) => setNewComment({ ...newComment, [vlog.id]: e.target.value })}
                      placeholder="Add a comment..."
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => handleAddComment(vlog.id)}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                    >
                      Post
                    </button>
                  </div>
                </div>
              )}
                <div>
                  By {vlog.author.username} ({vlog.author.role})
                </div>
                {vlog.city && (
                  <div>
                    {vlog.city.name}, {vlog.city.country}
                  </div>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {new Date(vlog.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}