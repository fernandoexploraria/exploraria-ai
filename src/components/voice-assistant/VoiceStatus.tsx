
import React from 'react';

interface VoiceStatusProps {
  isListening: boolean;
  isSpeaking: boolean;
  hasUserInteracted: boolean;
}

const VoiceStatus: React.FC<VoiceStatusProps> = ({
  isListening,
  isSpeaking,
  hasUserInteracted
}) => {
  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      {/* Outer animated ring when speaking */}
      {isSpeaking && (
        <div className="absolute inset-0 rounded-full border-2 border-green-500 animate-ping opacity-75" />
      )}
      
      {/* Middle ring when listening */}
      {isListening && (
        <div className="absolute inset-2 rounded-full border-2 border-blue-500 animate-pulse" />
      )}
      
      {/* Main circle */}
      <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${
        isSpeaking ? 'border-green-500 bg-green-100 shadow-lg shadow-green-200' : 
        isListening ? 'border-blue-500 bg-blue-100 shadow-lg shadow-blue-200' : 
        'border-gray-300 bg-gray-100'
      }`}>
        {/* Central dot */}
        <div className={`w-4 h-4 rounded-full transition-all duration-300 ${
          isSpeaking ? 'bg-green-600 animate-pulse' : 
          isListening ? 'bg-blue-600 animate-pulse' : 
          'bg-gray-400'
        }`} />
      </div>
      
      {/* Additional ripple effect for speaking */}
      {isSpeaking && (
        <div className="absolute inset-4 rounded-full border border-green-400 animate-ping opacity-50" style={{ animationDelay: '0.5s' }} />
      )}
    </div>
  );
};

export default VoiceStatus;
