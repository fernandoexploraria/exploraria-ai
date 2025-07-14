import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MapPin, Building, MessageSquare, Mic, Database, Bot, Sparkles, CheckCircle, File, Link, FileText } from 'lucide-react';
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
import { Section2RefinementChat } from '@/components/Section2RefinementChat';
import { VoiceSelector } from '@/components/VoiceSelector';
import { VoiceAudioWizard } from '@/components/VoiceAudioWizard';

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
  description: string;
  agentId?: string;
  agentName?: string;
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
  const [isSection2ChatOpen, setIsSection2ChatOpen] = useState(false);
  
  // Knowledge base upload state
  const [uploadType, setUploadType] = useState<'file' | 'url' | 'text'>('file');
  const [uploadFiles, setUploadFiles] = useState<Array<{id: string, file: File, title: string, name: string, size: number}>>([]);
  const [uploadUrls, setUploadUrls] = useState<Array<{id: string, url: string, title: string}>>([]);
  const [textToUpload, setTextToUpload] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [isAssociatingKnowledgeBase, setIsAssociatingKnowledgeBase] = useState(false);
  const [uploadedKnowledgeBases, setUploadedKnowledgeBases] = useState<Array<{
    id: string;
    name: string;
    fileName?: string; // For files
    url?: string;      // For URLs
    type: 'file' | 'text' | 'url';
  }>>([]);
  
  const [experienceData, setExperienceData] = useState<ExperienceData>({
    destination: null,
    landmarks: [],
    systemPrompt: '',
    voiceId: ELEVENLABS_VOICES[0].id,
    description: '',
    agentId: undefined,
    agentName: '',
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

    return generateAlexisPrompt(destination, landmarks, undefined, experienceData.agentName || 'Alexis');
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

  // Knowledge base upload handlers (from playground)
  const addFileToUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    files.forEach(file => {
      const fileObj = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        file,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        name: file.name,
        size: file.size
      };
      setUploadFiles(prev => [...prev, fileObj]);
    });
  };

  const updateFileTitle = (fileId: string, newTitle: string) => {
    setUploadFiles(prev => prev.map(f => f.id === fileId ? { ...f, title: newTitle } : f));
  };

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const addUrl = () => {
    const newUrl = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      url: '',
      title: ''
    };
    setUploadUrls(prev => [...prev, newUrl]);
  };

  const updateUrl = (urlId: string, field: 'url' | 'title', value: string) => {
    setUploadUrls(prev => prev.map(u => u.id === urlId ? { ...u, [field]: value } : u));
  };

  const removeUrl = (urlId: string) => {
    setUploadUrls(prev => prev.filter(u => u.id !== urlId));
  };

  const uploadDocuments = async () => {
    if (uploadFiles.length === 0 && uploadUrls.length === 0 && !textToUpload.trim()) {
      toast.error('Please add some content to upload');
      return;
    }

    setUploadingDocuments(true);

    try {
      // Upload files
      for (const fileObj of uploadFiles) {
        const arrayBuffer = await fileObj.file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        console.log('Uploading file:', fileObj.file.name);
        const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
          body: {
            action: 'upload_file',
            file: {
              data: Array.from(uint8Array),
              name: fileObj.file.name,
              type: fileObj.file.type,
              size: fileObj.file.size
            },
            title: fileObj.title
          }
        });

        if (error) {
          throw new Error(`Failed to upload ${fileObj.title}: ${error.message}`);
        }

        if (data?.knowledgeBaseId) {
          setUploadedKnowledgeBases(prev => [...prev, {
            id: data.knowledgeBaseId,
            name: fileObj.title,
            fileName: fileObj.file.name,
            type: 'file'
          }]);
          console.log('File uploaded successfully:', data.knowledgeBaseId);
        }
      }

      // Upload URLs
      for (const urlObj of uploadUrls) {
        if (urlObj.url.trim()) {
          console.log('Uploading URL:', urlObj.url);
          const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
            body: {
              action: 'upload_url',
              url: urlObj.url,
              title: urlObj.title || urlObj.url
            }
          });

          if (error) {
            throw new Error(`Failed to upload URL ${urlObj.url}: ${error.message}`);
          }

          if (data?.knowledgeBaseId) {
            setUploadedKnowledgeBases(prev => [...prev, {
              id: data.knowledgeBaseId,
              name: urlObj.title || urlObj.url,
              url: urlObj.url,
              type: 'url'
            }]);
            console.log('URL uploaded successfully:', data.knowledgeBaseId);
          }
        }
      }

      // Upload text
      if (textToUpload.trim()) {
        console.log('Uploading text document');
        const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
          body: {
            action: 'upload_text',
            text: textToUpload,
            title: textTitle || 'Text Document'
          }
        });

        if (error) {
          throw new Error(`Failed to upload text: ${error.message}`);
        }

        if (data?.knowledgeBaseId) {
          setUploadedKnowledgeBases(prev => [...prev, {
            id: data.knowledgeBaseId,
            name: textTitle || 'Text Document',
            type: 'text'
          }]);
          console.log('Text uploaded successfully:', data.knowledgeBaseId);
        }
      }

      toast.success(`Successfully uploaded ${uploadFiles.length + uploadUrls.filter(u => u.url.trim()).length + (textToUpload.trim() ? 1 : 0)} documents!`);
      
      // Clear upload queues
      setUploadFiles([]);
      setUploadUrls([]);
      setTextToUpload('');
      setTextTitle('');

    } catch (error) {
      console.error('Document upload error:', error);
      toast.error(error.message || "Failed to upload documents");
    } finally {
      setUploadingDocuments(false);
    }
  };

  const handleAssociateKnowledgeBase = async () => {
    // Validate agent ID exists (from Voice & Audio step)
    if (!experienceData.agentId) {
      toast.error('Please complete Voice & Audio setup first');
      return;
    }

    // Validate we have knowledge base items to associate
    if (uploadedKnowledgeBases.length === 0) {
      toast.error('No knowledge base items to associate');
      return;
    }

    setIsAssociatingKnowledgeBase(true);

    try {
      console.log('Associating knowledge bases with agent:', experienceData.agentId);
      console.log('Knowledge bases to associate:', uploadedKnowledgeBases);

      const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
        body: {
          action: 'update_agent_knowledge',
          agentId: experienceData.agentId,
          knowledgeBases: uploadedKnowledgeBases
        }
      });

      if (error) {
        throw new Error(`Failed to associate knowledge bases: ${error.message}`);
      }

      toast.success(`Successfully associated ${uploadedKnowledgeBases.length} knowledge base items with your agent!`);
      console.log('Knowledge bases associated successfully:', data);

    } catch (error) {
      console.error('Error associating knowledge bases:', error);
      toast.error(error.message || 'Failed to associate knowledge bases with agent');
    } finally {
      setIsAssociatingKnowledgeBase(false);
    }
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

    // Ensure we have a custom agent ID from the Voice & Audio phase
    if (!experienceData.agentId) {
      toast.error('Please complete the Voice & Audio setup to create a custom agent');
      return;
    }

    console.log('Creating experience with agent ID:', experienceData.agentId);
    
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
          agentid: experienceData.agentId, // Use the new agent created in Voice & Audio phase
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
      case 3: return !!experienceData.agentId && !!experienceData.agentName?.trim() && !!experienceData.voiceId;
      case 4: return true; // Knowledge base is optional for MVP
      case 5: return experienceData.description.length > 0;
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

      <div className="container mx-auto px-4 py-2 h-[calc(100vh-6rem)]">
        <div className="grid grid-cols-12 gap-4 h-full">
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
            <Card className="flex flex-col h-full">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <currentStepData.icon className="h-5 w-5" />
                  <span>{currentStepData.title}</span>
                </CardTitle>
                {currentStep === 2 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
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
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">AI Personality Breakdown</h4>
                        <p className="text-sm text-muted-foreground">
                          Your AI guide's prompt organized into logical sections
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {experienceData.systemPrompt.length.toLocaleString()} characters
                      </Badge>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6 flex-1 overflow-y-auto max-h-[calc(100vh-20rem)]">
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
                    <div className="space-y-6">
                      {/* Agent Name Input - First thing in Step 3 */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-2">
                            <Bot className="h-5 w-5" />
                            <span>Agent Name</span>
                          </CardTitle>
                          <CardDescription>
                            Give your AI tour guide a name that visitors will recognize
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium mb-2">Agent Name</label>
                              <Input
                                placeholder="e.g., Sofia, Marco, Alex..."
                                value={experienceData.agentName || ''}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  setExperienceData(prev => ({ ...prev, agentName: newName }));
                                  // Regenerate system prompt with new name
                                  if (experienceData.destination && newName.trim()) {
                                    const generatedPrompt = generateSystemPrompt();
                                    setExperienceData(current => ({ ...current, systemPrompt: generatedPrompt }));
                                  }
                                }}
                              />
                              <p className="text-xs text-muted-foreground mt-2">
                                This name will be used throughout the system prompt and first message
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-4">
                       <PromptSectionViewer 
                         prompt={experienceData.systemPrompt} 
                         onAiRefine={() => setIsAiChatOpen(true)}
                         onSection2Refine={() => setIsSection2ChatOpen(true)}
                       />
                      
                      <p className="text-xs text-muted-foreground mt-4">
                        This prompt defines how {experienceData.agentName || 'your AI tour guide'} will interact with users. It includes your destination details, landmark information, and function calling capabilities.
                      </p>
                      </div>
                    </div>
                  )}

                {currentStep === 3 && (
                  <VoiceAudioWizard 
                    experienceData={experienceData}
                    setExperienceData={setExperienceData}
                  />
                )}

                {currentStep === 4 && (
                  <div className="space-y-6">
                    <CardDescription>
                      Upload documents, URLs, and text content to enhance your AI guide's knowledge base.
                    </CardDescription>
                    
                    {/* Upload Type Tabs */}
                    <div className="flex space-x-1 bg-muted p-1 rounded-lg">
                      {[
                        { id: 'file', label: 'Files', icon: '📄' },
                        { id: 'url', label: 'URLs', icon: '🔗' },
                        { id: 'text', label: 'Text', icon: '📝' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setUploadType(tab.id as 'file' | 'url' | 'text')}
                          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                            uploadType === tab.id 
                              ? 'bg-background text-foreground shadow-sm' 
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <span>{tab.icon}</span>
                          <span>{tab.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* File Upload Section */}
                    {uploadType === 'file' && (
                      <div className="space-y-4">
                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.txt,.doc,.docx,.epub"
                            onChange={addFileToUpload}
                            className="hidden"
                            id="file-upload"
                          />
                          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center space-y-2">
                            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                              <span className="text-2xl">📁</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Click to upload files</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Supported: PDF, TXT, DOC, DOCX, EPUB (with RAG indexing)
                              </p>
                            </div>
                          </label>
                        </div>
                        
                        {uploadFiles.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-semibold flex items-center space-x-2">
                              <span>📄</span>
                              <span>Files to Upload ({uploadFiles.length})</span>
                            </h4>
                            {uploadFiles.map((fileObj) => (
                              <div key={fileObj.id} className="flex items-start space-x-3 p-4 border border-border rounded-lg bg-muted/30">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <p className="font-medium text-sm">{fileObj.name}</p>
                                    <Badge variant="outline" className="text-xs">
                                      {(fileObj.size / 1024).toFixed(1)} KB
                                    </Badge>
                                  </div>
                                  <Input
                                    value={fileObj.title}
                                    onChange={(e) => updateFileTitle(fileObj.id, e.target.value)}
                                    placeholder="Enter document title"
                                    className="text-sm"
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(fileObj.id)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* URL Upload Section */}
                    {uploadType === 'url' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">URLs to Upload</h4>
                          <Button onClick={addUrl} size="sm" variant="outline">
                            Add URL
                          </Button>
                        </div>
                        
                        {uploadUrls.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>No URLs added yet. Click "Add URL" to get started.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {uploadUrls.map((urlObj) => (
                              <div key={urlObj.id} className="flex items-start space-x-3 p-4 border border-border rounded-lg bg-muted/30">
                                <div className="flex-1 space-y-2">
                                  <Input
                                    value={urlObj.url}
                                    onChange={(e) => updateUrl(urlObj.id, 'url', e.target.value)}
                                    placeholder="Enter URL (e.g., https://example.com)"
                                    className="text-sm"
                                  />
                                  <Input
                                    value={urlObj.title}
                                    onChange={(e) => updateUrl(urlObj.id, 'title', e.target.value)}
                                    placeholder="Enter title (optional)"
                                    className="text-sm"
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeUrl(urlObj.id)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text Upload Section */}
                    {uploadType === 'text' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Document Title</label>
                          <Input
                            value={textTitle}
                            onChange={(e) => setTextTitle(e.target.value)}
                            placeholder="Enter a title for this text document"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Text Content</label>
                          <Textarea
                            value={textToUpload}
                            onChange={(e) => setTextToUpload(e.target.value)}
                            placeholder="Paste or type your text content here..."
                            rows={8}
                            className="resize-none"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Characters: {textToUpload.length}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Upload Button and Status */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        {uploadFiles.length > 0 || uploadUrls.length > 0 || textToUpload.trim() ? (
                          `Ready to upload: ${uploadFiles.length} files, ${uploadUrls.filter(u => u.url.trim()).length} URLs, ${textToUpload.trim() ? 1 : 0} text`
                        ) : (
                          'Add content to upload to the knowledge base'
                        )}
                      </div>
                      <Button
                        onClick={uploadDocuments}
                        disabled={uploadingDocuments || (uploadFiles.length === 0 && uploadUrls.length === 0 && !textToUpload.trim())}
                      >
                        {uploadingDocuments ? 'Processing...' : 'Process'}
                      </Button>
                    </div>

                    <Separator />

                     {/* ALWAYS VISIBLE: Files/URLs/txt added to knowledgebase section */}
                     <div className="space-y-3 p-4 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950/50 dark:border-blue-800">
                        <div className="flex items-center justify-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <Database className="h-5 w-5 text-blue-600" />
                            <span>Files/URLs/txt added to knowledgebase</span>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleAssociateKnowledgeBase}
                            disabled={isAssociatingKnowledgeBase || uploadedKnowledgeBases.length === 0}
                          >
                            {isAssociatingKnowledgeBase ? 'Associating...' : '+ Knowledgebase'}
                          </Button>
                        </div>
                       
                       {uploadedKnowledgeBases.length === 0 ? (
                         <div className="text-center py-4">
                           <p className="text-sm text-muted-foreground">No files uploaded to ElevenLabs yet</p>
                           <p className="text-xs text-muted-foreground mt-1">Upload documents above and they will appear here</p>
                         </div>
                       ) : (
                         <div className="space-y-2 max-h-60 overflow-y-auto">
                           {uploadedKnowledgeBases.map((kb) => (
                             <div key={kb.id} className="flex items-center justify-between p-3 bg-white border border-green-300 rounded-lg dark:bg-green-900/30 dark:border-green-700">
                               <div className="flex items-center space-x-3">
                                 <div className="flex-shrink-0">
                                   {kb.type === 'file' && <File className="h-5 w-5 text-blue-600" />}
                                   {kb.type === 'url' && <Link className="h-5 w-5 text-purple-600" />}
                                   {kb.type === 'text' && <FileText className="h-5 w-5 text-orange-600" />}
                                 </div>
                                 <div className="min-w-0 flex-1">
                                   <p className="font-medium text-sm truncate">{kb.name}</p>
                                   <p className="text-xs text-muted-foreground">
                                     {kb.type === 'file' && kb.fileName && (
                                       <>File: {kb.fileName}</>
                                     )}
                                     {kb.type === 'url' && kb.url && (
                                       <>URL: {kb.url}</>
                                     )}
                                     {kb.type === 'text' && (
                                       <>Text Document</>
                                     )}
                                   </p>
                                 </div>
                               </div>
                               <div className="flex items-center space-x-2">
                                 <Badge variant="secondary" className="text-xs capitalize">
                                   {kb.type}
                                 </Badge>
                                 <Badge className="text-xs bg-green-600 text-white">
                                   ✓ Processed
                                 </Badge>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
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
                           <span className="text-muted-foreground">Knowledge Bases:</span>
                           <p className="font-medium">{uploadedKnowledgeBases.length} associated</p>
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

      {/* Section 2 (Core Mission) Refinement Chat */}
      <Section2RefinementChat
        isOpen={isSection2ChatOpen}
        onClose={() => setIsSection2ChatOpen(false)}
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