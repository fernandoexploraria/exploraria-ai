import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TimezoneRequest {
  location: string; // "lat,lng" format
  timestamp: number; // Unix timestamp
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, timestamp }: TimezoneRequest = await req.json();
    
    console.log('🌍 Google Timezone API request:', {
      location,
      timestamp,
      formattedTime: new Date(timestamp * 1000).toISOString()
    });

    if (!location || !timestamp) {
      throw new Error('Location and timestamp are required');
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      console.error('❌ Google API key not configured');
      throw new Error('Google API key not configured');
    }

    // Call Google Time Zone API
    const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${location}&timestamp=${timestamp}&key=${googleApiKey}`;
    
    console.log('📡 Calling Google Time Zone API:', { location, timestamp });

    const response = await fetch(url);
    const data = await response.json();

    console.log('📡 Google Time Zone API response:', {
      status: data.status,
      timeZoneId: data.timeZoneId,
      timeZoneName: data.timeZoneName
    });

    if (!response.ok || data.status !== 'OK') {
      console.error('❌ Google Time Zone API error:', {
        status: response.status,
        apiStatus: data.status,
        errorMessage: data.errorMessage || data.error_message
      });
      throw new Error(`Google Time Zone API error: ${data.status} - ${data.errorMessage || data.error_message || 'Unknown error'}`);
    }

    const result = {
      success: true,
      timezone: {
        timeZoneId: data.timeZoneId,
        timeZoneName: data.timeZoneName,
        rawOffset: data.rawOffset,
        dstOffset: data.dstOffset
      }
    };

    console.log('✅ Timezone information retrieved successfully:', result.timezone);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Google Timezone error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred',
      debug: {
        errorType: error.name,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});