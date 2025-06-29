
import React from 'react';
import TourPlannerDialog from '@/components/TourPlannerDialog';
import VoiceSearchDialog from '@/components/VoiceSearchDialog';
import AuthDialog from '@/components/AuthDialog';
import IntelligentTourDialog from '@/components/IntelligentTourDialog';
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
  onLocationSelect: () => void;
  isIntelligentTourOpen: boolean;
  onIntelligentTourOpenChange: (open: boolean) => void;
  onTourGenerated?: (landmarks: any[]) => void;
  onAuthRequired: () => void;
  onTourReadyForVoice?: (tourData: { destination: string; systemPrompt: string; landmarks: any[] }) => void;
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
  onAuthRequired,
  onTourReadyForVoice,
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

      <VoiceSearchDialog
        open={isVoiceSearchOpen}
        onOpenChange={onVoiceSearchOpenChange}
      />

      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={onAuthDialogOpenChange}
      />

      <IntelligentTourDialog
        open={isIntelligentTourOpen}
        onOpenChange={onIntelligentTourOpenChange}
        onTourGenerated={onTourGenerated || (() => {})}
        onAuthRequired={onAuthRequired}
        onTourReadyForVoice={onTourReadyForVoice}
      />
    </>
  );
};

export default DialogManager;
