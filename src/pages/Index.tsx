
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import SplashScreen from '@/components/SplashScreen';
import MainLayout from '@/components/MainLayout';
import DebugWindow from '@/components/DebugWindow';
import { landmarks as staticLandmarks, Landmark, EnhancedLandmark } from '@/data/landmarks';
import { useTourPlanner } from '@/hooks/useTourPlanner';
import { useAuth } from '@/components/AuthProvider';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { usePendingDestination } from '@/hooks/usePendingDestination';
import { useDialogStates } from '@/hooks/useDialogStates';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';
import { useDebugWindow } from '@/hooks/useDebugWindow';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';

interface IndexProps {
  onRegisterPostAuthActions?: (actions: { onSmartTour?: () => void }) => void;
}

const Index: React.FC<IndexProps> = ({ onRegisterPostAuthActions }) => {
  const [showSplash, setShowSplash] = useState(true);
  const [additionalLandmarks, setAdditionalLandmarks] = useState<Landmark[]>([]);
  const [voiceTourData, setVoiceTourData] = useState<{
    destination: string;
    systemPrompt: string;
    landmarks: any[];
  } | null>(null);
  
  const { tourPlan, plannedLandmarks, isLoading: isTourLoading, generateTour, progressState } = useTourPlanner();
  const { user, signOut } = useAuth();
  const mapboxToken = useMapboxToken();
  const { isVisible: isDebugVisible, toggle: toggleDebug } = useDebugWindow();
  
  const {
    selectedLandmark,
    setSelectedLandmark,
    isTourPlannerOpen,
    setIsTourPlannerOpen,
    isInteractionHistoryOpen,
    setIsInteractionHistoryOpen,
    isAuthDialogOpen,
    setIsAuthDialogOpen,
    isNewTourAssistantOpen,
    setIsNewTourAssistantOpen,
    isIntelligentTourOpen,
    setIsIntelligentTourOpen,
  } = useDialogStates();
  
  // Updated to include callback for opening NewTourAssistant
  const { handleTourAuthRequired: storePendingDestination } = usePendingDestination(
    user, 
    isTourLoading, 
    generateTour,
    () => setIsNewTourAssistantOpen(true) // Callback to open NewTourAssistant
  );

  // Initialize proximity notifications
  useProximityNotifications();
  
  // Initialize connection monitoring
  useConnectionMonitor();

  // Register post-auth actions with App component
  useEffect(() => {
    if (onRegisterPostAuthActions) {
      onRegisterPostAuthActions({
        onSmartTour: () => {
          console.log('🎯 Executing post-auth smart tour action');
          setIsIntelligentTourOpen(true);
        }
      });
    }
  }, [onRegisterPostAuthActions, setIsIntelligentTourOpen]);
  
  // Combine static landmarks with enhanced tour landmarks
  const allLandmarks: (Landmark | EnhancedLandmark)[] = useMemo(() => {
    const tourLandmarks = tourPlan?.landmarks || [];
    return [...staticLandmarks, ...tourLandmarks, ...additionalLandmarks];
  }, [tourPlan?.landmarks, additionalLandmarks]);

  // Also keep the basic plannedLandmarks for backward compatibility
  const basicPlannedLandmarks = useMemo(() => {
    return plannedLandmarks;
  }, [plannedLandmarks]);

  const handleSelectLandmark = useCallback((landmark: Landmark) => {
    setSelectedLandmark(landmark);
  }, [setSelectedLandmark]);

  const handleGenerateTour = async (destination: string) => {
    await generateTour(destination);
    
    // Watch for the 'ready' phase to close tour planner and open assistant
    const waitForReady = () => {
      if (progressState?.phase === 'ready') {
        setIsTourPlannerOpen(false);
        setIsNewTourAssistantOpen(true);
      } else {
        // If not ready yet, check again in 100ms
        setTimeout(waitForReady, 100);
      }
    };
    
    // Start checking for ready state
    setTimeout(waitForReady, 100);
  };

  const handleAuthDialogClose = (open: boolean) => {
    setIsAuthDialogOpen(open);
  };

  const handleVoiceAssistantOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsInteractionHistoryOpen(true);
  };

  const handleInteractionHistoryOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsInteractionHistoryOpen(true);
  };

  const handleSplashDismiss = () => {
    setShowSplash(false);
  };

  const handleLogoClick = () => {
    setShowSplash(true);
  };

  const handleNewTourAssistantOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsNewTourAssistantOpen(true);
  };

  const handleTourAuthRequired = (destination: string) => {
    // Store the destination for post-auth generation
    storePendingDestination(destination);
    // Open the auth dialog
    setIsAuthDialogOpen(true);
  };

  const handleTourGenerated = (landmarks: any[]) => {
    // Add generated landmarks to additional landmarks
    setAdditionalLandmarks(prev => [...prev, ...landmarks]);
    // Close the intelligent tour dialog
    setIsIntelligentTourOpen(false);
  };

  // Handler for Intelligent Tour - authentication is handled within the dialog now
  const handleIntelligentTourOpen = () => {
    setIsIntelligentTourOpen(true);
  };

  // Handler for auth required from IntelligentTourDialog
  const handleIntelligentTourAuthRequired = () => {
    setIsAuthDialogOpen(true);
  };

  // NEW: Handler for when tour is ready for voice agent
  const handleTourReadyForVoice = (tourData: { destination: string; systemPrompt: string; landmarks: any[] }) => {
    console.log('🎙️ Tour ready for voice agent:', tourData.destination);
    
    // Store the tour data for the voice assistant
    setVoiceTourData(tourData);
    
    // Close the intelligent tour dialog
    setIsIntelligentTourOpen(false);
    
    // Open the voice assistant with the tour data
    setIsNewTourAssistantOpen(true);
  };

  if (showSplash) {
    return <SplashScreen onDismiss={handleSplashDismiss} />;
  }

  // Don't render the map until we have a token
  if (!mapboxToken) {
    return <div className="w-screen h-screen flex items-center justify-center">Loading map...</div>;
  }

  return (
    <>
      <MainLayout
        mapboxToken={mapboxToken}
        allLandmarks={allLandmarks}
        selectedLandmark={selectedLandmark}
        plannedLandmarks={basicPlannedLandmarks}
        user={user}
        onSelectLandmark={handleSelectLandmark}
        onTourPlannerOpen={() => setIsTourPlannerOpen(true)}
        onVoiceSearchOpen={handleInteractionHistoryOpen}
        onVoiceAssistantOpen={handleNewTourAssistantOpen}
        onLogoClick={handleLogoClick}
        onSignOut={signOut}
        onAuthDialogOpen={() => setIsAuthDialogOpen(true)}
        isTourPlannerOpen={isTourPlannerOpen}
        onTourPlannerOpenChange={setIsTourPlannerOpen}
        onGenerateTour={handleGenerateTour}
        onTourAuthRequired={handleTourAuthRequired}
        isTourLoading={isTourLoading}
        tourProgressState={progressState}
        isVoiceSearchOpen={isInteractionHistoryOpen}
        onVoiceSearchOpenChange={setIsInteractionHistoryOpen}
        isAuthDialogOpen={isAuthDialogOpen}
        onAuthDialogOpenChange={handleAuthDialogClose}
        isNewTourAssistantOpen={isNewTourAssistantOpen}
        onNewTourAssistantOpenChange={setIsNewTourAssistantOpen}
        isIntelligentTourOpen={isIntelligentTourOpen}
        onIntelligentTourOpenChange={setIsIntelligentTourOpen}
        onTourGenerated={handleTourGenerated}
        onTourReadyForVoice={handleTourReadyForVoice}
        tourPlan={tourPlan}
        voiceTourData={voiceTourData}
      />
      <DebugWindow 
        isVisible={isDebugVisible}
        onClose={toggleDebug}
      />
    </>
  );
};

export default Index;
