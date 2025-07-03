import { useState } from 'react';
import { Landmark, EnhancedLandmark } from '@/data/landmarks';
import { setTourLandmarks, clearTourMarkers, setTourGenerationInProgress } from '@/data/tourLandmarks';
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useTourStats } from '@/hooks/useTourStats';
import { useMarkerLoadingState } from '@/hooks/useMarkerLoadingState';

export interface TourPlan {
  landmarks: EnhancedLandmark[];
  systemPrompt: string;
  destination: string;
  metadata?: {
    totalLandmarks: number;
    coordinateQuality: {
      highConfidence: number;
      mediumConfidence: number;
      lowConfidence: number;
    };
    processingTime: number;
    fallbacksUsed: string[];
  };
}

export interface ProgressState {
  phase: 'idle' | 'generating' | 'refining' | 'validating' | 'finalizing' | 'complete' | 'ready' | 'error';
  percentage: number;
  currentStep: string;
  processedLandmarks: number;
  totalLandmarks: number;
  qualityMetrics?: {
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
  errors: string[];
}

export const useTourPlanner = () => {
  const [tourPlan, setTourPlan] = useState<TourPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressState, setProgressState] = useState<ProgressState>({
    phase: 'idle',
    percentage: 0,
    currentStep: '',
    processedLandmarks: 0,
    totalLandmarks: 0,
    errors: []
  });
  const { subscriptionData } = useSubscription();
  const { tourStats, forceRefresh } = useTourStats();
  const { startMarkerLoading, finishMarkerLoading } = useMarkerLoadingState(1000);

  // Keep backward compatibility - convert enhanced landmarks to basic landmarks for components that need it
  const plannedLandmarks: Landmark[] = tourPlan?.landmarks?.map(landmark => ({
    id: landmark.id,
    name: landmark.name,
    coordinates: landmark.coordinates,
    description: landmark.description
  })) || [];

  const updateProgress = (update: Partial<ProgressState>) => {
    setProgressState(prev => ({ ...prev, ...update }));
  };

  // Helper function to convert numeric confidence to string literal
  const convertConfidenceToString = (confidence: number): 'high' | 'medium' | 'low' => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  };

  const generateTour = async (destination: string) => {
    // Check current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to generate tours.");
      return;
    }

    console.log('Generating enhanced tour for user:', user.id);

    // Set tour generation flag to prevent location button state changes
    setTourGenerationInProgress(true);

    try {
      // Clear existing tour markers first
      clearTourMarkers();

      // Check if user is subscribed or within free tour limit
      const FREE_TOUR_LIMIT = 3;
      const toursUsed = tourStats?.tour_count || 0;
      const isSubscribed = subscriptionData?.subscribed || false;
      
      console.log('Tour generation check:', { toursUsed, isSubscribed, FREE_TOUR_LIMIT, userId: user.id });
      
      if (!isSubscribed && toursUsed >= FREE_TOUR_LIMIT) {
        toast.error("You've reached your free tour limit. Please subscribe to generate more tours.");
        return;
      }
      
      setIsLoading(true);
      setError(null);
      setTourPlan(null);
      
      // Initialize progress tracking
      updateProgress({
        phase: 'generating',
        percentage: 0,
        currentStep: 'Initializing tour generation...',
        processedLandmarks: 0,
        totalLandmarks: 0,
        errors: []
      });

      // Local variable to track current progress for continuous animation
      let currentProgress = 0;

      const animateProgress = async (targetPercentage: number, currentStep: string, phase: ProgressState['phase']) => {
        const steps = 8; // More steps for smoother animation
        const increment = (targetPercentage - currentProgress) / steps;
        
        for (let i = 1; i <= steps; i++) {
          await new Promise(resolve => setTimeout(resolve, 300)); // Slower delay
          currentProgress = Math.min(currentProgress + increment, targetPercentage);
          updateProgress({
            phase,
            percentage: currentProgress,
            currentStep
          });
        }
      };

      console.log('Calling enhanced tour generation edge function...');
      
      // Phase 1: Generate landmark list with slower, more granular progress
      updateProgress({
        phase: 'generating',
        percentage: 0,
        currentStep: 'Initializing tour generation...'
      });

      await animateProgress(15, 'Connecting to Gemini AI...', 'generating');
      await animateProgress(30, 'Getting landmark suggestions...', 'generating');

      // Call the enhanced tour generation edge function
      const { data: enhancedTourData, error: enhancedTourError } = await supabase.functions.invoke('generate-enhanced-tour', {
        body: { destination }
      });

      if (enhancedTourError) {
        console.error('Enhanced tour generation error:', enhancedTourError);
        updateProgress({
          phase: 'error',
          percentage: 0,
          currentStep: 'Failed to generate tour',
          errors: [enhancedTourError.message || "Failed to generate enhanced tour."]
        });
        throw new Error(enhancedTourError.message || "Failed to generate enhanced tour.");
      }

      if (!enhancedTourData || !enhancedTourData.landmarks || !enhancedTourData.systemPrompt) {
        const errorMsg = "Invalid enhanced tour data received.";
        updateProgress({
          phase: 'error',
          percentage: 0,
          currentStep: 'Invalid data received',
          errors: [errorMsg]
        });
        throw new Error(errorMsg);
      }

      // Phase 2: Process coordinate refinement results with slower progress
      await animateProgress(45, 'Processing landmarks...', 'refining');
      await animateProgress(60, 'Refining coordinates...', 'refining');
      
      updateProgress({
        phase: 'refining',
        totalLandmarks: enhancedTourData.landmarks.length,
        processedLandmarks: enhancedTourData.landmarks.length
      });

      console.log('Enhanced tour data received:', {
        landmarkCount: enhancedTourData.landmarks.length,
        quality: enhancedTourData.metadata?.coordinateQuality,
        processingTime: enhancedTourData.metadata?.processingTime
      });

      // Phase 3: Validate and prepare landmarks with slower progress
      await animateProgress(75, 'Validating coordinates...', 'validating');
      await animateProgress(85, 'Checking quality metrics...', 'validating');
      
      updateProgress({
        phase: 'validating',
        qualityMetrics: enhancedTourData.metadata?.coordinateQuality
      });

      // Preserve enhanced landmarks with all metadata - NO QUALITY_SCORE FIELD
      const enhancedLandmarks: EnhancedLandmark[] = enhancedTourData.landmarks.map((enhancedLandmark: any) => ({
        id: enhancedLandmark.id,
        name: enhancedLandmark.name,
        coordinates: enhancedLandmark.coordinates,
        description: enhancedLandmark.description,
        placeId: enhancedLandmark.placeId,
        coordinateSource: enhancedLandmark.coordinateSource,
        confidence: enhancedLandmark.confidence,
        rating: enhancedLandmark.rating,
        photos: enhancedLandmark.photos,
        types: enhancedLandmark.types,
        formattedAddress: enhancedLandmark.formattedAddress
        // 🔥 NOTE: Removed quality_score field completely
      }));

      // Phase 4: Finalize tour with slower progress
      await animateProgress(90, 'Finalizing tour...', 'finalizing');

      // Start marker loading
      startMarkerLoading();
      await animateProgress(95, 'Loading landmarks to map...', 'finalizing');

      // Convert EnhancedLandmark[] to TourLandmark[] with proper validation and type conversion
      console.log('Converting enhanced landmarks to tour landmarks:', enhancedLandmarks.length);
      const tourLandmarks = enhancedLandmarks
        .filter(landmark => landmark.placeId) // Only include landmarks with placeId
        .map(landmark => ({
          placeId: landmark.placeId!, // Now guaranteed to exist due to filter
          id: landmark.id || landmark.placeId!, // Ensure id exists for compatibility
          name: landmark.name,
          coordinates: landmark.coordinates,
          description: landmark.description,
          rating: landmark.rating,
          photos: landmark.photos,
          types: landmark.types,
          formattedAddress: landmark.formattedAddress,
          tourId: undefined, // Will be set when we have tour persistence
          coordinateSource: landmark.coordinateSource,
          confidence: convertConfidenceToString(landmark.confidence) // Convert number to string literal
        }));

      console.log('Setting tour landmarks:', tourLandmarks.length, 'valid landmarks with placeId and id');
      setTourLandmarks(tourLandmarks);

      const newTourPlan: TourPlan = {
        landmarks: enhancedLandmarks,
        systemPrompt: enhancedTourData.systemPrompt,
        destination: destination,
        metadata: enhancedTourData.metadata
      };

      setTourPlan(newTourPlan);
      
      // Wait for markers to load before completing
      await finishMarkerLoading();
      
      // Update tour count
      try {
        console.log('Calling increment_tour_count function for user:', user.id);
        
        const { data: incrementResult, error: incrementError } = await supabase.rpc('increment_tour_count', {
          p_user_id: user.id
        });
        
        if (incrementError) {
          console.error('Error calling increment_tour_count:', incrementError);
          // Try to insert directly if the function fails
          console.log('Attempting direct insert/update...');
          const { data: insertResult, error: insertError } = await supabase
            .from('user_tour_stats')
            .upsert({
              user_id: user.id,
              tour_count: toursUsed + 1,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            })
            .select()
            .single();
          
          if (insertError) {
            console.error('Error with direct insert:', insertError);
          } else {
            console.log('Direct insert successful:', insertResult);
          }
        } else {
          console.log('increment_tour_count successful, new count:', incrementResult);
        }
        
        console.log('Triggering force refresh of tour stats...');
        await forceRefresh();
        
      } catch (countErr) {
        console.error('Failed to update tour count:', countErr);
        // Don't fail the whole operation for count errors
        updateProgress({
          errors: [...progressState.errors, 'Failed to update tour count, but tour was generated successfully']
        });
      }
      
      // Complete with success - animate to 100% then show completion for 5 seconds
      await animateProgress(100, 'Tour generation complete!', 'complete');
      
      // Enhanced success message with quality info
      const qualityInfo = enhancedTourData.metadata?.coordinateQuality;
      const qualityMessage = qualityInfo 
        ? ` (${qualityInfo.highConfidence} high-quality coordinates)`
        : '';
      
      toast.success(`Generated an enhanced tour for ${destination}!${qualityMessage} Tour landmarks added with green markers.`);
      
      // After 5 seconds, set phase to 'ready' to signal progress should hide
      setTimeout(() => {
        updateProgress({
          phase: 'ready',
          percentage: 100,
          currentStep: 'Ready to explore!'
        });
      }, 5000);
      
    } catch (err) {
      console.error("Error generating enhanced tour:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      
      // Categorize errors for better user experience
      let userFriendlyMessage = errorMessage;
      let retryable = true;
      
      if (errorMessage.includes('Gemini') || errorMessage.includes('AI')) {
        userFriendlyMessage = "AI service temporarily unavailable. Please try again.";
      } else if (errorMessage.includes('Places') || errorMessage.includes('Google')) {
        userFriendlyMessage = "Location service temporarily unavailable. Please try again.";
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userFriendlyMessage = "Network connection issue. Please check your connection and try again.";
      } else if (errorMessage.includes('auth') || errorMessage.includes('login')) {
        userFriendlyMessage = "Authentication issue. Please sign in again.";
        retryable = false;
      }
      
      updateProgress({
        phase: 'error',
        percentage: 0,
        currentStep: 'Tour generation failed',
        errors: [userFriendlyMessage]
      });
      
      setError(userFriendlyMessage);
      toast.error(`Failed to generate tour: ${userFriendlyMessage}${retryable ? ' You can try again.' : ''}`);
      setTourPlan(null);
    } finally {
      setIsLoading(false);
      // Clear tour generation flag when done (success or failure)
      setTourGenerationInProgress(false);
    }
  };

  return { 
    tourPlan, 
    plannedLandmarks, // Keep for backward compatibility
    isLoading, 
    error, 
    generateTour,
    progressState
  };
};
