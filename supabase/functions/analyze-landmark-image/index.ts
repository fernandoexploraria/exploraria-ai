
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const googleAIApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Landmark {
  name: string;
  coordinates: [number, number];
  description: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting landmark image analysis with Gemini Vision...');
    
    if (!googleAIApiKey) {
      throw new Error('Google AI API key not configured');
    }

    const { image, plannedLandmarks } = await req.json();
    
    if (!image) {
      throw new Error('No image data provided');
    }

    console.log('Planned landmarks count:', plannedLandmarks?.length || 0);

    // Create the prompt for landmark identification
    const landmarksList = plannedLandmarks && plannedLandmarks.length > 0 
      ? plannedLandmarks.map((l: Landmark) => `- ${l.name}: ${l.description}`).join('\n')
      : '';

    const prompt = plannedLandmarks && plannedLandmarks.length > 0
      ? `You are an expert landmark and cultural site identification system. Analyze this image and identify any landmarks, monuments, artworks, sculptures, or cultural sites.

Priority landmarks from the user's tour plan:
${landmarksList}

Please provide a comprehensive analysis including:
1. The exact name of the landmark/site/artwork
2. Your confidence level (0.0 to 1.0)
3. Historical background and significance
4. Architectural or artistic details
5. Cultural importance and interesting facts
6. Whether this landmark is from the user's tour plan (is_from_tour: true/false)
7. Best times to visit or viewing tips
8. Any legends, stories, or fascinating trivia

Respond in JSON format:
{
  "landmark_name": "Name of the landmark/site/artwork",
  "confidence": 0.95,
  "description": "Rich description with historical context",
  "is_from_tour": true,
  "additional_info": "Detailed cultural significance, interesting facts, legends, and visitor tips"
}`
      : `You are an expert landmark and cultural site identification system. Analyze this image and identify any landmarks, monuments, artworks, sculptures, buildings, or cultural sites you can see.

Please provide a comprehensive analysis including:
1. The exact name of the landmark/site/artwork
2. Your confidence level (0.0 to 1.0)  
3. Historical background and significance
4. Architectural or artistic details
5. Cultural importance and interesting facts
6. Best times to visit or viewing tips
7. Any legends, stories, or fascinating trivia

Respond in JSON format:
{
  "landmark_name": "Name of the landmark/site/artwork",
  "confidence": 0.95,
  "description": "Rich description with historical context",
  "is_from_tour": false,
  "additional_info": "Detailed cultural significance, interesting facts, legends, and visitor tips"
}`;

    console.log('Sending request to Google AI (Gemini Vision)...');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${googleAIApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: image
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google AI API error:', errorData);
      throw new Error(`Google AI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Gemini Vision response received');

    const aiResponse = data.candidates[0].content.parts[0].text;
    console.log('AI response:', aiResponse);

    // Parse the JSON response
    let analysisResult;
    try {
      // Clean the response in case it has markdown formatting
      const cleanedResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
      analysisResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Fallback response
      analysisResult = {
        landmark_name: "Cultural Site Detected",
        confidence: 0.7,
        description: "A significant location has been identified in the image. The AI was able to analyze the visual elements but encountered an issue with detailed formatting.",
        is_from_tour: false,
        additional_info: "Please try again with a clearer image for more detailed cultural and historical information"
      };
    }

    console.log('Analysis result:', analysisResult);

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-landmark-image function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        landmark_name: "Analysis Error",
        confidence: 0,
        description: "Failed to analyze the image with Gemini Vision",
        is_from_tour: false,
        additional_info: "Please check your internet connection and try again"
      }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
