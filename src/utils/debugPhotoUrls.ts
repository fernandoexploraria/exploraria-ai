
import { useGeminiPhotoUrlAdvice } from '@/hooks/useGeminiPhotoUrlAdvice';

// Immediately execute the Gemini query when this file is imported
const executeGeminiQuery = async () => {
  console.log('🚀 Starting Gemini query about Google Places Photo URLs...');
  
  // Create a temporary instance to get advice
  const advice = await import('@/utils/geminiPhotoUrlQuery').then(module => 
    module.queryGeminiAboutPhotoUrls()
  );
  
  if (advice) {
    console.log('🤖 GEMINI ADVICE FOR PHOTO URLs:');
    console.log('=====================================');
    console.log(advice);
    console.log('=====================================');
  } else {
    console.error('❌ Failed to get Gemini advice');
  }
};

// Execute immediately
executeGeminiQuery().catch(error => {
  console.error('❌ Error executing Gemini query:', error);
});

export { executeGeminiQuery };
