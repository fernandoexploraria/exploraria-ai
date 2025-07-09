import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getServiceIcon } from '@/utils/placeTypeIcons';

interface AutocompleteSuggestion {
  place_id: string;
  description: string;
  types: string[];
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface ProximityAutocompleteProps {
  placeholder?: string;
  onSuggestionSelect: (suggestion: AutocompleteSuggestion) => void;
  locationBias?: {
    circle: {
      center: {
        latitude: number;
        longitude: number;
      };
      radius: number;
    };
  };
  serviceTypes?: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const ProximityAutocomplete: React.FC<ProximityAutocompleteProps> = ({
  placeholder = "Search nearby services...",
  onSuggestionSelect,
  locationBias,
  serviceTypes = ['restaurant', 'cafe', 'shopping_mall', 'subway_station', 'public_bathroom'],
  value,
  onChange,
  className = ""
}) => {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [sessionToken] = useState(`proximity-search-${Date.now()}`);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debounced search function
  const debouncedSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: {
          input: query,
          types: serviceTypes,
          sessionToken,
          locationBias
        }
      });

      if (error) throw error;

      if (data?.predictions) {
        const formattedSuggestions: AutocompleteSuggestion[] = data.predictions.map((prediction: any) => ({
          place_id: prediction.place_id,
          description: prediction.description,
          types: prediction.types || [],
          structured_formatting: prediction.structured_formatting || {
            main_text: prediction.description,
            secondary_text: ''
          }
        }));

        setSuggestions(formattedSuggestions);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      }
    } catch (error) {
      console.error('Autocomplete search error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  }, [serviceTypes, sessionToken, locationBias]);

  // Handle input changes with debouncing
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      debouncedSearch(value);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, debouncedSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: AutocompleteSuggestion) => {
    onChange(suggestion.description);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    onSuggestionSelect(suggestion);
  };

  // Get service type for badge display
  const getServiceType = (types: string[]): string => {
    const typeMap: { [key: string]: string } = {
      'restaurant': 'Restaurant',
      'cafe': 'Cafe',
      'shopping_mall': 'Shopping',
      'subway_station': 'Transit',
      'public_bathroom': 'Facilities'
    };

    for (const type of types) {
      if (typeMap[type]) return typeMap[type];
    }
    
    // Fallback logic for common types
    if (types.includes('food') || types.includes('meal_takeaway')) return 'Restaurant';
    if (types.includes('coffee_shop')) return 'Cafe';
    if (types.includes('store')) return 'Shopping';
    if (types.includes('transit_station')) return 'Transit';
    
    return 'Place';
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className="pl-7 h-7 text-xs"
        />
        {isLoading && (
          <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-600 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto animate-fade-in"
        >
          {suggestions.map((suggestion, index) => {
            const IconComponent = getServiceIcon(suggestion.types);
            return (
              <button
                key={suggestion.place_id}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-700 border-b border-gray-600 last:border-b-0 transition-colors ${
                  index === selectedIndex ? 'bg-gray-700 border-gray-500' : ''
                }`}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <IconComponent className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate text-white">
                        {suggestion.structured_formatting?.main_text || suggestion.description}
                      </span>
                      <Badge variant="secondary" className="text-xs px-1 py-0 shrink-0">
                        {getServiceType(suggestion.types)}
                      </Badge>
                    </div>
                    {suggestion.structured_formatting?.secondary_text && (
                      <p className="text-gray-400 text-xs truncate">
                        {suggestion.structured_formatting.secondary_text}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProximityAutocomplete;
