
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import SplashScreen from '@/components/SplashScreen';
import MainLayout from '@/components/MainLayout';
import DebugWindow from '@/components/DebugWindow';
import { landmarks as staticLandmarks, Landmark } from '@/data/landmarks';
import { useAuth } from '@/components/AuthProvider';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useDialogStates } from '@/hooks/useDialogStates';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';
import { useDebugWindow } from '@/hooks/useDebugWindow';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';

interface IndexProps {
  onRegisterPostAuthActions?: (actions: { onSmartTour?: () => void }) => void;
}

const Index: React.FC<IndexProps> = ({ onRegisterPostAuthActions }) => {
  const [showSplash, setShowSplash] = useState(true);
  const [smartTourLandmarks, setSmartTourLandmarks] = useState<Landmark[]>([]);
  const [voiceTourData, setVoiceTourData] = useState<{
    destination: string;
    systemPrompt: string;
    landmarks: any[];
  } | null>(null);
  
  const { user, signOut } = useAuth();
  const mapboxToken = useMapboxToken();
  const { isVisible: isDebugVisible, toggle: toggleDebug } = useDebugWindow();
  
  const {
    selectedLandmark,
    setSelectedLandmark,
    isInteractionHistoryOpen,
    setIsInteractionHistoryOpen,
    isAuthDialogOpen,
    setIsAuthDialogOpen,
    isNewTourAssistantOpen,
    setIsNewTourAssistantOpen,
    isIntelligentTourOpen,
    setIsIntelligentTourOpen,
  } = useDialogStates();

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
  
  // Combine static landmarks with smart tour landmarks
  const allLandmarks: Landmark[] = useMemo(() => {
    return [...staticLandmarks, ...smartTourLandmarks];
  }, [smartTourLandmarks]);

  const handleSelectLandmark = useCallback((landmark: Landmark) => {
    setSelectedLandmark(landmark);
  }, [setSelectedLandmark]);

  const handleAuthDialogClose = (open: boolean) => {
    setIsAuthDialogOpen(open);
  };

  const handleVoiceAssistantOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsNewTourAssistantOpen(true);
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

  const handleTourGenerated = (landmarks: any[]) => {
    // Set generated landmarks as smart tour landmarks
    setSmartTourLandmarks(landmarks);
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

  // Handler for when tour is ready for voice agent
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
        smartTourLandmarks={smartTourLandmarks}
        user={user}
        onSelectLandmark={handleSelectLandmark}
        onVoiceSearchOpen={handleInteractionHistoryOpen}
        onVoiceAssistantOpen={handleNewTourAssistantOpen}
        onLogoClick={handleLogoClick}
        onSignOut={signOut}
        onAuthDialogOpen={() => setIsAuthDialogOpen(true)}
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
