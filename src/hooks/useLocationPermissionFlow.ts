import { useState, useCallback, useEffect } from 'react';
import { useNativeLocationPermission, LocationPermissionStatus } from './useNativeLocationPermission';
import { toast } from 'sonner';

interface UseLocationPermissionFlowReturn {
  permissionStatus: LocationPermissionStatus;
  isDialogOpen: boolean;
  isLoading: boolean;
  error: string | null;
  showPermissionDialog: (feature?: 'tours' | 'navigation' | 'general') => Promise<boolean>;
  closeDialog: () => void;
  requestLocationDirectly: () => Promise<boolean>;
  getCurrentPosition: () => Promise<any | null>;
  feature: 'tours' | 'navigation' | 'general';
}

export const useLocationPermissionFlow = (): UseLocationPermissionFlowReturn => {
  const {
    permissionStatus,
    isLoading,
    error,
    checkPermissionStatus,
    requestPermission,
    getCurrentPosition,
    isNativeApp,
  } = useNativeLocationPermission();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [feature, setFeature] = useState<'tours' | 'navigation' | 'general'>('general');

  // Check permission status on mount
  useEffect(() => {
    checkPermissionStatus();
  }, [checkPermissionStatus]);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const showPermissionDialog = useCallback(async (requestFeature: 'tours' | 'navigation' | 'general' = 'general'): Promise<boolean> => {
    setFeature(requestFeature);
    
    // First check current permission status
    const currentStatus = await checkPermissionStatus();
    
    if (currentStatus === 'granted') {
      // Already have permission, no need to show dialog
      return true;
    }
    
    if (currentStatus === 'denied') {
      // Permission was previously denied
      toast.error('Location access is required for this feature. Please enable it in your device settings.');
      return false;
    }
    
    // Show explainer dialog for 'prompt' or 'unknown' status
    setIsDialogOpen(true);
    
    // Return a promise that resolves when the dialog interaction is complete
    return new Promise((resolve) => {
      const handleDialogClose = () => {
        setIsDialogOpen(false);
        resolve(false); // User closed dialog without granting permission
      };
      
      const handlePermissionRequest = async () => {
        const granted = await requestPermission();
        setIsDialogOpen(false);
        
        if (granted) {
          toast.success('Location access granted! You can now use location features.');
        } else {
          toast.error('Location access is required for this feature.');
        }
        
        resolve(granted);
      };
      
      // Store handlers for the dialog component to use
      (window as any).__locationPermissionHandlers = {
        onClose: handleDialogClose,
        onRequest: handlePermissionRequest,
      };
    });
  }, [checkPermissionStatus, requestPermission]);

  const requestLocationDirectly = useCallback(async (): Promise<boolean> => {
    const currentStatus = await checkPermissionStatus();
    
    if (currentStatus === 'granted') {
      return true;
    }
    
    if (currentStatus === 'denied') {
      toast.error('Location access was previously denied. Please enable it in your device settings.');
      return false;
    }
    
    // Request permission directly without showing explainer dialog
    const granted = await requestPermission();
    
    if (granted) {
      toast.success('Location access granted!');
    } else {
      toast.error('Location access is required for this feature.');
    }
    
    return granted;
  }, [checkPermissionStatus, requestPermission]);

  return {
    permissionStatus,
    isDialogOpen,
    isLoading,
    error,
    showPermissionDialog,
    closeDialog,
    requestLocationDirectly,
    getCurrentPosition,
    feature,
  };
};