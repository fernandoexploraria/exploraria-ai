
import { useCallback, useRef } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface ValidationResult {
  url: string;
  isValid: boolean;
  responseTime: number;
  timestamp: number;
}

interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  averageResponseTime: number;
  validationsByNetwork: Record<string, number>;
}

export const usePhotoValidation = () => {
  const { effectiveType, isSlowConnection } = useNetworkStatus();
  const validationCacheRef = useRef<Map<string, ValidationResult>>(new Map());
  const metricsRef = useRef<ValidationMetrics>({
    totalValidations: 0,
    successfulValidations: 0,
    averageResponseTime: 0,
    validationsByNetwork: {}
  });

  // Check if URL is accessible
  const validateUrl = useCallback(async (
    url: string, 
    timeout: number = 5000
  ): Promise<boolean> => {
    // Skip validation on very slow connections to avoid blocking
    if (isSlowConnection && effectiveType === '2g') {
      console.log(`📸 Skipping validation on slow connection: ${url}`);
      return true; // Assume valid to avoid blocking
    }

    const startTime = Date.now();
    
    try {
      console.log(`📸 Validating URL: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD', // Only get headers, not full content
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      const isValid = response.ok && response.headers.get('content-type')?.startsWith('image/');

      // Update metrics
      metricsRef.current.totalValidations++;
      if (isValid) {
        metricsRef.current.successfulValidations++;
      }
      
      // Update average response time
      const total = metricsRef.current.totalValidations;
      const currentAvg = metricsRef.current.averageResponseTime;
      metricsRef.current.averageResponseTime = ((currentAvg * (total - 1)) + responseTime) / total;

      // Track by network type
      const networkKey = effectiveType || 'unknown';
      metricsRef.current.validationsByNetwork[networkKey] = 
        (metricsRef.current.validationsByNetwork[networkKey] || 0) + 1;

      // Cache result
      validationCacheRef.current.set(url, {
        url,
        isValid,
        responseTime,
        timestamp: Date.now()
      });

      console.log(`📸 URL validation result: ${url} - ${isValid ? 'VALID' : 'INVALID'} (${responseTime}ms)`);
      return isValid;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Update metrics for failed validation
      metricsRef.current.totalValidations++;
      metricsRef.current.averageResponseTime = 
        ((metricsRef.current.averageResponseTime * (metricsRef.current.totalValidations - 1)) + responseTime) / 
        metricsRef.current.totalValidations;

      // Cache negative result
      validationCacheRef.current.set(url, {
        url,
        isValid: false,
        responseTime,
        timestamp: Date.now()
      });

      console.log(`📸 URL validation failed: ${url} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }, [effectiveType, isSlowConnection]);

  // Get cached validation result
  const getCachedValidation = useCallback((url: string): boolean | null => {
    const cached = validationCacheRef.current.get(url);
    if (!cached) return null;

    // Cache validation results for 10 minutes
    const cacheAge = Date.now() - cached.timestamp;
    if (cacheAge > 10 * 60 * 1000) {
      validationCacheRef.current.delete(url);
      return null;
    }

    console.log(`📸 Using cached validation: ${url} - ${cached.isValid ? 'VALID' : 'INVALID'}`);
    return cached.isValid;
  }, []);

  // Batch validate multiple URLs
  const batchValidateUrls = useCallback(async (
    urls: string[], 
    maxConcurrent: number = 3
  ): Promise<Map<string, boolean>> => {
    const results = new Map<string, boolean>();
    
    console.log(`📸 Batch validating ${urls.length} URLs (max concurrent: ${maxConcurrent})`);
    
    // Process in batches to avoid overwhelming the network
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (url) => {
        // Check cache first
        const cached = getCachedValidation(url);
        if (cached !== null) {
          return { url, isValid: cached };
        }
        
        const isValid = await validateUrl(url);
        return { url, isValid };
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.set(result.value.url, result.value.isValid);
        }
      });
      
      // Brief pause between batches to be network-friendly
      if (i + maxConcurrent < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`📸 Batch validation complete: ${results.size} URLs processed`);
    return results;
  }, [validateUrl, getCachedValidation]);

  // Smart validation - skip if conditions suggest it's unnecessary
  const smartValidate = useCallback(async (url: string): Promise<boolean> => {
    // Skip validation for known valid domains/patterns
    if (url.includes('googleapis.com') && url.includes('key=')) {
      console.log(`📸 Skipping validation for trusted Google API URL`);
      return true;
    }

    // Use cached result if available
    const cached = getCachedValidation(url);
    if (cached !== null) {
      return cached;
    }

    // Adjust timeout based on network quality
    const timeout = isSlowConnection ? 10000 : 5000;
    return await validateUrl(url, timeout);
  }, [validateUrl, getCachedValidation, isSlowConnection]);

  // Get validation statistics
  const getValidationStats = useCallback(() => {
    const successRate = metricsRef.current.totalValidations > 0
      ? (metricsRef.current.successfulValidations / metricsRef.current.totalValidations * 100).toFixed(2)
      : '0.00';

    return {
      ...metricsRef.current,
      successRate: `${successRate}%`,
      cacheSize: validationCacheRef.current.size
    };
  }, []);

  // Clear validation cache
  const clearValidationCache = useCallback(() => {
    const size = validationCacheRef.current.size;
    validationCacheRef.current.clear();
    console.log(`📸 Cleared validation cache (${size} entries)`);
  }, []);

  return {
    validateUrl,
    smartValidate,
    batchValidateUrls,
    getCachedValidation,
    getValidationStats,
    clearValidationCache
  };
};
