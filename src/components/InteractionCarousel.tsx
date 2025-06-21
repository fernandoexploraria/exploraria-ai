import React, { useEffect } from 'react';
import { useInteractionCarouselLogic } from './InteractionCarouselLogic';
import InteractionCarouselHeader from './InteractionCarouselHeader';
import InteractionCarouselContent from './InteractionCarouselContent';
import { useAuth } from './AuthProvider';
import { useTTSContext } from '@/contexts/TTSContext';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

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
  const { user } = useAuth();
  const { stop } = useTTSContext();
  
  const {
    searchQuery,
    setSearchQuery,
    interactions,
    searchResults,
    isLoading,
    isSearching,
    showingSearchResults,
    loadAllInteractions,
    handleSearch,
    handleBackToHistory,
    toggleFavorite
  } = useInteractionCarouselLogic();

  // Load all interactions on mount
  useEffect(() => {
    if (open && user) {
      loadAllInteractions();
    }
  }, [open, user]);

  // Stop audio when carousel is closed
  useEffect(() => {
    if (!open) {
      console.log('Interaction carousel closed - stopping audio');
      stop();
    }
  }, [open, stop]);

  const handleLocationClick = (coordinates: any) => {
    if (coordinates && onLocationSelect) {
      const coordsArray = coordinates.toString().replace(/[()]/g, '').split(',');
      if (coordsArray.length === 2) {
        const lng = parseFloat(coordsArray[0]);
        const lat = parseFloat(coordsArray[1]);
        onLocationSelect([lng, lat]);
        // Keep the drawer open but minimize it by setting a smaller snap point
        // The drawer will automatically minimize when the user interacts with the map
      }
    }
  };

  const currentInteractions = showingSearchResults ? searchResults : interactions;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="sr-only">
            {showingSearchResults ? 'Search Results' : 'Interaction History'}
          </DrawerTitle>
          <InteractionCarouselHeader
            onClose={() => onOpenChange(false)}
            showingSearchResults={showingSearchResults}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={handleSearch}
            isSearching={isSearching}
            onBackToHistory={handleBackToHistory}
          />
        </DrawerHeader>

        <InteractionCarouselContent
          isLoading={isLoading}
          currentInteractions={currentInteractions}
          showingSearchResults={showingSearchResults}
          onToggleFavorite={toggleFavorite}
          onLocationClick={handleLocationClick}
        />
      </DrawerContent>
    </Drawer>
  );
};

export default InteractionCarousel;
