
export interface ProximityMarker {
  id: string;
  name: string;
  coordinates: [number, number];
  description: string;
  type: 'proximity';
}

let globalProximityMarkers: ProximityMarker[] = [];

export const setGlobalProximityMarkers = (markers: ProximityMarker[]) => {
  globalProximityMarkers = markers;
};

export const getGlobalProximityMarkers = (): ProximityMarker[] => {
  return globalProximityMarkers;
};

export const addGlobalProximityMarker = (marker: ProximityMarker) => {
  globalProximityMarkers = [...globalProximityMarkers, marker];
};

export const clearGlobalProximityMarkers = () => {
  globalProximityMarkers = [];
};
