
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
import ProximitySystem from './ProximitySystem';
import { useDialogStates } from '@/hooks/useDialogStates';
import { usePendingDestination } from '@/hooks/usePendingDestination';

const MainLayout: React.FC = () => {
  const { user } = useAuth();
  const [selectedCoordinates, setSelectedCoordinates] = useState<[number, number] | null>(null);
  
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
    setCameraOpen
  } = useDialogStates();

  const { pendingDestination, setPendingDestination } = usePendingDestination();

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

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Map Layer */}
      <Map 
        selectedCoordinates={selectedCoordinates}
        onLocationSelect={handleLocationSelect}
      />
      
      {/* Top Controls */}
      <TopControls onDestinationSelect={handleDestinationSelect} />
      
      {/* User Controls */}
      <UserControls
        onTourPlannerClick={() => setTourPlannerOpen(true)}
        onVoiceSearchClick={() => setVoiceSearchOpen(true)}
        onImageViewerClick={() => setImageViewerOpen(true)}
        onCameraClick={() => setCameraOpen(true)}
        onInteractionHistoryClick={() => setInteractionCarouselOpen(true)}
      />

      {/* Proximity System */}
      {user && <ProximitySystem />}
      
      {/* Dialogs */}
      <TourPlannerDialog
        open={tourPlannerOpen}
        onOpenChange={setTourPlannerOpen}
        pendingDestination={pendingDestination}
        onDestinationClear={() => setPendingDestination(null)}
      />
      
      <VoiceSearchDialog
        open={voiceSearchOpen}
        onOpenChange={setVoiceSearchOpen}
        onLocationSelect={handleLocationSelect}
      />
      
      <ImageViewerDialog
        open={imageViewerOpen}
        onOpenChange={setImageViewerOpen}
        onLocationSelect={handleLocationSelect}
      />

      <CameraCapture
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onLocationSelect={handleLocationSelect}
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
