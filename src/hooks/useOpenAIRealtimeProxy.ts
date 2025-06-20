
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseOpenAIRealtimeProxyProps {
  accessToken: string;
  endpoint: string;
}

export default function useOpenAIRealtimeProxy({ accessToken, endpoint }: UseOpenAIRealtimeProxyProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Connect to OpenAI WebSocket
  const connect = useCallback(() => {
    if (!accessToken || !endpoint) {
      console.warn('Missing accessToken or endpoint');
      return;
    }

    console.log('Connecting to OpenAI WebSocket:', endpoint);
    const ws = new WebSocket(`${endpoint}`, ['realtime']);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected to OpenAI');
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📩 Message from OpenAI:', data.type, data);
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
      
      // Attempt to reconnect after 3 seconds if not a normal closure
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      }
    };
  }, [accessToken, endpoint]);

  // Send a message to OpenAI
  const sendMessage = useCallback((message: string) => {
    if (socketRef.current && connected) {
      console.log('📤 Sending to OpenAI:', JSON.parse(message).type);
      socketRef.current.send(message);
    } else {
      console.warn('WebSocket is not connected');
    }
  }, [connected]);

  // Cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounting');
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
