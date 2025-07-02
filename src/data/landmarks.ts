export interface Landmark {
  id: string;
  name: string;
  description: string;
  coordinates: [number, number];
  rating?: number;
  photos?: string[];
  types?: string[];
  placeId?: string;
  formattedAddress?: string;
  tourId?: string; // 🔥 Enhanced: Optional tour_id for database-linked landmarks
}

export interface EnhancedLandmark extends Landmark {
  placeId?: string;
  coordinateSource: string;
  confidence: number;
  rating?: number;
  photos?: string[];
  types?: string[];
  formattedAddress?: string;
  // 🔥 Enhanced: Additional fields for database integration
  landmark_id?: string; // Database landmark identifier
  place_id?: string; // Google Places ID in database format
  raw_data?: any; // Complete Google Places raw response
  photo_references?: string[]; // Photo reference IDs
  user_ratings_total?: number;
  price_level?: number;
  website_uri?: string;
  opening_hours?: any;
  editorial_summary?: string;
}

export const landmarks: Landmark[] = [
];
