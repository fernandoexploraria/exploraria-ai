
import React, { useState } from 'react';
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
  onTourGenerated?: (landmarks: any[]) => void;
  onTourReadyForVoice?: (tourData: { destination: string; systemPrompt: string; landmarks: any[] }) => void;
  voiceTourData?: { destination: string; systemPrompt: string; landmarks: any[] } | null;
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
}) => {
  const { isVisible: isDebugVisible, toggle: toggleDebug } = useDebugWindow();
  const { userLocation } = useLocationTracking();
  const { activeCards, closeProximityCard, showRouteToService } = useProximityNotifications();
  
  // Debug state for test proximity card
  const [debugProximityCard, setDebugProximityCard] = useState<Landmark | null>(null);
  
  // New state for FAB management
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [assistantState, setAssistantState] = useState<AssistantState>('not-started');

  const handleLocationSelect = () => {
    console.log('Location select called but no action taken');
  };

  // Simplified - let the dialog handle authentication internally
  const handleIntelligentTourOpen = () => {
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
    console.log('🧪 Debug: Creating test proximity card for Fuente de los Coyotes');
    const testLandmark = createTestLandmark();
    setDebugProximityCard(testLandmark);
  };

  // Close debug proximity card
  const closeDebugProximityCard = () => {
    console.log('🧪 Debug: Closing test proximity card');
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
    console.log('Session state changed:', { isActive, state });
    setIsSessionActive(isActive);
    setAssistantState(state);
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

  // Convert TourLandmark to Landmark for components that require the Landmark interface
  const convertTourLandmarkToLandmark = (tourLandmark: any): Landmark => ({
    id: tourLandmark.id || tourLandmark.placeId, // Use id if available, fallback to placeId
    name: tourLandmark.name,
    coordinates: tourLandmark.coordinates,
    description: tourLandmark.description,
    rating: tourLandmark.rating,
    photos: tourLandmark.photos,
    types: tourLandmark.types,
    placeId: tourLandmark.placeId,
    formattedAddress: tourLandmark.formattedAddress
  });

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
      />

      <UserControls
        user={user}
        onSignOut={onSignOut}
        onAuthDialogOpen={onAuthDialogOpen}
      />

      <Map 
        mapboxToken={mapboxToken}
        allLandmarks={allLandmarks}
        smartTourLandmarks={smartTourLandmarks}
        onSelectLandmark={onSelectLandmark}
        selectedLandmark={selectedLandmark}
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

      {/* Regular Floating Proximity Cards - Convert TourLandmark to Landmark */}
      {Object.entries(activeCards).map(([landmarkId, landmark], index) => (
        <div
          key={landmarkId}
          style={{
            position: 'fixed',
            bottom: `${24 + (index * 420)}px`, // Stack cards vertically with 420px spacing
            right: '16px',
            zIndex: 40 + index // Ensure proper stacking order
          }}
        >
          <FloatingProximityCard
            landmark={landmark}
            userLocation={userLocation}
            onClose={() => closeProximityCard(landmarkId)}
            onGetDirections={showRouteToService}
          />
        </div>
      ))}

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
        onTourGenerated={onTourGenerated}
        onAuthRequired={handleAuthRequired}
        onTourReadyForVoice={onTourReadyForVoice}
      />

      <NewTourAssistant
        open={isNewTourAssistantOpen}
        onOpenChange={onNewTourAssistantOpenChange}
        destination="" // 🔥 SIMPLIFIED: NewTourAssistant will fetch from database
        landmarks={voiceTourData?.landmarks || smartTourLandmarks}
        systemPrompt="" // 🔥 SIMPLIFIED: NewTourAssistant will fetch from database
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
