import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle, Star, MapPin } from 'lucide-react';

interface OnboardingCelebrationProps {
  title: string;
  message: string;
  icon?: 'sparkles' | 'check' | 'star' | 'map';
  duration?: number;
  onComplete?: () => void;
}

export const OnboardingCelebration: React.FC<OnboardingCelebrationProps> = ({
  title,
  message,
  icon = 'sparkles',
  duration = 3000,
  onComplete
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) {
        onComplete();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  const getIcon = () => {
    switch (icon) {
      case 'check':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'star':
        return <Star className="h-8 w-8 text-yellow-500" />;
      case 'map':
        return <MapPin className="h-8 w-8 text-blue-500" />;
      default:
        return <Sparkles className="h-8 w-8 text-primary" />;
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className="bg-background border border-primary/20 rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 animate-pulse">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground text-sm mb-1">
              {title}
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};