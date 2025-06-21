
import React, { useState, useEffect } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from '@/components/ui/carousel';
import { Search } from 'lucide-react';
import InteractionCard from './InteractionCard';
import CarouselControls from './CarouselControls';
import { Interaction } from './InteractionCarouselLogic';

interface InteractionCarouselContentProps {
  isLoading: boolean;
  currentInteractions: Interaction[];
  showingSearchResults: boolean;
  onToggleFavorite: (interaction: Interaction) => void;
  onLocationClick: (coordinates: any) => void;
}

const InteractionCarouselContent: React.FC<InteractionCarouselContentProps> = ({
  isLoading,
  currentInteractions,
  showingSearchResults,
  onToggleFavorite,
  onLocationClick,
}) => {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Handle carousel slide changes
  useEffect(() => {
    if (!carouselApi) return;

    const updateCurrentSlide = () => {
      const newSlide = carouselApi.selectedScrollSnap();
      setCurrentSlide(newSlide);
    };

    carouselApi.on("select", updateCurrentSlide);
    updateCurrentSlide();

    return () => {
      carouselApi.off("select", updateCurrentSlide);
    };
  }, [carouselApi, currentSlide]);

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

  const currentInteraction = currentInteractions[currentSlide];

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
                  isCurrentlyPlaying={false}
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
          onSlideSelect={scrollToSlide}
          currentInteraction={currentInteraction}
        />
      </div>
    </div>
  );
};

export default InteractionCarouselContent;
