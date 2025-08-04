
import { useState, useEffect } from 'react';

const DEMO_MODE_KEY = 'exploraria-demo-mode';

export const useDemoMode = () => {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    try {
      const saved = localStorage.getItem(DEMO_MODE_KEY);
      return saved ? JSON.parse(saved) : false; // Default to false (demo mode OFF)
    } catch (error) {
      console.warn('Failed to read demo mode from localStorage:', error);
      return false; // Default to false (demo mode OFF)
    }
  });

  const toggleDemoMode = () => {
    setIsDemoMode(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem(DEMO_MODE_KEY, JSON.stringify(newValue));
      } catch (error) {
        console.warn('Failed to save demo mode to localStorage:', error);
      }
      return newValue;
    });
  };

  return {
    isDemoMode,
    toggleDemoMode,
  };
};
