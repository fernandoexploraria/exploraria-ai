import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { useMap } from '@/contexts/MapContext';
import { useTour } from '@/contexts/TourContext';
import { useTTS } from '@/contexts/TTSContext';
import { useLandmarkDialog } from '@/contexts/LandmarkDialogContext';
import { useSearch } from '@/contexts/SearchContext';
import { useDebug } from '@/contexts/DebugContext';
import { useSmartTour } from '@/hooks/useSmartTour';
import { useStreetViewNavigation } from '@/hooks/useStreetViewNavigation';
import { useLocationUpdates } from '@/hooks/useLocationUpdates';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import { useTourPlanner } from '@/hooks/useTourPlanner';
import { SplashScreen } from '@/components/SplashScreen';
import { MainLayout } from '@/components/MainLayout';
import { AuthDialog } from '@/components/AuthDialog';
import { LandmarkDialog } from '@/components/LandmarkDialog';
import { SearchDialog } from '@/components/SearchDialog';
import { DebugWindow } from '@/components/DebugWindow';
import { TourPlannerDialog } from '@/components/TourPlannerDialog';
import { VoiceSearchDialog } from '@/components/VoiceSearchDialog';
import { Landmark } from '@/data/landmarks';
import GoogleStreetViewTestButton from "@/components/GoogleStreetViewTestButton";

interface IndexProps {
  onRegisterPostAuthActions: React.Dispatch<React.SetStateAction<{
    onSmartTour?: () => void;
  }>>;
}

const Index = ({ onRegisterPostAuthActions }: IndexProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDialogsOpen, setIsDialogsOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isTourPlannerOpen, setIsTourPlannerOpen] = useState(false);
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = useState(false);
  const { user } = useAuth();
  const { flyTo } = useMap();
  const { startSmartTour } = useSmartTour();
  const { openStreetViewModal } = useStreetViewNavigation();
  const { setLandmarkDialog } = useLandmarkDialog();
  const { setSearchQuery } = useSearch();
  const { speak } = useTTS();
  const { initializeTour } = useTour();
  const { setDebugState } = useDebug();
  const { initializeTourPlanner } = useTourPlanner();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Post-authentication action registration
  useEffect(() => {
    onRegisterPostAuthActions({
      onSmartTour: handleSmartTour
    });
  }, [onRegisterPostAuthActions]);

  // Location updates and proximity alerts (example usage)
  useLocationUpdates();
  useProximityAlerts();

  // Voice search hook
  const {
    startListening: startVoiceSearch,
    stopListening: stopVoiceSearch,
    transcript: voiceTranscript,
    resetTranscript: resetVoiceTranscript,
    isListening: isVoiceSearchListening,
    error: voiceSearchError
  } = useVoiceSearch();

  // Handle voice search results
  useEffect(() => {
    if (voiceTranscript) {
      setSearchQuery(voiceTranscript);
      setIsSearchOpen(true);
      resetVoiceTranscript();
    }
  }, [voiceTranscript, setSearchQuery, resetVoiceTranscript]);

  // Smart Tour handler
  const handleSmartTour = useCallback(async () => {
    console.log('✨ Starting smart tour...');
    await startSmartTour();
  }, [startSmartTour]);

  // Voice Search handlers
  const handleVoiceSearchOpen = useCallback(() => {
    console.log('🎤 Opening voice search dialog...');
    setIsVoiceSearchOpen(true);
    startVoiceSearch();
  }, [startVoiceSearch]);

  const handleVoiceSearchClose = useCallback(() => {
    console.log('🎤 Closing voice search dialog...');
    setIsVoiceSearchOpen(false);
    stopVoiceSearch();
    resetVoiceTranscript();
  }, [stopVoiceSearch, resetVoiceTranscript]);

  // Deep link handling
  useEffect(() => {
    const landmarkId = searchParams.get('landmark');
    const tourId = searchParams.get('tour');
    const debugState = searchParams.get('debug');
    const tourPlannerState = searchParams.get('tourPlanner');

    // Landmark deep link
    if (landmarkId) {
      console.log(`🔗 Deep link: landmark=${landmarkId}`);
      const parsedId = parseInt(landmarkId, 10);
      if (!isNaN(parsedId)) {
        setLandmarkDialog({
          isOpen: true,
          landmarkId: parsedId
        });
        navigate({ search: '' }, { replace: true }); // Clear params
      }
    }

    // Tour deep link
    if (tourId) {
      console.log(`🔗 Deep link: tour=${tourId}`);
      initializeTour(tourId);
      navigate({ search: '' }, { replace: true }); // Clear params
    }

    // Debug state deep link
    if (debugState) {
      console.log(`🔗 Deep link: debug=${debugState}`);
      try {
        const decodedState = JSON.parse(decodeURIComponent(debugState));
        setDebugState(decodedState);
        setIsDebugOpen(true);
      } catch (error) {
        console.error('❌ Error parsing debug state from deep link:', error);
      }
      navigate({ search: '' }, { replace: true }); // Clear params
    }

    // Tour planner state deep link
    if (tourPlannerState) {
      console.log(`🔗 Deep link: tourPlanner=${tourPlannerState}`);
      try {
        const decodedState = JSON.parse(decodeURIComponent(tourPlannerState));
        initializeTourPlanner(decodedState);
        setIsTourPlannerOpen(true);
      } catch (error) {
        console.error('❌ Error parsing tour planner state from deep link:', error);
      }
      navigate({ search: '' }, { replace: true }); // Clear params
    }

  }, [
    searchParams, 
    setLandmarkDialog, 
    navigate, 
    initializeTour, 
    setDebugState, 
    initializeTourPlanner
  ]);

  // Initial data loading and setup
  useEffect(() => {
    const loadData = async () => {
      console.log('⏳ Loading initial data...');
      // Simulate data loading delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsLoading(false);
      console.log('✅ Initial data loaded');
    };

    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50">
      {isLoading && <SplashScreen />}

      <AuthDialog />
      <LandmarkDialog />
      <SearchDialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <DebugWindow isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} />
      <TourPlannerDialog isOpen={isTourPlannerOpen} onClose={() => setIsTourPlannerOpen(false)} />
      <VoiceSearchDialog
        isOpen={isVoiceSearchOpen}
        onClose={handleVoiceSearchClose}
        transcript={voiceTranscript}
        isListening={isVoiceSearchListening}
        error={voiceSearchError}
      />
      
      {!isLoading && (
        <>
          <MainLayout
            onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
            onToggleDialogs={() => setIsDialogsOpen(!isDialogsOpen)}
            onToggleDebug={() => setIsDebugOpen(!isDebugOpen)}
            onOpenTourPlanner={() => setIsTourPlannerOpen(true)}
            onOpenVoiceSearch={handleVoiceSearchOpen}
            onSmartTour={handleSmartTour}
          />

          {/* Map component */}
          <div id="map" className="absolute inset-0 z-0"></div>
        </>
      )}

      {/* Add Google Street View Test Button - only show when not loading */}
      {!isLoading && <GoogleStreetViewTestButton />}

      <div aria-live="polite" aria-atomic="true"></div>
    </div>
  );
};

export default Index;
