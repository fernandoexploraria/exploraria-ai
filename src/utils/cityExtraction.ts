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
 * Gets the 15 selected cities for Phase 1 static pages
 * Prioritizes multi-landmark cities and includes Mexico City
 */
export const getPhase1Cities = (): CityData[] => {
  const allCities = extractCitiesFromLandmarks();
  
  // Tier 1: Multi-landmark cities (2+ landmarks)
  const multiLandmarkCities = allCities.filter(city => city.landmarkCount >= 2);
  
  // Tier 2: Strategic single-landmark cities
  const strategicCities = allCities.filter(city => 
    city.landmarkCount === 1 && [
      'Mexico City', 'Sydney', 'Barcelona', 'Berlin', 
      'Dubai', 'Toronto', 'Rio de Janeiro'
    ].includes(city.name)
  );
  
  // Combine and take top 15
  const selectedCities = [...multiLandmarkCities, ...strategicCities].slice(0, 15);
  
  // Ensure Mexico City is included
  if (!selectedCities.find(city => city.name === 'Mexico City')) {
    const mexicoCity = allCities.find(city => city.name === 'Mexico City');
    if (mexicoCity) {
      selectedCities.pop(); // Remove last city to make room
      selectedCities.push(mexicoCity);
    }
  }
  
  return selectedCities;
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
  const phase1Cities = getPhase1Cities();
  
  // Return top 8 cities (mix of multi-landmark + strategic)
  return phase1Cities.slice(0, 8);
};