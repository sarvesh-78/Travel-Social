/*
  # Add Friend Match & Chat Features

  1. New Tables
    - `chats`
      - `id` (uuid, primary key)
      - `user1_id` (uuid, references profiles)
      - `user2_id` (uuid, references profiles)
      - `created_at` (timestamp)

    - `messages`
      - `id` (uuid, primary key)
      - `chat_id` (uuid, references chats)
      - `sender_id` (uuid, references profiles)
      - `content` (text)
      - `created_at` (timestamp)

  2. Changes
    - Add interests array to profiles table
    - Add indexes for performance
    - Add RLS policies for secure access

  3. Security
    - Only matched users can access their chats
    - Only chat participants can send messages
*/

-- Add interests to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}';

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    user2_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT different_users CHECK (user1_id != user2_id),
    CONSTRAINT ordered_users CHECK (user1_id < user2_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id uuid REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
    sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Chats policies
CREATE POLICY "Users can view their own chats"
    ON chats FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user1_id OR 
        auth.uid() = user2_id
    );

CREATE POLICY "Users can create chats with other users"
    ON chats FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() IN (user1_id, user2_id) AND
        user1_id < user2_id
    );

-- Messages policies
CREATE POLICY "Chat participants can view messages"
    ON messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chats
            WHERE chats.id = messages.chat_id
            AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
        )
    );

CREATE POLICY "Chat participants can send messages"
    ON messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM chats
            WHERE chats.id = chat_id
            AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
        )
    );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS chats_user1_id_idx ON chats(user1_id);
CREATE INDEX IF NOT EXISTS chats_user2_id_idx ON chats(user2_id);
CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON messages(chat_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC);