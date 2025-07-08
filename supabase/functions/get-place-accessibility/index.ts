import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    console.log(`🔍 [get-place-accessibility] Fetching accessibility info for place_id: ${place_id}`);

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google API key not configured');
    }

    // Use Google Places API (New) Place Details to get accessibility information
    const fieldsToRequest = [
      'accessibilityOptions',
      'displayName',
      'formattedAddress'
    ].join(',');

    const placeDetailsUrl = `https://places.googleapis.com/v1/places/${place_id}?fields=${fieldsToRequest}&key=${googleApiKey}`;
    
    console.log(`🔍 [get-place-accessibility] Making request to: ${placeDetailsUrl}`);

    const response = await fetch(placeDetailsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🚨 [get-place-accessibility] Google Places API error: ${response.status} - ${errorText}`);
      throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
    }

    const placeData = await response.json();
    console.log(`✅ [get-place-accessibility] Place data retrieved:`, JSON.stringify(placeData, null, 2));

    // Extract accessibility information
    const accessibilityInfo = {
      place_name: placeData.displayName?.text || 'Unknown Place',
      address: placeData.formattedAddress || 'Address not available',
      accessibility_features: {
        wheelchair_accessible_entrance: placeData.accessibilityOptions?.wheelchairAccessibleEntrance || null,
        wheelchair_accessible_parking: placeData.accessibilityOptions?.wheelchairAccessibleParking || null,
        wheelchair_accessible_restroom: placeData.accessibilityOptions?.wheelchairAccessibleRestroom || null,
        wheelchair_accessible_seating: placeData.accessibilityOptions?.wheelchairAccessibleSeating || null,
      },
      accessibility_options: placeData.accessibilityOptions || null,
      has_accessibility_data: !!(
        placeData.accessibilityOptions?.wheelchairAccessibleEntrance !== undefined ||
        placeData.accessibilityOptions?.wheelchairAccessibleParking !== undefined ||
        placeData.accessibilityOptions?.wheelchairAccessibleRestroom !== undefined ||
        placeData.accessibilityOptions?.wheelchairAccessibleSeating !== undefined ||
        placeData.accessibilityOptions
      )
    };

    console.log(`✅ [get-place-accessibility] Processed accessibility info:`, JSON.stringify(accessibilityInfo, null, 2));

    // Generate a user-friendly summary
    let summary = `Accessibility information for ${accessibilityInfo.place_name}:\n`;
    
    if (!accessibilityInfo.has_accessibility_data) {
      summary += "• No specific accessibility information is available for this location.";
    } else {
      const features = accessibilityInfo.accessibility_features;
      
      if (features.wheelchair_accessible_entrance !== null) {
        summary += `• Wheelchair accessible entrance: ${features.wheelchair_accessible_entrance ? 'Yes' : 'No'}\n`;
      }
      
      if (features.wheelchair_accessible_parking !== null) {
        summary += `• Wheelchair accessible parking: ${features.wheelchair_accessible_parking ? 'Yes' : 'No'}\n`;
      }
      
      if (features.wheelchair_accessible_restroom !== null) {
        summary += `• Wheelchair accessible restroom: ${features.wheelchair_accessible_restroom ? 'Yes' : 'No'}\n`;
      }
      
      if (features.wheelchair_accessible_seating !== null) {
        summary += `• Wheelchair accessible seating: ${features.wheelchair_accessible_seating ? 'Yes' : 'No'}\n`;
      }
      
      if (accessibilityInfo.accessibility_options) {
        summary += `• Additional accessibility options: Available\n`;
      }
    }

    const result = {
      place_id,
      accessibility_info: accessibilityInfo,
      summary: summary.trim(),
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('🚨 [get-place-accessibility] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});