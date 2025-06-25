
import React from 'react';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';

interface StreetViewData {
  imageUrl: string;
  heading: number;
  pitch: number;
  fov: number;
  location: {
    lat: number;
    lng: number;
  };
  landmarkName: string;
  metadata: {
    status: string;
    copyright?: string;
  };
}

interface StreetViewCompassProps {
  viewpoints: StreetViewData[];
  currentViewpoint: number;
  onViewpointChange: (index: number) => void;
  className?: string;
}

const getCompassDirection = (heading: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(heading / 45) % 8;
  return directions[index];
};

const StreetViewCompass: React.FC<StreetViewCompassProps> = ({
  viewpoints,
  currentViewpoint,
  onViewpointChange,
  className = ""
}) => {
  if (viewpoints.length <= 1) return null;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative">
        {/* Compass background */}
        <div className="w-20 h-20 rounded-full border-2 border-white/30 bg-black/20 backdrop-blur-sm flex items-center justify-center">
          <Navigation className="w-6 h-6 text-white/60" />
        </div>
        
        {/* Viewpoint indicators */}
        {viewpoints.map((viewpoint, index) => {
          const angle = (viewpoint.heading - 90) * (Math.PI / 180); // Offset by 90° to put 0° at top
          const radius = 35;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          
          const isActive = index === currentViewpoint;
          
          return (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className={`absolute w-6 h-6 p-0 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
                isActive
                  ? 'bg-blue-500 text-white scale-125 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30 hover:scale-110'
              }`}
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
              }}
              onClick={() => onViewpointChange(index)}
              title={`${getCompassDirection(viewpoint.heading)} (${viewpoint.heading}°)`}
            >
              <span className="text-xs font-medium">
                {getCompassDirection(viewpoint.heading)}
              </span>
            </Button>
          );
        })}
        
        {/* Current heading indicator */}
        {viewpoints[currentViewpoint] && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full mt-2">
            <div className="bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
              {viewpoints[currentViewpoint].heading}° {getCompassDirection(viewpoints[currentViewpoint].heading)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreetViewCompass;
