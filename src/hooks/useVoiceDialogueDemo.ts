import { useState } from 'react';
import { useGeminiAPI } from './useGeminiAPI';
import { useTTSContext } from '@/contexts/TTSContext';

interface DialogueLine {
  speaker: 'AGENT' | 'TOURIST';
  text: string;
  voice?: string;
}

export const useVoiceDialogueDemo = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLine, setCurrentLine] = useState<number>(-1);
  const { callGemini, isLoading } = useGeminiAPI();
  const { speak, stop } = useTTSContext();

  const generateDialogue = async (): Promise<DialogueLine[]> => {
    const prompt = `Create a natural, engaging 30-second dialogue between a friendly AI tour guide named Alexis and an excited tourist exploring New York City. The conversation should feel spontaneous and authentic, not scripted. 

Make it sound like:
- AGENT: Warm, knowledgeable, enthusiastic local guide
- TOURIST: Curious, excited visitor asking genuine questions

Focus on discovering a famous landmark like the Empire State Building, Central Park, or Brooklyn Bridge. Include:
- Natural conversation flow with realistic responses
- Specific details that show local expertise
- A sense of discovery and excitement
- Modern, conversational language

Format as:
AGENT: [dialogue]
TOURIST: [dialogue]
AGENT: [dialogue]
TOURIST: [dialogue]

Keep it to 4-6 exchanges maximum for a 30-second demo.`;

    const response = await callGemini(prompt);
    
    if (!response) {
      // Fallback dialogue if AI generation fails
      return [
        { speaker: 'AGENT', text: "Hi! I'm Alexis, your personal New York tour guide. Ready to discover some amazing places?", voice: 'en-US-Neural2-F' },
        { speaker: 'TOURIST', text: "Absolutely! What's that incredible building we're looking at?", voice: 'en-US-Neural2-A' },
        { speaker: 'AGENT', text: "That's the iconic Empire State Building! Want to know a secret about the best viewing times?", voice: 'en-US-Neural2-F' },
        { speaker: 'TOURIST', text: "Yes, tell me everything! Can we go up there now?", voice: 'en-US-Neural2-A' },
        { speaker: 'AGENT', text: "Perfect timing! The observatory is open and the sunset views are incredible from up there!", voice: 'en-US-Neural2-F' }
      ];
    }

    // Parse the AI response into dialogue lines
    const lines = response.split('\n').filter(line => line.trim());
    const dialogue: DialogueLine[] = [];

    for (const line of lines) {
      if (line.startsWith('AGENT:')) {
        dialogue.push({
          speaker: 'AGENT',
          text: line.replace('AGENT:', '').trim(),
          voice: 'en-US-Neural2-F' // Warmer female voice for guide
        });
      } else if (line.startsWith('TOURIST:')) {
        dialogue.push({
          speaker: 'TOURIST', 
          text: line.replace('TOURIST:', '').trim(),
          voice: 'en-US-Neural2-A' // Energetic male voice for tourist
        });
      }
    }

    return dialogue.length > 0 ? dialogue : [
      { speaker: 'AGENT', text: "Hi! I'm Alexis, your personal New York tour guide. Ready to explore?", voice: 'en-US-Neural2-F' }
    ];
  };

  const playDialogue = async () => {
    if (isPlaying) {
      stopDialogue();
      return;
    }

    try {
      setIsPlaying(true);
      setCurrentLine(-1);
      
      console.log('🎭 Starting voice dialogue demo...');
      const dialogue = await generateDialogue();
      console.log('🎭 Generated dialogue:', dialogue);
      
      for (let i = 0; i < dialogue.length; i++) {
        if (!isPlaying) break; // Check if user stopped playback
        
        setCurrentLine(i);
        const line = dialogue[i];
        
        console.log(`🎭 Speaking line ${i + 1}: ${line.speaker} - ${line.text}`);
        
        // Add a small pause between speakers for natural flow
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (!isPlaying) break; // Check again after pause
        
        // Speak the current line
        await speak(line.text, false);
        
        // Wait for the speech to complete
        await waitForSpeechToComplete(line.text);
      }
      
    } catch (error) {
      console.error('Error playing dialogue:', error);
    } finally {
      setIsPlaying(false);
      setCurrentLine(-1);
      console.log('🎭 Dialogue demo completed');
    }
  };

  const waitForSpeechToComplete = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      // Calculate approximate speech duration based on text length
      // Average speaking rate is about 150-160 words per minute
      const estimateSpeechDuration = (text: string): number => {
        const wordCount = text.split(' ').length;
        const wordsPerMinute = 150;
        const durationMs = (wordCount / wordsPerMinute) * 60 * 1000;
        return Math.max(durationMs, 1500); // Minimum 1.5 seconds
      };

      const duration = estimateSpeechDuration(text);
      console.log(`🎭 Estimated speech duration for "${text.substring(0, 30)}...": ${duration}ms`);
      setTimeout(resolve, duration);
    });
  };

  const stopDialogue = () => {
    stop();
    setIsPlaying(false);
    setCurrentLine(-1);
  };

  return {
    playDialogue,
    stopDialogue,
    isPlaying,
    isGenerating: isLoading,
    currentLine
  };
};