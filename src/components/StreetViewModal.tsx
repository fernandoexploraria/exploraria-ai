
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EnhancedStreetViewModal from './EnhancedStreetViewModal';

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
  onLocationSelect?: (coordinates: [number, number]) => void;
}

// Legacy component - wraps EnhancedStreetViewModal for backward compatibility
const StreetViewModal: React.FC<StreetViewModalProps> = ({
  isOpen,
  onClose,
  streetViewData,
  onLocationSelect
}) => {
  // Convert single street view data to enhanced format
  const streetViewItems = [{
    landmark: {
      id: 'legacy-single',
      name: streetViewData.landmarkName,
      coordinates: [streetViewData.location.lng, streetViewData.location.lat] as [number, number],
      description: `Street View for ${streetViewData.landmarkName}`
    },
    streetViewData
  }];

  return (
    <EnhancedStreetViewModal
      isOpen={isOpen}
      onClose={onClose}
      streetViewItems={streetViewItems}
      initialIndex={0}
      onLocationSelect={onLocationSelect}
    />
  );
};

export default StreetViewModal;
