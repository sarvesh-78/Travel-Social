/*
  # Initial Schema for Travel Platform

  1. New Tables
    - `cities`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `country` (text, required) 
      - `description` (text)
      - `image_url` (text)
      - `created_at` (timestamp)

    - `profiles` (extends Supabase auth.users)
      - `id` (uuid, primary key, references auth.users)
      - `username` (text, unique, required)
      - `bio` (text)
      - `role` (text, either 'resident' or 'traveler')
      - `city_id` (uuid, references cities)
      - `score` (integer)
      - `created_at` (timestamp)

    - `posts`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `content` (text, required)
      - `author_id` (uuid, references profiles)
      - `city_id` (uuid, references cities)
      - `flair` (text, required)
      - `upvotes` (integer)
      - `downvotes` (integer)
      - `created_at` (timestamp)

    - `comments`
      - `id` (uuid, primary key)
      - `content` (text, required)
      - `author_id` (uuid, references profiles)
      - `post_id` (uuid, references posts)
      - `created_at` (timestamp)

    - `events`
      - `id` (uuid, primary key)
      - `city_id` (uuid, references cities)
      - `title` (text, required)
      - `description` (text)
      - `date` (timestamp, required)
      - `added_by` (uuid, references profiles)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Add specific policies for residents vs travelers

  3. Enums and Constraints
    - Create enum for user roles
    - Create enum for post flairs
    - Add foreign key constraints
*/

-- Create enum types
CREATE TYPE user_role AS ENUM ('resident', 'traveler');
CREATE TYPE post_flair AS ENUM ('food_spot', 'hidden_gem', 'travel_plan', 'question', 'review', 'tip');

-- Create cities table
CREATE TABLE cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL,
  description text,
  image_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, country)
);

-- Create profiles table (extends auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  username text UNIQUE NOT NULL,
  bio text,
  role user_role NOT NULL DEFAULT 'traveler',
  city_id uuid REFERENCES cities,
  score integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create posts table
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid REFERENCES profiles NOT NULL,
  city_id uuid REFERENCES cities NOT NULL,
  flair post_flair NOT NULL,
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create comments table
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  author_id uuid REFERENCES profiles NOT NULL,
  post_id uuid REFERENCES posts NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create events table
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid REFERENCES cities NOT NULL,
  title text NOT NULL,
  description text,
  date timestamptz NOT NULL,
  added_by uuid REFERENCES profiles NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Cities Policies
CREATE POLICY "Cities are viewable by everyone"
  ON cities FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only authenticated users can insert cities"
  ON cities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Profiles Policies
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Posts Policies
CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- Comments Policies
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- Events Policies
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only residents can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = added_by AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'resident'
    )
  );

CREATE POLICY "Only event creator can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid() = added_by)
  WITH CHECK (auth.uid() = added_by);

CREATE POLICY "Only event creator can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (auth.uid() = added_by);

-- Create functions for vote management
CREATE OR REPLACE FUNCTION increment_post_votes(
  post_id uuid,
  vote_type text
) RETURNS void AS $$
BEGIN
  IF vote_type = 'upvote' THEN
    UPDATE posts SET upvotes = upvotes + 1 WHERE id = post_id;
  ELSIF vote_type = 'downvote' THEN
    UPDATE posts SET downvotes = downvotes + 1 WHERE id = post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update user score
CREATE OR REPLACE FUNCTION update_user_score(
  user_id uuid,
  points integer
) RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET score = score + points
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;