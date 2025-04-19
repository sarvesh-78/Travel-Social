/*
  # Add Vlog Engagement Features

  1. New Tables
    - `vlog_reactions`
      - `user_id` (uuid, references profiles)
      - `vlog_id` (uuid, references travel_vlogs)
      - `reaction_type` (text, either 'like' or 'dislike')
      - `created_at` (timestamp)

    - `vlog_comments`
      - `id` (uuid, primary key)
      - `content` (text, required)
      - `user_id` (uuid, references profiles)
      - `vlog_id` (uuid, references travel_vlogs)
      - `created_at` (timestamp)

  2. Changes
    - Add like_count and dislike_count to travel_vlogs table
    - Add indexes for performance
    - Add RLS policies
*/

-- Add reaction counts to travel_vlogs
ALTER TABLE travel_vlogs
ADD COLUMN IF NOT EXISTS like_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS dislike_count integer DEFAULT 0;

-- Create vlog_reactions table
CREATE TABLE IF NOT EXISTS vlog_reactions (
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    vlog_id uuid REFERENCES travel_vlogs(id) ON DELETE CASCADE,
    reaction_type text CHECK (reaction_type IN ('like', 'dislike')),
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, vlog_id)
);

-- Create vlog_comments table
CREATE TABLE IF NOT EXISTS vlog_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text NOT NULL,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    vlog_id uuid REFERENCES travel_vlogs(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE vlog_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vlog_comments ENABLE ROW LEVEL SECURITY;

-- Vlog Reactions Policies
CREATE POLICY "Anyone can view reactions"
    ON vlog_reactions FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Users can react to vlogs"
    ON vlog_reactions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their reactions"
    ON vlog_reactions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions"
    ON vlog_reactions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Vlog Comments Policies
CREATE POLICY "Anyone can view comments"
    ON vlog_comments FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Users can create comments"
    ON vlog_comments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their comments"
    ON vlog_comments FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their comments"
    ON vlog_comments FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS vlog_reactions_vlog_id_idx ON vlog_reactions(vlog_id);
CREATE INDEX IF NOT EXISTS vlog_reactions_user_id_idx ON vlog_reactions(user_id);
CREATE INDEX IF NOT EXISTS vlog_comments_vlog_id_idx ON vlog_comments(vlog_id);
CREATE INDEX IF NOT EXISTS vlog_comments_user_id_idx ON vlog_comments(user_id);