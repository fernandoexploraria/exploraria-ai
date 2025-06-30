import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Volume2, VolumeX, Eye, MapPin } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { TOUR_LANDMARKS, setMapMarkersRef, TourLandmark } from '@/data/tourLandmarks';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useStreetView } from '@/hooks/useStreetView';
import { useStreetViewNavigation } from '@/hooks/useStreetViewNavigation';
import { useEnhancedStreetView } from '@/hooks/useEnhancedStreetView';
import EnhancedStreetViewModal from './EnhancedStreetViewModal';
import { useEnhancedPhotos, PhotoData } from '@/hooks/useEnhancedPhotos';
import EnhancedProgressiveImage from './EnhancedProgressiveImage';
import { PhotoCarousel } from './photo-carousel';
import { generateTourLandmarkId, generateTopLandmarkId } from '@/utils/markerIdUtils';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
}

const GOOGLE_API_KEY = 'AIzaSyCjQKg2W9uIrIx4EmRnyf3WCkO4eeEvpyg';

const Map: React.FC<MapProps> = ({ 
  mapboxToken, 
  landmarks, 
  onSelectLandmark, 
  selectedLandmark, 
  plannedLandmarks
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const imageCache = useRef<{ [key: string]: string }>({});
  const enhancedPhotosCache = useRef<{ [key: string]: PhotoData[] }>({});
  const photoPopups = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const [playingAudio, setPlayingAudio] = useState<{ [key: string]: boolean }>({});
  const pendingPopupLandmark = useRef<Landmark | null>(null);
  const isZooming = useRef<boolean>(false);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const navigationMarkers = useRef<{ marker: mapboxgl.Marker; interaction: any }[]>([]);
  const currentRouteLayer = useRef<string | null>(null);
  
  const [tourLandmarks, setTourLandmarks] = useState<TourLandmark[]>([]);
  
  const geolocateControl = useRef<mapboxgl.GeolocateControl | null>(null);
  const isUpdatingFromProximitySettings = useRef<boolean>(false);
  const userInitiatedLocationRequest = useRef<boolean>(false);
  const lastLocationEventTime = useRef<number>(0);
  
  const processedPlannedLandmarks = useRef<string[]>([]);
  
  const { user } = useAuth();
  const { updateProximityEnabled, proximitySettings } = useProximityAlerts();
  const { fetchPhotos } = useEnhancedPhotos();
  
  const { getCachedData } = useStreetView();
  const { getStreetViewWithOfflineSupport } = useEnhancedStreetView();
  const { 
    openStreetViewModal, 
    closeStreetViewModal, 
    isModalOpen, 
    streetViewItems, 
    currentIndex,
    navigateToIndex,
    navigateNext,
    navigatePrevious 
  } = useStreetViewNavigation();

  useEffect(() => {
    console.log('🔄 Syncing tour landmarks state:', TOUR_LANDMARKS.length);
    setTourLandmarks([...TOUR_LANDMARKS]);
  }, [TOUR_LANDMARKS.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (TOUR_LANDMARKS.length !== tourLandmarks.length) {
        console.log('🔄 Detected tour landmarks change via polling:', TOUR_LANDMARKS.length);
        setTourLandmarks([...TOUR_LANDMARKS]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tourLandmarks.length]);

  const allLandmarksWithTop = React.useMemo(() => {
    console.log('🗺️ Rebuilding landmarks list:', {
      baseLandmarks: landmarks.length,
      topLandmarks: TOP_LANDMARKS.length,
      tourLandmarks: tourLandmarks.length
    });
    
    const topLandmarksConverted: Landmark[] = TOP_LANDMARKS.map((topLandmark, index) => ({
      id: generateTopLandmarkId(index),
      name: topLandmark.name,
      coordinates: topLandmark.coordinates,
      description: topLandmark.description
    }));
    
    const tourLandmarksConverted: Landmark[] = tourLandmarks.map((tourLandmark, index) => ({
      id: generateTourLandmarkId(index),
      name: tourLandmark.name,
      coordinates: tourLandmark.coordinates,
      description: tourLandmark.description
    }));
    
    const result = [...landmarks, ...topLandmarksConverted, ...tourLandmarksConverted];
    console.log('🗺️ Total landmarks for map:', result.length);
    return result;
  }, [landmarks, tourLandmarks]);

  const updateProgress = (update: Partial<ProgressState>) => {
    setProgressState(prev => ({ ...prev, ...update }));
  };

  const generateTour = async (destination: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to generate tours.");
      return;
    }

    console.log('Generating enhanced tour for user:', user.id);

    clearTourMarkers();

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
    
    updateProgress({
      phase: 'generating',
      percentage: 0,
      currentStep: 'Initializing tour generation...',
      processedLandmarks: 0,
      totalLandmarks: 0,
      errors: []
    });

    let currentProgress = 0;

    const animateProgress = async (targetPercentage: number, currentStep: string, phase: ProgressState['phase']) => {
      const steps = 8;
      const increment = (targetPercentage - currentProgress) / steps;
      
      for (let i = 1; i <= steps; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        currentProgress = Math.min(currentProgress + increment, targetPercentage);
        updateProgress({
          phase,
          percentage: currentProgress,
          currentStep
        });
      }
    };

    try {
      console.log('Calling enhanced tour generation edge function...');
      
      updateProgress({
        phase: 'generating',
        percentage: 0,
        currentStep: 'Initializing tour generation...'
      });

      await animateProgress(15, 'Connecting to Gemini AI...', 'generating');
      await animateProgress(30, 'Getting landmark suggestions...', 'generating');

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

      await animateProgress(75, 'Validating coordinates...', 'validating');
      await animateProgress(85, 'Checking quality metrics...', 'validating');
      
      updateProgress({
        phase: 'validating',
        qualityMetrics: enhancedTourData.metadata?.coordinateQuality
      });

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
      }));

      await animateProgress(90, 'Finalizing tour...', 'finalizing');

      startMarkerLoading();
      await animateProgress(95, 'Loading landmarks to map...', 'finalizing');

      console.log('Setting enhanced tour landmarks:', enhancedLandmarks.length);
      setTourLandmarks(enhancedLandmarks.map(lm => ({
        name: lm.name,
        coordinates: lm.coordinates,
        description: lm.description
      })));

      const newTourPlan: TourPlan = {
        landmarks: enhancedLandmarks,
        systemPrompt: enhancedTourData.systemPrompt,
        destination: destination,
        metadata: enhancedTourData.metadata
      };

      setTourPlan(newTourPlan);
      
      await finishMarkerLoading();
      
      try {
        console.log('Calling increment_tour_count function for user:', user.id);
        
        const { data: incrementResult, error: incrementError } = await supabase.rpc('increment_tour_count', {
          p_user_id: user.id
        });
        
        if (incrementError) {
          console.error('Error calling increment_tour_count:', incrementError);
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
        updateProgress({
          errors: [...progressState.errors, 'Failed to update tour count, but tour was generated successfully']
        });
      }
      
      await animateProgress(100, 'Tour generation complete!', 'complete');
      
      const qualityInfo = enhancedTourData.metadata?.coordinateQuality;
      const qualityMessage = qualityInfo 
        ? ` (${qualityInfo.highConfidence} high-quality coordinates)`
        : '';
      
      toast.success(`Generated an enhanced tour for ${destination}!${qualityMessage} Tour landmarks added with green markers.`);
      
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
    plannedLandmarks, 
    isLoading, 
    error, 
    generateTour,
    progressState
  };
};

export default Map;
