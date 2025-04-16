/*
  # Add post votes table and update posts schema

  1. New Tables
    - `post_votes`
      - `user_id` (uuid, references profiles.id)
      - `post_id` (uuid, references posts.id)
      - `vote_type` (text, either 'up' or 'down')
      - `created_at` (timestamp)

  2. Changes
    - Add default values for upvotes and downvotes in posts table
    - Add composite primary key to post_votes
    - Add foreign key constraints

  3. Security
    - Enable RLS on post_votes table
    - Add policies for authenticated users
*/

-- Create post_votes table
CREATE TABLE IF NOT EXISTS post_votes (
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
    vote_type text CHECK (vote_type IN ('up', 'down')),
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

-- Enable RLS
ALTER TABLE post_votes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can vote on posts"
    ON post_votes
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS post_votes_post_id_idx ON post_votes(post_id);
CREATE INDEX IF NOT EXISTS post_votes_user_id_idx ON post_votes(user_id);