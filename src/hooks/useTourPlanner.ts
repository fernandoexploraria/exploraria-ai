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

export const useTourPlanner = () => {
  const [tourPlan, setTourPlan] = useState<TourPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { subscriptionData } = useSubscription();
  const { tourStats, forceRefresh } = useTourStats();

  // Keep backward compatibility
  const plannedLandmarks = tourPlan?.landmarks || [];

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
    setTourPlan(null); // Clear previous results

    try {
      console.log('Calling enhanced tour generation edge function...');
      
      // Call the new enhanced tour generation edge function
      const { data: enhancedTourData, error: enhancedTourError } = await supabase.functions.invoke('generate-enhanced-tour', {
        body: { destination }
      });

      if (enhancedTourError) {
        console.error('Enhanced tour generation error:', enhancedTourError);
        throw new Error(enhancedTourError.message || "Failed to generate enhanced tour.");
      }

      if (!enhancedTourData || !enhancedTourData.landmarks || !enhancedTourData.systemPrompt) {
        throw new Error("Invalid enhanced tour data received.");
      }

      console.log('Enhanced tour data received:', {
        landmarkCount: enhancedTourData.landmarks.length,
        quality: enhancedTourData.metadata?.coordinateQuality,
        processingTime: enhancedTourData.metadata?.processingTime
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
      
      // ... keep existing code (increment tour count logic)
      try {
        console.log('Calling increment_tour_count function for user:', user.id);
        
        // Call the database function to increment tour count with correct parameter name
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
        
        // Force refresh tour stats after increment
        console.log('Triggering force refresh of tour stats...');
        await forceRefresh();
        
      } catch (countErr) {
        console.error('Failed to update tour count:', countErr);
      }
      
      // Enhanced success message with quality info
      const qualityInfo = enhancedTourData.metadata?.coordinateQuality;
      const qualityMessage = qualityInfo 
        ? ` (${qualityInfo.highConfidence} high-quality coordinates)`
        : '';
      
      toast.success(`Generated an enhanced tour for ${destination}!${qualityMessage} Tour landmarks added with green markers.`);
      
    } catch (err) {
      console.error("Error generating enhanced tour:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast.error(`Failed to generate tour: ${errorMessage}`);
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
    generateTour 
  };
};
