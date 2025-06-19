
import React from 'react';
import TourPlannerDialog from './TourPlannerDialog';
import VoiceAssistant from './VoiceAssistant';
import VoiceSearchDialog from './VoiceSearchDialog';
import FavoritesDialog from './FavoritesDialog';
import AuthDialog from './AuthDialog';
import { Landmark } from '@/data/landmarks';

interface DialogManagerProps {
  isTourPlannerOpen: boolean;
  onTourPlannerOpenChange: (open: boolean) => void;
  onGenerateTour: (destination: string) => void;
  onTourAuthRequired: (destination: string) => void;
  isTourLoading: boolean;
  isVoiceAssistantOpen: boolean;
  onVoiceAssistantOpenChange: (open: boolean) => void;
  currentDestination: string;
  plannedLandmarks: Landmark[];
  perplexityApiKey: string;
  elevenLabsApiKey: string;
  isVoiceSearchOpen: boolean;
  onVoiceSearchOpenChange: (open: boolean) => void;
  isFavoritesOpen: boolean;
  onFavoritesOpenChange: (open: boolean) => void;
  isAuthDialogOpen: boolean;
  onAuthDialogOpenChange: (open: boolean) => void;
  onAddLandmarks?: (newLandmarks: Landmark[]) => void;
}

const DialogManager: React.FC<DialogManagerProps> = ({
  isTourPlannerOpen,
  onTourPlannerOpenChange,
  onGenerateTour,
  onTourAuthRequired,
  isTourLoading,
  isVoiceAssistantOpen,
  onVoiceAssistantOpenChange,
  currentDestination,
  plannedLandmarks,
  perplexityApiKey,
  elevenLabsApiKey,
  isVoiceSearchOpen,
  onVoiceSearchOpenChange,
  isFavoritesOpen,
  onFavoritesOpenChange,
  isAuthDialogOpen,
  onAuthDialogOpenChange,
  onAddLandmarks
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

      <VoiceAssistant
        open={isVoiceAssistantOpen}
        onOpenChange={onVoiceAssistantOpenChange}
        destination={currentDestination}
        landmarks={plannedLandmarks}
        perplexityApiKey={perplexityApiKey}
        elevenLabsApiKey={elevenLabsApiKey}
        onAddLandmarks={onAddLandmarks}
      />

      <VoiceSearchDialog
        open={isVoiceSearchOpen}
        onOpenChange={onVoiceSearchOpenChange}
      />

      <FavoritesDialog
        open={isFavoritesOpen}
        onOpenChange={onFavoritesOpenChange}
      />

      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={onAuthDialogOpenChange}
      />
    </>
  );
};

export default DialogManager;
