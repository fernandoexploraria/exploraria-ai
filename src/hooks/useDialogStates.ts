
import { useState } from 'react';

export const useDialogStates = () => {
  const [selectedLandmark, setSelectedLandmark] = useState(null);
  const [isTourPlannerOpen, setIsTourPlannerOpen] = useState(false);
  const [isTourPlannerV2Open, setIsTourPlannerV2Open] = useState(false);
  const [isInteractionHistoryOpen, setIsInteractionHistoryOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isNewTourAssistantOpen, setIsNewTourAssistantOpen] = useState(false);

  return {
    selectedLandmark,
    setSelectedLandmark,
    isTourPlannerOpen,
    setIsTourPlannerOpen,
    isTourPlannerV2Open,
    setIsTourPlannerV2Open,
    isInteractionHistoryOpen,
    setIsInteractionHistoryOpen,
    isAuthDialogOpen,
    setIsAuthDialogOpen,
    isNewTourAssistantOpen,
    setIsNewTourAssistantOpen,
  };
};
