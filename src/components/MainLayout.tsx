
import React from 'react';
import Map from '@/components/Map';
import TopControls from '@/components/TopControls';
import UserControls from '@/components/UserControls';
import DialogManager from '@/components/DialogManager';
import NewTourAssistant from '@/components/NewTourAssistant';
import ProximityFloatingCard from '@/components/ProximityFloatingCard';
import ProximitySearch from '@/components/ProximitySearch';
import { Landmark } from '@/data/landmarks';
import { User } from '@supabase/supabase-js';

interface ProximityEventHandlers {
  onFloatingCardTrigger?: (landmark: Landmark, distance: number) => void;
  onRouteVisualizationTrigger?: (landmark: Landmark, distance: number) => void;
}

interface ProximityNotification {
  id: string;
  landmark: Landmark;
  distance: number;
  notificationType: 'floating-card' | 'route-visual' | 'audio' | 'toast';
  timestamp: number;
}

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
  isVoiceSearchOpen: boolean;
  onVoiceSearchOpenChange: (open: boolean) => void;
  isAuthDialogOpen: boolean;
  onAuthDialogOpenChange: (open: boolean) => void;
  isNewTourAssistantOpen: boolean;
  onNewTourAssistantOpenChange: (open: boolean) => void;
  tourPlan: any;
  proximityEventHandlers?: ProximityEventHandlers;
  activeProximityNotification?: ProximityNotification | null;
  onHideFloatingCard?: () => void;
  onShowSearchNearby?: (landmark: Landmark, coordinates: [number, number]) => void;
  isSearchNearbyOpen?: boolean;
  searchNearbyLandmark?: Landmark | null;
  searchNearbyCoordinates?: [number, number] | null;
  onHideSearchNearby?: () => void;
  userLocation?: [number, number] | null;
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
  proximityEventHandlers,
  activeProximityNotification,
  onHideFloatingCard,
  onShowSearchNearby,
  isSearchNearbyOpen = false,
  searchNearbyLandmark,
  searchNearbyCoordinates,
  onHideSearchNearby,
  userLocation = null,
}) => {
  const handleLocationSelect = () => {
    console.log('Location select called but no action taken');
  };

  const handlePlaceSelect = (place: any) => {
    console.log('Selected place for directions:', place);
    // TODO: Implement directions to selected place
  };

  const handleGetDirections = () => {
    console.log('Get directions clicked');
    // TODO: Implement directions functionality
  };

  const handleShowNearby = () => {
    if (activeProximityNotification && onShowSearchNearby) {
      onShowSearchNearby(
        activeProximityNotification.landmark,
        activeProximityNotification.landmark.coordinates
      );
    }
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

      {/* Proximity Floating Card */}
      {activeProximityNotification && activeProximityNotification.notificationType === 'floating-card' && (
        <ProximityFloatingCard
          landmark={activeProximityNotification.landmark}
          distance={activeProximityNotification.distance}
          onClose={onHideFloatingCard || (() => {})}
          onGetDirections={handleGetDirections}
          onShowNearby={handleShowNearby}
          userLocation={userLocation}
        />
      )}

      {/* Proximity Search */}
      {isSearchNearbyOpen && searchNearbyCoordinates && (
        <ProximitySearch
          coordinates={searchNearbyCoordinates}
          onClose={onHideSearchNearby || (() => {})}
          onSelectPlace={handlePlaceSelect}
        />
      )}
    </div>
  );
};

export default MainLayout;
