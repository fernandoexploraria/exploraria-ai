
import React from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
        shareText += `My question: ${userMessages[0]}\n\n`;
      }
      if (assistantMessages.length > 0) {
        shareText += `AI discovered: ${assistantMessages[0]}\n\n`;
      }
    } else {
      // For map marker, image recognition, and other interactions, use user_input and assistant_response
      if (interaction.user_input && interaction.user_input.trim()) {
        shareText += `My question: ${interaction.user_input}\n\n`;
      }
      if (interaction.assistant_response && interaction.assistant_response.trim()) {
        shareText += `AI discovered: ${interaction.assistant_response}\n\n`;
      }

      // Add shortened image URL for map marker and image recognition interactions
      if (interaction.landmark_image_url && 
          (interaction.interaction_type === 'map_marker' || interaction.interaction_type === 'image_recognition')) {
        try {
          console.log('Creating short URL for image:', interaction.landmark_image_url);
          
          // Get the current session to include auth header
          const { data: { session } } = await supabase.auth.getSession();
          
          const { data, error } = await supabase.functions.invoke('create-short-url', {
            body: {
              originalUrl: interaction.landmark_image_url,
              urlType: 'image',
              interactionId: interaction.id
            },
            headers: session?.access_token ? {
              Authorization: `Bearer ${session.access_token}`
            } : {}
          });

          if (data && data.shortUrl) {
            shareText += `📸 View image: ${data.shortUrl}\n\n`;
            console.log('Short URL created:', data.shortUrl);
          } else {
            console.error('Failed to create short URL:', error);
          }
        } catch (error) {
          console.error('Error creating short URL:', error);
        }
      }
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
