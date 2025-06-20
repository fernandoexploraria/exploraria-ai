
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import useOpenAIRealtimeProxy from './useOpenAIRealtimeProxy';

const supabase = createClient(
  'https://ldvxpijumlrmhqhazqar.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkdnhwaWp1bWxybWhxaGF6cWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTg2ODg3MzYsImV4cCI6MjAzNDI2NDczNn0.cfC7zPGI_RjH63PIcNF9l6YMwXKZgRJN-Uf7AJB1k-8'
);

interface UseOpenAIRealtimeProps {
  onConnectionChange: (connected: boolean) => void;
  onSpeakingChange: (speaking: boolean) => void;
  onError: (error: string) => void;
}

export const useOpenAIRealtime = ({ onConnectionChange, onSpeakingChange, onError }: UseOpenAIRealtimeProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [accessToken, setAccessToken] = useState<string>('');
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Get user's auth token
  useEffect(() => {
    const getAuthToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        console.log('🔑 Got auth token');
        setAccessToken(session.access_token);
      } else {
        console.warn('⚠️ No auth token found');
        onError('Authentication token not found. Please log in.');
      }
    };
    
    getAuthToken();
  }, [onError]);

  const { connected, messages: proxyMessages, sendMessage: proxySendMessage, error } = useOpenAIRealtimeProxy({
    accessToken,
    endpoint: '' // Not used since we're using Supabase Edge Function
  });

  // Handle connection changes
  useEffect(() => {
    onConnectionChange(connected);
  }, [connected, onConnectionChange]);

  // Handle errors
  useEffect(() => {
    if (error) {
      onError(error);
    }
  }, [error, onError]);

  // Handle incoming messages
  useEffect(() => {
    setMessages(proxyMessages);
    
    proxyMessages.forEach(data => {
      // Handle audio responses
      if (data.type === 'response.audio.delta' && data.delta) {
        playAudioChunk(data.delta);
        onSpeakingChange(true);
      } else if (data.type === 'response.audio.done') {
        onSpeakingChange(false);
      }
    });
  }, [proxyMessages, onSpeakingChange]);

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
    console.log('🔌 Starting OpenAI Realtime connection...');
    // Connection is handled by the proxy hook
  }, []);

  const sendMessage = useCallback((text: string) => {
    console.log('📤 Sending message:', text);
    proxySendMessage(text);
  }, [proxySendMessage]);

  const disconnect = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  return {
    connected,
    messages,
    connect,
    sendMessage,
    disconnect
  };
};
