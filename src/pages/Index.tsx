import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SplashScreen from '@/components/SplashScreen';
import MainLayout from '@/components/MainLayout';
import DebugWindow from '@/components/DebugWindow';
import { landmarks as staticLandmarks, Landmark } from '@/data/landmarks';
import { useAuth } from '@/components/AuthProvider';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { PaymentDialog } from '@/components/payment/PaymentDialog';
import { Experience } from '@/hooks/useExperiences';
import { useDialogStates } from '@/hooks/useDialogStates';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';
import { useDebugWindow } from '@/hooks/useDebugWindow';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { useSplashControl } from '@/hooks/useSplashControl';
import { performComprehensiveTourReset } from '@/utils/tourResetUtils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface IndexProps {
  onRegisterPostAuthActions?: (actions: { onSmartTour?: () => void; onIntelligentTour?: () => void }) => void;
  onVoiceAgentStateChange?: (isActive: boolean) => void;
}

const Index: React.FC<IndexProps> = ({ onRegisterPostAuthActions, onVoiceAgentStateChange }) => {
  const { showSplash, dismissSplash, showSplashManually } = useSplashControl();
  const [smartTourLandmarks, setSmartTourLandmarks] = useState<Landmark[]>([]);
  const [voiceTourData, setVoiceTourData] = useState<{
    destination: string;
    systemPrompt: string;
    landmarks: any[];
    agentId?: string;
  } | null>(null);
  const [tourKey, setTourKey] = useState<string>('initial');
  
  // Payment dialog state for experiences
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { user, signOut } = useAuth();
  const mapboxToken = useMapboxToken();
  const { isVisible: isDebugVisible, toggle: toggleDebug } = useDebugWindow();
  
  const {
    selectedLandmark,
    setSelectedLandmark,
    isInteractionHistoryOpen,
    setIsInteractionHistoryOpen,
    isAuthDialogOpen,
    setIsAuthDialogOpen,
    isNewTourAssistantOpen,
    setIsNewTourAssistantOpen,
    isIntelligentTourOpen,
    setIsIntelligentTourOpen,
    resetAllDialogStates,
  } = useDialogStates();

  // Initialize proximity notifications
  useProximityNotifications();
  
  // Initialize connection monitoring
  useConnectionMonitor();

  // Register post-auth actions with App component
  useEffect(() => {
    if (onRegisterPostAuthActions) {
      onRegisterPostAuthActions({
        onSmartTour: () => {
          console.log('🎯 Executing post-auth smart tour action');
          // Check if this is an experience payment flow
          const pendingPayment = (window as any).pendingExperiencePayment;
          if (pendingPayment) {
            console.log('🎯 Post-auth experience payment flow detected');
            // This will trigger the payment dialog for the experience
            setClientSecret(pendingPayment.clientSecret);
            setSelectedExperience(pendingPayment.experience);
            setIsPaymentDialogOpen(true);
            // Clear the pending payment
            delete (window as any).pendingExperiencePayment;
          } else {
            // Regular smart tour flow
            handleIntelligentTourOpen();
          }
        },
        onIntelligentTour: () => {
          console.log('🎯 Executing post-auth intelligent tour action');
          handleIntelligentTourOpen();
        }
      });
    }
  }, [onRegisterPostAuthActions]);
  
  // Combine static landmarks with smart tour landmarks
  const allLandmarks: Landmark[] = useMemo(() => {
    return [...staticLandmarks, ...smartTourLandmarks];
  }, [smartTourLandmarks]);

  const handleSelectLandmark = useCallback((landmark: Landmark) => {
    setSelectedLandmark(landmark);
  }, [setSelectedLandmark]);

  const handleAuthDialogClose = (open: boolean) => {
    setIsAuthDialogOpen(open);
  };

  const handleVoiceAssistantOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsNewTourAssistantOpen(true);
  };

  const handleInteractionHistoryOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsInteractionHistoryOpen(true);
  };

  // Simplified logo click - just shows splash screen
  const handleLogoClick = () => {
    console.log('🎬 Logo clicked - showing splash screen');
    showSplashManually();
  };

  const handleNewTourAssistantOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsNewTourAssistantOpen(true);
  };

  const handleTourGenerated = (landmarks: any[], clearTransitRoute?: () => void) => {
    console.log('🗺️ Tour generated with landmarks:', landmarks.length);
    // Clear previous smart tour landmarks before setting new ones
    setSmartTourLandmarks([]);
    // Clear any existing transit route when a new tour is generated
    if (clearTransitRoute) {
      clearTransitRoute();
    }
    // Wait a moment then set new landmarks
    setTimeout(() => {
      setSmartTourLandmarks(landmarks);
      console.log('🗺️ Smart tour landmarks updated:', landmarks.length);
    }, 100);
    // Close the intelligent tour dialog
    setIsIntelligentTourOpen(false);
  };

  // Enhanced handler for Intelligent Tour with comprehensive reset
  const handleIntelligentTourOpen = () => {
    console.log('🎯 Opening Intelligent Tour dialog - performing comprehensive reset');
    
    // Perform comprehensive reset before opening dialog
    performComprehensiveTourReset(
      {
        setIsIntelligentTourOpen,
        setIsNewTourAssistantOpen,
        setIsInteractionHistoryOpen,
        setSelectedLandmark,
      },
      {
        setSmartTourLandmarks,
        setVoiceTourData,
      }
    );
    
    // Wait for cleanup to complete before opening dialog
    setTimeout(() => {
      setIsIntelligentTourOpen(true);
    }, 200);
  };

  // Handler for auth required from IntelligentTourDialog
  const handleIntelligentTourAuthRequired = () => {
    setIsAuthDialogOpen(true);
  };

  // Enhanced handler for when tour is ready for voice agent
  const handleTourReadyForVoice = (tourData: { destination: string; systemPrompt: string; landmarks: any[]; agentId?: string }) => {
    console.log('🎙️ Tour ready for voice agent:', tourData.destination);
    console.log('🎙️ Previous voice tour data:', voiceTourData?.destination || 'none');
    
    // Clear any existing voice tour data first
    setVoiceTourData(null);
    
    // Generate new unique key to force NewTourAssistant remount
    const newTourKey = `tour-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setTourKey(newTourKey);
    console.log('🔄 Generated new tour key for fresh dialog instance:', newTourKey);
    
    // Set the new tour data after a brief delay to ensure cleanup
    setTimeout(() => {
      console.log('🎙️ Setting new voice tour data:', tourData.destination);
      setVoiceTourData(tourData);
      
      // Close the intelligent tour dialog
      setIsIntelligentTourOpen(false);
      
      // Open the voice assistant with the new tour data
      setIsNewTourAssistantOpen(true);
    }, 200);
  };

  // Handler for tour assistant dialog open/close
  const handleNewTourAssistantOpenChange = (open: boolean) => {
    setIsNewTourAssistantOpen(open);
    // Note: We no longer clear voiceTourData here to preserve Experience tour agentId
    // voiceTourData is cleared during tour generation/reset in handleIntelligentTourOpen
  };

  if (showSplash) {
    return <SplashScreen onDismiss={dismissSplash} />;
  }

  // Don't render the map until we have a token AND splash is not showing
  if (!showSplash && !mapboxToken) {
    return <div className="w-screen h-screen flex items-center justify-center">Loading map...</div>;
  }

  const handleExperiencePaymentSuccess = async (paymentIntentId?: string) => {
    // Verify payment status before proceeding with tour generation
    if (paymentIntentId) {
      const { data: payment } = await supabase.from('payments').select('status').eq('stripe_payment_intent_id', paymentIntentId).eq('status', 'succeeded').maybeSingle();
      if (!payment) { toast({ title: "Payment verification failed", description: "Please try again." }); return; }
    }

    // Proceed with tour generation after successful payment
    if (!selectedExperience) {
      console.error('No experience selected for payment success');
      return;
    }

    // Convert experience to landmark format
    const landmark = {
      id: selectedExperience.id,
      name: selectedExperience.destination,
      coordinates: selectedExperience.destination_details?.coordinates || [0, 0],
      description: selectedExperience.description || '',
      types: selectedExperience.destination_details?.types || ['tourist_attraction'],
      rating: selectedExperience.destination_details?.rating,
      tourId: selectedExperience.id,
      experience: true
    };

    // Store landmark as pending destination for IntelligentTourDialog
    (window as any).pendingLandmarkDestination = landmark;

    // Open intelligent tour dialog
    handleIntelligentTourOpen();
    
    toast({
      title: "Payment successful!",
      description: "Starting your tour...",
    });
  };

  return (
    <>
      <MainLayout
        mapboxToken={mapboxToken}
        allLandmarks={allLandmarks}
        selectedLandmark={selectedLandmark}
        smartTourLandmarks={smartTourLandmarks}
        user={user}
        onSelectLandmark={handleSelectLandmark}
        onVoiceSearchOpen={handleInteractionHistoryOpen}
        onVoiceAssistantOpen={handleVoiceAssistantOpen}
        onLogoClick={handleLogoClick}
        onSignOut={signOut}
        onAuthDialogOpen={() => setIsAuthDialogOpen(true)}
        isVoiceSearchOpen={isInteractionHistoryOpen}
        onVoiceSearchOpenChange={setIsInteractionHistoryOpen}
        isAuthDialogOpen={isAuthDialogOpen}
        onAuthDialogOpenChange={handleAuthDialogClose}
        isNewTourAssistantOpen={isNewTourAssistantOpen}
        onNewTourAssistantOpenChange={handleNewTourAssistantOpenChange}
        onVoiceAgentStateChange={onVoiceAgentStateChange}
        isIntelligentTourOpen={isIntelligentTourOpen}
        onIntelligentTourOpenChange={setIsIntelligentTourOpen}
        onTourGenerated={handleTourGenerated}
        onTourReadyForVoice={handleTourReadyForVoice}
        voiceTourData={voiceTourData}
        tourKey={tourKey}
      />
      <DebugWindow 
        isVisible={isDebugVisible}
        onClose={toggleDebug}
      />
      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        experience={selectedExperience}
        clientSecret={clientSecret}
        onPaymentSuccess={handleExperiencePaymentSuccess}
      />
    </>
  );
};

export default Index;
