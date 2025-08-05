import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CityContentRequest {
  cityName: string;
  landmarks: Array<{
    name: string;
    coordinates: [number, number];
    description: string;
    place_id?: string;
  }>;
  coordinates: [number, number];
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-CITY-CONTENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("City content generation started");

    const { cityName, landmarks, coordinates }: CityContentRequest = await req.json();
    
    if (!cityName || !landmarks || !coordinates) {
      throw new Error("Missing required fields: cityName, landmarks, coordinates");
    }

    logStep("Processing city", { cityName, landmarkCount: landmarks.length });

    // Create Supabase client for Gemini API
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Generate rich city content using Gemini AI
    const cityPrompt = `Create comprehensive, SEO-optimized travel content for ${cityName}.

CONTEXT:
- City: ${cityName}
- Featured landmarks: ${landmarks.map(l => l.name).join(', ')}
- Target audience: Travelers seeking AI-powered tour experiences

CONTENT REQUIREMENTS:
1. SEO-optimized city description (300-400 words)
2. Compelling hero section text
3. Meta description (150-160 characters)
4. Meta keywords (10-15 relevant keywords)
5. Landmark highlights for each featured landmark
6. Local travel tips and insights
7. Best time to visit information
8. Transportation and getting around advice

TONE: Informative, engaging, and inspiring. Emphasize unique experiences and local insights.

FORMAT: Return as JSON with the following structure:
{
  "seoTitle": "Explore ${cityName} - AI Travel Guide | Exploraria",
  "metaDescription": "SEO meta description here",
  "metaKeywords": ["keyword1", "keyword2", ...],
  "heroTitle": "Compelling hero title",
  "heroDescription": "Hero section description",
  "cityDescription": "Main city description content",
  "landmarkHighlights": {
    "landmark_name": "highlight description"
  },
  "travelTips": ["tip1", "tip2", ...],
  "bestTimeToVisit": "When to visit information",
  "transportation": "Getting around information"
}`;

    logStep("Calling Gemini API for city content");

    const { data: geminiResponse, error: geminiError } = await supabaseClient.functions.invoke('gemini-chat', {
      body: {
        prompt: cityPrompt,
        systemInstruction: "You are a travel content expert specializing in creating SEO-optimized city guides. Generate comprehensive, unique content that helps travelers discover amazing experiences."
      }
    });

    if (geminiError) {
      throw new Error(`Gemini API error: ${geminiError.message}`);
    }

    logStep("Gemini content generated successfully");

    let cityContent;
    try {
      // Try to parse the JSON response
      const jsonMatch = geminiResponse.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cityContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      logStep("JSON parsing failed, using fallback structure");
      
      // Fallback structure if JSON parsing fails
      cityContent = {
        seoTitle: `Explore ${cityName} - AI Travel Guide | Exploraria`,
        metaDescription: `Discover ${cityName} with AI-powered tours and personalized recommendations. Explore landmarks, local insights, and unique experiences.`,
        metaKeywords: [`${cityName} travel`, `${cityName} tours`, "AI travel guide", "travel planning"],
        heroTitle: `Discover ${cityName} with AI`,
        heroDescription: `Experience ${cityName} like never before with AI-powered tours and local insights.`,
        cityDescription: geminiResponse.response,
        landmarkHighlights: {},
        travelTips: [`Visit ${cityName}'s top landmarks`, "Use AI-powered recommendations", "Explore local neighborhoods"],
        bestTimeToVisit: "Year-round destination with seasonal highlights",
        transportation: "Multiple transportation options available"
      };
    }

    // Add tour generation data
    const tourGenerationData = {
      coordinates,
      primaryLandmark: landmarks[0],
      availableLandmarks: landmarks
    };

    // Generate JSON-LD schema
    const schema = {
      "@context": "https://schema.org",
      "@type": "Place",
      "name": cityName,
      "description": cityContent.cityDescription,
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": coordinates[1],
        "longitude": coordinates[0]
      },
      "containsPlace": landmarks.map(landmark => ({
        "@type": "TouristAttraction",
        "name": landmark.name,
        "description": landmark.description,
        "geo": {
          "@type": "GeoCoordinates", 
          "latitude": landmark.coordinates[1],
          "longitude": landmark.coordinates[0]
        }
      }))
    };

    const finalContent = {
      ...cityContent,
      cityName,
      slug: cityName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      tourGenerationData,
      schema,
      generatedAt: new Date().toISOString()
    };

    logStep("City content generation completed", { cityName });

    return new Response(JSON.stringify(finalContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in city content generation", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});