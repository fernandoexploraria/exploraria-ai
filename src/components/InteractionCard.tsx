
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
        {/* Image Section */}
        <div className="mb-3">
          <img
            src="https://images.unsplash.com/photo-1747767763480-a5b4c7a82aef?q=80&w=2104&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt="Travel destination"
            className="w-full h-48 object-cover rounded-lg"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

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
