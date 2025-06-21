
import React from 'react';
import { Button } from '@/components/ui/button';
import { Volume2 } from 'lucide-react';

interface CarouselControlsProps {
  currentSlide: number;
  totalSlides: number;
  onSlideSelect: (index: number) => void;
}

const CarouselControls: React.FC<CarouselControlsProps> = ({
  currentSlide,
  totalSlides,
  onSlideSelect,
}) => {
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
        disabled={totalSlides === 0}
      >
        <Volume2 className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default CarouselControls;
