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
    const { place_id, limit = 3 } = await req.json();
    
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

    console.log(`[GET-PLACE-REVIEWS] Fetching reviews for place_id: ${place_id}, limit: ${limit}`);

    // Use Places API v1 to get place details with reviews
    const placeDetailsUrl = `https://places.googleapis.com/v1/places/${place_id}?fields=reviews,displayName,rating,userRatingCount&key=${GOOGLE_API_KEY}`;
    
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
    console.log(`[GET-PLACE-REVIEWS] Place data received for ${placeData.displayName?.text || 'Unknown place'}`);

    // Extract and process reviews
    const reviews = placeData.reviews || [];
    const processedReviews = reviews.slice(0, limit).map((review: any) => ({
      author: review.authorAttribution?.displayName || 'Anonymous',
      rating: review.rating || null,
      text: review.text?.text || '',
      relative_time: review.relativePublishTimeDescription || 'Recently',
      helpful: review.rating >= 4 ? true : false
    }));

    // Generate summary
    let summary = '';
    if (processedReviews.length > 0) {
      const avgRating = processedReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / processedReviews.length;
      const positiveCount = processedReviews.filter((r: any) => r.rating >= 4).length;
      
      summary = `Recent visitors generally ${positiveCount >= processedReviews.length / 2 ? 'recommend' : 'have mixed feelings about'} this place. `;
      summary += `Average recent rating: ${avgRating.toFixed(1)}/5.`;
    } else {
      summary = 'No recent reviews available for this location.';
    }

    const result = {
      place_id,
      place_name: placeData.displayName?.text || 'Unknown place',
      overall_rating: placeData.rating || null,
      total_reviews: placeData.userRatingCount || null,
      recent_reviews: processedReviews,
      summary: summary,
      reviews_available: reviews.length > 0
    };

    console.log(`[GET-PLACE-REVIEWS] Returning ${processedReviews.length} reviews`);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[GET-PLACE-REVIEWS] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch place reviews',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});