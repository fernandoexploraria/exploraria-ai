import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Bot, Wrench, BookOpen, Play, AlertCircle, Copy, Users, Check, Edit, MessageCircle, Search } from 'lucide-react';
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
  const [agentName, setAgentName] = useState('');

  // Voice Explorer state
  const [voices, setVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState(null);
  const [filters, setFilters] = useState({
    gender: '',
    age: '',
    accent: '',
    category: '',
    language: '',
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
  const fetchVoices = async () => {
    setVoicesLoading(true);
    setVoicesError(null);
    try {
      // First try the real API
      const { data, error } = await supabase.functions.invoke('elevenlabs-api-test', {
        body: { action: 'list_voices' }
      });

      if (error) {
        // If API fails, use mock data for demonstration
        console.warn('API failed, using mock data:', error);
        const mockVoices = [
          {
            voice_id: "9BWtsMINqrJLrRacOk9x",
            name: "Aria",
            accent: "american",
            gender: "Female",
            age: "young",
            descriptive: "calm",
            use_case: "characters_animation",
            category: "professional",
            language: "en",
            description: "Perfectly calm, neutral and strong voice."
          },
          {
            voice_id: "CwhRBWXzGAHq8TQ4Fs17",
            name: "Roger",
            accent: "british",
            gender: "Male",
            age: "adult",
            descriptive: "authoritative",
            use_case: "narration",
            category: "professional",
            language: "en",
            description: "Clear and authoritative voice."
          },
          {
            voice_id: "EXAVITQu4vr4xnSDxMaL",
            name: "Sarah",
            accent: "american",
            gender: "Female",
            age: "adult",
            descriptive: "friendly",
            use_case: "customer_service",
            category: "standard",
            language: "en",
            description: "Friendly and approachable voice."
          },
          {
            voice_id: "pirate_voice_01",
            name: "Captain Blackheart",
            accent: "british",
            gender: "Male",
            age: "adult",
            descriptive: "gruff",
            use_case: "characters_animation",
            category: "community",
            language: "en",
            description: "A deep, raspy voice perfect for a pirate captain. Arrr!"
          },
          {
            voice_id: "old_lady_voice_01",
            name: "Granny Mae",
            accent: "american",
            gender: "Female",
            age: "old",
            descriptive: "sweet",
            use_case: "storytelling",
            category: "community",
            language: "en",
            description: "A warm, comforting, and sweet old lady voice, perfect for bedtime stories."
          }
        ];
        
        setVoices(mockVoices);
        toast({
          title: "Mock Voices Loaded",
          description: `Loaded ${mockVoices.length} demo voices (API will be available once deployed)`,
        });
        return;
      }
      
      if (data && Array.isArray(data.voices)) {
        setVoices(data.voices);
        toast({
          title: "Voices Retrieved",
          description: `Found ${data.voices.length} voices`,
        });
      } else {
        throw new Error("Invalid API response format");
      }
    } catch (error) {
      console.error('Voices fetch error:', error);
      setVoicesError(error.message);
      toast({
        title: "Failed to Fetch Voices",
        description: "Could not retrieve voices list",
        variant: "destructive"
      });
    } finally {
      setVoicesLoading(false);
    }
  };

  // Extract unique values for filter dropdowns
  const uniqueFilterOptions = useMemo(() => {
    const filterFields = ['gender', 'age', 'accent', 'category', 'language'];
    const options = {};

    filterFields.forEach(field => {
      const values = voices
        .map(voice => voice[field])
        .filter(value => value)
        .filter((value, index, self) => self.indexOf(value) === index)
        .sort((a, b) => a.localeCompare(b));

      options[field] = values;
    });
    return options;
  }, [voices]);

  // Combined filtering and searching
  const filteredAndSearchedVoices = useMemo(() => {
    if (!voices.length) return [];

    let currentVoices = voices;

    // Apply dropdown filters
    currentVoices = currentVoices.filter(voice => {
      for (const field in filters) {
        const selectedValue = filters[field];
        if (selectedValue && voice[field]?.toLowerCase() !== selectedValue.toLowerCase()) {
          return false;
        }
      }
      return true;
    });

    // Apply search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentVoices = currentVoices.filter(voice => {
        return (
          voice.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
          voice.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
          voice.descriptive?.toLowerCase().includes(lowerCaseSearchTerm) ||
          voice.use_case?.toLowerCase().includes(lowerCaseSearchTerm)
        );
      });
    }

    return currentVoices;
  }, [voices, filters, searchTerm]);

  const handleFilterChange = (field, value) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [field]: value,
    }));
  };

  const handleSearchTermChange = (e) => {
    setSearchTerm(e.target.value);
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
            <Button onClick={fetchKnowledgeBase} disabled={loading}>
              <Play className="mr-2 h-4 w-4" />
              List Knowledge Base Documents
            </Button>
            
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
            <Button onClick={fetchVoices} disabled={voicesLoading}>
              <Play className="mr-2 h-4 w-4" />
              {voicesLoading ? 'Loading Voices...' : 'Load Voices'}
            </Button>

            {voicesError && (
              <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
                Error: {voicesError}
              </div>
            )}

            {voices.length > 0 && (
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {['gender', 'age', 'accent', 'category', 'language'].map(field => (
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
                          {uniqueFilterOptions[field]?.map(option => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Voice Results */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAndSearchedVoices.length > 0 ? (
                    filteredAndSearchedVoices.map(voice => (
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
                    ))
                  ) : (
                    <p className="col-span-full text-center text-muted-foreground py-8">
                      No voices found matching your criteria. Try adjusting your filters or search term.
                    </p>
                  )}
                </div>
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
    </div>
  );
};

export default ElevenLabsPlayground;