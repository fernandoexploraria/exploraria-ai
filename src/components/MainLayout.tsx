
import React, { useState } from 'react';
import Map from '@/components/Map';
import TopControls from '@/components/TopControls';
import UserControls from '@/components/UserControls';
import DialogManager from '@/components/DialogManager';
import NewTourAssistant from '@/components/NewTourAssistant';
import ProximityControlPanel from '@/components/ProximityControlPanel';
import FloatingProximityCard from '@/components/FloatingProximityCard';
import DebugWindow from '@/components/DebugWindow';
import { useDebugWindow } from '@/hooks/useDebugWindow';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { Landmark } from '@/data/landmarks';
import { User } from '@supabase/supabase-js';
import { ProgressState } from '@/hooks/useTourPlanner';

interface MainLayoutProps {
  mapboxToken: string;
  allLandmarks: Landmark[];
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
  user: User | null;
  onSelectLandmark: (landmark: Landmark) => void;
  onTourPlannerOpen: () => void;
  onVoiceSearchOpen: () => void;
  onVoiceAssistantOpen: () => void;
  onLogoClick: () => void;
  onSignOut: () => Promise<void>;
  onAuthDialogOpen: () => void;
  isTourPlannerOpen: boolean;
  onTourPlannerOpenChange: (open: boolean) => void;
  onGenerateTour: (destination: string) => Promise<void>;
  onTourAuthRequired: (destination: string) => void;
  isTourLoading: boolean;
  tourProgressState?: ProgressState;
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
  tourPlan: any;
  voiceTourData?: { destination: string; systemPrompt: string; landmarks: any[] } | null;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  mapboxToken,
  allLandmarks,
  selectedLandmark,
  plannedLandmarks,
  user,
  onSelectLandmark,
  onTourPlannerOpen,
  onVoiceSearchOpen,
  onVoiceAssistantOpen,
  onLogoClick,
  onSignOut,
  onAuthDialogOpen,
  isTourPlannerOpen,
  onTourPlannerOpenChange,
  onGenerateTour,
  onTourAuthRequired,
  isTourLoading,
  tourProgressState,
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
  tourPlan,
  voiceTourData,
}) => {
  const { isVisible: isDebugVisible, toggle: toggleDebug } = useDebugWindow();
  const { userLocation } = useLocationTracking();
  const { activeCards, closeProximityCard, showRouteToService } = useProximityNotifications();
  
  // Debug state for test proximity card
  const [debugProximityCard, setDebugProximityCard] = useState<Landmark | null>(null);

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

  return (
    <div className="w-screen h-screen relative">
      <TopControls
        allLandmarks={allLandmarks}
        onSelectLandmark={onSelectLandmark}
        onTourPlannerOpen={onTourPlannerOpen}
        onVoiceSearchOpen={onVoiceSearchOpen}
        onVoiceAssistantOpen={onVoiceAssistantOpen}
        onLogoClick={onLogoClick}
        user={user}
        plannedLandmarks={plannedLandmarks}
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
        landmarks={allLandmarks}
        onSelectLandmark={onSelectLandmark}
        selectedLandmark={selectedLandmark}
        plannedLandmarks={[...plannedLandmarks]}
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

      {/* Regular Floating Proximity Cards */}
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

      <DialogManager
        isTourPlannerOpen={isTourPlannerOpen}
        onTourPlannerOpenChange={onTourPlannerOpenChange}
        onGenerateTour={onGenerateTour}
        onTourAuthRequired={onTourAuthRequired}
        isTourLoading={isTourLoading}
        tourProgressState={tourProgressState}
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
        destination={voiceTourData?.destination || tourPlan?.destination || ''}
        landmarks={voiceTourData?.landmarks || plannedLandmarks}
        systemPrompt={voiceTourData?.systemPrompt || tourPlan?.systemPrompt}
      />

      <DebugWindow
        isVisible={isDebugVisible}
        onClose={toggleDebug}
      />
    </div>
  );
};

export default MainLayout;
