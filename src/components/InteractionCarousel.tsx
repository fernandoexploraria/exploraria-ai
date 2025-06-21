
import React, { useEffect, useState } from 'react';
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
  const [activeSnapPoint, setActiveSnapPoint] = useState<number>(0.85);
  
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

  // Reset to 85% when opening
  useEffect(() => {
    if (open) {
      setActiveSnapPoint(0.85);
    }
  }, [open]);

  const handleLocationClick = (coordinates: any) => {
    if (coordinates && onLocationSelect) {
      const coordsArray = coordinates.toString().replace(/[()]/g, '').split(',');
      if (coordsArray.length === 2) {
        const lng = parseFloat(coordsArray[0]);
        const lat = parseFloat(coordsArray[1]);
        onLocationSelect([lng, lat]);
        // Minimize to 15% when location is selected
        setActiveSnapPoint(0.15);
      }
    }
  };

  const currentInteractions = showingSearchResults ? searchResults : interactions;

  return (
    <Drawer 
      open={open} 
      onOpenChange={onOpenChange}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={setActiveSnapPoint}
    >
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
