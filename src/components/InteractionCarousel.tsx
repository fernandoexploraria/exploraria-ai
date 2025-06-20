import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from '@/components/ui/carousel';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthProvider';
import { useTTSManager } from '@/hooks/useTTSManager';
import InteractionSearch from './InteractionSearch';
import InteractionCard from './InteractionCard';
import CarouselControls from './CarouselControls';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  is_favorite: boolean;
  created_at: string;
  interaction_type: string;
  landmark_coordinates: any;
  landmark_image_url: string | null;
  full_transcript: any;
  similarity?: number;
}

interface InteractionCarouselProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect?: (coordinates: [number, number]) => void;
}

const InteractionCarousel: React.FC<InteractionCarouselProps> = ({ 
  open, 
  onOpenChange,
  onLocationSelect 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [searchResults, setSearchResults] = useState<Interaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showingSearchResults, setShowingSearchResults] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { isPlaying, playingCardIndex, stopAllTTSPlayback, playTTS } = useTTSManager();

  // Stop TTS when dialog is closed
  useEffect(() => {
    if (!open && isPlaying) {
      stopAllTTSPlayback();
    }
  }, [open, isPlaying, stopAllTTSPlayback]);

  // Load all interactions on mount
  useEffect(() => {
    if (open && user) {
      loadAllInteractions();
    }
  }, [open, user]);

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

  const loadAllInteractions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading interactions:', error);
        toast({
          title: "Failed to load history",
          description: "Could not retrieve your interaction history.",
          variant: "destructive"
        });
        return;
      }

      setInteractions(data || []);
    } catch (error) {
      console.error('Error loading interactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to search your conversations.",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      console.log('Starting search with query:', searchQuery);

      // Try vector search first
      try {
        const { data, error } = await supabase.functions.invoke('search-interactions', {
          body: { query: searchQuery }
        });

        if (error) {
          console.error('Vector search error:', error);
          throw error;
        }

        if (data && data.results) {
          console.log('Vector search results:', data.results);
          setSearchResults(data.results);
          setShowingSearchResults(true);
          
          if (data.results.length === 0) {
            toast({
              title: "No results found",
              description: "Try searching with different keywords.",
            });
          }
          return;
        }
      } catch (vectorError) {
        console.log('Vector search not available, falling back to text search:', vectorError);
      }

      // Fallback to text search
      const { data: textResults, error: searchError } = await supabase
        .from('interactions')
        .select('*')
        .or(`user_input.ilike.%${searchQuery}%,assistant_response.ilike.%${searchQuery}%,destination.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (searchError) {
        console.error('Text search error:', searchError);
        toast({
          title: "Search failed",
          description: "There was an error searching your conversations.",
          variant: "destructive"
        });
        return;
      }

      console.log('Text search results:', textResults);
      setSearchResults(textResults || []);
      setShowingSearchResults(true);
      
      if (!textResults || textResults.length === 0) {
        toast({
          title: "No results found",
          description: "Try searching with different keywords.",
        });
      }

    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: "There was an error searching your conversations.",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleBackToHistory = () => {
    setShowingSearchResults(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  const toggleFavorite = async (interaction: Interaction) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to update favorites.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('interactions')
        .update({ is_favorite: !interaction.is_favorite })
        .eq('id', interaction.id);

      if (error) {
        console.error('Error updating favorite:', error);
        toast({
          title: "Update failed",
          description: "Could not update favorite status.",
          variant: "destructive"
        });
        return;
      }

      const updateInteraction = (item: Interaction) => 
        item.id === interaction.id 
          ? { ...item, is_favorite: !item.is_favorite }
          : item;

      setInteractions(prev => prev.map(updateInteraction));
      if (showingSearchResults) {
        setSearchResults(prev => prev.map(updateInteraction));
      }

      toast({
        title: interaction.is_favorite ? "Removed from favorites" : "Added to favorites",
        description: "Conversation updated successfully.",
      });
    } catch (error) {
      console.error('Error updating favorite:', error);
      toast({
        title: "Update failed",
        description: "Could not update favorite status.",
        variant: "destructive"
      });
    }
  };

  const handleLocationClick = (coordinates: any) => {
    if (coordinates && onLocationSelect) {
      const coordsArray = coordinates.toString().replace(/[()]/g, '').split(',');
      if (coordsArray.length === 2) {
        const lng = parseFloat(coordsArray[0]);
        const lat = parseFloat(coordsArray[1]);
        onLocationSelect([lng, lat]);
        onOpenChange(false);
      }
    }
  };

  const handleTTSClick = async () => {
    const currentInteractions = showingSearchResults ? searchResults : interactions;
    const currentInteraction = currentInteractions[currentSlide];
    
    if (!currentInteraction) return;

    await playTTS(currentInteraction, currentSlide);
  };

  const scrollToSlide = (index: number) => {
    if (carouselApi) {
      carouselApi.scrollTo(index);
    }
  };

  if (!open) return null;

  const currentInteractions = showingSearchResults ? searchResults : interactions;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white hover:text-gray-300"
            >
              ← Close
            </Button>
            <h2 className="text-xl font-semibold text-white">
              {showingSearchResults ? 'Search Results' : 'Interaction History'}
            </h2>
          </div>
          
          <InteractionSearch
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={handleSearch}
            isSearching={isSearching}
            showingSearchResults={showingSearchResults}
            onBackToHistory={handleBackToHistory}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {isLoading ? (
          <div className="text-white">Loading your interactions...</div>
        ) : currentInteractions.length > 0 ? (
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
                      onToggleFavorite={toggleFavorite}
                      onLocationClick={handleLocationClick}
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
              isPlaying={isPlaying}
              onSlideSelect={scrollToSlide}
              onTTSClick={handleTTSClick}
            />
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default InteractionCarousel;
