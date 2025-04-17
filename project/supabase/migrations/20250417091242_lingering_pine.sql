/*
  # Add Travel Plans Schema

  1. New Tables
    - `travel_plans`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `description` (text)
      - `start_date` (date, required)
      - `end_date` (date, required)
      - `images` (text array)
      - `user_id` (uuid, references profiles)
      - `city_id` (uuid, references cities)
      - `created_at` (timestamp)

    - `travel_plan_comments`
      - `id` (uuid, primary key)
      - `content` (text, required)
      - `user_id` (uuid, references profiles)
      - `plan_id` (uuid, references travel_plans)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create travel_plans table
CREATE TABLE IF NOT EXISTS travel_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    images text[],
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    city_id uuid REFERENCES cities(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create travel_plan_comments table
CREATE TABLE IF NOT EXISTS travel_plan_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text NOT NULL,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    plan_id uuid REFERENCES travel_plans(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE travel_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_plan_comments ENABLE ROW LEVEL SECURITY;

-- Travel Plans Policies
CREATE POLICY "Travel plans are viewable by everyone"
    ON travel_plans FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Users can create travel plans"
    ON travel_plans FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own travel plans"
    ON travel_plans FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own travel plans"
    ON travel_plans FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Travel Plan Comments Policies
CREATE POLICY "Comments are viewable by everyone"
    ON travel_plan_comments FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Authenticated users can create comments"
    ON travel_plan_comments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
    ON travel_plan_comments FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
    ON travel_plan_comments FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS travel_plans_city_id_idx ON travel_plans(city_id);
CREATE INDEX IF NOT EXISTS travel_plans_user_id_idx ON travel_plans(user_id);
CREATE INDEX IF NOT EXISTS travel_plan_comments_plan_id_idx ON travel_plan_comments(plan_id);