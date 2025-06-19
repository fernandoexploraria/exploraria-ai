
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
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
    console.log('Starting landmark image analysis...');
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
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
      ? `You are an expert landmark identification system. Analyze this image and identify any landmarks.

Priority landmarks from the user's tour plan:
${landmarksList}

Please identify the landmark in the image and provide:
1. The exact name of the landmark
2. Your confidence level (0.0 to 1.0)
3. A brief description of what you see
4. Whether this landmark is from the user's tour plan (is_from_tour: true/false)
5. Any additional interesting information about the landmark

Respond in JSON format:
{
  "landmark_name": "Name of the landmark",
  "confidence": 0.95,
  "description": "What you observe in the image",
  "is_from_tour": true,
  "additional_info": "Interesting facts or context"
}`
      : `You are an expert landmark identification system. Analyze this image and identify any landmarks you can see.

Please identify the landmark in the image and provide:
1. The exact name of the landmark
2. Your confidence level (0.0 to 1.0)
3. A brief description of what you see
4. Any additional interesting information about the landmark

Respond in JSON format:
{
  "landmark_name": "Name of the landmark",
  "confidence": 0.95,
  "description": "What you observe in the image",
  "is_from_tour": false,
  "additional_info": "Interesting facts or context"
}`;

    console.log('Sending request to OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');

    const aiResponse = data.choices[0].message.content;
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
        landmark_name: "Unknown Landmark",
        confidence: 0.5,
        description: "Unable to parse the landmark analysis response",
        is_from_tour: false,
        additional_info: "Please try again with a clearer image"
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
        landmark_name: "Error",
        confidence: 0,
        description: "Failed to analyze the image",
        is_from_tour: false
      }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
