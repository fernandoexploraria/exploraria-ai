
import React, { useEffect } from 'react';
import { useInteractionCarouselLogic } from './InteractionCarouselLogic';
import InteractionCarouselHeader from './InteractionCarouselHeader';
import InteractionCarouselContent from './InteractionCarouselContent';
import { useAuth } from './AuthProvider';

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

  if (!open) return null;

  const currentInteractions = showingSearchResults ? searchResults : interactions;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col">
      <InteractionCarouselHeader
        onClose={() => onOpenChange(false)}
        showingSearchResults={showingSearchResults}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        isSearching={isSearching}
        onBackToHistory={handleBackToHistory}
      />

      <InteractionCarouselContent
        isLoading={isLoading}
        currentInteractions={currentInteractions}
        showingSearchResults={showingSearchResults}
        onToggleFavorite={toggleFavorite}
        onLocationClick={handleLocationClick}
        isPlaying={false}
        stopAllTTSPlayback={() => {}}
      />
    </div>
  );
};

export default InteractionCarousel;
