
export interface Tour {
  id: string;
  name: string;
  description?: string;
  landmarks: TourLandmark[];
  created_at?: string;
  updated_at?: string;
}

export interface TourLandmark {
  id: string;
  placeId?: string;
  name: string;
  coordinates: [number, number];
  description: string;
  rating?: number;
  photos?: string[];
  types?: string[];
  formattedAddress?: string;
  tourId?: string;
  coordinateSource?: string;
  confidence?: 'high' | 'medium' | 'low';
}
