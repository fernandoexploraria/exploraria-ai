import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bot, Wrench, BookOpen, Play, AlertCircle, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ElevenLabsPlayground: React.FC = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agentData, setAgentData] = useState(null);
  const [toolsData, setToolsData] = useState(null);
  const [knowledgeData, setKnowledgeData] = useState(null);

  const EXISTING_AGENT_ID = 'agent_01jxtaz7mkfwzrefsdqsy3fdwe';

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

  const fetchAgentInfo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'get_agent',
          agentId: EXISTING_AGENT_ID
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
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tools-api', {
        body: { 
          action: 'list_agent_tools',
          agentId: EXISTING_AGENT_ID
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
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-agents-api', {
        body: { 
          action: 'duplicate_agent',
          agentId: EXISTING_AGENT_ID
        }
      });

      if (error) throw error;
      
      toast({
        title: "Agent Duplicated",
        description: `New agent created with ID: ${data.agent_id}`,
      });
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

  const fetchKnowledgeBase = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-knowledge-api', {
        body: { 
          action: 'list_documents',
          agentId: EXISTING_AGENT_ID
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

        {/* Agent Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <span>Agent Information</span>
            </CardTitle>
            <CardDescription>
              Get information about agent: {EXISTING_AGENT_ID}
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wrench className="h-5 w-5" />
              <span>Agent Tools</span>
            </CardTitle>
            <CardDescription>
              List and manage tools for the agent
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5" />
              <span>Knowledge Base</span>
            </CardTitle>
            <CardDescription>
              Manage the agent's knowledge base documents
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
    </div>
  );
};

export default ElevenLabsPlayground;