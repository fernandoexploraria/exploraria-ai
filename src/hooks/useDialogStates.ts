
import { useState } from 'react';

export const useDialogStates = () => {
  const [selectedLandmark, setSelectedLandmark] = useState(null);
  const [isInteractionHistoryOpen, setIsInteractionHistoryOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isNewTourAssistantOpen, setIsNewTourAssistantOpen] = useState(false);
  const [isIntelligentTourOpen, setIsIntelligentTourOpen] = useState(false);

  return {
    selectedLandmark,
    setSelectedLandmark,
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
