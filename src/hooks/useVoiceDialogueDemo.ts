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
    console.log('🎭 generateDialogue called');
    
    try {
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

      console.log('🎭 Calling Gemini API...');
      const response = await callGemini(prompt);
      console.log('🎭 Gemini API response:', response);
      
      if (!response) {
        console.log('🎭 No response from Gemini, using fallback dialogue');
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
      console.log('🎭 Parsing AI response into dialogue lines...');
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

      console.log('🎭 Parsed dialogue:', dialogue);

      if (dialogue.length === 0) {
        console.log('🎭 No dialogue parsed, using fallback');
        return [
          { speaker: 'AGENT', text: "Hi! I'm Alexis, your personal New York tour guide. Ready to explore?", voice: 'en-US-Neural2-F' }
        ];
      }

      return dialogue;
      
    } catch (error) {
      console.error('🎭 Error in generateDialogue:', error);
      
      // Return fallback dialogue on any error
      console.log('🎭 Returning fallback dialogue due to error');
      return [
        { speaker: 'AGENT', text: "Hi! I'm Alexis, your personal New York tour guide. Ready to discover some amazing places?", voice: 'en-US-Neural2-F' },
        { speaker: 'TOURIST', text: "Absolutely! What's that incredible building we're looking at?", voice: 'en-US-Neural2-A' },
        { speaker: 'AGENT', text: "That's the iconic Empire State Building! Want to know a secret about the best viewing times?", voice: 'en-US-Neural2-F' },
        { speaker: 'TOURIST', text: "Yes, tell me everything! Can we go up there now?", voice: 'en-US-Neural2-A' },
        { speaker: 'AGENT', text: "Perfect timing! The observatory is open and the sunset views are incredible from up there!", voice: 'en-US-Neural2-F' }
      ];
    }
  };

  const playDialogue = async () => {
    console.log('🎭 playDialogue called, current isPlaying:', isPlaying);
    
    if (isPlaying) {
      console.log('🎭 Already playing, stopping dialogue');
      stopDialogue();
      return;
    }

    console.log('🎭 Starting voice dialogue demo...');
    
    try {
      setIsPlaying(true);
      setCurrentLine(-1);
      
      console.log('🎭 Attempting to generate dialogue...');
      const dialogue = await generateDialogue();
      
      if (!dialogue || dialogue.length === 0) {
        console.error('🎭 No dialogue generated');
        throw new Error('No dialogue was generated');
      }
      
      console.log('🎭 Generated dialogue:', dialogue);
      
      // Store playing state in a local variable to prevent race conditions
      let stillPlaying = true;
      
      for (let i = 0; i < dialogue.length && stillPlaying; i++) {
        console.log(`🎭 Processing line ${i + 1} of ${dialogue.length}`);
        
        setCurrentLine(i);
        const line = dialogue[i];
        
        console.log(`🎭 Speaking line ${i + 1}: ${line.speaker} - ${line.text}`);
        
        // Add a longer pause between speakers to prevent overlap
        if (i > 0) {
          console.log('🎭 Adding pause between speakers...');
          await new Promise(resolve => setTimeout(resolve, 1500)); // Increased to 1.5 seconds
        }
        
        try {
          // Speak the current line with appropriate voice
          console.log('🎭 Calling TTS speak function...');
          const voiceGender = line.speaker === 'AGENT' ? 'female' : 'male';
          await speak(line.text, false, undefined, voiceGender);
          console.log('🎭 TTS speak function completed');
          
          // Wait for the speech to complete
          console.log('🎭 Waiting for speech to complete...');
          await waitForSpeechToComplete(line.text);
          console.log('🎭 Speech completed, moving to next line');
        } catch (speakError) {
          console.error('🎭 Error during speech:', speakError);
          // Continue with next line even if one fails
        }
      }
      
      console.log('🎭 Dialogue demo completed successfully');
      
    } catch (error) {
      console.error('🎭 Error in playDialogue:', error);
      // Show user-friendly error message
      alert(`Voice demo failed: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      setIsPlaying(false);
      setCurrentLine(-1);
      console.log('🎭 Dialogue demo cleanup completed');
    }
  };

  const waitForSpeechToComplete = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      // Calculate approximate speech duration based on text length
      // Average speaking rate is about 150-160 words per minute
      const estimateSpeechDuration = (text: string): number => {
        const wordCount = text.split(' ').length;
        const wordsPerMinute = 140; // Slightly slower for more natural pacing
        const durationMs = (wordCount / wordsPerMinute) * 60 * 1000;
        return Math.max(durationMs + 800, 2000); // Add buffer time + minimum 2 seconds
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