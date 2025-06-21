
import React from 'react';
import { Button } from '@/components/ui/button';
import { Volume2 } from 'lucide-react';
import { useTTS } from '@/hooks/useTTS';
import { Interaction } from './InteractionCarouselLogic';

interface CarouselControlsProps {
  currentSlide: number;
  totalSlides: number;
  onSlideSelect: (index: number) => void;
  currentInteraction?: Interaction;
}

const CarouselControls: React.FC<CarouselControlsProps> = ({
  currentSlide,
  totalSlides,
  onSlideSelect,
  currentInteraction,
}) => {
  const { speak, isPlaying } = useTTS();

  const handleSpeakerClick = () => {
    if (!currentInteraction) return;

    let textToSpeak = '';
    let isMemoryNarration = false;

    if (currentInteraction.interaction_type === 'voice') {
      // For voice interactions, create a memory narration from the transcript
      const transcript = currentInteraction.full_transcript;
      if (transcript && Array.isArray(transcript)) {
        const conversationText = transcript
          .filter((entry: any) => entry.message && (entry.role === 'user' || entry.role === 'agent'))
          .map((entry: any) => `${entry.role === 'user' ? 'You said' : 'The assistant replied'}: ${entry.message}`)
          .join('. ');
        textToSpeak = conversationText;
        isMemoryNarration = true;
      } else {
        textToSpeak = `You asked: ${currentInteraction.user_input}. The assistant replied: ${currentInteraction.assistant_response}`;
        isMemoryNarration = true;
      }
    } else {
      // For image_recognition and map_marker, use regular TTS
      textToSpeak = currentInteraction.assistant_response;
      isMemoryNarration = false;
    }

    speak(textToSpeak, isMemoryNarration);
  };

  return (
    <div className="flex flex-col items-center gap-3 mt-6">
      {/* Dots and counter */}
      <div className="flex items-center gap-4">
        {totalSlides > 1 && (
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSlides }, (_, index) => (
              <button
                key={index}
                onClick={() => onSlideSelect(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  index === currentSlide
                    ? 'bg-white scale-125'
                    : 'bg-gray-500 hover:bg-gray-400'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
            <span className="text-xs text-gray-400 ml-2">
              {currentSlide + 1} of {totalSlides}
            </span>
          </div>
        )}
        
        {totalSlides === 1 && (
          <span className="text-xs text-gray-400">
            1 of 1
          </span>
        )}
      </div>
      
      {/* Speaker button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 border-none bg-transparent hover:bg-white/10 text-white"
        disabled={totalSlides === 0 || !currentInteraction}
        onClick={handleSpeakerClick}
      >
        <Volume2 
          className="w-4 h-4" 
          style={{ color: isPlaying ? '#10b981' : 'currentColor' }}
        />
      </Button>
    </div>
  );
};

export default CarouselControls;
