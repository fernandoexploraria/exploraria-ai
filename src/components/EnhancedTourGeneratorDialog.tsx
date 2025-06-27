
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { MapPin, Clock, Star, Users, ChevronRight, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

interface Destination {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  types: string[];
  rating?: number;
  userRatingCount?: number;
  editorialSummary?: string;
  photos?: string[];
  websiteUri?: string;
  internationalPhoneNumber?: string;
  openingHours?: string[];
}

interface Landmark {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  types: string[];
  rating?: number;
  userRatingCount?: number;
  editorialSummary?: string;
  photos?: string[];
}

interface EnhancedTourGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTourGenerated: (tourId: string, destination: string) => void;
}

const EnhancedTourGeneratorDialog: React.FC<EnhancedTourGeneratorDialogProps> = ({
  open,
  onOpenChange,
  onTourGenerated,
}) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [discoveredLandmarks, setDiscoveredLandmarks] = useState<Landmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const totalSteps = 5;
  const progressPercentage = (currentStep / totalSteps) * 100;

  // Step 1: Search for destinations
  const searchDestinations = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: { input: query, types: 'establishment|geocode' }
      });

      if (error) throw error;
      setSuggestions(data.predictions || []);
    } catch (error) {
      console.error('Error searching destinations:', error);
      toast.error('Failed to search destinations');
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchDestinations(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Step 2: Get destination details and store
  const selectDestination = async (suggestion: any) => {
    setIsLoading(true);
    setLoadingMessage('Getting destination details...');

    try {
      // Get detailed place information
      const { data: placeData, error: placeError } = await supabase.functions.invoke('google-places-details', {
        body: { placeId: suggestion.place_id }
      });

      if (placeError) throw placeError;

      const destination: Destination = {
        placeId: suggestion.place_id,
        displayName: placeData.data.name || suggestion.description,
        formattedAddress: placeData.data.address || suggestion.description,
        location: {
          lat: placeData.data.geometry?.location?.lat || 0,
          lng: placeData.data.geometry?.location?.lng || 0
        },
        types: placeData.data.types || [],
        rating: placeData.data.rating,
        userRatingCount: placeData.data.userRatingsTotal,
        editorialSummary: placeData.data.editorialSummary,
        photos: placeData.data.photos || [],
        websiteUri: placeData.data.website,
        internationalPhoneNumber: placeData.data.phoneNumber,
        openingHours: placeData.data.openingHours || []
      };

      // Store destination in database
      const { data: tourData, error: tourError } = await supabase
        .from('generated_tours')
        .insert({
          user_id: user?.id,
          destination: destination.displayName,
          destination_details: destination,
          generation_start_time: new Date().toISOString(),
          system_prompt: '', // Will be generated later
          total_landmarks: 0
        })
        .select()
        .single();

      if (tourError) throw tourError;

      setSelectedDestination(destination);
      setCurrentStep(3);
    } catch (error) {
      console.error('Error selecting destination:', error);
      toast.error('Failed to get destination details');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Step 3: Discover landmarks
  const discoverLandmarks = async () => {
    if (!selectedDestination) return;

    setIsLoading(true);
    setLoadingMessage('Discovering nearby landmarks...');

    try {
      const { data, error } = await supabase.functions.invoke('discover-tour-landmarks', {
        body: {
          destination: selectedDestination,
          userId: user?.id
        }
      });

      if (error) throw error;

      setDiscoveredLandmarks(data.landmarks || []);
      setCurrentStep(4);
    } catch (error) {
      console.error('Error discovering landmarks:', error);
      toast.error('Failed to discover landmarks');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Step 4: Generate tour prompt template
  const generateTourPrompt = async () => {
    if (!selectedDestination || discoveredLandmarks.length === 0) return;

    setIsLoading(true);
    setLoadingMessage('Preparing your personalized tour guide...');

    try {
      const { data, error } = await supabase.functions.invoke('generate-tour-prompt-template', {
        body: {
          destination: selectedDestination,
          landmarks: discoveredLandmarks,
          userId: user?.id
        }
      });

      if (error) throw error;

      // Update the tour with the generated prompt
      const { error: updateError } = await supabase
        .from('generated_tours')
        .update({
          system_prompt: data.promptTemplate,
          total_landmarks: discoveredLandmarks.length,
          generation_end_time: new Date().toISOString()
        })
        .eq('user_id', user?.id)
        .eq('destination', selectedDestination.displayName);

      if (updateError) throw updateError;

      setCurrentStep(5);
      
      // Call the callback to launch the tour assistant
      onTourGenerated(data.tourId, selectedDestination.displayName);
      
      toast.success('Your personalized tour is ready!');
    } catch (error) {
      console.error('Error generating tour prompt:', error);
      toast.error('Failed to prepare tour guide');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setSearchQuery('');
    setSuggestions([]);
    setSelectedDestination(null);
    setDiscoveredLandmarks([]);
    onOpenChange(false);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Where would you like to explore?</h3>
              <p className="text-sm text-muted-foreground">
                Search for any destination worldwide - cities, neighborhoods, landmarks, or attractions.
              </p>
            </div>
            
            <div className="relative">
              <Input
                placeholder="Search destinations... (e.g., Paris, Central Park, Louvre Museum)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>

            {suggestions.length > 0 && (
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => selectDestination(suggestion)}
                    className="w-full p-3 text-left hover:bg-accent transition-colors border-b last:border-b-0 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{suggestion.structured_formatting?.main_text || suggestion.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {suggestion.structured_formatting?.secondary_text || ''}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="text-center space-y-4">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p>{loadingMessage}</p>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Perfect choice!</h3>
              <p className="text-sm text-muted-foreground">
                Ready to discover amazing landmarks around your destination?
              </p>
            </div>

            {selectedDestination && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <h4 className="font-semibold">{selectedDestination.displayName}</h4>
                    <p className="text-sm text-muted-foreground">{selectedDestination.formattedAddress}</p>
                    
                    {selectedDestination.rating && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{selectedDestination.rating}</span>
                        {selectedDestination.userRatingCount && (
                          <span className="text-muted-foreground">({selectedDestination.userRatingCount} reviews)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {selectedDestination.editorialSummary && (
                  <p className="text-sm">{selectedDestination.editorialSummary}</p>
                )}

                <div className="flex flex-wrap gap-1">
                  {selectedDestination.types.slice(0, 3).map((type, index) => (
                    <span key={index} className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded">
                      {type.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={discoverLandmarks} className="w-full" disabled={isLoading}>
              <Sparkles className="mr-2 h-4 w-4" />
              Discover Landmarks
            </Button>
          </div>
        );

      case 4:
        if (discoveredLandmarks.length === 0) {
          return (
            <div className="text-center space-y-4">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p>{loadingMessage}</p>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Amazing landmarks discovered!</h3>
              <p className="text-sm text-muted-foreground">
                Found {discoveredLandmarks.length} incredible places for your tour
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {discoveredLandmarks.map((landmark, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <h4 className="font-medium text-sm">{landmark.displayName}</h4>
                      <p className="text-xs text-muted-foreground">{landmark.formattedAddress}</p>
                      
                      {landmark.rating && (
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span>{landmark.rating}</span>
                          {landmark.userRatingCount && (
                            <span className="text-muted-foreground">({landmark.userRatingCount})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {landmark.types.slice(0, 2).map((type, typeIndex) => (
                      <span key={typeIndex} className="px-1.5 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">
                        {type.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={generateTourPrompt} className="w-full" disabled={isLoading}>
              <Sparkles className="mr-2 h-4 w-4" />
              Create My Personal Tour Guide
            </Button>
          </div>
        );

      case 5:
        return (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-green-600">Tour Ready!</h3>
              <p className="text-sm text-muted-foreground">
                Your personalized AI tour guide has been created and is ready to accompany you on your journey!
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Start Exploring
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Tour Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="w-full" />
          </div>

          {/* Step content */}
          <div className="min-h-[300px]">
            {renderStep()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedTourGeneratorDialog;
