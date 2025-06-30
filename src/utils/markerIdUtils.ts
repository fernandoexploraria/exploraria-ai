
// Utility functions for consistent marker ID generation
export const generateTourLandmarkId = (index: number): string => {
  return `tour-landmark-${index}`;
};

export const generateTopLandmarkId = (index: number): string => {
  return `top-landmark-${index}`;
};

export const isTourLandmarkId = (id: string): boolean => {
  return id.startsWith('tour-landmark-');
};

export const isTopLandmarkId = (id: string): boolean => {
  return id.startsWith('top-landmark-');
};
