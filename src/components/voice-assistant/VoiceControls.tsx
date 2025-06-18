
import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';

interface VoiceControlsProps {
  isListening: boolean;
  isSpeaking: boolean;
  hasUserInteracted: boolean;
  isSpeechRecognitionSupported: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onWelcomeClick: () => void;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  isListening,
  isSpeaking,
  hasUserInteracted,
  isSpeechRecognitionSupported,
  onStartListening,
  onStopListening,
  onWelcomeClick
}) => {
  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Welcome button (only show if user hasn't interacted) */}
      {!hasUserInteracted && (
        <Button
          onClick={onWelcomeClick}
          className="mb-2"
          variant="outline"
          disabled={isSpeaking}
        >
          Start Tour Guide
        </Button>
      )}

      {/* Microphone button */}
      <Button
        size="lg"
        variant={isListening ? "destructive" : "default"}
        onClick={isListening ? onStopListening : onStartListening}
        disabled={isSpeaking || !hasUserInteracted || !isSpeechRecognitionSupported}
        className="rounded-full w-16 h-16"
      >
        {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </Button>

      {/* Browser support warning */}
      {!isSpeechRecognitionSupported && (
        <div className="text-center text-sm text-red-600 max-w-sm">
          Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.
        </div>
      )}
    </div>
  );
};

export default VoiceControls;
