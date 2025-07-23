import React, { useState, useEffect } from 'react';
import { X, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { useOnboarding } from '../../contexts/OnboardingContext';

interface FeatureIntroductionProps {
  id: string;
  title: string;
  description: string;
  visual?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  autoShow?: boolean;
  showProgress?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export const FeatureIntroduction: React.FC<FeatureIntroductionProps> = ({
  id,
  title,
  description,
  visual,
  actionText = "Got it",
  onAction,
  autoShow = true,
  showProgress = false,
  priority = 'medium'
}) => {
  const { shouldShowFeature, dismissHint, completeFeature, getTierProgress } = useOnboarding();
  const [isVisible, setIsVisible] = useState(false);

  const shouldShow = shouldShowFeature(id);

  useEffect(() => {
    if (autoShow && shouldShow) {
      // Small delay to ensure smooth animation
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [autoShow, shouldShow]);

  const handleDismiss = () => {
    setIsVisible(false);
    dismissHint(id);
  };

  const handleAction = () => {
    setIsVisible(false);
    completeFeature(id);
    if (onAction) {
      onAction();
    }
  };

  if (!shouldShow || !isVisible) {
    return null;
  }

  const getPriorityClasses = () => {
    switch (priority) {
      case 'high':
        return 'border-primary bg-primary/5';
      case 'medium':
        return 'border-secondary bg-background';
      case 'low':
        return 'border-muted bg-muted/5';
      default:
        return 'border-secondary bg-background';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 animate-fade-in" />
      
      {/* Feature Introduction Modal */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md md:w-full z-50">
        <div className={`
          rounded-xl border shadow-xl p-6 
          ${getPriorityClasses()}
          animate-scale-in
        `}>
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {title}
              </h3>
              {showProgress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span>Step {getTierProgress() + 1} of 6</span>
                </div>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-muted rounded transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Visual */}
          {visual && (
            <div className="mb-4 rounded-lg overflow-hidden bg-muted/20 p-4 text-center">
              {visual}
            </div>
          )}

          {/* Description */}
          <p className="text-muted-foreground mb-6 leading-relaxed">
            {description}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-muted-foreground"
            >
              Skip for now
            </Button>
            
            <Button
              onClick={handleAction}
              size="sm"
              className="flex items-center gap-2"
            >
              {actionText}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};