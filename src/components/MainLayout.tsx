
import React, { useState, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import Map from './Map';
import UserControls from './UserControls';
import TopControls from './TopControls';
import InteractionCarousel from './InteractionCarousel';
import TourPlannerDialog from './TourPlannerDialog';
import VoiceSearchDialog from './VoiceSearchDialog';
import ImageViewerDialog from './ImageViewerDialog';
import CameraCapture from './CameraCapture';
import AuthDialog from './AuthDialog';
import ProximitySystem from './ProximitySystem';
import { useDialogStates } from '@/hooks/useDialogStates';
import { usePendingDestination } from '@/hooks/usePendingDestination';
import { landmarks } from '@/data/landmarks';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useTourPlanner } from '@/hooks/useTourPlanner';

const MainLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const mapboxToken = useMapboxToken();
  const [selectedCoordinates, setSelectedCoordinates] = useState<[number, number] | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<any>(null);
  
  const {
    tourPlannerOpen,
    setTourPlannerOpen,
    voiceSearchOpen,
    setVoiceSearchOpen,
    imageViewerOpen,
    setImageViewerOpen,
    interactionCarouselOpen,
    setInteractionCarouselOpen,
    cameraOpen,
    setCameraOpen,
    authDialogOpen,
    setAuthDialogOpen
  } = useDialogStates();

  const { pendingDestination, setPendingDestination } = usePendingDestination();
  const { tourPlan, plannedLandmarks, isLoading: isTourLoading, generateTour } = useTourPlanner();

  const allLandmarks = [...landmarks, ...plannedLandmarks];

  const handleLocationSelect = useCallback((coordinates: [number, number]) => {
    console.log('Location selected:', coordinates);
    setSelectedCoordinates(coordinates);
  }, []);

  const handleDestinationSelect = useCallback((destination: string, coordinates?: [number, number]) => {
    console.log('Destination selected:', destination, coordinates);
    if (coordinates) {
      setSelectedCoordinates(coordinates);
    }
    setPendingDestination(destination);
    setTourPlannerOpen(true);
  }, [setPendingDestination, setTourPlannerOpen]);

  const handleSelectLandmark = useCallback((landmark: any) => {
    setSelectedLandmark(landmark);
  }, []);

  const handleGenerateTour = async (destination: string) => {
    await generateTour(destination);
  };

  const handleTourAuthRequired = (destination: string) => {
    setPendingDestination(destination);
    setTourPlannerOpen(false);
    setAuthDialogOpen(true);
  };

  const handleAuthDialogOpen = () => {
    setAuthDialogOpen(true);
  };

  const handleCameraCapture = (imageData: string) => {
    console.log('Camera captured:', imageData);
  };

  if (!mapboxToken) {
    return <div className="w-screen h-screen flex items-center justify-center">Loading map...</div>;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Map Layer */}
      <Map 
        mapboxToken={mapboxToken}
        landmarks={allLandmarks}
        onSelectLandmark={handleSelectLandmark}
        selectedLandmark={selectedLandmark}
        plannedLandmarks={plannedLandmarks}
      />
      
      {/* Top Controls */}
      <TopControls 
        allLandmarks={allLandmarks}
        onSelectLandmark={handleSelectLandmark}
        onTourPlannerOpen={() => setTourPlannerOpen(true)}
        onVoiceSearchOpen={() => setVoiceSearchOpen(true)}
        onTravelLogOpen={() => setInteractionCarouselOpen(true)}
        onVoiceAssistantOpen={() => {}} // Placeholder
        onLogoClick={() => {}} // Placeholder
        user={user}
        plannedLandmarks={plannedLandmarks}
      />
      
      {/* User Controls */}
      <UserControls 
        user={user}
        onSignOut={signOut}
        onAuthDialogOpen={handleAuthDialogOpen}
      />

      {/* Proximity System */}
      {user && <ProximitySystem />}
      
      {/* Dialogs */}
      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
      />
      
      <TourPlannerDialog
        open={tourPlannerOpen}
        onOpenChange={setTourPlannerOpen}
        onGenerateTour={handleGenerateTour}
        onAuthRequired={handleTourAuthRequired}
        isLoading={isTourLoading}
      />
      
      <VoiceSearchDialog
        open={voiceSearchOpen}
        onOpenChange={setVoiceSearchOpen}
      />
      
      <ImageViewerDialog
        open={imageViewerOpen}
        onOpenChange={setImageViewerOpen}
        imageUrl=""
        imageName=""
      />

      <CameraCapture
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
      
      <InteractionCarousel
        open={interactionCarouselOpen}
        onOpenChange={setInteractionCarouselOpen}
        onLocationSelect={handleLocationSelect}
      />
    </div>
  );
};

export default MainLayout;
