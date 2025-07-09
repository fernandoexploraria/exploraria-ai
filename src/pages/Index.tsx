
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
import { performComprehensiveTourReset } from '@/utils/tourResetUtils';

interface IndexProps {
  onRegisterPostAuthActions?: (actions: { onSmartTour?: () => void }) => void;
  onVoiceAgentStateChange?: (isActive: boolean) => void;
}

const Index: React.FC<IndexProps> = ({ onRegisterPostAuthActions, onVoiceAgentStateChange }) => {
  const [showSplash, setShowSplash] = useState(true);
  const [smartTourLandmarks, setSmartTourLandmarks] = useState<Landmark[]>([]);
  const [voiceTourData, setVoiceTourData] = useState<{
    destination: string;
    systemPrompt: string;
    landmarks: any[];
    agentId?: string;
  } | null>(null);
  const [tourKey, setTourKey] = useState<string>('initial');
  
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
    resetAllDialogStates,
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
          handleIntelligentTourOpen();
        }
      });
    }
  }, [onRegisterPostAuthActions]);
  
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

  const handleTourGenerated = (landmarks: any[], clearTransitRoute?: () => void) => {
    console.log('🗺️ Tour generated with landmarks:', landmarks.length);
    // Clear previous smart tour landmarks before setting new ones
    setSmartTourLandmarks([]);
    // Clear any existing transit route when a new tour is generated
    if (clearTransitRoute) {
      clearTransitRoute();
    }
    // Wait a moment then set new landmarks
    setTimeout(() => {
      setSmartTourLandmarks(landmarks);
      console.log('🗺️ Smart tour landmarks updated:', landmarks.length);
    }, 100);
    // Close the intelligent tour dialog
    setIsIntelligentTourOpen(false);
  };

  // Enhanced handler for Intelligent Tour with comprehensive reset
  const handleIntelligentTourOpen = () => {
    console.log('🎯 Opening Intelligent Tour dialog - performing comprehensive reset');
    
    // Perform comprehensive reset before opening dialog
    performComprehensiveTourReset(
      {
        setIsIntelligentTourOpen,
        setIsNewTourAssistantOpen,
        setIsInteractionHistoryOpen,
        setSelectedLandmark,
      },
      {
        setSmartTourLandmarks,
        setVoiceTourData,
      }
    );
    
    // Wait for cleanup to complete before opening dialog
    setTimeout(() => {
      setIsIntelligentTourOpen(true);
    }, 200);
  };

  // Handler for auth required from IntelligentTourDialog
  const handleIntelligentTourAuthRequired = () => {
    setIsAuthDialogOpen(true);
  };

  // Enhanced handler for when tour is ready for voice agent
  const handleTourReadyForVoice = (tourData: { destination: string; systemPrompt: string; landmarks: any[]; agentId?: string }) => {
    console.log('🎙️ Tour ready for voice agent:', tourData.destination);
    console.log('🎙️ Previous voice tour data:', voiceTourData?.destination || 'none');
    
    // Clear any existing voice tour data first
    setVoiceTourData(null);
    
    // Generate new unique key to force NewTourAssistant remount
    const newTourKey = `tour-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setTourKey(newTourKey);
    console.log('🔄 Generated new tour key for fresh dialog instance:', newTourKey);
    
    // Set the new tour data after a brief delay to ensure cleanup
    setTimeout(() => {
      console.log('🎙️ Setting new voice tour data:', tourData.destination);
      setVoiceTourData(tourData);
      
      // Close the intelligent tour dialog
      setIsIntelligentTourOpen(false);
      
      // Open the voice assistant with the new tour data
      setIsNewTourAssistantOpen(true);
    }, 200);
  };

  // Enhanced handler to clear voice data when assistant closes
  const handleNewTourAssistantOpenChange = (open: boolean) => {
    setIsNewTourAssistantOpen(open);
    if (!open) {
      console.log('🎙️ Voice assistant closed - clearing tour data');
      // Clear voice tour data when assistant closes
      setTimeout(() => setVoiceTourData(null), 100);
    }
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
        onVoiceAssistantOpen={handleVoiceAssistantOpen}
        onLogoClick={handleLogoClick}
        onSignOut={signOut}
        onAuthDialogOpen={() => setIsAuthDialogOpen(true)}
        isVoiceSearchOpen={isInteractionHistoryOpen}
        onVoiceSearchOpenChange={setIsInteractionHistoryOpen}
        isAuthDialogOpen={isAuthDialogOpen}
        onAuthDialogOpenChange={handleAuthDialogClose}
        isNewTourAssistantOpen={isNewTourAssistantOpen}
        onNewTourAssistantOpenChange={handleNewTourAssistantOpenChange}
        onVoiceAgentStateChange={onVoiceAgentStateChange}
        isIntelligentTourOpen={isIntelligentTourOpen}
        onIntelligentTourOpenChange={setIsIntelligentTourOpen}
        onTourGenerated={handleTourGenerated}
        onTourReadyForVoice={handleTourReadyForVoice}
        voiceTourData={voiceTourData}
        tourKey={tourKey}
      />
      <DebugWindow 
        isVisible={isDebugVisible}
        onClose={toggleDebug}
      />
    </>
  );
};

export default Index;
