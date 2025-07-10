import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MapPin, Building, MessageSquare, Mic, Database, Bot, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import ProximityAutocomplete from '@/components/ProximityAutocomplete';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { getHierarchicalLandmarkTypes, calculateDistance } from '@/utils/landmarkTypeHierarchy';
import { generateAlexisPrompt } from '@/utils/alexisPromptGenerator';
import { mapPriceLevel } from '@/utils/priceUtils';
import { PromptSectionViewer } from '@/components/PromptSectionViewer';
import { PersonaRefinementChat } from '@/components/PersonaRefinementChat';

interface ExperienceCreationWizardProps {
  onClose: () => void;
  onExperienceCreated: () => void;
}

interface AutocompleteSuggestion {
  place_id: string;
  description: string;
  types: string[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface Landmark {
  place_id: string;
  name: string;
  description: string;
  types: string[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface ExperienceData {
  destination: AutocompleteSuggestion | null;
  landmarks: Landmark[];
  systemPrompt: string;
  voiceId: string;
  title: string;
  description: string;
}

const WIZARD_STEPS = [
  { id: 'destination', title: 'Choose Destination', icon: MapPin },
  { id: 'landmarks', title: 'Select Landmarks', icon: Building },
  { id: 'prompt', title: 'AI Personality', icon: MessageSquare },
  { id: 'voice', title: 'Voice & Audio', icon: Mic },
  { id: 'knowledge', title: 'Knowledge Base', icon: Database },
  { id: 'review', title: 'Review & Create', icon: Check },
];

const ELEVENLABS_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Professional and clear' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Warm and engaging' },
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', description: 'Friendly and enthusiastic' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Calm and informative' },
];

export const ExperienceCreationWizard: React.FC<ExperienceCreationWizardProps> = ({
  onClose,
  onExperienceCreated,
}) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [destinationSearch, setDestinationSearch] = useState('');
  const [landmarkSearch, setLandmarkSearch] = useState('');
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  
  const [experienceData, setExperienceData] = useState<ExperienceData>({
    destination: null,
    landmarks: [],
    systemPrompt: '',
    voiceId: ELEVENLABS_VOICES[0].id,
    title: '',
    description: '',
  });

  const currentStepData = WIZARD_STEPS[currentStep];

  const handleDestinationSelect = async (suggestion: AutocompleteSuggestion) => {
    setExperienceData(prev => ({ ...prev, destination: suggestion }));
    
    // Store destination coordinates for landmark location bias
    if (suggestion.coordinates) {
      console.log('🗺️ Destination coordinates captured:', suggestion.coordinates);
    }
    
    // Auto-advance to next step
    setTimeout(() => setCurrentStep(1), 500);
  };

  const generateSystemPrompt = () => {
    if (!experienceData.destination) return '';
    
    // Convert destination format for Alexis prompt
    const destination = {
      name: experienceData.destination.structured_formatting?.main_text || experienceData.destination.description,
      placeId: experienceData.destination.place_id,
      address: experienceData.destination.description,
      coordinates: experienceData.destination.coordinates,
      types: experienceData.destination.types || []
    };

    // Use the landmarks data
    const landmarks = experienceData.landmarks.map(landmark => ({
      place_id: landmark.place_id,
      name: landmark.name,
      description: landmark.description,
      types: landmark.types,
      coordinates: landmark.coordinates
    }));

    return generateAlexisPrompt(destination, landmarks);
  };

  // Auto-generate prompt when moving to prompt step
  const handleStepChange = (newStep: number) => {
    if (newStep === 2 && currentStep === 1) {
      // Moving to AI personality step - auto-generate Alexis prompt
      const generatedPrompt = generateSystemPrompt();
      setExperienceData(prev => ({ ...prev, systemPrompt: generatedPrompt }));
    }
    setCurrentStep(newStep);
  };

  const handleLandmarkSelect = (suggestion: AutocompleteSuggestion) => {
    const newLandmark: Landmark = {
      place_id: suggestion.place_id,
      name: suggestion.structured_formatting?.main_text || suggestion.description,
      description: suggestion.description,
      types: suggestion.types,
      coordinates: suggestion.coordinates,
    };
    
    setExperienceData(prev => ({
      ...prev,
      landmarks: [...prev.landmarks, newLandmark]
    }));
    setLandmarkSearch('');
  };

  const removeLandmark = (placeId: string) => {
    setExperienceData(prev => ({
      ...prev,
      landmarks: prev.landmarks.filter(l => l.place_id !== placeId)
    }));
  };

  const generateInitialSystemPrompt = (destination: string) => {
    return `You are an enthusiastic and incredibly knowledgeable expert tour guide specializing in ${destination}. Your mission is to provide captivating facts, rich historical context, local anecdotes, and practical tips while ensuring visitor safety, comfort, and maximum enjoyment.

**Your Core Personality:**
- Enthusiastic and passionate about local history and culture
- Professional yet friendly and approachable
- Highly knowledgeable about the area's hidden gems and stories
- Focused on creating memorable experiences for visitors

**Your Expertise:**
- Deep knowledge of ${destination} and its surroundings
- Historical context and cultural significance of landmarks
- Local recommendations for dining, shopping, and activities
- Practical information about transportation, timing, and logistics

Always maintain an engaging, helpful tone and adapt to the user's interests and questions to create a personalized experience.`;
  };

  const createExperience = async () => {
    if (!user || !experienceData.destination) {
      toast.error('Missing required information');
      return;
    }

    setIsCreating(true);
    
    try {
      // 1. Create ElevenLabs agent - COMMENTED OUT FOR NOW
      // const { data: agentData, error: agentError } = await supabase.functions.invoke('elevenlabs-agent-management', {
      //   body: {
      //     action: 'create',
      //     agentConfig: {
      //       name: experienceData.title || `${experienceData.destination.description} Experience`,
      //       system_prompt: experienceData.systemPrompt,
      //       voice_id: experienceData.voiceId,
      //     }
      //   }
      // });

      // if (agentError) throw agentError;

      // 2. Get destination details
      const { data: destinationData, error: destinationError } = await supabase.functions.invoke('google-places-details', {
        body: {
          placeId: experienceData.destination.place_id,
        }
      });

      if (destinationError) throw destinationError;

      // 3. Create generated_tour
      const { data: tourData, error: tourError } = await supabase
        .from('generated_tours')
        .insert({
          user_id: user.id,
          destination: experienceData.destination.description,
          description: experienceData.description,
          system_prompt: experienceData.systemPrompt,
          experience: true,
          agentid: 'agent_01jxtaz7mkfwzrefsdqsy3fdwe',
          total_landmarks: experienceData.landmarks.length,
          generation_start_time: new Date().toISOString(),
          generation_end_time: new Date().toISOString(),
          destination_details: destinationData.data,
          photo: destinationData?.data?.photos?.[0] ? [destinationData.data.photos[0]] : null,
        })
        .select()
        .single();

      if (tourError) throw tourError;

      // 4. Create landmarks using the same process as IntelligentTourDialog
      const landmarkInserts = [];
      
      for (let index = 0; index < experienceData.landmarks.length; index++) {
        const landmark = experienceData.landmarks[index];
        const { data: landmarkDetails, error: landmarkError } = await supabase.functions.invoke('google-places-details', {
          body: {
            placeId: landmark.place_id,
          }
        });

        if (!landmarkError && landmarkDetails.data) {
          // Validate coordinates exactly like IntelligentTourDialog
          const location = landmarkDetails.data.location;
          if (location && location.longitude && location.latitude && 
              !isNaN(location.longitude) && !isNaN(location.latitude) &&
              location.longitude !== 0 && location.latitude !== 0) {
            
            landmarkInserts.push({
              tour_id: tourData.id,
              landmark_id: `landmark-${index + 1}`, // Consecutive landmark ID (same as Smart Tour)
              name: landmark.name,
              coordinates: `(${location.longitude},${location.latitude})`, // Same format as Smart Tour
              description: landmarkDetails.data.editorialSummary || `${landmark.name} - ${landmark.types?.join(', ')}`, // Same format as Smart Tour
              rating: landmarkDetails.data.rating,
              // Enhanced fields with price level mapping (same as Smart Tour)
              price_level: mapPriceLevel(landmarkDetails.data.priceLevel),
              user_ratings_total: landmarkDetails.data.userRatingsTotal,
              website_uri: landmarkDetails.data.website,
              opening_hours: landmarkDetails.data.openingHours || null, // Correct field name from API
              editorial_summary: landmarkDetails.data.editorialSummary,
              // Extract photo references from raw Google Places data (before URL conversion)
              photo_references: landmarkDetails.rawGooglePlacesData?.photos?.map((p: any) => p.name) || [],
              // Photos field (processed URLs from API)
              photos: landmarkDetails.data.photos || [],
              formatted_address: landmarkDetails.data.vicinity || landmarkDetails.data.address, // Match Smart Tour priority
              types: landmark.types || [],
              place_id: landmark.place_id,
              confidence: 'high',
              coordinate_source: 'google_places_api',
              // Store original Google Places API response (consistent with Smart Tour)
              raw_data: landmarkDetails.rawGooglePlacesData || landmarkDetails.data
            });
          } else {
            console.warn('Skipping landmark with invalid coordinates:', landmark.name, location);
          }
        }
      }

      // Bulk insert landmarks
      if (landmarkInserts.length > 0) {
        const { error: landmarksError } = await supabase
          .from('generated_landmarks')
          .insert(landmarkInserts);

        if (landmarksError) {
          console.error('Landmarks insertion error:', landmarksError);
          throw new Error(`Failed to create landmarks: ${landmarksError.message}`);
        }
      }

      toast.success('Experience created successfully!');
      onExperienceCreated();
      
    } catch (error) {
      console.error('Error creating experience:', error);
      toast.error('Failed to create experience. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const isStepComplete = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: return !!experienceData.destination;
      case 1: return experienceData.landmarks.length > 0;
      case 2: return experienceData.systemPrompt.length > 50;
      case 3: return !!experienceData.voiceId;
      case 4: return true; // Knowledge base is optional for MVP
      case 5: return experienceData.title.length > 0 && experienceData.description.length > 0;
      default: return false;
    }
  };

  const canProceed = isStepComplete(currentStep);
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Portal
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Create New Experience</h1>
              <p className="text-sm text-muted-foreground">Step {currentStep + 1} of {WIZARD_STEPS.length}</p>
            </div>
          </div>
          {currentStep === 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAiChatOpen(true)}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              AI Refine
            </Button>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Progress Sidebar */}
          <div className="col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {WIZARD_STEPS.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                      index === currentStep
                        ? 'bg-primary/10 text-primary'
                        : index < currentStep
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-full ${
                      index < currentStep
                        ? 'bg-primary text-primary-foreground'
                        : index === currentStep
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {index < currentStep ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <step.icon className="h-3 w-3" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{step.title}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            <Card className="flex flex-col h-[1050px]">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <currentStepData.icon className="h-5 w-5" />
                  <span>{currentStepData.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 flex-1 overflow-y-auto">
                {/* Step Content */}
                {currentStep === 0 && (
                  <div className="space-y-4">
                    <CardDescription>
                      Choose the main destination for your experience. This will be the central location around which your tour is built.
                    </CardDescription>
                    <ProximityAutocomplete
                      placeholder="Search for a destination (e.g., Frida Kahlo Museum, Times Square)"
                      value={destinationSearch}
                      onChange={setDestinationSearch}
                      onSuggestionSelect={handleDestinationSelect}
                      serviceTypes={['locality', 'sublocality', 'tourist_attraction', 'park', 'museum']}
                      className="w-full"
                    />
                    {experienceData.destination && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="font-medium">{experienceData.destination.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {experienceData.destination.types.slice(0, 3).map(type => (
                            <Badge key={type} variant="secondary" className="text-xs">
                              {type.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 1 && (
                  <div className="space-y-4">
                    <CardDescription>
                      Add landmarks and points of interest that will be part of your experience tour.
                    </CardDescription>
                    <ProximityAutocomplete
                      placeholder="Search for landmarks to add..."
                      value={landmarkSearch}
                      onChange={setLandmarkSearch}
                      onSuggestionSelect={handleLandmarkSelect}
                      serviceTypes={
                        experienceData.destination?.types 
                          ? getHierarchicalLandmarkTypes(experienceData.destination.types)
                          : ['tourist_attraction', 'museum', 'point_of_interest', 'establishment']
                      }
                      locationBias={
                        experienceData.destination?.coordinates 
                          ? {
                              circle: {
                                center: experienceData.destination.coordinates,
                                radius: 8000 // 8km radius around destination
                              }
                            }
                          : undefined
                      }
                      className="w-full"
                    />
                    
                    {experienceData.landmarks.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Selected Landmarks ({experienceData.landmarks.length})</h4>
                         <div className="space-y-2">
                           {experienceData.landmarks.map((landmark) => {
                             // Calculate distance from destination if both have coordinates
                             const distance = (experienceData.destination?.coordinates && landmark.coordinates) 
                               ? calculateDistance(
                                   experienceData.destination.coordinates.latitude,
                                   experienceData.destination.coordinates.longitude,
                                   landmark.coordinates.latitude,
                                   landmark.coordinates.longitude
                                 )
                               : null;
                             
                             return (
                               <div key={landmark.place_id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                 <div className="flex-1">
                                   <div className="flex items-center gap-2 mb-1">
                                     <p className="font-medium">{landmark.name}</p>
                                     {distance && (
                                       <Badge variant="outline" className="text-xs">
                                         {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance}km`}
                                       </Badge>
                                     )}
                                   </div>
                                   <p className="text-sm text-muted-foreground">{landmark.description}</p>
                                 </div>
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => removeLandmark(landmark.place_id)}
                                 >
                                   Remove
                                 </Button>
                               </div>
                             );
                           })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4">
                     <div className="flex items-center justify-between sticky top-0 bg-background z-10 pb-4 border-b">
                       <CardDescription>
                         AI personality prompt automatically generated based on your destination and landmarks using the Alexis template.
                       </CardDescription>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => {
                           const regeneratedPrompt = generateSystemPrompt();
                           setExperienceData(prev => ({ ...prev, systemPrompt: regeneratedPrompt }));
                           toast.success("Prompt regenerated with latest data");
                         }}
                       >
                         Regenerate
                       </Button>
                     </div>
                    
                    <PromptSectionViewer prompt={experienceData.systemPrompt} />
                    
                    <p className="text-xs text-muted-foreground mt-4">
                      This prompt defines how Alexis, your AI tour guide, will interact with users. It includes your destination details, landmark information, and function calling capabilities.
                    </p>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4">
                    <CardDescription>
                      Choose the voice that will represent your AI tour guide.
                    </CardDescription>
                    <div className="grid grid-cols-2 gap-4">
                      {ELEVENLABS_VOICES.map((voice) => (
                        <Card
                          key={voice.id}
                          className={`cursor-pointer transition-colors ${
                            experienceData.voiceId === voice.id
                              ? 'ring-2 ring-primary'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setExperienceData(prev => ({ ...prev, voiceId: voice.id }))}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-3">
                              <Mic className="h-4 w-4" />
                              <div>
                                <p className="font-medium">{voice.name}</p>
                                <p className="text-sm text-muted-foreground">{voice.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-4">
                    <CardDescription>
                      Upload documents and resources that will enhance your AI guide's knowledge (Coming Soon).
                    </CardDescription>
                    <div className="p-8 border-2 border-dashed border-muted rounded-lg text-center">
                      <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-medium mb-2">Knowledge Base Upload</h3>
                      <p className="text-sm text-muted-foreground">
                        Document upload and knowledge base integration will be available in the next update.
                      </p>
                    </div>
                  </div>
                )}

                {currentStep === 5 && (
                  <div className="space-y-6">
                    <CardDescription>
                      Add final details and review your experience before creating it.
                    </CardDescription>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Experience Title</label>
                        <Input
                          placeholder="e.g., Historic Downtown Walking Tour"
                          value={experienceData.title}
                          onChange={(e) => setExperienceData(prev => ({ ...prev, title: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Experience Description</label>
                        <Textarea
                          placeholder="Describe what makes this experience special..."
                          value={experienceData.description}
                          onChange={(e) => setExperienceData(prev => ({ ...prev, description: e.target.value }))}
                          rows={3}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="font-medium">Experience Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Destination:</span>
                          <p className="font-medium">{experienceData.destination?.description}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Landmarks:</span>
                          <p className="font-medium">{experienceData.landmarks.length} selected</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Voice:</span>
                          <p className="font-medium">
                            {ELEVENLABS_VOICES.find(v => v.id === experienceData.voiceId)?.name}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">System Prompt:</span>
                          <p className="font-medium">{experienceData.systemPrompt.length} characters</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              
              {/* Fixed Navigation at Bottom */}
              <div className="flex justify-between p-6 border-t bg-background">
                <Button
                  variant="outline"
                  onClick={() => handleStepChange(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                
                {isLastStep ? (
                  <Button
                    onClick={createExperience}
                    disabled={!canProceed || isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Create Experience'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleStepChange(currentStep + 1)}
                    disabled={!canProceed}
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* AI Persona Refinement Chat */}
      <PersonaRefinementChat
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        initialPrompt={experienceData.systemPrompt}
        destination={experienceData.destination?.description || ''}
        landmarks={experienceData.landmarks}
        onPromptRefined={(refinedPrompt) => {
          setExperienceData(prev => ({ ...prev, systemPrompt: refinedPrompt }));
        }}
      />
    </div>
  );
};