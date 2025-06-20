
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

    const ws = new WebSocket(endpoint);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setConnected(true);

      // Optionally authenticate here if endpoint supports a message-based auth
      ws.send(JSON.stringify({
        type: 'auth',
        token: accessToken,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📩 Message from OpenAI:', data);
        setMessages(prev => [...prev, data]);
      } catch (e) {
        console.error('❌ Failed to parse message:', e);
      }
    };

    ws.onerror = (e) => {
      console.error('❌ WebSocket error:', e);
      setError('WebSocket error');
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setConnected(false);
    };
  }, [accessToken, endpoint]);

  // Send a message to OpenAI
  const sendMessage = (text: string) => {
    if (socketRef.current && connected) {
      const payload = {
        type: 'user_message',
        text,
      };

      socketRef.current.send(JSON.stringify(payload));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      socketRef.current?.close();
    };
  }, [connect]);

  return {
    connected,
    messages,
    error,
    sendMessage,
  };
}
