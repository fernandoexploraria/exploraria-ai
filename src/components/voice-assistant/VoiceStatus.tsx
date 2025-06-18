
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
      {/* Outer animated ring when speaking or listening */}
      {(isSpeaking || isListening) && (
        <div className={`absolute inset-0 rounded-full border-2 animate-pulse ${
          isSpeaking ? 'border-green-500' : 'border-blue-500'
        }`} />
      )}
      
      {/* Middle ring when speaking or listening */}
      {(isSpeaking || isListening) && (
        <div className={`absolute inset-2 rounded-full border-2 animate-pulse ${
          isSpeaking ? 'border-green-400' : 'border-blue-400'
        }`} style={{ animationDelay: '0.5s' }} />
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
    </div>
  );
};

export default VoiceStatus;
