import { useState, useEffect } from 'react';

export const useOnboardingControl = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if onboarding has been completed
    const onboardingCompleted = localStorage.getItem('onboarding-completed');
    
    console.log('🎯 Onboarding check:', {
      onboardingCompleted,
      localStorage: Object.keys(localStorage)
    });
    
    // Show onboarding if it hasn't been completed yet
    if (!onboardingCompleted) {
      console.log('🎯 Showing onboarding - not completed yet');
      setShowOnboarding(true);
    } else {
      console.log('🎯 Skipping onboarding - already completed');
      setShowOnboarding(false);
    }
    
    // Mark that user has visited (for future reference)
    localStorage.setItem('has-visited', 'true');
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