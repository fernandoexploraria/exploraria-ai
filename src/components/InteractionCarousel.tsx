
import React, { useEffect, useState, useCallback, useMemo } from 'react';
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

  // Stabilize the load interactions function to prevent loops
  const stableLoadAllInteractions = useCallback(() => {
    if (user?.id) {
      console.log('Loading interactions for user:', user.id);
      loadAllInteractions();
    }
  }, [user?.id, loadAllInteractions]);

  // Load all interactions on mount - use stable reference
  useEffect(() => {
    if (open) {
      stableLoadAllInteractions();
    }
  }, [open, stableLoadAllInteractions]);

  // Stop audio when carousel is closed - use stable reference
  const handleStop = useCallback(() => {
    console.log('Interaction carousel closed - stopping audio');
    stop();
  }, [stop]);

  useEffect(() => {
    if (!open) {
      handleStop();
    }
  }, [open, handleStop]);

  // Stabilize location click handler
  const handleLocationClick = useCallback((coordinates: any) => {
    if (coordinates && onLocationSelect) {
      const coordsArray = coordinates.toString().replace(/[()]/g, '').split(',');
      if (coordsArray.length === 2) {
        const lng = parseFloat(coordsArray[0]);
        const lat = parseFloat(coordsArray[1]);
        onLocationSelect([lng, lat]);
        onOpenChange(false);
      }
    }
  }, [onLocationSelect, onOpenChange]);

  // Stabilize favorites toggle handler
  const handleToggleFavoritesFilter = useCallback((show: boolean) => {
    setShowFavoritesOnly(show);
  }, []);

  // Memoize filtered interactions to prevent unnecessary recalculations
  const currentInteractions = useMemo(() => {
    if (showingSearchResults) {
      return searchResults;
    }
    
    if (showFavoritesOnly) {
      return interactions.filter(interaction => interaction.is_favorite);
    }
    
    return interactions;
  }, [showingSearchResults, searchResults, showFavoritesOnly, interactions]);

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
