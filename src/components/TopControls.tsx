import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
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
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import IntelligentTourDialog from './IntelligentTourDialog';
import AuthDialog from './AuthDialog';
import ExperiencesDrawer from './ExperiencesDrawer';
import { useAuth } from '@/components/AuthProvider';
import { PostAuthAction, setPostAuthAction, setPostAuthLandmark } from '@/utils/authActions';
import { performComprehensiveTourReset } from '@/utils/tourResetUtils';
import { useApplePurchase } from '@/hooks/useApplePurchase';
interface TopControlsProps {
  allLandmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  onVoiceSearchOpen: () => void;
  onVoiceAssistantOpen: () => void;
  onLogoClick: () => void;
  user: any;
  smartTourLandmarks: Landmark[];
  onIntelligentTourOpen: () => void;
  onAuthDialogOpen?: () => void;
  onTestProximityCard?: () => void;
  agentId?: string;
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
  agentId
}) => {
  const {
    user: authUser
  } = useAuth();
  const { subscriptionData } = useSubscription();
  
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false);
  const [isTestingCors, setIsTestingCors] = useState(false);
  const [isIntelligentTourOpen, setIsIntelligentTourOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isExperiencesDrawerOpen, setIsExperiencesDrawerOpen] = useState(false);
  const [agent_id, setAgent_id] = useState<string | null>(null);
  const {
    toast
  } = useToast();
  const {
    isDemoMode,
    toggleDemoMode
  } = useDemoMode();
  const {
    connectionHealth
  } = useConnectionMonitor();
  const { 
    isAvailable: isApplePayAvailable, 
    isProcessing: isApplePayProcessing, 
    purchaseSubscription: purchaseAppleSubscription,
    error: applePayError 
  } = useApplePurchase();

  // Update agent_id state when prop changes
  React.useEffect(() => {
    if (agentId) {
      setAgent_id(agentId);
    }
  }, [agentId]);
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };
  const handleTestCors = async () => {
    setIsTestingCors(true);
    console.log('🧪 Starting CORS test...');
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('test-cors', {
        body: {
          test: 'cors-functionality'
        }
      });
      if (error) {
        console.error('🧪 CORS test error:', error);
        toast({
          title: "CORS Test Failed",
          description: `Error: ${error.message}`,
          variant: "destructive"
        });
      } else {
        console.log('🧪 CORS test success:', data);
        toast({
          title: "CORS Test Successful!",
          description: `Response: ${data.message}`
        });
      }
    } catch (error) {
      console.error('🧪 CORS test exception:', error);
      toast({
        title: "CORS Test Exception",
        description: `Exception: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsTestingCors(false);
    }
  };
  const handleSmartTourClick = () => {
    console.log('🎯 Smart Tour clicked from TopControls, user:', authUser?.id);
    if (!authUser) {
      console.log('🚨 User not authenticated, opening auth dialog with smart-tour action');
      setIsAuthDialogOpen(true);
    } else {
      console.log('✅ User authenticated, opening smart tour dialog');
      // Note: Reset logic is now handled by onIntelligentTourOpen from parent
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
      description: `${landmarks.length} amazing places added to your map`
    });
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
      description: "Showing test proximity card for Fuente de los Coyotes"
    });
  };

  const handleApplePaySubscribe = async () => {
    if (!authUser) {
      console.log('🚨 User not authenticated, opening auth dialog');
      setIsAuthDialogOpen(true);
      return;
    }

    if (applePayError) {
      toast({
        title: "Apple Pay Error",
        description: applePayError,
        variant: "destructive"
      });
      return;
    }

    await purchaseAppleSubscription();
  };

  // Detect if running in native app
  const isNativeApp = Capacitor.isNativePlatform();

  // Apply safe area padding only in native app
  const containerClasses = isNativeApp ? "absolute top-4 left-4 z-10 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)]" : "absolute top-4 left-4 z-10";
  return <>
      <div className={containerClasses}>
        <div className="flex flex-col items-start gap-2 max-w-[calc(100vw-120px)]">
          <img src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" alt="Exploraria Logo" className="h-16 w-auto bg-yellow-400 rounded-lg p-1 flex-shrink-0 lg:h-20 cursor-pointer hover:bg-yellow-300 transition-all duration-200" onClick={onLogoClick} />
          
          <SearchControl landmarks={allLandmarks} onSelectLandmark={onSelectLandmark} />
          
          {isDemoMode && (isCollapsed || !connectionHealth.isHealthy) && <ConnectionStatus compact className="w-full" />}
          
          <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2" onClick={toggleCollapse}>
            <Menu className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
            <span className="lg:hidden">Menu</span>
            <span className="hidden lg:inline">Menu</span>
            {isCollapsed ? <ChevronDown className="ml-auto h-3 w-3 lg:h-4 lg:w-4" /> : <ChevronUp className="ml-auto h-3 w-3 lg:h-4 lg:w-4" />}
          </Button>
          
          {!isCollapsed && <div className="flex flex-col gap-1 w-full animate-fade-in">
              {/* Demo Mode Toggle - Only visible for specific user */}
              {authUser?.email === 'fobregona@yahoo.com' && <Button variant={isDemoMode ? "default" : "outline"} size="sm" className={`backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2 ${isDemoMode ? 'bg-green-500/80 hover:bg-green-400/80 text-white border-green-400' : 'bg-background/80 hover:bg-accent hover:text-accent-foreground'}`} onClick={toggleDemoMode}>
                  {isDemoMode ? <ToggleRight className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" /> : <ToggleLeft className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />}
                  <span className="lg:hidden">{isDemoMode ? 'Demo On' : 'Demo Off'}</span>
                  <span className="hidden lg:inline">{isDemoMode ? 'Demo Mode On' : 'Demo Mode Off'}</span>
                </Button>}
              
              <Button variant="outline" size="sm" className="bg-gradient-to-r from-yellow-400/80 to-orange-400/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2 border-yellow-300 hover:from-yellow-300/80 hover:to-orange-300/80" onClick={handleSmartTourClick}>
                <Sparkles className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                <span className="lg:hidden">Smart Tour</span>
                <span className="hidden lg:inline">Smart Tour</span>
              </Button>
              
              {/* Experiences Button */}
              {(
                <Button variant="outline" size="sm" className="bg-gradient-to-r from-purple-400/80 to-pink-400/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2 border-purple-300 hover:from-purple-300/80 hover:to-pink-300/80" onClick={handleExperiencesClick}>
                  <Compass className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                  <span className="lg:hidden">Experiences</span>
                  <span className="hidden lg:inline">Experiences</span>
                </Button>
              )}
              
              {/* Apple Pay Subscribe Button - Only show on iOS when available and not subscribed */}
              {isApplePayAvailable && !subscriptionData?.subscribed && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2 border-gray-700 hover:from-gray-700/80 hover:to-gray-800/80 text-white" 
                  onClick={handleApplePaySubscribe}
                  disabled={isApplePayProcessing}
                >
                  <svg className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <span className="lg:hidden">{isApplePayProcessing ? 'Processing...' : 'Apple Pay'}</span>
                  <span className="hidden lg:inline">{isApplePayProcessing ? 'Processing...' : 'Subscribe with Apple Pay'}</span>
                </Button>
              )}
              
              {/* Tour Guide Button - only appears when there's an active Smart Tour */}
              {smartTourLandmarks.length > 0 && <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2" onClick={onVoiceAssistantOpen}>
                  <Sparkles className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                  Tour Guide
                </Button>}
              
              {user && <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2" onClick={onVoiceSearchOpen}>
                  <Search className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                  Travel Log
                </Button>}

              {/* Image Analysis Button - only appears when there's an active Smart Tour */}
              <ImageAnalysis smartTourLandmarks={smartTourLandmarks} />
              
              {/* Debug Tools - Shown in Demo Mode */}
              {isDemoMode && <>
                  <ConnectionStatus showDetails className="w-full" />
                  
                  <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2" onClick={handleTestCors} disabled={isTestingCors}>
                    <TestTube className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                    {isTestingCors ? 'Testing...' : 'Test CORS'}
                  </Button>

                  <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2" onClick={handleTestProximityCard}>
                    <MapPin className="mr-1 h-3 w-3 lg:mr-2 lg:h-4 lg:w-4" />
                    Test Proximity Card
                  </Button>
                  
                  <Drawer open={isDebugDrawerOpen} onOpenChange={setIsDebugDrawerOpen}>
                    <DrawerTrigger asChild>
                      <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:h-10 lg:text-sm lg:px-4 lg:py-2">
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
                </>}
              
              {user && <FreeTourCounter />}
            </div>}
        </div>
      </div>

      <IntelligentTourDialog open={isIntelligentTourOpen} onOpenChange={setIsIntelligentTourOpen} onTourGenerated={handleTourGenerated} onAuthRequired={handleAuthRequired} />

      <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} postAuthAction="smart-tour" />

      <ExperiencesDrawer open={isExperiencesDrawerOpen} onOpenChange={setIsExperiencesDrawerOpen} onIntelligentTourOpen={onIntelligentTourOpen} onAuthDialogOpen={() => setIsAuthDialogOpen(true)} />
    </>;
};
export default TopControls;