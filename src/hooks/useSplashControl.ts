
import { useState, useEffect } from 'react';

export const useSplashControl = () => {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Check if splash has been shown in this browser session
    const splashShownThisSession = sessionStorage.getItem('splash-shown');
    
    // Check if this is a first-time visitor
    const hasVisitedBefore = localStorage.getItem('has-visited');
    
    // Enhanced logic: Show splash if:
    // 1. First time visitor (no localStorage entry), OR
    // 2. New browser session (no sessionStorage entry), OR  
    // 3. Last visit was more than 24 hours ago (for returning users to see updates)
    const lastVisit = localStorage.getItem('last-visit-time');
    const daysSinceLastVisit = lastVisit ? 
      (Date.now() - parseInt(lastVisit)) / (1000 * 60 * 60 * 24) : Infinity;
    
    const shouldShowSplash = !hasVisitedBefore || 
                           !splashShownThisSession || 
                           daysSinceLastVisit > 1;

    if (shouldShowSplash) {
      console.log('🎬 Showing splash screen - first visit, new session, or returning after 24h');
      setShowSplash(true);
      
      // Mark as visited and session splash shown
      localStorage.setItem('has-visited', 'true');
      localStorage.setItem('last-visit-time', Date.now().toString());
      sessionStorage.setItem('splash-shown', 'true');
    } else {
      console.log('🎬 Skipping splash screen - already shown recently');
      setShowSplash(false);
    }
  }, []);

  const dismissSplash = () => {
    console.log('🎬 Splash screen dismissed');
    setShowSplash(false);
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
