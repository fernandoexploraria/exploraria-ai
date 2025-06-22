
import { useState, useEffect } from 'react';

const PENDING_DESTINATION_KEY = 'pendingTourDestination';

export const usePendingDestination = (user: any, isTourLoading: boolean, generateTour: (destination: string) => Promise<void>) => {
  const [pendingDestination, setPendingDestination] = useState<string>('');

  // Handle post-authentication tour generation
  useEffect(() => {
    if (user && !isTourLoading) {
      // Check both state and localStorage for pending destination
      const storedDestination = localStorage.getItem(PENDING_DESTINATION_KEY);
      const destinationToUse = pendingDestination || storedDestination;
      
      if (destinationToUse) {
        console.log('User signed in with pending destination:', destinationToUse);
        // Clear from localStorage
        localStorage.removeItem(PENDING_DESTINATION_KEY);
        // Automatically generate tour and open tour planner
        generateTour(destinationToUse);
        setPendingDestination('');
      }
    }
  }, [user, pendingDestination, isTourLoading, generateTour]);

  const handleTourAuthRequired = (destination: string) => {
    console.log('Auth required for destination:', destination);
    // Store in both state and localStorage for OAuth persistence
    setPendingDestination(destination);
    localStorage.setItem(PENDING_DESTINATION_KEY, destination);
  };

  return { pendingDestination, handleTourAuthRequired };
};
