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

    console.log(`[GET-PLACE-HOURS] Fetching hours for place_id: ${place_id}`);

    // Use Places API v1 to get place details with opening hours
    const placeDetailsUrl = `https://places.googleapis.com/v1/places/${place_id}?fields=regularOpeningHours,currentOpeningHours,displayName&key=${GOOGLE_API_KEY}`;
    
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
    console.log(`[GET-PLACE-HOURS] Place data received for ${placeData.displayName?.text || 'Unknown place'}`);

    // Extract current status and hours
    const currentHours = placeData.currentOpeningHours;
    const regularHours = placeData.regularOpeningHours;
    
    let status = 'unknown';
    let message = 'Hours information not available';
    let todayHours = null;

    if (currentHours) {
      status = currentHours.openNow ? 'open' : 'closed';
      
      // Get today's hours if available
      if (currentHours.periods && currentHours.periods.length > 0) {
        const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
        const todayPeriod = currentHours.periods.find((period: any) => 
          period.open?.day === today
        );
        
        if (todayPeriod) {
          const openTime = todayPeriod.open?.time || 'Unknown';
          const closeTime = todayPeriod.close?.time || 'Unknown';
          todayHours = `${openTime} - ${closeTime}`;
        }
      }
      
      message = status === 'open' 
        ? `Currently open${todayHours ? ` (${todayHours})` : ''}`
        : `Currently closed${todayHours ? ` (opens at ${todayHours.split(' - ')[0]})` : ''}`;
    } else if (regularHours) {
      // Fallback to regular hours if current hours not available
      message = 'Regular hours available, but current status unknown';
      status = 'unknown';
    }

    const result = {
      place_id,
      place_name: placeData.displayName?.text || 'Unknown place',
      status,
      message,
      today_hours: todayHours,
      has_hours_data: !!(currentHours || regularHours)
    };

    console.log(`[GET-PLACE-HOURS] Returning result:`, result);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[GET-PLACE-HOURS] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch place hours',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});