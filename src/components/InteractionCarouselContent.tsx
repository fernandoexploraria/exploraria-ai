
import React, { useState, useEffect } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from '@/components/ui/carousel';
import { Search } from 'lucide-react';
import { useTTSManager } from '@/hooks/useTTSManager';
import InteractionCard from './InteractionCard';
import CarouselControls from './CarouselControls';
import { Interaction } from './InteractionCarouselLogic';

interface InteractionCarouselContentProps {
  isLoading: boolean;
  currentInteractions: Interaction[];
  showingSearchResults: boolean;
  onToggleFavorite: (interaction: Interaction) => void;
  onLocationClick: (coordinates: any) => void;
  isPlaying: boolean;
  stopAllTTSPlayback: () => void;
}

const InteractionCarouselContent: React.FC<InteractionCarouselContentProps> = ({
  isLoading,
  currentInteractions,
  showingSearchResults,
  onToggleFavorite,
  onLocationClick,
  isPlaying,
  stopAllTTSPlayback,
}) => {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const { playingCardIndex, playTTS } = useTTSManager();

  // Handle carousel slide changes and stop TTS on navigation
  useEffect(() => {
    if (!carouselApi) return;

    const updateCurrentSlide = () => {
      const newSlide = carouselApi.selectedScrollSnap();
      if (newSlide !== currentSlide) {
        stopAllTTSPlayback();
        setCurrentSlide(newSlide);
      }
    };

    carouselApi.on("select", updateCurrentSlide);
    updateCurrentSlide();

    return () => {
      carouselApi.off("select", updateCurrentSlide);
    };
  }, [carouselApi, currentSlide, stopAllTTSPlayback]);

  // Add swipe and navigation detection to stop TTS
  useEffect(() => {
    if (!carouselApi) return;

    let startX = 0;
    let startY = 0;
    const swipeThreshold = 10;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!startX || !startY) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      
      const diffX = Math.abs(currentX - startX);
      const diffY = Math.abs(currentY - startY);

      if (diffX > swipeThreshold && diffX > diffY) {
        stopAllTTSPlayback();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      startX = e.clientX;
      startY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!startX || !startY) return;
      if (e.buttons !== 1) return;

      const diffX = Math.abs(e.clientX - startX);
      const diffY = Math.abs(e.clientY - startY);

      if (diffX > swipeThreshold && diffX > diffY) {
        stopAllTTSPlayback();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        stopAllTTSPlayback();
      }
    };

    const carouselElement = carouselApi.rootNode();
    
    carouselElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    carouselElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    carouselElement.addEventListener('mousedown', handleMouseDown);
    carouselElement.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      carouselElement.removeEventListener('touchstart', handleTouchStart);
      carouselElement.removeEventListener('touchmove', handleTouchMove);
      carouselElement.removeEventListener('mousedown', handleMouseDown);
      carouselElement.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [carouselApi, stopAllTTSPlayback]);

  const handleTTSClick = async () => {
    const currentInteraction = currentInteractions[currentSlide];
    if (!currentInteraction) return;
    await playTTS(currentInteraction, currentSlide);
  };

  const scrollToSlide = (index: number) => {
    if (carouselApi) {
      carouselApi.scrollTo(index);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white">Loading your interactions...</div>
      </div>
    );
  }

  if (currentInteractions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>
            {showingSearchResults 
              ? "No interactions found matching your search." 
              : "No interactions found."}
          </p>
          <p className="text-sm">
            {showingSearchResults 
              ? "Try different keywords or check your spelling." 
              : "Start a conversation to see your history here."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-6xl flex flex-col items-center">
        <Carousel 
          className="w-full"
          setApi={setCarouselApi}
          opts={{
            align: "center",
            loop: false,
          }}
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {currentInteractions.map((interaction, index) => (
              <CarouselItem key={interaction.id} className="pl-2 md:pl-4 basis-4/5 md:basis-3/5 lg:basis-2/5">
                <InteractionCard
                  interaction={interaction}
                  index={index}
                  isCurrentlyPlaying={playingCardIndex === index}
                  onToggleFavorite={onToggleFavorite}
                  onLocationClick={onLocationClick}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex" />
          <CarouselNext className="hidden md:flex" />
        </Carousel>
        
        <CarouselControls
          currentSlide={currentSlide}
          totalSlides={currentInteractions.length}
          isPlaying={playingCardIndex === currentSlide && isPlaying}
          onSlideSelect={scrollToSlide}
          onTTSClick={handleTTSClick}
        />
      </div>
    </div>
  );
};

export default InteractionCarouselContent;
