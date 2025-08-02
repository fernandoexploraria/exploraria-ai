
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export const useSplashControl = () => {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Skip automatic splash on native platforms (they have their own native splash)
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      console.log('🎬 Skipping splash screen - running on native platform with native splash');
      setShowSplash(false);
      return;
    }

    // Check if splash has been shown in this browser session
    const splashShownThisSession = sessionStorage.getItem('splash-shown');
    
    // Check if this is a first-time visitor
    const hasVisitedBefore = localStorage.getItem('has-visited');
    
    // Show splash if:
    // 1. First time visitor (no localStorage entry), OR
    // 2. New browser session (no sessionStorage entry)
    if (!hasVisitedBefore || !splashShownThisSession) {
      console.log('🎬 Showing splash screen - first visit or new session');
      setShowSplash(true);
    } else {
      console.log('🎬 Skipping splash screen - already shown this session');
      setShowSplash(false);
    }
  }, []);

  const dismissSplash = () => {
    console.log('🎬 Splash screen dismissed');
    setShowSplash(false);
    
    // Mark as visited and session splash shown only when user actually dismisses
    localStorage.setItem('has-visited', 'true');
    sessionStorage.setItem('splash-shown', 'true');
  };

  const showSplashManually = () => {
    console.log('🎬 Showing splash screen manually');
    setShowSplash(true);
  };

  return {
    showSplash,
    dismissSplash,
    showSplashManually
  };
};
