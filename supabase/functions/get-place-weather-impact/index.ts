import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { place_id } = await req.json();
    
    if (!place_id) {
      return new Response(
        JSON.stringify({ error: 'place_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.error('Google API key not found');
      return new Response(
        JSON.stringify({ error: 'Google API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[GET-PLACE-WEATHER-IMPACT] Getting weather impact for place_id: ${place_id}`);

    // First, get the place details to get coordinates and types
    const placeDetailsUrl = `https://places.googleapis.com/v1/places/${place_id}?fields=location,displayName,types,formattedAddress&key=${GOOGLE_API_KEY}`;
    
    const placeResponse = await fetch(placeDetailsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!placeResponse.ok) {
      console.error(`Place Details API error: ${placeResponse.status}`);
      throw new Error(`Place Details API error: ${placeResponse.status}`);
    }

    const placeData = await placeResponse.json();
    const location = placeData.location;
    
    if (!location || !location.latitude || !location.longitude) {
      throw new Error('Could not get place coordinates for weather data');
    }

    // Note: This is a simplified weather impact analysis
    // In a production environment, you would integrate with a weather API like OpenWeatherMap
    // For this implementation, we'll provide weather-conscious advice based on place type
    
    const placeTypes = placeData.types || [];
    const placeName = placeData.displayName?.text || 'Unknown place';
    
    // Analyze place type for weather sensitivity
    let weatherSensitivity = 'moderate';
    let recommendations = [];
    
    // Outdoor venues
    if (placeTypes.some((type: string) => 
      ['park', 'zoo', 'amusement_park', 'tourist_attraction', 'natural_feature', 'campground'].includes(type)
    )) {
      weatherSensitivity = 'high';
      recommendations.push('Check weather conditions before visiting as this is primarily an outdoor attraction');
      recommendations.push('Consider bringing sun protection or rain gear depending on forecast');
      recommendations.push('Best enjoyed during pleasant weather conditions');
    }
    // Museums and indoor venues
    else if (placeTypes.some((type: string) => 
      ['museum', 'art_gallery', 'shopping_mall', 'movie_theater', 'library'].includes(type)
    )) {
      weatherSensitivity = 'low';
      recommendations.push('Weather has minimal impact - this is primarily an indoor venue');
      recommendations.push('Great option during inclement weather');
    }
    // Mixed indoor/outdoor venues
    else if (placeTypes.some((type: string) => 
      ['restaurant', 'cafe', 'store', 'establishment'].includes(type)
    )) {
      weatherSensitivity = 'low_to_moderate';
      recommendations.push('Weather impact depends on whether you plan to dine/shop indoors or outdoors');
      recommendations.push('Most activities can continue regardless of weather');
    }
    // Religious and cultural sites
    else if (placeTypes.some((type: string) => 
      ['church', 'hindu_temple', 'mosque', 'synagogue', 'place_of_worship'].includes(type)
    )) {
      weatherSensitivity = 'moderate';
      recommendations.push('While the interior is weather-protected, consider conditions for walking to/from the site');
      recommendations.push('Some outdoor areas or courtyards may be affected by weather');
    }
    // Default case
    else {
      recommendations.push('Weather impact varies - check current conditions before visiting');
      recommendations.push('Consider indoor alternatives during severe weather');
    }

    // Add general weather-conscious travel advice
    recommendations.push('Always check local weather forecasts for the most current conditions');
    
    // Get current time for context
    const currentHour = new Date().getHours();
    let timeAdvice = '';
    
    if (currentHour >= 6 && currentHour <= 10) {
      timeAdvice = 'Morning visits often have the most pleasant weather conditions.';
    } else if (currentHour >= 11 && currentHour <= 15) {
      timeAdvice = 'Midday can be the warmest part of the day - consider sun protection for outdoor venues.';
    } else if (currentHour >= 16 && currentHour <= 19) {
      timeAdvice = 'Afternoon/evening hours often provide comfortable visiting conditions.';
    } else {
      timeAdvice = 'Evening visits may have cooler temperatures and different lighting conditions.';
    }

    const result = {
      place_id,
      place_name: placeName,
      place_types: placeTypes,
      weather_sensitivity: weatherSensitivity,
      coordinates: {
        latitude: location.latitude,
        longitude: location.longitude
      },
      recommendations: recommendations,
      time_advice: timeAdvice,
      general_advice: `${placeName} has ${weatherSensitivity} weather sensitivity. ${timeAdvice}`,
      note: 'For current weather conditions, check a dedicated weather service for this location.'
    };

    console.log(`[GET-PLACE-WEATHER-IMPACT] Returning weather impact analysis for ${placeName}`);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[GET-PLACE-WEATHER-IMPACT] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze weather impact',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});