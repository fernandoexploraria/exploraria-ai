import { useState, useEffect } from 'react';

export const useOnboardingControl = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if onboarding has been completed
    const onboardingCompleted = localStorage.getItem('onboarding-completed');
    
    // Check if this is a first-time visitor
    const hasVisitedBefore = localStorage.getItem('has-visited');
    
    // Show onboarding if:
    // 1. First time visitor (no localStorage entry) AND onboarding not completed
    if (!hasVisitedBefore && !onboardingCompleted) {
      console.log('🎯 Showing onboarding - first time visitor');
      setShowOnboarding(true);
    } else {
      console.log('🎯 Skipping onboarding - returning user or completed');
      setShowOnboarding(false);
    }
  }, []);

  const completeOnboarding = () => {
    console.log('🎯 Onboarding completed');
    setShowOnboarding(false);
    localStorage.setItem('onboarding-completed', 'true');
  };

  const skipOnboarding = () => {
    console.log('🎯 Onboarding skipped');
    setShowOnboarding(false);
    localStorage.setItem('onboarding-completed', 'true');
  };

  return {
    showOnboarding,
    completeOnboarding,
    skipOnboarding
  };
};