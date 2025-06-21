
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import InteractionCardHeader from './InteractionCardHeader';
import InteractionCardImage from './InteractionCardImage';
import InteractionCardContent from './InteractionCardContent';
import InteractionCardActions from './InteractionCardActions';
import ShareButton from './ShareButton';

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
      <ShareButton interaction={interaction} />
      
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
          />
        )}

        <InteractionCardContent interaction={interaction} />

        <InteractionCardActions interaction={interaction} />
      </CardContent>
    </Card>
  );
};

export default InteractionCard;
