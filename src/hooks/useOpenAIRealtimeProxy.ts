
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

interface UseOpenAIRealtimeProxyProps {
  accessToken: string;
  endpoint: string;
}

export default function useOpenAIRealtimeProxy({ accessToken, endpoint }: UseOpenAIRealtimeProxyProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Connect to Supabase Edge Function WebSocket
  const connect = useCallback(() => {
    if (!accessToken) {
      console.warn('Missing access token');
      return;
    }

    // Use the Supabase Edge Function instead of direct OpenAI connection
    const supabaseUrl = 'https://ldvxpijumlrmhqhazqar.supabase.co';
    const wsUrl = `wss://ldvxpijumlrmhqhazqar.functions.supabase.co/openai-realtime?token=${accessToken}`;
    
    console.log('🔌 Connecting to Supabase Edge Function WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected to Supabase Edge Function');
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📩 Message from OpenAI via Supabase:', data);
        setMessages(prev => [...prev, data]);
      } catch (e) {
        console.error('❌ Failed to parse message:', e);
      }
    };

    ws.onerror = (e) => {
      console.error('❌ WebSocket error:', e);
      setError('WebSocket connection error');
    };

    ws.onclose = (event) => {
      console.log('🔌 WebSocket disconnected:', event.code, event.reason);
      setConnected(false);
      
      // Only set error if it's not a normal closure
      if (event.code !== 1000) {
        setError(`Connection closed: ${event.reason || 'Unknown reason'}`);
      }
    };
  }, [accessToken]);

  // Send a message to OpenAI
  const sendMessage = (text: string) => {
    if (socketRef.current && connected) {
      const payload = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text,
            }
          ]
        }
      };

      console.log('📤 Sending message to OpenAI:', payload);
      socketRef.current.send(JSON.stringify(payload));
      
      // Trigger response generation
      setTimeout(() => {
        if (socketRef.current && connected) {
          socketRef.current.send(JSON.stringify({type: 'response.create'}));
        }
      }, 100);
      
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  return {
    connected,
    messages,
    error,
    sendMessage,
  };
}
