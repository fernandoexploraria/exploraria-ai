
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface InteractionCardImageProps {
  imageUrl: string;
  destination: string;
  userInput: string;
  onImageClick: (e: React.MouseEvent) => void;
}

const InteractionCardImage: React.FC<InteractionCardImageProps> = ({
  imageUrl,
  destination,
  userInput,
  onImageClick,
}) => {
  const handleImageDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      // Create a temporary link element for download
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `${destination}_${userInput.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
      link.target = '_blank'; // Open in new tab on mobile if direct download fails
      
      // For mobile devices, we'll open the image in a new tab
      // Users can then long-press and save to photos
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        window.open(imageUrl, '_blank');
      } else {
        // For desktop, try direct download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      // Fallback: open image in new tab
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <div className="mb-2 flex-shrink-0 relative">
      <img 
        src={imageUrl} 
        alt="Landmark" 
        className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
        onClick={onImageClick}
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
