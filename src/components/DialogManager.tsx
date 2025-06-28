import React from 'react';
import TourPlannerDialog from './TourPlannerDialog';
import InteractionCarousel from './InteractionCarousel';
import AuthDialog from './AuthDialog';
import IntelligentTourDialog from './IntelligentTourDialog';
import { ProgressState } from '@/hooks/useTourPlanner';

interface DialogManagerProps {
  isTourPlannerOpen: boolean;
  onTourPlannerOpenChange: (open: boolean) => void;
  onGenerateTour: (destination: string) => Promise<void>;
  onTourAuthRequired: (destination: string) => void;
  isTourLoading: boolean;
  tourProgressState?: ProgressState;
  isVoiceSearchOpen: boolean;
  onVoiceSearchOpenChange: (open: boolean) => void;
  isAuthDialogOpen: boolean;
  onAuthDialogOpenChange: (open: boolean) => void;
  onLocationSelect?: (coordinates: [number, number]) => void;
  isIntelligentTourOpen: boolean;
  onIntelligentTourOpenChange: (open: boolean) => void;
  onTourGenerated?: (landmarks: any[]) => void;
  user?: any;
}

const DialogManager: React.FC<DialogManagerProps> = ({
  isTourPlannerOpen,
  onTourPlannerOpenChange,
  onGenerateTour,
  onTourAuthRequired,
  isTourLoading,
  tourProgressState,
  isVoiceSearchOpen,
  onVoiceSearchOpenChange,
  isAuthDialogOpen,
  onAuthDialogOpenChange,
  onLocationSelect,
  isIntelligentTourOpen,
  onIntelligentTourOpenChange,
  onTourGenerated,
  user,
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

      <InteractionCarousel
        open={isVoiceSearchOpen}
        onOpenChange={onVoiceSearchOpenChange}
        onLocationSelect={onLocationSelect}
      />

      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={onAuthDialogOpenChange}
      />

      <IntelligentTourDialog
        open={isIntelligentTourOpen}
        onOpenChange={onIntelligentTourOpenChange}
        onTourGenerated={onTourGenerated || (() => {})}
      />
    </>
  );
};

export default DialogManager;
