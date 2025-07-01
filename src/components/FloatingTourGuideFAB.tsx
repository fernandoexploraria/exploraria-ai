
import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';

type AssistantState = 'not-started' | 'started' | 'listening' | 'recording' | 'playback';

interface FloatingTourGuideFABProps {
  isVisible: boolean;
  assistantState: AssistantState;
  onClick: () => void;
  onLongPress?: () => void;
}

const FloatingTourGuideFAB: React.FC<FloatingTourGuideFABProps> = ({
  isVisible,
  assistantState,
  onClick,
  onLongPress
}) => {
  // Get FAB colors based on assistant state
  const getFABStyles = () => {
    switch (assistantState) {
      case 'listening':
        return 'bg-blue-500 hover:bg-blue-600 border-blue-400 shadow-blue-400/30';
      case 'recording':
        return 'bg-red-500 hover:bg-red-600 border-red-400 shadow-red-400/30';
      case 'playback':
        return 'bg-green-500 hover:bg-green-600 border-green-400 shadow-green-400/30';
      case 'started':
        return 'bg-yellow-500 hover:bg-yellow-600 border-yellow-400 shadow-yellow-400/30';
      default:
        return 'bg-primary hover:bg-primary/90 border-primary/50 shadow-primary/20';
    }
  };

  // Determine if FAB should pulse based on state
  const shouldPulse = assistantState !== 'not-started';

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-30"
      style={{ zIndex: 30 }} // Below proximity cards (z-40+) but above map
    >
      <Button
        onClick={onClick}
        onMouseDown={onLongPress ? (e) => {
          const timer = setTimeout(() => {
            onLongPress();
          }, 500); // 500ms for long press
          
          const cleanup = () => {
            clearTimeout(timer);
            document.removeEventListener('mouseup', cleanup);
            document.removeEventListener('mouseleave', cleanup);
          };
          
          document.addEventListener('mouseup', cleanup);
          document.addEventListener('mouseleave', cleanup);
        } : undefined}
        className={`
          w-14 h-14 rounded-full shadow-lg border-2 transition-all duration-300
          ${getFABStyles()}
          ${shouldPulse ? 'animate-pulse' : ''}
          hover:scale-105 active:scale-95
          flex items-center justify-center
        `}
        size="icon"
        aria-label="Open Tour Guide"
      >
        <Mic className="w-6 h-6 text-white" />
        
        {/* Animated rings for active states */}
        {shouldPulse && (
          <>
            <div className="absolute inset-0 rounded-full border-2 animate-ping opacity-30" 
                 style={{ 
                   animationDuration: '2s',
                   borderColor: assistantState === 'playback' ? '#22c55e' : 
                               assistantState === 'recording' ? '#ef4444' : '#3b82f6'
                 }} />
            <div className="absolute inset-1 rounded-full border-2 animate-ping opacity-20" 
                 style={{ 
                   animationDuration: '2s', 
                   animationDelay: '0.5s',
                   borderColor: assistantState === 'playback' ? '#22c55e' : 
                               assistantState === 'recording' ? '#ef4444' : '#3b82f6'
                 }} />
          </>
        )}
      </Button>
    </div>
  );
};

export default FloatingTourGuideFAB;
