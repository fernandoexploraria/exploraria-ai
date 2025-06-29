
import React from 'react';
import Map from '@/components/Map';
import TopControls from '@/components/TopControls';
import UserControls from '@/components/UserControls';
import DialogManager from '@/components/DialogManager';
import NewTourAssistant from '@/components/NewTourAssistant';
import ProximityControlPanel from '@/components/ProximityControlPanel';
import DebugWindow from '@/components/DebugWindow';
import { useDebugWindow } from '@/hooks/useDebugWindow';
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
  tourPlan: any;
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
  tourPlan,
}) => {
  const { isVisible: isDebugVisible, toggle: toggleDebug } = useDebugWindow();

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
      />

      <NewTourAssistant
        open={isNewTourAssistantOpen}
        onOpenChange={onNewTourAssistantOpenChange}
        destination={tourPlan?.destination || ''}
        landmarks={plannedLandmarks}
        systemPrompt={tourPlan?.systemPrompt}
      />

      <DebugWindow
        isVisible={isDebugVisible}
        onClose={toggleDebug}
      />
    </div>
  );
};

export default MainLayout;
