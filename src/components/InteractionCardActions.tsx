
import React from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Share2 } from 'lucide-react';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  interaction_type: string;
  landmark_coordinates: any;
  full_transcript: any;
}

interface InteractionCardActionsProps {
  interaction: Interaction;
}

const InteractionCardActions: React.FC<InteractionCardActionsProps> = ({
  interaction,
}) => {
  // Function specifically for handling "Show on Map" button click
  const handleShowOnMap = () => {
    console.log('=== Show on Map Debug ===');
    console.log('Button clicked!');
    console.log('Interaction:', interaction);
    console.log('Landmark coordinates:', interaction.landmark_coordinates);
    console.log('Coordinates type:', typeof interaction.landmark_coordinates);
    console.log('Window navigateToMapCoordinates function exists:', !!(window as any).navigateToMapCoordinates);
    
    if (interaction.landmark_coordinates) {
      let coordinates: [number, number];
      
      // Handle different coordinate formats
      if (typeof interaction.landmark_coordinates === 'string') {
        // Handle string format like "(-99.1706976631243,19.3494767782822)"
        const coordString = interaction.landmark_coordinates.replace(/[()]/g, ''); // Remove parentheses
        const parts = coordString.split(',');
        if (parts.length === 2) {
          coordinates = [Number(parts[0].trim()), Number(parts[1].trim())];
        } else {
          console.log('ERROR: Invalid string coordinate format!', interaction.landmark_coordinates);
          return;
        }
      } else if (Array.isArray(interaction.landmark_coordinates)) {
        // If it's already an array [lng, lat]
        coordinates = [
          Number(interaction.landmark_coordinates[0]),
          Number(interaction.landmark_coordinates[1])
        ];
      } else if (typeof interaction.landmark_coordinates === 'object') {
        // If it's an object with x,y or lng,lat or longitude,latitude properties
        const coords = interaction.landmark_coordinates as any;
        coordinates = [
          Number(coords.lng || coords.longitude || coords.x || coords[0]),
          Number(coords.lat || coords.latitude || coords.y || coords[1])
        ];
      } else {
        console.log('ERROR: Unexpected coordinate format!');
        return;
      }
      
      console.log('Processed coordinates:', coordinates);
      console.log('Coordinate 0 (lng):', coordinates[0], 'type:', typeof coordinates[0]);
      console.log('Coordinate 1 (lat):', coordinates[1], 'type:', typeof coordinates[1]);
      
      // Validate coordinates are actual numbers
      if (isNaN(coordinates[0]) || isNaN(coordinates[1])) {
        console.log('ERROR: Coordinates are NaN!', coordinates);
        return;
      }
      
      // Call the new navigation function from Map component with interaction data
      if ((window as any).navigateToMapCoordinates) {
        console.log('Calling navigateToMapCoordinates with interaction data...');
        (window as any).navigateToMapCoordinates(coordinates, interaction);
      } else {
        console.log('ERROR: navigateToMapCoordinates function not found on window!');
      }
    } else {
      console.log('ERROR: No landmark coordinates found!');
    }
    console.log('=== End Debug ===');
  };

  // Function for handling share functionality
  const handleShare = async () => {
    console.log('Share button clicked for interaction:', interaction.id);
    
    // Create shareable content
    const shareTitle = `Travel Discovery in ${interaction.destination}`;
    let shareText = `Check out what I discovered in ${interaction.destination}!\n\n`;
    
    // Add the main interaction content
    if (interaction.interaction_type === 'voice' && interaction.full_transcript && Array.isArray(interaction.full_transcript)) {
      // For voice interactions, use the transcript
      const userMessages = interaction.full_transcript
        .filter((entry: any) => entry.role === 'user' && entry.message)
        .map((entry: any) => entry.message);
      const assistantMessages = interaction.full_transcript
        .filter((entry: any) => entry.role === 'agent' && entry.message)
        .map((entry: any) => entry.message);
      
      if (userMessages.length > 0) {
        shareText += `My question: ${userMessages[0]}\n\n`;
      }
      if (assistantMessages.length > 0) {
        shareText += `AI discovered: ${assistantMessages[0]}\n\n`;
      }
    } else {
      // For other interactions, use user_input and assistant_response
      shareText += `My question: ${interaction.user_input}\n\n`;
      shareText += `AI discovered: ${interaction.assistant_response}\n\n`;
    }
    
    shareText += `Discovered with Exploraria AI 🗺️✨`;
    
    const shareUrl = window.location.origin;

    try {
      if (navigator.share) {
        // Use Web Share API if available (mobile)
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        console.log('Content shared successfully');
      } else {
        // Fallback for desktop - copy to clipboard
        const fullShareContent = `${shareTitle}\n\n${shareText}\n\n${shareUrl}`;
        await navigator.clipboard.writeText(fullShareContent);
        console.log('Content copied to clipboard');
        
        // You could add a toast notification here if needed
        alert('Content copied to clipboard! You can now paste it wherever you want to share.');
      }
    } catch (error) {
      console.error('Error sharing content:', error);
      
      // Final fallback - try clipboard
      try {
        const fullShareContent = `${shareTitle}\n\n${shareText}\n\n${shareUrl}`;
        await navigator.clipboard.writeText(fullShareContent);
        alert('Content copied to clipboard!');
      } catch (clipboardError) {
        console.error('Error copying to clipboard:', clipboardError);
        alert('Unable to share content. Please try again.');
      }
    }
  };

  return (
    <div className="mt-2 flex-shrink-0 space-y-1">
      {interaction.landmark_coordinates && (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={handleShowOnMap}
        >
          <MapPin className="w-3 h-3 mr-1" />
          Show on Map
        </Button>
      )}
      
      <Button
        variant="outline"
        size="sm"
        className="w-full h-7 text-xs"
        onClick={handleShare}
      >
        <Share2 className="w-3 h-3 mr-1" />
        Sharing
      </Button>
    </div>
  );
};

export default InteractionCardActions;
