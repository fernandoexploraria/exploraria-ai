import React, { useState } from 'react';
import { Clock, MapPin, Route, ChevronDown, ChevronUp, Bus, PersonStanding, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface TransitStep {
  instruction: string;
  mode: 'WALK' | 'TRANSIT';
  duration: string;
  distance: string;
  transitDetails?: {
    line: string;
    vehicle: string;
    stops: number;
    departureStop: string;
    arrivalStop: string;
  };
}

interface RouteDetails {
  duration: string;
  distance: string;
  steps: TransitStep[];
  summary: string;
}

interface FloatingRouteCardProps {
  routeDetails: RouteDetails;
  onClose: () => void;
}

const FloatingRouteCard: React.FC<FloatingRouteCardProps> = ({
  routeDetails,
  onClose
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count transfers (transit steps - 1)
  const transitSteps = routeDetails.steps.filter(step => step.mode === 'TRANSIT');
  const transferCount = Math.max(0, transitSteps.length - 1);

  const getStepIcon = (step: TransitStep) => {
    if (step.mode === 'WALK') {
      return <PersonStanding className="h-4 w-4 text-blue-600" />;
    }
    return <Bus className="h-4 w-4 text-purple-600" />;
  };

  const formatDuration = (duration: string) => {
    // Convert from "123s" format to readable format
    if (duration.endsWith('s')) {
      const seconds = parseInt(duration.replace('s', ''));
      const minutes = Math.round(seconds / 60);
      return minutes > 60 
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${minutes}m`;
    }
    return duration;
  };

  return (
    <Card className="fixed top-4 right-4 w-80 max-w-[calc(100vw-2rem)] bg-background/95 backdrop-blur-sm border shadow-lg z-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-sm">Transit Route</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="text-xs">Time</span>
            </div>
            <div className="font-semibold">{routeDetails.duration}</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="text-xs">Distance</span>
            </div>
            <div className="font-semibold">{routeDetails.distance}</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Bus className="h-3 w-3" />
              <span className="text-xs">Transfers</span>
            </div>
            <div className="font-semibold">{transferCount}</div>
          </div>
        </div>

        {/* Summary */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          {routeDetails.summary}
        </div>

        {/* Expand/Collapse Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full h-8"
        >
          <span className="text-xs">
            {isExpanded ? 'Hide Details' : 'View Directions'}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3 w-3 ml-1" />
          ) : (
            <ChevronDown className="h-3 w-3 ml-1" />
          )}
        </Button>

        {/* Detailed Steps */}
        {isExpanded && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            <Separator />
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Step-by-Step Directions
            </div>
            
            {routeDetails.steps.map((step, index) => (
              <div key={index} className="flex gap-3 text-xs">
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(step)}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="text-foreground">{step.instruction}</div>
                  
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{formatDuration(step.duration)}</span>
                    <span>•</span>
                    <span>{step.distance}</span>
                    
                    {step.transitDetails && (
                      <>
                        <span>•</span>
                        <Badge variant="secondary" className="text-xs px-1 py-0">
                          {step.transitDetails.line}
                        </Badge>
                      </>
                    )}
                  </div>
                  
                  {step.transitDetails && (
                    <div className="text-muted-foreground text-xs">
                      From {step.transitDetails.departureStop} to {step.transitDetails.arrivalStop}
                      {step.transitDetails.stops > 0 && (
                        <span> ({step.transitDetails.stops} stops)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FloatingRouteCard;