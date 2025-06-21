
import React from 'react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import InteractionSearch from './InteractionSearch';
import { X, Star } from 'lucide-react';

interface InteractionCarouselHeaderProps {
  onClose: () => void;
  showingSearchResults: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  onBackToHistory: () => void;
  showFavoritesOnly: boolean;
  onToggleFavoritesFilter: (show: boolean) => void;
}

const InteractionCarouselHeader: React.FC<InteractionCarouselHeaderProps> = ({
  onClose,
  showingSearchResults,
  searchQuery,
  setSearchQuery,
  onSearch,
  isSearching,
  onBackToHistory,
  showFavoritesOnly,
  onToggleFavoritesFilter,
}) => {
  return (
    <div className="bg-gray-900 border-b border-gray-700 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            {showingSearchResults ? 'Search Results' : 'Interaction History'}
            {showFavoritesOnly && !showingSearchResults && (
              <span className="text-sm text-yellow-400 ml-2">(Favorites Only)</span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {!showingSearchResults && (
              <Toggle
                pressed={showFavoritesOnly}
                onPressedChange={onToggleFavoritesFilter}
                className="text-white data-[state=on]:bg-yellow-500/20 data-[state=on]:text-yellow-400"
                size="sm"
              >
                <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              </Toggle>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
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
