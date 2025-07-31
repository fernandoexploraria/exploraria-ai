import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Compass, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  Navigation,
  Globe,
  Smartphone
} from 'lucide-react';
import { useNativePermissions } from '@/hooks/useNativePermissions';
import { useToast } from '@/hooks/use-toast';

interface NativePermissionDialogProps {
  isOpen: boolean;
  onComplete: (hasRequiredPermissions: boolean) => void;
}

export const NativePermissionDialog: React.FC<NativePermissionDialogProps> = ({
  isOpen,
  onComplete,
}) => {
  const { 
    permissionState, 
    requestAllPermissions, 
    isNativeApp 
  } = useNativePermissions();
  
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<'welcome' | 'requesting' | 'results'>('welcome');
  const [requestResults, setRequestResults] = useState<{ location: boolean; orientation: boolean } | null>(null);

  // Don't show dialog if not a native app
  if (!isNativeApp) {
    return null;
  }

  const handleRequestPermissions = async () => {
    setCurrentStep('requesting');
    
    try {
      const results = await requestAllPermissions();
      setRequestResults(results);
      setCurrentStep('results');

      // Show success/failure toast
      if (results.location && results.orientation) {
        toast({
          title: "Permissions Granted",
          description: "All required permissions have been granted successfully.",
        });
      } else if (results.location) {
        toast({
          title: "Partial Success",
          description: "Location granted. Some features may be limited without orientation access.",
        });
      } else {
        toast({
          title: "Permissions Required",
          description: "Location access is required for core app functionality.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      toast({
        title: "Permission Error",
        description: "There was an error requesting permissions. Please try again.",
        variant: "destructive",
      });
      setCurrentStep('welcome');
    }
  };

  const handleComplete = () => {
    const hasRequiredPermissions = requestResults?.location || false;
    onComplete(hasRequiredPermissions);
  };

  const handleSkipForNow = () => {
    toast({
      title: "Limited Functionality",
      description: "You can enable permissions later in app settings.",
      variant: "destructive",
    });
    onComplete(false);
  };

  const renderWelcomeStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Globe className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Welcome to Exploraria</h2>
          <p className="text-muted-foreground mt-2">
            To provide you with the best travel discovery experience, we need access to a couple of device features.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Precise Location</h3>
              <p className="text-sm text-muted-foreground">
                Find nearby landmarks, get directions, and receive proximity alerts
              </p>
            </div>
            <Badge variant="secondary">Required</Badge>
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Compass className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Device Orientation</h3>
              <p className="text-sm text-muted-foreground">
                Enhance navigation with compass directions and augmented reality features
              </p>
            </div>
            <Badge variant="outline">Recommended</Badge>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Your Privacy Matters</p>
            <p>
              Location data is only used to enhance your travel experience and is never shared with third parties. 
              You can revoke these permissions at any time in your device settings.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={handleRequestPermissions} className="w-full">
          <Navigation className="h-4 w-4 mr-2" />
          Grant Permissions
        </Button>
        <Button variant="ghost" onClick={handleSkipForNow} className="w-full">
          Skip for Now
        </Button>
      </div>
    </div>
  );

  const renderRequestingStep = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Requesting Permissions</h2>
        <p className="text-muted-foreground mt-2">
          Please respond to the system prompts to grant the required permissions.
        </p>
      </div>
      <div className="space-y-3">
        <div className="border rounded-lg p-3 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-sm">Requesting location access...</span>
        </div>
        <div className="border rounded-lg p-3 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-green-600" />
          <span className="text-sm">Requesting orientation access...</span>
        </div>
      </div>
    </div>
  );

  const renderResultsStep = () => {
    if (!requestResults) return null;

    const { location, orientation } = requestResults;
    const allGranted = location && orientation;
    const hasRequired = location;

    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
            allGranted ? 'bg-green-100' : hasRequired ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            {allGranted ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <AlertTriangle className={`h-8 w-8 ${hasRequired ? 'text-yellow-600' : 'text-red-600'}`} />
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              {allGranted ? 'All Set!' : hasRequired ? 'Partially Configured' : 'Permissions Needed'}
            </h2>
            <p className="text-muted-foreground mt-2">
              {allGranted ? 
                'All permissions have been granted. You can now enjoy the full Exploraria experience.' :
                hasRequired ?
                'Location access granted. Some features may be limited without orientation access.' :
                'Location access is required for core app functionality. You can try again or continue with limited features.'
              }
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className={`border rounded-lg p-3 flex items-center gap-3 ${
            location ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}>
            {location ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <div className="flex-1">
              <span className="text-sm font-medium">Location Access</span>
              <p className="text-xs text-muted-foreground">
                {location ? 'Granted' : 'Denied - Required for core features'}
              </p>
            </div>
          </div>

          <div className={`border rounded-lg p-3 flex items-center gap-3 ${
            orientation ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
          }`}>
            {orientation ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            )}
            <div className="flex-1">
              <span className="text-sm font-medium">Orientation Access</span>
              <p className="text-xs text-muted-foreground">
                {orientation ? 'Granted' : 'Not available - Some features limited'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={handleComplete} className="w-full">
            {allGranted ? 'Continue to App' : hasRequired ? 'Continue with Limited Features' : 'Continue Anyway'}
          </Button>
          {!hasRequired && (
            <Button variant="outline" onClick={() => setCurrentStep('welcome')} className="w-full">
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {currentStep === 'welcome' ? 'App Permissions' : 
             currentStep === 'requesting' ? 'Requesting Permissions' : 'Permission Results'}
          </DialogTitle>
        </DialogHeader>
        
        {currentStep === 'welcome' && renderWelcomeStep()}
        {currentStep === 'requesting' && renderRequestingStep()}
        {currentStep === 'results' && renderResultsStep()}
      </DialogContent>
    </Dialog>
  );
};