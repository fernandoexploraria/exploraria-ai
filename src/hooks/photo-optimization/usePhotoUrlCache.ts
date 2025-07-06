
import { useCallback, useRef } from 'react';

interface CachedUrl {
  url: string;
  timestamp: number;
  isValid: boolean;
  accessCount: number;
  lastAccess: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  totalSize: number;
}

interface PhotoUrlCacheConfig {
  maxSize: number;
  validUrlTtl: number; // TTL for valid URLs (ms)
  invalidUrlTtl: number; // TTL for invalid URLs (ms)
}

const DEFAULT_CONFIG: PhotoUrlCacheConfig = {
  maxSize: 500,
  validUrlTtl: 30 * 60 * 1000, // 30 minutes
  invalidUrlTtl: 5 * 60 * 1000, // 5 minutes
};

export const usePhotoUrlCache = (config: Partial<PhotoUrlCacheConfig> = {}) => {
  const cacheConfig = { ...DEFAULT_CONFIG, ...config };
  const cacheRef = useRef<Map<string, CachedUrl>>(new Map());
  const metricsRef = useRef<CacheMetrics>({
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    totalSize: 0
  });

  // Generate cache key for photo reference
  const generateCacheKey = useCallback((photoRef: string, size: string): string => {
    return `${photoRef}:${size}`;
  }, []);

  // Check if cached entry is still valid
  const isEntryValid = useCallback((entry: CachedUrl): boolean => {
    const now = Date.now();
    const ttl = entry.isValid ? cacheConfig.validUrlTtl : cacheConfig.invalidUrlTtl;
    return (now - entry.timestamp) < ttl;
  }, [cacheConfig]);

  // Evict least recently used entries when cache is full
  const evictLRU = useCallback(() => {
    if (cacheRef.current.size < cacheConfig.maxSize) return;

    let oldestKey = '';
    let oldestAccess = Date.now();

    for (const [key, entry] of cacheRef.current.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cacheRef.current.delete(oldestKey);
      metricsRef.current.evictions++;
      metricsRef.current.totalSize--;
      // Only log evictions in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`📸 Cache evicted LRU entry: ${oldestKey}`);
      }
    }
  }, [cacheConfig.maxSize]);

  // Get cached URL
  const getCachedUrl = useCallback((photoRef: string, size: string): string | null => {
    const key = generateCacheKey(photoRef, size);
    const entry = cacheRef.current.get(key);

    if (!entry) {
      metricsRef.current.misses++;
      // Only log cache misses in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`📸 Cache miss: ${key}`);
      }
      return null;
    }

    if (!isEntryValid(entry)) {
      cacheRef.current.delete(key);
      metricsRef.current.misses++;
      metricsRef.current.totalSize--;
      // Only log cache expiry in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`📸 Cache expired: ${key}`);
      }
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccess = Date.now();
    metricsRef.current.hits++;
    
    // Reduce cache hit logging frequency - only log every 10th access
    if (process.env.NODE_ENV === 'development' && entry.accessCount % 10 === 1) {
      console.log(`📸 Cache hit: ${key} (accessed ${entry.accessCount} times)`);
    }
    return entry.isValid ? entry.url : null;
  }, [generateCacheKey, isEntryValid]);

  // Cache URL with validation status
  const setCachedUrl = useCallback((
    photoRef: string, 
    size: string, 
    url: string, 
    isValid: boolean = true
  ) => {
    const key = generateCacheKey(photoRef, size);
    
    // Evict if necessary
    evictLRU();

    const now = Date.now();
    const entry: CachedUrl = {
      url,
      timestamp: now,
      isValid,
      accessCount: 0,
      lastAccess: now
    };

    cacheRef.current.set(key, entry);
    metricsRef.current.sets++;
    metricsRef.current.totalSize++;

    // Only log cache sets in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📸 Cached URL: ${key} (valid: ${isValid})`);
    }
  }, [generateCacheKey, evictLRU]);

  // Check if photo reference is known to be invalid
  const isKnownInvalid = useCallback((photoRef: string, size: string): boolean => {
    const key = generateCacheKey(photoRef, size);
    const entry = cacheRef.current.get(key);
    return entry && !entry.isValid && isEntryValid(entry);
  }, [generateCacheKey, isEntryValid]);

  // Clear expired entries
  const cleanupExpired = useCallback(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of cacheRef.current.entries()) {
      if (!isEntryValid(entry)) {
        cacheRef.current.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      metricsRef.current.totalSize -= cleaned;
      // Only log cleanup in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`📸 Cleaned up ${cleaned} expired cache entries`);
      }
    }
  }, [isEntryValid]);

  // Get cache statistics
  const getCacheStats = useCallback(() => {
    const hitRate = metricsRef.current.hits + metricsRef.current.misses > 0 
      ? (metricsRef.current.hits / (metricsRef.current.hits + metricsRef.current.misses) * 100).toFixed(2)
      : '0.00';

    return {
      ...metricsRef.current,
      hitRate: `${hitRate}%`,
      cacheSize: cacheRef.current.size,
      maxSize: cacheConfig.maxSize
    };
  }, [cacheConfig.maxSize]);

  // Clear entire cache
  const clearCache = useCallback(() => {
    const size = cacheRef.current.size;
    cacheRef.current.clear();
    metricsRef.current = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      totalSize: 0
    };
    // Only log cache clear in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📸 Cleared entire cache (${size} entries)`);
    }
  }, []);

  return {
    getCachedUrl,
    setCachedUrl,
    isKnownInvalid,
    cleanupExpired,
    getCacheStats,
    clearCache
  };
};
