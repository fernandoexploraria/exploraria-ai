
import { useState } from 'react';
import { queryGeminiAboutPhotoUrls } from '@/utils/geminiPhotoUrlQuery';

export const useGeminiPhotoUrlAdvice = () => {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getPhotoUrlAdvice = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🤖 Querying Gemini about Google Places Photo API URLs...');
      const response = await queryGeminiAboutPhotoUrls();
      
      if (response) {
        console.log('✅ Received Gemini advice about photo URLs');
        console.log('📋 Gemini Response:', response);
        setAdvice(response);
        return response;
      } else {
        const errorMsg = 'Failed to get advice from Gemini';
        setError(errorMsg);
        console.error('❌', errorMsg);
        return null;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('❌ Error getting Gemini advice:', errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    getPhotoUrlAdvice,
    advice,
    loading,
    error
  };
};
