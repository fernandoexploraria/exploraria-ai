
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseOpenAIRealtimeProps {
  onConnectionChange: (connected: boolean) => void;
  onSpeakingChange: (speaking: boolean) => void;
  onError: (error: string) => void;
}

export const useOpenAIRealtime = ({ onConnectionChange, onSpeakingChange, onError }: UseOpenAIRealtimeProps) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playAudioChunk = async (base64Audio: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 to AudioBuffer
      const audioBuffer = audioContextRef.current.createBuffer(1, bytes.length / 2, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = (bytes[i * 2] | (bytes[i * 2 + 1] << 8));
        channelData[i] = sample / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
      
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const connect = useCallback(async () => {
    try {
      console.log('🔌 Starting OpenAI Realtime connection...');
      
      // Get the session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        onError('Authentication required');
        return;
      }

      // Use the correct WebSocket URL format
      const wsUrl = `wss://ejqgdmbuabrcjxbhpxup.supabase.co/functions/v1/openai-realtime?token=${encodeURIComponent(token)}`;
      console.log('🌐 Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        setConnected(true);
        onConnectionChange(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📩 Message from OpenAI:', data.type, data);
          
          setMessages(prev => [...prev, data]);
          
          // Handle audio responses
          if (data.type === 'response.audio.delta' && data.delta) {
            playAudioChunk(data.delta);
            onSpeakingChange(true);
          } else if (data.type === 'response.audio.done') {
            onSpeakingChange(false);
          }
          
        } catch (error) {
          console.error('❌ Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        onError('WebSocket connection failed');
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setConnected(false);
        onConnectionChange(false);
        
        if (event.code !== 1000) {
          onError(`Connection closed: ${event.reason || 'Unknown reason'}`);
        }
      };

    } catch (error) {
      console.error('❌ Error connecting:', error);
      onError('Failed to initialize connection');
    }
  }, [onConnectionChange, onSpeakingChange, onError]);

  const sendMessage = useCallback((text: string) => {
    if (socketRef.current && connected) {
      const payload = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }]
        }
      };
      
      console.log('📤 Sending message:', payload);
      socketRef.current.send(JSON.stringify(payload));
      socketRef.current.send(JSON.stringify({ type: 'response.create' }));
    } else {
      console.warn('⚠️ WebSocket is not connected');
    }
  }, [connected]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setConnected(false);
    onConnectionChange(false);
  }, [onConnectionChange]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connected,
    messages,
    connect,
    sendMessage,
    disconnect
  };
};
