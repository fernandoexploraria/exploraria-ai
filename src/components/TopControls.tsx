import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Search, ChevronDown, ChevronUp, Menu, List, TestTube, MapPin, ToggleLeft, ToggleRight, Compass } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import SearchControl from '@/components/SearchControl';
import FreeTourCounter from '@/components/FreeTourCounter';
import ImageAnalysis from '@/components/ImageAnalysis';
import DebugWindow from '@/components/DebugWindow';
import ConnectionStatus from '@/components/ConnectionStatus';
import { Landmark } from '@/data/landmarks';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { useDemoMode } from '@/hooks/useDemoMode';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import IntelligentTourDialog from './IntelligentTourDialog';
import AuthDialog from './AuthDialog';
import ExperiencesDrawer from './ExperiencesDrawer';
import { useAuth } from '@/components/AuthProvider';
import { PostAuthAction, setPostAuthAction, setPostAuthLandmark } from '@/utils/authActions';
import { performComprehensiveTourReset } from '@/utils/tourResetUtils';

interface TopControlsProps {
  allLandmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  onVoiceSearchOpen: () => void;
  onVoiceAssistantOpen: (agentId?: string) => void;
  onLogoClick: () => void;
  user: any;
  smartTourLandmarks: Landmark[];
  onIntelligentTourOpen: () => void;
  onAuthDialogOpen?: () => void;
  onTestProximityCard?: () => void;
  showPortalAccess?: boolean;
}

const TopControls: React.FC<TopControlsProps> = ({
  allLandmarks,
  onSelectLandmark,
  onVoiceSearchOpen,
  onVoiceAssistantOpen,
  onLogoClick,
  user,
  smartTourLandmarks,
  onIntelligentTourOpen,
  onAuthDialogOpen,
  onTestProximityCard,
  showPortalAccess = false,
}) => {
  // Persistent state for tour data
  const [persistedTourData, setPersistedTourData] = useState<{
    agentId: string;
    destination: string;
    systemPrompt: string;
  } | null>(null);
  const { user: authUser } = useAuth();
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false);
  const [isTestingCors, setIsTestingCors] = useState(false);
  const [isIntelligentTourOpen, setIsIntelligentTourOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isExperiencesDrawerOpen, setIsExperiencesDrawerOpen] = useState(false);
  const { toast } = useToast();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  
  const { connectionHealth } = useConnectionMonitor();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleTestCors = async () => {
    setIsTestingCors(true);
    console.log('🧪 Starting CORS test...');
    
    try {
      const { data, error } = await supabase.functions.invoke('test-cors', {
        body: { test: 'cors-functionality' }
      });

      if (error) {
        console.error('🧪 CORS test error:', error);
        toast({
          title: "CORS Test Failed",
          description: `Error: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('🧪 CORS test success:', data);
        toast({
          title: "CORS Test Successful!",
          description: `Response: ${data.message}`,
        });
      }
    } catch (error) {
      console.error('🧪 CORS test exception:', error);
      toast({
        title: "CORS Test Exception",
        description: `Exception: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsTestingCors(false);
    }
  };

  const handleSmartTourClick = () => {
    console.log('🎯 Smart Tour clicked from TopControls, user:', authUser?.id);
    
    // Clear persisted tour data when starting a new Smart Tour
    setPersistedTourData(null);
    
    if (!authUser) {
      console.log('🚨 User not authenticated, opening auth dialog with smart-tour action');
      setIsAuthDialogOpen(true);
    } else {
      console.log('✅ User authenticated, opening smart tour dialog');
      onIntelligentTourOpen();
    }
  };

  const handleExperiencesClick = () => {
    console.log('🎯 Experiences button clicked - opening carousel');
    setIsExperiencesDrawerOpen(true);
  };

  const handlePostAuthAction = (action: PostAuthAction) => {
    console.log('🎯 Executing post-auth action:', action);
    if (action === 'smart-tour') {
      onIntelligentTourOpen();
    }
  };

  const handleTourGenerated = (landmarks: any[]) => {
    landmarks.forEach(landmark => {
      onSelectLandmark(landmark);
    });
    setIsIntelligentTourOpen(false);
    toast({
      title: "Tour Generated!",
      description: `${landmarks.length} amazing places added to your map`,
    });
  };

  const handleTourDataReceived = (tourData: { agentId: string; destination: string; systemPrompt: string }) => {
    console.log('🎯 TopControls received tour data:', tourData);
    // Don't set immediately, let it be captured when voice assistant opens
  };

  const handleVoiceAssistantClick = () => {
    // Get current tour data when opening voice assistant
    const currentTourData = (window as any).voiceTourData;
    const agentId = persistedTourData?.agentId || currentTourData?.agentId;
    
    // If we have tour data and it's an Experience (has agentId), persist it
    if (currentTourData?.agentId && currentTourData?.destination && currentTourData?.systemPrompt) {
      console.log('🎯 Capturing tour data when opening voice assistant:', currentTourData);
      setPersistedTourData({
        agentId: currentTourData.agentId,
        destination: currentTourData.destination,
        systemPrompt: currentTourData.systemPrompt
      });
    }
    
    console.log('🎯 Opening voice assistant with agentId:', agentId);
    onVoiceAssistantOpen(agentId);
  };

  const handleAuthRequired = () => {
    console.log('🔐 Auth required callback - should not happen in new flow');
  };

  const handleTestProximityCard = () => {
    console.log('🧪 Debug: Testing proximity card display');
    if (onTestProximityCard) {
      onTestProximityCard();
    }
    toast({
      title: "Debug: Proximity Card Test",
      description: "Showing test proximity card for Fuente de los Coyotes",
    });
  };

  return (
    <>
      <div className="absolute top-4 left-4 z-10">
        <div className="flex flex-col items-start gap-2 max-w-[calc(100vw-120px)]">
          <img 
            src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
            alt="Exploraria Logo" 
            className={`h-16 w-auto bg-yellow-400 rounded-lg p-1 flex-shrink-0 lg:h-20 cursor-pointer hover:bg-yellow-300 transition-all duration-200 ${
              showPortalAccess ? 'ring-2 ring-primary glow-pulse' : ''
            }`}
            onClick={onLogoClick}
          />
          
          <SearchControl landmarks={allLandmarks} onSelectLandmark={onSelectLandmark} />
          
          {!isDemoMode && (isCollapsed || !connectionHealth.isHealthy) && (
            <ConnectionStatus compact className="w-full" />
          )}
          
          <Button
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
            onClick={toggleCollapse}
          >
            <Menu className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
            <span className="lg:hidden">Menu</span>
            <span className="hidden lg:inline">Menu</span>
            {isCollapsed ? (
              <ChevronDown className="ml-auto h-3 w-3 lg:h-4 lg:w-4" />
            ) : (
              <ChevronUp className="ml-auto h-3 w-3 lg:h-4 lg:w-4" />
            )}
          </Button>
          
          {!isCollapsed && (
            <div className="flex flex-col gap-1 w-full animate-fade-in">
              {/* Demo Mode Toggle - Always visible for easy access */}
              <Button
                variant={isDemoMode ? "default" : "outline"}
                size="sm"
                className={`backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2 ${
                  isDemoMode 
                    ? 'bg-green-500/80 hover:bg-green-400/80 text-white border-green-400' 
                    : 'bg-background/80 hover:bg-accent hover:text-accent-foreground'
                }`}
                onClick={toggleDemoMode}
              >
                {isDemoMode ? (
                  <ToggleRight className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                ) : (
                  <ToggleLeft className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                )}
                <span className="lg:hidden">{isDemoMode ? 'Demo On' : 'Demo Off'}</span>
                <span className="hidden lg:inline">{isDemoMode ? 'Demo Mode On' : 'Demo Mode Off'}</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="bg-gradient-to-r from-yellow-400/80 to-orange-400/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2 border-yellow-300 hover:from-yellow-300/80 hover:to-orange-300/80"
                onClick={handleSmartTourClick}
              >
                <Sparkles className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                <span className="lg:hidden">Smart Tour</span>
                <span className="hidden lg:inline">Smart Tour</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="bg-gradient-to-r from-purple-400/80 to-pink-400/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2 border-purple-300 hover:from-purple-300/80 hover:to-pink-300/80"
                onClick={handleExperiencesClick}
              >
                <Compass className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                <span className="lg:hidden">Experiences</span>
                <span className="hidden lg:inline">Experiences</span>
              </Button>
              
              {/* Tour Guide Button - only appears when there's an active Smart Tour */}
              {smartTourLandmarks.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
                  onClick={handleVoiceAssistantClick}
                >
                  <Sparkles className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                  Tour Guide
                  <span className="ml-auto text-xs font-mono">
                    {persistedTourData?.agentId ? (
                      <span className="text-green-400 font-bold">{persistedTourData.agentId.slice(-4)}</span>
                    ) : (
                      <span className="text-muted-foreground">null</span>
                    )}
                    {persistedTourData && (
                      <>
                        <span className="text-muted-foreground mx-1">|</span>
                        <span className="text-blue-400">{persistedTourData.destination.slice(0, 3)}</span>
                        <span className="text-muted-foreground mx-1">|</span>
                        <span className="text-yellow-400">{persistedTourData.systemPrompt.slice(0, 3)}</span>
                      </>
                    )}
                  </span>
                </Button>
              )}
              
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
                  onClick={onVoiceSearchOpen}
                >
                  <Search className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                  Travel Log
                </Button>
              )}

              {/* Image Analysis Button - only appears when there's an active Smart Tour */}
              <ImageAnalysis smartTourLandmarks={smartTourLandmarks} />
              
              {/* Debug Tools - Hidden in Demo Mode */}
              {!isDemoMode && (
                <>
                  <ConnectionStatus showDetails className="w-full" />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
                    onClick={handleTestCors}
                    disabled={isTestingCors}
                  >
                    <TestTube className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                    {isTestingCors ? 'Testing...' : 'Test CORS'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
                    onClick={handleTestProximityCard}
                  >
                    <MapPin className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                    Test Proximity Card
                  </Button>
                  
                  <Drawer open={isDebugDrawerOpen} onOpenChange={setIsDebugDrawerOpen}>
                    <DrawerTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2"
                      >
                        <List className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                        Debug
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent className="max-h-[85vh]">
                      <DrawerHeader>
                        <DrawerTitle>Debug Window</DrawerTitle>
                      </DrawerHeader>
                      <DebugWindow isVisible={true} onClose={() => setIsDebugDrawerOpen(false)} />
                    </DrawerContent>
                  </Drawer>
                </>
              )}
              
              {user && <FreeTourCounter />}
            </div>
          )}
        </div>
      </div>

      <IntelligentTourDialog
        open={isIntelligentTourOpen}
        onOpenChange={setIsIntelligentTourOpen}
        onTourGenerated={handleTourGenerated}
        onAuthRequired={handleAuthRequired}
        onTourDataReceived={handleTourDataReceived}
      />

      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
        postAuthAction="smart-tour"
      />

      <ExperiencesDrawer
        open={isExperiencesDrawerOpen}
        onOpenChange={setIsExperiencesDrawerOpen}
        onIntelligentTourOpen={onIntelligentTourOpen}
        onAuthDialogOpen={() => setIsAuthDialogOpen(true)}
      />
    </>
  );
};

export default TopControls;
