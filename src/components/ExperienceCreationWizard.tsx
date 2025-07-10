import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MapPin, Building, MessageSquare, Mic, Database } from 'lucide-react';
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

interface ExperienceCreationWizardProps {
  onClose: () => void;
  onExperienceCreated: () => void;
}

interface AutocompleteSuggestion {
  place_id: string;
  description: string;
  types: string[];
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
    
    // Generate initial system prompt based on destination
    const initialPrompt = generateInitialSystemPrompt(suggestion.description);
    setExperienceData(prev => ({ ...prev, systemPrompt: initialPrompt }));
    
    // Auto-advance to next step
    setTimeout(() => setCurrentStep(1), 500);
  };

  const handleLandmarkSelect = (suggestion: AutocompleteSuggestion) => {
    const newLandmark: Landmark = {
      place_id: suggestion.place_id,
      name: suggestion.structured_formatting?.main_text || suggestion.description,
      description: suggestion.description,
      types: suggestion.types,
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
      // 1. Create ElevenLabs agent
      const { data: agentData, error: agentError } = await supabase.functions.invoke('elevenlabs-agent-management', {
        body: {
          action: 'create',
          agentConfig: {
            name: experienceData.title || `${experienceData.destination.description} Experience`,
            system_prompt: experienceData.systemPrompt,
            voice_id: experienceData.voiceId,
          }
        }
      });

      if (agentError) throw agentError;

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
          agentid: agentData.agent_id,
          total_landmarks: experienceData.landmarks.length,
          generation_start_time: new Date().toISOString(),
          generation_end_time: new Date().toISOString(),
          destination_details: destinationData.data,
        })
        .select()
        .single();

      if (tourError) throw tourError;

      // 4. Create landmarks
      for (const landmark of experienceData.landmarks) {
        const { data: landmarkDetails, error: landmarkError } = await supabase.functions.invoke('google-places-details', {
          body: {
            placeId: landmark.place_id,
          }
        });

        if (!landmarkError && landmarkDetails.data) {
          await supabase
            .from('generated_landmarks')
            .insert({
              tour_id: tourData.id,
              landmark_id: landmark.place_id,
              name: landmark.name,
              description: landmark.description,
              place_id: landmark.place_id,
              types: landmark.types,
              coordinates: `(${landmarkDetails.data.location?.longitude || 0}, ${landmarkDetails.data.location?.latitude || 0})`,
              raw_data: landmarkDetails.data,
              confidence: 'high',
              coordinate_source: 'google_places_api',
            });
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <currentStepData.icon className="h-5 w-5" />
                  <span>{currentStepData.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
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
                      serviceTypes={['tourist_attraction', 'museum', 'point_of_interest', 'establishment']}
                      className="w-full"
                    />
                    
                    {experienceData.landmarks.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Selected Landmarks ({experienceData.landmarks.length})</h4>
                        <div className="space-y-2">
                          {experienceData.landmarks.map((landmark) => (
                            <div key={landmark.place_id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div>
                                <p className="font-medium">{landmark.name}</p>
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
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4">
                    <CardDescription>
                      Customize the AI guide's personality and knowledge. This prompt defines how your AI guide will interact with users.
                    </CardDescription>
                    <Textarea
                      placeholder="Define your AI guide's personality..."
                      value={experienceData.systemPrompt}
                      onChange={(e) => setExperienceData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                      rows={12}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Characters: {experienceData.systemPrompt.length}
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

                {/* Navigation */}
                <div className="flex justify-between pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
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
                      onClick={() => setCurrentStep(prev => prev + 1)}
                      disabled={!canProceed}
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};