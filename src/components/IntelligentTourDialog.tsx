import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Search, Clock, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { getPlaceTypeIcon, getPlaceTypeLabel } from '@/utils/placeTypeIcons';

interface IntelligentTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTourGenerated: (landmarks: any[]) => void;
  onAuthRequired: () => void;
  onDestinationSelected?: (coordinates: [number, number]) => void;
}

interface AutocompleteResult {
  place_id: string;
  description: string;
  types: string[];
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface Step {
  id: number;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  { id: 1, title: "Choose Destination", description: "Search and select your destination" },
  { id: 2, title: "Discover Landmarks", description: "Finding nearby attractions" },
  { id: 3, title: "Generate Tour", description: "Creating your personalized tour" },
  { id: 4, title: "Ready to Explore", description: "Your tour is ready!" }
];

const IntelligentTourDialog: React.FC<IntelligentTourDialogProps> = ({
  open,
  onOpenChange,
  onTourGenerated,
  onAuthRequired,
  onDestinationSelected
}) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResult[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<AutocompleteResult | null>(null);
  const [destinationDetails, setDestinationDetails] = useState<any>(null);
  const [nearbyLandmarks, setNearbyLandmarks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [autocompleteError, setAutocompleteError] = useState<string>('');
  
  const { toast } = useToast();

  // Generate a new session token when dialog opens
  React.useEffect(() => {
    if (open && !sessionToken) {
      const newSessionToken = crypto.randomUUID();
      setSessionToken(newSessionToken);
      console.log('Generated new autocomplete session token:', newSessionToken);
    }
  }, [open, sessionToken]);

  const handleSearchDestination = async (query: string) => {
    if (query.length < 3) {
      setAutocompleteResults([]);
      setAutocompleteError('');
      return;
    }

    console.log('🔍 Autocomplete search - Browser context:', window.location.href);
    console.log('🔍 Session token:', sessionToken?.substring(0, 8) + '...');

    try {
      // Get user's current location for location bias (if available)
      let locationBias = null;
      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          
          locationBias = {
            circle: {
              center: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              },
              radius: 50000.0 // 50km radius
            }
          };
          console.log('Using location bias:', locationBias);
        } catch (geoError) {
          console.log('Could not get user location for bias:', geoError);
        }
      }

      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: { 
          input: query,
          types: ['locality', 'sublocality', 'tourist_attraction', 'park', 'museum'],
          sessionToken: sessionToken,
          locationBias: locationBias
        }
      });

      if (error) {
        console.error('🔍 Autocomplete error:', error);
        setAutocompleteError(`Search failed: ${error.message}`);
        throw error;
      }

      console.log('🔍 Autocomplete success:', data.predictions?.length || 0, 'results');
      
      // Enhanced logging for icon debugging
      data.predictions?.forEach((prediction: AutocompleteResult, index: number) => {
        console.log(`🔍 Result ${index + 1}: "${prediction.description}"`);
        console.log(`🔍 Result ${index + 1}: Types:`, prediction.types);
        
        // Test our icon function here
        const iconResult = getPlaceTypeIcon(prediction.types, prediction.description);
        console.log(`🔍 Result ${index + 1}: Icon will be:`, iconResult.icon.name, 'Color:', iconResult.color);
      });

      // Client-side sorting: localities > sublocalities > parks > tourist_attractions > museums
      const sortedResults = data.predictions?.sort((a: AutocompleteResult, b: AutocompleteResult) => {
        const getIconResult = (result: AutocompleteResult) => getPlaceTypeIcon(result.types, result.description);
        return getIconResult(a).priority - getIconResult(b).priority;
      }) || [];

      setAutocompleteResults(sortedResults);
      setAutocompleteError('');
    } catch (error) {
      console.error('🔍 Autocomplete error:', error);
      setAutocompleteError('Search unavailable. Please try entering a city name directly.');
      toast({
        title: "Search Error",
        description: "Search is currently unavailable. You can still enter a destination manually.",
        variant: "destructive",
      });
    }
  };

  const handleDestinationSelect = async (destination: AutocompleteResult) => {
    console.log('Starting tour generation for user:', user?.id, 'destination:', destination.description);
    
    // Since we handle auth upfront, we can proceed directly
    setSelectedDestination(destination);
    setCurrentStep(2);
    setIsLoading(true);

    try {
      // Fetch destination details
      const { data: detailsData, error: detailsError } = await supabase.functions.invoke('google-places-details', {
        body: { placeId: destination.place_id }
      });

      if (detailsError) {
        console.error('Places details error:', detailsError);
        throw detailsError;
      }
      
      console.log('Destination details retrieved:', detailsData.data);
      setDestinationDetails(detailsData.data);

      // EMIT DESTINATION COORDINATES AS SOON AS AVAILABLE
      const coordinates: [number, number] = [
        detailsData.data.location?.longitude || 0,
        detailsData.data.location?.latitude || 0
      ];
      
      console.log('Emitting destination coordinates to map:', coordinates);
      onDestinationSelected?.(coordinates);

      // Search nearby landmarks with dynamic radius
      console.log('Searching for nearby landmarks at coordinates:', coordinates);

      const { data: nearbyData, error: nearbyError } = await supabase.functions.invoke('google-places-nearby', {
        body: { 
          coordinates,
          destinationTypes: destination.types
        }
      });

      if (nearbyError) {
        console.error('Nearby places error:', nearbyError);
        throw nearbyError;
      }

      console.log('Found nearby landmarks:', nearbyData.places?.length || 0);
      setNearbyLandmarks(nearbyData.places || []);
      setCurrentStep(3);

      // Generate tour in database
      await generateTourInDatabase(detailsData.data, nearbyData.places || [], destination);
      
    } catch (error) {
      console.error('Tour generation error:', error);
      toast({
        title: "Generation Error",
        description: "Failed to generate tour. Please try again.",
        variant: "destructive",
      });
      setCurrentStep(1);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTourInDatabase = async (destination: any, landmarks: any[], destinationInfo: AutocompleteResult) => {
    if (!user?.id) {
      console.error('User authentication failed before database operations');
      throw new Error('User not authenticated');
    }

    console.log('Generating tour in database for user:', user.id);

    try {
      // Create the "Alexis" template system prompt
      const alexisPrompt = `You are Alexis, an expert tour guide for ${destination.name}. 

DESTINATION OVERVIEW:
- Name: ${destination.name}
- Address: ${destination.address}
- Rating: ${destination.rating}/5 (${destination.userRatingsTotal} reviews)
- Types: ${destination.types?.join(', ')}
${destination.editorialSummary ? `- Description: ${destination.editorialSummary}` : ''}

NEARBY LANDMARKS (${landmarks.length} discovered):
${landmarks.map((landmark, idx) => `
${idx + 1}. ${landmark.name}
   - Rating: ${landmark.rating}/5 (${landmark.userRatingsTotal || 0} reviews)
   - Types: ${landmark.types?.join(', ')}
   - Distance: Within search radius
   ${landmark.editorialSummary ? `- About: ${landmark.editorialSummary}` : ''}
`).join('')}

As Alexis, provide engaging, informative, and personalized tour guidance. Share interesting facts, historical context, local insights, and practical tips. Maintain an enthusiastic but professional tone, and always prioritize visitor safety and enjoyment.`;

      console.log('Inserting tour record...');
      
      // Insert tour record with explicit user_id
      const tourInsertData = {
        user_id: user.id, // Explicitly set user_id for RLS
        destination: destination.name,
        destination_details: {
          ...destination,
          search_query: searchQuery,
          destination_types: destinationInfo.types,
          search_radius: landmarks[0]?.searchRadius || 10000
        },
        system_prompt: alexisPrompt,
        total_landmarks: landmarks.length,
        generation_start_time: new Date().toISOString(),
        generation_end_time: new Date().toISOString()
      };

      console.log('Tour insert data:', tourInsertData);

      const { data: tourData, error: tourError } = await supabase
        .from('generated_tours')
        .insert(tourInsertData)
        .select()
        .single();

      if (tourError) {
        console.error('Tour insertion error:', tourError);
        throw new Error(`Failed to create tour: ${tourError.message}`);
      }

      console.log('Tour created successfully:', tourData.id);

      // Insert landmarks if any exist
      if (landmarks.length > 0) {
        console.log('Inserting landmarks...');
        
        const landmarkInserts = landmarks.map((landmark, index) => ({
          tour_id: tourData.id, // Link to the created tour
          landmark_id: landmark.placeId,
          name: landmark.name,
          coordinates: `(${landmark.geometry.location.lng},${landmark.geometry.location.lat})`,
          description: landmark.editorialSummary || `${landmark.name} - ${landmark.types?.join(', ')}`,
          rating: landmark.rating,
          photos: landmark.photoUrl ? [landmark.photoUrl] : [],
          formatted_address: landmark.vicinity,
          types: landmark.types || [],
          place_id: landmark.placeId,
          quality_score: landmark.rating || 0,
          confidence: 'high'
        }));

        console.log('Landmark insert data (first item):', landmarkInserts[0]);

        const { error: landmarksError } = await supabase
          .from('generated_landmarks')
          .insert(landmarkInserts);

        if (landmarksError) {
          console.error('Landmarks insertion error:', landmarksError);
          throw new Error(`Failed to create landmarks: ${landmarksError.message}`);
        }

        console.log('Landmarks inserted successfully');
      }

      setCurrentStep(4);
      
      // Convert landmarks to expected format for the map - FIXED FORMAT
      const formattedLandmarks = landmarks.map(landmark => ({
        id: landmark.placeId || `landmark-${Date.now()}-${Math.random()}`,
        name: landmark.name,
        coordinates: [
          parseFloat(landmark.geometry?.location?.lng || landmark.location?.longitude || 0),
          parseFloat(landmark.geometry?.location?.lat || landmark.location?.latitude || 0)
        ] as [number, number],
        description: landmark.editorialSummary || landmark.vicinity || `${landmark.name} - ${landmark.types?.join(', ') || 'Landmark'}`,
        rating: landmark.rating || 0,
        photos: landmark.photoUrl ? [landmark.photoUrl] : [],
        types: landmark.types || [],
        placeId: landmark.placeId,
        formattedAddress: landmark.vicinity || landmark.formattedAddress
      }));

      console.log('Formatted landmarks for map:', formattedLandmarks);
      console.log('Sample landmark coordinates:', formattedLandmarks[0]?.coordinates);

      // Ensure landmarks have valid coordinates before passing to map
      const validLandmarks = formattedLandmarks.filter(landmark => {
        const hasValidCoords = landmark.coordinates && 
          landmark.coordinates.length === 2 && 
          !isNaN(landmark.coordinates[0]) && 
          !isNaN(landmark.coordinates[1]) &&
          landmark.coordinates[0] !== 0 && 
          landmark.coordinates[1] !== 0;
        
        if (!hasValidCoords) {
          console.warn('Invalid landmark coordinates:', landmark.name, landmark.coordinates);
        }
        return hasValidCoords;
      });

      console.log(`Passing ${validLandmarks.length} valid landmarks to map out of ${formattedLandmarks.length} total`);

      onTourGenerated(validLandmarks);

      toast({
        title: "Tour Generated Successfully!",
        description: `Found ${validLandmarks.length} amazing places to explore in ${destination.name}`,
      });

    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
  };

  const resetDialog = () => {
    setCurrentStep(1);
    setSearchQuery('');
    setAutocompleteResults([]);
    setSelectedDestination(null);
    setDestinationDetails(null);
    setNearbyLandmarks([]);
    setIsLoading(false);
    setAutocompleteError('');
    // Generate new session token for next autocomplete session
    setSessionToken(crypto.randomUUID());
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetDialog, 300);
  };

  const progress = (currentStep / STEPS.length) * 100;

  const renderAutocompleteResult = (result: AutocompleteResult) => {
    const { icon: IconComponent, color } = getPlaceTypeIcon(result.types, result.description);
    const typeLabel = getPlaceTypeLabel(result.types, result.description);
    
    return (
      <Button
        key={result.place_id}
        variant="ghost"
        className="w-full justify-start h-auto p-3 text-left hover:bg-muted/50"
        onClick={() => handleDestinationSelect(result)}
      >
        <div className="flex items-start gap-3 w-full">
          <IconComponent className={`h-5 w-5 mt-0.5 flex-shrink-0 ${color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="font-medium text-sm truncate">
                {result.structured_formatting?.main_text || result.description}
              </div>
              <Badge variant="outline" className="text-xs h-5 flex-shrink-0">
                {typeLabel}
              </Badge>
            </div>
            {result.structured_formatting?.secondary_text && (
              <div className="text-xs text-muted-foreground truncate">
                {result.structured_formatting.secondary_text}
              </div>
            )}
            {result.types && result.types.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {result.types.slice(0, 3).join(', ')}
                {result.types.length > 3 && '...'}
              </div>
            )}
          </div>
        </div>
      </Button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto z-[99999]" style={{ zIndex: 99999 }} aria-describedby="intelligent-tour-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Intelligent Tour Generator
          </DialogTitle>
          <DialogDescription id="intelligent-tour-description">
            Create personalized tours by discovering amazing places at your destination
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between text-sm text-muted-foreground">
            {STEPS.map((step) => (
              <div key={step.id} className={`text-center ${currentStep >= step.id ? 'text-primary' : ''}`}>
                <div className="font-medium">{step.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Choose Destination */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Where do you want to explore?</h3>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for cities, attractions, parks, museums..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchDestination(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>
              {autocompleteError && (
                <p className="text-sm text-muted-foreground mt-1 text-amber-600">
                  {autocompleteError}
                </p>
              )}
            </div>

            {autocompleteResults.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                <div className="text-xs text-muted-foreground mb-2 px-1">
                  Results sorted by type priority: Cities → Areas → Parks → Attractions → Museums
                </div>
                {autocompleteResults.map(renderAutocompleteResult)}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Discovering Landmarks */}
        {currentStep === 2 && (
          <div className="space-y-4 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Discovering Amazing Places</h3>
              <p className="text-muted-foreground">
                Searching for attractions near {selectedDestination?.structured_formatting?.main_text || selectedDestination?.description}
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Generating Tour */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="animate-pulse h-8 w-8 bg-primary rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Creating Your Personal Tour</h3>
              <p className="text-muted-foreground">
                Found {nearbyLandmarks.length} amazing places! Generating your tour...
              </p>
            </div>
            
            {destinationDetails && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {(() => {
                    const { icon: IconComponent, color } = getPlaceTypeIcon(destinationDetails.types || [], destinationDetails.name);
                    return <IconComponent className={`h-5 w-5 mt-1 ${color}`} />;
                  })()}
                  <div>
                    <h4 className="font-semibold">{destinationDetails.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {destinationDetails.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {destinationDetails.rating}
                        </div>
                      )}
                      <span>{destinationDetails.address}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Ready */}
        {currentStep === 4 && (
          <div className="space-y-4 text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Sparkles className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-600">Tour Ready!</h3>
              <p className="text-muted-foreground">
                Your personalized tour of {destinationDetails?.name} is ready with {nearbyLandmarks.length} amazing places to explore.
              </p>
            </div>
            <div className="space-y-2">
              <Button onClick={handleClose} className="w-full">
                Start Exploring
              </Button>
              <Button variant="outline" onClick={resetDialog} className="w-full">
                Create Another Tour
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default IntelligentTourDialog;
