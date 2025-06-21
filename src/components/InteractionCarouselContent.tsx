
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import InteractionCard from './InteractionCard';
import { Loader2 } from 'lucide-react';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  is_favorite: boolean;
  created_at: string;
  interaction_type: string;
  landmark_coordinates: any;
  landmark_image_url: string | null;
  full_transcript: any;
  similarity?: number;
}

interface InteractionCarouselContentProps {
  isLoading: boolean;
  currentInteractions: Interaction[];
  showingSearchResults: boolean;
  onToggleFavorite: (interaction: Interaction) => void;
  onLocationClick: (coordinates: any) => void;
  onMinimizeDrawer?: () => void;
}

const InteractionCarouselContent: React.FC<InteractionCarouselContentProps> = ({
  isLoading,
  currentInteractions,
  showingSearchResults,
  onToggleFavorite,
  onLocationClick,
  onMinimizeDrawer,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-white">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading interactions...</span>
        </div>
      </div>
    );
  }

  if (currentInteractions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <p className="text-lg font-medium mb-2">
            {showingSearchResults ? 'No matching interactions found' : 'No interactions yet'}
          </p>
          <p className="text-sm">
            {showingSearchResults 
              ? 'Try adjusting your search terms' 
              : 'Start a conversation to see your history here'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentInteractions.map((interaction, index) => (
            <InteractionCard
              key={interaction.id}
              interaction={interaction}
              index={index}
              isCurrentlyPlaying={false}
              onToggleFavorite={onToggleFavorite}
              onLocationClick={onLocationClick}
              onMinimizeDrawer={onMinimizeDrawer}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};

export default InteractionCarouselContent;
