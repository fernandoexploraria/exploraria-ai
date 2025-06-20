
import { useEffect, useRef, useState, useCallback } from 'react';
import useOpenAIRealtimeProxy from './useOpenAIRealtimeProxy';

interface UseOpenAIRealtimeProps {
  onConnectionChange: (connected: boolean) => void;
  onSpeakingChange: (speaking: boolean) => void;
  onError: (error: string) => void;
}

export const useOpenAIRealtime = ({ onConnectionChange, onSpeakingChange, onError }: UseOpenAIRealtimeProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Use the OpenAI API key directly (in production, this should come from secure storage)
  const API_KEY = 'sk-proj-your-key-here'; // Replace with actual key
  const ENDPOINT = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

  const { connected, messages: proxyMessages, sendMessage: proxySendMessage, error } = useOpenAIRealtimeProxy({
    accessToken: API_KEY,
    endpoint: ENDPOINT
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
