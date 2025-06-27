
import React from 'react';
import TourPlannerDialog from './TourPlannerDialog';
import TourPlannerV2Dialog from './TourPlannerV2Dialog';
import InteractionCarousel from './InteractionCarousel';
import AuthDialog from './AuthDialog';
import { ProgressState } from '@/hooks/useTourPlanner';

interface DialogManagerProps {
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
  onLocationSelect?: (coordinates: [number, number]) => void;
}

const DialogManager: React.FC<DialogManagerProps> = ({
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
  onLocationSelect,
}) => {
  return (
    <>
      <TourPlannerDialog
        open={isTourPlannerOpen}
        onOpenChange={onTourPlannerOpenChange}
        onGenerateTour={onGenerateTour}
        onAuthRequired={onTourAuthRequired}
        isLoading={isTourLoading}
        progressState={tourProgressState}
      />

      <TourPlannerV2Dialog
        open={isTourPlannerV2Open}
        onOpenChange={onTourPlannerV2OpenChange}
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
    </>
  );
};

export default DialogManager;
