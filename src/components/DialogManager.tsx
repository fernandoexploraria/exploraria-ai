
import React from 'react';
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
  isTourAssistantOpen?: boolean;
  onTourAssistantOpenChange?: (open: boolean) => void;
  tourDestination?: string;
  tourLandmarks?: Landmark[];
  tourSystemPrompt?: string;
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
  isTourAssistantOpen = false,
  onTourAssistantOpenChange = () => {},
  tourDestination = '',
  tourLandmarks = [],
  tourSystemPrompt = ''
}) => {
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

      {tourLandmarks.length > 0 && (
        <NewTourAssistant
          open={isTourAssistantOpen}
          onOpenChange={onTourAssistantOpenChange}
          destination={tourDestination}
          landmarks={tourLandmarks}
          systemPrompt={tourSystemPrompt}
        />
      )}
    </>
  );
};

export default DialogManager;
