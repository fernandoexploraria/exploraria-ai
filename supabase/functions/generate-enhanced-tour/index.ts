import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface LandmarkFromGemini {
  name: string;
  alternativeNames?: string[];
  description: string;
  category?: string;
}

interface EnhancedLandmark {
  id: string;
  name: string;
  coordinates: [number, number];
  description: string;
  placeId?: string;
  coordinateSource: 'places' | 'geocoding' | 'gemini';
  confidence: number;
  rating?: number;
  photos?: string[];
  types?: string[];
  formattedAddress?: string;
  validationMetadata?: ValidationMetadata;
}

interface ValidationMetadata {
  distanceValidation: {
    distanceFromCenter: number;
    dynamicThreshold: number;
    citySize: 'major_metropolitan' | 'large_city' | 'medium_city' | 'small_city' | 'town';
    passed: boolean;
  };
  plausibilityValidation: {
    isOnLand: boolean;
    elevationCheck: boolean;
    terrainCompatibility: boolean;
    passed: boolean;
  };
  boundaryValidation: {
    withinCityBounds: boolean;
    administrativeLevel: string;
    nearbyFeatures: string[];
    passed: boolean;
  };
  crossValidation: {
    sourcesAgreement: number;
    outlierScore: number;
    consensusCoordinates?: [number, number];
    passed: boolean;
  };
  overallScore: number;
}

interface EnhancedTourResponse {
  landmarks: EnhancedLandmark[];
  systemPrompt: string;
  destination: string;
  metadata: {
    totalLandmarks: number;
    coordinateQuality: {
      highConfidence: number;
      mediumConfidence: number;
      lowConfidence: number;
    };
    processingTime: number;
    fallbacksUsed: string[];
    searchStats: {
      totalSearches: number;
      successfulSearches: number;
      searchStrategies: { [key: string]: number };
    };
    validationStats: {
      averageDistanceFromCenter: number;
      validationPasses: {
        distance: number;
        plausibility: number;
        boundary: number;
        crossValidation: number;
      };
      averageOverallScore: number;
    };
  };
}

interface GeographicContext {
  city: string;
  state?: string;
  country: string;
  region?: string;
  administrativeAreas: string[];
  cityBounds?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  population?: number;
  cityType?: 'major_metropolitan' | 'large_city' | 'medium_city' | 'small_city' | 'town';
}

interface SearchQuery {
  query: string;
  strategy: string;
  priority: number;
}

// Enhanced geographic context extraction with city classification
const extractGeographicContext = async (destination: string, googleApiKey: string): Promise<GeographicContext> => {
  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${googleApiKey}`;
    const response = await fetch(geocodeUrl);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const components = result.address_components;
      const bounds = result.geometry.bounds || result.geometry.viewport;
      
      let city = destination;
      let state: string | undefined;
      let country = '';
      let region: string | undefined;
      const administrativeAreas: string[] = [];
      
      for (const component of components) {
        const types = component.types;
        
        if (types.includes('locality') || types.includes('administrative_area_level_2')) {
          city = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
          state = component.long_name;
          administrativeAreas.push(component.long_name);
        } else if (types.includes('country')) {
          country = component.long_name;
        } else if (types.includes('sublocality') || types.includes('administrative_area_level_3')) {
          region = component.long_name;
          administrativeAreas.push(component.long_name);
        }
      }

      // Get city details from Places API for population and type classification
      const cityType = await classifyCitySize(city, state, country, googleApiKey);
      
      return { 
        city, 
        state, 
        country, 
        region, 
        administrativeAreas,
        cityBounds: bounds ? {
          northeast: { lat: bounds.northeast.lat, lng: bounds.northeast.lng },
          southwest: { lat: bounds.southwest.lat, lng: bounds.southwest.lng }
        } : undefined,
        cityType
      };
    }
  } catch (error) {
    console.error('Geographic context extraction error:', error);
  }
  
  return {
    city: destination,
    country: '',
    administrativeAreas: [],
    cityType: 'medium_city'
  };
};

// City size classification system
const classifyCitySize = async (city: string, state: string | undefined, country: string, googleApiKey: string): Promise<'major_metropolitan' | 'large_city' | 'medium_city' | 'small_city' | 'town'> => {
  try {
    const query = state ? `${city}, ${state}, ${country}` : `${city}, ${country}`;
    const placesUrl = 'https://places.googleapis.com/v1/places:searchText';
    
    const response = await fetch(placesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': 'places.types,places.userRatingCount,places.displayName'
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 1
      })
    });

    if (!response.ok) return 'medium_city';
    
    const data = await response.json();
    if (!data.places || data.places.length === 0) return 'medium_city';
    
    const place = data.places[0];
    const types = place.types || [];
    const ratingCount = place.userRatingCount || 0;
    
    // Classification logic based on place types and activity
    if (types.includes('administrative_area_level_1') || ratingCount > 50000) {
      return 'major_metropolitan';
    } else if (types.includes('locality') && ratingCount > 10000) {
      return 'large_city';
    } else if (types.includes('locality') && ratingCount > 1000) {
      return 'medium_city';
    } else if (types.includes('locality')) {
      return 'small_city';
    }
    
    return 'town';
  } catch (error) {
    console.error('City classification error:', error);
    return 'medium_city';
  }
};

// Dynamic distance threshold calculation
const calculateDynamicThreshold = (cityType: string, landmarkCategory?: string): number => {
  const baseThresholds = {
    'major_metropolitan': 50, // 50km for major metros like NYC, London
    'large_city': 25,         // 25km for large cities
    'medium_city': 15,        // 15km for medium cities
    'small_city': 8,          // 8km for small cities
    'town': 5                 // 5km for towns
  };
  
  let threshold = baseThresholds[cityType as keyof typeof baseThresholds] || 15;
  
  // Adjust based on landmark category
  if (landmarkCategory) {
    const categoryMultipliers = {
      'park': 1.5,        // Parks can be further out
      'airport': 2.0,     // Airports are often outside city centers
      'beach': 1.8,       // Beaches are on periphery
      'mountain': 2.5,    // Mountains can be quite far
      'museum': 0.8,      // Museums usually central
      'restaurant': 0.6,  // Restaurants should be relatively close
      'hotel': 0.9        // Hotels usually in city areas
    };
    
    const multiplier = categoryMultipliers[landmarkCategory.toLowerCase() as keyof typeof categoryMultipliers] || 1.0;
    threshold *= multiplier;
  }
  
  return threshold;
};

// Advanced coordinate plausibility validation
const validateCoordinatePlausibility = async (coordinates: [number, number], landmarkCategory: string, googleApiKey: string): Promise<{
  isOnLand: boolean;
  elevationCheck: boolean;
  terrainCompatibility: boolean;
  passed: boolean;
}> => {
  try {
    // Reverse geocoding to check if coordinates are on land
    const reverseGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates[1]},${coordinates[0]}&key=${googleApiKey}`;
    const response = await fetch(reverseGeocodeUrl);
    const data = await response.json();
    
    let isOnLand = true;
    let elevationCheck = true;
    let terrainCompatibility = true;
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const types = result.types || [];
      
      // Check if location is water-based
      isOnLand = !types.some(type => 
        ['natural_feature', 'body_of_water'].includes(type) && 
        !['beach', 'marina', 'pier'].some(waterType => landmarkCategory.toLowerCase().includes(waterType))
      );
      
      // Simple terrain compatibility check based on address components
      const addressComponents = result.address_components || [];
      const hasNaturalFeatures = addressComponents.some(comp => 
        comp.types.includes('natural_feature')
      );
      
      // Terrain compatibility logic
      if (landmarkCategory.toLowerCase().includes('museum') && hasNaturalFeatures) {
        terrainCompatibility = false; // Museums shouldn't be in wilderness
      }
      
      if (landmarkCategory.toLowerCase().includes('beach') && !types.includes('natural_feature')) {
        terrainCompatibility = false; // Beaches should be near water
      }
    }
    
    return {
      isOnLand,
      elevationCheck,
      terrainCompatibility,
      passed: isOnLand && elevationCheck && terrainCompatibility
    };
  } catch (error) {
    console.error('Plausibility validation error:', error);
    return {
      isOnLand: true,
      elevationCheck: true,
      terrainCompatibility: true,
      passed: true
    };
  }
};

// City boundary validation
const validateCityBoundary = async (coordinates: [number, number], geoContext: GeographicContext): Promise<{
  withinCityBounds: boolean;
  administrativeLevel: string;
  nearbyFeatures: string[];
  passed: boolean;
}> => {
  try {
    const [lng, lat] = coordinates;
    
    // Check if coordinates are within city bounds
    let withinCityBounds = true;
    if (geoContext.cityBounds) {
      const { northeast, southwest } = geoContext.cityBounds;
      withinCityBounds = lat >= southwest.lat && lat <= northeast.lat &&
                        lng >= southwest.lng && lng <= northeast.lng;
    }
    
    return {
      withinCityBounds,
      administrativeLevel: geoContext.state || geoContext.country,
      nearbyFeatures: geoContext.administrativeAreas,
      passed: withinCityBounds
    };
  } catch (error) {
    console.error('Boundary validation error:', error);
    return {
      withinCityBounds: true,
      administrativeLevel: '',
      nearbyFeatures: [],
      passed: true
    };
  }
};

// Multi-source coordinate cross-validation
const crossValidateCoordinates = (coordinateSources: Array<{
  source: string;
  coordinates: [number, number];
  confidence: number;
}>): {
  sourcesAgreement: number;
  outlierScore: number;
  consensusCoordinates?: [number, number];
  passed: boolean;
} => {
  if (coordinateSources.length < 2) {
    return {
      sourcesAgreement: 1.0,
      outlierScore: 0,
      passed: true
    };
  }
  
  // Calculate distances between all coordinate pairs
  const distances: number[] = [];
  for (let i = 0; i < coordinateSources.length; i++) {
    for (let j = i + 1; j < coordinateSources.length; j++) {
      const dist = calculateDistance(coordinateSources[i].coordinates, {
        latitude: coordinateSources[j].coordinates[1],
        longitude: coordinateSources[j].coordinates[0]
      });
      distances.push(dist);
    }
  }
  
  const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const maxDistance = Math.max(...distances);
  
  // Calculate agreement score (higher is better)
  const sourcesAgreement = Math.max(0, 1 - (avgDistance / 1000)); // Normalize to 1km
  
  // Calculate outlier score (lower is better)
  const outlierScore = maxDistance / 1000;
  
  // Calculate consensus coordinates (weighted average)
  let consensusCoordinates: [number, number] | undefined;
  if (coordinateSources.length > 1) {
    const totalWeight = coordinateSources.reduce((sum, source) => sum + source.confidence, 0);
    const weightedLng = coordinateSources.reduce((sum, source) => 
      sum + (source.coordinates[0] * source.confidence), 0) / totalWeight;
    const weightedLat = coordinateSources.reduce((sum, source) => 
      sum + (source.coordinates[1] * source.confidence), 0) / totalWeight;
    
    consensusCoordinates = [weightedLng, weightedLat];
  }
  
  return {
    sourcesAgreement,
    outlierScore,
    consensusCoordinates,
    passed: sourcesAgreement > 0.7 && outlierScore < 2.0 // 2km max outlier tolerance
  };
};

// Smart search term generation
const generateSearchQueries = (landmark: LandmarkFromGemini, geoContext: GeographicContext): SearchQuery[] => {
  const queries: SearchQuery[] = [];
  const landmarkName = landmark.name;
  const category = landmark.category || '';
  
  // Strategy 1: Exact name + full location hierarchy (highest priority)
  if (geoContext.state && geoContext.country) {
    queries.push({
      query: `${landmarkName} ${geoContext.city} ${geoContext.state} ${geoContext.country}`,
      strategy: 'exact_full_hierarchy',
      priority: 10
    });
  }
  
  queries.push({
    query: `${landmarkName} ${geoContext.city} ${geoContext.country}`,
    strategy: 'exact_city_country',
    priority: 9
  });
  
  // Strategy 2: Category-enhanced searches
  if (category) {
    queries.push({
      query: `${landmarkName} ${category} ${geoContext.city}`,
      strategy: 'category_enhanced',
      priority: 8
    });
    
    queries.push({
      query: `${category} ${landmarkName} in ${geoContext.city}`,
      strategy: 'category_natural_language',
      priority: 7
    });
  }
  
  // Strategy 3: Alternative names with full context
  if (landmark.alternativeNames) {
    landmark.alternativeNames.forEach((altName, index) => {
      queries.push({
        query: `${altName} ${geoContext.city} ${geoContext.country}`,
        strategy: `alternative_name_${index + 1}`,
        priority: 6 - index * 0.5
      });
    });
  }
  
  // Strategy 4: Regional context searches
  if (geoContext.region) {
    queries.push({
      query: `${landmarkName} ${geoContext.region} ${geoContext.city}`,
      strategy: 'regional_context',
      priority: 6
    });
  }
  
  // Strategy 5: Administrative area searches
  geoContext.administrativeAreas.forEach((area, index) => {
    queries.push({
      query: `${landmarkName} ${area}`,
      strategy: `administrative_area_${index + 1}`,
      priority: 5 - index * 0.2
    });
  });
  
  // Strategy 6: Simplified searches (fallback)
  queries.push({
    query: `${landmarkName} ${geoContext.city}`,
    strategy: 'simple_city',
    priority: 4
  });
  
  queries.push({
    query: landmarkName,
    strategy: 'name_only',
    priority: 2
  });
  
  // Strategy 7: Multilingual variations (if landmark name contains non-Latin characters)
  if (/[^\x00-\x7F]/.test(landmarkName)) {
    queries.push({
      query: `${landmarkName} landmark ${geoContext.city}`,
      strategy: 'multilingual_landmark',
      priority: 5
    });
  }
  
  // Sort by priority (highest first) and return top 8 queries
  return queries
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);
};

// Enhanced Places Text Search with multiple query attempts
const searchPlacesWithStrategies = async (searchQueries: SearchQuery[], googleApiKey: string) => {
  const searchStats = {
    totalSearches: 0,
    successfulSearches: 0,
    searchStrategies: {} as { [key: string]: number }
  };
  
  for (const searchQuery of searchQueries) {
    try {
      console.log(`🔍 Trying ${searchQuery.strategy}: "${searchQuery.query}"`);
      
      searchStats.totalSearches++;
      searchStats.searchStrategies[searchQuery.strategy] = (searchStats.searchStrategies[searchQuery.strategy] || 0) + 1;
      
      const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleApiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos,places.location'
        },
        body: JSON.stringify({
          textQuery: searchQuery.query,
          maxResultCount: 5
        })
      });

      if (!response.ok) continue;
      
      const data = await response.json();
      if (data.places && data.places.length > 0) {
        console.log(`✅ ${searchQuery.strategy} success: Found ${data.places.length} results`);
        searchStats.successfulSearches++;
        return { places: data.places, strategy: searchQuery.strategy, searchStats };
      }
    } catch (error) {
      console.error(`Search strategy ${searchQuery.strategy} failed:`, error);
    }
  }
  
  return { places: null, strategy: 'none', searchStats };
};

// Helper function to get city center coordinates
const getCityCenterCoordinates = async (destination: string, googleApiKey: string): Promise<[number, number] | null> => {
  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${googleApiKey}`;
    const response = await fetch(geocodeUrl);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return [location.lng, location.lat];
    }
  } catch (error) {
    console.error('Error getting city center:', error);
  }
  return null;
};

// Helper function to calculate distance between coordinates
const calculateDistance = (coord1: [number, number], coord2: { latitude: number; longitude: number }): number => {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371e3; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Layer 4: Google Geocoding API
const geocodeLandmark = async (address: string, googleApiKey: string) => {
  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
    const response = await fetch(geocodeUrl);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        coordinates: [result.geometry.location.lng, result.geometry.location.lat] as [number, number],
        formattedAddress: result.formatted_address
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
};

// Layer 5: Gemini coordinates fallback
const getGeminiCoordinates = async (landmarkName: string, destination: string, googleAiApiKey: string) => {
  try {
    const prompt = `Provide only the coordinates for "${landmarkName}" in ${destination}. Respond with only a JSON object: {"coordinates": [longitude, latitude]}`;
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleAiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
        })
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (responseText) {
      const cleanedJson = responseText.replace(/```json\n|```/g, '').trim();
      const parsed = JSON.parse(cleanedJson);
      return parsed.coordinates as [number, number];
    }
  } catch (error) {
    console.error('Gemini coordinates fallback error:', error);
  }
  return null;
};

// Enhanced coordinate refinement with advanced validation
const refineCoordinates = async (
  landmark: LandmarkFromGemini, 
  geoContext: GeographicContext,
  cityCenter: [number, number] | null,
  googleApiKey: string,
  googleAiApiKey: string
): Promise<{ enhancedLandmark: EnhancedLandmark; searchStats: any }> => {
  const fallbacksUsed: string[] = [];
  let coordinates: [number, number] | null = null;
  let coordinateSource: 'places' | 'geocoding' | 'gemini' = 'gemini';
  let confidence = 0;
  let placeId: string | undefined;
  let rating: number | undefined;
  let photos: string[] | undefined;
  let types: string[] | undefined;
  let formattedAddress: string | undefined;
  let usedStrategy = 'none';
  let searchStats = {
    totalSearches: 0,
    successfulSearches: 0,
    searchStrategies: {} as { [key: string]: number }
  };

  // Collect coordinates from different sources for cross-validation
  const coordinateSources: Array<{ source: string; coordinates: [number, number]; confidence: number }> = [];

  // Generate smart search queries
  const searchQueries = generateSearchQueries(landmark, geoContext);
  console.log(`🔍 Generated ${searchQueries.length} search strategies for "${landmark.name}"`);

  // Layer 1: Enhanced Places search with multiple strategies
  const placesResult = await searchPlacesWithStrategies(searchQueries, googleApiKey);
  searchStats = placesResult.searchStats;
  
  if (placesResult.places && placesResult.places.length > 0) {
    const place = placesResult.places[0];
    usedStrategy = placesResult.strategy;
    
    if (place.location) {
      coordinates = [place.location.longitude, place.location.latitude];
      coordinateSource = 'places';
      coordinateSources.push({
        source: 'places',
        coordinates,
        confidence: 0.9
      });
      
      // Enhanced confidence scoring based on strategy used
      const strategyConfidence = {
        'exact_full_hierarchy': 0.95,
        'exact_city_country': 0.9,
        'category_enhanced': 0.85,
        'category_natural_language': 0.8,
        'alternative_name_1': 0.8,
        'regional_context': 0.75,
        'simple_city': 0.7,
        'multilingual_landmark': 0.75
      };
      
      confidence = strategyConfidence[usedStrategy as keyof typeof strategyConfidence] || 0.6;
      
      placeId = place.id;
      rating = place.rating;
      types = place.types;
      formattedAddress = place.formattedAddress;
      
      if (place.photos && place.photos.length > 0) {
        photos = place.photos.slice(0, 3).map((photo: any) => 
          `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=600&key=${googleApiKey}`
        );
      }
      
      console.log(`✅ Enhanced Places search success using strategy: ${usedStrategy}`);
    }
  }

  // Layer 2: Enhanced geocoding with geographic context
  if (!coordinates) {
    console.log(`🔍 Trying enhanced geocoding for "${landmark.name}"`);
    
    const geocodingQueries = [
      `${landmark.name}, ${geoContext.city}, ${geoContext.country}`,
      `${landmark.name}, ${geoContext.city}`,
      landmark.name
    ];
    
    for (const query of geocodingQueries) {
      const geocoded = await geocodeLandmark(query, googleApiKey);
      searchStats.totalSearches++;
      searchStats.searchStrategies['geocoding'] = (searchStats.searchStrategies['geocoding'] || 0) + 1;
      
      if (geocoded) {
        coordinates = geocoded.coordinates;
        coordinateSource = 'geocoding';
        confidence = 0.6;
        formattedAddress = geocoded.formattedAddress;
        fallbacksUsed.push('enhanced_geocoding');
        searchStats.successfulSearches++;
        coordinateSources.push({
          source: 'geocoding',
          coordinates,
          confidence: 0.6
        });
        console.log(`✅ Enhanced geocoding success with query: ${query}`);
        break;
      }
    }
  }

  // Layer 3: Gemini fallback with enhanced context
  if (!coordinates) {
    console.log(`🔍 Gemini fallback for "${landmark.name}"`);
    const contextualPrompt = `${landmark.name} in ${geoContext.city}, ${geoContext.country}`;
    const geminiCoords = await getGeminiCoordinates(contextualPrompt, geoContext.city, googleAiApiKey);
    searchStats.totalSearches++;
    searchStats.searchStrategies['gemini'] = (searchStats.searchStrategies['gemini'] || 0) + 1;
    
    if (geminiCoords) {
      coordinates = geminiCoords;
      coordinateSource = 'gemini';
      confidence = 0.3;
      fallbacksUsed.push('gemini_coordinates');
      searchStats.successfulSearches++;
      coordinateSources.push({
        source: 'gemini',
        coordinates,
        confidence: 0.3
      });
      console.log(`✅ Gemini fallback success`);
    }
  }

  // Final fallback
  if (!coordinates) {
    console.log(`❌ All enhanced strategies failed for "${landmark.name}", using default coordinates`);
    coordinates = [0, 0];
    confidence = 0.1;
    fallbacksUsed.push('default');
  }

  // Advanced Geographic Validation
  let validationMetadata: ValidationMetadata | undefined;
  
  if (coordinates && coordinates[0] !== 0 && coordinates[1] !== 0) {
    const dynamicThreshold = calculateDynamicThreshold(geoContext.cityType || 'medium_city', landmark.category);
    
    // Distance validation with dynamic thresholds
    const distanceFromCenter = cityCenter ? calculateDistance(coordinates, {
      latitude: cityCenter[1],
      longitude: cityCenter[0]
    }) / 1000 : 0; // Convert to kilometers
    
    const distanceValidation = {
      distanceFromCenter,
      dynamicThreshold,
      citySize: geoContext.cityType || 'medium_city' as const,
      passed: distanceFromCenter <= dynamicThreshold
    };
    
    // Plausibility validation
    const plausibilityValidation = await validateCoordinatePlausibility(
      coordinates, 
      landmark.category || '', 
      googleApiKey
    );
    
    // Boundary validation
    const boundaryValidation = await validateCityBoundary(coordinates, geoContext);
    
    // Cross-validation between sources
    const crossValidation = crossValidateCoordinates(coordinateSources);
    
    // Calculate overall validation score
    const validationScores = [
      distanceValidation.passed ? 1 : 0,
      plausibilityValidation.passed ? 1 : 0,
      boundaryValidation.passed ? 1 : 0,
      crossValidation.passed ? 1 : 0
    ];
    
    const overallScore = validationScores.reduce((sum, score) => sum + score, 0) / validationScores.length;
    
    validationMetadata = {
      distanceValidation,
      plausibilityValidation,
      boundaryValidation,
      crossValidation,
      overallScore
    };
    
    // Adjust confidence based on validation results
    confidence = Math.min(confidence, overallScore);
    
    // Use consensus coordinates if available and better validated
    if (crossValidation.consensusCoordinates && crossValidation.sourcesAgreement > 0.8) {
      coordinates = crossValidation.consensusCoordinates;
      console.log(`📍 Using consensus coordinates for "${landmark.name}"`);
    }
    
    console.log(`🔍 Validation for "${landmark.name}": Overall score ${overallScore.toFixed(2)}, Distance: ${distanceFromCenter.toFixed(2)}km (threshold: ${dynamicThreshold}km)`);
  }

  const enhancedLandmark: EnhancedLandmark = {
    id: `tour-landmark-${crypto.randomUUID()}`,
    name: landmark.name,
    coordinates,
    description: landmark.description,
    placeId,
    coordinateSource,
    confidence,
    rating,
    photos,
    types,
    formattedAddress,
    validationMetadata
  };

  return { enhancedLandmark, searchStats };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { destination } = await req.json();
    const startTime = Date.now();
    
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    const googleAiApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    
    if (!googleApiKey || !googleAiApiKey) {
      throw new Error('Required API keys not configured');
    }

    console.log(`🚀 Starting enhanced tour generation with advanced validation for: ${destination}`);

    // Step 1: Extract enhanced geographic context with city classification
    const geoContext = await extractGeographicContext(destination, googleApiKey);
    console.log(`📍 Geographic context:`, geoContext);

    // Step 2: Get city center coordinates
    const cityCenter = await getCityCenterCoordinates(destination, googleApiKey);
    console.log(`📍 City center coordinates:`, cityCenter);

    // Step 3: Modified Gemini prompt - no coordinates requested
    const systemInstruction = `You are an expert tour planner. Your response MUST be a valid JSON object with exactly this structure:
    {
      "landmarks": [array of landmark objects],
      "systemPrompt": "string containing the ElevenLabs assistant system prompt"
    }
    
    Do not include any text before or after the JSON object.
    Each landmark object should have: {
      "name": "string", 
      "alternativeNames": ["array of alternative names"],
      "description": "string",
      "category": "string like museum, monument, park, etc"
    }
    
    Do NOT include coordinates - they will be determined separately.`;

    const prompt = `Create a comprehensive tour plan for ${destination} that includes:

    1. A list of the top 10 most famous landmarks with their names, alternative names, descriptions, and categories
    2. A detailed system prompt for an AI tour guide assistant

    For each landmark, provide:
    - The official name
    - Alternative names (local names, common nicknames, translations)
    - A detailed description
    - The category (museum, monument, park, religious, architectural, etc.)

    The system prompt should make the AI assistant an expert on ${destination} with deep knowledge about the landmarks, history, culture, and practical tips.
    
    Format the response as a JSON object with "landmarks" and "systemPrompt" fields.`;

    console.log('🤖 Calling Gemini for landmark names and descriptions...');
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleAiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemInstruction + '\n\n' + prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        })
      }
    );

    if (!geminiResponse.ok) {
      throw new Error('Failed to get response from Gemini API');
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error('Invalid response from Gemini API');
    }

    console.log('📝 Got Gemini response, parsing...');
    const cleanedJson = responseText.replace(/```json\n|```/g, '').trim();
    const tourData = JSON.parse(cleanedJson);

    if (!tourData.landmarks || !tourData.systemPrompt) {
      throw new Error('Invalid tour data structure received from Gemini');
    }

    console.log(`🔍 Refining coordinates for ${tourData.landmarks.length} landmarks with advanced validation...`);

    // Step 4: Enhanced coordinate refinement with advanced validation
    const fallbacksUsed: string[] = [];
    const enhancedLandmarks: EnhancedLandmark[] = [];
    const aggregatedSearchStats = {
      totalSearches: 0,
      successfulSearches: 0,
      searchStrategies: {} as { [key: string]: number }
    };

    // Validation statistics
    const validationStats = {
      averageDistanceFromCenter: 0,
      validationPasses: {
        distance: 0,
        plausibility: 0,
        boundary: 0,
        crossValidation: 0
      },
      averageOverallScore: 0
    };

    for (const landmark of tourData.landmarks) {
      console.log(`\n🏛️ Processing: ${landmark.name}`);
      const { enhancedLandmark, searchStats } = await refineCoordinates(
        landmark, 
        geoContext,
        cityCenter, 
        googleApiKey, 
        googleAiApiKey
      );
      
      enhancedLandmarks.push(enhancedLandmark);
      
      // Aggregate search statistics
      aggregatedSearchStats.totalSearches += searchStats.totalSearches;
      aggregatedSearchStats.successfulSearches += searchStats.successfulSearches;
      
      Object.entries(searchStats.searchStrategies).forEach(([strategy, count]) => {
        aggregatedSearchStats.searchStrategies[strategy] = 
          (aggregatedSearchStats.searchStrategies[strategy] || 0) + count;
      });

      // Aggregate validation statistics
      if (enhancedLandmark.validationMetadata) {
        const vm = enhancedLandmark.validationMetadata;
        validationStats.averageDistanceFromCenter += vm.distanceValidation.distanceFromCenter;
        validationStats.averageOverallScore += vm.overallScore;
        
        if (vm.distanceValidation.passed) validationStats.validationPasses.distance++;
        if (vm.plausibilityValidation.passed) validationStats.validationPasses.plausibility++;
        if (vm.boundaryValidation.passed) validationStats.validationPasses.boundary++;
        if (vm.crossValidation.passed) validationStats.validationPasses.crossValidation++;
      }
    }

    // Calculate averages for validation stats
    const landmarkCount = enhancedLandmarks.length;
    validationStats.averageDistanceFromCenter /= landmarkCount;
    validationStats.averageOverallScore /= landmarkCount;

    // Step 5: Calculate quality metrics
    const coordinateQuality = enhancedLandmarks.reduce(
      (acc, landmark) => {
        if (landmark.confidence >= 0.8) acc.highConfidence++;
        else if (landmark.confidence >= 0.5) acc.mediumConfidence++;
        else acc.lowConfidence++;
        return acc;
      },
      { highConfidence: 0, mediumConfidence: 0, lowConfidence: 0 }
    );

    const processingTime = Date.now() - startTime;

    const response: EnhancedTourResponse = {
      landmarks: enhancedLandmarks,
      systemPrompt: tourData.systemPrompt,
      destination,
      metadata: {
        totalLandmarks: enhancedLandmarks.length,
        coordinateQuality,
        processingTime,
        fallbacksUsed: [...new Set(fallbacksUsed)],
        searchStats: aggregatedSearchStats,
        validationStats
      }
    };

    console.log(`✅ Enhanced tour generation with advanced validation completed in ${processingTime}ms`);
    console.log(`📊 Quality: ${coordinateQuality.highConfidence} high, ${coordinateQuality.mediumConfidence} medium, ${coordinateQuality.lowConfidence} low confidence`);
    console.log(`🔍 Search stats: ${aggregatedSearchStats.successfulSearches}/${aggregatedSearchStats.totalSearches} successful searches`);
    console.log(`🔬 Validation stats: Avg distance ${validationStats.averageDistanceFromCenter.toFixed(2)}km, Overall score ${validationStats.averageOverallScore.toFixed(2)}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in generate-enhanced-tour:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate enhanced tour',
      details: error.message 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
