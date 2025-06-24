
import React from 'react';
import Map from './Map';
import SearchControl from './SearchControl';
import TopControls from './TopControls';
import TourPlannerDialog from './TourPlannerDialog';
import VoiceSearchDialog from './VoiceSearchDialog';
import AuthDialog from './AuthDialog';
import NewTourAssistant from './NewTourAssistant';
import ProximityDetector from './ProximityDetector';
import { Landmark } from '@/data/landmarks';
import { User } from '@supabase/supabase-js';

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
  onSignOut: () => void;
  onAuthDialogOpen: () => void;
  isTourPlannerOpen: boolean;
  onTourPlannerOpenChange: (open: boolean) => void;
  onGenerateTour: (destination: string) => Promise<void>;
  onTourAuthRequired: (destination: string) => void;
  isTourLoading: boolean;
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
  isVoiceSearchOpen,
  onVoiceSearchOpenChange,
  isAuthDialogOpen,
  onAuthDialogOpenChange,
  isNewTourAssistantOpen,
  onNewTourAssistantOpenChange,
  tourPlan,
}) => {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Proximity Detection - Always render when user is logged in */}
      {user && <ProximityDetector landmarks={allLandmarks} />}
      
      {/* Map */}
      <Map
        mapboxToken={mapboxToken}
        landmarks={allLandmarks}
        onSelectLandmark={onSelectLandmark}
        selectedLandmark={selectedLandmark}
        plannedLandmarks={plannedLandmarks}
      />

      {/* Search Control */}
      <SearchControl
        landmarks={allLandmarks}
        onSelectLandmark={onSelectLandmark}
      />

      {/* Top Controls */}
      <TopControls
        allLandmarks={allLandmarks}
        onSelectLandmark={onSelectLandmark}
        onTourPlannerOpen={onTourPlannerOpen}
        onVoiceSearchOpen={onVoiceSearchOpen}
        onVoiceAssistantOpen={onVoiceAssistantOpen}
        onLogoClick={onLogoClick}
        user={user}
        plannedLandmarks={plannedLandmarks}
      />

      {/* Tour Planner Dialog */}
      <TourPlannerDialog
        open={isTourPlannerOpen}
        onOpenChange={onTourPlannerOpenChange}
        onGenerateTour={onGenerateTour}
        onAuthRequired={onTourAuthRequired}
        isLoading={isTourLoading}
      />

      {/* Voice Search Dialog */}
      <VoiceSearchDialog
        open={isVoiceSearchOpen}
        onOpenChange={onVoiceSearchOpenChange}
      />

      {/* Auth Dialog */}
      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={onAuthDialogOpenChange}
      />

      {/* New Tour Assistant */}
      <NewTourAssistant
        open={isNewTourAssistantOpen}
        onOpenChange={onNewTourAssistantOpenChange}
        destination={tourPlan?.destination || ''}
        landmarks={plannedLandmarks}
        systemPrompt={tourPlan?.systemPrompt}
      />
    </div>
  );
};

export default MainLayout;
