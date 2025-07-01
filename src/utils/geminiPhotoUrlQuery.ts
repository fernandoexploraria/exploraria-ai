
import { supabase } from '@/integrations/supabase/client';

export const queryGeminiAboutPhotoUrls = async () => {
  const prompt = `I'm having issues with Google Places Photo API URL construction and validation in my web application. Can you help me understand:

1. **Correct URL Format**: What is the proper format for Google Places Photo API URLs using the new Places API (v1)? I'm currently constructing URLs like:
   https://places.googleapis.com/v1/places/ChIJVXmuMcP_0YURBRTMHESl2zo/photos/ATKogpeBnhWkTVfyWickBLX5S83q7WQQW6S2kmxP_GygOKWYEXsY2gg6s/media?maxWidthPx=800&key=API_KEY

2. **URL Validation Logic**: What should a robust URL validation function check for when validating Google Places Photo URLs? My current validation:
   \`\`\`javascript
   const isValidUrl = (url: string): boolean => {
     try {
       new URL(url);
       return url.includes('http');
     } catch {
       return false;
     }
   };
   \`\`\`

3. **Common Issues**: What are the most common problems that cause Google Places Photo URLs to fail validation or loading? 

4. **Photo Reference Formats**: What are the different formats photo references can have from the Google Places API? I'm seeing references like:
   - places/ChIJVXmuMcP_0YURBRTMHESl2zo/photos/ATKogpeBnhWkTVfyWickBLX5S83q7WQQW6S2kmxP_GygOKWYEXsY2gg6s
   - ATKogpeBnhWkTVfyWickBLX5S83q7WQQW6S2kmxP_GygOKWYEXsY2gg6s

5. **Best Practices**: What are the best practices for:
   - Constructing photo URLs from photo references
   - Validating URLs before attempting to load them
   - Error handling when URLs fail to load
   - Caching and optimization strategies

6. **Security Considerations**: Are there any security considerations I should be aware of when handling Google Places Photo URLs?

Please provide specific, actionable recommendations that I can implement in my TypeScript/React application.`;

  try {
    const { data, error } = await supabase.functions.invoke('gemini-chat', {
      body: {
        prompt,
        systemInstruction: "You are an expert in Google Places API and web development. Provide detailed, technical answers with specific code examples and best practices. Focus on practical implementation details."
      }
    });

    if (error) {
      console.error('Gemini API error:', error);
      return null;
    }

    return data.response;
  } catch (err) {
    console.error('Error calling Gemini API:', err);
    return null;
  }
};
