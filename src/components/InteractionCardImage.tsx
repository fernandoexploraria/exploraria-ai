
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface InteractionCardImageProps {
  imageUrl: string;
  destination: string;
  userInput: string;
}

const InteractionCardImage: React.FC<InteractionCardImageProps> = ({
  imageUrl,
  destination,
  userInput,
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
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-1 right-1 h-6 w-6 p-0 bg-black/50 hover:bg-black/70"
        onClick={handleImageDownload}
        title="Download image"
      >
        <Download className="w-3 h-3 text-white" />
      </Button>
    </div>
  );
};

export default InteractionCardImage;
