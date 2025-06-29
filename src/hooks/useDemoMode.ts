
import { useState } from 'react';

export const useDemoMode = () => {
  const [isDemoMode, setIsDemoMode] = useState(false);

  const toggleDemoMode = () => {
    setIsDemoMode(prev => !prev);
  };

  return {
    isDemoMode,
    toggleDemoMode,
  };
};
