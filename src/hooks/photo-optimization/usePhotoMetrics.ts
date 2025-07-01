import { useCallback, useRef } from 'react';

interface PhotoLoadMetric {
  photoId: string;
  url: string;
  source: 'database_raw_data' | 'database_photos_field' | 'google_places_api';
  size: 'thumb' | 'medium' | 'large';
  loadTime: number;
  success: boolean;
  errorType?: string;
  timestamp: number;
  networkType?: string;
  qualityScore?: number;
}

interface PhotoMetricsSummary {
  totalLoads: number;
  successfulLoads: number;
  averageLoadTime: number;
  sourceSuccessRates: Record<string, { total: number; successful: number; rate: string }>;
  sizePerformance: Record<string, { total: number; averageTime: number }>;
  networkPerformance: Record<string, { total: number; averageTime: number }>;
  qualityScoreEffectiveness: {
    highQuality: { total: number; successRate: string };
    mediumQuality: { total: number; successRate: string };
    lowQuality: { total: number; successRate: string };
  };
}

export const usePhotoMetrics = () => {
  const metricsRef = useRef<PhotoLoadMetric[]>([]);
  const maxMetrics = 1000; // Keep last 1000 metrics

  // Record a photo load attempt
  const recordPhotoLoad = useCallback((metric: Omit<PhotoLoadMetric, 'timestamp'>) => {
    const fullMetric: PhotoLoadMetric = {
      ...metric,
      timestamp: Date.now()
    };

    metricsRef.current.push(fullMetric);

    // Keep only recent metrics to avoid memory bloat
    if (metricsRef.current.length > maxMetrics) {
      metricsRef.current = metricsRef.current.slice(-maxMetrics);
    }

    console.log(`📊 Photo load recorded:`, {
      photoId: metric.photoId,
      source: metric.source,
      size: metric.size,
      success: metric.success,
      loadTime: metric.loadTime,
      quality: metric.qualityScore
    });
  }, []);

  // Start timing a photo load
  const startPhotoLoadTimer = useCallback((photoId: string): () => PhotoLoadMetric['loadTime'] => {
    const startTime = Date.now();
    return () => Date.now() - startTime;
  }, []);

  // Get comprehensive metrics summary
  const getMetricsSummary = useCallback((): PhotoMetricsSummary => {
    const metrics = metricsRef.current;
    
    if (metrics.length === 0) {
      return {
        totalLoads: 0,
        successfulLoads: 0,
        averageLoadTime: 0,
        sourceSuccessRates: {},
        sizePerformance: {},
        networkPerformance: {},
        qualityScoreEffectiveness: {
          highQuality: { total: 0, successRate: '0%' },
          mediumQuality: { total: 0, successRate: '0%' },
          lowQuality: { total: 0, successRate: '0%' }
        }
      };
    }

    const totalLoads = metrics.length;
    const successfulLoads = metrics.filter(m => m.success).length;
    const averageLoadTime = metrics.reduce((sum, m) => sum + m.loadTime, 0) / totalLoads;

    // Source success rates
    const sourceSuccessRates: Record<string, { total: number; successful: number; rate: string }> = {};
    metrics.forEach(metric => {
      if (!sourceSuccessRates[metric.source]) {
        sourceSuccessRates[metric.source] = { total: 0, successful: 0, rate: '0%' };
      }
      sourceSuccessRates[metric.source].total++;
      if (metric.success) {
        sourceSuccessRates[metric.source].successful++;
      }
    });

    // Calculate success rates
    Object.keys(sourceSuccessRates).forEach(source => {
      const data = sourceSuccessRates[source];
      data.rate = `${((data.successful / data.total) * 100).toFixed(2)}%`;
    });

    // Size performance
    const sizePerformance: Record<string, { total: number; averageTime: number }> = {};
    metrics.forEach(metric => {
      if (!sizePerformance[metric.size]) {
        sizePerformance[metric.size] = { total: 0, averageTime: 0 };
      }
      sizePerformance[metric.size].total++;
      sizePerformance[metric.size].averageTime += metric.loadTime;
    });

    Object.keys(sizePerformance).forEach(size => {
      const data = sizePerformance[size];
      data.averageTime = data.averageTime / data.total;
    });

    // Network performance
    const networkPerformance: Record<string, { total: number; averageTime: number }> = {};
    metrics.forEach(metric => {
      if (metric.networkType) {
        if (!networkPerformance[metric.networkType]) {
          networkPerformance[metric.networkType] = { total: 0, averageTime: 0 };
        }
        networkPerformance[metric.networkType].total++;
        networkPerformance[metric.networkType].averageTime += metric.loadTime;
      }
    });

    Object.keys(networkPerformance).forEach(network => {
      const data = networkPerformance[network];
      data.averageTime = data.averageTime / data.total;
    });

    // Quality score effectiveness
    const qualityBuckets = {
      highQuality: { total: 0, successful: 0 },
      mediumQuality: { total: 0, successful: 0 },
      lowQuality: { total: 0, successful: 0 }
    };

    metrics.forEach(metric => {
      if (metric.qualityScore !== undefined) {
        if (metric.qualityScore > 50) {
          qualityBuckets.highQuality.total++;
          if (metric.success) qualityBuckets.highQuality.successful++;
        } else if (metric.qualityScore > 25) {
          qualityBuckets.mediumQuality.total++;
          if (metric.success) qualityBuckets.mediumQuality.successful++;
        } else {
          qualityBuckets.lowQuality.total++;
          if (metric.success) qualityBuckets.lowQuality.successful++;
        }
      }
    });

    const qualityScoreEffectiveness = {
      highQuality: {
        total: qualityBuckets.highQuality.total,
        successRate: qualityBuckets.highQuality.total > 0 
          ? `${((qualityBuckets.highQuality.successful / qualityBuckets.highQuality.total) * 100).toFixed(2)}%`
          : '0%'
      },
      mediumQuality: {
        total: qualityBuckets.mediumQuality.total,
        successRate: qualityBuckets.mediumQuality.total > 0 
          ? `${((qualityBuckets.mediumQuality.successful / qualityBuckets.mediumQuality.total) * 100).toFixed(2)}%`
          : '0%'
      },
      lowQuality: {
        total: qualityBuckets.lowQuality.total,
        successRate: qualityBuckets.lowQuality.total > 0 
          ? `${((qualityBuckets.lowQuality.successful / qualityBuckets.lowQuality.total) * 100).toFixed(2)}%`
          : '0%'
      }
    };

    return {
      totalLoads,
      successfulLoads,
      averageLoadTime,
      sourceSuccessRates,
      sizePerformance,
      networkPerformance,
      qualityScoreEffectiveness
    };
  }, []);

  // Get recent failure patterns
  const getRecentFailures = useCallback((minutes: number = 30): PhotoLoadMetric[] => {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return metricsRef.current.filter(m => !m.success && m.timestamp > cutoff);
  }, []);

  // Get performance trends
  const getPerformanceTrend = useCallback((hours: number = 1): {
    hourlySuccessRate: string;
    hourlyAverageTime: number;
    trendDirection: 'improving' | 'degrading' | 'stable';
  } => {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const recentMetrics = metricsRef.current.filter(m => m.timestamp > cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        hourlySuccessRate: '0%',
        hourlyAverageTime: 0,
        trendDirection: 'stable'
      };
    }

    const successCount = recentMetrics.filter(m => m.success).length;
    const hourlySuccessRate = `${((successCount / recentMetrics.length) * 100).toFixed(2)}%`;
    const hourlyAverageTime = recentMetrics.reduce((sum, m) => sum + m.loadTime, 0) / recentMetrics.length;

    // Simple trend calculation (compare first half vs second half)
    const halfPoint = Math.floor(recentMetrics.length / 2);
    const firstHalf = recentMetrics.slice(0, halfPoint);
    const secondHalf = recentMetrics.slice(halfPoint);

    if (firstHalf.length === 0 || secondHalf.length === 0) {
      return { hourlySuccessRate, hourlyAverageTime, trendDirection: 'stable' };
    }

    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.loadTime, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.loadTime, 0) / secondHalf.length;

    const trendDirection = 
      secondHalfAvg < firstHalfAvg * 0.9 ? 'improving' :
      secondHalfAvg > firstHalfAvg * 1.1 ? 'degrading' : 'stable';

    return { hourlySuccessRate, hourlyAverageTime, trendDirection };
  }, []);

  // Clear metrics
  const clearMetrics = useCallback(() => {
    const count = metricsRef.current.length;
    metricsRef.current = [];
    console.log(`📊 Cleared ${count} photo metrics`);
  }, []);

  return {
    recordPhotoLoad,
    startPhotoLoadTimer,
    getMetricsSummary,
    getRecentFailures,
    getPerformanceTrend,
    clearMetrics
  };
};
