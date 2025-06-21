
import React from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { createShortUrl } from '@/utils/urlShortener';

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
    console.log('=== SHARE BUTTON DEBUG ===');
    console.log('Share button clicked for interaction:', interaction.id);
    console.log('Interaction type:', interaction.interaction_type);
    console.log('Audio URL found:', interaction.audio_url);
    console.log('Audio URL type:', typeof interaction.audio_url);
    console.log('Audio URL value check:', interaction.audio_url === null, interaction.audio_url === undefined);
    console.log('Full interaction object:', JSON.stringify(interaction, null, 2));
    
    // Check if there's audio data in the full_transcript for map marker interactions
    if (interaction.interaction_type === 'map_marker' && interaction.full_transcript) {
      console.log('Checking full_transcript for audio data...');
      console.log('Full transcript:', JSON.stringify(interaction.full_transcript, null, 2));
      
      // Look for audio URL in different possible locations
      if (Array.isArray(interaction.full_transcript)) {
        const audioEntry = interaction.full_transcript.find((entry: any) => 
          entry.audio_url || entry.audioUrl || (entry.type === 'audio')
        );
        if (audioEntry) {
          console.log('Found audio in transcript:', audioEntry);
        }
      }
    }
    
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
    
    // Create short, meaningful URLs for media with descriptive text
    if (interaction.landmark_image_url) {
      console.log('Creating image short URL for:', interaction.landmark_image_url);
      const shortImageUrl = createShortUrl(
        interaction.landmark_image_url, 
        'image', 
        interaction.destination
      );
      shareText += `📸 View ${interaction.destination} Photo:\n${shortImageUrl}\n\n`;
    }
    
    // Handle audio URL - check multiple possible sources
    let audioUrlToUse = interaction.audio_url;
    
    // If no direct audio_url, check if it's in the transcript (for map marker interactions)
    if (!audioUrlToUse && interaction.full_transcript && Array.isArray(interaction.full_transcript)) {
      const audioEntry = interaction.full_transcript.find((entry: any) => 
        entry.audio_url || entry.audioUrl
      );
      if (audioEntry) {
        audioUrlToUse = audioEntry.audio_url || audioEntry.audioUrl;
        console.log('Found audio URL in transcript:', audioUrlToUse);
      }
    }
    
    if (audioUrlToUse) {
      console.log('Creating audio short URL for:', audioUrlToUse);
      const shortAudioUrl = createShortUrl(
        audioUrlToUse, 
        'audio', 
        interaction.destination
      );
      shareText += `🎵 Listen to ${interaction.destination} Audio:\n${shortAudioUrl}\n\n`;
    } else {
      console.log('No audio URL found - checked both direct audio_url and transcript');
    }
    
    shareText += `Discovered with Exploraria AI 🗺️✨`;
    
    console.log('Final share text:', shareText);
    console.log('=== END SHARE DEBUG ===');
    
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
