import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  onTourReadyForVoice?: (tourData: { destination: string; systemPrompt: string; landmarks: any[]; agentId?: string }) => void;
  voiceTourData?: { destination: string; systemPrompt: string; landmarks: any[]; agentId?: string } | null;
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
  const { activeCards, closeProximityCard, showRouteToService, isActiveInstance } = useProximityNotifications();
  
  // Instance tracking for debugging
  const instanceIdRef = useRef(`layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  // 🔥 ADD VOICE AGENT STATE DEBUGGING
  const [voiceAgentDebugState, setVoiceAgentDebugState] = useState<string>('inactive');
  
  // 🐛 DEBUG: Log proximity card state changes
  useEffect(() => {
    console.log(`🏗️ MainLayout instance ${instanceIdRef.current} mounted`);
    console.log(`🎯 Proximity notifications active instance: ${isActiveInstance}`);
    console.log(`🎙️ Voice agent state: ${voiceAgentDebugState}`);
    console.log(`🏪 [MainLayout] Active cards state:`, activeCards);
    console.log(`🏪 [MainLayout] Active cards count:`, Object.keys(activeCards).length);
    
    return () => {
      console.log(`🏗️ MainLayout instance ${instanceIdRef.current} unmounted`);
    };
  }, [isActiveInstance, voiceAgentDebugState, activeCards]);
  
  // Debug state for test proximity card
  const [debugProximityCard, setDebugProximityCard] = useState<Landmark | null>(null);
  
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

  // Create mock test landmark for debugging - FIXED: removed category property
  const createTestLandmark = (): Landmark => ({
    id: 'debug-fuente-coyotes',
    name: 'Fuente de los Coyotes',
    description: 'A beautiful fountain located in Mexico City, perfect for testing proximity card functionality with nearby services.',
    coordinates: [-99.1332, 19.4326] // Mexico City coordinates
  });

  // Handle test proximity card display
  const handleTestProximityCard = () => {
    console.log(`🧪 [${instanceIdRef.current}] Debug: Creating test proximity card for Fuente de los Coyotes`);
    const testLandmark = createTestLandmark();
    setDebugProximityCard(testLandmark);
  };

  // Close debug proximity card
  const closeDebugProximityCard = () => {
    console.log(`🧪 [${instanceIdRef.current}] Debug: Closing test proximity card`);
    setDebugProximityCard(null);
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

// Phase 2: Memoized Card Component for stable rendering
const MemoizedProximityCard = React.memo<{
  landmarkId: string;
  tourLandmark: any;
  index: number;
  userLocation: { latitude: number; longitude: number } | null;
  stableCallbacks: {
    handleCloseProximityCard: (landmarkId: string) => void;
    handleGetDirections: (service: any) => void;
    convertTourLandmarkToLandmark: (tourLandmark: any) => Landmark;
  };
}>(({ landmarkId, tourLandmark, index, userLocation, stableCallbacks }) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: `${24 + (index * 420)}px`, // Stack cards vertically with 420px spacing
        right: '16px',
        zIndex: 40 + index // Ensure proper stacking order
      }}
    >
      <FloatingProximityCard
        landmark={stableCallbacks.convertTourLandmarkToLandmark(tourLandmark)}
        userLocation={userLocation}
        onClose={() => stableCallbacks.handleCloseProximityCard(landmarkId)}
        onGetDirections={stableCallbacks.handleGetDirections}
      />
    </div>
  );
});

  // Phase 1: Optimize useMemo Dependencies - Memoize activeCards entries
  const activeCardsEntries = useMemo(() => {
    console.log(`🏪 [MainLayout] Computing activeCardsEntries:`, Object.entries(activeCards));
    return Object.entries(activeCards);
  }, [activeCards]);

  // Stabilize callback functions with memoization
  const stableCallbacks = useMemo(() => ({
    handleCloseProximityCard: (landmarkId: string) => closeProximityCard(landmarkId),
    handleGetDirections: (service: any) => showRouteToService(service),
    convertTourLandmarkToLandmark: (tourLandmark: any): Landmark => ({
      id: tourLandmark.id || tourLandmark.placeId,
      name: tourLandmark.name,
      coordinates: tourLandmark.coordinates,
      description: tourLandmark.description,
      rating: tourLandmark.rating,
      photos: tourLandmark.photos,
      types: tourLandmark.types,
      placeId: tourLandmark.placeId,
      formattedAddress: tourLandmark.formattedAddress
    })
  }), [closeProximityCard, showRouteToService]);

  // Phase 2: Extract Card Rendering Logic with memoization (userLocation separated)
  const renderedCards = useMemo(() => {
    console.log(`🏪 [MainLayout] Rendering cards - activeCardsEntries:`, activeCardsEntries);
    console.log(`🏪 [MainLayout] Will render ${activeCardsEntries.length} cards`);
    
    return activeCardsEntries.map(([landmarkId, tourLandmark], index) => (
      <MemoizedProximityCard
        key={landmarkId}
        landmarkId={landmarkId}
        tourLandmark={tourLandmark}
        index={index}
        userLocation={userLocation}
        stableCallbacks={stableCallbacks}
      />
    ));
  }, [activeCardsEntries, stableCallbacks, userLocation]); // Keep userLocation here for now

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
        onTestProximityCard={handleTestProximityCard}
        onExperienceLaunch={onTourReadyForVoice}
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

      {/* Debug Proximity Card - positioned above regular cards */}
      {debugProximityCard && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '16px',
            zIndex: 50 // Higher than regular cards
          }}
        >
          <FloatingProximityCard
            landmark={debugProximityCard}
            userLocation={userLocation}
            onClose={closeDebugProximityCard}
            onGetDirections={showRouteToService}
          />
        </div>
      )}

      {/* Regular Floating Proximity Cards - Optimized rendering */}
      {renderedCards}

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

      <DebugWindow
        isVisible={isDebugVisible}
        onClose={toggleDebug}
      />
    </div>
  );
};

export default MainLayout;
