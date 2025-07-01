
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import InteractionCardHeader from './InteractionCardHeader';
import InteractionCardContent from './InteractionCardContent';
import InteractionCardActions from './InteractionCardActions';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  interaction_type: string;
  created_at: string;
  landmark_coordinates: any;
  full_transcript: any;
  is_favorite: boolean;
}

interface InteractionCardProps {
  interaction: Interaction;
  index: number;
  isCurrentlyPlaying: boolean;
  onToggleFavorite: (interaction: Interaction) => void;
  onLocationClick: (coordinates: any) => void;
  isVisible?: boolean;
}

const InteractionCard: React.FC<InteractionCardProps> = ({
  interaction,
  index,
  isCurrentlyPlaying,
  onToggleFavorite,
  onLocationClick,
  isVisible = true
}) => {
  return (
    <Card className="h-full flex flex-col bg-gray-800 text-white shadow-lg hover:shadow-xl transition-shadow duration-200 border-gray-700">
      <div className="p-3 pb-2">
        <InteractionCardHeader
          interaction={interaction}
          onToggleFavorite={onToggleFavorite}
        />
      </div>

      <CardContent className="flex-1 flex flex-col p-3 pt-0">
        {/* Main Content */}
        <div className="flex-1 mb-3">
          <InteractionCardContent interaction={interaction} />
        </div>

        {/* Actions */}
        <InteractionCardActions interaction={interaction} />
      </CardContent>
    </Card>
  );
};

export default InteractionCard;
