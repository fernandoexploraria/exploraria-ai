import React from 'react';
import { Route } from 'lucide-react';

interface OptimalRouteButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
}

const OptimalRouteButton: React.FC<OptimalRouteButtonProps> = ({
  onClick,
  loading,
  disabled
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="mapboxgl-ctrl mapboxgl-ctrl-group bg-white border border-gray-200 rounded shadow-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      style={{
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'white',
        cursor: disabled || loading ? 'not-allowed' : 'pointer'
      }}
      title={loading ? "Calculating optimal route..." : "Calculate optimal route"}
      aria-label={loading ? "Calculating optimal route" : "Calculate optimal route to visit all landmarks"}
    >
      {loading ? (
        <div 
          className="animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
          style={{ width: '16px', height: '16px' }}
        />
      ) : (
        <Route size={20} color="#374151" />
      )}
    </button>
  );
};

export default OptimalRouteButton;