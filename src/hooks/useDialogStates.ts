
import { useState } from 'react';

export const useDialogStates = () => {
  const [selectedLandmark, setSelectedLandmark] = useState(null);
  const [isTourPlannerOpen, setIsTourPlannerOpen] = useState(false);
  const [isInteractionHistoryOpen, setIsInteractionHistoryOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isNewTourAssistantOpen, setIsNewTourAssistantOpen] = useState(false);
  const [isIntelligentTourOpen, setIsIntelligentTourOpen] = useState(false);

  return {
    selectedLandmark,
    setSelectedLandmark,
    isTourPlannerOpen,
    setIsTourPlannerOpen,
    isInteractionHistoryOpen,
    setIsInteractionHistoryOpen,
    isAuthDialogOpen,
    setIsAuthDialogOpen,
    isNewTourAssistantOpen,
    setIsNewTourAssistantOpen,
    isIntelligentTourOpen,
    setIsIntelligentTourOpen,
  };
};
