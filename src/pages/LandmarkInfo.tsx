
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EnhancedLandmarkInfoWindow from '@/components/EnhancedLandmarkInfoWindow';

const LandmarkInfoPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [landmarkData, setLandmarkData] = useState(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dataKey = searchParams.get('data');
    if (dataKey) {
      try {
        const storedData = sessionStorage.getItem(dataKey);
        if (storedData) {
          const parsed = JSON.parse(storedData);
          setLandmarkData(parsed);
          // Clean up the session storage
          sessionStorage.removeItem(dataKey);
        } else {
          setError('Landmark data not found');
        }
      } catch (err) {
        setError('Failed to load landmark data');
      }
    } else {
      setError('No data key provided');
    }
  }, [searchParams]);

  const handleClose = () => {
    window.close();
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  if (!landmarkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading landmark information...</p>
        </div>
      </div>
    );
  }

  return (
    <EnhancedLandmarkInfoWindow
      landmark={landmarkData}
      onClose={handleClose}
    />
  );
};

export default LandmarkInfoPage;
