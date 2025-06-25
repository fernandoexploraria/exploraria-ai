
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

interface StreetViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  streetViewData: StreetViewData;
}

const StreetViewModal: React.FC<StreetViewModalProps> = ({
  isOpen,
  onClose,
  streetViewData
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full h-full max-w-6xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
          <div className="flex items-center justify-between text-white">
            <div>
              <h2 className="text-xl font-bold">{streetViewData.landmarkName}</h2>
              <p className="text-sm opacity-90">
                Street View • {streetViewData.location.lat.toFixed(6)}, {streetViewData.location.lng.toFixed(6)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Street View Image */}
        <div className="w-full h-full">
          <img
            src={streetViewData.imageUrl}
            alt={`Street View of ${streetViewData.landmarkName}`}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Footer with metadata */}
        {streetViewData.metadata.copyright && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <p className="text-white text-xs opacity-75">
              {streetViewData.metadata.copyright}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreetViewModal;
