
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface LoadingState {
  isLoading: boolean;
  progress: number;
  currentStep?: string;
  viewpointsLoaded?: number;
  totalViewpoints?: number;
}

interface AdaptiveLoaderOptions {
  onProgress?: (progress: number) => void;
  onStepChange?: (step: string) => void;
  onComplete?: () => void;
}

export const useAdaptiveStreetViewLoader = (options: AdaptiveLoaderOptions = {}) => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    progress: 0,
    currentStep: undefined,
    viewpointsLoaded: 0,
    totalViewpoints: 1
  });

  const [loadingViewpoints, setLoadingViewpoints] = useState<Set<number>>(new Set());
  const { getOptimalImageQuality, shouldPreloadContent } = useNetworkStatus();
  
  // Use refs to track active loading processes and prevent duplicates
  const activeLoadingRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateProgress = useCallback((progress: number, step?: string) => {
    console.log(`📊 Loading progress: ${Math.round(progress)}%${step ? ` - ${step}` : ''}`);
    setLoadingState(prev => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
      currentStep: step
    }));
    options.onProgress?.(progress);
    if (step) options.onStepChange?.(step);
  }, [options.onProgress, options.onStepChange]);

  const startLoading = useCallback((totalViewpoints: number = 1, loadingId?: string) => {
    const currentLoadingId = loadingId || `loading-${Date.now()}`;
    
    // Prevent duplicate loading processes
    if (activeLoadingRef.current === currentLoadingId) {
      console.log(`🔄 Loading already active for ${currentLoadingId}, skipping`);
      return;
    }
    
    // Clear any previous loading process
    if (activeLoadingRef.current) {
      console.log(`🧹 Clearing previous loading process: ${activeLoadingRef.current}`);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
    
    activeLoadingRef.current = currentLoadingId;
    console.log(`🚀 Starting loading for ${totalViewpoints} viewpoint(s) [${currentLoadingId}]`);
    
    setLoadingState({
      isLoading: true,
      progress: 0,
      currentStep: 'Initializing...',
      viewpointsLoaded: 0,
      totalViewpoints
    });
    setLoadingViewpoints(new Set());
  }, []);

  const setViewpointLoading = useCallback((index: number, isLoading: boolean) => {
    console.log(`🔄 Viewpoint ${index} loading state: ${isLoading ? 'loading' : 'complete'}`);
    setLoadingViewpoints(prev => {
      const newSet = new Set(prev);
      if (isLoading) {
        newSet.add(index);
      } else {
        newSet.delete(index);
      }
      return newSet;
    });
  }, []);

  const completeViewpoint = useCallback((index: number) => {
    console.log(`✅ Viewpoint ${index} completed`);
    setViewpointLoading(index, false);
    setLoadingState(prev => {
      const newViewpointsLoaded = prev.viewpointsLoaded! + 1;
      const newProgress = (newViewpointsLoaded / prev.totalViewpoints!) * 100;
      
      console.log(`📈 Progress updated: ${newViewpointsLoaded}/${prev.totalViewpoints} viewpoints (${Math.round(newProgress)}%)`);
      
      return {
        ...prev,
        viewpointsLoaded: newViewpointsLoaded,
        progress: newProgress,
        currentStep: newViewpointsLoaded === prev.totalViewpoints 
          ? 'Finalizing...' 
          : `Loading viewpoint ${newViewpointsLoaded + 1}...`
      };
    });
  }, [setViewpointLoading]);

  const finishLoading = useCallback(() => {
    console.log('🏁 Loading finished');
    
    // Clear active loading reference
    activeLoadingRef.current = null;
    
    // Clear timeout if exists
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setLoadingState(prev => ({
      ...prev,
      isLoading: false,
      progress: 100,
      currentStep: undefined
    }));
    setLoadingViewpoints(new Set());
    options.onComplete?.();
  }, [options.onComplete]);

  const loadImageWithProgress = useCallback(async (
    url: string, 
    index: number,
    onLoadStart?: () => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log(`🖼️ Loading image for viewpoint ${index}: ${url.substring(0, 50)}...`);
      onLoadStart?.();
      setViewpointLoading(index, true);
      
      const img = new Image();
      
      img.onload = () => {
        console.log(`✅ Image loaded for viewpoint ${index}`);
        completeViewpoint(index);
        resolve();
      };
      
      img.onerror = () => {
        console.error(`❌ Failed to load image for viewpoint ${index}`);
        setViewpointLoading(index, false);
        reject(new Error(`Failed to load image at index ${index}`));
      };
      
      // Start loading
      img.src = url;
    });
  }, [setViewpointLoading, completeViewpoint]);

  const getOptimalLoadingStrategy = useCallback(() => {
    const quality = getOptimalImageQuality();
    const shouldPreload = shouldPreloadContent();
    
    return {
      quality,
      shouldPreload,
      concurrentLoads: shouldPreload ? 3 : 1,
      prioritizeVisible: true
    };
  }, [getOptimalImageQuality, shouldPreloadContent]);

  // Auto-finish loading when all viewpoints are loaded with timeout protection
  useEffect(() => {
    if (loadingState.isLoading && 
        loadingState.viewpointsLoaded === loadingState.totalViewpoints &&
        loadingViewpoints.size === 0) {
      console.log('🎯 All viewpoints loaded, finishing in 500ms');
      const timer = setTimeout(() => {
        finishLoading();
      }, 500); // Small delay for visual feedback
      
      return () => clearTimeout(timer);
    }
  }, [loadingState.isLoading, loadingState.viewpointsLoaded, loadingState.totalViewpoints, loadingViewpoints.size, finishLoading]);

  // Fallback timeout to prevent infinite loading - now using ref for cleanup
  useEffect(() => {
    if (loadingState.isLoading && !timeoutRef.current) {
      console.log('⏰ Setting 10s timeout for loading fallback');
      timeoutRef.current = setTimeout(() => {
        console.log('⚠️ Loading timeout reached, forcing completion');
        finishLoading();
      }, 10000); // 10 second timeout
    }
    
    if (!loadingState.isLoading && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [loadingState.isLoading, finishLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      activeLoadingRef.current = null;
    };
  }, []);

  return {
    loadingState,
    loadingViewpoints,
    startLoading,
    finishLoading,
    updateProgress,
    setViewpointLoading,
    completeViewpoint,
    loadImageWithProgress,
    getOptimalLoadingStrategy
  };
};
