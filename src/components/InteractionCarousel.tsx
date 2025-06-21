
import React, { useEffect, useState } from 'react';
import { useInteractionCarouselLogic } from './InteractionCarouselLogic';
import InteractionCarouselHeader from './InteractionCarouselHeader';
import InteractionCarouselContent from './InteractionCarouselContent';
import { useAuth } from './AuthProvider';
import { useTTSContext } from '@/contexts/TTSContext';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History, X } from 'lucide-react';

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
  const [isMinimized, setIsMinimized] = useState(false);
  
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
      setIsMinimized(false);
    }
  }, [open, stop]);

  const handleLocationClick = (coordinates: any) => {
    if (coordinates && onLocationSelect) {
      const coordsArray = coordinates.toString().replace(/[()]/g, '').split(',');
      if (coordsArray.length === 2) {
        const lng = parseFloat(coordsArray[0]);
        const lat = parseFloat(coordsArray[1]);
        onLocationSelect([lng, lat]);
        // Minimize when location is selected
        setIsMinimized(true);
      }
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleExpand = () => {
    setIsMinimized(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setIsMinimized(false);
  };

  const currentInteractions = showingSearchResults ? searchResults : interactions;

  // Show floating button when minimized
  if (open && isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleExpand}
          className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
          size="icon"
        >
          <History className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open && !isMinimized} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold">
              {showingSearchResults ? 'Search Results' : 'Interaction History'}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMinimize}
                className="h-8 w-8 p-0"
              >
                <span className="text-xs">−</span>
                <span className="sr-only">Minimize</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          <div className="px-4 py-4 border-b">
            <InteractionCarouselHeader
              onClose={handleClose}
              showingSearchResults={showingSearchResults}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearch={handleSearch}
              isSearching={isSearching}
              onBackToHistory={handleBackToHistory}
            />
          </div>

          <div className="flex-1 overflow-hidden">
            <InteractionCarouselContent
              isLoading={isLoading}
              currentInteractions={currentInteractions}
              showingSearchResults={showingSearchResults}
              onToggleFavorite={toggleFavorite}
              onLocationClick={handleLocationClick}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InteractionCarousel;
