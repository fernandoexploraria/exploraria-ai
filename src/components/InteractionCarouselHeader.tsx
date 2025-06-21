
import React from 'react';
import { Button } from '@/components/ui/button';
import InteractionSearch from './InteractionSearch';

interface InteractionCarouselHeaderProps {
  onClose: () => void;
  showingSearchResults: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  onBackToHistory: () => void;
}

const InteractionCarouselHeader: React.FC<InteractionCarouselHeaderProps> = ({
  onClose,
  showingSearchResults,
  searchQuery,
  setSearchQuery,
  onSearch,
  isSearching,
  onBackToHistory,
}) => {
  return (
    <div className="bg-gray-900 border-b border-gray-700 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={onClose}
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
          onSearch={onSearch}
          isSearching={isSearching}
          showingSearchResults={showingSearchResults}
          onBackToHistory={onBackToHistory}
        />
      </div>
    </div>
  );
};

export default InteractionCarouselHeader;
