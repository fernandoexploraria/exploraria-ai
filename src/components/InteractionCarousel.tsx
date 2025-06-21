
import React, { useEffect, useState } from 'react';
import { useInteractionCarouselLogic } from './InteractionCarouselLogic';
import InteractionCarouselHeader from './InteractionCarouselHeader';
import InteractionCarouselContent from './InteractionCarouselContent';
import { useAuth } from './AuthProvider';
import { useTTSContext } from '@/contexts/TTSContext';
import { useDrawerHelp } from '@/utils/askGeminiForDrawerHelp';
import { Button } from '@/components/ui/button';
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
  const { askForDrawerHelp, isLoading: geminiLoading } = useDrawerHelp();
  const [geminiResponse, setGeminiResponse] = useState<string>('');
  
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

  const handleAskGemini = async () => {
    const response = await askForDrawerHelp();
    if (response) {
      setGeminiResponse(response);
    }
  };

  const currentInteractions = showingSearchResults ? searchResults : interactions;

  return (
    <div>
      {/* Gemini Help Section */}
      <div className="fixed top-4 left-4 z-[200] bg-white p-4 rounded-lg shadow-lg max-w-md">
        <h3 className="font-semibold mb-2">Ask Gemini for Drawer Help</h3>
        <Button 
          onClick={handleAskGemini} 
          disabled={geminiLoading}
          className="mb-2"
        >
          {geminiLoading ? 'Asking Gemini...' : 'Get Drawer Help'}
        </Button>
        {geminiResponse && (
          <div className="text-sm bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
            <strong>Gemini says:</strong>
            <div className="mt-1 whitespace-pre-wrap">{geminiResponse}</div>
          </div>
        )}
      </div>

      <Drawer 
        open={open} 
        onOpenChange={onOpenChange}
        modal={true}
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
          />

          <div className="flex-1 overflow-hidden">
            <InteractionCarouselContent
              isLoading={isLoading}
              currentInteractions={currentInteractions}
              showingSearchResults={showingSearchResults}
              onToggleFavorite={toggleFavorite}
              onLocationClick={handleLocationClick}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default InteractionCarousel;
