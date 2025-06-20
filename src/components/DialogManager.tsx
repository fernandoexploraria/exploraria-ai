
import React from 'react';
import TourPlannerDialog from './TourPlannerDialog';
import VoiceSearchDialog from './VoiceSearchDialog';
import FavoritesDialog from './FavoritesDialog';
import AuthDialog from './AuthDialog';
import { Landmark } from '@/data/landmarks';

interface DialogManagerProps {
  isTourPlannerOpen: boolean;
  onTourPlannerOpenChange: (open: boolean) => void;
  onGenerateTour: (destination: string) => Promise<void>;
  onTourAuthRequired: (destination: string) => void;
  isTourLoading: boolean;
  isVoiceSearchOpen: boolean;
  onVoiceSearchOpenChange: (open: boolean) => void;
  isFavoritesOpen: boolean;
  onFavoritesOpenChange: (open: boolean) => void;
  isAuthDialogOpen: boolean;
  onAuthDialogOpenChange: (open: boolean) => void;
}

const DialogManager: React.FC<DialogManagerProps> = ({
  isTourPlannerOpen,
  onTourPlannerOpenChange,
  onGenerateTour,
  onTourAuthRequired,
  isTourLoading,
  isVoiceSearchOpen,
  onVoiceSearchOpenChange,
  isFavoritesOpen,
  onFavoritesOpenChange,
  isAuthDialogOpen,
  onAuthDialogOpenChange,
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
