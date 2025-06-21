
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, X, HelpCircle } from 'lucide-react';
import { OnboardingStep } from '@/hooks/useOnboarding';

interface OnboardingOverlayProps {
  isActive: boolean;
  currentStep: number;
  currentStepData: OnboardingStep | null;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({
  isActive,
  currentStep,
  currentStepData,
  totalSteps,
  onNext,
  onPrev,
  onSkip
}) => {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [highlightPosition, setHighlightPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    if (!isActive || !currentStepData) return;

    const updatePositions = () => {
      const targetElement = document.querySelector(currentStepData.target);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        
        // Set highlight position
        setHighlightPosition({
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16
        });

        // Calculate tooltip position based on step position
        let tooltipTop = rect.top;
        let tooltipLeft = rect.left;

        switch (currentStepData.position) {
          case 'bottom':
            tooltipTop = rect.bottom + 16;
            tooltipLeft = rect.left;
            break;
          case 'top':
            tooltipTop = rect.top - 200;
            tooltipLeft = rect.left;
            break;
          case 'right':
            tooltipTop = rect.top;
            tooltipLeft = rect.right + 16;
            break;
          case 'left':
            tooltipTop = rect.top;
            tooltipLeft = rect.left - 320;
            break;
        }

        // Ensure tooltip stays within viewport
        tooltipTop = Math.max(16, Math.min(tooltipTop, window.innerHeight - 200));
        tooltipLeft = Math.max(16, Math.min(tooltipLeft, window.innerWidth - 320));

        setTooltipPosition({ top: tooltipTop, left: tooltipLeft });
      }
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions);

    return () => {
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions);
    };
  }, [isActive, currentStepData]);

  if (!isActive || !currentStepData) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={onSkip} />
      
      {/* Highlight */}
      <div
        className="absolute bg-white/10 border-2 border-yellow-400 rounded-lg pointer-events-none animate-pulse"
        style={{
          top: highlightPosition.top,
          left: highlightPosition.left,
          width: highlightPosition.width,
          height: highlightPosition.height,
        }}
      />
      
      {/* Tooltip */}
      <Card
        className="absolute w-80 pointer-events-auto shadow-xl"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-4">
            {currentStepData.description}
          </p>
          
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrev}
              disabled={currentStep === 0}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-3 w-3" />
              Back
            </Button>
            
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i === currentStep ? 'bg-yellow-400' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            
            <Button
              size="sm"
              onClick={onNext}
              className="flex items-center gap-1"
            >
              {currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
              {currentStep !== totalSteps - 1 && <ChevronRight className="h-3 w-3" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingOverlay;
