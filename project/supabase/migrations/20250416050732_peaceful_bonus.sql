/*
  # Add Events and RSVPs Schema

  1. New Tables
    - `event_tags`
      - Enum type for event categories
    
    - `event_rsvps`
      - Track user RSVPs for events
      - Status options: going, interested
      - Created timestamp
    
    - Update `events` table
      - Add location fields
      - Add tags support
      - Add discussion thread support

  2. Security
    - Enable RLS on new tables
    - Add policies for authenticated users
    - Specific policies for event creators
*/

-- Create event tags enum
CREATE TYPE event_tag AS ENUM ('festival', 'meetup', 'local_experience', 'food', 'culture', 'outdoor');

-- Add new columns to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS location_name text,
ADD COLUMN IF NOT EXISTS location_address text,
ADD COLUMN IF NOT EXISTS location_lat double precision,
ADD COLUMN IF NOT EXISTS location_lng double precision,
ADD COLUMN IF NOT EXISTS tags event_tag[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS max_attendees integer,
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- Create event_rsvps table
CREATE TABLE IF NOT EXISTS event_rsvps (
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    status text CHECK (status IN ('going', 'interested')),
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
);

-- Create event_discussions table for threaded discussions
CREATE TABLE IF NOT EXISTS event_discussions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    parent_id uuid REFERENCES event_discussions(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_discussions ENABLE ROW LEVEL SECURITY;

-- Event RSVPs policies
CREATE POLICY "Users can see all RSVPs"
    ON event_rsvps FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Authenticated users can RSVP"
    ON event_rsvps FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own RSVPs"
    ON event_rsvps FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their RSVPs"
    ON event_rsvps FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Event Discussions policies
CREATE POLICY "Anyone can view event discussions"
    ON event_discussions FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Authenticated users can create discussions"
    ON event_discussions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own discussions"
    ON event_discussions FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete their own discussions"
    ON event_discussions FOR DELETE
    TO authenticated
    USING (auth.uid() = author_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS event_rsvps_event_id_idx ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_id_idx ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS event_discussions_event_id_idx ON event_discussions(event_id);
CREATE INDEX IF NOT EXISTS event_discussions_parent_id_idx ON event_discussions(parent_id);