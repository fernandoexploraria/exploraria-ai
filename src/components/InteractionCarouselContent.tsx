
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import InteractionCard from './InteractionCard';
import { useTTSContext } from '@/contexts/TTSContext';

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
  isMinimized?: boolean;
}

const InteractionCarouselContent: React.FC<InteractionCarouselContentProps> = ({
  isLoading,
  currentInteractions,
  showingSearchResults,
  onToggleFavorite,
  onLocationClick,
  isMinimized = false,
}) => {
  const { currentPlayingId } = useTTSContext();

  // Don't render content when minimized to save resources
  if (isMinimized) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Loading interactions...</div>
      </div>
    );
  }

  if (currentInteractions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <p className="text-lg mb-2">
            {showingSearchResults ? 'No search results found' : 'No interactions yet'}
          </p>
          <p className="text-sm">
            {showingSearchResults
              ? 'Try searching for something else'
              : 'Start a conversation to see your history here'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
          {currentInteractions.map((interaction, index) => (
            <InteractionCard
              key={interaction.id}
              interaction={interaction}
              index={index}
              isCurrentlyPlaying={currentPlayingId === interaction.id}
              onToggleFavorite={onToggleFavorite}
              onLocationClick={onLocationClick}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};

export default InteractionCarouselContent;
