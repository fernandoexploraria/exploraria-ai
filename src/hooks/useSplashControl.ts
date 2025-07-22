
import { useState, useEffect } from 'react';

export const useSplashControl = () => {
  const [showSplash, setShowSplash] = useState(false);
  
  // Tracks whether a manual override is in progress to prevent automatic dismissal
  const [isManuallyTriggered, setIsManuallyTriggered] = useState(false);

  useEffect(() => {
    // Skip automatic splash if manually triggered
    if (isManuallyTriggered) {
      console.log('🎬 Manual trigger in progress, skipping automatic check');
      return;
    }
    
    // Check if a forced manual trigger was requested
    const forcedManualTrigger = localStorage.getItem('splash-forced-manual') === 'true';
    if (forcedManualTrigger) {
      console.log('🎬 Forced manual trigger detected');
      localStorage.removeItem('splash-forced-manual');
      setIsManuallyTriggered(true);
      setShowSplash(true);
      return;
    }
    
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
  }, [isManuallyTriggered]);

  const dismissSplash = () => {
    console.log('🎬 Splash screen dismissed');
    setShowSplash(false);
    setIsManuallyTriggered(false);
  };

  const showSplashManually = (forceShow = true) => {
    console.log('🎬 Showing splash screen manually - forceShow:', forceShow);
    
    // Set flags to indicate this is a manual trigger 
    localStorage.setItem('splash-manual-trigger', 'true');
    
    // Clear the automatic session flag to ensure it shows on next trigger
    // This makes the splash screen appear again even if it was already shown in this session
    sessionStorage.removeItem('splash-shown');
    
    // Set the forced flag if we want to show regardless of session state
    if (forceShow) {
      localStorage.setItem('splash-forced-manual', 'true');
      setIsManuallyTriggered(true);
    }
    
    setShowSplash(true);
  };

  return {
    showSplash,
    dismissSplash,
    showSplashManually
  };
};
