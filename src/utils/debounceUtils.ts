
/**
 * Debounce utility functions for proximity alerts
 */

// Create a debounced version of a function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Create a throttled version of a function (allows first call immediately)
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall >= wait) {
      lastCall = now;
      func(...args);
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, wait - (now - lastCall));
    }
  };
};

// Deduplication utility for objects
export const deduplicate = <T>(
  items: T[],
  keySelector: (item: T) => string | number
): T[] => {
  const seen = new Set();
  return items.filter(item => {
    const key = keySelector(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};
