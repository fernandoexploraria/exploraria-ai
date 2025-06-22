
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

  const handleShare = async () => {
    console.log('Share button clicked for interaction:', interaction.id);
    
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
    
    shareText += `Discovered with Exploraria AI 🗺️✨`;
    
    const shareUrl = window.location.origin;

    try {
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

      if (navigator.share && navigator.canShare && navigator.canShare({ files })) {
        // Use Web Share API with files if available (mobile)
        const shareData: any = {
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        };
        
        if (files.length > 0) {
          shareData.files = files;
        }
        
        await navigator.share(shareData);
        console.log('Content and files shared successfully');
      } else {
        // Fallback for desktop - copy to clipboard and download image
        const fullShareContent = `${shareTitle}\n\n${shareText}\n\n${shareUrl}`;
        await navigator.clipboard.writeText(fullShareContent);
        
        // Download the WebP image if available
        if (files.length > 0) {
          const imageFile = files[0];
          const downloadUrl = URL.createObjectURL(imageFile);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = imageFile.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          
          console.log('Content copied to clipboard and image downloaded');
          alert('Content copied to clipboard and image downloaded!');
        } else {
          console.log('Content copied to clipboard');
          alert('Content copied to clipboard! You can now paste it wherever you want to share.');
        }
      }
    } catch (error) {
      console.error('Error sharing content:', error);
      
      // Final fallback - try clipboard only
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
