
import { useEffect, useRef, useState, useCallback } from 'react';
import useOpenAIRealtimeProxy from './useOpenAIRealtimeProxy';

interface UseOpenAIRealtimeProps {
  onConnectionChange: (connected: boolean) => void;
  onSpeakingChange: (speaking: boolean) => void;
  onError: (error: string) => void;
}

class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      console.log('Starting audio recorder...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      console.log('Audio recorder started successfully');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    console.log('Stopping audio recorder...');
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    console.log('Audio recorder stopped');
  }
}

const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
};

export const useOpenAIRealtime = ({ onConnectionChange, onSpeakingChange, onError }: UseOpenAIRealtimeProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [isListening, setIsListening] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  
  // Use the provided OpenAI API key
  const API_KEY = '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';
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
      console.log('Processing message:', data.type);
      
      // Handle audio responses
      if (data.type === 'response.audio.delta' && data.delta) {
        playAudioChunk(data.delta);
        onSpeakingChange(true);
      } else if (data.type === 'response.audio.done') {
        onSpeakingChange(false);
      } else if (data.type === 'session.created') {
        console.log('Session created, sending session update...');
        sendSessionUpdate();
      }
    });
  }, [proxyMessages, onSpeakingChange]);

  const sendSessionUpdate = () => {
    if (!connected) return;
    
    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'You are a helpful Rome travel expert. Provide informative and enthusiastic responses about Rome\'s attractions, history, food, and travel tips. Keep responses concise but engaging.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        temperature: 0.8,
        max_response_output_tokens: 'inf'
      }
    };
    
    console.log('Sending session update:', sessionUpdate);
    proxySendMessage(JSON.stringify(sessionUpdate));
  };

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

  const startListening = useCallback(async () => {
    if (!connected) {
      console.log('Not connected, cannot start listening');
      return;
    }
    
    try {
      console.log('Starting microphone recording...');
      
      audioRecorderRef.current = new AudioRecorder((audioData) => {
        if (connected) {
          const encodedAudio = encodeAudioForAPI(audioData);
          const audioEvent = {
            type: 'input_audio_buffer.append',
            audio: encodedAudio
          };
          proxySendMessage(JSON.stringify(audioEvent));
        }
      });
      
      await audioRecorderRef.current.start();
      setIsListening(true);
      console.log('Microphone recording started');
      
    } catch (error) {
      console.error('Error starting microphone:', error);
      onError('Could not access microphone. Please check permissions.');
    }
  }, [connected, proxySendMessage, onError]);

  const stopListening = useCallback(() => {
    if (audioRecorderRef.current) {
      console.log('Stopping microphone recording...');
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
      setIsListening(false);
      
      // Commit the audio buffer
      if (connected) {
        proxySendMessage(JSON.stringify({
          type: 'input_audio_buffer.commit'
        }));
        
        // Create response
        proxySendMessage(JSON.stringify({
          type: 'response.create'
        }));
      }
    }
  }, [connected, proxySendMessage]);

  const sendMessage = useCallback((text: string) => {
    console.log('📤 Sending text message:', text);
    const messageEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    };
    
    proxySendMessage(JSON.stringify(messageEvent));
    proxySendMessage(JSON.stringify({ type: 'response.create' }));
  }, [proxySendMessage]);

  const disconnect = useCallback(() => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsListening(false);
  }, []);

  return {
    connected,
    messages,
    isListening,
    connect,
    startListening,
    stopListening,
    sendMessage,
    disconnect
  };
};
