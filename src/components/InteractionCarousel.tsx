
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
  
  // Controlled snap point state
  const [activeSnapPoint, setActiveSnapPoint] = useState(0.78);
  const snapPoints = [0.07, 0.78]; // Minimized (7%) and Expanded (78%)
  
  console.log('InteractionCarousel render - open:', open);
  console.log('Drawer should be visible:', open);
  console.log('Active snap point:', activeSnapPoint);
  
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
        
        // Automatically minimize drawer to 7% when showing location
        console.log('Minimizing drawer to 7% for map view');
        setActiveSnapPoint(0.07);
      }
    }
  };

  // Function to expand drawer back to full size
  const handleExpandDrawer = () => {
    console.log('Expanding drawer to 78%');
    setActiveSnapPoint(0.78);
  };

  const currentInteractions = showingSearchResults ? searchResults : interactions;

  return (
    <Drawer 
      open={open} 
      onOpenChange={onOpenChange}
      modal={false}
      snapPoints={snapPoints}
      activeSnapPoint={activeSnapPoint}
      onSnapChange={setActiveSnapPoint}
    >
      <DrawerContent className="h-screen flex flex-col bg-gray-900">
        <DrawerTitle className="sr-only">
          {showingSearchResults ? 'Search Results' : 'Interaction History'}
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          {showingSearchResults 
            ? 'Your search results for previous conversations' 
            : 'Your conversation history with the AI assistant'}
        </DrawerDescription>
        
        <InteractionCarouselHeader
          onClose={() => onOpenChange(false)}
          showingSearchResults={showingSearchResults}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={handleSearch}
          isSearching={isSearching}
          onBackToHistory={handleBackToHistory}
          isMinimized={activeSnapPoint === 0.07}
          onExpand={handleExpandDrawer}
        />

        <div className="flex-1 overflow-hidden">
          <InteractionCarouselContent
            isLoading={isLoading}
            currentInteractions={currentInteractions}
            showingSearchResults={showingSearchResults}
            onToggleFavorite={toggleFavorite}
            onLocationClick={handleLocationClick}
            isMinimized={activeSnapPoint === 0.07}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default InteractionCarousel;
