
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import InteractionCardHeader from './InteractionCardHeader';
import InteractionCardImage from './InteractionCardImage';
import InteractionCardContent from './InteractionCardContent';
import InteractionCardActions from './InteractionCardActions';
import EnhancedLandmarkInfo from './EnhancedLandmarkInfo';
import { EnhancedLandmark } from '@/data/landmarks';

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
  enhanced_landmark?: EnhancedLandmark; // Add support for enhanced landmark data
}

interface InteractionCardProps {
  interaction: Interaction;
  index: number;
  isCurrentlyPlaying: boolean;
  onToggleFavorite: (interaction: Interaction) => void;
  onLocationClick: (coordinates: any) => void;
}

const InteractionCard: React.FC<InteractionCardProps> = ({
  interaction,
  index,
  isCurrentlyPlaying,
  onToggleFavorite,
  onLocationClick,
}) => {
  return (
    <Card className={`w-full max-w-xs mx-auto border-gray-700 h-96 transition-all duration-300 relative ${
      isCurrentlyPlaying 
        ? 'bg-green-900/20 border-green-500/50 shadow-lg shadow-green-500/20' 
        : 'bg-gray-900'
    }`}>
      <CardContent className="p-3 h-full flex flex-col">
        <InteractionCardHeader 
          interaction={interaction}
          onToggleFavorite={onToggleFavorite}
        />

        {interaction.landmark_image_url && (
          <InteractionCardImage
            imageUrl={interaction.landmark_image_url}
            destination={interaction.destination}
            userInput={interaction.user_input}
            interaction={interaction}
          />
        )}

        {interaction.enhanced_landmark ? (
          <div className="flex-1 overflow-y-auto">
            <EnhancedLandmarkInfo landmark={interaction.enhanced_landmark} />
          </div>
        ) : (
          <InteractionCardContent interaction={interaction} />
        )}

        <InteractionCardActions interaction={interaction} />
      </CardContent>
    </Card>
  );
};

export default InteractionCard;
