
import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Landmark } from '@/data/landmarks';

interface SearchControlProps {
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
}

const SearchControl: React.FC<SearchControlProps> = ({ landmarks, onSelectLandmark }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLandmarks = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    return landmarks.filter(landmark =>
      landmark.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (landmark.description && landmark.description.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 5); // Limit to 5 results
  }, [landmarks, searchTerm]);

  const handleLandmarkSelect = (landmark: Landmark) => {
    // Set a flag to indicate this is from search
    const landmarkWithFlag = { ...landmark, fromSearch: true };
    onSelectLandmark(landmarkWithFlag);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsOpen(value.trim().length > 0);
  };

  const handleClear = () => {
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Search landmarks..."
          value={searchTerm}
          onChange={handleInputChange}
          className="pl-10 pr-10 bg-white/90 backdrop-blur-sm border-gray-200"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {isOpen && filteredLandmarks.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 z-50 max-h-64 overflow-y-auto">
          {filteredLandmarks.map((landmark) => (
            <button
              key={landmark.id}
              onClick={() => handleLandmarkSelect(landmark)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="font-medium text-gray-900 text-sm">{landmark.name}</div>
              {landmark.description && (
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {landmark.description.substring(0, 100)}...
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default SearchControl;
