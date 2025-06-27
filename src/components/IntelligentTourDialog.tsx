import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Sparkles, MapPin, Search, Clock, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface IntelligentTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTourGenerated: (landmarks: any[]) => void;
  user: any;
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
  user
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResult[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<AutocompleteResult | null>(null);
  const [destinationDetails, setDestinationDetails] = useState<any>(null);
  const [nearbyLandmarks, setNearbyLandmarks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearchDestination = async (query: string) => {
    if (query.length < 3) {
      setAutocompleteResults([]);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: { 
          input: query,
          types: ['locality', 'sublocality', 'tourist_attraction', 'park', 'museum']
        }
      });

      if (error) throw error;

      // Client-side sorting: localities > sublocalities > tourist_attractions > parks > museums
      const sortedResults = data.predictions?.sort((a: AutocompleteResult, b: AutocompleteResult) => {
        const getTypeOrder = (types: string[]) => {
          if (types.includes('locality') || types.includes('administrative_area')) return 1;
          if (types.includes('sublocality') || types.includes('neighborhood')) return 2;
          if (types.includes('tourist_attraction')) return 3;
          if (types.includes('park')) return 4;
          if (types.includes('museum')) return 5;
          return 6;
        };
        return getTypeOrder(a.types) - getTypeOrder(b.types);
      }) || [];

      setAutocompleteResults(sortedResults);
    } catch (error) {
      console.error('Autocomplete error:', error);
      toast({
        title: "Search Error",
        description: "Failed to search destinations. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDestinationSelect = async (destination: AutocompleteResult) => {
    setSelectedDestination(destination);
    setCurrentStep(2);
    setIsLoading(true);

    try {
      // Fetch destination details
      const { data: detailsData, error: detailsError } = await supabase.functions.invoke('google-places-details', {
        body: { placeId: destination.place_id }
      });

      if (detailsError) throw detailsError;
      
      setDestinationDetails(detailsData.data);

      // Search nearby landmarks with dynamic radius
      const coordinates = [
        detailsData.data.location?.longitude || 0,
        detailsData.data.location?.latitude || 0
      ];

      const { data: nearbyData, error: nearbyError } = await supabase.functions.invoke('google-places-nearby', {
        body: { 
          coordinates,
          destinationTypes: destination.types
        }
      });

      if (nearbyError) throw nearbyError;

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

      // Insert tour record
      const { data: tourData, error: tourError } = await supabase
        .from('generated_tours')
        .insert({
          user_id: user?.id,
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
        })
        .select()
        .single();

      if (tourError) throw tourError;

      // Insert landmarks
      const landmarkInserts = landmarks.map((landmark, index) => ({
        tour_id: tourData.id,
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

      if (landmarkInserts.length > 0) {
        const { error: landmarksError } = await supabase
          .from('generated_landmarks')
          .insert(landmarkInserts);

        if (landmarksError) throw landmarksError;
      }

      setCurrentStep(4);
      
      // Convert landmarks to expected format for the map
      const formattedLandmarks = landmarks.map(landmark => ({
        id: landmark.placeId,
        name: landmark.name,
        coordinates: [landmark.geometry.location.lng, landmark.geometry.location.lat],
        description: landmark.editorialSummary || `${landmark.name} - ${landmark.types?.join(', ')}`,
        rating: landmark.rating,
        photos: landmark.photoUrl ? [landmark.photoUrl] : [],
        types: landmark.types || []
      }));

      onTourGenerated(formattedLandmarks);

      toast({
        title: "Tour Generated Successfully!",
        description: `Found ${landmarks.length} amazing places to explore in ${destination.name}`,
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
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetDialog, 300);
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Intelligent Tour Generator
          </DialogTitle>
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
            </div>

            {autocompleteResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {autocompleteResults.map((result) => (
                  <Button
                    key={result.place_id}
                    variant="ghost"
                    className="w-full justify-start h-auto p-3 text-left"
                    onClick={() => handleDestinationSelect(result)}
                  >
                    <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                    <div>
                      <div className="font-medium">
                        {result.structured_formatting?.main_text || result.description}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {result.structured_formatting?.secondary_text || result.types?.join(', ')}
                      </div>
                    </div>
                  </Button>
                ))}
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
                  <MapPin className="h-5 w-5 text-primary mt-1" />
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
