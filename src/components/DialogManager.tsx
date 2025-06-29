
import React from 'react';
import VoiceSearchDialog from '@/components/VoiceSearchDialog';
import AuthDialog from '@/components/AuthDialog';
import IntelligentTourDialog from '@/components/IntelligentTourDialog';

interface DialogManagerProps {
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
