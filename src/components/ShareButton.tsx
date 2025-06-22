
import React from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  interaction_type: string;
  full_transcript: any;
  conversation_summary?: string;
  landmark_image_url?: string;
  landmark_coordinates?: any; // Add this property to match the actual data structure
}

interface ShareButtonProps {
  interaction: Interaction;
}

const ShareButton: React.FC<ShareButtonProps> = ({ interaction }) => {
  // Convert image to WebP format for better compression
  const convertImageToWebP = async (imageUrl: string): Promise<Blob | null> => {
    try {
      console.log('Converting image to WebP:', imageUrl);
      
      // Create a canvas to convert the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      return new Promise((resolve) => {
        img.onload = () => {
          // Set canvas dimensions to match image
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw image on canvas
          ctx?.drawImage(img, 0, 0);
          
          // Convert to WebP with 80% quality for good compression
          canvas.toBlob((blob) => {
            console.log('Image converted to WebP, size:', blob?.size);
            resolve(blob);
          }, 'image/webp', 0.8);
        };
        
        img.onerror = () => {
          console.error('Failed to load image for conversion');
          resolve(null);
        };
        
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
      });
    } catch (error) {
      console.error('Error converting image to WebP:', error);
      return null;
    }
  };

  // Generate location links for map interactions
  const generateLocationLinks = (coordinates: any) => {
    let lat: number, lng: number;
    
    // Handle different coordinate formats (same logic as InteractionCardHeader)
    if (typeof coordinates === 'string') {
      // Handle string format like "(-99.1706976631243,19.3494767782822)"
      const coordString = coordinates.replace(/[()]/g, ''); // Remove parentheses
      const parts = coordString.split(',');
      if (parts.length === 2) {
        lng = Number(parts[0].trim());
        lat = Number(parts[1].trim());
      } else {
        console.log('ERROR: Invalid string coordinate format!', coordinates);
        return '';
      }
    } else if (Array.isArray(coordinates)) {
      // If it's already an array [lng, lat]
      lng = Number(coordinates[0]);
      lat = Number(coordinates[1]);
    } else if (typeof coordinates === 'object') {
      // If it's an object with x,y or lng,lat or longitude,latitude properties
      const coords = coordinates as any;
      lng = Number(coords.lng || coords.longitude || coords.x || coords[0]);
      lat = Number(coords.lat || coords.latitude || coords.y || coords[1]);
    } else {
      console.log('ERROR: Unexpected coordinate format!', coordinates);
      return '';
    }
    
    // Validate coordinates are actual numbers
    if (isNaN(lng) || isNaN(lat)) {
      console.log('ERROR: Coordinates are NaN!', { lng, lat, original: coordinates });
      return '';
    }
    
    const googleMapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
    const appleMapsUrl = `https://maps.apple.com/?q=${lat},${lng}`;
    
    return `\n📍 View location:\n• Google Maps: ${googleMapsUrl}\n• Apple Maps: ${appleMapsUrl}\n`;
  };

  const handleShare = async () => {
    console.log('Share button clicked for interaction:', interaction.id, 'Type:', interaction.interaction_type);
    
    // Create shareable content
    const shareTitle = `Travel Discovery in ${interaction.destination}`;
    let shareText = `Check out what I discovered in ${interaction.destination}!\n\n`;
    
    // For voice interactions, use conversation summary if available
    if (interaction.interaction_type === 'voice' && interaction.conversation_summary) {
      shareText += `${interaction.conversation_summary}\n\n`;
    } else if (interaction.interaction_type === 'voice' && interaction.full_transcript && Array.isArray(interaction.full_transcript)) {
      // Fallback to transcript if no summary is available
      const userMessages = interaction.full_transcript
        .filter((entry: any) => entry.role === 'user' && entry.message)
        .map((entry: any) => entry.message);
      const assistantMessages = interaction.full_transcript
        .filter((entry: any) => entry.role === 'agent' && entry.message)
        .map((entry: any) => entry.message);
      
      if (userMessages.length > 0) {
        shareText += `${userMessages[0]}\n\n`;
      }
      if (assistantMessages.length > 0) {
        shareText += `${assistantMessages[0]}\n\n`;
      }
    } else {
      // For map marker, image recognition, and other interactions
      if (interaction.user_input && interaction.user_input.trim()) {
        shareText += `${interaction.user_input}\n\n`;
      }
      if (interaction.assistant_response && interaction.assistant_response.trim()) {
        shareText += `${interaction.assistant_response}\n\n`;
      }
    }
    
    // Add location links for map interactions
    if (interaction.interaction_type === 'map_marker' && interaction.landmark_coordinates) {
      const locationLinks = generateLocationLinks(interaction.landmark_coordinates);
      if (locationLinks) {
        shareText += locationLinks;
      }
    }
    
    shareText += `\nDiscovered with Exploraria AI 🗺️✨`;
    
    const shareUrl = window.location.origin;

    try {
      // For map interactions, don't try to share files - just share the text with location links
      if (interaction.interaction_type === 'map_marker') {
        console.log('Sharing map interaction with location links...');
        console.log('Coordinates being shared:', interaction.landmark_coordinates);
        
        if (navigator.share) {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl,
          });
          console.log('Map interaction shared successfully via Web Share API');
          return;
        } else {
          // Fallback to clipboard for map interactions
          const fullShareContent = `${shareTitle}\n\n${shareText}\n\n${shareUrl}`;
          await navigator.clipboard.writeText(fullShareContent);
          console.log('Map interaction content copied to clipboard');
          alert('Content with location links copied to clipboard!');
          return;
        }
      }

      // For other interaction types, keep the existing image sharing logic
      // Check if Web Share API is available and can share files
      const canShareFiles = navigator.share && navigator.canShare && interaction.landmark_image_url;
      
      if (canShareFiles) {
        console.log('Attempting to share with Web Share API including files...');
        
        // Prepare files array for sharing
        const files: File[] = [];
        
        // Convert and add image file if available
        if (interaction.landmark_image_url) {
          console.log('Converting image for sharing...');
          const imageBlob = await convertImageToWebP(interaction.landmark_image_url);
          
          if (imageBlob) {
            const fileName = `exploraria-${interaction.destination.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.webp`;
            const imageFile = new File([imageBlob], fileName, { type: 'image/webp' });
            files.push(imageFile);
            console.log('Image file prepared for sharing:', fileName, 'Size:', imageBlob.size);
          }
        }

        // Test if we can share with files
        const shareData: any = {
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        };
        
        if (files.length > 0) {
          shareData.files = files;
        }

        // Try sharing with files first
        if (files.length > 0 && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          console.log('Content and files shared successfully via Web Share API');
          return;
        }
      }

      // Fallback to Web Share API without files
      if (navigator.share) {
        console.log('Sharing without files via Web Share API...');
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        console.log('Content shared successfully via Web Share API');
        return;
      }

      // Final fallback - copy to clipboard and download image separately
      console.log('Using clipboard + download fallback...');
      const fullShareContent = `${shareTitle}\n\n${shareText}\n\n${shareUrl}`;
      await navigator.clipboard.writeText(fullShareContent);
      
      // Download the WebP image if available (for non-map interactions)
      if (interaction.landmark_image_url) {
        const imageBlob = await convertImageToWebP(interaction.landmark_image_url);
        if (imageBlob) {
          const fileName = `exploraria-${interaction.destination.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.webp`;
          const downloadUrl = URL.createObjectURL(imageBlob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          
          console.log('Content copied to clipboard and image downloaded');
          alert('Content copied to clipboard and image downloaded!');
        } else {
          console.log('Content copied to clipboard (image conversion failed)');
          alert('Content copied to clipboard! (Image could not be processed)');
        }
      } else {
        console.log('Content copied to clipboard');
        alert('Content copied to clipboard! You can now paste it wherever you want to share.');
      }

    } catch (error) {
      console.error('Error sharing content:', error);
      
      // Ultimate fallback - try clipboard only
      try {
        const fullShareContent = `${shareTitle}\n\n${shareText}\n\n${shareUrl}`;
        await navigator.clipboard.writeText(fullShareContent);
        console.log('Fallback: Content copied to clipboard');
        alert('Content copied to clipboard!');
      } catch (clipboardError) {
        console.error('Error copying to clipboard:', clipboardError);
        alert('Unable to share content. Please try again.');
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      onClick={handleShare}
      title="Share"
    >
      <Share2 className="w-3 h-3" />
    </Button>
  );
};

export default ShareButton;
