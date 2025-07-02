
/**
 * Maps Google Places API v1 price level enum strings to integers
 * with a fallback value of 9999 for unknown enums
 */
export const mapPriceLevel = (priceLevel: string | number | null | undefined): number | null => {
  // Handle null/undefined cases
  if (priceLevel === null || priceLevel === undefined) {
    return null;
  }

  // If it's already a number, validate it's in expected range
  if (typeof priceLevel === 'number') {
    if (priceLevel >= 0 && priceLevel <= 4) {
      return priceLevel;
    }
    // Unknown numeric value, use fallback
    console.warn('Unknown numeric price level:', priceLevel, 'using fallback 9999');
    return 9999;
  }

  // Map Google Places API v1 string enums to integers
  const priceLevelMap: Record<string, number> = {
    'PRICE_LEVEL_FREE': 0,
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 4
  };

  const mappedValue = priceLevelMap[priceLevel];
  
  if (mappedValue !== undefined) {
    return mappedValue;
  }

  // Unknown enum value, log for monitoring and use fallback
  console.warn('Unknown price level enum:', priceLevel, 'using fallback 9999');
  return 9999;
};

/**
 * Formats price level for display in UI
 */
export const formatPriceLevel = (priceLevel: number | null): string => {
  if (priceLevel === null) {
    return 'Price not available';
  }

  switch (priceLevel) {
    case 0:
      return 'Free';
    case 1:
      return '$';
    case 2:
      return '$$';
    case 3:
      return '$$$';
    case 4:
      return '$$$$';
    case 9999:
      return 'Price level unknown';
    default:
      return 'Price not available';
  }
};
