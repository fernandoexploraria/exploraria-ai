
import { useState, useEffect } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector or element ID
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'none';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Exploraria!',
    description: 'Let\'s take a quick tour to show you how to explore the world like never before.',
    target: 'body',
    position: 'bottom'
  },
  {
    id: 'search',
    title: 'Search Destinations',
    description: 'Use this search to find landmarks and destinations around the world. Try searching for "Eiffel Tower" or press Cmd+K.',
    target: '[data-onboarding="search"]',
    position: 'bottom'
  },
  {
    id: 'plan-tour',
    title: 'Plan AI Tours',
    description: 'Click here to generate personalized tours using AI. Just tell us where you want to go!',
    target: '[data-onboarding="plan-tour"]',
    position: 'right'
  },
  {
    id: 'map-interaction',
    title: 'Interactive Map',
    description: 'Explore the interactive map. Click on landmarks to learn more or zoom in to see details.',
    target: '[data-onboarding="map"]',
    position: 'top'
  },
  {
    id: 'user-features',
    title: 'Sign In for More',
    description: 'Sign in to unlock premium features like voice search, travel logs, and unlimited tours.',
    target: '[data-onboarding="user-controls"]',
    position: 'left'
  }
];

export const useOnboarding = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem('onboarding-completed');
    const hasSeenSplash = localStorage.getItem('splash-seen');
    
    if (!hasCompletedOnboarding && hasSeenSplash) {
      // Auto-start onboarding for first-time users after splash
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const startOnboarding = () => {
    setCurrentStep(0);
    setIsActive(true);
    setIsCompleted(false);
  };

  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = () => {
    setIsActive(false);
    setIsCompleted(true);
    localStorage.setItem('onboarding-completed', 'true');
  };

  const completeOnboarding = () => {
    setIsActive(false);
    setIsCompleted(true);
    localStorage.setItem('onboarding-completed', 'true');
  };

  return {
    isActive,
    currentStep,
    currentStepData: ONBOARDING_STEPS[currentStep],
    totalSteps: ONBOARDING_STEPS.length,
    isCompleted,
    startOnboarding,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding
  };
};
