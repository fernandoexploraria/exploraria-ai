
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, StarOff, Calendar, Camera, Mic, MapPin } from 'lucide-react';
import ShareButton from './ShareButton';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  is_favorite: boolean;
  created_at: string;
  interaction_type: string;
  full_transcript: any;
  similarity?: number;
}

interface InteractionCardHeaderProps {
  interaction: Interaction;
  onToggleFavorite: (interaction: Interaction) => void;
}

const InteractionCardHeader: React.FC<InteractionCardHeaderProps> = ({
  interaction,
  onToggleFavorite,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Determine icon based on interaction type
  let IconComponent, iconColor;
  if (interaction.interaction_type === 'voice') {
    IconComponent = Mic;
    iconColor = 'text-blue-400';
  } else if (interaction.interaction_type === 'image_recognition') {
    IconComponent = Camera;
    iconColor = 'text-purple-400';
  } else if (interaction.interaction_type === 'map_marker') {
    IconComponent = MapPin;
    iconColor = 'text-red-400';
  } else {
    IconComponent = Mic;
    iconColor = 'text-blue-400';
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <IconComponent className={`w-3 h-3 ${iconColor}`} />
          <Badge variant="outline" className="text-xs px-1 py-0">{interaction.destination}</Badge>
          {interaction.similarity && (
            <Badge variant="secondary" className="text-xs px-1 py-0">
              {Math.round(interaction.similarity * 100)}% match
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ShareButton interaction={interaction} />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onToggleFavorite(interaction)}
          >
            {interaction.is_favorite ? (
              <Star className="w-3 h-3 text-yellow-500 fill-current" />
            ) : (
              <StarOff className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex items-center text-xs text-gray-400 mb-2">
        <Calendar className="w-3 h-3 mr-1" />
        {formatDate(interaction.created_at)}
      </div>
    </>
  );
};

export default InteractionCardHeader;
