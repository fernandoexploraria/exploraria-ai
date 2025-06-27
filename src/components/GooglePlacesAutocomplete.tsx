
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Building, Museum, TreePine, Landmark, Loader2 } from 'lucide-react';
import { usePlacesAutocomplete, PlacePrediction } from '@/hooks/usePlacesAutocomplete';

interface GooglePlacesAutocompleteProps {
  onPlaceSelect: (place: PlacePrediction) => void;
  placeholder?: string;
  label?: string;
}

const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
  onPlaceSelect,
  placeholder = "Search for a destination...",
  label = "Destination"
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const { 
    predictions, 
    isLoading, 
    error, 
    searchPlaces, 
    clearSearch,
    resetSession 
  } = usePlacesAutocomplete();

  // Initialize session when component mounts
  useEffect(() => {
    resetSession();
  }, [resetSession]);

  // Search when input changes
  useEffect(() => {
    if (inputValue.trim().length >= 2) {
      searchPlaces(inputValue);
      setShowDropdown(true);
    } else {
      clearSearch();
      setShowDropdown(false);
    }
  }, [inputValue, searchPlaces, clearSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handlePlaceSelect = (place: PlacePrediction) => {
    setInputValue(place.mainText);
    setShowDropdown(false);
    onPlaceSelect(place);
  };

  const handleInputFocus = () => {
    if (predictions.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding to allow click on predictions
    setTimeout(() => setShowDropdown(false), 200);
  };

  // Get icon for place type
  const getPlaceIcon = (types: string[]) => {
    if (types.includes('museum') || types.includes('art_gallery')) {
      return <Museum className="h-4 w-4 text-amber-600" />;
    }
    if (types.includes('park') || types.includes('botanical_garden')) {
      return <TreePine className="h-4 w-4 text-green-600" />;
    }
    if (types.includes('tourist_attraction') || types.includes('landmark') || types.includes('monument')) {
      return <Landmark className="h-4 w-4 text-purple-600" />;
    }
    if (types.includes('locality') || types.includes('administrative_area_level_1')) {
      return <Building className="h-4 w-4 text-blue-600" />;
    }
    return <MapPin className="h-4 w-4 text-gray-600" />;
  };

  return (
    <div className="relative space-y-2">
      <Label htmlFor="destination-search" className="flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        {label}
      </Label>
      
      <div className="relative">
        <Input
          id="destination-search"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className={error ? "border-red-500" : ""}
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((place) => (
            <div
              key={place.placeId}
              className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              onClick={() => handlePlaceSelect(place)}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getPlaceIcon(place.types)}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {place.mainText}
                </p>
                {place.secondaryText && (
                  <p className="text-xs text-gray-500 truncate">
                    {place.secondaryText}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showDropdown && !isLoading && predictions.length === 0 && inputValue.trim().length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
          <p className="text-sm text-gray-500">No destinations found</p>
        </div>
      )}
    </div>
  );
};

export default GooglePlacesAutocomplete;
