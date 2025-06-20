
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeft } from 'lucide-react';

interface InteractionSearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  showingSearchResults: boolean;
  onBackToHistory: () => void;
}

const InteractionSearch: React.FC<InteractionSearchProps> = ({
  searchQuery,
  setSearchQuery,
  onSearch,
  isSearching,
  showingSearchResults,
  onBackToHistory,
}) => {
  return (
    <div className="flex gap-2">
      {showingSearchResults && (
        <Button
          variant="outline"
          onClick={onBackToHistory}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to History
        </Button>
      )}
      <div className="flex-1 flex gap-2">
        <Input
          placeholder="Search your previous interactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onSearch()}
          className="flex-1 bg-gray-800 border-gray-600 text-white"
        />
        <Button onClick={onSearch} disabled={isSearching || !searchQuery.trim()}>
          <Search className="w-4 h-4 mr-2" />
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </div>
    </div>
  );
};

export default InteractionSearch;
