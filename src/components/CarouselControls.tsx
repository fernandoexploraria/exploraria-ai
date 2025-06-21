
import React from 'react';

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
    <div className="flex items-center gap-4 mt-6">
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
  );
};

export default CarouselControls;
