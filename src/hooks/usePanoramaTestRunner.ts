
import { useCallback, useState, useRef } from 'react';
import { useEnhancedStreetViewMulti } from '@/hooks/useEnhancedStreetViewMulti';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { PANORAMA_TEST_SCENARIOS, panoramaTestValidator, PanoramaTestScenario } from '@/utils/panoramaTestUtils';

interface TestRunnerState {
  isRunning: boolean;
  currentTest: string | null;
  progress: number;
  results: any[];
  errors: string[];
}

export const usePanoramaTestRunner = () => {
  const [state, setState] = useState<TestRunnerState>({
    isRunning: false,
    currentTest: null,
    progress: 0,
    results: [],
    errors: []
  });

  const {
    fetchEnhancedStreetView,
    preloadForProximity,
    getCacheStats,
    clearCache
  } = useEnhancedStreetViewMulti();

  const nearbyLandmarks = useNearbyLandmarks({
    userLocation: null,
    notificationDistance: 500
  });

  const testSessionRef = useRef<string | null>(null);

  const runSingleTest = useCallback(async (scenario: PanoramaTestScenario): Promise<boolean> => {
    const sessionId = `test-${Date.now()}`;
    testSessionRef.current = sessionId;

    console.log(`🧪 Running panorama test scenario: ${scenario.name}`);
    
    try {
      setState(prev => ({ 
        ...prev, 
        currentTest: scenario.name,
        progress: 0
      }));

      // Test 1: Panorama Data Retrieval
      console.log('📋 Test 1: Panorama data retrieval for landmark types');
      const streetViewResults = [];
      
      for (let i = 0; i < scenario.landmarks.length; i++) {
        if (testSessionRef.current !== sessionId) break;
        
        const landmark = scenario.landmarks[i];
        const startTime = performance.now();
        
        setState(prev => ({ 
          ...prev, 
          progress: (i / scenario.landmarks.length) * 25 
        }));

        try {
          const result = await fetchEnhancedStreetView(landmark, 100);
          const loadTime = performance.now() - startTime;
          
          streetViewResults.push({
            landmark: landmark.name,
            result,
            loadTime,
            fromCache: loadTime < 100 // Assume cached if very fast
          });

          console.log(`✅ Fetched panorama data for ${landmark.name}:`, {
            loadTime: `${loadTime.toFixed(2)}ms`,
            hasPanorama: result?.metadata?.panoramaStats?.availableCount > 0,
            panoramaCount: result?.metadata?.panoramaStats?.availableCount || 0
          });
        } catch (error) {
          console.error(`❌ Failed to fetch data for ${landmark.name}:`, error);
          streetViewResults.push({
            landmark: landmark.name,
            result: null,
            loadTime: performance.now() - startTime,
            error: error.message
          });
        }
      }

      if (testSessionRef.current !== sessionId) return false;

      // Test 2: Validate Panorama Data Structure
      console.log('📋 Test 2: Validate panorama data structure');
      setState(prev => ({ ...prev, progress: 30 }));
      
      let dataValidationPassed = true;
      for (const streetViewResult of streetViewResults) {
        if (streetViewResult.result) {
          const isValid = panoramaTestValidator.validatePanoramaData(
            streetViewResult.result,
            scenario.expectedResults,
            `${scenario.name}-${streetViewResult.landmark}`
          );
          if (!isValid) dataValidationPassed = false;
        }
      }

      // Test 3: Proximity-Triggered Preloading
      console.log('📋 Test 3: Proximity-triggered preloading');
      setState(prev => ({ ...prev, progress: 50 }));
      
      const preloadStartTime = performance.now();
      await preloadForProximity(scenario.landmarks, scenario.userLocation);
      const preloadDuration = performance.now() - preloadStartTime;
      
      const proximityValidationPassed = panoramaTestValidator.validateProximityPreloading(
        scenario.landmarks,
        scenario.userLocation,
        streetViewResults,
        scenario.name
      );

      console.log(`⚡ Proximity preloading completed in ${preloadDuration.toFixed(2)}ms`);

      // Test 4: Cache Behavior Validation
      console.log('📋 Test 4: Cache behavior validation');
      setState(prev => ({ ...prev, progress: 75 }));
      
      const cacheStats = getCacheStats();
      const cacheValidationPassed = panoramaTestValidator.validateCacheBehavior(
        cacheStats,
        scenario.name
      );

      // Test 5: Performance Validation
      console.log('📋 Test 5: Performance validation');
      setState(prev => ({ ...prev, progress: 90 }));
      
      const avgLoadTime = streetViewResults.reduce((sum, r) => sum + r.loadTime, 0) / streetViewResults.length;
      const performancePassed = avgLoadTime <= scenario.expectedResults.expectedPreloadTime;
      
      console.log(`📊 Average load time: ${avgLoadTime.toFixed(2)}ms (expected: ≤${scenario.expectedResults.expectedPreloadTime}ms)`);

      // Compile results
      const testResult = {
        scenario: scenario.name,
        timestamp: Date.now(),
        passed: dataValidationPassed && proximityValidationPassed && cacheValidationPassed && performancePassed,
        details: {
          dataValidation: dataValidationPassed,
          proximityValidation: proximityValidationPassed,
          cacheValidation: cacheValidationPassed,
          performanceCheck: performancePassed,
          avgLoadTime: avgLoadTime.toFixed(2),
          streetViewResults: streetViewResults.length,
          preloadDuration: preloadDuration.toFixed(2)
        }
      };

      setState(prev => ({ 
        ...prev, 
        progress: 100,
        results: [...prev.results, testResult]
      }));

      console.log(`🧪 Test scenario "${scenario.name}" completed:`, testResult);
      return testResult.passed;

    } catch (error) {
      const errorMessage = `Test scenario "${scenario.name}" failed: ${error.message}`;
      console.error('❌', errorMessage);
      
      setState(prev => ({ 
        ...prev, 
        errors: [...prev.errors, errorMessage]
      }));
      
      return false;
    }
  }, [fetchEnhancedStreetView, preloadForProximity, getCacheStats]);

  const runAllTests = useCallback(async (): Promise<void> => {
    console.log('🚀 Starting comprehensive panorama testing suite');
    
    setState({
      isRunning: true,
      currentTest: null,
      progress: 0,
      results: [],
      errors: []
    });

    // Clear previous results
    panoramaTestValidator.clearResults();
    clearCache();

    let passedTests = 0;
    const totalTests = PANORAMA_TEST_SCENARIOS.length;

    for (let i = 0; i < totalTests; i++) {
      const scenario = PANORAMA_TEST_SCENARIOS[i];
      
      setState(prev => ({ 
        ...prev, 
        progress: (i / totalTests) * 100 
      }));

      const passed = await runSingleTest(scenario);
      if (passed) passedTests++;

      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final summary
    const summary = panoramaTestValidator.getTestSummary();
    console.log(`🎯 Testing Complete: ${passedTests}/${totalTests} scenarios passed`);
    panoramaTestValidator.logTestSummary();

    setState(prev => ({
      ...prev,
      isRunning: false,
      currentTest: null,
      progress: 100
    }));
  }, [runSingleTest, clearCache]);

  const runQuickTest = useCallback(async (): Promise<void> => {
    console.log('⚡ Running quick panorama validation test');
    
    // Use the first test scenario for quick validation
    const quickScenario = PANORAMA_TEST_SCENARIOS[0];
    
    setState({
      isRunning: true,
      currentTest: 'Quick Test',
      progress: 0,
      results: [],
      errors: []
    });

    await runSingleTest(quickScenario);
    
    setState(prev => ({
      ...prev,
      isRunning: false,
      currentTest: null
    }));
  }, [runSingleTest]);

  return {
    ...state,
    runAllTests,
    runQuickTest,
    runSingleTest,
    getTestSummary: () => panoramaTestValidator.getTestSummary(),
    clearResults: () => {
      panoramaTestValidator.clearResults();
      setState({
        isRunning: false,
        currentTest: null,
        progress: 0,
        results: [],
        errors: []
      });
    }
  };
};
