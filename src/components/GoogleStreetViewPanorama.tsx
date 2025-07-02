
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoogleStreetViewPanoramaProps {
  isOpen: boolean;
  onClose: () => void;
  location: {
    lat: number;
    lng: number;
  };
  landmarkName: string;
  panoId?: string;
  isAvailable?: boolean;
}

const GoogleStreetViewPanorama: React.FC<GoogleStreetViewPanoramaProps> = ({
  isOpen,
  onClose,
  landmarkName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center">
      <div className="relative w-full h-full max-w-6xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-black/50 text-white p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Street View: {landmarkName}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <div className="text-center text-gray-600">
            <div className="text-6xl mb-4">🔄</div>
            <h3 className="text-xl font-semibold mb-2">Component Deprecated</h3>
            <p>This component has been replaced with the Simplified Street View Viewer.</p>
            <p className="text-sm mt-2">Please use the test panel in the bottom-left corner.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleStreetViewPanorama;
