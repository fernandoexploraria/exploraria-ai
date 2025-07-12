import React, { useState } from 'react';
import { Bot, Copy, Edit, Mic, Play, ArrowRight, Check, Loader2, BookOpen, Upload, FileText, Link, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  { id: 'add-knowledge', title: 'Add Knowledge', description: 'Add knowledge bases to your agent' },
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
  
  // Knowledge base state
  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<Array<{id: string, file: File, title: string, name: string, type: string, size: number}>>([]);
  const [uploadUrls, setUploadUrls] = useState<Array<{id: string, url: string, title: string}>>([]);
  const [uploadType, setUploadType] = useState<'file' | 'url' | 'text'>('file');
  const [textToUpload, setTextToUpload] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [uploadedKnowledgeBases, setUploadedKnowledgeBases] = useState<Array<{
    id: string;
    name: string;
    type: 'file' | 'text' | 'url';
  }>>([]);

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
        // Stay on step 1 - let user manually proceed by clicking Accept
        // DO NOT auto-advance to step 2
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
        // Don't auto-advance, let user manually proceed to voice selection
        setCurrentSubStep(2);
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

  // Knowledge base functions (copied from playground)
  const handleDocumentUpload = async () => {
    if (uploadFiles.length === 0 && uploadUrls.length === 0 && (!textToUpload || uploadType !== 'text')) {
      toast({
        title: "No Documents to Upload",
        description: "Please add some files, URLs, or text to upload.",
        variant: "destructive"
      });
      return;
    }

    setUploadingDocuments(true);
    let successfulUploads = [];
    let failedUploads = [];

    try {
      if (uploadType === 'file') {
        for (const fileObj of uploadFiles) {
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
            
            if (error) throw new Error(error.message || 'Upload failed');
            
            successfulUploads.push({
              file: fileObj.file.name,
              knowledgeBaseId: data.knowledgeBaseId
            });
            
            if (data.knowledgeBaseId) {
              const newKB = {
                id: data.knowledgeBaseId,
                name: fileObj.title,
                type: 'file' as const
              };
              setUploadedKnowledgeBases(prev => [...prev, newKB]);
            }
            
          } catch (fileError) {
            failedUploads.push({
              file: fileObj.file.name,
              error: fileError.message
            });
          }
        }
      } else if (uploadType === 'url') {
        for (const urlObj of uploadUrls) {
          try {
            const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
              body: {
                action: 'upload_url',
                url: urlObj.url,
                title: urlObj.title || urlObj.url
              },
            });
            
            if (error) throw new Error(error.message || 'Upload failed');
            
            successfulUploads.push({
              file: urlObj.url,
              knowledgeBaseId: data.knowledgeBaseId
            });
            
            if (data.knowledgeBaseId) {
              const newKB = {
                id: data.knowledgeBaseId,
                name: urlObj.title || urlObj.url,
                type: 'url' as const
              };
              setUploadedKnowledgeBases(prev => [...prev, newKB]);
            }
            
          } catch (urlError) {
            failedUploads.push({
              file: urlObj.url,
              error: urlError.message
            });
          }
        }
      } else if (uploadType === 'text') {
        try {
          const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
            body: {
              action: 'upload_text',
              text: textToUpload,
              title: textTitle || 'Text Document'
            },
          });
          
          if (error) throw new Error(error.message || 'Upload failed');
          
          successfulUploads.push({
            file: textTitle || 'Text Document',
            knowledgeBaseId: data.knowledgeBaseId
          });
          
          if (data.knowledgeBaseId) {
            const newKB = {
              id: data.knowledgeBaseId,
              name: textTitle || 'Text Document',
              type: 'text' as const
            };
            setUploadedKnowledgeBases(prev => [...prev, newKB]);
          }
          
        } catch (textError) {
          failedUploads.push({
            file: 'Text Document',
            error: textError.message
          });
        }
      }

      const successCount = successfulUploads.length;
      const failureCount = failedUploads.length;

      toast({
        title: "Upload Complete",
        description: `Successfully uploaded ${successCount} document${successCount !== 1 ? 's' : ''}${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        variant: failureCount > 0 ? "destructive" : "default"
      });

      // Clear upload dialog but keep the uploaded knowledge bases
      setKnowledgeDialogOpen(false);
      setUploadFiles([]);
      setUploadUrls([]);
      setTextToUpload('');
      setTextTitle('');

    } catch (error) {
      console.error('Upload process error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload documents",
        variant: "destructive"
      });
    } finally {
      setUploadingDocuments(false);
    }
  };

  const updateAgentWithKnowledgeBases = async () => {
    if (!experienceData.agentId || uploadedKnowledgeBases.length === 0) {
      toast({
        title: "Cannot Update Agent",
        description: "Please upload some knowledge bases first.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
        body: {
          action: 'update_agent_knowledge',
          agentId: experienceData.agentId,
          knowledgeBases: uploadedKnowledgeBases
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Agent Updated",
        description: `Agent updated successfully with ${uploadedKnowledgeBases.length} knowledge bases!`,
        variant: "default"
      });
      
      // Advance to final step or mark as complete
      setCurrentSubStep(4);
      
    } catch (error) {
      console.error('Error updating agent:', error);
      toast({
        title: "Update Failed",
        description: `Error updating agent: ${error.message}`,
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
      case 3: return uploadedKnowledgeBases.length > 0;
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
                {currentSubStep > 2 && selectedVoice && (
                  <Check className="h-5 w-5 text-primary ml-auto" />
                )}
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
                  disabled={currentSubStep !== 2}
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

                {currentSubStep === 2 && selectedVoice && (
                  <Button 
                    onClick={() => setCurrentSubStep(3)}
                    className="w-full"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Continue to Knowledge Base
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Add Knowledge Base */}
        {currentSubStep >= 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>Add Knowledge Base</span>
                {uploadedKnowledgeBases.length > 0 && (
                  <Check className="h-5 w-5 text-primary ml-auto" />
                )}
              </CardTitle>
              <CardDescription>
                Upload documents to give your agent specialized knowledge
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  variant="outline"
                  onClick={() => setKnowledgeDialogOpen(true)}
                  className="w-full"
                  disabled={currentSubStep !== 3}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>

                {uploadedKnowledgeBases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Uploaded Knowledge Bases:</p>
                    <div className="space-y-1">
                      {uploadedKnowledgeBases.map((kb, index) => (
                        <div key={index} className="text-sm p-2 bg-muted rounded flex justify-between items-center">
                          <span>{kb.name} ({kb.type})</span>
                          <div className="text-xs text-muted-foreground">{kb.id.substring(0, 8)}...</div>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      onClick={updateAgentWithKnowledgeBases}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating Agent...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Associate Knowledge Bases
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {uploadedKnowledgeBases.length === 0 && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      No knowledge bases uploaded yet. Click "Upload Documents" to add content for your agent.
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

      {/* Knowledge Base Upload Dialog */}
      <Dialog open={knowledgeDialogOpen} onOpenChange={setKnowledgeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Knowledge Base</DialogTitle>
            <DialogDescription>
              Add documents, URLs, or text content to give your agent specialized knowledge.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Upload Type Selector */}
            <div className="flex space-x-2">
              <Button
                variant={uploadType === 'file' ? 'default' : 'outline'}
                onClick={() => setUploadType('file')}
                className="flex-1"
              >
                <FileText className="mr-2 h-4 w-4" />
                Files
              </Button>
              <Button
                variant={uploadType === 'url' ? 'default' : 'outline'}
                onClick={() => setUploadType('url')}
                className="flex-1"
              >
                <Link className="mr-2 h-4 w-4" />
                URLs
              </Button>
              <Button
                variant={uploadType === 'text' ? 'default' : 'outline'}
                onClick={() => setUploadType('text')}
                className="flex-1"
              >
                <FileText className="mr-2 h-4 w-4" />
                Text
              </Button>
            </div>

            {/* File Upload */}
            {uploadType === 'file' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Files</label>
                  <input
                    type="file"
                    multiple
                    accept=".txt,.pdf,.docx,.md"
                    onChange={(e) => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files).map(file => ({
                          id: Math.random().toString(36).substr(2, 9),
                          file,
                          title: file.name.replace(/\.[^/.]+$/, ""),
                          name: file.name,
                          type: file.type,
                          size: file.size
                        }));
                        setUploadFiles(prev => [...prev, ...newFiles]);
                      }
                    }}
                    className="w-full p-2 border rounded"
                  />
                </div>
                
                {uploadFiles.map((fileObj, index) => (
                  <div key={fileObj.id} className="border rounded p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{fileObj.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploadFiles(prev => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                    <Input
                      placeholder="Document title (optional)"
                      value={fileObj.title}
                      onChange={(e) => {
                        setUploadFiles(prev => prev.map((f, i) => 
                          i === index ? { ...f, title: e.target.value } : f
                        ));
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* URL Upload */}
            {uploadType === 'url' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadUrls(prev => [...prev, {
                        id: Math.random().toString(36).substr(2, 9),
                        url: '',
                        title: ''
                      }]);
                    }}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add URL
                  </Button>
                </div>
                
                {uploadUrls.map((urlObj, index) => (
                  <div key={urlObj.id} className="border rounded p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">URL {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploadUrls(prev => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                    <Input
                      placeholder="https://example.com"
                      value={urlObj.url}
                      onChange={(e) => {
                        setUploadUrls(prev => prev.map((u, i) => 
                          i === index ? { ...u, url: e.target.value } : u
                        ));
                      }}
                    />
                    <Input
                      placeholder="Title (optional)"
                      value={urlObj.title}
                      onChange={(e) => {
                        setUploadUrls(prev => prev.map((u, i) => 
                          i === index ? { ...u, title: e.target.value } : u
                        ));
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Text Upload */}
            {uploadType === 'text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Document Title</label>
                  <Input
                    placeholder="Enter document title"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Text Content</label>
                  <Textarea
                    placeholder="Paste your text content here..."
                    value={textToUpload}
                    onChange={(e) => setTextToUpload(e.target.value)}
                    rows={10}
                    className="resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setKnowledgeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDocumentUpload}
              disabled={uploadingDocuments}
            >
              {uploadingDocuments ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};