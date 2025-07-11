import React, { useState } from 'react';
import { Bot, Copy, Edit, Mic, Play, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { VoiceSelector } from '@/components/VoiceSelector';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Voice {
  voice_id: string;
  name: string;
  description?: string;
}

interface VoiceAudioWizardProps {
  experienceData: {
    destination: { description: string } | null;
    voiceId: string;
    agentId?: string;
    agentName?: string;
  };
  setExperienceData: (updater: (prev: any) => any) => void;
}

const SUB_STEPS = [
  { id: 'create-agent', title: 'Create Agent', description: 'Duplicate master agent for your experience' },
  { id: 'set-name', title: 'Set Agent Name', description: 'Provide a name for your AI guide' },
  { id: 'select-voice', title: 'Select Voice', description: 'Choose the voice for your agent' },
];

export const VoiceAudioWizard: React.FC<VoiceAudioWizardProps> = ({
  experienceData,
  setExperienceData,
}) => {
  const { toast } = useToast();
  const [currentSubStep, setCurrentSubStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [voiceSelectorOpen, setVoiceSelectorOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);

  // Step 1: Create Agent (Duplicate agent_01jxtaz7mkfwzrefsdqsy3fdwe)
  const createAgent = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'duplicate_agent',
          agentId: 'agent_01jxtaz7mkfwzrefsdqsy3fdwe'
        }
      });

      if (error) throw error;

      if (data.success) {
        setExperienceData(prev => ({ ...prev, agentId: data.agent_id }));
        toast({
          title: "Agent Created",
          description: `Successfully duplicated agent with ID: ${data.agent_id}`,
        });
        
        // Auto-advance to next step and trigger automatic rename
        setTimeout(async () => {
          setCurrentSubStep(1);
          await autoRenameAgent(data.agent_id);
        }, 500);
      } else {
        throw new Error(data.error || 'Failed to create agent');
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      toast({
        title: "Agent Creation Failed",
        description: "Could not create a new agent. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Auto-rename Agent (NOT VISIBLE - uses destination name)
  const autoRenameAgent = async (agentId: string) => {
    if (!experienceData.destination?.description) return;

    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'rename_agent',
          agentId: agentId,
          newName: experienceData.destination.description
        }
      });

      if (error) throw error;

      if (data.success) {
        console.log('Agent renamed successfully to:', data.name);
        // Auto-advance to step 3 (set first message)
        setTimeout(() => setCurrentSubStep(2), 1000);
      }
    } catch (error) {
      console.error('Error renaming agent:', error);
      // Don't show error to user since this is automatic
    }
  };

  // Step 3: Set First Message
  const updateFirstMessage = async () => {
    if (!experienceData.agentId || !experienceData.agentName?.trim()) {
      return;
    }

    const firstMessage = `Hey there, I'm ${experienceData.agentName.trim()}, your {{destination}} tour guide.`;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'update_first_message',
          agentId: experienceData.agentId,
          firstMessage: firstMessage
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "First Message Set",
          description: `Updated first message for ${experienceData.agentName}`,
        });
        // Auto-advance to voice selection
        setTimeout(() => setCurrentSubStep(2), 500);
      } else {
        throw new Error(data.error || 'Failed to update first message');
      }
    } catch (error) {
      console.error('Error updating first message:', error);
      toast({
        title: "Update Failed",
        description: "Could not set the agent's first message",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Update Agent Voice
  const updateAgentVoice = async (voice: Voice) => {
    if (!experienceData.agentId) {
      toast({
        title: "No Agent Selected",
        description: "Please create an agent first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'update_voice',
          agentId: experienceData.agentId,
          voiceId: voice.voice_id
        }
      });

      if (error) throw error;

      if (data.success) {
        setExperienceData(prev => ({ ...prev, voiceId: voice.voice_id }));
        setSelectedVoice(voice);
        toast({
          title: "Voice Updated",
          description: `Agent voice changed to ${voice.name}`,
        });
      } else {
        throw new Error(data.error || 'Failed to update voice');
      }
    } catch (error) {
      console.error('Error updating voice:', error);
      toast({
        title: "Voice Update Failed",
        description: "Could not update the agent's voice",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isStepComplete = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: return !!experienceData.agentId;
      case 1: return !!experienceData.agentName?.trim();
      case 2: return !!selectedVoice || !!experienceData.voiceId;
      default: return false;
    }
  };

  return (
    <div className="space-y-6">
      <CardDescription>
        Set up your AI tour guide agent with a custom voice and personality.
      </CardDescription>

      {/* Progress Indicators */}
      <div className="flex items-center space-x-2">
        {SUB_STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index < currentSubStep
                  ? 'bg-primary text-primary-foreground'
                  : index === currentSubStep
                  ? 'bg-primary/20 text-primary border-2 border-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {index < currentSubStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="text-sm">
                <p className={`font-medium ${
                  index === currentSubStep ? 'text-primary' : index < currentSubStep ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.title}
                </p>
              </div>
            </div>
            {index < SUB_STEPS.length - 1 && (
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="space-y-4">
        {/* Step 0: Create Agent */}
        {currentSubStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bot className="h-5 w-5" />
                <span>Create Agent</span>
              </CardTitle>
              <CardDescription>
                Duplicate the master agent to create your custom tour guide
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Master Agent Template</p>
                  <p className="text-sm text-muted-foreground">
                    agent_01jxtaz7mkfwzrefsdqsy3fdwe
                  </p>
                  <Badge variant="secondary" className="mt-2">Ready to duplicate</Badge>
                </div>
                
                <Button 
                  onClick={createAgent} 
                  disabled={loading || !!experienceData.agentId}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Agent...
                    </>
                  ) : experienceData.agentId ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Agent Created
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Create Agent
                    </>
                  )}
                </Button>

                {experienceData.agentId && (
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm font-medium text-primary">Agent Created Successfully</p>
                    <p className="text-sm text-muted-foreground">Agent ID: {experienceData.agentId}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Set Agent Name */}
        {currentSubStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Edit className="h-5 w-5" />
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
                    onChange={(e) => setExperienceData(prev => ({ ...prev, agentName: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    This name will be used in the first message: "Hey there, I'm [Name], your tour guide."
                  </p>
                </div>

                <Button 
                  onClick={updateFirstMessage}
                  disabled={loading || !experienceData.agentName?.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting First Message...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Accept
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Show completed Agent Name step */}
        {currentSubStep > 1 && experienceData.agentName && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Edit className="h-5 w-5" />
                <span>Agent Name</span>
                <Check className="h-5 w-5 text-primary ml-auto" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium text-primary">First Message Set</p>
                <p className="text-sm text-muted-foreground">
                  "Hey there, I'm {experienceData.agentName}, your tour guide."
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Voice */}
        {currentSubStep >= 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mic className="h-5 w-5" />
                <span>Select Voice</span>
              </CardTitle>
              <CardDescription>
                Choose the voice that best represents your AI tour guide
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  variant="outline"
                  onClick={() => setVoiceSelectorOpen(true)}
                  className="w-full"
                >
                  <Mic className="mr-2 h-4 w-4" />
                  {selectedVoice ? `Change Voice (${selectedVoice.name})` : 'Select Voice'}
                </Button>

                {selectedVoice && (
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm font-medium text-primary">Voice Selected</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedVoice.name} - {selectedVoice.description}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Voice Selector Dialog */}
      <VoiceSelector
        isOpen={voiceSelectorOpen}
        onClose={() => setVoiceSelectorOpen(false)}
        onVoiceSelect={(voice) => {
          updateAgentVoice(voice);
          setVoiceSelectorOpen(false);
        }}
        selectedVoiceId={experienceData.voiceId}
      />
    </div>
  );
};