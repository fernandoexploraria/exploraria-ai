
import React from 'react';
import { Button } from '@/components/ui/button';
import { Route, Loader2 } from 'lucide-react';
import { useOptimalRoute } from '@/hooks/useOptimalRoute';
import { useToast } from '@/hooks/use-toast';

interface OptimalRouteButtonProps {
  onRouteCalculated?: (route: any) => void;
}

const OptimalRouteButton: React.FC<OptimalRouteButtonProps> = ({ onRouteCalculated }) => {
  const { calculateOptimalRoute, isLoading, error, hasUserLocation, hasTourLandmarks } = useOptimalRoute();
  const { toast } = useToast();

  const handleOptimalRoute = async () => {
    if (!hasUserLocation) {
      toast({
        title: "Location Required",
        description: "Please enable location services to calculate optimal route",
        variant: "destructive",
      });
      return;
    }

    if (!hasTourLandmarks) {
      toast({
        title: "No Tour Available",
        description: "No tour landmarks available for route optimization",
        variant: "destructive",
      });
      return;
    }

    const route = await calculateOptimalRoute();
    
    if (route) {
      toast({
        title: "Optimal Route Calculated",
        description: `${Math.round(route.distance / 1000 * 10) / 10} km route in ${Math.round(route.duration / 60)} minutes`,
      });
      
      // Use the global showRouteOnMap function to display the route
      if (typeof window !== 'undefined' && (window as any).showRouteOnMap) {
        (window as any).showRouteOnMap(route, { name: 'Optimal Tour Route' });
      }
      
      onRouteCalculated?.(route);
    } else if (error) {
      toast({
        title: "Route Calculation Failed",
        description: error,
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      onClick={handleOptimalRoute}
      disabled={isLoading || !hasUserLocation || !hasTourLandmarks}
      variant="outline"
      size="sm"
      className="bg-white/90 hover:bg-white border-gray-200 text-gray-700 hover:text-gray-900 shadow-sm"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Route className="h-4 w-4 mr-2" />
      )}
      Optimize Route
    </Button>
  );
};

export default OptimalRouteButton;
