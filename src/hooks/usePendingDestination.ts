
import { useState } from 'react';

export const usePendingDestination = () => {
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);

  return {
    pendingDestination,
    setPendingDestination
  };
};
