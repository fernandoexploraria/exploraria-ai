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

    console.log(`[GET-PLACE-POPULARITY] Fetching popularity for place_id: ${place_id}`);

    // Use Places API v1 to get place details with current popularity
    const placeDetailsUrl = `https://places.googleapis.com/v1/places/${place_id}?fields=currentOpeningHours,displayName,userRatingCount,rating&key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(placeDetailsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error(`Place Details API error: ${response.status}`);
      throw new Error(`Place Details API error: ${response.status}`);
    }

    const placeData = await response.json();
    console.log(`[GET-PLACE-POPULARITY] Place data received for ${placeData.displayName?.text || 'Unknown place'}`);

    // Extract popularity/crowd data
    const currentHours = placeData.currentOpeningHours;
    let crowdLevel = 'unknown';
    let popularityMessage = 'Live crowd data not available';
    
    // Note: Google Places API v1 doesn't provide real-time crowd data in the same way as v0
    // We'll provide a general assessment based on available data
    if (currentHours && currentHours.openNow) {
      const rating = placeData.rating;
      const reviewCount = placeData.userRatingCount;
      
      if (rating && reviewCount) {
        // Estimate popularity based on rating and review count
        if (rating >= 4.5 && reviewCount > 1000) {
          crowdLevel = 'very_popular';
          popularityMessage = 'This is a very popular destination with high ratings. Expect crowds, especially during peak hours.';
        } else if (rating >= 4.0 && reviewCount > 500) {
          crowdLevel = 'popular';
          popularityMessage = 'This is a popular destination. It may be moderately busy.';
        } else if (rating >= 3.5) {
          crowdLevel = 'moderate';
          popularityMessage = 'This destination has moderate popularity. Crowds are typically manageable.';
        } else {
          crowdLevel = 'quiet';
          popularityMessage = 'This destination is generally less crowded.';
        }
      } else {
        popularityMessage = 'Currently open, but specific crowd data is not available.';
      }
    } else if (currentHours) {
      popularityMessage = 'Place is currently closed.';
      crowdLevel = 'closed';
    }

    // Add time-based context
    const currentHour = new Date().getHours();
    let timeContext = '';
    
    if (currentHour >= 9 && currentHour <= 11) {
      timeContext = ' Morning hours typically see moderate crowds.';
    } else if (currentHour >= 12 && currentHour <= 14) {
      timeContext = ' Lunch hours can be particularly busy.';
    } else if (currentHour >= 15 && currentHour <= 17) {
      timeContext = ' Afternoon is usually a popular time to visit.';
    } else if (currentHour >= 18 && currentHour <= 20) {
      timeContext = ' Evening hours may vary in popularity depending on the venue type.';
    }

    const result = {
      place_id,
      place_name: placeData.displayName?.text || 'Unknown place',
      crowd_level: crowdLevel,
      message: popularityMessage + timeContext,
      rating: placeData.rating || null,
      review_count: placeData.userRatingCount || null,
      is_open: currentHours?.openNow || false,
      current_hour: currentHour
    };

    console.log(`[GET-PLACE-POPULARITY] Returning result:`, result);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[GET-PLACE-POPULARITY] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch place popularity',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});