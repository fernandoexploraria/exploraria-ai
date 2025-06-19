
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
  const handleMouseDown = () => {
    console.log('Mouse down - starting recording');
    if (!isSpeaking && hasUserInteracted && isSpeechRecognitionSupported && !isListening) {
      onStartListening();
    }
  };

  const handleMouseUp = () => {
    console.log('Mouse up - stopping recording');
    if (isListening) {
      onStopListening();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    console.log('Touch start - starting recording');
    e.preventDefault();
    e.stopPropagation();
    if (!isSpeaking && hasUserInteracted && isSpeechRecognitionSupported && !isListening) {
      onStartListening();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    console.log('Touch end - stopping recording');
    e.preventDefault();
    e.stopPropagation();
    if (isListening) {
      onStopListening();
    }
  };

  const handleTouchCancel = (e: React.TouchEvent) => {
    console.log('Touch cancelled - stopping recording');
    e.preventDefault();
    e.stopPropagation();
    if (isListening) {
      onStopListening();
    }
  };

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

      {/* Push-to-talk microphone button */}
      <Button
        size="lg"
        variant={isListening ? "destructive" : "default"}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Stop if mouse leaves button while pressed
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel} // Handle touch cancellation on iOS
        disabled={isSpeaking || !hasUserInteracted || !isSpeechRecognitionSupported}
        className="rounded-full w-16 h-16 select-none touch-none"
        style={{ 
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'none'
        }}
      >
        {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </Button>

      {/* Instructions */}
      <div className="text-center text-xs text-muted-foreground max-w-sm">
        {!hasUserInteracted ? (
          "Click 'Start Tour Guide' to begin"
        ) : isListening ? (
          "Release to send your message"
        ) : (
          "Hold the microphone button to speak"
        )}
      </div>

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
