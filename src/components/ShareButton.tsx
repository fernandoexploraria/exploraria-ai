
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
  landmark_image_url?: string | null;
  audio_url?: string | null;
}

interface ShareButtonProps {
  interaction: Interaction;
}

const ShareButton: React.FC<ShareButtonProps> = ({ interaction }) => {
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
    
    // Add meaningful links for media
    if (interaction.landmark_image_url) {
      shareText += `📸 View Photo: ${interaction.landmark_image_url}\n`;
    }
    
    if (interaction.audio_url) {
      shareText += `🎵 Listen to Audio: ${interaction.audio_url}\n`;
    }
    
    if (interaction.landmark_image_url || interaction.audio_url) {
      shareText += `\n`;
    }
    
    shareText += `Discovered with Exploraria AI 🗺️✨`;
    
    const shareUrl = window.location.origin;

    try {
      if (navigator.share) {
        const shareData = {
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        };

        await navigator.share(shareData);
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
