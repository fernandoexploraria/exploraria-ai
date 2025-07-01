
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Interaction } from './InteractionCarouselLogic';

interface InteractionCardContentProps {
  interaction: Interaction;
}

const InteractionCardContent: React.FC<InteractionCardContentProps> = ({
  interaction,
}) => {
  const renderContent = () => {
    const transcript = interaction.full_transcript;
    
    if (interaction.interaction_type === 'voice' && transcript && Array.isArray(transcript)) {
      return (
        <div className="space-y-1">
          {transcript
            .filter((entry: any) => entry.message && (entry.role === 'user' || entry.role === 'agent'))
            .map((entry: any, entryIndex: number) => (
              <div key={entryIndex} className={`p-2 rounded text-xs ${
                entry.role === 'user' 
                  ? 'bg-blue-900/30 text-blue-100' 
                  : 'bg-green-900/30 text-green-100'
              }`}>
                <span className="font-medium text-xs">
                  {entry.role === 'user' ? 'You:' : 'Assistant:'}
                </span>
                <p className="mt-1">
                  {entry.message}
                  {entry.role === 'agent' && entry.interrupted && (
                    <span className="text-orange-400 ml-1">(interrupted)</span>
                  )}
                </p>
              </div>
            ))}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="p-2 rounded text-xs bg-blue-900/30 text-blue-100">
          <span className="font-medium text-xs">You:</span>
          <p className="mt-1">{interaction.user_input}</p>
        </div>
        <div className="p-2 rounded text-xs bg-green-900/30 text-green-100">
          <span className="font-medium text-xs">Assistant:</span>
          <p className="mt-1">{interaction.assistant_response}</p>
        </div>
      </div>
    );
  };

  return (
    <ScrollArea className="flex-1 w-full">
      {renderContent()}
    </ScrollArea>
  );
};

export default InteractionCardContent;
