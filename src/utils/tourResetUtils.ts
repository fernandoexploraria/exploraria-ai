
import { clearTourMarkers } from '@/data/tourLandmarks';

// Interface for dialog states that need resetting
export interface DialogStates {
  setIsIntelligentTourOpen: (open: boolean) => void;
  setIsNewTourAssistantOpen: (open: boolean) => void;
  setIsInteractionHistoryOpen: (open: boolean) => void;
  setSelectedLandmark: (landmark: any) => void;
}

// Interface for page-level states that need resetting
export interface PageStates {
  setSmartTourLandmarks: (landmarks: any[]) => void;
  setVoiceTourData: (data: any) => void;
}

// Interface for tour planner states that need resetting
export interface TourPlannerStates {
  setTourPlan?: (plan: any) => void;
  setError?: (error: string | null) => void;
  setProgressState?: (state: any) => void;
}

// Comprehensive reset function for tour generation
export const performComprehensiveTourReset = (
  dialogStates: DialogStates,
  pageStates: PageStates,
  tourPlannerStates?: TourPlannerStates
) => {
  console.log('🧹 Starting comprehensive tour reset...');
  
  // Phase 1: Clear core data structures
  console.log('🧹 Phase 1: Clearing core data structures');
  clearTourMarkers();
  
  // Phase 2: Reset page-level states
  console.log('🧹 Phase 2: Resetting page-level states');
  pageStates.setSmartTourLandmarks([]);
  pageStates.setVoiceTourData(null);
  
  // Phase 3: Reset dialog states
  console.log('🧹 Phase 3: Resetting dialog states');
  dialogStates.setSelectedLandmark(null);
  dialogStates.setIsNewTourAssistantOpen(false);
  dialogStates.setIsInteractionHistoryOpen(false);
  // Note: We don't close intelligent tour dialog here as it's being opened
  
  // Phase 4: Reset tour planner states if provided
  if (tourPlannerStates) {
    console.log('🧹 Phase 4: Resetting tour planner states');
    tourPlannerStates.setTourPlan?.(null);
    tourPlannerStates.setError?.(null);
    tourPlannerStates.setProgressState?.({
      phase: 'idle',
      percentage: 0,
      currentStep: '',
      processedLandmarks: 0,
      totalLandmarks: 0,
      errors: []
    });
  }
  
  console.log('🧹 Comprehensive tour reset completed');
};

// Reset function specifically for dialog internal states
export const resetIntelligentTourDialogState = () => {
  console.log('🔄 Resetting IntelligentTourDialog internal state');
  return {
    currentStep: 1,
    searchQuery: '',
    autocompleteResults: [],
    selectedDestination: null,
    destinationDetails: null,
    nearbyLandmarks: [],
    isLoading: false,
    autocompleteError: '',
    sessionToken: crypto.randomUUID()
  };
};

// Reset function for voice assistant states
export const resetVoiceAssistantState = () => {
  console.log('🎙️ Resetting voice assistant state');
  // This will be called when voice assistant dialog closes or resets
  return {
    elevenLabsConfig: null,
    assistantState: 'idle',
    connectionError: null
  };
};
