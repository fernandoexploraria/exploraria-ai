import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Star, StarOff, Calendar, MapPin, Volume2, ArrowLeft, Camera, Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthProvider';

interface Interaction {
  id: string;
  destination: string;
  user_input: string;
  assistant_response: string;
  is_favorite: boolean;
  created_at: string;
  interaction_type: string;
  landmark_coordinates: any;
  landmark_image_url: string | null;
  full_transcript: any;
  similarity?: number;
}

interface InteractionCarouselProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect?: (coordinates: [number, number]) => void;
}

const InteractionCarousel: React.FC<InteractionCarouselProps> = ({ 
  open, 
  onOpenChange,
  onLocationSelect 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [searchResults, setSearchResults] = useState<Interaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showingSearchResults, setShowingSearchResults] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load all interactions on mount
  useEffect(() => {
    if (open && user) {
      loadAllInteractions();
    }
  }, [open, user]);

  const loadAllInteractions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading interactions:', error);
        toast({
          title: "Failed to load history",
          description: "Could not retrieve your interaction history.",
          variant: "destructive"
        });
        return;
      }

      setInteractions(data || []);
    } catch (error) {
      console.error('Error loading interactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to search your conversations.",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      console.log('Starting search with query:', searchQuery);

      // Try vector search first
      try {
        const { data, error } = await supabase.functions.invoke('search-interactions', {
          body: { query: searchQuery }
        });

        if (error) {
          console.error('Vector search error:', error);
          throw error;
        }

        if (data && data.results) {
          console.log('Vector search results:', data.results);
          setSearchResults(data.results);
          setShowingSearchResults(true);
          
          if (data.results.length === 0) {
            toast({
              title: "No results found",
              description: "Try searching with different keywords.",
            });
          }
          return;
        }
      } catch (vectorError) {
        console.log('Vector search not available, falling back to text search:', vectorError);
      }

      // Fallback to text search
      const { data: textResults, error: searchError } = await supabase
        .from('interactions')
        .select('*')
        .or(`user_input.ilike.%${searchQuery}%,assistant_response.ilike.%${searchQuery}%,destination.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (searchError) {
        console.error('Text search error:', searchError);
        toast({
          title: "Search failed",
          description: "There was an error searching your conversations.",
          variant: "destructive"
        });
        return;
      }

      console.log('Text search results:', textResults);
      setSearchResults(textResults || []);
      setShowingSearchResults(true);
      
      if (!textResults || textResults.length === 0) {
        toast({
          title: "No results found",
          description: "Try searching with different keywords.",
        });
      }

    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: "There was an error searching your conversations.",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleBackToHistory = () => {
    setShowingSearchResults(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  const toggleFavorite = async (interaction: Interaction) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to update favorites.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('interactions')
        .update({ is_favorite: !interaction.is_favorite })
        .eq('id', interaction.id);

      if (error) {
        console.error('Error updating favorite:', error);
        toast({
          title: "Update failed",
          description: "Could not update favorite status.",
          variant: "destructive"
        });
        return;
      }

      // Update local state
      const updateInteraction = (item: Interaction) => 
        item.id === interaction.id 
          ? { ...item, is_favorite: !item.is_favorite }
          : item;

      setInteractions(prev => prev.map(updateInteraction));
      if (showingSearchResults) {
        setSearchResults(prev => prev.map(updateInteraction));
      }

      toast({
        title: interaction.is_favorite ? "Removed from favorites" : "Added to favorites",
        description: "Conversation updated successfully.",
      });
    } catch (error) {
      console.error('Error updating favorite:', error);
      toast({
        title: "Update failed",
        description: "Could not update favorite status.",
        variant: "destructive"
      });
    }
  };

  const handleLocationClick = (coordinates: any) => {
    if (coordinates && onLocationSelect) {
      // Convert PostgreSQL point format to [lng, lat]
      const coordsArray = coordinates.toString().replace(/[()]/g, '').split(',');
      if (coordsArray.length === 2) {
        const lng = parseFloat(coordsArray[0]);
        const lat = parseFloat(coordsArray[1]);
        onLocationSelect([lng, lat]);
        onOpenChange(false);
      }
    }
  };

  const handleTTSClick = async (text: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text }
      });

      if (error) {
        console.error('TTS error:', error);
        toast({
          title: "Audio generation failed",
          description: "Could not generate audio for this text.",
          variant: "destructive"
        });
        return;
      }

      if (data.audioContent) {
        // Play the audio
        const audioBlob = new Blob([Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
      } else if (data.fallbackToBrowser && data.enhancedText) {
        // Use browser TTS as fallback
        const utterance = new SpeechSynthesisUtterance(data.enhancedText);
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('TTS error:', error);
      toast({
        title: "Audio generation failed",
        description: "Could not generate audio for this text.",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderTranscriptEntry = (interaction: Interaction) => {
    const transcript = interaction.full_transcript;
    
    // Determine icon based on interaction type
    let IconComponent, iconColor;
    if (interaction.interaction_type === 'voice') {
      IconComponent = Mic;
      iconColor = 'text-blue-400';
    } else if (interaction.interaction_type === 'image_recognition') {
      IconComponent = Camera;
      iconColor = 'text-purple-400';
    } else if (interaction.interaction_type === 'map_marker') {
      IconComponent = MapPin;
      iconColor = 'text-red-400';
    } else {
      // Fallback
      IconComponent = Mic;
      iconColor = 'text-blue-400';
    }
    
    return (
      <Card className="w-full max-w-xs mx-auto bg-gray-900 border-gray-700 h-96">
        <CardContent className="p-3 h-full flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <IconComponent className={`w-3 h-3 ${iconColor}`} />
              <Badge variant="outline" className="text-xs px-1 py-0">{interaction.destination}</Badge>
              {interaction.similarity && (
                <Badge variant="secondary" className="text-xs px-1 py-0">
                  {Math.round(interaction.similarity * 100)}% match
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleFavorite(interaction)}
              >
                {interaction.is_favorite ? (
                  <Star className="w-3 h-3 text-yellow-500 fill-current" />
                ) : (
                  <StarOff className="w-3 h-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => handleTTSClick(interaction.assistant_response)}
              >
                <Volume2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center text-xs text-gray-400 mb-2">
            <Calendar className="w-3 h-3 mr-1" />
            {formatDate(interaction.created_at)}
          </div>

          <ScrollArea className="flex-1 w-full">
            <div className="space-y-1">
              {transcript && Array.isArray(transcript) ? (
                transcript
                  .filter((entry: any) => entry.message && (entry.role === 'user' || entry.role === 'agent'))
                  .map((entry: any, index: number) => (
                    <div key={index} className={`p-2 rounded text-xs ${
                      entry.role === 'user' 
                        ? 'bg-blue-900/30 text-blue-100' 
                        : 'bg-green-900/30 text-green-100'
                    }`}>
                      <span className="font-medium text-xs">
                        {entry.role === 'user' ? 'You:' : 'Assistant:'}
                      </span>
                      <p className="mt-1">
                        {entry.message}
                        {entry.role === 'agent' && entry.interrupted && (
                          <span className="text-orange-400 ml-1">(interrupted)</span>
                        )}
                      </p>
                    </div>
                  ))
              ) : (
                <div className="space-y-1">
                  <div className="p-2 rounded text-xs bg-blue-900/30 text-blue-100">
                    <span className="font-medium text-xs">You:</span>
                    <p className="mt-1">{interaction.user_input}</p>
                  </div>
                  <div className="p-2 rounded text-xs bg-green-900/30 text-green-100">
                    <span className="font-medium text-xs">Assistant:</span>
                    <p className="mt-1">{interaction.assistant_response}</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {interaction.landmark_coordinates && (
            <div className="mt-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => handleLocationClick(interaction.landmark_coordinates)}
              >
                <MapPin className="w-3 h-3 mr-1" />
                Show on Map
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderImageEntry = (interaction: Interaction) => {
    // Determine icon based on interaction type
    let IconComponent, iconColor;
    if (interaction.interaction_type === 'voice') {
      IconComponent = Mic;
      iconColor = 'text-blue-400';
    } else if (interaction.interaction_type === 'image_recognition') {
      IconComponent = Camera;
      iconColor = 'text-purple-400';
    } else if (interaction.interaction_type === 'map_marker') {
      IconComponent = MapPin;
      iconColor = 'text-red-400';
    } else {
      // Fallback
      IconComponent = Camera;
      iconColor = 'text-purple-400';
    }
    
    return (
      <Card className="w-full max-w-xs mx-auto bg-gray-900 border-gray-700 h-96">
        <CardContent className="p-3 h-full flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <IconComponent className={`w-3 h-3 ${iconColor}`} />
              <Badge variant="outline" className="text-xs px-1 py-0">{interaction.destination}</Badge>
              {interaction.similarity && (
                <Badge variant="secondary" className="text-xs px-1 py-0">
                  {Math.round(interaction.similarity * 100)}% match
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleFavorite(interaction)}
              >
                {interaction.is_favorite ? (
                  <Star className="w-3 h-3 text-yellow-500 fill-current" />
                ) : (
                  <StarOff className="w-3 h-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => handleTTSClick(interaction.assistant_response)}
              >
                <Volume2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center text-xs text-gray-400 mb-2">
            <Calendar className="w-3 h-3 mr-1" />
            {formatDate(interaction.created_at)}
          </div>

          {interaction.landmark_image_url && (
            <div className="mb-2 flex-shrink-0">
              <img 
                src={interaction.landmark_image_url} 
                alt="Landmark" 
                className="w-full h-20 object-cover rounded"
              />
            </div>
          )}

          <ScrollArea className="flex-1 w-full">
            <div className="space-y-1">
              <div className="p-2 rounded text-xs bg-blue-900/30 text-blue-100">
                <span className="font-medium text-xs">You:</span>
                <p className="mt-1">{interaction.user_input}</p>
              </div>
              <div className="p-2 rounded text-xs bg-green-900/30 text-green-100">
                <span className="font-medium text-xs">Assistant:</span>
                <p className="mt-1">{interaction.assistant_response}</p>
              </div>
            </div>
          </ScrollArea>

          {interaction.landmark_coordinates && (
            <div className="mt-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => handleLocationClick(interaction.landmark_coordinates)}
              >
                <MapPin className="w-3 h-3 mr-1" />
                Show on Map
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderInteraction = (interaction: Interaction) => {
    if (interaction.interaction_type === 'voice' && interaction.full_transcript) {
      return renderTranscriptEntry(interaction);
    } else if (interaction.interaction_type === 'image_recognition' || interaction.landmark_image_url) {
      return renderImageEntry(interaction);
    } else {
      return renderTranscriptEntry(interaction); // Default fallback
    }
  };

  if (!open) return null;

  const currentInteractions = showingSearchResults ? searchResults : interactions;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white hover:text-gray-300"
            >
              ← Close
            </Button>
            <h2 className="text-xl font-semibold text-white">
              {showingSearchResults ? 'Search Results' : 'Interaction History'}
            </h2>
          </div>
          
          <div className="flex gap-2">
            {showingSearchResults && (
              <Button
                variant="outline"
                onClick={handleBackToHistory}
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
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 bg-gray-800 border-gray-600 text-white"
              />
              <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                <Search className="w-4 h-4 mr-2" />
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {isLoading ? (
          <div className="text-white">Loading your interactions...</div>
        ) : currentInteractions.length > 0 ? (
          <div className="w-full max-w-5xl">
            <Carousel className="w-full">
              <CarouselContent>
                {currentInteractions.map((interaction) => (
                  <CarouselItem key={interaction.id} className="basis-full md:basis-1/2 lg:basis-1/3">
                    {renderInteraction(interaction)}
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex" />
              <CarouselNext className="hidden md:flex" />
            </Carousel>
          </div>
        ) : (
          <div className="text-center text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {showingSearchResults 
                ? "No interactions found matching your search." 
                : "No interactions found."}
            </p>
            <p className="text-sm">
              {showingSearchResults 
                ? "Try different keywords or check your spelling." 
                : "Start a conversation to see your history here."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractionCarousel;
