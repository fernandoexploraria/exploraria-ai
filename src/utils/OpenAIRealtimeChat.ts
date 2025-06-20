
export class AudioRecorder {
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

export const encodeAudioForAPI = (float32Array: Float32Array): string => {
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

export const createWavFromPCM = (pcmData: Uint8Array): Uint8Array => {
  const int16Data = new Int16Array(pcmData.length / 2);
  for (let i = 0; i < pcmData.length; i += 2) {
    int16Data[i / 2] = (pcmData[i + 1] << 8) | pcmData[i];
  }
  
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + int16Data.byteLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, int16Data.byteLength, true);

  const wavArray = new Uint8Array(wavHeader.byteLength + int16Data.byteLength);
  wavArray.set(new Uint8Array(wavHeader), 0);
  wavArray.set(new Uint8Array(int16Data.buffer), wavHeader.byteLength);
  
  return wavArray;
};

class AudioQueue {
  private queue: Uint8Array[] = [];
  private isPlaying = false;
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  async addToQueue(audioData: Uint8Array) {
    console.log('Adding audio data to queue, size:', audioData.length);
    this.queue.push(audioData);
    if (!this.isPlaying) {
      await this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      console.log('Audio queue finished');
      return;
    }

    this.isPlaying = true;
    const audioData = this.queue.shift()!;
    console.log('Playing audio chunk, size:', audioData.length);

    try {
      const wavData = createWavFromPCM(audioData);
      const audioBuffer = await this.audioContext.decodeAudioData(wavData.buffer);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        console.log('Audio chunk finished playing');
        this.playNext();
      };
      source.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
      this.playNext();
    }
  }
}

export class OpenAIRealtimeChat {
  private ws: WebSocket | null = null;
  private audioRecorder: AudioRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioQueue | null = null;
  private isConnected = false;
  private isListening = false;
  private currentUserInput = '';
  private currentAssistantResponse = '';

  constructor(
    private onConnectionChange: (connected: boolean) => void,
    private onListeningChange: (listening: boolean) => void,
    private onSpeakingChange: (speaking: boolean) => void,
    private onUserInput?: (userInput: string) => void,
    private onAssistantResponse?: (assistantResponse: string) => void
  ) {}

  async connect() {
    try {
      console.log('Connecting to OpenAI Realtime API...');
      
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      this.audioQueue = new AudioQueue(this.audioContext);
      
      const wsUrl = 'wss://ejqgdmbuabrcjxbhpxup.functions.supabase.co/functions/v1/openai-realtime';
      console.log('Connecting to WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);

      const connectionTimeout = setTimeout(() => {
        console.error('WebSocket connection timeout');
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.ws.close();
          throw new Error('Connection timeout');
        }
      }, 10000);

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        clearTimeout(connectionTimeout);
        this.isConnected = true;
        this.onConnectionChange(true);
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WebSocket message:', data.type, data);

          if (data.type === 'response.audio.delta') {
            console.log('Received audio delta, length:', data.delta?.length);
            if (data.delta) {
              const binaryString = atob(data.delta);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              await this.audioQueue?.addToQueue(bytes);
              this.onSpeakingChange(true);
            }
          } else if (data.type === 'response.audio.done') {
            console.log('Audio response completed');
            this.onSpeakingChange(false);
            // Trigger callback with current assistant response
            if (this.currentAssistantResponse && this.onAssistantResponse) {
              this.onAssistantResponse(this.currentAssistantResponse);
            }
          } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
            // Capture user input transcription
            if (data.transcript) {
              console.log('User input transcribed:', data.transcript);
              this.currentUserInput = data.transcript;
              if (this.onUserInput) {
                this.onUserInput(data.transcript);
              }
            }
          } else if (data.type === 'response.text.delta') {
            // Capture assistant text response
            if (data.delta) {
              this.currentAssistantResponse += data.delta;
            }
          } else if (data.type === 'response.text.done') {
            // Assistant text response completed
            console.log('Assistant text response completed:', this.currentAssistantResponse);
          } else if (data.type === 'response.done') {
            // Reset for next interaction
            this.currentUserInput = '';
            this.currentAssistantResponse = '';
          } else if (data.type === 'error') {
            console.error('OpenAI API error:', data);
          } else if (data.type === 'session.created') {
            console.log('Session created, sending session update...');
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        clearTimeout(connectionTimeout);
        this.isConnected = false;
        this.onConnectionChange(false);
        this.cleanup();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(connectionTimeout);
        this.isConnected = false;
        this.onConnectionChange(false);
      };

      await new Promise((resolve, reject) => {
        const checkConnection = () => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            resolve(true);
          } else if (this.ws?.readyState === WebSocket.CLOSED) {
            reject(new Error('WebSocket connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });

    } catch (error) {
      console.error('Error connecting to OpenAI Realtime API:', error);
      throw error;
    }
  }

  private sendWebSocketMessage(message: any) {
    if (!this.ws) {
      console.error('WebSocket is null, cannot send message');
      return false;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error(`WebSocket is not open. ReadyState: ${this.ws.readyState}`, {
        CONNECTING: WebSocket.CONNECTING,
        OPEN: WebSocket.OPEN,
        CLOSING: WebSocket.CLOSING,
        CLOSED: WebSocket.CLOSED
      });
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      console.log('Sent WebSocket message:', message.type);
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  async startListening() {
    if (!this.isConnected || this.isListening) {
      console.log('Cannot start listening - not connected or already listening');
      return;
    }

    try {
      console.log('Starting to listen...');
      
      this.audioRecorder = new AudioRecorder((audioData) => {
        this.sendWebSocketMessage({
          type: 'input_audio_buffer.append',
          audio: encodeAudioForAPI(audioData)
        });
      });

      await this.audioRecorder.start();
      this.isListening = true;
      this.onListeningChange(true);
      console.log('Started listening successfully');
      
    } catch (error) {
      console.error('Error starting audio recording:', error);
      throw error;
    }
  }

  stopListening() {
    if (!this.isListening) {
      console.log('Not currently listening');
      return;
    }

    console.log('Stopping listening...');
    this.audioRecorder?.stop();
    this.audioRecorder = null;
    this.isListening = false;
    this.onListeningChange(false);
    console.log('Stopped listening successfully');
  }

  async sendInitialGreeting() {
    if (!this.isConnected) {
      console.log('Cannot send initial greeting - not connected');
      return;
    }

    console.log('Sending initial greeting...');
    const greetingEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Hi! Please introduce yourself as a friendly tour guide assistant.'
          }
        ]
      }
    };

    const greetingSent = this.sendWebSocketMessage(greetingEvent);
    if (greetingSent) {
      this.sendWebSocketMessage({ type: 'response.create' });
      console.log('Initial greeting sent');
    } else {
      console.log('Failed to send initial greeting - WebSocket not ready');
    }
  }

  disconnect() {
    console.log('Disconnecting from OpenAI Realtime API...');
    this.cleanup();
  }

  private cleanup() {
    this.stopListening();
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.audioQueue = null;
    this.isConnected = false;
    this.onConnectionChange(false);
    console.log('Cleanup completed');
  }
}
