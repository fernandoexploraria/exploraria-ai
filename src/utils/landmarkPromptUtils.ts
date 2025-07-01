
import { Landmark } from '@/data/landmarks';

/**
 * Creates an enhanced prompt for landmark TTS using all available landmark data
 */
export const formEnhancedLandmarkPrompt = (landmark: Landmark): string => {
  // Start with basic name and description
  let prompt = `${landmark.name}. ${landmark.description}`;
  
  // Add rating context if available
  if (landmark.rating && landmark.rating > 0) {
    const primaryType = landmark.types?.[0]?.replace(/_/g, ' ') || 'location';
    prompt += ` This ${primaryType} has a ${landmark.rating} out of 5 star rating.`;
  }
  
  // Add location context if available
  if (landmark.formattedAddress) {
    prompt += ` Located at ${landmark.formattedAddress}.`;
  }
  
  // Add category context if multiple types available
  if (landmark.types && landmark.types.length > 1) {
    const primaryType = landmark.types[0].replace(/_/g, ' ');
    const secondaryTypes = landmark.types
      .slice(1, 3) // Take up to 2 additional types
      .map(type => type.replace(/_/g, ' '))
      .join(' and ');
    
    if (secondaryTypes) {
      prompt += ` This ${primaryType} is also known as a ${secondaryTypes}.`;
    }
  }
  
  // Add visual context if photos available
  if (landmark.photos && landmark.photos.length > 0) {
    prompt += ` Multiple photos are available showcasing this landmark.`;
  }
  
  return prompt;
};

/**
 * Creates enhanced prompts for different landmark sources
 */
export const getEnhancedLandmarkText = (landmark: Landmark, landmarkSource: 'tour' | 'top' | 'base' = 'base'): string => {
  switch (landmarkSource) {
    case 'tour':
    case 'top':
      // Tour and top landmarks have limited data, use basic format
      return `${landmark.name}. ${landmark.description}`;
    
    case 'base':
    default:
      // Base landmarks may have rich data, use enhanced format
      return formEnhancedLandmarkPrompt(landmark);
  }
};
