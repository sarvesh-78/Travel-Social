/*
  # Add Travel Vlogs Schema

  1. New Tables
    - `travel_vlogs`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `description` (text)
      - `video_url` (text, required)
      - `thumbnail_url` (text)
      - `user_id` (uuid, references profiles)
      - `city_id` (uuid, references cities)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on travel_vlogs table
    - Add policies for authenticated users
*/

-- Create travel_vlogs table
CREATE TABLE IF NOT EXISTS travel_vlogs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    video_url text NOT NULL,
    thumbnail_url text,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    city_id uuid REFERENCES cities(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE travel_vlogs ENABLE ROW LEVEL SECURITY;

-- Travel Vlogs Policies
CREATE POLICY "Travel vlogs are viewable by everyone"
    ON travel_vlogs FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Users can create travel vlogs"
    ON travel_vlogs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own travel vlogs"
    ON travel_vlogs FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own travel vlogs"
    ON travel_vlogs FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS travel_vlogs_user_id_idx ON travel_vlogs(user_id);
CREATE INDEX IF NOT EXISTS travel_vlogs_city_id_idx ON travel_vlogs(city_id);
CREATE INDEX IF NOT EXISTS travel_vlogs_created_at_idx ON travel_vlogs(created_at DESC);