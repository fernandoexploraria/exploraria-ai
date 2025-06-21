
import React from 'react';
import { Button } from '@/components/ui/button';
import InteractionSearch from './InteractionSearch';
import { X, ChevronUp } from 'lucide-react';

interface InteractionCarouselHeaderProps {
  onClose: () => void;
  showingSearchResults: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  onBackToHistory: () => void;
  isMinimized?: boolean;
  onExpand?: () => void;
}

const InteractionCarouselHeader: React.FC<InteractionCarouselHeaderProps> = ({
  onClose,
  showingSearchResults,
  searchQuery,
  setSearchQuery,
  onSearch,
  isSearching,
  onBackToHistory,
  isMinimized = false,
  onExpand,
}) => {
  if (isMinimized) {
    return (
      <div className="bg-gray-900 border-b border-gray-700 p-2">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">
                History
              </h2>
              {onExpand && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onExpand}
                  className="text-white hover:text-gray-300 h-6 w-6 p-0"
                  title="Expand drawer"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:text-gray-300 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border-b border-gray-700 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            {showingSearchResults ? 'Search Results' : 'Interaction History'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:text-gray-300"
          >
            <X className="h-4 w-4" />
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
    </div>
  );
};

export default InteractionCarouselHeader;
