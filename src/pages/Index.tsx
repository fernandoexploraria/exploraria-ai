
import React, { useState, useEffect } from 'react';
import Map from '@/components/Map';
import { useTourPlanner } from '@/hooks/useTourPlanner';
import IntelligentTourDialog from '@/components/IntelligentTourDialog';
import TourPlannerDialog from '@/components/TourPlannerDialog';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from '@/hooks/useRouter';
import { Button } from "@/components/ui/button"
import { ArrowRight } from 'lucide-react';

const Index = ({ onRegisterPostAuthActions }: { onRegisterPostAuthActions: (actions: any) => void }) => {
  const { 
    tourPlan,
    plannedLandmarks,
    isLoading,
    error,
    generateTour,
    progressState,
    destinationCoordinates, 
    destinationName, 
    setDestination
  } = useTourPlanner();
  const { user } = useAuth();
  const { navigate } = useRouter();

  const [showIntelligentTourDialog, setShowIntelligentTourDialog] = useState(false);
  const [showTourPlannerDialog, setShowTourPlannerDialog] = useState(false);

  useEffect(() => {
    onRegisterPostAuthActions({
      onSmartTour: () => setShowIntelligentTourDialog(true)
    });
  }, [onRegisterPostAuthActions]);

  const handleAuthRequired = (destination: string) => {
    console.log('Auth required, redirecting to sign-in...');
    navigate('/sign-in', { replace: true, state: { next: '/', destination } });
  };

  const handleDestinationSelected = (coordinates: [number, number], name: string) => {
    console.log('🗺️ Destination selected in Index:', coordinates, name);
    setDestination(coordinates, name);
  };

  const handleTourGenerated = (landmarks: any[]) => {
    console.log('🎯 Tour generated in Index:', landmarks.length, 'landmarks');
    // The landmarks are already handled by the tour planner hook
    // This is just for any additional UI updates if needed
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 relative">
        <Map 
          destinationCoordinates={destinationCoordinates}
          destinationName={destinationName}
        />
        
        <div className="absolute top-4 left-4 z-10">
          <Button onClick={() => setShowIntelligentTourDialog(true)}>
            ✨ Generate Smart Tour
          </Button>
        </div>
        
        <div className="absolute top-4 right-4 z-10">
          {user ? (
            <Button onClick={() => navigate('/chat')}>
              Go to Chat <ArrowRight className="ml-2" />
            </Button>
          ) : (
            <Button onClick={() => handleAuthRequired(destinationName || 'your destination')}>
              Go to Chat <ArrowRight className="ml-2" />
            </Button>
          )}
        </div>
        
        <IntelligentTourDialog
          open={showIntelligentTourDialog}
          onOpenChange={setShowIntelligentTourDialog}
          onTourGenerated={handleTourGenerated}
          onAuthRequired={() => handleAuthRequired(destinationName || 'your destination')}
          onDestinationSelected={handleDestinationSelected}
        />
        
        <TourPlannerDialog
          open={showTourPlannerDialog}
          onOpenChange={setShowTourPlannerDialog}
          onGenerateTour={generateTour}
          onAuthRequired={handleAuthRequired}
          isLoading={isLoading}
          progressState={progressState}
        />
      </div>
    </div>
  );
};

export default Index;
