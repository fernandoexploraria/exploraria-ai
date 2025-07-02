
import { Landmark } from '@/data/landmarks';

// Test landmarks at various distances for consistent testing
export const TEST_LANDMARKS: Record<string, Landmark[]> = {
  'close': [
    {
      id: 'test-close-1',
      name: 'Close Test Landmark 1',
      coordinates: [0.0009, 0.0009], // ~100m from origin
      description: 'Test landmark for close distance testing'
    },
    {
      id: 'test-close-2',
      name: 'Close Test Landmark 2',
      coordinates: [0.0008, 0.0008], // ~90m from origin
      description: 'Test landmark for close distance testing'
    }
  ],
  'medium': [
    {
      id: 'test-medium-1',
      name: 'Medium Test Landmark 1',
      coordinates: [0.003, 0.003], // ~400m from origin
      description: 'Test landmark for medium distance testing'
    },
    {
      id: 'test-medium-2',
      name: 'Medium Test Landmark 2',
      coordinates: [0.004, 0.004], // ~500m from origin
      description: 'Test landmark for medium distance testing'
    }
  ],
  'far': [
    {
      id: 'test-far-1',
      name: 'Far Test Landmark 1',
      coordinates: [0.01, 0.01], // ~1.4km from origin
      description: 'Test landmark for far distance testing'
    },
    {
      id: 'test-far-2',
      name: 'Far Test Landmark 2',
      coordinates: [0.02, 0.02], // ~2.8km from origin
      description: 'Test landmark for far distance testing'
    }
  ]
};

export const TEST_USER_LOCATION = { latitude: 0, longitude: 0 };

// Calculate distance between two coordinates (Haversine formula)
export const calculateDistance = (
  coord1: [number, number],
  coord2: { latitude: number; longitude: number }
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = coord2.latitude * Math.PI / 180;
  const φ2 = coord1[1] * Math.PI / 180;
  const Δφ = (coord1[1] - coord2.latitude) * Math.PI / 180;
  const Δλ = (coord1[0] - coord2.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

// Validate strategy selection based on distance
export const validateStrategySelection = (distance: number, networkType: string = '4g') => {
  const isSlowNetwork = networkType === 'slow-2g' || networkType === '2g';
  
  let expectedStrategy: string;
  let expectedQuality: string;
  
  if (distance < 100) {
    expectedStrategy = 'all';
    expectedQuality = isSlowNetwork ? 'medium' : 'high';
  } else if (distance < 500) {
    expectedStrategy = 'smart';
    expectedQuality = isSlowNetwork ? 'low' : 'medium';
  } else if (distance < 1000) {
    expectedStrategy = 'cardinal';
    expectedQuality = isSlowNetwork ? 'low' : 'medium';
  } else {
    expectedStrategy = 'single';
    expectedQuality = 'medium';
  }
  
  return { expectedStrategy, expectedQuality };
};

// Cache testing utilities
export class CacheTestUtils {
  private static instance: CacheTestUtils;
  private cacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    totalSize: 0
  };

  static getInstance(): CacheTestUtils {
    if (!CacheTestUtils.instance) {
      CacheTestUtils.instance = new CacheTestUtils();
    }
    return CacheTestUtils.instance;
  }

  recordHit() {
    this.cacheMetrics.hits++;
    console.log(`📊 Cache hit recorded. Total hits: ${this.cacheMetrics.hits}`);
  }

  recordMiss() {
    this.cacheMetrics.misses++;
    console.log(`📊 Cache miss recorded. Total misses: ${this.cacheMetrics.misses}`);
  }

  recordSet(size: number = 0) {
    this.cacheMetrics.sets++;
    this.cacheMetrics.totalSize += size;
    console.log(`📊 Cache set recorded. Total sets: ${this.cacheMetrics.sets}, Size: ${size}`);
  }

  recordDelete(size: number = 0) {
    this.cacheMetrics.deletes++;
    this.cacheMetrics.totalSize -= size;
    console.log(`📊 Cache delete recorded. Total deletes: ${this.cacheMetrics.deletes}`);
  }

  getMetrics() {
    const hitRate = this.cacheMetrics.hits / (this.cacheMetrics.hits + this.cacheMetrics.misses);
    return {
      ...this.cacheMetrics,
      hitRate: isNaN(hitRate) ? 0 : hitRate,
      totalOperations: this.cacheMetrics.hits + this.cacheMetrics.misses + this.cacheMetrics.sets + this.cacheMetrics.deletes
    };
  }

  reset() {
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      totalSize: 0
    };
    console.log('📊 Cache metrics reset');
  }

  logSummary() {
    const metrics = this.getMetrics();
    console.log('📊 Cache Performance Summary:', {
      'Total Operations': metrics.totalOperations,
      'Hit Rate': `${(metrics.hitRate * 100).toFixed(2)}%`,
      'Cache Size': `${(metrics.totalSize / 1024).toFixed(2)} KB`,
      'Hits': metrics.hits,
      'Misses': metrics.misses,
      'Sets': metrics.sets,
      'Deletes': metrics.deletes
    });
  }
}

// Performance benchmarking
export class PerformanceBenchmark {
  private measurements: Array<{
    operation: string;
    duration: number;
    timestamp: number;
    metadata?: any;
  }> = [];

  measure<T>(operation: string, fn: () => Promise<T>, metadata?: any): Promise<T> {
    const start = performance.now();
    return fn().then(result => {
      const duration = performance.now() - start;
      this.measurements.push({
        operation,
        duration,
        timestamp: Date.now(),
        metadata
      });
      console.log(`📈 ${operation}: ${duration.toFixed(2)}ms`, metadata || '');
      return result;
    }).catch(error => {
      const duration = performance.now() - start;
      this.measurements.push({
        operation: `${operation} (failed)`,
        duration,
        timestamp: Date.now(),
        metadata: { ...metadata, error: error.message }
      });
      console.log(`📈 ${operation} (failed): ${duration.toFixed(2)}ms`, error.message);
      throw error;
    });
  }

  getStats(operation?: string) {
    const filtered = operation 
      ? this.measurements.filter(m => m.operation.includes(operation))
      : this.measurements;

    if (filtered.length === 0) return null;

    const durations = filtered.map(m => m.duration);
    const total = durations.reduce((sum, d) => sum + d, 0);
    const avg = total / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    
    durations.sort((a, b) => a - b);
    const median = durations[Math.floor(durations.length / 2)];

    return {
      count: filtered.length,
      total: total.toFixed(2),
      average: avg.toFixed(2),
      median: median.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2)
    };
  }

  logSummary(operation?: string) {
    const stats = this.getStats(operation);
    if (stats) {
      console.log(`📈 Performance Summary${operation ? ` for ${operation}` : ''}:`, stats);
    } else {
      console.log(`📈 No measurements found${operation ? ` for ${operation}` : ''}`);
    }
  }

  clear() {
    this.measurements = [];
    console.log('📈 Performance measurements cleared');
  }
}

export const performanceBenchmark = new PerformanceBenchmark();
