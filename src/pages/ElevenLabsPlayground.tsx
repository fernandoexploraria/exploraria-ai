import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Bot, Wrench, BookOpen, Play, AlertCircle, Copy, Users, Check, Edit, MessageCircle, Search, Mic, Upload } from 'lucide-react';
import { VoiceSelector } from '@/components/VoiceSelector';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ElevenLabsPlayground: React.FC = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agentsList, setAgentsList] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [toolsData, setToolsData] = useState(null);
  const [knowledgeData, setKnowledgeData] = useState(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [firstMessageDialogOpen, setFirstMessageDialogOpen] = useState(false);
  const [voiceSelectorOpen, setVoiceSelectorOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [agentName, setAgentName] = useState('');
  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<Array<{id: string, file: File, title: string, name: string, type: string, size: number}>>([]);
  const [uploadUrls, setUploadUrls] = useState<Array<{id: string, url: string, title: string}>>([]);
  const [uploadType, setUploadType] = useState<'file' | 'url' | 'text'>('file');
  const [textToUpload, setTextToUpload] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  
  // Track uploaded knowledge bases
  const [uploadedKnowledgeBases, setUploadedKnowledgeBases] = useState<Array<{
    id: string;
    name: string;
    type: 'file' | 'text' | 'url';
  }>>([]);

  // Voice Explorer state
  const [voiceExplorerInitialized, setVoiceExplorerInitialized] = useState(false);
  const [voices, setVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState(null);
  const [filterOptions, setFilterOptions] = useState({
    gender: [],
    age: [],
    accent: [],
    category: [],
    language: [],
    use_cases: [],
    descriptives: []
  });
  const [filters, setFilters] = useState({
    gender: '',
    age: '',
    accent: '',
    category: '',
    language: '',
    use_cases: '',
    descriptives: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  const testApiConnection = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-api-test', {
        body: { action: 'test_connection' }
      });

      if (error) throw error;

      toast({
        title: "API Connection Test",
        description: data.success ? "✅ Connection successful!" : "❌ Connection failed",
        variant: data.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error('API test error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to test ElevenLabs API connection",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentsList = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { action: 'list_agents' }
      });

      if (error) throw error;
      setAgentsList(data.agents || []);
      
      // Auto-select the first agent if none is selected
      if (!selectedAgent && data.agents && data.agents.length > 0) {
        setSelectedAgent(data.agents[0]);
      }
      
      toast({
        title: "Agents List Retrieved",
        description: `Found ${data.agents?.length || 0} agents`,
      });
    } catch (error) {
      console.error('Agents list fetch error:', error);
      toast({
        title: "Failed to Fetch Agents",
        description: "Could not retrieve agents list",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Clear dependent data when agent selection changes
  const handleAgentSelection = (agent: any) => {
    setSelectedAgent(agent);
    setAgentData(null);
    setToolsData(null);
    setKnowledgeData(null);
  };

  const fetchAgentInfo = async () => {
    if (!selectedAgent) {
      toast({
        title: "No Agent Selected",
        description: "Please select an agent first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'get_agent',
          agentId: selectedAgent.agent_id
        }
      });

      if (error) throw error;
      setAgentData(data);
      
      toast({
        title: "Agent Info Retrieved",
        description: "Successfully fetched agent information",
      });
    } catch (error) {
      console.error('Agent fetch error:', error);
      toast({
        title: "Failed to Fetch Agent",
        description: "Could not retrieve agent information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentTools = async () => {
    if (!selectedAgent) {
      toast({
        title: "No Agent Selected",
        description: "Please select an agent first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tools-api', {
        body: { 
          action: 'list_agent_tools',
          agentId: selectedAgent.agent_id
        }
      });

      if (error) throw error;
      setToolsData(data);
      
      toast({
        title: "Agent Tools Retrieved",
        description: `Found ${data?.tools?.length || 0} tools`,
      });
    } catch (error) {
      console.error('Tools fetch error:', error);
      toast({
        title: "Failed to Fetch Tools",
        description: "Could not retrieve agent tools",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const duplicateAgent = async () => {
    if (!selectedAgent) {
      toast({
        title: "No Agent Selected",
        description: "Please select an agent first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'duplicate_agent',
          agentId: selectedAgent.agent_id
        }
      });

      if (error) throw error;
      
      toast({
        title: "Agent Duplicated",
        description: `New agent created with ID: ${data.agent_id}`,
      });
      
      // Refresh the agents list to show the new agent
      fetchAgentsList();
    } catch (error) {
      console.error('Agent duplication error:', error);
      toast({
        title: "Failed to Duplicate Agent",
        description: "Could not duplicate the agent",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openRenameDialog = () => {
    if (!selectedAgent) {
      toast({
        title: "No Agent Selected",
        description: "Please select an agent first",
        variant: "destructive"
      });
      return;
    }
    setNewAgentName(selectedAgent.name);
    setRenameDialogOpen(true);
  };

  const openFirstMessageDialog = () => {
    if (!selectedAgent) {
      toast({
        title: "No Agent Selected",
        description: "Please select an agent first",
        variant: "destructive"
      });
      return;
    }
    setAgentName('');
    setFirstMessageDialogOpen(true);
  };

  const updateFirstMessage = async () => {
    if (!selectedAgent || !agentName.trim()) {
      return;
    }

    const firstMessage = `Hey there, I'm ${agentName.trim()}, your {{destination}} tour guide.`;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'update_first_message',
          agentId: selectedAgent.agent_id,
          firstMessage: firstMessage
        }
      });

      if (error) throw error;
      
      toast({
        title: "First Message Updated",
        description: "Agent's first message has been updated successfully",
      });
      
      setFirstMessageDialogOpen(false);
      // Refresh agent data to see the updated first message
      fetchAgentInfo();
    } catch (error) {
      console.error('First message update error:', error);
      toast({
        title: "Failed to Update First Message",
        description: "Could not update the agent's first message",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateAgentVoice = async (voiceId: string, voiceName: string) => {
    if (!selectedAgent) {
      toast({
        title: "No Agent Selected",
        description: "Please select an agent first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'update_voice',
          agentId: selectedAgent.agent_id,
          voiceId: voiceId
        }
      });

      if (error) throw error;
      
      toast({
        title: "Voice Updated",
        description: `Agent voice changed to: ${voiceName}`,
      });
      
      // Update the selected voice state
      setSelectedVoice({ voice_id: voiceId, name: voiceName });
      
      // Refresh agent data to see the updated voice
      fetchAgentInfo();
    } catch (error) {
      console.error('Voice update error:', error);
      toast({
        title: "Failed to Update Voice",
        description: "Could not update the agent's voice",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renameAgent = async () => {
    if (!selectedAgent || !newAgentName.trim()) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'rename_agent',
          agentId: selectedAgent.agent_id,
          newName: newAgentName.trim()
        }
      });

      if (error) throw error;
      
      toast({
        title: "Agent Renamed",
        description: `Agent renamed to: ${data.name}`,
      });
      
      // Update the selected agent name and refresh the agents list
      setSelectedAgent({ ...selectedAgent, name: data.name });
      setRenameDialogOpen(false);
      fetchAgentsList();
    } catch (error) {
      console.error('Agent rename error:', error);
      toast({
        title: "Failed to Rename Agent",
        description: "Could not rename the agent",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchKnowledgeBase = async () => {
    if (!selectedAgent) {
      toast({
        title: "No Agent Selected",
        description: "Please select an agent first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
        body: { 
          action: 'list_documents',
          agentId: selectedAgent.agent_id
        }
      });

      if (error) throw error;
      setKnowledgeData(data);
      
      toast({
        title: "Knowledge Base Retrieved",
        description: `Found ${data?.documents?.length || 0} documents`,
      });
    } catch (error) {
      console.error('Knowledge fetch error:', error);
      toast({
        title: "Failed to Fetch Knowledge Base",
        description: "Could not retrieve knowledge base documents",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Voice Explorer functions
  const initializeVoiceExplorer = async () => {
    setVoicesLoading(true);
    setVoicesError(null);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-api-test', {
        body: { action: 'get_filter_options' }
      });

      if (error) throw error;
      
      if (data && data.filterOptions) {
        setFilterOptions(data.filterOptions);
        setVoiceExplorerInitialized(true);
        toast({
          title: "Voice Explorer Initialized",
          description: "Filter options loaded from ElevenLabs API",
        });
      } else {
        throw new Error("Invalid filter options response");
      }
    } catch (error) {
      console.error('Voice explorer init error:', error);
      setVoicesError(error.message);
      toast({
        title: "Initialization Failed",
        description: "Could not load filter options",
        variant: "destructive"
      });
    } finally {
      setVoicesLoading(false);
    }
  };

  const searchVoices = async () => {
    setVoicesLoading(true);
    setVoicesError(null);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-api-test', {
        body: { 
          action: 'search_voices',
          filters: filters,
          searchTerm: searchTerm
        }
      });

      if (error) throw error;
      
      if (data && Array.isArray(data.voices)) {
        // Transform the real ElevenLabs API response to match our expected format
        const transformedVoices = data.voices.map(voice => ({
          voice_id: voice.voice_id,
          name: voice.name,
          description: voice.description,
          // Extract from labels object if available, with fallbacks
          accent: voice.labels?.accent || 'unknown',
          gender: voice.labels?.gender || 'unknown',
          age: voice.labels?.age || 'unknown',
          descriptive: voice.labels?.descriptive || 'unknown',
          use_case: voice.labels?.use_case || 'unknown',
          category: voice.category || 'unknown',
          language: voice.labels?.language || 'en',
          preview_url: voice.preview_url
        }));

        setVoices(transformedVoices);
        toast({
          title: "Voice Search Complete",
          description: `Found ${transformedVoices.length} matching voices`,
        });
      } else {
        throw new Error("Invalid API response format");
      }
    } catch (error) {
      console.error('Voice search error:', error);
      setVoicesError(error.message);
      toast({
        title: "Search Failed",
        description: "Could not search voices",
        variant: "destructive"
      });
    } finally {
      setVoicesLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [field]: value,
    }));
  };

  const handleSearchTermChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const openKnowledgeDialog = () => {
    if (!selectedAgent) {
      toast({
        title: "No Agent Selected",
        description: "Please select an agent first",
        variant: "destructive"
      });
      return;
    }
    setUploadFiles([]);
    setUploadUrls([]);
    setTextToUpload('');
    setTextTitle('');
    setUploadType('file');
    setKnowledgeDialogOpen(true);
  };

  const addFileToUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newFiles = files.map((file: File) => ({
      id: Math.random().toString(36).substr(2, 9),
      file: file,
      title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for default title
      name: file.name,
      type: file.type,
      size: file.size
    }));
    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  const addUrlToUpload = () => {
    const newUrl = {
      id: Math.random().toString(36).substr(2, 9),
      url: '',
      title: ''
    };
    setUploadUrls(prev => [...prev, newUrl]);
  };

  const updateUrlData = (urlId: string, field: 'url' | 'title', value: string) => {
    setUploadUrls(prev => prev.map(u => u.id === urlId ? { ...u, [field]: value } : u));
  };

  const removeUrl = (urlId: string) => {
    setUploadUrls(prev => prev.filter(u => u.id !== urlId));
  };

  const updateFileTitle = (fileId: string, title: string) => {
    setUploadFiles(prev => prev.map(f => f.id === fileId ? { ...f, title } : f));
  };

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const processDocumentUpload = async () => {
    if (!selectedAgent) return;

    const hasContent = uploadType === 'file' ? uploadFiles.length > 0 : 
                      uploadType === 'url' ? uploadUrls.length > 0 :
                      uploadType === 'text' ? textToUpload.trim() !== '' : false;

    if (!hasContent) return;

    setUploadingDocuments(true);
    
    const successfulUploads = [];
    const failedUploads = [];

    try {
      if (uploadType === 'file') {
        // Process file uploads
        for (const fileObj of uploadFiles) {
          try {
            console.log('Uploading file:', fileObj.file.name);
            
            // Convert file to array buffer and then to array for transmission
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
            
            if (error) {
              throw new Error(error.message || 'Upload failed');
            }
            
            successfulUploads.push({
              file: fileObj.file.name,
              knowledgeBaseId: data.knowledgeBaseId
            });
            
            // Track the uploaded knowledge base
            if (data.knowledgeBaseId) {
              const newKB = {
                id: data.knowledgeBaseId,
                name: fileObj.title,
                type: 'file' as const
              };
              setUploadedKnowledgeBases(prev => [...prev, newKB]);
            }
            
          } catch (fileError) {
            console.error('Error uploading file:', fileObj.file.name, fileError);
            failedUploads.push({
              file: fileObj.file.name,
              error: fileError.message
            });
          }
        }
      } else if (uploadType === 'url') {
        // Process URL uploads
        for (const urlObj of uploadUrls) {
          try {
            console.log('Uploading URL:', urlObj.url);
            
            const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
              body: {
                action: 'upload_url',
                url: urlObj.url,
                title: urlObj.title || urlObj.url
              },
            });
            
            if (error) {
              throw new Error(error.message || 'Upload failed');
            }
            
            successfulUploads.push({
              file: urlObj.url,
              knowledgeBaseId: data.knowledgeBaseId
            });
            
            // Track the uploaded knowledge base
            if (data.knowledgeBaseId) {
              const newKB = {
                id: data.knowledgeBaseId,
                name: urlObj.title || urlObj.url,
                type: 'url' as const
              };
              setUploadedKnowledgeBases(prev => [...prev, newKB]);
            }
            
          } catch (urlError) {
            console.error('Error uploading URL:', urlObj.url, urlError);
            failedUploads.push({
              file: urlObj.url,
              error: urlError.message
            });
          }
        }
      } else if (uploadType === 'text') {
        // Process text upload
        try {
          console.log('Uploading text content');
          
          const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
            body: {
              action: 'upload_text',
              text: textToUpload,
              title: textTitle || 'Text Document'
            },
          });
          
          if (error) {
            throw new Error(error.message || 'Upload failed');
          }
          
          successfulUploads.push({
            file: textTitle || 'Text Document',
            knowledgeBaseId: data.knowledgeBaseId
          });
          
          // Track the uploaded knowledge base
          if (data.knowledgeBaseId) {
            const newKB = {
              id: data.knowledgeBaseId,
              name: textTitle || 'Text Document',
              type: 'text' as const
            };
            setUploadedKnowledgeBases(prev => [...prev, newKB]);
          }
          
        } catch (textError) {
          console.error('Error uploading text:', textError);
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

      if (failureCount > 0) {
        console.log('Failed uploads:', failedUploads);
      }

      setKnowledgeDialogOpen(false);
      setUploadFiles([]);
      setUploadUrls([]);
      setTextToUpload('');
      setTextTitle('');
      
      // Refresh knowledge base data
      fetchKnowledgeBase();
      
    } catch (error) {
      console.error('Document upload error:', error);
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
    if (!selectedAgent || uploadedKnowledgeBases.length === 0) {
      toast({
        title: "Cannot Update Agent",
        description: "Please select an agent and upload some knowledge bases first.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      console.log('Updating agent with knowledge bases:', uploadedKnowledgeBases);
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
        body: {
          action: 'update_agent_knowledge',
          agentId: selectedAgent.agent_id,
          knowledgeBases: uploadedKnowledgeBases
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('Agent updated successfully:', data);
      toast({
        title: "Agent Updated",
        description: `Agent updated successfully with ${uploadedKnowledgeBases.length} knowledge bases!`,
        variant: "default"
      });
      
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

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>ElevenLabs Playground</CardTitle>
            <CardDescription>
              Please sign in to access the ElevenLabs API playground
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Main App
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card flex-shrink-0">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/curator-portal">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Curator Portal
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">ElevenLabs API Playground</h1>
              <p className="text-sm text-muted-foreground">Test and explore ElevenLabs API endpoints</p>
            </div>
          </div>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="container mx-auto px-4 py-8 pb-16 space-y-8">
        {/* API Connection Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>API Connection Test</span>
            </CardTitle>
            <CardDescription>
              Test if the ELEVENLABS_API_KEY secret is working correctly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={testApiConnection} disabled={loading}>
              <Play className="mr-2 h-4 w-4" />
              Test API Connection
            </Button>
          </CardContent>
        </Card>

        {/* Agents List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Available Agents</span>
            </CardTitle>
            <CardDescription>
              Select an agent to work with from your ElevenLabs account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={fetchAgentsList} disabled={loading}>
              <Play className="mr-2 h-4 w-4" />
              Load Agents List
            </Button>
            
            {agentsList.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Select an Agent:</h4>
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {agentsList.map((agent: any) => (
                    <div
                      key={agent.agent_id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedAgent?.agent_id === agent.agent_id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-muted hover:bg-muted/80 border-border'
                      }`}
                      onClick={() => handleAgentSelection(agent)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-sm text-muted-foreground">ID: {agent.agent_id}</p>
                        </div>
                        {selectedAgent?.agent_id === agent.agent_id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent Information */}
        <Card className={selectedAgent ? '' : 'opacity-50 pointer-events-none'}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <span>Agent Information</span>
            </CardTitle>
            <CardDescription>
              {selectedAgent 
                ? `Get information about agent: ${selectedAgent.name} (${selectedAgent.agent_id})`
                : 'Select an agent first to view its information'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={fetchAgentInfo} disabled={loading}>
                <Play className="mr-2 h-4 w-4" />
                Fetch Agent Info
              </Button>
              <Button onClick={duplicateAgent} disabled={loading} variant="outline">
                <Copy className="mr-2 h-4 w-4" />
                Duplicate Agent
              </Button>
              <Button onClick={openRenameDialog} disabled={loading} variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Rename Agent
              </Button>
              <Button onClick={openFirstMessageDialog} disabled={loading} variant="outline">
                <MessageCircle className="mr-2 h-4 w-4" />
                First Message
              </Button>
              <Button onClick={() => setVoiceSelectorOpen(true)} disabled={loading} variant="outline">
                <Mic className="mr-2 h-4 w-4" />
                Voice
              </Button>
              <Button onClick={() => setKnowledgeDialogOpen(true)} disabled={loading} variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Knowledge
              </Button>
            </div>
            
            {agentData && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Agent Data:</h4>
                <div className="max-h-96 overflow-y-auto bg-background rounded border">
                  <pre className="text-sm p-4 whitespace-pre-wrap">
                    {JSON.stringify(agentData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tools Management */}
        <Card className={selectedAgent ? '' : 'opacity-50 pointer-events-none'}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wrench className="h-5 w-5" />
              <span>Agent Tools</span>
            </CardTitle>
            <CardDescription>
              {selectedAgent 
                ? `List and manage tools for agent: ${selectedAgent.name}`
                : 'Select an agent first to view its tools'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={fetchAgentTools} disabled={loading}>
              <Play className="mr-2 h-4 w-4" />
              List Agent Tools
            </Button>
            
            {toolsData && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Tools Data:</h4>
                <div className="max-h-96 overflow-y-auto bg-background rounded border">
                  <pre className="text-sm p-4 whitespace-pre-wrap">
                    {JSON.stringify(toolsData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Knowledge Base */}
        <Card className={selectedAgent ? '' : 'opacity-50 pointer-events-none'}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5" />
              <span>Knowledge Base</span>
            </CardTitle>
            <CardDescription>
              {selectedAgent 
                ? `Manage knowledge base documents for agent: ${selectedAgent.name}`
                : 'Select an agent first to view its knowledge base'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={fetchKnowledgeBase} disabled={loading} className="flex-1">
                <Play className="mr-2 h-4 w-4" />
                List Knowledge Base Documents
              </Button>
              <Button onClick={openKnowledgeDialog} disabled={loading} variant="outline" className="flex-1">
                <Upload className="mr-2 h-4 w-4" />
                Upload Documents
              </Button>
            </div>
            
            {uploadedKnowledgeBases.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Uploaded Knowledge Bases ({uploadedKnowledgeBases.length})</h4>
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
                  disabled={!selectedAgent || loading}
                  className="w-full"
                >
                  Update Agent with Knowledge Bases
                </Button>
              </div>
            )}
            
            {knowledgeData && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Knowledge Base Data:</h4>
                <div className="max-h-96 overflow-y-auto bg-background rounded border">
                  <pre className="text-sm p-4 whitespace-pre-wrap">
                    {JSON.stringify(knowledgeData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Voice Explorer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5" />
              <span>Voice Explorer</span>
            </CardTitle>
            <CardDescription>
              Search and filter ElevenLabs voices with descriptive terms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!voiceExplorerInitialized ? (
              <div className="text-center">
                <Button onClick={initializeVoiceExplorer} disabled={voicesLoading}>
                  <Search className="mr-2 h-4 w-4" />
                  {voicesLoading ? 'Initializing...' : 'Initialize Voice Explorer'}
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Click to load filter options from ElevenLabs API
                </p>
              </div>
            ) : (
              <>
                {/* Search and Filter Controls */}
                <div className="bg-muted p-6 rounded-lg space-y-4">
                  {/* Search Input */}
                  <div>
                    <label htmlFor="voice-search" className="block text-sm font-medium mb-2">
                      Search by Description (e.g., "pirate voice", "sweet old lady"):
                    </label>
                    <Input
                      id="voice-search"
                      type="text"
                      placeholder="e.g., 'mafia voice', 'energetic narrator'"
                      value={searchTerm}
                      onChange={handleSearchTermChange}
                      className="w-full"
                    />
                  </div>

                  {/* Filter Dropdowns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {['gender', 'age', 'accent', 'category', 'language', 'use_cases', 'descriptives'].map(field => (
                      <div key={field}>
                        <label htmlFor={field} className="block text-sm font-medium text-muted-foreground capitalize mb-1">
                          {field.replace('_', ' ')}:
                        </label>
                        <select
                          id={field}
                          className="w-full p-2 text-sm border border-border rounded-md bg-background"
                          value={filters[field]}
                          onChange={(e) => handleFilterChange(field, e.target.value)}
                        >
                          <option value="">All {field.replace('_', ' ')}</option>
                          {filterOptions[field]?.map(option => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Search Button */}
                  <div className="flex justify-center">
                    <Button onClick={searchVoices} disabled={voicesLoading} className="w-full sm:w-auto">
                      <Search className="mr-2 h-4 w-4" />
                      {voicesLoading ? 'Searching Voices...' : 'Search Voices'}
                    </Button>
                  </div>
                </div>

                {voicesError && (
                  <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
                    Error: {voicesError}
                  </div>
                )}

                {voices.length > 0 && (
                  <>
                    {/* Voice Results */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {voices.map(voice => (
                        <div key={voice.voice_id} className="bg-card p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                          <h3 className="text-lg font-semibold text-primary mb-2">{voice.name}</h3>
                          <p className="text-sm text-muted-foreground mb-3">{voice.description}</p>
                          <div className="flex flex-wrap gap-1 text-xs mb-4">
                            {voice.gender && <span className="px-2 py-1 bg-muted rounded-full">{voice.gender}</span>}
                            {voice.age && <span className="px-2 py-1 bg-muted rounded-full">{voice.age}</span>}
                            {voice.accent && <span className="px-2 py-1 bg-muted rounded-full">{voice.accent}</span>}
                            {voice.category && <span className="px-2 py-1 bg-muted rounded-full">{voice.category}</span>}
                            {voice.language && <span className="px-2 py-1 bg-muted rounded-full">{voice.language}</span>}
                            {voice.descriptive && <span className="px-2 py-1 bg-muted rounded-full">{voice.descriptive}</span>}
                            {voice.use_case && <span className="px-2 py-1 bg-muted rounded-full">{voice.use_case.replace(/_/g, ' ')}</span>}
                          </div>
                          <Button variant="outline" size="sm" className="w-full">
                            Select Voice
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
        </div>
      </main>

      {/* Rename Agent Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Agent</DialogTitle>
            <DialogDescription>
              Enter a new name for the agent: {selectedAgent?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              placeholder="Enter new agent name"
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={renameAgent}
              disabled={loading || !newAgentName.trim()}
            >
              {loading ? 'Renaming...' : 'Rename Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* First Message Dialog */}
      <Dialog open={firstMessageDialogOpen} onOpenChange={setFirstMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Agent Name</DialogTitle>
            <DialogDescription>
              Enter the name for the agent: {selectedAgent?.name}
              <br />
              <span className="text-sm text-muted-foreground mt-1 block">
                This will set the first message to: "Hey there, I'm [name], your {`{{destination}}`} tour guide."
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Enter agent name for first message"
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFirstMessageDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={updateFirstMessage}
              disabled={loading || !agentName.trim()}
            >
              {loading ? 'Updating...' : 'Set First Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Knowledge Upload Dialog */}
      <Dialog open={knowledgeDialogOpen} onOpenChange={setKnowledgeDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Knowledge Documents</DialogTitle>
            <DialogDescription>
              Add documents to the agent's knowledge base: {selectedAgent?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
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

            {/* File Upload */}
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
                  <label 
                    htmlFor="file-upload" 
                    className="cursor-pointer flex flex-col items-center space-y-2"
                  >
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
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {(fileObj.size / 1024).toFixed(1)} KB
                            </span>
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
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* URL Upload */}
            {uploadType === 'url' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold flex items-center space-x-2">
                    <span>🔗</span>
                    <span>URLs to Upload</span>
                  </h4>
                  <Button onClick={addUrlToUpload} variant="outline" size="sm">
                    + Add URL
                  </Button>
                </div>
                
                {uploadUrls.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No URLs added yet.</p>
                    <p className="text-xs mt-1">URLs are processed without RAG indexing.</p>
                  </div>
                )}
                
                {uploadUrls.map((urlObj) => (
                  <div key={urlObj.id} className="space-y-2 p-4 border border-border rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-2">
                      <Input
                        value={urlObj.url}
                        onChange={(e) => updateUrlData(urlObj.id, 'url', e.target.value)}
                        placeholder="https://example.com/article"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUrl(urlObj.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        ×
                      </Button>
                    </div>
                    <Input
                      value={urlObj.title}
                      onChange={(e) => updateUrlData(urlObj.id, 'title', e.target.value)}
                      placeholder="Optional: Custom title for this URL"
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Text Upload */}
            {uploadType === 'text' && (
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center space-x-2">
                  <span>📝</span>
                  <span>Text Content (with RAG indexing)</span>
                </h4>
                <Input
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  placeholder="Document title"
                  className="mb-2"
                />
                <textarea
                  value={textToUpload}
                  onChange={(e) => setTextToUpload(e.target.value)}
                  placeholder="Paste your text content here..."
                  className="w-full h-40 p-3 border border-border rounded-md resize-none text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {textToUpload.length} characters
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setKnowledgeDialogOpen(false)}
              disabled={uploadingDocuments}
            >
              Cancel
            </Button>
            <Button
              onClick={processDocumentUpload}
              disabled={uploadingDocuments || (
                (uploadType === 'file' && uploadFiles.length === 0) ||
                (uploadType === 'url' && uploadUrls.length === 0) ||
                (uploadType === 'text' && !textToUpload.trim())
              )}
            >
              {uploadingDocuments ? 'Processing...' : 
                uploadType === 'file' ? `Upload ${uploadFiles.length} File${uploadFiles.length !== 1 ? 's' : ''}` :
                uploadType === 'url' ? `Upload ${uploadUrls.length} URL${uploadUrls.length !== 1 ? 's' : ''}` :
                'Upload Text'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice Selector Dialog */}
      <VoiceSelector
        isOpen={voiceSelectorOpen}
        onClose={() => setVoiceSelectorOpen(false)}
        onVoiceSelect={(voice) => {
          updateAgentVoice(voice.voice_id, voice.name);
          setVoiceSelectorOpen(false);
        }}
        selectedVoiceId={selectedVoice?.voice_id}
      />
    </div>
  );
};

export default ElevenLabsPlayground;