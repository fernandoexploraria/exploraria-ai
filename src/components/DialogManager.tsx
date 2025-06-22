
import React, { useEffect } from 'react';
import TourPlannerDialog from './TourPlannerDialog';
import InteractionCarousel from './InteractionCarousel';
import AuthDialog from './AuthDialog';
import NewTourAssistant from './NewTourAssistant';
import { Landmark } from '@/data/landmarks';

interface DialogManagerProps {
  isTourPlannerOpen: boolean;
  onTourPlannerOpenChange: (open: boolean) => void;
  onGenerateTour: (destination: string) => Promise<void>;
  onTourAuthRequired: (destination: string) => void;
  isTourLoading: boolean;
  isVoiceSearchOpen: boolean;
  onVoiceSearchOpenChange: (open: boolean) => void;
  isAuthDialogOpen: boolean;
  onAuthDialogOpenChange: (open: boolean) => void;
  onLocationSelect?: (coordinates: [number, number]) => void;
  // Tour Assistant props
  isTourAssistantOpen: boolean;
  onTourAssistantOpenChange: (open: boolean) => void;
  tourDestination: string;
  tourLandmarks: Landmark[];
  tourSystemPrompt: string;
}

const DialogManager: React.FC<DialogManagerProps> = ({
  isTourPlannerOpen,
  onTourPlannerOpenChange,
  onGenerateTour,
  onTourAuthRequired,
  isTourLoading,
  isVoiceSearchOpen,
  onVoiceSearchOpenChange,
  isAuthDialogOpen,
  onAuthDialogOpenChange,
  onLocationSelect,
  isTourAssistantOpen,
  onTourAssistantOpenChange,
  tourDestination,
  tourLandmarks,
  tourSystemPrompt
}) => {
  // Auto-open tour assistant when a new tour is generated
  useEffect(() => {
    if (tourLandmarks.length > 0 && tourDestination && !isTourAssistantOpen) {
      // Small delay to allow tour planner to close first
      setTimeout(() => {
        onTourAssistantOpenChange(true);
      }, 500);
    }
  }, [tourLandmarks.length, tourDestination, isTourAssistantOpen, onTourAssistantOpenChange]);

  return (
    <>
      <TourPlannerDialog
        open={isTourPlannerOpen}
        onOpenChange={onTourPlannerOpenChange}
        onGenerateTour={onGenerateTour}
        onAuthRequired={onTourAuthRequired}
        isLoading={isTourLoading}
      />

      <InteractionCarousel
        open={isVoiceSearchOpen}
        onOpenChange={onVoiceSearchOpenChange}
        onLocationSelect={onLocationSelect}
      />

      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={onAuthDialogOpenChange}
      />

      <NewTourAssistant
        open={isTourAssistantOpen}
        onOpenChange={onTourAssistantOpenChange}
        destination={tourDestination}
        landmarks={tourLandmarks}
        systemPrompt={tourSystemPrompt}
      />
    </>
  );
};

export default DialogManager;
