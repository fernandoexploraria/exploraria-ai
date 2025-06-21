
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

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
  const handleImageDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Download button clicked');

    try {
      // Check if we're on a native platform (mobile app or PWA with native capabilities)
      const isNativePlatform = Capacitor.isNativePlatform() || 
                              (Capacitor.getPlatform() === 'web' && 'serviceWorker' in navigator);

      if (isNativePlatform) {
        console.log('Attempting native camera roll save...');
        
        // Convert image URL to base64
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        // Save to camera roll using Capacitor Camera plugin
        await Camera.savePicture({
          photos: [base64],
          albumName: 'Exploraria AI'
        });

        console.log('Image saved to camera roll successfully');
        // You could add a toast notification here
        
      } else {
        throw new Error('Native platform not available, using fallback');
      }
    } catch (error) {
      console.log('Native save failed, using fallback download:', error);
      
      // Fallback: Standard download approach
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `exploraria-${destination.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(url);
        console.log('Image downloaded successfully');
      } catch (downloadError) {
        console.error('Download failed:', downloadError);
      }
    }
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
