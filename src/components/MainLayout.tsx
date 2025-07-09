import React, { useState, useRef, useEffect, useMemo } from 'react';
import Map from '@/components/Map';
import TopControls from '@/components/TopControls';
import UserControls from '@/components/UserControls';
import DialogManager from '@/components/DialogManager';
import NewTourAssistant from '@/components/NewTourAssistant';
import FloatingTourGuideFAB from '@/components/FloatingTourGuideFAB';
import ProximityControlPanel from '@/components/ProximityControlPanel';
import FloatingProximityCard from '@/components/FloatingProximityCard';
import DebugWindow from '@/components/DebugWindow';
import { useDebugWindow } from '@/hooks/useDebugWindow';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';
import { useProximityCards } from '@/hooks/useProximityCards';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { Landmark } from '@/data/landmarks';
import { User } from '@supabase/supabase-js';

type AssistantState = 'not-started' | 'started' | 'listening' | 'recording' | 'playback';

interface MainLayoutProps {
  mapboxToken: string;
  allLandmarks: Landmark[];
  selectedLandmark: Landmark | null;
  smartTourLandmarks: Landmark[];
  user: User | null;
  onSelectLandmark: (landmark: Landmark) => void;
  onVoiceSearchOpen: () => void;
  onVoiceAssistantOpen: () => void;
  onLogoClick: () => void;
  onSignOut: () => Promise<void>;
  onAuthDialogOpen: () => void;
  isVoiceSearchOpen: boolean;
  onVoiceSearchOpenChange: (open: boolean) => void;
  isAuthDialogOpen: boolean;
  onAuthDialogOpenChange: (open: boolean) => void;
  isNewTourAssistantOpen: boolean;
  onNewTourAssistantOpenChange: (open: boolean) => void;
  isIntelligentTourOpen: boolean;
  onIntelligentTourOpenChange: (open: boolean) => void;
  onTourGenerated?: (landmarks: any[], clearTransitRoute?: () => void) => void;
  onTourReadyForVoice?: (tourData: { destination: string; systemPrompt: string; landmarks: any[] }) => void;
  voiceTourData?: { destination: string; systemPrompt: string; landmarks: any[] } | null;
  tourKey?: string;
  onVoiceAgentStateChange?: (isActive: boolean) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  mapboxToken,
  allLandmarks,
  selectedLandmark,
  smartTourLandmarks,
  user,
  onSelectLandmark,
  onVoiceSearchOpen,
  onVoiceAssistantOpen,
  onLogoClick,
  onSignOut,
  onAuthDialogOpen,
  isVoiceSearchOpen,
  onVoiceSearchOpenChange,
  isAuthDialogOpen,
  onAuthDialogOpenChange,
  isNewTourAssistantOpen,
  onNewTourAssistantOpenChange,
  isIntelligentTourOpen,
  onIntelligentTourOpenChange,
  onTourGenerated,
  onTourReadyForVoice,
  voiceTourData,
  tourKey,
  onVoiceAgentStateChange,
}) => {
  const { isVisible: isDebugVisible, toggle: toggleDebug } = useDebugWindow();
  const { userLocation } = useLocationTracking();
  const { isActiveInstance } = useProximityNotifications();
  const { activeCardLandmark, closeCard } = useProximityCards();
  
  // Instance tracking for debugging
  const instanceIdRef = useRef(`layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  // 🔥 ADD VOICE AGENT STATE DEBUGGING
  const [voiceAgentDebugState, setVoiceAgentDebugState] = useState<string>('inactive');
  
  useEffect(() => {
    console.log(`🏗️ MainLayout instance ${instanceIdRef.current} mounted`);
    console.log(`🎯 Proximity notifications active instance: ${isActiveInstance}`);
    console.log(`🎙️ Voice agent state: ${voiceAgentDebugState}`);
    
    return () => {
      console.log(`🏗️ MainLayout instance ${instanceIdRef.current} unmounted`);
    };
  }, [isActiveInstance, voiceAgentDebugState]);
  
  
  // New state for FAB management
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [assistantState, setAssistantState] = useState<AssistantState>('not-started');
  
  // State to track clearTransitRoute function from Map
  const [clearTransitRoute, setClearTransitRoute] = useState<(() => void) | null>(null);
  
  // Memoize plannedLandmarks to prevent unnecessary Map re-renders
  const memoizedPlannedLandmarks = useMemo(() => [...smartTourLandmarks], [smartTourLandmarks]);

  const handleLocationSelect = () => {
    console.log('Location select called but no action taken');
  };

  // Simplified - let the dialog handle authentication internally
  const handleIntelligentTourOpen = (landmarkDestination?: Landmark) => {
    if (landmarkDestination) {
      console.log('🎯 Opening intelligent tour with pre-selected landmark:', landmarkDestination.name);
      // Store the landmark for the dialog to use
      (window as any).pendingLandmarkDestination = landmarkDestination;
    }
    onIntelligentTourOpenChange(true);
  };

  // FIXED: Ensure the auth dialog opens when required
  const handleAuthRequired = () => {
    console.log('🚨 AUTH: MainLayout handleAuthRequired called - opening auth dialog');
    onAuthDialogOpen();
  };


  // Helper function to get fallback destination from smart tour landmarks
  const getFallbackDestination = () => {
    if (smartTourLandmarks.length > 0) {
      // Extract city/region from first landmark or use a generic description
      const firstLandmark = smartTourLandmarks[0];
      // For now, return a generic description - could be enhanced to parse location
      return `Tour of ${smartTourLandmarks.length} amazing places`;
    }
    return 'Smart Tour';
  };

  // Get destination with fallback logic
  const getDestination = () => {
    if (voiceTourData?.destination) {
      return voiceTourData.destination;
    }
    return getFallbackDestination();
  };

  // Handle session state change from NewTourAssistant
  const handleSessionStateChange = (isActive: boolean, state: AssistantState) => {
    console.log('🎙️ Voice agent session state changed:', { isActive, state });
    console.log('🗺️ [DEBUG] Voice agent state change - checking if this affects map');
    
    // 🔥 UPDATE DEBUG STATE
    setVoiceAgentDebugState(`${isActive ? 'active' : 'inactive'}-${state}`);
    
    setIsSessionActive(isActive);
    setAssistantState(state);
    onVoiceAgentStateChange?.(isActive);
    
    console.log('🗺️ [DEBUG] Voice agent state change completed - map should NOT reset');
  };

  // Handle FAB click - reopen the tour assistant dialog
  const handleFABClick = () => {
    console.log('FAB clicked - reopening tour assistant');
    onNewTourAssistantOpenChange(true);
  };

  // Handle FAB long press - end session
  const handleFABLongPress = () => {
    console.log('FAB long pressed - ending session');
    // The session will be ended by the NewTourAssistant component
    // We just need to trigger the appropriate action
    setIsSessionActive(false);
    setAssistantState('not-started');
  };


  return (
    <div className="w-screen h-screen relative">
      <TopControls
        allLandmarks={allLandmarks}
        onSelectLandmark={onSelectLandmark}
        onVoiceSearchOpen={onVoiceSearchOpen}
        onVoiceAssistantOpen={onVoiceAssistantOpen}
        onLogoClick={onLogoClick}
        user={user}
        smartTourLandmarks={smartTourLandmarks}
        onIntelligentTourOpen={handleIntelligentTourOpen}
      />

      <UserControls
        user={user}
        onSignOut={onSignOut}
        onAuthDialogOpen={onAuthDialogOpen}
      />

      <Map 
        mapboxToken={mapboxToken}
        landmarks={allLandmarks}
        onSelectLandmark={onSelectLandmark}
        selectedLandmark={selectedLandmark}
        plannedLandmarks={memoizedPlannedLandmarks}
        onClearTransitRouteRef={(clearFn) => setClearTransitRoute(() => clearFn)}
        onIntelligentTourOpen={handleIntelligentTourOpen}
        onAuthDialogOpen={handleAuthRequired}
      />


      {/* Floating Tour Guide FAB - shows when session is active but dialog is closed */}
      <FloatingTourGuideFAB
        isVisible={isSessionActive && !isNewTourAssistantOpen}
        assistantState={assistantState}
        onClick={handleFABClick}
        onLongPress={handleFABLongPress}
      />

      <DialogManager
        isVoiceSearchOpen={isVoiceSearchOpen}
        onVoiceSearchOpenChange={onVoiceSearchOpenChange}
        isAuthDialogOpen={isAuthDialogOpen}
        onAuthDialogOpenChange={onAuthDialogOpenChange}
        onLocationSelect={handleLocationSelect}
        isIntelligentTourOpen={isIntelligentTourOpen}
        onIntelligentTourOpenChange={onIntelligentTourOpenChange}
        onTourGenerated={(landmarks) => onTourGenerated?.(landmarks, clearTransitRoute || undefined)}
        onAuthRequired={handleAuthRequired}
        onTourReadyForVoice={onTourReadyForVoice}
      />

      <NewTourAssistant
        key={tourKey} // 🔑 Force remount for each new tour
        open={isNewTourAssistantOpen}
        onOpenChange={onNewTourAssistantOpenChange}
        voiceTourData={voiceTourData}
        landmarks={voiceTourData?.landmarks || smartTourLandmarks}
        onSessionStateChange={handleSessionStateChange}
      />

      {/* Floating Proximity Card */}
      {activeCardLandmark && userLocation && (
        <FloatingProximityCard
          landmark={{
            id: activeCardLandmark.id || activeCardLandmark.placeId,
            name: activeCardLandmark.name,
            coordinates: activeCardLandmark.coordinates,
            description: activeCardLandmark.description,
            rating: activeCardLandmark.rating,
            photos: activeCardLandmark.photos,
            types: activeCardLandmark.types,
            placeId: activeCardLandmark.placeId,
            formattedAddress: activeCardLandmark.formattedAddress
          }}
          userLocation={userLocation}
          onClose={closeCard}
          onGetDirections={(service) => {
            console.log('Getting directions to:', service.name);
            // TODO: Implement directions logic if needed
          }}
        />
      )}

      <DebugWindow
        isVisible={isDebugVisible}
        onClose={toggleDebug}
      />
    </div>
  );
};

export default MainLayout;
