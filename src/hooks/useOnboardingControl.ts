import { useState, useEffect } from 'react';

export const useOnboardingControl = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if onboarding has been completed
    const onboardingCompleted = localStorage.getItem('onboarding-completed');
    
    // Show onboarding if it hasn't been completed yet
    if (!onboardingCompleted) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
    
    // Mark that user has visited (for future reference)
    localStorage.setItem('has-visited', 'true');
  }, []);

  const completeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('onboarding-completed', 'true');
  };

  const skipOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('onboarding-completed', 'true');
  };

  const showOnboardingManually = () => {
    setShowOnboarding(true);
  };

  return {
    showOnboarding,
    completeOnboarding,
    skipOnboarding,
    showOnboardingManually
  };
};