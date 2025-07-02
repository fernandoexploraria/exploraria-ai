
import { Landmark } from '@/data/landmarks';

// Test landmarks specifically chosen for panorama validation
export const PANORAMA_TEST_LANDMARKS: Record<string, Landmark[]> = {
  'high-panorama': [
    {
      id: 'test-times-square',
      name: 'Times Square NYC',
      coordinates: [-73.985130, 40.758896],
      description: 'High-traffic area with extensive Street View coverage and panorama connectivity'
    },
    {
      id: 'test-golden-gate',
      name: 'Golden Gate Bridge',
      coordinates: [-122.478255, 37.819929],
      description: 'Iconic landmark with multiple panorama viewpoints and connected views'
    }
  ],
  'medium-panorama': [
    {
      id: 'test-central-park',
      name: 'Central Park Bethesda Fountain',
      coordinates: [-73.971249, 40.774022],
      description: 'Park landmark with moderate panorama coverage'
    },
    {
      id: 'test-pier-39',
      name: 'Pier 39 San Francisco',
      coordinates: [-122.410101, 37.808633],
      description: 'Tourist area with good panorama connectivity'
    }
  ],
  'low-panorama': [
    {
      id: 'test-residential',
      name: 'Residential Area Test',
      coordinates: [-122.431297, 37.773972],
      description: 'Residential street with limited panorama availability'
    }
  ],
  'no-panorama': [
    {
      id: 'test-remote-location',
      name: 'Remote Location Test',
      coordinates: [-120.123456, 35.654321],
      description: 'Remote area likely without Street View coverage'
    }
  ]
};

// Panorama test scenarios
export interface PanoramaTestScenario {
  name: string;
  landmarks: Landmark[];
  userLocation: { latitude: number; longitude: number };
  expectedResults: {
    shouldHavePanorama: boolean;
    minPanoramaCount: number;
    shouldHaveConnectedViews: boolean;
    expectedPreloadTime: number; // milliseconds
  };
}

export const PANORAMA_TEST_SCENARIOS: PanoramaTestScenario[] = [
  {
    name: 'High-Traffic Urban Area',
    landmarks: PANORAMA_TEST_LANDMARKS['high-panorama'],
    userLocation: { latitude: 40.758896, longitude: -73.985130 },
    expectedResults: {
      shouldHavePanorama: true,
      minPanoramaCount: 3,
      shouldHaveConnectedViews: true,
      expectedPreloadTime: 2000
    }
  },
  {
    name: 'Tourist Destination',
    landmarks: PANORAMA_TEST_LANDMARKS['medium-panorama'],
    userLocation: { latitude: 37.808633, longitude: -122.410101 },
    expectedResults: {
      shouldHavePanorama: true,
      minPanoramaCount: 2,
      shouldHaveConnectedViews: true,
      expectedPreloadTime: 3000
    }
  },
  {
    name: 'Residential Area',
    landmarks: PANORAMA_TEST_LANDMARKS['low-panorama'],
    userLocation: { latitude: 37.773972, longitude: -122.431297 },
    expectedResults: {
      shouldHavePanorama: false,
      minPanoramaCount: 0,
      shouldHaveConnectedViews: false,
      expectedPreloadTime: 1000
    }
  },
  {
    name: 'Remote Location',
    landmarks: PANORAMA_TEST_LANDMARKS['no-panorama'],
    userLocation: { latitude: 35.654321, longitude: -120.123456 },
    expectedResults: {
      shouldHavePanorama: false,
      minPanoramaCount: 0,
      shouldHaveConnectedViews: false,
      expectedPreloadTime: 500
    }
  }
];

// Panorama validation utilities
export class PanoramaTestValidator {
  private static instance: PanoramaTestValidator;
  private testResults: Array<{
    testName: string;
    timestamp: number;
    passed: boolean;
    details: any;
  }> = [];

  static getInstance(): PanoramaTestValidator {
    if (!PanoramaTestValidator.instance) {
      PanoramaTestValidator.instance = new PanoramaTestValidator();
    }
    return PanoramaTestValidator.instance;
  }

  validatePanoramaData(data: any, expectedResults: any, testName: string): boolean {
    const startTime = performance.now();
    
    try {
      console.log(`🧪 Starting panorama validation test: ${testName}`);
      
      const checks = {
        hasPanoramaStats: !!data?.metadata?.panoramaStats,
        panoramaCount: data?.metadata?.panoramaStats?.availableCount || 0,
        hasConnectedViews: data?.metadata?.panoramaStats?.hasConnectedViews || false,
        panoramaIds: data?.metadata?.panoramaStats?.panoramaIds || [],
        viewpointsWithPanorama: data?.viewpoints?.filter((vp: any) => vp.panoramaAvailable).length || 0
      };

      const results = {
        panoramaCountCheck: expectedResults.shouldHavePanorama 
          ? checks.panoramaCount >= expectedResults.minPanoramaCount
          : checks.panoramaCount === 0,
        connectedViewsCheck: expectedResults.shouldHaveConnectedViews 
          ? checks.hasConnectedViews 
          : true, // Don't fail if not expected
        dataStructureCheck: expectedResults.shouldHavePanorama 
          ? checks.hasPanoramaStats && checks.panoramaIds.length > 0
          : true, // Don't fail if no panorama expected
        viewpointsCheck: data?.viewpoints?.length > 0
      };

      const allPassed = Object.values(results).every(Boolean);
      const testDuration = performance.now() - startTime;

      console.log(`🧪 Panorama validation results for ${testName}:`, {
        passed: allPassed,
        duration: `${testDuration.toFixed(2)}ms`,
        checks,
        results,
        expectedResults
      });

      this.testResults.push({
        testName,
        timestamp: Date.now(),
        passed: allPassed,
        details: { checks, results, expectedResults, duration: testDuration }
      });

      return allPassed;
    } catch (error) {
      console.error(`❌ Panorama validation failed for ${testName}:`, error);
      this.testResults.push({
        testName,
        timestamp: Date.now(),
        passed: false,
        details: { error: error.message }
      });
      return false;
    }
  }

  validateProximityPreloading(
    landmarks: Landmark[],
    userLocation: { latitude: number; longitude: number },
    preloadResults: any[],
    testName: string
  ): boolean {
    console.log(`🧪 Starting proximity preloading validation: ${testName}`);
    
    const startTime = performance.now();
    const results = {
      landmarksProcessed: preloadResults.length,
      panoramaPreloaded: preloadResults.filter(r => r?.metadata?.panoramaStats?.availableCount > 0).length,
      averagePreloadTime: preloadResults.reduce((sum, r) => sum + (r.loadTime || 0), 0) / preloadResults.length,
      cacheHitRate: preloadResults.filter(r => r.fromCache).length / preloadResults.length
    };

    const validationDuration = performance.now() - startTime;

    console.log(`🧪 Proximity preloading validation results:`, {
      testName,
      duration: `${validationDuration.toFixed(2)}ms`,
      results,
      landmarks: landmarks.map(l => l.name)
    });

    const passed = results.landmarksProcessed === landmarks.length;
    
    this.testResults.push({
      testName: `Proximity-${testName}`,
      timestamp: Date.now(),
      passed,
      details: { results, validationDuration }
    });

    return passed;
  }

  validateCacheBehavior(cacheStats: any, testName: string): boolean {
    console.log(`🧪 Starting cache behavior validation: ${testName}`);
    
    const results = {
      hasValidStats: !!cacheStats,
      totalEntries: cacheStats?.totalEntries || 0,
      panoramaEntries: cacheStats?.panoramaEntries || 0,
      hitRate: cacheStats?.hitRate || 0,
      totalSizeKB: parseFloat(cacheStats?.totalSizeKB || '0')
    };

    const checks = {
      hasEntries: results.totalEntries > 0,
      hasPanoramaData: results.panoramaEntries > 0,
      reasonableHitRate: results.hitRate >= 0.3, // 30% minimum hit rate
      reasonableSize: results.totalSizeKB > 0 && results.totalSizeKB < 10000 // Max 10MB
    };

    const passed = Object.values(checks).every(Boolean);

    console.log(`🧪 Cache validation results:`, {
      testName,
      results,
      checks,
      passed
    });

    this.testResults.push({
      testName: `Cache-${testName}`,
      timestamp: Date.now(),
      passed,
      details: { results, checks }
    });

    return passed;
  }

  getTestSummary() {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = total - passed;

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? (passed / total * 100).toFixed(1) : '0',
      recentResults: this.testResults.slice(-10),
      allResults: this.testResults
    };
  }

  logTestSummary() {
    const summary = this.getTestSummary();
    console.log(`📊 Panorama Testing Summary:`, {
      'Total Tests': summary.total,
      'Passed': summary.passed,
      'Failed': summary.failed,
      'Pass Rate': `${summary.passRate}%`,
      'Recent Results': summary.recentResults.map(r => ({
        test: r.testName,
        passed: r.passed ? '✅' : '❌',
        time: new Date(r.timestamp).toLocaleTimeString()
      }))
    });
  }

  clearResults() {
    this.testResults = [];
    console.log('🧪 Test results cleared');
  }
}

export const panoramaTestValidator = PanoramaTestValidator.getInstance();

// Network simulation utilities for testing
export const NetworkSimulator = {
  simulateSlowConnection: () => {
    console.log('🐌 Simulating slow network connection for testing');
    // This would be used with network throttling in dev tools
  },
  
  simulateFastConnection: () => {
    console.log('⚡ Simulating fast network connection for testing');
  },
  
  simulateOffline: () => {
    console.log('📱 Simulating offline mode for testing');
  }
};
