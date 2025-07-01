
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import InteractionCardHeader from './InteractionCardHeader';
import InteractionCardContent from './InteractionCardContent';
import InteractionCardActions from './InteractionCardActions';
import { useImageDownload } from '@/hooks/useImageDownload';

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
  landmark_image_url: string | null;
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
  const { downloadImage, isDownloading } = useImageDownload();

  const handleDownload = async () => {
    if (interaction.landmark_image_url) {
      await downloadImage(
        interaction.landmark_image_url,
        `${interaction.destination}-landmark-${interaction.id.slice(0, 8)}`
      );
    }
  };

  return (
    <Card className="h-full flex flex-col bg-gray-800 text-white shadow-lg hover:shadow-xl transition-shadow duration-200 border-gray-700">
      <div className="p-3 pb-2">
        <InteractionCardHeader
          interaction={interaction}
          onToggleFavorite={onToggleFavorite}
        />
      </div>

      <CardContent className="flex-1 flex flex-col p-3 pt-0">
        {/* Image Section - Only show if landmark_image_url exists */}
        {interaction.landmark_image_url && (
          <div className="mb-3 relative">
            <img
              src={interaction.landmark_image_url}
              alt="Travel destination"
              className="w-full h-48 object-cover rounded-lg"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            
            {/* Download button positioned in top-right corner */}
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 border-0 backdrop-blur-sm"
              onClick={handleDownload}
              disabled={isDownloading}
              aria-label="Download image"
            >
              <Download className="w-4 h-4 text-white" />
            </Button>
          </div>
        )}

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
