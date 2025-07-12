import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MapPin, Building, MessageSquare, Mic, Database, Bot, Sparkles, Upload, FileText, Link, BookOpen, X, FileIcon, Globe, PenTool } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface KnowledgeBaseDocument {
  id: string;
  name: string;
  type: 'file' | 'url' | 'text';
  size?: number;
  status: 'uploading' | 'processing' | 'indexed' | 'failed' | 'associated';
  error?: string;
}

interface ExperienceData {
  destination: AutocompleteSuggestion | null;
  landmarks: Landmark[];
  systemPrompt: string;
  voiceId: string;
  title: string;
  description: string;
  agentId?: string;
  agentName?: string;
  knowledgeBaseDocs?: KnowledgeBaseDocument[];
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
  
  const [experienceData, setExperienceData] = useState<ExperienceData>({
    destination: null,
    landmarks: [],
    systemPrompt: '',
    voiceId: ELEVENLABS_VOICES[0].id,
    title: '',
    description: '',
    agentId: undefined,
    agentName: '',
    knowledgeBaseDocs: [],
  });

  // Knowledge Base State
  const [isKnowledgeDialogOpen, setIsKnowledgeDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'url' | 'text'>('file');
  const [uploadFiles, setUploadFiles] = useState<Array<{id: string, file: File, title: string, name: string, size: number}>>([]);
  const [uploadUrls, setUploadUrls] = useState<Array<{id: string, url: string, title: string}>>([]);
  const [textToUpload, setTextToUpload] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [isUploadingKnowledge, setIsUploadingKnowledge] = useState(false);

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

  // Knowledge Base Functions
  const addFileToUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles = Array.from(files).map(file => ({
      id: `file-${Date.now()}-${Math.random()}`,
      file,
      title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      name: file.name,
      size: file.size
    }));

    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const updateFileTitle = (fileId: string, title: string) => {
    setUploadFiles(prev => prev.map(f => f.id === fileId ? { ...f, title } : f));
  };

  const addUrlToUpload = () => {
    const newUrl = {
      id: `url-${Date.now()}-${Math.random()}`,
      url: '',
      title: ''
    };
    setUploadUrls(prev => [...prev, newUrl]);
  };

  const removeUrl = (urlId: string) => {
    setUploadUrls(prev => prev.filter(u => u.id !== urlId));
  };

  const updateUrlData = (urlId: string, field: 'url' | 'title', value: string) => {
    setUploadUrls(prev => prev.map(u => u.id === urlId ? { ...u, [field]: value } : u));
  };

  const uploadKnowledgeBase = async () => {
    if (!experienceData.agentId) {
      toast.error('No agent found. Please complete previous steps first.');
      return;
    }

    setIsUploadingKnowledge(true);
    const uploadedDocs: KnowledgeBaseDocument[] = [];
    const knowledgeBaseIds: string[] = [];

    try {
      // Process files
      if (uploadType === 'file' && uploadFiles.length > 0) {
        for (const fileObj of uploadFiles) {
          const doc: KnowledgeBaseDocument = {
            id: fileObj.id,
            name: fileObj.title || fileObj.name,
            type: 'file',
            size: fileObj.size,
            status: 'uploading'
          };
          uploadedDocs.push(doc);

          try {
            const arrayBuffer = await fileObj.file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

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
              },
            });

            if (error) throw new Error(error.message);
            
            doc.status = 'indexed';
            if (data.knowledgeBaseId) {
              knowledgeBaseIds.push(data.knowledgeBaseId);
            }
            console.log(`File uploaded successfully:`, data);
          } catch (error: any) {
            doc.status = 'failed';
            doc.error = error.message;
            console.error(`File upload failed:`, error);
          }
        }
      }

      // Process URLs
      if (uploadType === 'url' && uploadUrls.length > 0) {
        for (const urlObj of uploadUrls.filter(u => u.url.trim())) {
          const doc: KnowledgeBaseDocument = {
            id: urlObj.id,
            name: urlObj.title || urlObj.url,
            type: 'url',
            status: 'uploading'
          };
          uploadedDocs.push(doc);

          try {
            const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
              body: {
                action: 'upload_url',
                url: urlObj.url,
                title: urlObj.title || urlObj.url
              },
            });

            if (error) throw new Error(error.message);
            
            doc.status = 'indexed';
            if (data.knowledgeBaseId) {
              knowledgeBaseIds.push(data.knowledgeBaseId);
            }
            console.log(`URL uploaded successfully:`, data);
          } catch (error: any) {
            doc.status = 'failed';
            doc.error = error.message;
            console.error(`URL upload failed:`, error);
          }
        }
      }

      // Process text
      if (uploadType === 'text' && textToUpload.trim()) {
        const doc: KnowledgeBaseDocument = {
          id: `text-${Date.now()}`,
          name: textTitle || 'Text Document',
          type: 'text',
          status: 'uploading'
        };
        uploadedDocs.push(doc);

        try {
          const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
            body: {
              action: 'upload_text',
              text: textToUpload,
              title: textTitle || 'Text Document'
            },
          });

          if (error) throw new Error(error.message);
          
          doc.status = 'indexed';
          if (data.knowledgeBaseId) {
            knowledgeBaseIds.push(data.knowledgeBaseId);
          }
          console.log(`Text uploaded successfully:`, data);
        } catch (error: any) {
          doc.status = 'failed';
          doc.error = error.message;
          console.error(`Text upload failed:`, error);
        }
      }

      // Associate knowledge bases with agent if we have any successful uploads
      if (knowledgeBaseIds.length > 0) {
        try {
          // Get unique knowledge base IDs
          const uniqueKnowledgeBaseIds = [...new Set(knowledgeBaseIds)];
          
          // Create knowledge base objects for the agent update
          const knowledgeBases = uniqueKnowledgeBaseIds.map(id => ({
            type: 'file',
            name: 'Knowledge Base',
            id: id,
            usage_mode: 'auto'
          }));

          console.log('Associating knowledge bases with agent:', experienceData.agentId, knowledgeBases);

          const { data: updateData, error: updateError } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
            body: {
              action: 'update_agent_knowledge',
              agentId: experienceData.agentId,
              knowledgeBases: knowledgeBases
            },
          });

          if (updateError) {
            console.error('Failed to associate knowledge with agent:', updateError);
            toast.error('Documents uploaded but failed to associate with agent');
          } else {
            console.log('Successfully associated knowledge with agent:', updateData);
            
            // Mark all successful uploads as properly associated
            uploadedDocs.forEach(doc => {
              if (doc.status === 'indexed') {
                doc.status = 'associated';
              }
            });
          }
        } catch (error: any) {
          console.error('Agent knowledge association error:', error);
          toast.error('Documents uploaded but failed to associate with agent');
        }
      }

      // Update experience data
      setExperienceData(prev => ({
        ...prev,
        knowledgeBaseDocs: [...(prev.knowledgeBaseDocs || []), ...uploadedDocs]
      }));

      // Reset upload state
      setUploadFiles([]);
      setUploadUrls([]);
      setTextToUpload('');
      setTextTitle('');
      setIsKnowledgeDialogOpen(false);

      const successCount = uploadedDocs.filter(d => d.status === 'associated' || d.status === 'indexed').length;
      const failCount = uploadedDocs.filter(d => d.status === 'failed').length;

      if (successCount > 0) {
        toast.success(`Successfully uploaded and associated ${successCount} document${successCount !== 1 ? 's' : ''} with your agent`);
      }
      if (failCount > 0) {
        toast.error(`Failed to upload ${failCount} document${failCount !== 1 ? 's' : ''}`);
      }

    } catch (error: any) {
      console.error('Knowledge base upload error:', error);
      toast.error('Failed to upload documents. Please try again.');
    } finally {
      setIsUploadingKnowledge(false);
    }
  };

  const removeKnowledgeDoc = (docId: string) => {
    setExperienceData(prev => ({
      ...prev,
      knowledgeBaseDocs: prev.knowledgeBaseDocs?.filter(doc => doc.id !== docId) || []
    }));
  };

  const isStepComplete = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: return !!experienceData.destination;
      case 1: return experienceData.landmarks.length > 0;
      case 2: return experienceData.systemPrompt.length > 50;
      case 3: return !!experienceData.agentId && !!experienceData.agentName?.trim() && !!experienceData.voiceId;
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
            <Card className="flex flex-col h-[1050px]">
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
                      <PromptSectionViewer 
                        prompt={experienceData.systemPrompt} 
                        onAiRefine={() => setIsAiChatOpen(true)}
                        onSection2Refine={() => setIsSection2ChatOpen(true)}
                      />
                     
                     <p className="text-xs text-muted-foreground mt-4">
                       This prompt defines how Alexis, your AI tour guide, will interact with users. It includes your destination details, landmark information, and function calling capabilities.
                     </p>
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
                      Upload documents, websites, or text content to enhance your AI guide's knowledge. This is optional but will help your guide provide more detailed and accurate information.
                    </CardDescription>
                    
                    {/* Upload Button and Status */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Knowledge Base Documents</h4>
                        <p className="text-sm text-muted-foreground">
                          {experienceData.knowledgeBaseDocs?.length || 0} document{experienceData.knowledgeBaseDocs?.length !== 1 ? 's' : ''} uploaded
                        </p>
                      </div>
                      <Button 
                        onClick={() => setIsKnowledgeDialogOpen(true)}
                        disabled={!experienceData.agentId}
                        className="flex items-center space-x-2"
                      >
                        <Upload className="h-4 w-4" />
                        <span>Upload Documents</span>
                      </Button>
                    </div>

                    {!experienceData.agentId && (
                      <div className="p-4 bg-muted/50 border border-border rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Complete the Voice & Audio step to enable knowledge base uploads.
                        </p>
                      </div>
                    )}

                    {/* Document List */}
                    {experienceData.knowledgeBaseDocs && experienceData.knowledgeBaseDocs.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="font-medium text-sm">Uploaded Documents</h5>
                        <div className="space-y-2">
                          {experienceData.knowledgeBaseDocs.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-muted rounded-lg">
                                  {doc.type === 'file' && <FileText className="h-4 w-4 text-primary" />}
                                  {doc.type === 'url' && <Globe className="h-4 w-4 text-primary" />}
                                  {doc.type === 'text' && <PenTool className="h-4 w-4 text-primary" />}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{doc.name}</p>
                                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                    <span className="capitalize">{doc.type}</span>
                                    {doc.size && <span>• {(doc.size / 1024).toFixed(1)} KB</span>}
                                    <span>•</span>
                                    <Badge 
                                      variant={
                                        doc.status === 'indexed' ? 'default' :
                                        doc.status === 'failed' ? 'destructive' :
                                        'secondary'
                                      }
                                      className="text-xs"
                                    >
                                      {doc.status === 'indexed' ? 'Ready' : 
                                       doc.status === 'failed' ? 'Failed' :
                                       doc.status === 'processing' ? 'Processing' : 'Uploading'}
                                    </Badge>
                                  </div>
                                  {doc.error && (
                                    <p className="text-xs text-destructive mt-1">{doc.error}</p>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeKnowledgeDoc(doc.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty State */}
                    {(!experienceData.knowledgeBaseDocs || experienceData.knowledgeBaseDocs.length === 0) && experienceData.agentId && (
                      <div className="p-8 border-2 border-dashed border-muted rounded-lg text-center">
                        <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="font-medium mb-2">No Documents Uploaded</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Add documents to enhance your AI guide's knowledge about specific topics, locations, or historical details.
                        </p>
                        <Button 
                          onClick={() => setIsKnowledgeDialogOpen(true)}
                          variant="outline"
                          className="flex items-center space-x-2"
                        >
                          <Upload className="h-4 w-4" />
                          <span>Upload Your First Document</span>
                        </Button>
                      </div>
                    )}
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
                        <div>
                          <span className="text-muted-foreground">Knowledge Base:</span>
                          <p className="font-medium">
                            {experienceData.knowledgeBaseDocs?.length || 0} document{experienceData.knowledgeBaseDocs?.length !== 1 ? 's' : ''}
                          </p>
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

      {/* Knowledge Base Upload Dialog */}
      <Dialog open={isKnowledgeDialogOpen} onOpenChange={setIsKnowledgeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Upload Knowledge Documents</span>
            </DialogTitle>
            <DialogDescription>
              Enhance your AI guide's knowledge with documents, websites, or text content. All uploads are processed with RAG indexing for optimal retrieval.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* Upload Type Tabs */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg">
              {[
                { id: 'file', label: 'Files', icon: FileIcon, description: 'PDF, TXT, DOC, DOCX, EPUB' },
                { id: 'url', label: 'Websites', icon: Globe, description: 'Web pages & articles' },
                { id: 'text', label: 'Text', icon: PenTool, description: 'Paste content directly' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setUploadType(tab.id as 'file' | 'url' | 'text')}
                  className={`flex-1 flex flex-col items-center justify-center space-y-1 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                    uploadType === tab.id 
                      ? 'bg-background text-foreground shadow-sm border border-border' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  <span className="text-xs text-muted-foreground">{tab.description}</span>
                </button>
              ))}
            </div>

            {/* File Upload */}
            {uploadType === 'file' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-muted/20 hover:bg-muted/30 transition-colors">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.doc,.docx,.epub"
                    onChange={addFileToUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label 
                    htmlFor="file-upload" 
                    className="cursor-pointer flex flex-col items-center space-y-3"
                  >
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <FileIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Click to upload files or drag and drop</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Supported formats: PDF, TXT, DOC, DOCX, EPUB
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum 10MB per file • Processed with RAG indexing
                      </p>
                    </div>
                  </label>
                </div>
                
                {uploadFiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Files to Upload ({uploadFiles.length})</h4>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setUploadFiles([])}
                        className="text-xs"
                      >
                        Clear All
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {uploadFiles.map((fileObj) => (
                        <div key={fileObj.id} className="flex items-center space-x-3 p-3 border border-border rounded-lg bg-card">
                          <FileIcon className="h-4 w-4 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <p className="font-medium text-sm truncate">{fileObj.name}</p>
                              <Badge variant="outline" className="text-xs">
                                {(fileObj.size / 1024).toFixed(1)} KB
                              </Badge>
                            </div>
                            <Input
                              value={fileObj.title}
                              onChange={(e) => updateFileTitle(fileObj.id, e.target.value)}
                              placeholder="Optional: Custom title for this document"
                              className="text-sm h-8"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(fileObj.id)}
                            className="text-muted-foreground hover:text-destructive flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* URL Upload */}
            {uploadType === 'url' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Website URLs</h4>
                    <p className="text-sm text-muted-foreground">Add website URLs to scrape content from web pages</p>
                  </div>
                  <Button onClick={addUrlToUpload} variant="outline" size="sm">
                    <Link className="mr-2 h-4 w-4" />
                    Add URL
                  </Button>
                </div>
                
                {uploadUrls.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                    <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No URLs added yet.</p>
                    <p className="text-xs mt-1">Web content will be processed with RAG indexing.</p>
                  </div>
                )}
                
                {uploadUrls.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {uploadUrls.map((urlObj) => (
                      <div key={urlObj.id} className="space-y-2 p-3 border border-border rounded-lg bg-card">
                        <div className="flex items-center space-x-2">
                          <Input
                            value={urlObj.url}
                            onChange={(e) => updateUrlData(urlObj.id, 'url', e.target.value)}
                            placeholder="https://example.com/article"
                            className="flex-1 h-8"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUrl(urlObj.id)}
                            className="text-muted-foreground hover:text-destructive flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          value={urlObj.title}
                          onChange={(e) => updateUrlData(urlObj.id, 'title', e.target.value)}
                          placeholder="Optional: Custom title for this URL"
                          className="text-sm h-8"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Text Upload */}
            {uploadType === 'text' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Text Content</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Paste or type content directly. This will be processed with RAG indexing for optimal retrieval.
                  </p>
                  <Input
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    placeholder="Document title (e.g., 'Historical Facts about Downtown')"
                    className="mb-3"
                  />
                  <Textarea
                    value={textToUpload}
                    onChange={(e) => setTextToUpload(e.target.value)}
                    placeholder="Paste your text content here... Include any relevant information about your destination, historical facts, local tips, or other knowledge you want your AI guide to know about."
                    className="min-h-[200px] resize-none"
                    rows={8}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-muted-foreground">
                      {textToUpload.length} characters
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Processed with RAG indexing
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setIsKnowledgeDialogOpen(false)}
              disabled={isUploadingKnowledge}
            >
              Cancel
            </Button>
            <Button
              onClick={uploadKnowledgeBase}
              disabled={isUploadingKnowledge || (
                (uploadType === 'file' && uploadFiles.length === 0) ||
                (uploadType === 'url' && uploadUrls.filter(u => u.url.trim()).length === 0) ||
                (uploadType === 'text' && !textToUpload.trim())
              )}
              className="flex items-center space-x-2"
            >
              {isUploadingKnowledge ? (
                <>
                  <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>
                    {uploadType === 'file' ? `Upload ${uploadFiles.length} File${uploadFiles.length !== 1 ? 's' : ''}` :
                     uploadType === 'url' ? `Upload ${uploadUrls.filter(u => u.url.trim()).length} URL${uploadUrls.filter(u => u.url.trim()).length !== 1 ? 's' : ''}` :
                     'Upload Text Content'}
                  </span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};