import { TOP_LANDMARKS, TopLandmark } from '@/data/topLandmarks';

export interface CityData {
  name: string;
  slug: string;
  coordinates: [number, number];
  landmarks: TopLandmark[];
  primaryLandmark: TopLandmark;
  landmarkCount: number;
}

/**
 * Extracts unique cities from TOP_LANDMARKS data
 * Groups landmarks by city and provides city-level data for tour generation
 */
export const extractCitiesFromLandmarks = (): CityData[] => {
  const cityMap = new Map<string, CityData>();

  TOP_LANDMARKS.forEach(landmark => {
    // Extract city name from landmark name (format: "Landmark Name, City")
    const parts = landmark.name.split(',');
    if (parts.length < 2) return;
    
    const cityName = parts[parts.length - 1].trim();
    const citySlug = cityName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');

    if (!cityMap.has(cityName)) {
      cityMap.set(cityName, {
        name: cityName,
        slug: citySlug,
        coordinates: landmark.coordinates,
        landmarks: [],
        primaryLandmark: landmark,
        landmarkCount: 0
      });
    }

    const cityData = cityMap.get(cityName)!;
    cityData.landmarks.push(landmark);
    cityData.landmarkCount = cityData.landmarks.length;
  });

  return Array.from(cityMap.values())
    .filter(city => city.landmarks.length > 0)
    .sort((a, b) => b.landmarkCount - a.landmarkCount); // Sort by landmark count (multi-landmark cities first)
};

/**
 * Gets the 8 verified working cities for Phase 1 static pages
 * Only returns cities that have confirmed working slugs and data
 */
export const getPhase1Cities = (): CityData[] => {
  const allCities = extractCitiesFromLandmarks();
  
  // Only include cities that we've verified work properly
  const verifiedCityNames = [
    'Paris', 'London', 'New York', 'Rome', 
    'Barcelona', 'Berlin', 'Toronto', 'Mexico City'
  ];
  
  return allCities
    .filter(city => verifiedCityNames.includes(city.name))
    .sort((a, b) => b.landmarkCount - a.landmarkCount); // Sort by landmark count
};

/**
 * Gets city data by slug for routing
 */
export const getCityBySlug = (slug: string): CityData | undefined => {
  const cities = getPhase1Cities();
  return cities.find(city => city.slug === slug);
};

/**
 * Formats city data for tour generation (compatible with existing system)
 */
export const formatCityForTourGeneration = (city: CityData) => {
  return {
    coordinates: city.coordinates,
    name: city.name,
    place_id: city.primaryLandmark.place_id,
    landmarks: city.landmarks
  };
};

/**
 * Gets featured cities for homepage/navigation
 */
export const getFeaturedCities = (): CityData[] => {
  // Return all 8 verified cities
  return getPhase1Cities();
};