import React from 'react';
import { Car, PersonStanding, Bike, Bus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type TravelMode = 'WALK' | 'BICYCLE' | 'DRIVE' | 'TRANSIT';

interface TravelModeSelectorProps {
  selectedMode: TravelMode | null;
  onSelectMode: (mode: TravelMode) => void;
  onCancel: () => void;
}

const TravelModeSelector: React.FC<TravelModeSelectorProps> = ({
  selectedMode,
  onSelectMode,
  onCancel
}) => {
  const modes = [
    { 
      id: 'WALK' as TravelMode, 
      icon: PersonStanding, 
      label: 'Walk',
      color: 'text-green-600',
      bgColor: 'bg-green-100 hover:bg-green-200',
      activeBg: 'bg-green-600'
    },
    { 
      id: 'BICYCLE' as TravelMode, 
      icon: Bike, 
      label: 'Bike',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 hover:bg-blue-200',
      activeBg: 'bg-blue-600'
    },
    { 
      id: 'DRIVE' as TravelMode, 
      icon: Car, 
      label: 'Drive',
      color: 'text-red-600',
      bgColor: 'bg-red-100 hover:bg-red-200',
      activeBg: 'bg-red-600'
    },
    { 
      id: 'TRANSIT' as TravelMode, 
      icon: Bus, 
      label: 'Transit',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 hover:bg-purple-200',
      activeBg: 'bg-purple-600'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 text-center">
          Select Travel Mode
        </h3>
        
        <div className="grid grid-cols-2 gap-3 mb-6">
          {modes.map((mode) => {
            const isActive = selectedMode === mode.id;
            const IconComponent = mode.icon;

            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id)}
                className={`
                  flex flex-col items-center justify-center 
                  p-4 rounded-lg border-2 transition-all duration-200
                  ${isActive 
                    ? `${mode.activeBg} text-white border-transparent` 
                    : `${mode.bgColor} ${mode.color} border-border hover:border-primary/20`
                  }
                `}
                aria-label={`Select ${mode.label} route`}
                aria-pressed={isActive}
              >
                <IconComponent size={32} className="mb-2" />
                <span className="text-sm font-medium">{mode.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
          {selectedMode && (
            <Button
              onClick={() => {
                // Mode is already selected, this will trigger route calculation
                onSelectMode(selectedMode);
              }}
              className="flex-1"
            >
              Calculate Route
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TravelModeSelector;