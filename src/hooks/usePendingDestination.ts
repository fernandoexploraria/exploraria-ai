
import { useState } from 'react';

export const usePendingDestination = () => {
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);

  const handleTourAuthRequired = (destination: string) => {
    setPendingDestination(destination);
    // This would typically trigger an auth dialog
    console.log('Tour auth required for:', destination);
  };

  return {
    pendingDestination,
    setPendingDestination,
    handleTourAuthRequired
  };
};
