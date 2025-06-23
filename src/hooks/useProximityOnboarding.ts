
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

const ONBOARDING_STORAGE_KEY = 'proximity-onboarding-completed';

export const useProximityOnboarding = () => {
  const { user } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  // Load onboarding state from localStorage
  useEffect(() => {
    if (!user) {
      setHasCompletedOnboarding(false);
      return;
    }

    const storageKey = `${ONBOARDING_STORAGE_KEY}-${user.id}`;
    const completed = localStorage.getItem(storageKey) === 'true';
    setHasCompletedOnboarding(completed);
  }, [user]);

  const markOnboardingComplete = () => {
    if (!user) return;

    const storageKey = `${ONBOARDING_STORAGE_KEY}-${user.id}`;
    localStorage.setItem(storageKey, 'true');
    setHasCompletedOnboarding(true);
    setIsOnboardingOpen(false);
  };

  const showOnboarding = () => {
    if (hasCompletedOnboarding) return false;
    setIsOnboardingOpen(true);
    return true;
  };

  const hideOnboarding = () => {
    setIsOnboardingOpen(false);
  };

  return {
    hasCompletedOnboarding,
    isOnboardingOpen,
    showOnboarding,
    hideOnboarding,
    markOnboardingComplete,
  };
};
