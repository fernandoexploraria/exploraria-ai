
import React from 'react';
import VoiceSearchDialog from './VoiceSearchDialog';
import InteractionCarousel from './InteractionCarousel';
import FavoritesDialog from './FavoritesDialog';

interface DialogManagerProps {
  searchDialogOpen: boolean;
  setSearchDialogOpen: (open: boolean) => void;
  voiceSearchDialogOpen: boolean;
  setVoiceSearchDialogOpen: (open: boolean) => void;
  interactionCarouselOpen: boolean;
  setInteractionCarouselOpen: (open: boolean) => void;
  favoritesDialogOpen: boolean;
  setFavoritesDialogOpen: (open: boolean) => void;
  onLocationSelect?: (coordinates: [number, number], interaction: any) => void;
}

const DialogManager: React.FC<DialogManagerProps> = ({
  searchDialogOpen,
  setSearchDialogOpen,
  voiceSearchDialogOpen,
  setVoiceSearchDialogOpen,
  interactionCarouselOpen,
  setInteractionCarouselOpen,
  favoritesDialogOpen,
  setFavoritesDialogOpen,
  onLocationSelect,
}) => {
  return (
    <>
      <VoiceSearchDialog
        open={voiceSearchDialogOpen}
        onOpenChange={setVoiceSearchDialogOpen}
      />

      <InteractionCarousel
        open={interactionCarouselOpen}
        onOpenChange={setInteractionCarouselOpen}
        onLocationSelect={onLocationSelect}
      />

      <FavoritesDialog
        open={favoritesDialogOpen}
        onOpenChange={setFavoritesDialogOpen}
      />
    </>
  );
};

export default DialogManager;
