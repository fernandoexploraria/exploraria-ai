
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
  onTourPlannerV2Open: () => void;
  onVoiceSearchOpen: () => void;
  onVoiceAssistantOpen: () => void;
  onLogoClick: () => void;
  onSignOut: () => Promise<void>;
  onAuthDialogOpen: () => void;
  isTourPlannerOpen: boolean;
  onTourPlannerOpenChange: (open: boolean) => void;
  isTourPlannerV2Open: boolean;
  onTourPlannerV2OpenChange: (open: boolean) => void;
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
  onTourPlannerV2Open,
  onVoiceSearchOpen,
  onVoiceAssistantOpen,
  onLogoClick,
  onSignOut,
  onAuthDialogOpen,
  isTourPlannerOpen,
  onTourPlannerOpenChange,
  isTourPlannerV2Open,
  onTourPlannerV2OpenChange,
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
  tourPlan,
}) => {
  const { isVisible: isDebugVisible, toggle: toggleDebug } = useDebugWindow();

  const handleLocationSelect = () => {
    console.log('Location select called but no action taken');
  };

  return (
    <div className="w-screen h-screen relative">
      <TopControls
        allLandmarks={allLandmarks}
        onSelectLandmark={onSelectLandmark}
        onTourPlannerOpen={onTourPlannerOpen}
        onTourPlannerV2Open={onTourPlannerV2Open}
        onVoiceSearchOpen={onVoiceSearchOpen}
        onVoiceAssistantOpen={onVoiceAssistantOpen}
        onLogoClick={onLogoClick}
        user={user}
        plannedLandmarks={plannedLandmarks}
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
