
import React from 'react';
import { Button } from '@/components/ui/button';
import InteractionSearch from './InteractionSearch';
import { X } from 'lucide-react';

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
    <div className="px-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {showingSearchResults ? 'Search Results' : 'Interaction History'}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
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
  );
};

export default InteractionCarouselHeader;
