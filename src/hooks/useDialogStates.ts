
import { useState } from 'react';

export const useDialogStates = () => {
  const [tourPlannerOpen, setTourPlannerOpen] = useState(false);
  const [voiceSearchOpen, setVoiceSearchOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [interactionCarouselOpen, setInteractionCarouselOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedLandmark, setSelectedLandmark] = useState<any>(null);

  return {
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
    selectedLandmark,
    setSelectedLandmark
  };
};
