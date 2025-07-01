
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from '@/components/ui/carousel';
import { Search, Star } from 'lucide-react';
import InteractionCard from './InteractionCard';
import CarouselControls from './CarouselControls';
import SkeletonLoader from './ui/skeleton-loader';
import { Interaction } from './InteractionCarouselLogic';
import { useTTSContext } from '@/contexts/TTSContext';

interface InteractionCarouselContentProps {
  isLoading: boolean;
  currentInteractions: Interaction[];
  showingSearchResults: boolean;
  onToggleFavorite: (interaction: Interaction) => void;
  onLocationClick: (coordinates: any) => void;
  showFavoritesOnly?: boolean;
}

const InteractionCarouselContent: React.FC<InteractionCarouselContentProps> = ({
  isLoading,
  currentInteractions,
  showingSearchResults,
  onToggleFavorite,
  onLocationClick,
  showFavoritesOnly = false,
}) => {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [visibleIndexes, setVisibleIndexes] = useState<Set<number>>(new Set([0, 1, 2]));
  const { stop, isPlaying, currentPlayingId } = useTTSContext();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  // Stable observer callback
  const observerCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      const indexAttr = entry.target.getAttribute('data-index');
      if (indexAttr) {
        const index = parseInt(indexAttr, 10);
        if (!isNaN(index) && entry.isIntersecting) {
          setVisibleIndexes(prev => new Set([...prev, index]));
        }
      }
    });
  }, []);

  // Stable ref callback for carousel items
  const setElementRef = useCallback((element: HTMLDivElement | null, index: number) => {
    if (element) {
      elementsRef.current.set(index, element);
      if (observerRef.current) {
        try {
          observerRef.current.observe(element);
        } catch (error) {
          console.warn('Failed to observe element:', error);
        }
      }
    } else {
      elementsRef.current.delete(index);
    }
  }, []);

  // Handle carousel slide changes - use useLayoutEffect to prevent timing issues
  useLayoutEffect(() => {
    if (!carouselApi) return;

    const handleSlideChange = () => {
      const selectedIndex = carouselApi.selectedScrollSnap();
      
      // Update visible indexes for lazy loading (current + adjacent items)
      const newVisibleIndexes = new Set<number>();
      for (let i = Math.max(0, selectedIndex - 1); i <= Math.min(currentInteractions.length - 1, selectedIndex + 2); i++) {
        newVisibleIndexes.add(i);
      }
      setVisibleIndexes(newVisibleIndexes);
      
      // If audio is playing, stop it
      if (isPlaying) {
        console.log('Stopping audio due to card movement');
        stop();
      }
      
      setCurrentSlide(selectedIndex);
    };

    // Listen for slide changes
    carouselApi.on("select", handleSlideChange);
    
    // Set initial slide and visible indexes
    const initialIndex = carouselApi.selectedScrollSnap();
    setCurrentSlide(initialIndex);
    const initialVisibleIndexes = new Set<number>();
    for (let i = Math.max(0, initialIndex - 1); i <= Math.min(currentInteractions.length - 1, initialIndex + 2); i++) {
      initialVisibleIndexes.add(i);
    }
    setVisibleIndexes(initialVisibleIndexes);

    return () => {
      try {
        carouselApi.off("select", handleSlideChange);
      } catch (error) {
        console.warn('Error removing carousel listener:', error);
      }
    };
  }, [carouselApi, stop, isPlaying, currentInteractions.length]);

  // Set up intersection observer with stable dependencies
  useEffect(() => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // Create new observer with stable callback
    observerRef.current = new IntersectionObserver(observerCallback, {
      rootMargin: '50px',
      threshold: 0.1
    });

    // Observe existing elements
    elementsRef.current.forEach((element) => {
      if (observerRef.current) {
        try {
          observerRef.current.observe(element);
        } catch (error) {
          console.warn('Failed to observe existing element:', error);
        }
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [observerCallback]);

  const scrollToSlide = useCallback((index: number) => {
    if (carouselApi) {
      console.log('Manually scrolling to slide:', index);
      carouselApi.scrollTo(index);
    }
  }, [carouselApi]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <SkeletonLoader variant="carousel" />
      </div>
    );
  }

  if (currentInteractions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-400">
          {showFavoritesOnly ? (
            <>
              <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No favorite interactions found.</p>
              <p className="text-sm">
                Mark interactions as favorites by clicking the star icon on any card.
              </p>
            </>
          ) : showingSearchResults ? (
            <>
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No interactions found matching your search.</p>
              <p className="text-sm">
                Try different keywords or check your spelling.
              </p>
            </>
          ) : (
            <>
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No interactions found.</p>
              <p className="text-sm">
                Start a conversation to see your history here.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const currentInteraction = currentInteractions[currentSlide];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2">
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
              <CarouselItem 
                key={interaction.id} 
                className="pl-2 md:pl-4 basis-4/5 md:basis-3/5 lg:basis-2/5"
                data-index={index}
                ref={(el) => setElementRef(el, index)}
              >
                <InteractionCard
                  interaction={interaction}
                  index={index}
                  isCurrentlyPlaying={currentPlayingId === interaction.id}
                  onToggleFavorite={onToggleFavorite}
                  onLocationClick={onLocationClick}
                  isVisible={visibleIndexes.has(index)}
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
