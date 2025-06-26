
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, MapPin, Sparkles, CheckCircle, AlertCircle, Target, Zap, Shield } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ProgressState } from '@/hooks/useTourPlanner';

interface TourPlannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateTour: (destination: string) => Promise<void>;
  onAuthRequired: (destination: string) => void;
  isLoading: boolean;
  progressState?: ProgressState;
}

const TourPlannerDialog: React.FC<TourPlannerDialogProps> = ({ 
  open, 
  onOpenChange, 
  onGenerateTour, 
  onAuthRequired,
  isLoading,
  progressState 
}) => {
  const [destination, setDestination] = useState('');
  const { user } = useAuth();

  const handleGenerate = async () => {
    if (!destination) return;
    
    if (!user) {
      onAuthRequired(destination);
      onOpenChange(false);
      return;
    }

    await onGenerateTour(destination);
    if (progressState?.phase === 'complete') {
      onOpenChange(false);
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'generating':
        return <Sparkles className="h-4 w-4 text-blue-500" />;
      case 'refining':
        return <Target className="h-4 w-4 text-orange-500" />;
      case 'validating':
        return <Shield className="h-4 w-4 text-green-500" />;
      case 'finalizing':
        return <Zap className="h-4 w-4 text-purple-500" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getPhaseDescription = (phase: string) => {
    switch (phase) {
      case 'generating':
        return 'AI is analyzing your destination and selecting landmarks';
      case 'refining':
        return 'Refining coordinates using Google Places API';
      case 'validating':
        return 'Validating location accuracy and quality';
      case 'finalizing':
        return 'Preparing your personalized tour experience';
      case 'complete':
        return 'Your enhanced tour is ready!';
      case 'error':
        return 'Something went wrong during generation';
      default:
        return 'Processing your request...';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Enhanced AI Tour Planner
          </DialogTitle>
          <DialogDescription>
            Enter a destination, and we'll create a comprehensive tour with precisely located landmarks using our enhanced coordinate system powered by Google Places API and Gemini AI.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="destination" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Destination (e.g., "Rome", "Tokyo", "Paris")
            </Label>
            <Input
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Enter a city or region"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              disabled={isLoading}
            />
          </div>
          
          {isLoading && progressState && (
            <div className="space-y-3 bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {getPhaseIcon(progressState.phase)}
                <span className="font-medium text-sm text-blue-900">
                  {progressState.currentStep || getPhaseDescription(progressState.phase)}
                </span>
              </div>
              
              <Progress value={progressState.percentage} className="h-2" />
              
              <div className="text-xs text-blue-800 space-y-1">
                {progressState.totalLandmarks > 0 && (
                  <div>
                    Processed {progressState.processedLandmarks} of {progressState.totalLandmarks} landmarks
                  </div>
                )}
                
                {progressState.qualityMetrics && (
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-800">
                      ✓ {progressState.qualityMetrics.highConfidence} high-quality
                    </span>
                    <span className="text-amber-700">
                      ~ {progressState.qualityMetrics.mediumConfidence} medium
                    </span>
                    <span className="text-red-700">
                      ! {progressState.qualityMetrics.lowConfidence} low
                    </span>
                  </div>
                )}
                
                {progressState.errors.length > 0 && (
                  <div className="text-red-800">
                    {progressState.errors.map((error, index) => (
                      <div key={index} className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={isLoading || !destination || progressState?.phase === 'error'}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!user ? 'Sign In to Generate Tour' : 'Generate Enhanced Tour'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TourPlannerDialog;
