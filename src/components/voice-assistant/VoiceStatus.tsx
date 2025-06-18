
import React from 'react';
import { Volume2 } from 'lucide-react';

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
    <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-colors ${
      isSpeaking ? 'border-green-500 bg-green-50' : 
      isListening ? 'border-blue-500 bg-blue-50' : 
      'border-gray-300 bg-gray-50'
    }`}>
      <Volume2 className={`w-12 h-12 ${isSpeaking ? 'text-green-600' : 'text-gray-400'}`} />
    </div>
  );
};

export default VoiceStatus;
