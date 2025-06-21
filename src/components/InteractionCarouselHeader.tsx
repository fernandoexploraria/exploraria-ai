
import React from 'react';
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
    <div className="space-y-4">
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
