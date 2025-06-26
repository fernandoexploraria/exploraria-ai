
import React, { useEffect, useState } from 'react';
import { useInteractionCarouselLogic } from './InteractionCarouselLogic';
import InteractionCarouselHeader from './InteractionCarouselHeader';
import InteractionCarouselContent from './InteractionCarouselContent';
import { useAuth } from './AuthProvider';
import { useTTSContext } from '@/contexts/TTSContext';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"

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
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  console.log('InteractionCarousel render - open:', open);
  console.log('Drawer should be visible:', open);
  
  const {
    searchQuery,
    setSearchQuery,
    interactions,
    searchResults,
    isLoading,
    isSearching,
    showingSearchResults,
    currentLimit,
    isLoadingMore,
    loadAllInteractions,
    loadMoreInteractions,
    handleSearch,
    handleBackToHistory,
    toggleFavorite
  } = useInteractionCarouselLogic();

  // Load all interactions on mount
  useEffect(() => {
    if (open && user) {
      console.log('Loading interactions for user:', user.id);
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
        onOpenChange(false);
      }
    }
  };

  const handleToggleFavoritesFilter = (show: boolean) => {
    setShowFavoritesOnly(show);
  };

  // Filter interactions based on favorites toggle
  const getFilteredInteractions = () => {
    if (showingSearchResults) {
      return searchResults;
    }
    
    if (showFavoritesOnly) {
      return interactions.filter(interaction => interaction.is_favorite);
    }
    
    return interactions;
  };

  const currentInteractions = getFilteredInteractions();

  return (
    <Drawer 
      open={open} 
      onOpenChange={onOpenChange}
      modal={false}
    >
      <DrawerContent className="h-screen flex flex-col bg-gray-900">
        <DrawerTitle className="sr-only">
          {showingSearchResults ? 'Search Results' : 'Travel Log'}
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          {showingSearchResults 
            ? 'Your search results for previous conversations' 
            : 'Your travel conversation history with the AI assistant'}
        </DrawerDescription>
        
        <InteractionCarouselHeader
          onClose={() => onOpenChange(false)}
          showingSearchResults={showingSearchResults}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={handleSearch}
          isSearching={isSearching}
          onBackToHistory={handleBackToHistory}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavoritesFilter={handleToggleFavoritesFilter}
          currentCount={currentInteractions.length}
          currentLimit={currentLimit}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMoreInteractions}
        />

        <div className="flex-1 overflow-hidden">
          <InteractionCarouselContent
            isLoading={isLoading}
            currentInteractions={currentInteractions}
            showingSearchResults={showingSearchResults}
            onToggleFavorite={toggleFavorite}
            onLocationClick={handleLocationClick}
            showFavoritesOnly={showFavoritesOnly}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default InteractionCarousel;
