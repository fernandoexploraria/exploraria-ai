import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Clock, Play, Square } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import InteractionCardImage from './InteractionCardImage';
import { useTTSContext } from '@/contexts/TTSContext';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  interaction_type: string;
  created_at: string;
  landmark_coordinates: any;
  full_transcript: any;
  image_url?: string;
  is_favorite?: boolean;
  place_id?: string;
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
  const { speak, stop } = useTTSContext();

  const handlePlayPause = () => {
    if (isCurrentlyPlaying) {
      stop();
    } else {
      const textToRead = `${interaction.destination}. ${interaction.assistant_response}`;
      speak(textToRead, interaction.id);
    }
  };

  const handleLocationClick = () => {
    if (interaction.landmark_coordinates) {
      onLocationClick(interaction.landmark_coordinates);
    }
  };

  const getInteractionTypeDisplay = (type: string) => {
    switch (type) {
      case 'voice_assistant':
        return { label: 'Voice', color: 'bg-blue-500' };
      case 'chat':
        return { label: 'Chat', color: 'bg-green-500' };
      case 'tour_generation':
        return { label: 'Tour', color: 'bg-purple-500' };
      default:
        return { label: 'General', color: 'bg-gray-500' };
    }
  };

  const typeDisplay = getInteractionTypeDisplay(interaction.interaction_type);

  return (
    <Card className="h-full flex flex-col bg-white shadow-lg hover:shadow-xl transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-gray-900 truncate">
              {interaction.destination}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className={`text-white text-xs ${typeDisplay.color}`}>
                {typeDisplay.label}
              </Badge>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleFavorite(interaction)}
            className="flex-shrink-0 ml-2"
          >
            <Star
              className={`w-4 h-4 ${
                interaction.is_favorite 
                  ? 'fill-yellow-400 text-yellow-400' 
                  : 'text-gray-400 hover:text-yellow-400'
              }`}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 pt-0">
        {/* Image Section */}
        {interaction.image_url && (
          <InteractionCardImage
            imageUrl={interaction.image_url}
            destination={interaction.destination}
            userInput={interaction.user_input}
            interaction={interaction}
            isVisible={isVisible}
          />
        )}

        {/* User Input */}
        {interaction.user_input && (
          <div className="mb-3">
            <p className="text-sm text-gray-600 italic">
              "{interaction.user_input}"
            </p>
          </div>
        )}

        {/* Assistant Response */}
        <div className="flex-1 mb-3">
          <p className="text-sm text-gray-800 line-clamp-4">
            {interaction.assistant_response}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayPause}
            className="flex-1"
          >
            {isCurrentlyPlaying ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Listen
              </>
            )}
          </Button>
          
          {interaction.landmark_coordinates && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLocationClick}
              className="flex-1"
            >
              <MapPin className="w-4 h-4 mr-2" />
              View on Map
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InteractionCard;
