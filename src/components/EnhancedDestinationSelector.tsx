
import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Building2, TreePine, Camera, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PlacePrediction {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

interface EnhancedDestinationSelectorProps {
  onDestinationSelect: (destination: string, destinationDetails: any) => void;
  placeholder?: string;
  className?: string;
}

const EnhancedDestinationSelector: React.FC<EnhancedDestinationSelectorProps> = ({
  onDestinationSelect,
  placeholder = "Search for a destination...",
  className = ""
}) => {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const sessionToken = useRef(Math.random().toString(36).substring(2, 15));
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  const getPlaceTypeIcon = (types: string[]) => {
    if (types.includes('tourist_attraction') || types.includes('museum')) {
      return <Camera className="h-4 w-4 text-blue-500" />;
    }
    if (types.includes('park')) {
      return <TreePine className="h-4 w-4 text-green-500" />;
    }
    if (types.includes('locality') || types.includes('sublocality')) {
      return <MapPin className="h-4 w-4 text-red-500" />;
    }
    if (types.includes('establishment')) {
      return <Building2 className="h-4 w-4 text-gray-500" />;
    }
    return <Globe className="h-4 w-4 text-blue-400" />;
  };

  const getPlaceTypeLabel = (types: string[]) => {
    if (types.includes('tourist_attraction')) return 'Attraction';
    if (types.includes('museum')) return 'Museum';
    if (types.includes('park')) return 'Park';
    if (types.includes('locality')) return 'City';
    if (types.includes('sublocality')) return 'Area';
    if (types.includes('establishment')) return 'Place';
    return 'Location';
  };

  const fetchPredictions = async (input: string) => {
    if (input.length < 2) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: {
          input: input.trim(),
          sessionToken: sessionToken.current
        }
      });

      if (error) {
        console.error('Places autocomplete error:', error);
        toast.error('Failed to fetch location suggestions');
        return;
      }

      if (data?.predictions) {
        setPredictions(data.predictions);
        setShowSuggestions(true);
      }
    } catch (err) {
      console.error('Error fetching predictions:', err);
      toast.error('Failed to fetch location suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the API call
    debounceRef.current = setTimeout(() => {
      fetchPredictions(value);
    }, 300);
  };

  const handlePredictionSelect = async (prediction: PlacePrediction) => {
    console.log('Selected prediction:', prediction);
    
    setQuery(prediction.mainText);
    setShowSuggestions(false);
    setPredictions([]);

    // Prepare destination details for the tour generation
    const destinationDetails = {
      placeId: prediction.placeId,
      mainText: prediction.mainText,
      secondaryText: prediction.secondaryText,
      types: prediction.types,
      formattedAddress: prediction.text
    };

    // Try to get more detailed place information if needed
    try {
      const { data: placeDetails } = await supabase.functions.invoke('google-places-details', {
        body: {
          placeId: prediction.placeId,
          sessionToken: sessionToken.current
        }
      });

      if (placeDetails?.result?.geometry?.location) {
        destinationDetails.location = {
          latitude: placeDetails.result.geometry.location.lat,
          longitude: placeDetails.result.geometry.location.lng
        };
      }
    } catch (err) {
      console.warn('Could not fetch additional place details:', err);
      // Continue without location details
    }

    // Generate new session token for next search
    sessionToken.current = Math.random().toString(36).substring(2, 15);

    onDestinationSelect(prediction.mainText, destinationDetails);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handlePredictionSelect(predictions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          className="pl-10 pr-4 py-2 w-full"
          disabled={isLoading}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {showSuggestions && predictions.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-96 overflow-y-auto shadow-lg">
          <CardContent className="p-0">
            {predictions.map((prediction, index) => (
              <Button
                key={prediction.placeId}
                variant="ghost"
                className={`w-full justify-start p-3 h-auto text-left rounded-none ${
                  index === selectedIndex ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => handlePredictionSelect(prediction)}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="flex-shrink-0 mt-1">
                    {getPlaceTypeIcon(prediction.types)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        {prediction.mainText}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">
                        {getPlaceTypeLabel(prediction.types)}
                      </span>
                    </div>
                    {prediction.secondaryText && (
                      <p className="text-sm text-gray-500 truncate">
                        {prediction.secondaryText}
                      </p>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EnhancedDestinationSelector;
