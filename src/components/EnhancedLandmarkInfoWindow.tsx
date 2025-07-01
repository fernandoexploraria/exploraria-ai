
import React from 'react';
import { X, Star, DollarSign, Clock, Globe, MapPin } from 'lucide-react';
import { PhotoCarousel } from './photo-carousel';
import { PhotoData } from '@/hooks/useEnhancedPhotos';

interface EnhancedLandmarkData {
  id: string;
  name: string;
  description?: string;
  coordinates: [number, number];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  formatted_address?: string;
  editorial_summary?: string;
  types?: string[];
  opening_hours?: any;
  website_uri?: string;
  photos?: PhotoData[];
}

interface EnhancedLandmarkInfoWindowProps {
  landmark: EnhancedLandmarkData;
  onClose: () => void;
}

const EnhancedLandmarkInfoWindow: React.FC<EnhancedLandmarkInfoWindowProps> = ({
  landmark,
  onClose
}) => {
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }
    
    if (hasHalfStar) {
      stars.push(<Star key="half" className="w-4 h-4 fill-yellow-400/50 text-yellow-400" />);
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />);
    }
    
    return stars;
  };

  const renderPriceLevel = (level: number) => {
    const dollarSigns = [];
    for (let i = 0; i < level; i++) {
      dollarSigns.push(<DollarSign key={i} className="w-3 h-3 text-green-600" />);
    }
    for (let i = level; i < 4; i++) {
      dollarSigns.push(<DollarSign key={i} className="w-3 h-3 text-gray-300" />);
    }
    return dollarSigns;
  };

  const formatTypes = (types: string[]) => {
    return types
      .filter(type => !type.includes('establishment') && !type.includes('point_of_interest'))
      .map(type => type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
      .slice(0, 3);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{landmark.name}</h1>
            
            {/* Rating and Price */}
            <div className="flex items-center gap-4 mb-2">
              {landmark.rating && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {renderStars(landmark.rating)}
                  </div>
                  <span className="text-sm text-gray-600">
                    {landmark.rating.toFixed(1)} ({landmark.user_ratings_total || 0} reviews)
                  </span>
                </div>
              )}
              
              {landmark.price_level && (
                <div className="flex items-center gap-1">
                  {renderPriceLevel(landmark.price_level)}
                </div>
              )}
            </div>

            {/* Types */}
            {landmark.types && landmark.types.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {formatTypes(landmark.types).map((type, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                  >
                    {type}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Photos */}
        {landmark.photos && landmark.photos.length > 0 && (
          <div className="mb-6">
            <PhotoCarousel
              photos={landmark.photos}
              initialIndex={0}
              showThumbnails={landmark.photos.length > 1}
              allowZoom={true}
              className="w-full max-h-96"
            />
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Description */}
            {landmark.description && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p className="text-gray-700 leading-relaxed">{landmark.description}</p>
              </div>
            )}

            {/* Editorial Summary */}
            {landmark.editorial_summary && (
              <div>
                <h3 className="text-lg font-semibold mb-2">About This Place</h3>
                <p className="text-gray-700 leading-relaxed">{landmark.editorial_summary}</p>
              </div>
            )}

            {/* Address */}
            {landmark.formatted_address && (
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Address
                </h3>
                <p className="text-gray-700">{landmark.formatted_address}</p>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Opening Hours */}
            {landmark.opening_hours && (
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Opening Hours
                </h3>
                <div className="space-y-1">
                  {landmark.opening_hours.weekday_text?.map((day: string, index: number) => (
                    <p key={index} className="text-sm text-gray-700">{day}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Website */}
            {landmark.website_uri && (
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Website
                </h3>
                <a
                  href={landmark.website_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Visit Website
                </a>
              </div>
            )}

            {/* Coordinates */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Location</h3>
              <p className="text-gray-700 text-sm">
                {landmark.coordinates[1].toFixed(6)}, {landmark.coordinates[0].toFixed(6)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedLandmarkInfoWindow;
