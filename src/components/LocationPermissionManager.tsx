import React, { useEffect } from 'react';
import { LocationPermissionDialog } from './LocationPermissionDialog';
import { useLocationPermissionFlow } from '@/hooks/useLocationPermissionFlow';

export const LocationPermissionManager: React.FC = () => {
  const {
    isDialogOpen,
    isLoading,
    closeDialog,
    feature,
  } = useLocationPermissionFlow();

  const handleAllowLocation = async () => {
    // Get the handlers from the window object (set by useLocationPermissionFlow)
    const handlers = (window as any).__locationPermissionHandlers;
    if (handlers?.onRequest) {
      await handlers.onRequest();
    }
  };

  const handleCloseDialog = () => {
    // Get the handlers from the window object
    const handlers = (window as any).__locationPermissionHandlers;
    if (handlers?.onClose) {
      handlers.onClose();
    } else {
      closeDialog();
    }
  };

  // Clean up handlers when component unmounts
  useEffect(() => {
    return () => {
      (window as any).__locationPermissionHandlers = undefined;
    };
  }, []);

  return (
    <LocationPermissionDialog
      isOpen={isDialogOpen}
      onOpenChange={handleCloseDialog}
      onAllowLocation={handleAllowLocation}
      isLoading={isLoading}
      feature={feature}
    />
  );
};