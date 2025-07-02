
import React from 'react';
import { X, MapPin, Camera, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface PanoramaData {
  panoId: string;
  location: {
    lat: number;
    lng: number;
  };
  isAvailable: boolean;
  landmarkName: string;
  metadata: {
    status: string;
    copyright?: string;
  };
}

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

interface SimplifiedStreetViewViewerProps {
  isOpen: boolean;
  onClose: () => void;
  landmarkName: string;
  streetViewData?: StreetViewData | null;
  panoramaData?: PanoramaData | null;
  viewpoints?: StreetViewData[];
  isLoading?: boolean;
}

const SimplifiedStreetViewViewer: React.FC<SimplifiedStreetViewViewerProps> = ({
  isOpen,
  onClose,
  landmarkName,
  streetViewData,
  panoramaData,
  viewpoints = [],
  isLoading = false
}) => {
  if (!isOpen) return null;

  const hasStreetView = streetViewData !== null;
  const hasPanorama = panoramaData?.isAvailable === true;
  const hasMultipleViews = viewpoints.length > 1;
  const allImages = viewpoints.length > 0 ? viewpoints : (streetViewData ? [streetViewData] : []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
      <div className="relative w-full h-full max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">{landmarkName}</h2>
            <div className="flex gap-2">
              {hasStreetView && (
                <Badge variant="secondary" className="text-xs">
                  <Camera className="h-3 w-3 mr-1" />
                  Street View
                </Badge>
              )}
              {hasPanorama && (
                <Badge variant="default" className="text-xs">
                  360° Available
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading Street View data...</p>
              </div>
            </div>
          ) : !hasStreetView ? (
            <div className="flex items-center justify-center h-full bg-gray-50">
              <div className="text-center text-gray-600 max-w-md">
                <div className="text-6xl mb-4">🏙️</div>
                <h3 className="text-xl font-semibold mb-2">Street View Not Available</h3>
                <p>Street View imagery is not available for this location.</p>
                <p className="text-sm mt-2">This may be due to privacy restrictions or limited coverage.</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Main Image Area */}
              <div className="flex-1 relative bg-black">
                {allImages.length > 0 && (
                  <Carousel className="h-full">
                    <CarouselContent className="h-full">
                      {allImages.map((image, index) => (
                        <CarouselItem key={index} className="h-full">
                          <div className="relative h-full">
                            <img
                              src={image.imageUrl}
                              alt={`${landmarkName} - View ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = `https://images.unsplash.com/photo-1500673922987-e212871fec22?w=640&h=640&fit=crop`;
                              }}
                            />
                            {/* View Info Overlay */}
                            <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                              Heading: {image.heading}°
                            </div>
                            {hasMultipleViews && (
                              <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                                {index + 1} of {allImages.length}
                              </div>
                            )}
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {hasMultipleViews && (
                      <>
                        <CarouselPrevious className="left-4" />
                        <CarouselNext className="right-4" />
                      </>
                    )}
                  </Carousel>
                )}
              </div>

              {/* Info Panel */}
              <div className="border-t bg-gray-50 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Location Info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-gray-600">
                        {streetViewData?.location.lat.toFixed(6)}, {streetViewData?.location.lng.toFixed(6)}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Panorama Status */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        Panorama
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${hasPanorama ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs">
                          {hasPanorama ? 'Interactive Available' : 'Static Only'}
                        </span>
                      </div>
                      {panoramaData?.panoId && (
                        <p className="text-xs text-gray-500 mt-1">
                          ID: {panoramaData.panoId.slice(0, 12)}...
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Technical Info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-gray-600">
                        Views: {allImages.length}
                      </p>
                      <p className="text-xs text-gray-600">
                        Status: {streetViewData?.metadata.status || 'Unknown'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Copyright */}
                {streetViewData?.metadata.copyright && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 text-center">
                      {streetViewData.metadata.copyright}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimplifiedStreetViewViewer;
