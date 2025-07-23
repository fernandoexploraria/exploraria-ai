import React, { useState, useEffect } from 'react';
import { X, Lightbulb, Sparkles } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';

interface SmartTooltipProps {
  id: string;
  children: React.ReactNode;
  content: string;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'auto';
  delay?: number;
  icon?: 'lightbulb' | 'sparkles';
  priority?: 'low' | 'medium' | 'high';
}

export const SmartTooltip: React.FC<SmartTooltipProps> = ({
  id,
  children,
  content,
  title,
  position = 'top',
  trigger = 'auto',
  delay = 1000,
  icon = 'lightbulb',
  priority = 'medium'
}) => {
  const { shouldShowFeature, dismissHint } = useOnboarding();
  const [isVisible, setIsVisible] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  const shouldShow = shouldShowFeature(id);
  
  useEffect(() => {
    if (!shouldShow || hasShown) return;

    if (trigger === 'auto') {
      const timer = setTimeout(() => {
        setIsVisible(true);
        setHasShown(true);
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [shouldShow, trigger, delay, hasShown]);

  const handleDismiss = () => {
    setIsVisible(false);
    dismissHint(id);
  };

  const handleTrigger = () => {
    if (trigger === 'click' || trigger === 'hover') {
      setIsVisible(!isVisible);
    }
  };

  if (!shouldShow) {
    return <>{children}</>;
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const getPriorityClasses = () => {
    switch (priority) {
      case 'high':
        return 'border-primary bg-primary/5 shadow-lg';
      case 'medium':
        return 'border-secondary bg-secondary/5 shadow-md';
      case 'low':
        return 'border-muted bg-muted/5 shadow-sm';
      default:
        return 'border-secondary bg-secondary/5 shadow-md';
    }
  };

  const IconComponent = icon === 'sparkles' ? Sparkles : Lightbulb;

  return (
    <div className="relative inline-block">
      <div
        onClick={handleTrigger}
        onMouseEnter={() => trigger === 'hover' && setIsVisible(true)}
        onMouseLeave={() => trigger === 'hover' && setIsVisible(false)}
      >
        {children}
      </div>
      
      {isVisible && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 z-40 md:hidden"
            onClick={handleDismiss}
          />
          
          {/* Tooltip */}
          <div className={`
            absolute z-50 max-w-xs p-3 rounded-lg border
            ${getPositionClasses()}
            ${getPriorityClasses()}
            animate-fade-in
          `}>
            <div className="flex items-start gap-2">
              <IconComponent className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {title && (
                  <h4 className="font-medium text-sm text-foreground mb-1">
                    {title}
                  </h4>
                )}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {content}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 hover:bg-background/50 rounded transition-colors"
                aria-label="Dismiss tip"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
            
            {/* Arrow */}
            <div className={`
              absolute w-2 h-2 border border-r-0 border-b-0 transform rotate-45
              ${getPriorityClasses()}
              ${position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2' : ''}
              ${position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2' : ''}
              ${position === 'left' ? 'left-full top-1/2 -translate-x-1/2 -translate-y-1/2' : ''}
              ${position === 'right' ? 'right-full top-1/2 translate-x-1/2 -translate-y-1/2' : ''}
            `} />
          </div>
        </>
      )}
    </div>
  );
};