
import React, { useEffect, useRef } from 'react';
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
  const drawerRef = useRef<HTMLDivElement>(null);
  
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
        onOpenChange(false);
      }
    }
  };

  // Function to minimize drawer to 7% using direct DOM manipulation
  const handleMinimizeDrawer = () => {
    console.log('=== Minimize Drawer Debug ===');
    console.log('Attempting to minimize drawer to 7%');
    
    // Try multiple approaches to minimize the drawer
    const drawerElement = document.querySelector('[data-vaul-drawer]');
    const drawerWrapper = document.querySelector('[data-vaul-drawer-wrapper]');
    const drawerContent = document.querySelector('[data-vaul-drawer-content]');
    
    console.log('Found drawer element:', !!drawerElement);
    console.log('Found drawer wrapper:', !!drawerWrapper);
    console.log('Found drawer content:', !!drawerContent);
    
    // Method 1: Try to use Vaul's internal API
    if (drawerElement && (drawerElement as any).snapTo) {
      console.log('Using Vaul snapTo method');
      (drawerElement as any).snapTo(0.07);
    } 
    // Method 2: Try to dispatch event on wrapper
    else if (drawerWrapper) {
      console.log('Dispatching snap event on wrapper');
      const snapEvent = new CustomEvent('snap', { 
        detail: { snapPoint: 0.07 },
        bubbles: true 
      });
      drawerWrapper.dispatchEvent(snapEvent);
    }
    // Method 3: Try direct style manipulation as fallback
    else if (drawerContent) {
      console.log('Using direct style manipulation');
      const windowHeight = window.innerHeight;
      const targetHeight = windowHeight * 0.07;
      (drawerContent as HTMLElement).style.height = `${targetHeight}px`;
      (drawerContent as HTMLElement).style.transform = `translate3d(0, ${windowHeight - targetHeight}px, 0)`;
    }
    
    console.log('=== End Minimize Debug ===');
  };

  const currentInteractions = showingSearchResults ? searchResults : interactions;

  return (
    <Drawer 
      open={open} 
      onOpenChange={onOpenChange}
      snapPoints={[0.07, 0.50, 0.78]}
      activeSnapPoint={0.78}
    >
      <DrawerContent ref={drawerRef} className="h-screen flex flex-col bg-gray-900">
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
        />

        <div className="flex-1 overflow-hidden">
          <InteractionCarouselContent
            isLoading={isLoading}
            currentInteractions={currentInteractions}
            showingSearchResults={showingSearchResults}
            onToggleFavorite={toggleFavorite}
            onLocationClick={handleLocationClick}
            onMinimizeDrawer={handleMinimizeDrawer}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default InteractionCarousel;
