
import React, { useState, useEffect } from 'react';
import { APIProvider, StreetViewPanorama } from '@vis.gl/react-google-maps';
import { X } from 'lucide-react';

interface GoogleStreetViewPanoramaProps {
  isOpen: boolean;
  onClose: () => void;
  location: { lat: number; lng: number };
  landmarkName?: string;
}

const GoogleStreetViewPanorama: React.FC<GoogleStreetViewPanoramaProps> = ({
  isOpen,
  onClose,
  location,
  landmarkName = 'Location'
}) => {
  const [googleApiKey, setGoogleApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get Google API key from environment or show input field
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
                   import.meta.env.GOOGLE_MAPS_API_KEY ||
                   localStorage.getItem('google_maps_api_key');
    
    if (apiKey) {
      setGoogleApiKey(apiKey);
      setIsLoading(false);
    } else {
      setError('Google Maps API key required');
      setIsLoading(false);
    }
  }, []);

  const handleApiKeySubmit = (key: string) => {
    localStorage.setItem('google_maps_api_key', key);
    setGoogleApiKey(key);
    setError(null);
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="text-white">Loading Google Street View...</div>
      </div>
    );
  }

  if (error || !googleApiKey) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Google Maps API Key Required</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X size={20} />
            </button>
          </div>
          <p className="text-gray-600 mb-4">
            To use Google Street View, please enter your Google Maps API key:
          </p>
          <ApiKeyInput onSubmit={handleApiKeySubmit} />
          <p className="text-sm text-gray-500 mt-4">
            Get your API key from the{' '}
            <a 
              href="https://console.cloud.google.com/google/maps-apis/credentials" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Google Cloud Console
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 bg-white hover:bg-gray-100 rounded-full p-2 shadow-lg"
      >
        <X size={24} />
      </button>
      
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2">
        <h3 className="font-semibold text-gray-900">{landmarkName}</h3>
        <p className="text-sm text-gray-600">
          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
        </p>
      </div>

      <APIProvider apiKey={googleApiKey}>
        <div className="w-full h-full">
          <StreetViewPanorama
            position={location}
            pov={{ heading: 0, pitch: 0 }}
            zoom={1}
            visible={true}
            motionTracking={false}
            motionTrackingControl={true}
            linksControl={true}
            panControl={true}
            zoomControl={true}
            addressControl={true}
            enableCloseButton={false}
          />
        </div>
      </APIProvider>
    </div>
  );
};

// Simple API Key input component
const ApiKeyInput: React.FC<{ onSubmit: (key: string) => void }> = ({ onSubmit }) => {
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      onSubmit(key.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Enter your Google Maps API key..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />
      <button
        type="submit"
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
      >
        Use API Key
      </button>
    </form>
  );
};

export default GoogleStreetViewPanorama;
