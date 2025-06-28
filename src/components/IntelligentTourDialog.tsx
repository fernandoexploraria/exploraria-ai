import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Sparkles, MapPin, Search, Clock, Star, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';

interface IntelligentTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTourGenerated: (landmarks: any[]) => void;
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
  onTourGenerated
}) => {
  const { user, signIn, signUp } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResult[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<AutocompleteResult | null>(null);
  const [destinationDetails, setDestinationDetails] = useState<any>(null);
  const [nearbyLandmarks, setNearbyLandmarks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');
  
  // Authentication state
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  const { toast } = useToast();

  // Generate a new session token when dialog opens
  React.useEffect(() => {
    if (open && !sessionToken) {
      const newSessionToken = crypto.randomUUID();
      setSessionToken(newSessionToken);
      console.log('Generated new autocomplete session token:', newSessionToken);
    }
  }, [open, sessionToken]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        toast({
          title: "Authentication Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        if (isSignUp) {
          toast({
            title: "Check your email",
            description: "We've sent you a confirmation email. Please check your inbox and click the link to activate your account.",
          });
          setEmail('');
          setPassword('');
        } else {
          toast({
            title: "Success",
            description: "Signed in successfully!",
          });
          setEmail('');
          setPassword('');
          // User will be automatically detected by useAuth hook
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        toast({
          title: "Google Sign In Error",
          description: error.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign in with Google.",
        variant: "destructive"
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSearchDestination = async (query: string) => {
    if (query.length < 3) {
      setAutocompleteResults([]);
      return;
    }

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
    console.log('Starting tour generation for user:', user?.id, 'destination:', destination.description);
    
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
    setEmail('');
    setPassword('');
    setIsSignUp(false);
    // Generate new session token for next autocomplete session
    setSessionToken(crypto.randomUUID());
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

        {/* Show authentication UI if user is not authenticated */}
        {!user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
              <Lock className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">Authentication Required</h3>
                <p className="text-sm text-blue-700">Sign in to generate personalized tours and save your travel plans.</p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {authLoading ? 'Signing in...' : 'Continue with Google'}
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={authLoading}>
                {authLoading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </Button>
            </form>
          </div>
        ) : (
          <>
            {/* Progress Bar - only show when authenticated */}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default IntelligentTourDialog;
