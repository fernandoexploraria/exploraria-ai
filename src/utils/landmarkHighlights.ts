// Utility for generating curated landmark highlights based on place types and data

export interface LandmarkHighlight {
  name: string;
  type: string;
  highlight: string;
  rating?: number;
  userRatingsTotal?: number;
}

/**
 * Generates a curated highlight for a landmark based on its type and available data
 */
export function generateLandmarkHighlight(landmark: any): LandmarkHighlight {
  const primaryType = landmark.types?.[0] || 'place';
  const name = landmark.name || 'Unknown Place';
  
  let highlight = '';
  
  // Generate highlights based on place type and available data
  if (landmark.editorialSummary) {
    // Use editorial summary if available, but keep it concise
    highlight = landmark.editorialSummary.length > 120 
      ? landmark.editorialSummary.substring(0, 120) + '...'
      : landmark.editorialSummary;
  } else {
    // Generate type-specific highlights
    switch (primaryType) {
      case 'tourist_attraction':
        highlight = `A captivating attraction that draws visitors from around the world. ${landmark.rating ? `Rated ${landmark.rating}/5 stars` : 'A must-see destination'} that offers unique experiences and memorable moments.`;
        break;
      case 'museum':
        highlight = `A fascinating museum housing important collections and exhibitions. ${landmark.rating ? `Visitors rate it ${landmark.rating}/5 stars` : 'Perfect for culture enthusiasts'} with engaging displays and educational experiences.`;
        break;
      case 'park':
        highlight = `A beautiful green space offering tranquility and natural beauty. ${landmark.rating ? `Loved by visitors (${landmark.rating}/5 stars)` : 'Ideal for relaxation'} with scenic paths and peaceful surroundings.`;
        break;
      case 'church':
      case 'place_of_worship':
        highlight = `A sacred and historically significant place of worship. ${landmark.rating ? `Admired by visitors (${landmark.rating}/5 stars)` : 'Notable for its architecture'} featuring beautiful design and spiritual atmosphere.`;
        break;
      case 'restaurant':
        highlight = `A delightful dining establishment serving authentic local cuisine. ${landmark.rating ? `Highly rated at ${landmark.rating}/5 stars` : 'Popular with locals'} offering delicious meals and cultural flavors.`;
        break;
      case 'shopping_mall':
      case 'store':
        highlight = `A vibrant shopping destination with diverse offerings. ${landmark.rating ? `Shoppers rate it ${landmark.rating}/5 stars` : 'Great for retail therapy'} featuring local and international brands.`;
        break;
      case 'art_gallery':
        highlight = `An inspiring art gallery showcasing creative works and exhibitions. ${landmark.rating ? `Art lovers rate it ${landmark.rating}/5 stars` : 'Perfect for art enthusiasts'} with remarkable collections and rotating displays.`;
        break;
      case 'library':
        highlight = `A knowledge hub and cultural center serving the community. ${landmark.rating ? `Valued by visitors (${landmark.rating}/5 stars)` : 'Important cultural institution'} offering resources and quiet study spaces.`;
        break;
      case 'stadium':
        highlight = `An impressive sports and entertainment venue hosting major events. ${landmark.rating ? `Event-goers rate it ${landmark.rating}/5 stars` : 'Known for exciting atmosphere'} with modern facilities and great views.`;
        break;
      case 'university':
        highlight = `A prestigious educational institution contributing to the city's intellectual landscape. ${landmark.rating ? `Students and visitors rate it ${landmark.rating}/5 stars` : 'Important academic center'} with beautiful campus and rich history.`;
        break;
      default:
        // Generic highlight for other types
        if (landmark.rating && landmark.rating >= 4.0) {
          highlight = `A highly-rated local gem that shouldn't be missed! With ${landmark.rating}/5 stars, it's clearly beloved by visitors and offers something special worth experiencing.`;
        } else if (landmark.rating) {
          highlight = `A notable ${primaryType} in the area with a ${landmark.rating}/5 star rating. It offers unique insights into local culture and is worth a visit.`;
        } else {
          highlight = `An interesting ${primaryType} that adds character to the neighborhood. Perfect for discovering hidden gems and local culture during your exploration.`;
        }
    }
  }
  
  return {
    name,
    type: primaryType,
    highlight,
    rating: landmark.rating,
    userRatingsTotal: landmark.userRatingsTotal
  };
}

/**
 * Generates highlights for multiple landmarks
 */
export function generateLandmarkHighlights(landmarks: any[]): LandmarkHighlight[] {
  return landmarks.map(generateLandmarkHighlight);
}
