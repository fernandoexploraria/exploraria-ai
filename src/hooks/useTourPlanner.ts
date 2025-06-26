import { useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { setTourLandmarks, clearTourMarkers } from '@/data/tourLandmarks';
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useTourStats } from '@/hooks/useTourStats';

export interface TourPlan {
  landmarks: Landmark[];
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
  phase: 'idle' | 'generating' | 'refining' | 'validating' | 'finalizing' | 'complete' | 'error';
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

  // Keep backward compatibility
  const plannedLandmarks = tourPlan?.landmarks || [];

  const updateProgress = (update: Partial<ProgressState>) => {
    setProgressState(prev => ({ ...prev, ...update }));
  };

  const generateTour = async (destination: string) => {
    // Check current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to generate tours.");
      return;
    }

    console.log('Generating enhanced tour for user:', user.id);

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

    try {
      console.log('Calling enhanced tour generation edge function...');
      
      // Phase 1: Generate landmark list
      updateProgress({
        phase: 'generating',
        percentage: 10,
        currentStep: 'Getting landmark suggestions from Gemini AI...'
      });

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

      // Phase 2: Process coordinate refinement results
      updateProgress({
        phase: 'refining',
        percentage: 60,
        currentStep: 'Processing coordinate refinement results...',
        totalLandmarks: enhancedTourData.landmarks.length,
        processedLandmarks: enhancedTourData.landmarks.length
      });

      console.log('Enhanced tour data received:', {
        landmarkCount: enhancedTourData.landmarks.length,
        quality: enhancedTourData.metadata?.coordinateQuality,
        processingTime: enhancedTourData.metadata?.processingTime
      });

      // Phase 3: Validate and prepare landmarks
      updateProgress({
        phase: 'validating',
        percentage: 80,
        currentStep: 'Validating landmark coordinates...',
        qualityMetrics: enhancedTourData.metadata?.coordinateQuality
      });

      // Convert enhanced landmarks to backward-compatible format
      const newLandmarks: Landmark[] = enhancedTourData.landmarks.map((enhancedLandmark: any) => ({
        id: enhancedLandmark.id,
        name: enhancedLandmark.name,
        coordinates: enhancedLandmark.coordinates,
        description: enhancedLandmark.description,
        // Store enhanced data in description for now (could be extended later)
        ...(enhancedLandmark.rating && { rating: enhancedLandmark.rating }),
        ...(enhancedLandmark.coordinateSource && { coordinateSource: enhancedLandmark.coordinateSource }),
        ...(enhancedLandmark.confidence && { confidence: enhancedLandmark.confidence })
      }));

      // Phase 4: Finalize tour
      updateProgress({
        phase: 'finalizing',
        percentage: 90,
        currentStep: 'Finalizing tour and updating map...'
      });

      // Set tour landmarks in the separate array (this clears and repopulates)
      console.log('Setting enhanced tour landmarks:', newLandmarks.length);
      setTourLandmarks(enhancedTourData.landmarks.map((lm: any) => ({
        name: lm.name,
        coordinates: lm.coordinates,
        description: lm.description
      })));

      const newTourPlan: TourPlan = {
        landmarks: newLandmarks,
        systemPrompt: enhancedTourData.systemPrompt,
        destination: destination,
        metadata: enhancedTourData.metadata
      };

      setTourPlan(newTourPlan);
      
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
      
      // Complete with success
      updateProgress({
        phase: 'complete',
        percentage: 100,
        currentStep: 'Tour generation complete!'
      });
      
      // Enhanced success message with quality info
      const qualityInfo = enhancedTourData.metadata?.coordinateQuality;
      const qualityMessage = qualityInfo 
        ? ` (${qualityInfo.highConfidence} high-quality coordinates)`
        : '';
      
      toast.success(`Generated an enhanced tour for ${destination}!${qualityMessage} Tour landmarks added with green markers.`);
      
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
