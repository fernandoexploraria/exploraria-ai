
import { useState, useEffect } from 'react';

export const useSplashControl = () => {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Check if splash has been shown in this browser session
    const splashShownThisSession = sessionStorage.getItem('splash-shown');
    
    // Check if this is a first-time visitor
    const hasVisitedBefore = localStorage.getItem('has-visited');
    
    // Show splash if:
    // 1. First time visitor (no localStorage entry), OR
    // 2. New browser session (no sessionStorage entry)
    if (!hasVisitedBefore || !splashShownThisSession) {
      setShowSplash(true);
    } else {
      setShowSplash(false);
    }
  }, []);

  const dismissSplash = () => {
    setShowSplash(false);
    
    // Mark as visited and session splash shown only when user actually dismisses
    localStorage.setItem('has-visited', 'true');
    sessionStorage.setItem('splash-shown', 'true');
  };

  const showSplashManually = () => {
    setShowSplash(true);
  };

  return {
    showSplash,
    dismissSplash,
    showSplashManually
  };
};
