
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeatherRequest {
  latitude: number;
  longitude: number;
  landmarkName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude, landmarkName }: WeatherRequest = await req.json();
    
    console.log(`Fetching weather for ${landmarkName} at ${latitude}, ${longitude}`);
    
    // Using OpenWeatherMap free API (no key required for current weather)
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${Deno.env.get('OPENWEATHER_API_KEY')}&units=metric`;
    
    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
      throw new Error(`Weather API error: ${weatherResponse.status}`);
    }
    
    const weatherData = await weatherResponse.json();
    
    const result = {
      landmark: landmarkName,
      location: {
        latitude,
        longitude
      },
      weather: {
        temperature: weatherData.main.temp,
        description: weatherData.weather[0].description,
        humidity: weatherData.main.humidity,
        windSpeed: weatherData.wind.speed,
        feelsLike: weatherData.main.feels_like
      },
      timestamp: new Date().toISOString()
    };

    console.log('Weather data retrieved successfully:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in weather-tool function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        landmark: 'Unknown',
        weather: null 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
