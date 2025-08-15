import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Square, Volume2 } from 'lucide-react';

interface DialogueLine {
  id: string;
  speaker: 'AGENT' | 'TOURIST';
  text: string;
  audioUrl: string;
}

interface DialogueChoice {
  id: string;
  text: string;
  displayText: string;
}

interface DialogueStep {
  id: string;
  lines: DialogueLine[];
  choices?: DialogueChoice[];
  isEnd?: boolean;
}

// Pre-scripted dialogue tree
const DIALOGUE_SCRIPT: Record<string, DialogueStep> = {
  intro: {
    id: 'intro',
    lines: [
      {
        id: 'agent-welcome',
        speaker: 'AGENT',
        text: "Hi! I'm Alexis, your personal AI tour guide. Welcome to New York City! What kind of adventure are you looking for today?",
        audioUrl: 'voice-demo-audio/agent-welcome.mp3'
      }
    ],
    choices: [
      { id: 'historical', text: 'historical', displayText: 'Show me iconic landmarks and history' },
      { id: 'hidden', text: 'hidden', displayText: 'I want to discover hidden gems' }
    ]
  },
  historical: {
    id: 'historical',
    lines: [
      {
        id: 'tourist-historical',
        speaker: 'TOURIST',
        text: 'Show me iconic landmarks and history',
        audioUrl: 'voice-demo-audio/tourist-historical.mp3'
      },
      {
        id: 'agent-historical-response',
        speaker: 'AGENT',
        text: "Perfect choice! New York is rich with incredible history. Look behind you - that's the magnificent Empire State Building! Built in 1931, it was the world's tallest building for 40 years. Would you like to explore it or see what other treasures are nearby?",
        audioUrl: 'voice-demo-audio/agent-historical-response.mp3'
      }
    ],
    choices: [
      { id: 'empire-state', text: 'empire-state', displayText: 'Tell me more about the Empire State Building' },
      { id: 'nearby-treasures', text: 'nearby-treasures', displayText: 'Show me other nearby treasures' }
    ]
  },
  hidden: {
    id: 'hidden',
    lines: [
      {
        id: 'tourist-hidden',
        speaker: 'TOURIST',
        text: 'I want to discover hidden gems',
        audioUrl: 'voice-demo-audio/tourist-hidden.mp3'
      },
      {
        id: 'agent-hidden-response',
        speaker: 'AGENT',
        text: "Excellent! I love showing visitors NYC's secret spots. Just two blocks from here is a hidden speakeasy from the 1920s that most tourists never find. Plus, there's a rooftop garden with stunning city views that locals use as their quiet escape. Which sounds more intriguing?",
        audioUrl: 'voice-demo-audio/agent-hidden-response.mp3'
      }
    ],
    choices: [
      { id: 'speakeasy', text: 'speakeasy', displayText: 'The secret speakeasy sounds amazing!' },
      { id: 'garden', text: 'garden', displayText: 'I love peaceful spots - show me the garden' }
    ]
  },
  'empire-state': {
    id: 'empire-state',
    lines: [
      {
        id: 'tourist-empire-state',
        speaker: 'TOURIST',
        text: 'Tell me more about the Empire State Building',
        audioUrl: 'voice-demo-audio/tourist-empire-state.mp3'
      },
      {
        id: 'agent-empire-final',
        speaker: 'AGENT',
        text: "Here's a fascinating detail - the building has its own ZIP code! It was constructed in just 410 days, and on clear days, you can see five states from the top. The lights change colors for holidays and special events. I can help you skip the lines and find the best photo spots. Ready to start your New York adventure?",
        audioUrl: 'voice-demo-audio/agent-empire-final.mp3'
      }
    ],
    isEnd: true
  },
  'nearby-treasures': {
    id: 'nearby-treasures',
    lines: [
      {
        id: 'tourist-nearby',
        speaker: 'TOURIST',
        text: 'Show me other nearby treasures',
        audioUrl: 'voice-demo-audio/tourist-nearby.mp3'
      },
      {
        id: 'agent-nearby-final',
        speaker: 'AGENT',
        text: "Within walking distance, you'll find the stunning New York Public Library with its famous lions, Bryant Park where locals relax, and Grand Central Terminal - an architectural masterpiece. I can create the perfect route based on your interests and show you insider tips for each location. Shall we begin your personalized tour?",
        audioUrl: 'voice-demo-audio/agent-nearby-final.mp3'
      }
    ],
    isEnd: true
  },
  speakeasy: {
    id: 'speakeasy',
    lines: [
      {
        id: 'tourist-speakeasy',
        speaker: 'TOURIST',
        text: 'The secret speakeasy sounds amazing!',
        audioUrl: 'voice-demo-audio/tourist-speakeasy.mp3'
      },
      {
        id: 'agent-speakeasy-final',
        speaker: 'AGENT',
        text: "Perfect! It's called 'The Back Room' and you enter through a toy store - just like the prohibition era! They serve authentic 1920s cocktails in teacups and brown paper bags. I'll guide you there and share the secret password. Plus, I know the best time to visit when it's not crowded. Ready to discover New York's hidden side?",
        audioUrl: 'voice-demo-audio/agent-speakeasy-final.mp3'
      }
    ],
    isEnd: true
  },
  garden: {
    id: 'garden',
    lines: [
      {
        id: 'tourist-garden',
        speaker: 'TOURIST',
        text: 'I love peaceful spots - show me the garden',
        audioUrl: 'voice-demo-audio/tourist-garden.mp3'
      },
      {
        id: 'agent-garden-final',
        speaker: 'AGENT',
        text: "It's called the High Line - an elevated park built on old railway tracks. You'll walk among wildflowers with incredible views of the Hudson River and city skyline. There are art installations and cozy seating areas where you can watch the sunset. I can show you the best entrance and the most Instagram-worthy spots. Shall we head there now?",
        audioUrl: 'voice-demo-audio/agent-garden-final.mp3'
      }
    ],
    isEnd: true
  }
};

interface PreRenderedVoiceDemoProps {
  onComplete: () => void;
}

export const PreRenderedVoiceDemo = ({ onComplete }: PreRenderedVoiceDemoProps) => {
  const [currentStep, setCurrentStep] = useState<string>('intro');
  const [displayedLines, setDisplayedLines] = useState<DialogueLine[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Use refs to track audio instances and prevent race conditions
  const audioInstancesRef = useRef<Set<HTMLAudioElement>>(new Set());
  const currentStepRef = useRef<string>('intro');
  const isPlayingRef = useRef<boolean>(false);

  const step = DIALOGUE_SCRIPT[currentStep];

  // Cleanup function to stop all audio instances
  const cleanupAllAudio = useCallback(() => {
    console.log('🧹 Cleaning up all audio instances:', audioInstancesRef.current.size);
    audioInstancesRef.current.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.removeEventListener('ended', () => {});
        audio.removeEventListener('error', () => {});
      } catch (error) {
        console.warn('Error cleaning up audio:', error);
      }
    });
    audioInstancesRef.current.clear();
    setIsPlaying(false);
    setIsThinking(false);
    isPlayingRef.current = false;
  }, []);

  // Update refs when state changes
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    // Cleanup and reset when step changes
    console.log('🔄 Step changed to:', currentStep);
    cleanupAllAudio();
    setDisplayedLines([]);
    
    // Add small delay to prevent overlap
    const timer = setTimeout(() => {
      if (currentStepRef.current === currentStep) {
        playStepLines();
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanupAllAudio();
    };
  }, [currentStep, cleanupAllAudio]);

  const playStepLines = useCallback(async () => {
    // Prevent multiple simultaneous playbacks
    if (!step || isPlayingRef.current) {
      console.log('🚫 Playback blocked - step:', !!step, 'isPlaying:', isPlayingRef.current);
      return;
    }
    
    console.log('🎵 Starting playback for step:', currentStep);
    setIsPlaying(true);
    isPlayingRef.current = true;
    
    try {
      for (let i = 0; i < step.lines.length; i++) {
        // Check if we should continue (step hasn't changed)
        if (currentStepRef.current !== currentStep) {
          break;
        }
        
        const line = step.lines[i];
        
        // Add thinking animation before AI responses
        if (line.speaker === 'AGENT' && i > 0) {
          setIsThinking(true);
          await new Promise(resolve => setTimeout(resolve, 1200));
          setIsThinking(false);
          
          // Check again after thinking delay
          if (currentStepRef.current !== currentStep) break;
        }
        
        // Display the text
        setDisplayedLines(prev => [...prev, line]);
        
        // Play the audio
        try {
          await playAudio(line.audioUrl);
        } catch (error) {
          console.log('🔊 Audio playback failed:', error);
          // Continue without audio if file doesn't exist
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Check if we should continue
        if (currentStepRef.current !== currentStep) break;
        
        // Short pause between lines
        if (i < step.lines.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
    } catch (error) {
      console.error('❌ Error in playStepLines:', error);
    } finally {
      setIsPlaying(false);
      setIsThinking(false);
      isPlayingRef.current = false;
      console.log('✅ Playback completed for step:', currentStep);
    }
  }, [step, currentStep]);

  const playAudio = useCallback((audioUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('🎧 Creating audio for:', audioUrl);
      
      // Clean up any existing audio before creating new one
      cleanupAllAudio();
      
      const audio = new Audio(`https://ejqgdmbuabrcjxbhpxup.supabase.co/storage/v1/object/public/${audioUrl}`);
      
      // Add to tracking set
      audioInstancesRef.current.add(audio);
      
      // Set up event handlers before adding to DOM
      const handleEnded = () => {
        console.log('🔚 Audio ended:', audioUrl);
        audioInstancesRef.current.delete(audio);
        resolve();
      };
      
      const handleError = (error: any) => {
        console.log('🚫 Audio file not found:', audioUrl, error);
        audioInstancesRef.current.delete(audio);
        reject(new Error('Audio file not found'));
      };
      
      const handleLoadStart = () => {
        console.log('📥 Audio loading started:', audioUrl);
      };
      
      const handleCanPlay = () => {
        console.log('▶️ Audio ready to play:', audioUrl);
      };
      
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('canplay', handleCanPlay);
      
      // Set volume and preload
      audio.volume = 0.8;
      audio.preload = 'auto';
      
      // Start playback
      audio.play()
        .then(() => {
          console.log('✅ Audio playing:', audioUrl);
        })
        .catch((playError) => {
          console.error('❌ Audio play failed:', audioUrl, playError);
          audioInstancesRef.current.delete(audio);
          reject(playError);
        });
    });
  }, [cleanupAllAudio]);

  const handleChoice = useCallback((choiceId: string) => {
    if (isPlayingRef.current) {
      console.log('🚫 Choice blocked - audio is playing');
      return;
    }
    console.log('👆 Choice selected:', choiceId);
    setCurrentStep(choiceId);
  }, []);

  const stopDemo = useCallback(() => {
    cleanupAllAudio();
    onComplete();
  }, [cleanupAllAudio, onComplete]);

  return (
    <Card className="w-full max-w-2xl mx-auto p-6 bg-gradient-to-br from-background via-background to-background/80 border-2 border-primary/20">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">AI Tour Guide Demo</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={stopDemo}
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
          >
            <Square className="h-3 w-3 mr-1" />
            Stop Demo
          </Button>
        </div>

        {/* Chat Messages */}
        <div className="space-y-3 min-h-[300px] max-h-[400px] overflow-y-auto">
          {displayedLines.map((line, index) => (
            <div
              key={`${line.id}-${index}`}
              className={`flex ${line.speaker === 'AGENT' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  line.speaker === 'AGENT'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                <div className="text-xs opacity-70 mb-1">
                  {line.speaker === 'AGENT' ? '🤖 Alexis' : '👤 You'}
                </div>
                <div className="text-sm">{line.text}</div>
              </div>
            </div>
          ))}
          
          {/* Thinking animation */}
          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]">
                <div className="text-xs opacity-70 mb-1">🤖 Alexis</div>
                <div className="flex items-center gap-1">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0ms]"></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:150ms]"></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:300ms]"></div>
                  </div>
                  <span className="text-xs ml-2">thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Choice Buttons */}
        {step.choices && !isPlaying && !isThinking && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground text-center">Choose your response:</div>
            <div className="flex flex-col gap-2">
              {step.choices.map((choice) => (
                <Button
                  key={choice.id}
                  variant="outline"
                  onClick={() => handleChoice(choice.id)}
                  className="justify-start text-left h-auto p-3 hover:bg-secondary/80 transition-all duration-200"
                  disabled={isPlaying || isThinking}
                >
                  {choice.displayText}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* End of Demo */}
        {step.isEnd && !isPlaying && (
          <div className="text-center space-y-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              ✨ Demo completed! Experience the full AI tour guide with your own personalized adventures.
            </div>
            <Button
              onClick={onComplete}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground"
            >
              Start Your Real Adventure
            </Button>
          </div>
        )}

        {/* Loading State */}
        {(isPlaying || isInitializing) && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
            {isInitializing ? 'Initializing demo...' : 'Playing demo...'}
          </div>
        )}

        {/* Debug Info (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground/50 text-center">
            Step: {currentStep} | Playing: {isPlaying.toString()} | Audio Instances: {audioInstancesRef.current.size}
          </div>
        )}
      </div>
    </Card>
  );
};