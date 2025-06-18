
import React from 'react';
import TourPlannerDialog from '@/components/TourPlannerDialog';
import VoiceAssistant from '@/components/VoiceAssistant';
import VoiceSearchDialog from '@/components/VoiceSearchDialog';
import FavoritesDialog from '@/components/FavoritesDialog';
import AuthDialog from '@/components/AuthDialog';
import ImageAnalysisResult from '@/components/ImageAnalysisResult';
import { Landmark } from '@/data/landmarks';

interface DialogManagerProps {
  // Tour Planner
  isTourPlannerOpen: boolean;
  onTourPlannerOpenChange: (open: boolean) => void;
  onGenerateTour: (destination: string) => Promise<void>;
  onTourAuthRequired: () => void;
  isTourLoading: boolean;
  
  // Voice Assistant
  isVoiceAssistantOpen: boolean;
  onVoiceAssistantOpenChange: (open: boolean) => void;
  currentDestination: string;
  plannedLandmarks: Landmark[];
  perplexityApiKey: string;
  elevenLabsApiKey: string;
  
  // Voice Search
  isVoiceSearchOpen: boolean;
  onVoiceSearchOpenChange: (open: boolean) => void;
  
  // Favorites
  isFavoritesOpen: boolean;
  onFavoritesOpenChange: (open: boolean) => void;
  
  // Auth
  isAuthDialogOpen: boolean;
  onAuthDialogOpenChange: (open: boolean) => void;
  
  // Image Analysis
  isAnalysisResultOpen: boolean;
  onAnalysisResultOpenChange: (open: boolean) => void;
  analysisResult: {
    imageData: string;
    analysis: string;
    landmarkName: string;
  } | null;
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
  isAnalysisResultOpen,
  onAnalysisResultOpenChange,
  analysisResult
}) => {
  return (
    <>
      <ImageAnalysisResult
        open={isAnalysisResultOpen}
        onOpenChange={onAnalysisResultOpenChange}
        imageData={analysisResult?.imageData || null}
        analysis={analysisResult?.analysis || null}
        landmarkName={analysisResult?.landmarkName}
      />

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
