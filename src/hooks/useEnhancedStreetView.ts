
import { useStreetView } from '@/hooks/useStreetView';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Landmark } from '@/data/landmarks';
import { useCallback, useState } from 'react';

interface EnhancedStreetViewData {
  imageUrl: string;
  heading: number;
  pitch: number;
  fov: number;
  location: {
    lat: number;
    lng: number;
  };
  landmarkName: string;
  metadata: {
    status: string;
    copyright?: string;
  };
}

export const useEnhancedStreetView = () => {
  const { fetchStreetView, getCachedData, isKnownUnavailable, isLoading, error } = useStreetView();
  const { isOnline, getOptimalImageQuality } = useNetworkStatus();
  const [offlineLoadingStates, setOfflineLoadingStates] = useState<{[key: string]: boolean}>({});
  
  const offlineCache = useOfflineCache<EnhancedStreetViewData>({
    storeName: 'streetview-images',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxItems: 200
  });

  const getStreetViewWithOfflineSupport = useCallback(async (landmark: Landmark): Promise<EnhancedStreetViewData | null> => {
    const landmarkId = landmark.id;
    
    // First check memory cache
    const memoryCache = getCachedData(landmarkId);
    if (memoryCache) {
      console.log(`📋 Using memory cache for ${landmark.name}`);
      return memoryCache;
    }

    // If offline, try to get from offline cache
    if (!isOnline) {
      console.log(`📱 Offline: Checking offline cache for ${landmark.name}`);
      setOfflineLoadingStates(prev => ({ ...prev, [landmarkId]: true }));
      
      try {
        const offlineData = await offlineCache.getItem(landmarkId);
        if (offlineData) {
          console.log(`💾 Using offline cache for ${landmark.name}`);
          return offlineData;
        }
      } catch (error) {
        console.error(`❌ Offline cache error for ${landmark.name}:`, error);
      } finally {
        setOfflineLoadingStates(prev => ({ ...prev, [landmarkId]: false }));
      }
      
      return null;
    }

    // Check if known unavailable
    if (isKnownUnavailable(landmarkId)) {
      return null;
    }

    // Fetch from network
    try {
      const data = await fetchStreetView(landmark);
      
      // Cache successful results for offline use
      if (data && offlineCache.isReady) {
        try {
          await offlineCache.setItem(landmarkId, data);
          console.log(`💾 Cached Street View for offline use: ${landmark.name}`);
        } catch (error) {
          console.warn(`⚠️ Failed to cache Street View for ${landmark.name}:`, error);
        }
      }
      
      return data;
    } catch (error) {
      console.error(`❌ Failed to fetch Street View for ${landmark.name}:`, error);
      
      // Try offline cache as fallback
      try {
        const offlineData = await offlineCache.getItem(landmarkId);
        if (offlineData) {
          console.log(`💾 Using offline cache as fallback for ${landmark.name}`);
          return offlineData;
        }
      } catch (offlineError) {
        console.error(`❌ Offline cache fallback failed for ${landmark.name}:`, offlineError);
      }
      
      return null;
    }
  }, [fetchStreetView, getCachedData, isKnownUnavailable, isOnline, offlineCache]);

  const preloadForOffline = useCallback(async (landmarks: Landmark[]): Promise<void> => {
    if (!isOnline || !offlineCache.isReady) return;

    console.log(`🔄 Pre-loading ${landmarks.length} landmarks for offline use`);
    
    for (const landmark of landmarks) {
      try {
        // Check if already cached offline
        const existing = await offlineCache.getItem(landmark.id);
        if (existing) continue;

        // Fetch and cache
        const data = await fetchStreetView(landmark);
        if (data) {
          await offlineCache.setItem(landmark.id, data);
          console.log(`✅ Pre-loaded for offline: ${landmark.name}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to pre-load ${landmark.name}:`, error);
      }
    }
  }, [fetchStreetView, offlineCache, isOnline]);

  const clearOfflineCache = useCallback(async (): Promise<void> => {
    try {
      await offlineCache.clear();
      console.log('🗑️ Cleared offline Street View cache');
    } catch (error) {
      console.error('❌ Failed to clear offline cache:', error);
    }
  }, [offlineCache]);

  return {
    getStreetViewWithOfflineSupport,
    preloadForOffline,
    clearOfflineCache,
    isLoading: { ...isLoading, ...offlineLoadingStates },
    error,
    isOfflineCacheReady: offlineCache.isReady,
    isOnline
  };
};
