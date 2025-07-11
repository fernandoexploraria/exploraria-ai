import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bot, Wrench, BookOpen, Play, AlertCircle, Copy, Users, Check, Edit, MessageCircle, Mic, Search, Volume2 } from 'lucide-react';
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
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [voices, setVoices] = useState([]);
  const [filteredVoices, setFilteredVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [voiceFilters, setVoiceFilters] = useState({
    gender: '',
    age: '',
    accent: '',
    category: '',
    language: 'en'
  });

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

  const openVoiceDialog = async () => {
    if (!selectedAgent) {
      toast({
        title: "No Agent Selected",
        description: "Please select an agent first",
        variant: "destructive"
      });
      return;
    }
    setVoiceDialogOpen(true);
    await fetchVoices();
  };

  const fetchVoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { action: 'list_voices' }
      });

      if (error) throw error;
      setVoices(data.voices || []);
      setFilteredVoices(data.voices || []);
      
      toast({
        title: "Voices Retrieved",
        description: `Found ${data.voices?.length || 0} voices`,
      });
    } catch (error) {
      console.error('Voices fetch error:', error);
      toast({
        title: "Failed to Fetch Voices",
        description: "Could not retrieve voices list",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterVoices = () => {
    let filtered = voices;
    
    if (voiceFilters.gender) {
      filtered = filtered.filter(voice => voice.gender?.toLowerCase() === voiceFilters.gender.toLowerCase());
    }
    if (voiceFilters.age) {
      filtered = filtered.filter(voice => voice.age?.toLowerCase() === voiceFilters.age.toLowerCase());
    }
    if (voiceFilters.accent) {
      filtered = filtered.filter(voice => voice.accent?.toLowerCase().includes(voiceFilters.accent.toLowerCase()));
    }
    if (voiceFilters.category) {
      filtered = filtered.filter(voice => voice.category?.toLowerCase() === voiceFilters.category.toLowerCase());
    }
    if (voiceFilters.language) {
      filtered = filtered.filter(voice => voice.language?.toLowerCase() === voiceFilters.language.toLowerCase());
    }
    
    setFilteredVoices(filtered);
  };

  const updateAgentVoice = async () => {
    if (!selectedAgent || !selectedVoice) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'update_voice',
          agentId: selectedAgent.agent_id,
          voiceId: selectedVoice.voice_id
        }
      });

      if (error) throw error;
      
      toast({
        title: "Voice Updated",
        description: `Agent voice updated to: ${selectedVoice.name}`,
      });
      
      setVoiceDialogOpen(false);
      setSelectedVoice(null);
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

  // Apply filters whenever they change
  React.useEffect(() => {
    filterVoices();
  }, [voiceFilters, voices]);

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
              <Button onClick={openVoiceDialog} disabled={loading} variant="outline">
                <Mic className="mr-2 h-4 w-4" />
                Voice
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

      {/* Voice Selection Dialog */}
      <Dialog open={voiceDialogOpen} onOpenChange={setVoiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Select Voice</DialogTitle>
            <DialogDescription>
              Choose a voice for agent: {selectedAgent?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col space-y-4 overflow-hidden">
            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <label className="text-sm font-medium mb-1 block">Gender</label>
                <Select value={voiceFilters.gender} onValueChange={(value) => setVoiceFilters({...voiceFilters, gender: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Age</label>
                <Select value={voiceFilters.age} onValueChange={(value) => setVoiceFilters({...voiceFilters, age: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="young">Young</SelectItem>
                    <SelectItem value="middle aged">Middle Aged</SelectItem>
                    <SelectItem value="old">Old</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Accent</label>
                <Select value={voiceFilters.accent} onValueChange={(value) => setVoiceFilters({...voiceFilters, accent: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="american">American</SelectItem>
                    <SelectItem value="british">British</SelectItem>
                    <SelectItem value="australian">Australian</SelectItem>
                    <SelectItem value="irish">Irish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <Select value={voiceFilters.category} onValueChange={(value) => setVoiceFilters({...voiceFilters, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="conversational">Conversational</SelectItem>
                    <SelectItem value="characters_animation">Characters/Animation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Language</label>
                <Select value={voiceFilters.language} onValueChange={(value) => setVoiceFilters({...voiceFilters, language: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Voice List */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-96">
              {filteredVoices.length === 0 && !loading && (
                <div className="text-center text-muted-foreground py-8">
                  {voices.length === 0 ? 'No voices loaded. Try fetching voices first.' : 'No voices match the current filters.'}
                </div>
              )}
              
              {filteredVoices.map((voice: any) => (
                <div
                  key={voice.voice_id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedVoice?.voice_id === voice.voice_id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-background hover:bg-muted/50 border-border'
                  }`}
                  onClick={() => setSelectedVoice(voice)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium">{voice.name}</h4>
                        {selectedVoice?.voice_id === voice.voice_id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mb-2">
                        {voice.gender && <Badge variant="outline">{voice.gender}</Badge>}
                        {voice.age && <Badge variant="outline">{voice.age}</Badge>}
                        {voice.accent && <Badge variant="outline">{voice.accent}</Badge>}
                        {voice.category && <Badge variant="outline">{voice.category}</Badge>}
                        {voice.language && <Badge variant="outline">{voice.language}</Badge>}
                      </div>
                      
                      {voice.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {voice.description}
                        </p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        {voice.usage_character_count_1y > 0 && (
                          <span>Used: {voice.usage_character_count_1y.toLocaleString()} chars/year</span>
                        )}
                        {voice.cloned_by_count > 0 && (
                          <span>Cloned: {voice.cloned_by_count} times</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      {voice.preview_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            const audio = new Audio(voice.preview_url);
                            audio.play();
                          }}
                        >
                          <Volume2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVoiceDialogOpen(false);
                setSelectedVoice(null);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={updateAgentVoice}
              disabled={loading || !selectedVoice}
            >
              {loading ? 'Updating...' : 'Update Voice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ElevenLabsPlayground;