import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';

interface OnboardingState {
  // Tier tracking
  currentTier: number;
  completedFeatures: string[];
  dismissedHints: string[];
  
  // User behavior tracking
  tourViewCount: number;
  voiceInteractionCount: number;
  favoritesCount: number;
  searchCount: number;
  
  // Feature discovery tracking
  hasUsedMap: boolean;
  hasUsedVoice: boolean;
  hasUsedStreetView: boolean;
  hasUsedTravelLog: boolean;
  hasUsedSharing: boolean;
  
  // Session tracking
  sessionStartTime: number;
  lastActiveTime: number;
}

interface OnboardingContextType {
  state: OnboardingState;
  
  // Actions
  completeFeature: (feature: string) => void;
  dismissHint: (hintId: string) => void;
  trackAction: (action: string, data?: any) => void;
  shouldShowFeature: (featureId: string) => boolean;
  getTierProgress: () => number;
  
  // Smart triggers
  shouldShowVoiceIntro: () => boolean;
  shouldShowProximitySetup: () => boolean;
  shouldShowOfflineDownload: () => boolean;
  shouldShowTravelLogCelebration: () => boolean;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const ONBOARDING_STORAGE_KEY = 'exploraria-onboarding';

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const [state, setState] = useState<OnboardingState>(() => {
    if (typeof window === 'undefined') {
      return getDefaultState();
    }
    
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      try {
        return { ...getDefaultState(), ...JSON.parse(stored) };
      } catch {
        return getDefaultState();
      }
    }
    return getDefaultState();
  });

  function getDefaultState(): OnboardingState {
    return {
      currentTier: 1,
      completedFeatures: [],
      dismissedHints: [],
      tourViewCount: 0,
      voiceInteractionCount: 0,
      favoritesCount: 0,
      searchCount: 0,
      hasUsedMap: false,
      hasUsedVoice: false,
      hasUsedStreetView: false,
      hasUsedTravelLog: false,
      hasUsedSharing: false,
      sessionStartTime: Date.now(),
      lastActiveTime: Date.now(),
    };
  }

  // Persist state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  const completeFeature = (feature: string) => {
    setState(prev => ({
      ...prev,
      completedFeatures: [...prev.completedFeatures.filter(f => f !== feature), feature],
      lastActiveTime: Date.now(),
    }));
  };

  const dismissHint = (hintId: string) => {
    setState(prev => ({
      ...prev,
      dismissedHints: [...prev.dismissedHints, hintId],
      lastActiveTime: Date.now(),
    }));
  };

  const trackAction = (action: string, data?: any) => {
    setState(prev => {
      const updates: Partial<OnboardingState> = {
        lastActiveTime: Date.now(),
      };

      switch (action) {
        case 'tour_viewed':
          updates.tourViewCount = prev.tourViewCount + 1;
          updates.hasUsedMap = true;
          break;
        case 'voice_interaction':
          updates.voiceInteractionCount = prev.voiceInteractionCount + 1;
          updates.hasUsedVoice = true;
          break;
        case 'favorite_added':
          updates.favoritesCount = prev.favoritesCount + 1;
          break;
        case 'search_performed':
          updates.searchCount = prev.searchCount + 1;
          break;
        case 'street_view_used':
          updates.hasUsedStreetView = true;
          break;
        case 'travel_log_viewed':
          updates.hasUsedTravelLog = true;
          break;
        case 'shared_content':
          updates.hasUsedSharing = true;
          break;
      }

      return { ...prev, ...updates };
    });
  };

  const shouldShowFeature = (featureId: string): boolean => {
    return !state.dismissedHints.includes(featureId);
  };

  const getTierProgress = (): number => {
    const tier1Features = ['map_interaction', 'search_usage'];
    const tier2Features = ['photo_viewing', 'tour_details'];
    const tier3Features = ['voice_discovery', 'ai_interaction'];
    
    const completedTier1 = tier1Features.filter(f => state.completedFeatures.includes(f)).length;
    const completedTier2 = tier2Features.filter(f => state.completedFeatures.includes(f)).length;
    const completedTier3 = tier3Features.filter(f => state.completedFeatures.includes(f)).length;
    
    if (completedTier3 > 0) return 3;
    if (completedTier2 > 0) return 2;
    if (completedTier1 > 0) return 1;
    return 0;
  };

  // Smart trigger logic
  const shouldShowVoiceIntro = (): boolean => {
    return state.tourViewCount >= 3 && 
           !state.hasUsedVoice && 
           shouldShowFeature('voice_intro');
  };

  const shouldShowProximitySetup = (): boolean => {
    return state.favoritesCount >= 3 && 
           shouldShowFeature('proximity_setup');
  };

  const shouldShowOfflineDownload = (): boolean => {
    return state.tourViewCount >= 5 && 
           shouldShowFeature('offline_download');
  };

  const shouldShowTravelLogCelebration = (): boolean => {
    return state.voiceInteractionCount === 1 && 
           shouldShowFeature('travel_log_celebration');
  };

  const value: OnboardingContextType = {
    state,
    completeFeature,
    dismissHint,
    trackAction,
    shouldShowFeature,
    getTierProgress,
    shouldShowVoiceIntro,
    shouldShowProximitySetup,
    shouldShowOfflineDownload,
    shouldShowTravelLogCelebration,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};