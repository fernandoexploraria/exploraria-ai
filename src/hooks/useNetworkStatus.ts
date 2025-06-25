
import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string;
  effectiveType: string;
  downlink: number;
}

export const useNetworkStatus = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isSlowConnection: false,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0
  });

  const updateNetworkStatus = useCallback(() => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    const isOnline = navigator.onLine;
    let isSlowConnection = false;
    let connectionType = 'unknown';
    let effectiveType = 'unknown';
    let downlink = 0;

    if (connection) {
      connectionType = connection.type || 'unknown';
      effectiveType = connection.effectiveType || 'unknown';
      downlink = connection.downlink || 0;
      
      // Consider connection slow if effective type is 2g or downlink < 1 Mbps
      isSlowConnection = effectiveType === '2g' || 
                        effectiveType === 'slow-2g' || 
                        downlink < 1;
    }

    setNetworkStatus({
      isOnline,
      isSlowConnection,
      connectionType,
      effectiveType,
      downlink
    });
  }, []);

  useEffect(() => {
    // Initial status
    updateNetworkStatus();

    // Listen for online/offline events
    const handleOnline = () => updateNetworkStatus();
    const handleOffline = () => updateNetworkStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes if supported
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, [updateNetworkStatus]);

  const getOptimalImageQuality = useCallback(() => {
    if (!networkStatus.isOnline) return 'low';
    if (networkStatus.isSlowConnection) return 'medium';
    return 'high';
  }, [networkStatus]);

  const shouldPreloadContent = useCallback(() => {
    return networkStatus.isOnline && !networkStatus.isSlowConnection;
  }, [networkStatus]);

  const getRecommendedTimeout = useCallback(() => {
    if (networkStatus.isSlowConnection) return 30000; // 30 seconds
    if (networkStatus.effectiveType === '3g') return 15000; // 15 seconds
    return 10000; // 10 seconds for 4g+
  }, [networkStatus]);

  return {
    ...networkStatus,
    getOptimalImageQuality,
    shouldPreloadContent,
    getRecommendedTimeout,
    refresh: updateNetworkStatus
  };
};
