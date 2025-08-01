import React from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { LocationButtonMode } from '@/hooks/useLocationButton';

interface LocationButtonProps {
  mode: LocationButtonMode;
  onToggle: () => void;
  className?: string;
}

export const LocationButton: React.FC<LocationButtonProps> = ({
  mode,
  onToggle,
  className = ''
}) => {
  const getButtonStyles = () => {
    const baseStyles = "w-10 h-10 rounded-lg border border-gray-300 bg-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center";
    
    switch (mode) {
      case 'off':
        return `${baseStyles} text-gray-600 hover:text-gray-800`;
      case 'centered':
        return `${baseStyles} text-blue-600 bg-blue-50 border-blue-300`;
      case 'tracking':
        return `${baseStyles} text-blue-600 bg-white border-blue-300`;
      default:
        return baseStyles;
    }
  };

  const getIcon = () => {
    switch (mode) {
      case 'off':
        return <MapPin size={20} />;
      case 'centered':
        return <Navigation size={20} fill="currentColor" />;
      case 'tracking':
        return <Navigation size={20} />;
      default:
        return <MapPin size={20} />;
    }
  };

  return (
    <button
      onClick={onToggle}
      className={`${getButtonStyles()} ${className}`}
      title={
        mode === 'off' 
          ? 'Show my location' 
          : mode === 'centered' 
          ? 'Stop following (keep showing location)' 
          : 'Turn off location'
      }
      type="button"
    >
      {getIcon()}
    </button>
  );
};