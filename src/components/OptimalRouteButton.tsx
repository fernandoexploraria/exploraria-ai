import React from 'react';
import { useOptimalRoute } from '@/hooks/useOptimalRoute';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Route } from 'lucide-react';

const OptimalRouteButton: React.FC = () => {
  const { 
    isLoading, 
    error, 
    displayOptimalRoute, 
    hasUserLocation, 
    hasTourLandmarks 
  } = useOptimalRoute();
  
  const { toast } = useToast();

  const handleOptimalRoute = async () => {
    if (!hasUserLocation) {
      toast({
        title: "Location Required",
        description: "Please enable location access to calculate optimal route",
        variant: "destructive"
      });
      return;
    }

    if (!hasTourLandmarks) {
      toast({
        title: "No Tour Landmarks",
        description: "Generate a tour first to calculate optimal route",
        variant: "destructive"
      });
      return;
    }

    const route = await displayOptimalRoute();
    
    if (route) {
      toast({
        title: "Optimal Route Calculated",
        description: `${Math.round(route.distance)}m route through all landmarks (${Math.round(route.duration / 60)} min walk)`,
      });
    } else if (error) {
      toast({
        title: "Route Calculation Failed",
        description: error,
        variant: "destructive"
      });
    }
  };

  return (
    <Button
      onClick={handleOptimalRoute}
      disabled={isLoading || !hasUserLocation || !hasTourLandmarks}
      variant="outline"
      size="sm"
      className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border-border/50 hover:bg-accent/50"
    >
      <Route className="w-4 h-4" />
      {isLoading ? 'Calculating...' : 'Optimal Route'}
    </Button>
  );
};

export default OptimalRouteButton;