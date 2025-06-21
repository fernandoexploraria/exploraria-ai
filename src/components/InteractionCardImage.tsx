
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  interaction_type: string;
  landmark_coordinates: any;
  full_transcript: any;
}

interface InteractionCardImageProps {
  imageUrl: string;
  destination: string;
  userInput: string;
  interaction: Interaction;
}

const InteractionCardImage: React.FC<InteractionCardImageProps> = ({
  imageUrl,
  destination,
  userInput,
  interaction,
}) => {
  const handleImageDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    // No functionality - disabled as requested
    console.log('Download button clicked but functionality disabled');
  };

  return (
    <div className="mb-2 flex-shrink-0 relative">
      <img 
        src={imageUrl} 
        alt="Landmark" 
        className="w-full h-20 object-cover rounded"
      />
      <div className="absolute top-1 right-1 flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
          onClick={handleImageDownload}
          title="Download image"
        >
          <Download className="w-3 h-3 text-white" />
        </Button>
      </div>
    </div>
  );
};

export default InteractionCardImage;
