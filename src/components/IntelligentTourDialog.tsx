import React, { useState, useEffect } from 'react';
import MobileResponsiveDialog from '@/components/MobileResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Search, Clock, Star, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { getPlaceTypeIcon, getPlaceTypeLabel } from '@/utils/placeTypeIcons';
import { mapPriceLevel } from '@/utils/priceUtils';
import { setTourLandmarks, clearTourMarkers } from '@/data/tourLandmarks';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMarkerLoadingState } from '@/hooks/useMarkerLoadingState';
import { resetIntelligentTourDialogState } from '@/utils/tourResetUtils';
import { fetchExperienceLandmarks } from '@/utils/experienceUtils';

interface IntelligentTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTourGenerated: (landmarks: any[]) => void;
  onAuthRequired: () => void;
  onTourReadyForVoice?: (tourData: { destination: string; systemPrompt: string; landmarks: any[] }) => void;
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
  { id: 4, title: "Prepare Map", description: "Loading landmarks to map" },
  { id: 5, title: "Ready to Explore", description: "Your tour is ready!" }
];

const IntelligentTourDialog: React.FC<IntelligentTourDialogProps> = ({
  open,
  onOpenChange,
  onTourGenerated,
  onAuthRequired,
  onTourReadyForVoice
}) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // Initialize state with reset utility
  const initialState = resetIntelligentTourDialogState();
  const [currentStep, setCurrentStep] = useState(initialState.currentStep);
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery);
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResult[]>(initialState.autocompleteResults);
  const [selectedDestination, setSelectedDestination] = useState<AutocompleteResult | null>(initialState.selectedDestination);
  const [destinationDetails, setDestinationDetails] = useState<any>(initialState.destinationDetails);
  const [nearbyLandmarks, setNearbyLandmarks] = useState<any[]>(initialState.nearbyLandmarks);
  const [isLoading, setIsLoading] = useState(initialState.isLoading);
  const [sessionToken, setSessionToken] = useState<string>(initialState.sessionToken);
  const [autocompleteError, setAutocompleteError] = useState<string>(initialState.autocompleteError);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);
  
  const { toast } = useToast();
  const { isMarkersLoading, markersLoaded, startMarkerLoading, finishMarkerLoading, resetMarkerState } = useMarkerLoadingState(750);

  // Enhanced reset and cleanup when dialog opens using utility
  React.useEffect(() => {
    if (open) {
      console.log('🎯 IntelligentTourDialog opened - performing enhanced cleanup');
      
      // Clear existing tour markers immediately
      clearTourMarkers();
      
      // Check for pre-selected landmark destination
      const pendingLandmark = (window as any).pendingLandmarkDestination;
      if (pendingLandmark) {
        console.log('🎯 Found pre-selected landmark, skipping destination selection:', pendingLandmark.name);
        
        // Convert landmark to autocomplete result format
        const landmarkAsDestination: AutocompleteResult = {
          place_id: pendingLandmark.placeId || `landmark-${pendingLandmark.id}`,
          description: pendingLandmark.name,
          types: pendingLandmark.types || ['tourist_attraction'],
          structured_formatting: {
            main_text: pendingLandmark.name,
            secondary_text: pendingLandmark.formattedAddress || pendingLandmark.description || 'Top Landmark'
          }
        };
        
        // Set up state for pre-selected landmark and skip to tour generation
        const newState = resetIntelligentTourDialogState();
        setCurrentStep(2); // Skip destination selection, go directly to landmark discovery
        setSelectedDestination(landmarkAsDestination);
        setSessionToken(newState.sessionToken);
        setAutocompleteResults([]);
        setNearbyLandmarks([]);
        setDestinationDetails(null);
        setIsLoading(true); // Set loading state immediately
        setAutocompleteError('');
        setIsAutocompleteLoading(false);
        resetMarkerState();
        
        // Clear the pending landmark and start tour generation immediately
        delete (window as any).pendingLandmarkDestination;
        
        // Start tour generation for the pre-selected landmark immediately
        handleLandmarkTourGeneration(pendingLandmark, landmarkAsDestination, pendingLandmark.experience, pendingLandmark.tourId);
        
      } else {
        // Reset dialog state using utility (normal flow)
        const newState = resetIntelligentTourDialogState();
        setCurrentStep(newState.currentStep);
        setSearchQuery(newState.searchQuery);
        setAutocompleteResults(newState.autocompleteResults);
        setSelectedDestination(newState.selectedDestination);
        setDestinationDetails(newState.destinationDetails);
        setNearbyLandmarks(newState.nearbyLandmarks);
        setIsLoading(newState.isLoading);
        setAutocompleteError(newState.autocompleteError);
        setSessionToken(newState.sessionToken);
        setIsAutocompleteLoading(false);
        resetMarkerState();
      }
      
      console.log('🎯 Enhanced cleanup completed');
    }
  }, [open, resetMarkerState]);

  const resetDialog = () => {
    console.log('🔄 Resetting IntelligentTourDialog state');
    const newState = resetIntelligentTourDialogState();
    setCurrentStep(newState.currentStep);
    setSearchQuery(newState.searchQuery);
    setAutocompleteResults(newState.autocompleteResults);
    setSelectedDestination(newState.selectedDestination);
    setDestinationDetails(newState.destinationDetails);
    setNearbyLandmarks(newState.nearbyLandmarks);
    setIsLoading(newState.isLoading);
    setAutocompleteError(newState.autocompleteError);
    setSessionToken(newState.sessionToken);
    setIsAutocompleteLoading(false);
    resetMarkerState();
  };

  const handleClose = () => {
    console.log('🎯 IntelligentTourDialog closing - performing cleanup');
    // Clear tour markers when dialog closes without completing
    if (currentStep < 5) {
      clearTourMarkers();
    }
    onOpenChange(false);
  };

  const handleSearchDestination = async (query: string) => {
    if (query.length < 3) {
      setAutocompleteResults([]);
      setAutocompleteError('');
      setIsAutocompleteLoading(false);
      return;
    }

    console.log('🔍 Autocomplete search - Browser context:', window.location.href);
    console.log('🔍 Session token:', sessionToken?.substring(0, 8) + '...');

    setIsAutocompleteLoading(true);

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
    } finally {
      setIsAutocompleteLoading(false);
    }
  };

  const handleLandmarkTourGeneration = async (landmark: any, destinationInfo: AutocompleteResult, experience?: boolean, tourId?: string) => {
    console.log('🚀 Starting simplified landmark tour generation for:', landmark.name);
    
    // Validate authentication first
    if (!user?.id) {
      console.error('❌ User not authenticated for landmark tour generation');
      toast({
        title: "Authentication Required",
        description: "Please sign in to generate tours.",
        variant: "destructive",
      });
      onAuthRequired();
      return;
    }
    
    // Validate landmark data structure
    if (!landmark.coordinates || !Array.isArray(landmark.coordinates) || landmark.coordinates.length !== 2) {
      console.error('❌ Invalid landmark coordinates:', landmark.coordinates);
      toast({
        title: "Data Error",
        description: "Invalid landmark location data. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    // Clear any existing tour markers before starting new tour
    console.log('🧹 Clearing existing tour markers before new generation');
    clearTourMarkers();
    
    // Clear any existing optimal route when generating a new tour
    if ((window as any).clearOptimalRoute) {
      console.log('🧹 Clearing existing optimal route before new tour generation');
      (window as any).clearOptimalRoute();
    }
    
    // Wait a moment for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Add the missing state initialization lines
    setSelectedDestination(destinationInfo);
    setCurrentStep(2);
    setIsLoading(true);

    try {
      // Create destination details from landmark data (no API call needed)
      const destinationDetails = {
        name: landmark.name,
        address: landmark.formattedAddress || landmark.description || 'Top Landmark',
        rating: landmark.rating || null,
        userRatingsTotal: landmark.userRatingsTotal || null,
        editorialSummary: landmark.description || `Explore ${landmark.name} and discover nearby attractions`,
        location: {
          latitude: landmark.coordinates[1],
          longitude: landmark.coordinates[0]
        },
        types: landmark.types || ['tourist_attraction'],
        placeId: landmark.placeId || 'unknown'
      };
      
      console.log('Using landmark details as destination:', destinationDetails);
      setDestinationDetails(destinationDetails);

      // Now call the nearby search with tourist_attraction type (same as handleDestinationSelect step 2)
      const coordinates = [landmark.coordinates[0], landmark.coordinates[1]]; // [lng, lat]

      console.log('Searching for nearby landmarks at coordinates:', coordinates);

      // Conditionally fetch landmarks based on experience type
      const nearbyData = await (async () => {
        if (experience === true && tourId) {
          console.log('🎯 This is an experience tour, fetching landmarks for tour ID:', tourId);
          const { places: experiencePlaces, error: experienceError } = await fetchExperienceLandmarks(tourId);
          return { data: { places: experiencePlaces }, error: experienceError };
        } else {
          console.log('🔍 This is a regular tour, searching Google Places');
          const { data, error } = await supabase.functions.invoke('google-places-nearby', {
            body: { 
              coordinates,
              destinationTypes: ['tourist_attraction'] // This triggers 1000m radius + 10 results
            }
          });
          return { data, error };
        }
      })();

      if (nearbyData.error) {
        console.error('Nearby places error:', nearbyData.error);
        throw nearbyData.error;
      }

      console.log('Found nearby landmarks:', nearbyData.data.places?.length || 0);
      console.log('📍 Nearby landmarks retrieved:', nearbyData.data.places?.map(p => ({ name: p.name, place_id: p.place_id, rating: p.rating })) || []);
      setNearbyLandmarks(nearbyData.data.places || []);
      setCurrentStep(3);

      // Generate tour in database using the landmark destination details
      // Determine tour type and pass source tour ID for experiences
      const tourType = (experience === true && tourId) ? 'experience' : 'regular';
      await generateTourInDatabase(destinationDetails, nearbyData.data.places || [], destinationInfo, tourType, tourId);
      
    } catch (error) {
      console.error('Landmark tour generation error:', error);
      
      // Enhanced error handling for landmark tours
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.log('🚨 Landmark tour error details:', errorMessage);
      
      toast({
        title: "Tour Generation Failed",
        description: `Failed to generate tour for ${landmark.name}. ${errorMessage.includes('not authenticated') ? 'Please sign in and try again.' : 'Please try again.'}`,
        variant: "destructive",
      });
      
      setCurrentStep(2);
      setIsLoading(false);
      
      // If authentication error, trigger auth dialog
      if (errorMessage.includes('not authenticated')) {
        onAuthRequired();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDestinationSelect = async (destination: AutocompleteResult) => {
    console.log('🚀 Starting enhanced tour generation for user:', user?.id, 'destination:', destination.description);
    
    // Clear any existing tour markers before starting new tour
    console.log('🧹 Clearing existing tour markers before new generation');
    clearTourMarkers();
    
    // Clear any existing optimal route when generating a new tour
    if ((window as any).clearOptimalRoute) {
      console.log('🧹 Clearing existing optimal route before new tour generation');
      (window as any).clearOptimalRoute();
    }
    
    // Wait a moment for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
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

      // Search nearby landmarks with dynamic radius
      const coordinates = [
        detailsData.data.location?.longitude || 0,
        detailsData.data.location?.latitude || 0
      ];

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

      // Generate tour in database (regular tour)
      await generateTourInDatabase(detailsData.data, nearbyData.places || [], destination, 'regular');
      
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

  const generateTourInDatabase = async (destination: any, landmarks: any[], destinationInfo: AutocompleteResult, tourType: 'experience' | 'regular' = 'regular', sourceTourId?: string) => {
    if (!user?.id) {
      console.error('User authentication failed before database operations');
      throw new Error('User not authenticated');
    }

    console.log('🗃️ Generating tour in database for user:', user.id);

    try {
      // Import the landmark highlights utility
      const { generateLandmarkHighlights } = await import('@/utils/landmarkHighlights');
      
      // Generate curated highlights for each landmark
      const landmarkHighlights = generateLandmarkHighlights(landmarks);

      // System prompt selection logic based on tour type
      let systemPrompt: string;
      
      if (tourType === 'experience' && sourceTourId) {
        console.log('🎯 Experience tour detected, fetching system prompt from source tour:', sourceTourId);
        try {
          const { data: tourDetails, error: tourDetailsError } = await supabase.functions.invoke('get-tour-details', {
            body: { tourId: sourceTourId }
          });
          
          if (tourDetailsError) {
            console.error('❌ Failed to fetch source tour details:', tourDetailsError);
            throw new Error(`Failed to fetch source tour details: ${tourDetailsError.message}`);
          }
          
          if (!tourDetails || !tourDetails.systemPrompt) {
            console.error('❌ No system prompt found in source tour');
            throw new Error('Source tour system prompt not found');
          }
          
          systemPrompt = tourDetails.systemPrompt;
          console.log('✅ Successfully retrieved system prompt from source tour');
          
        } catch (error) {
          console.error('❌ Error fetching source system prompt, falling back to alexisPrompt:', error);
          // Fallback to generated alexisPrompt if fetching fails
          systemPrompt = generateAlexisPrompt(destination, landmarks, landmarkHighlights);
        }
      } else {
        console.log('🔍 Regular tour detected, generating alexisPrompt');
        systemPrompt = generateAlexisPrompt(destination, landmarks, landmarkHighlights);
      }

      // Helper function to generate alexisPrompt (extracted from original code)
      function generateAlexisPrompt(destination: any, landmarks: any[], landmarkHighlights: any[]) {
        return `You are Alexis, an **enthusiastic and incredibly knowledgeable expert tour guide**. Your current focus is leading a delightful walking tour of **${destination.name}** and its immediate surroundings.

**Your Core Mission:**
1. **Engage and Inform:** Provide captivating facts, rich historical context, local anecdotes, practical tips.
2. **Personalize:** Adapt to the user's interests and questions, making the experience unique.
3. **Prioritize Experience:** Ensure visitor safety, comfort, and maximum enjoyment.
4. **Maintain Tone:** Be enthusiastic, professional, friendly, and always helpful.

**Tour Destination Overview (Structured Data):**
\`\`\`json
{
  "name": "${destination.name}",
  "place_id": "${destination.placeId || 'Not available'}",
  "location": {
    "address": "${destination.address || 'Central location'}",
    "coordinates": {
      "latitude": ${destination.location?.latitude || 0},
      "longitude": ${destination.location?.longitude || 0}
    }
  },
  "visitor_impression": {
    "rating": ${destination.rating || null},
    "total_reviews": ${destination.userRatingsTotal || null},
    "description": "${destination.editorialSummary || 'A significant point of interest in the area.'}"
  },
  "types": ${JSON.stringify(destination.types || [])},
  "status": "primary_destination"
}
\`\`\`

**Key Landmarks for this Tour (Structured Initial Discovery):**
These are significant points you've pre-identified within the tour's general area. You should introduce these naturally as we approach them, or if the user asks.

\`\`\`json
[
${landmarkHighlights.map((landmark, idx) => {
  const originalLandmark = landmarks[idx];
  return `  {
    "name": "${landmark.name}",
    "place_id": "${originalLandmark?.placeId || 'Not available'}",
    "type": "${landmark.type}",
    "highlight": "${landmark.highlight}",
    "coordinates": {
      "latitude": ${originalLandmark?.geometry?.location?.lat || 0},
      "longitude": ${originalLandmark?.geometry?.location?.lng || 0}
    },
    "rating": ${originalLandmark?.rating || null},
    "types": ${JSON.stringify(originalLandmark?.types || [])},
    "status": "predefined_landmark"
  }`;
}).join(',\n')}
]
\`\`\`

**Function Calling Instructions for Real-time Place Information:**

When you encounter questions or situations requiring real-time information about places, use the appropriate tool by calling its defined name with the \`place_id\` (and any other necessary parameters).

**Available Tools and Their Triggers:**

* **\`get-place-hours(place_id: string)\`**
    * **Description:** Gets the current operating hours and open/closed status for a specific place. Use this tool when the user asks about a place's operating schedule or if it's currently open.
    * **Trigger Phrases/Questions:** "Is [place] open right now?", "What are the hours for [place]?", "When does [place] close/open?", "What time does [place] operate?"

* **\`get-place-popularity(place_id: string)\`**
    * **Description:** Retrieves real-time popularity or crowd data for a place, indicating how busy it currently is. Use this tool when the user asks about crowd levels or the best time to visit to avoid crowds.
    * **Trigger Phrases/Questions:** "How busy is [place]?", "Is [place] crowded right now?", "What's the best time to visit [place] to avoid crowds?"

* **\`get-place-reviews(place_id: string, limit: number = 3)\`**
    * **Description:** Fetches the most recent visitor reviews for a given place. Use this tool when the user asks for visitor feedback, opinions, or specific comments about a place.
    * **Trigger Phrases/Questions:** "What do recent visitors say about [place]?", "Can you tell me about the reviews for [place]?", "Are there any recent comments about [place]?"

* **\`get-place-directions(place_id: string, conversation_id: string)\`**
    * **Description:** Provides walking directions or distance from your current location to a destination place. Use this tool when the user asks for navigation instructions, distance, or how to get to a specific point.
    * **Trigger Phrases/Questions:** "How do I get to [place]?", "What's the distance to [place]?", "Can you give me directions to [place]?"
    * **No Location Handling:** If the function returns a message that location access is required, inform the user they need to grant browser location permissions. For example: "It seems I don't have access to your current location. To provide directions, please allow location access in your browser when prompted, then try asking for directions again."

* **\`get-place-weather-impact(place_id: string)\`**
    * **Description:** Checks the current weather conditions at a specific place's coordinates and advises on any potential impact on the visit. Use this tool when the user asks about weather or how it might affect their experience at a location.
    * **Trigger Phrases/Questions:** "Is [place] affected by weather?", "What's the weather like at [place]?", "Will the rain affect our visit to [place]?"

* **\`get-place-accessibility(place_id: string)\`**
    * **Description:** Provides information regarding the accessibility features of a specific place (e.g., wheelchair access, ramps, accessible parking). Use this tool when the user inquires about mobility or accessibility needs for a place.
    * **Trigger Phrases/Questions:** "Is [place] wheelchair accessible?", "Does [place] have ramps or elevators?", "What are the accessibility options at [place]?"

**Grounding Instructions:**
- Always prioritize place_id-based data over general knowledge when available
- Cross-reference multiple data sources for accuracy when using place_id
- If place_id lookup fails, clearly indicate you're using general knowledge
- Use place_id for fact verification of historical claims or current status

---

**Real-time Location Awareness & Integration (Dynamic Discoveries):**

You will receive occasional, non-interrupting system updates about **new** nearby points of interest (POIs) that are dynamically discovered as we walk. These updates will appear in your conversation history in a structured, actionable format:

\`SYSTEM_ALERT: {"poi_name": "[Name]", "poi_type": "[primaryType]", "poi_fact": "[brief summary/fact]", "poi_id": "[Place ID]"}\`

**Your Protocol for Handling Nearby POIs:**

1. **No Interruption:** **Crucially, do NOT interrupt** the user or your current speaking turn when a \`SYSTEM_ALERT\` arrives. Let the current conversational turn complete naturally.
2. **Contextual Integration:** After the user has finished speaking, or during a natural pause in the conversation (when it's your turn to speak, and you are not in the middle of a planned landmark explanation), then:
   * **Check your internal memory:** Review recent \`SYSTEM_ALERT\` messages.
   * **Prioritize New & Relevant:** Identify the most interesting or closest POI from the alerts that you **have NOT yet discussed** in this specific conversation session.
   * **Proactive Introduction:** If a new, significant POI is available:
       * Initiate gracefully with an enthusiastic discovery tone: "Oh, how fascinating! Speaking of our journey, it seems we're quite close to [POI Name]."
       * **Share Key Information:** Immediately follow with an engaging fact or brief detail about [POI Name], drawing directly from the \`poi_fact\` provided in the \`SYSTEM_ALERT\`. For example: "Did you know that [poi_fact]? It's truly a captivating spot that often surprises visitors!"
       * **Smooth Transition:** Ask a relevant follow-up question about the newly discovered POI or connect it back to the tour, e.g.: "What are your thoughts on that, or shall we continue exploring ${destination.name}'s charm?"
   * **No New POI:** If no new POI information is available in the \`SYSTEM_ALERT\`s (or all have been discussed), simply continue the conversation based on the main tour plan or the user's previous input.
3. **Internal Tracking for Repetition Avoidance:** Once you introduce a POI (whether from the initial "Key Landmarks" list or a "Real-time Location Awareness" alert), consider it "discussed" for the remainder of this conversation session. **Do not re-mention it, even if its ID appears again in a new \`SYSTEM_ALERT\`.** You are an expert who remembers what you've already shared.`;
      }

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
        system_prompt: systemPrompt,
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

      // Insert landmarks if any exist - ENHANCED WITH CONSECUTIVE LANDMARK_ID
      if (landmarks.length > 0) {
        console.log('Inserting enhanced landmarks with consecutive landmark_id values...');
        
        // Filter landmarks with valid coordinates before insertion
        const validLandmarks = landmarks.filter(landmark => {
          const hasValidCoords = landmark.geometry?.location?.lng && 
                                landmark.geometry?.location?.lat &&
                                !isNaN(landmark.geometry.location.lng) && 
                                !isNaN(landmark.geometry.location.lat) &&
                                landmark.geometry.location.lng !== 0 && 
                                landmark.geometry.location.lat !== 0;
          
          if (!hasValidCoords) {
            console.warn('Skipping landmark with invalid coordinates:', landmark.name, landmark.geometry?.location);
          }
          
          return hasValidCoords;
        });
        
        console.log(`Filtered ${validLandmarks.length} valid landmarks out of ${landmarks.length} total`);
        
        const landmarkInserts = validLandmarks.map((landmark, index) => ({
          tour_id: tourData.id, // Link to the created tour
          landmark_id: `landmark-${index + 1}`, // 🔥 CONSECUTIVE LANDMARK ID
          name: landmark.name,
          coordinates: `(${landmark.geometry.location.lng},${landmark.geometry.location.lat})`,
          description: landmark.editorialSummary || `${landmark.name} - ${landmark.types?.join(', ')}`,
          rating: landmark.rating,
          // 🔥 ENHANCED FIELDS WITH PRICE LEVEL MAPPING
          price_level: mapPriceLevel(landmark.priceLevel), // Apply integer mapping with fallback
          user_ratings_total: landmark.userRatingsTotal,
          website_uri: landmark.website,
          opening_hours: landmark.regularOpeningHours || null,
          editorial_summary: landmark.editorialSummary,
          photo_references: landmark.photos?.map((p: any) => p.name) || [],
          // EXISTING FIELDS
          photos: landmark.photoUrl ? [landmark.photoUrl] : [],
          formatted_address: landmark.vicinity,
          types: landmark.types || [],
          place_id: landmark.placeId, // 🔥 PLACE_ID STORED CORRECTLY HERE
          confidence: 'high',
          // 🔥 COMPLETE RAW DATA PRESERVATION
          raw_data: landmark.rawGooglePlacesData || landmark
        }));

        console.log('Enhanced landmark insert with consecutive landmark_id (first item):', landmarkInserts[0]);

        const { error: landmarksError } = await supabase
          .from('generated_landmarks')
          .insert(landmarkInserts);

        if (landmarksError) {
          console.error('Landmarks insertion error:', landmarksError);
          throw new Error(`Failed to create landmarks: ${landmarksError.message}`);
        }

        console.log('Enhanced landmarks inserted successfully with consecutive landmark_id values');
      }

      // Move to step 4 - preparing map
      setCurrentStep(4);
      
      // Convert landmarks to expected format for the map - ENHANCED FORMAT WITH TOUR_ID
      const formattedLandmarks = landmarks.map((landmark, index) => ({
        id: landmark.placeId || `landmark-${Date.now()}-${index}`,
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
        formattedAddress: landmark.vicinity || landmark.formattedAddress,
        tourId: tourData.id // 🔥 CRUCIAL: Add tour_id to each landmark
      }));

      console.log('🗺️ Enhanced landmarks for map with tour_id:', formattedLandmarks.length);

      // Validate coordinates more strictly
      const validLandmarks = formattedLandmarks.filter(landmark => {
        const hasValidCoords = landmark.coordinates && 
          landmark.coordinates.length === 2 && 
          !isNaN(landmark.coordinates[0]) && 
          !isNaN(landmark.coordinates[1]) &&
          landmark.coordinates[0] !== 0 && 
          landmark.coordinates[1] !== 0 &&
          Math.abs(landmark.coordinates[0]) <= 180 &&
          Math.abs(landmark.coordinates[1]) <= 90;
        
        if (!hasValidCoords) {
          console.warn('❌ Invalid landmark coordinates:', landmark.name, landmark.coordinates);
        } else {
          console.log('✅ Valid landmark coordinates:', landmark.name, landmark.coordinates, 'tour_id:', landmark.tourId);
        }
        return hasValidCoords;
      });

      console.log(`🗺️ Passing ${validLandmarks.length} valid landmarks to map out of ${formattedLandmarks.length} total`);

      // Enhanced marker loading with cleanup verification
      startMarkerLoading();

      // Ensure complete cleanup before adding new landmarks
      console.log('🧹 Final cleanup verification before adding new landmarks');
      clearTourMarkers();
      
      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Convert to TourLandmark format and call setTourLandmarks with placeId included
      const tourLandmarks = validLandmarks.map(landmark => ({
        name: landmark.name,
        coordinates: landmark.coordinates,
        description: landmark.description,
        placeId: landmark.placeId // 🔥 INCLUDE PLACE_ID FOR DATABASE LOOKUP
      }));

      console.log('📍 Adding Enhanced Smart Tour landmarks to TOUR_LANDMARKS array:', tourLandmarks.length);
      setTourLandmarks(tourLandmarks);

      // Call onTourGenerated with enhanced landmarks INCLUDING tour_id
      onTourGenerated(validLandmarks);

      // Wait for markers to load completely before finishing
      await finishMarkerLoading();
      
      setCurrentStep(5);

      // toast({
      //   title: "Tour Generated Successfully!",
      //   description: `Found ${validLandmarks.length} amazing places to explore in ${destination.name}`,
      // });

      // Enhanced voice agent callback with state verification
      if (onTourReadyForVoice) {
        console.log('🎙️ Calling onTourReadyForVoice with enhanced tour data');
        console.log('🎙️ Tour landmarks count:', validLandmarks.length);
        console.log('🎙️ Destination:', destination.name);
        
        onTourReadyForVoice({
          destination: destination.name,
          systemPrompt: systemPrompt,
          landmarks: validLandmarks
        });
      }

    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
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
    <MobileResponsiveDialog
      open={open}
      onOpenChange={handleClose}
      title={
        <>
          <Sparkles className="h-5 w-5 text-yellow-500" />
          Intelligent Tour Generator
        </>
      }
    >
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
              {isAutocompleteLoading && (
                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {autocompleteError && (
              <p className="text-sm text-muted-foreground mt-1 text-amber-600">
                {autocompleteError}
              </p>
            )}
          </div>

          {autocompleteResults.length > 0 && (
            <div className={`space-y-1 overflow-y-auto ${isMobile ? 'max-h-48' : 'max-h-60'}`}>
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

      {/* Step 4: Preparing Map */}
      {currentStep === 4 && (
        <div className="space-y-4 text-center">
          <div className="animate-pulse h-8 w-8 bg-blue-500 rounded-full mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">Preparing Your Map</h3>
            <p className="text-muted-foreground">
              Loading {nearbyLandmarks.length} landmarks to the map...
            </p>
            <div className="flex items-center justify-center gap-2 mt-2 text-sm text-blue-600">
              <MapPin className="h-4 w-4" />
              <span>Ensuring all markers are properly positioned</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Ready */}
      {currentStep === 5 && (
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
    </MobileResponsiveDialog>
  );
};

export default IntelligentTourDialog;
