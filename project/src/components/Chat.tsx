import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender: {
    username: string;
  };
}

interface ChatPartner {
  id: string;
  username: string;
  role: string;
}

export function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatPartner, setChatPartner] = useState<ChatPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial messages when chatId changes
  useEffect(() => {
    fetchMessages();
  }, [chatId]);

  // Real-time subscription with safeguards
  useEffect(() => {
    let isActive = true; // Track component state

    const subscription = supabase
      .channel(`messages_chat_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          if (!isActive) return; // Skip if component has unmounted
          console.log('Real-time event received:', payload);

          if (payload.new) {
            setMessages((current) => [
              ...current,
              {
                id: payload.new.id,
                content: payload.new.content,
                sender_id: payload.new.sender_id,
                created_at: payload.new.created_at,
                sender: { username: chatPartner?.username || 'Unknown' },
              },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      isActive = false; // Mark component as unmounted
      console.log(`Unsubscribing from real-time updates for chatId: ${chatId}`);
      subscription.unsubscribe();
    };
  }, [chatId]);

  // Scroll to the latest message when messages state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Debugging fallback with polling
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchMessages();
    }, 5000); // Fetch messages every 5 seconds

    return () => clearInterval(intervalId);
  }, [chatId]);

  async function fetchMessages() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch chat details and partner info
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select(`
          user1_id,
          user2_id,
          user1:profiles!chats_user1_id_fkey(username, role),
          user2:profiles!chats_user2_id_fkey(username, role)
        `)
        .eq('id', chatId)
        .single();

      if (chatError) throw chatError;

      // Set chat partner
      const partnerId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id;
      const partner = chat.user1_id === user.id ? chat.user2 : chat.user1;
      setChatPartner({
        id: partnerId,
        username: partner.username,
        role: partner.role,
      });

      // Fetch messages
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(username)
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      setMessages(messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Optimistically add the message to the UI
      const optimisticMessage = {
        id: Date.now().toString(), // Temporary unique ID
        content: newMessage.trim(),
        sender_id: user.id,
        created_at: new Date().toISOString(),
        sender: { username: chatPartner?.username || 'You' },
      };
      setMessages((current) => [...current, optimisticMessage]);

      // Send the message to the server
      const { error } = await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: user.id,
        content: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  if (loading) {
    return <div>Loading chat...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      <div className="bg-white shadow rounded-t-lg p-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Chat with {chatPartner?.username}
        </h2>
        <p className="text-sm text-gray-500">
          {chatPartner?.role.charAt(0).toUpperCase() + chatPartner?.role.slice(1)}
        </p>
      </div>

      <div className="flex-1 bg-gray-50 p-4 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((message) => {
            const isCurrentUser = message.sender_id === chatPartner?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isCurrentUser ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    isCurrentUser
                      ? 'bg-gray-200 text-gray-900'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isCurrentUser ? 'text-gray-500' : 'text-indigo-200'
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form
        onSubmit={handleSendMessage}
        className="bg-white shadow rounded-b-lg p-4"
      >
        <div className="flex space-x-4">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
