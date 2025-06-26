
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  testName: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  data?: any;
  duration?: number;
}

interface PlacesTestSuite {
  searchTests: TestResult[];
  nearbyTests: TestResult[];
  detailsTests: TestResult[];
  photoTests: TestResult[];
  compatibilityTests: TestResult[];
  errorTests: TestResult[];
  performanceTests: TestResult[];
}

export class GooglePlacesAPITester {
  private results: PlacesTestSuite = {
    searchTests: [],
    nearbyTests: [],
    detailsTests: [],
    photoTests: [],
    compatibilityTests: [],
    errorTests: [],
    performanceTests: []
  };

  // Test google-places-search function
  async testPlacesSearch(): Promise<TestResult[]> {
    const tests: TestResult[] = [];
    
    // Test 1: Text-only search
    try {
      const startTime = performance.now();
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: {
          query: 'Eiffel Tower',
          radius: 1000
        }
      });
      const duration = performance.now() - startTime;

      if (error) {
        tests.push({
          testName: 'Text-only search',
          status: 'fail',
          message: `Error: ${error.message}`,
          duration
        });
      } else if (data?.success && data?.results?.length > 0) {
        tests.push({
          testName: 'Text-only search',
          status: 'pass',
          message: `Found ${data.results.length} results`,
          data: data.results[0],
          duration
        });
      } else {
        tests.push({
          testName: 'Text-only search',
          status: 'warning',
          message: 'No results returned',
          duration
        });
      }
    } catch (err) {
      tests.push({
        testName: 'Text-only search',
        status: 'fail',
        message: `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }

    // Test 2: Location-based search
    try {
      const startTime = performance.now();
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: {
          query: 'restaurant',
          coordinates: [2.2945, 48.8584], // Paris coordinates
          radius: 500
        }
      });
      const duration = performance.now() - startTime;

      if (error) {
        tests.push({
          testName: 'Location-based search',
          status: 'fail',
          message: `Error: ${error.message}`,
          duration
        });
      } else if (data?.success && data?.results?.length > 0) {
        tests.push({
          testName: 'Location-based search',
          status: 'pass',
          message: `Found ${data.results.length} results near Paris`,
          data: data.results[0],
          duration
        });
      } else {
        tests.push({
          testName: 'Location-based search',
          status: 'warning',
          message: 'No results returned',
          duration
        });
      }
    } catch (err) {
      tests.push({
        testName: 'Location-based search',
        status: 'fail',
        message: `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }

    // Test 3: Special characters in query
    try {
      const startTime = performance.now();
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: {
          query: 'café & restaurant "nice place"',
          radius: 1000
        }
      });
      const duration = performance.now() - startTime;

      tests.push({
        testName: 'Special characters in query',
        status: error ? 'fail' : 'pass',
        message: error ? `Error: ${error.message}` : 'Special characters handled correctly',
        duration
      });
    } catch (err) {
      tests.push({
        testName: 'Special characters in query',
        status: 'fail',
        message: `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }

    this.results.searchTests = tests;
    return tests;
  }

  // Test google-places-nearby function
  async testPlacesNearby(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test 1: Restaurant search
    try {
      const startTime = performance.now();
      const { data, error } = await supabase.functions.invoke('google-places-nearby', {
        body: {
          coordinates: [-74.0060, 40.7128], // NYC coordinates
          radius: 500,
          type: 'restaurant'
        }
      });
      const duration = performance.now() - startTime;

      if (error) {
        tests.push({
          testName: 'Nearby restaurants',
          status: 'fail',
          message: `Error: ${error.message}`,
          duration
        });
      } else if (data?.success && data?.places?.length > 0) {
        tests.push({
          testName: 'Nearby restaurants',
          status: 'pass',
          message: `Found ${data.places.length} restaurants`,
          data: data.places[0],
          duration
        });
      } else {
        tests.push({
          testName: 'Nearby restaurants',
          status: 'warning',
          message: 'No restaurants found',
          duration
        });
      }
    } catch (err) {
      tests.push({
        testName: 'Nearby restaurants',
        status: 'fail',
        message: `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }

    // Test 2: Multiple types
    try {
      const startTime = performance.now();
      const { data, error } = await supabase.functions.invoke('google-places-nearby', {
        body: {
          coordinates: [2.2945, 48.8584], // Paris coordinates
          radius: 1000,
          type: 'restaurant|cafe|tourist_attraction'
        }
      });
      const duration = performance.now() - startTime;

      tests.push({
        testName: 'Multiple place types',
        status: error ? 'fail' : 'pass',
        message: error ? `Error: ${error.message}` : `Found ${data?.places?.length || 0} places`,
        duration
      });
    } catch (err) {
      tests.push({
        testName: 'Multiple place types',
        status: 'fail',
        message: `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }

    this.results.nearbyTests = tests;
    return tests;
  }

  // Test photo URL validation
  async testPhotoUrls(samplePlace: any): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    if (!samplePlace?.photoUrl) {
      tests.push({
        testName: 'Photo URL validation',
        status: 'warning',
        message: 'No photo URL available for testing'
      });
      return tests;
    }

    try {
      const startTime = performance.now();
      const response = await fetch(samplePlace.photoUrl);
      const duration = performance.now() - startTime;

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        tests.push({
          testName: 'Photo URL accessibility',
          status: 'pass',
          message: `Photo loaded successfully (${contentType})`,
          duration
        });
      } else {
        tests.push({
          testName: 'Photo URL accessibility',
          status: 'fail',
          message: `Photo failed to load: ${response.status} ${response.statusText}`,
          duration
        });
      }
    } catch (err) {
      tests.push({
        testName: 'Photo URL accessibility',
        status: 'fail',
        message: `Photo URL error: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }

    // Test new format validation
    const isNewFormat = samplePlace.photoUrl.includes('places.googleapis.com/v1/');
    tests.push({
      testName: 'New photo URL format',
      status: isNewFormat ? 'pass' : 'warning',
      message: isNewFormat ? 'Using new API v1 photo format' : 'Still using legacy photo format'
    });

    this.results.photoTests = tests;
    return tests;
  }

  // Test backward compatibility
  async testBackwardCompatibility(searchResults: any[], nearbyResults: any[]): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test search result structure
    if (searchResults.length > 0) {
      const place = searchResults[0];
      const requiredFields = ['placeId', 'name', 'formattedAddress', 'geometry'];
      const missingFields = requiredFields.filter(field => !(field in place));

      tests.push({
        testName: 'Search result structure',
        status: missingFields.length === 0 ? 'pass' : 'fail',
        message: missingFields.length === 0 
          ? 'All required fields present' 
          : `Missing fields: ${missingFields.join(', ')}`,
        data: place
      });

      // Test geometry structure
      if (place.geometry?.location) {
        const hasLatLng = 'lat' in place.geometry.location && 'lng' in place.geometry.location;
        tests.push({
          testName: 'Geometry structure compatibility',
          status: hasLatLng ? 'pass' : 'fail',
          message: hasLatLng ? 'Lat/lng structure maintained' : 'Lat/lng structure broken'
        });
      }
    }

    // Test nearby result structure
    if (nearbyResults.length > 0) {
      const place = nearbyResults[0];
      const requiredFields = ['placeId', 'name', 'vicinity', 'geometry'];
      const presentFields = requiredFields.filter(field => field in place);

      tests.push({
        testName: 'Nearby result structure',
        status: presentFields.length >= 3 ? 'pass' : 'warning',
        message: `${presentFields.length}/${requiredFields.length} required fields present`
      });
    }

    this.results.compatibilityTests = tests;
    return tests;
  }

  // Test error handling
  async testErrorHandling(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test empty query
    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: {
          query: '',
          radius: 1000
        }
      });

      tests.push({
        testName: 'Empty query handling',
        status: error ? 'pass' : 'warning',
        message: error ? 'Properly rejected empty query' : 'Empty query was processed'
      });
    } catch (err) {
      tests.push({
        testName: 'Empty query handling',
        status: 'pass',
        message: 'Empty query properly rejected with exception'
      });
    }

    // Test invalid coordinates
    try {
      const { data, error } = await supabase.functions.invoke('google-places-nearby', {
        body: {
          coordinates: [999, 999], // Invalid coordinates
          radius: 500,
          type: 'restaurant'
        }
      });

      tests.push({
        testName: 'Invalid coordinates handling',
        status: data?.places?.length === 0 ? 'pass' : 'warning',
        message: data?.places?.length === 0 ? 'No results for invalid coordinates' : 'Invalid coordinates returned results'
      });
    } catch (err) {
      tests.push({
        testName: 'Invalid coordinates handling',
        status: 'pass',
        message: 'Invalid coordinates properly rejected'
      });
    }

    this.results.errorTests = tests;
    return tests;
  }

  // Run all tests
  async runComprehensiveTests(): Promise<PlacesTestSuite> {
    console.log('🧪 Starting comprehensive Google Places API testing...');

    // Run search tests
    console.log('📍 Testing places search...');
    await this.testPlacesSearch();

    // Run nearby tests
    console.log('🔍 Testing nearby places...');
    await this.testPlacesNearby();

    // Test photos with sample data
    if (this.results.searchTests.length > 0 && this.results.searchTests[0].data) {
      console.log('📸 Testing photo URLs...');
      await this.testPhotoUrls(this.results.searchTests[0].data);
    }

    // Test backward compatibility
    const searchResults = this.results.searchTests
      .filter(t => t.data)
      .map(t => t.data);
    const nearbyResults = this.results.nearbyTests
      .filter(t => t.data)
      .map(t => t.data);

    if (searchResults.length > 0 || nearbyResults.length > 0) {
      console.log('🔄 Testing backward compatibility...');
      await this.testBackwardCompatibility(searchResults, nearbyResults);
    }

    // Test error handling
    console.log('⚠️ Testing error handling...');
    await this.testErrorHandling();

    return this.results;
  }

  // Generate test report
  generateReport(): string {
    const allTests = [
      ...this.results.searchTests,
      ...this.results.nearbyTests,
      ...this.results.detailsTests,
      ...this.results.photoTests,
      ...this.results.compatibilityTests,
      ...this.results.errorTests,
      ...this.results.performanceTests
    ];

    const passCount = allTests.filter(t => t.status === 'pass').length;
    const failCount = allTests.filter(t => t.status === 'fail').length;
    const warningCount = allTests.filter(t => t.status === 'warning').length;

    const avgDuration = allTests
      .filter(t => t.duration)
      .reduce((sum, t) => sum + (t.duration || 0), 0) / allTests.filter(t => t.duration).length;

    return `
🧪 Google Places API Migration Test Report
==========================================

📊 Summary:
- ✅ Passed: ${passCount}
- ❌ Failed: ${failCount}
- ⚠️ Warnings: ${warningCount}
- 📈 Avg Response Time: ${avgDuration.toFixed(2)}ms

📍 Search Tests: ${this.results.searchTests.map(t => `${t.status === 'pass' ? '✅' : t.status === 'fail' ? '❌' : '⚠️'} ${t.testName}`).join('\n')}

🔍 Nearby Tests: ${this.results.nearbyTests.map(t => `${t.status === 'pass' ? '✅' : t.status === 'fail' ? '❌' : '⚠️'} ${t.testName}`).join('\n')}

📸 Photo Tests: ${this.results.photoTests.map(t => `${t.status === 'pass' ? '✅' : t.status === 'fail' ? '❌' : '⚠️'} ${t.testName}`).join('\n')}

🔄 Compatibility Tests: ${this.results.compatibilityTests.map(t => `${t.status === 'pass' ? '✅' : t.status === 'fail' ? '❌' : '⚠️'} ${t.testName}`).join('\n')}

⚠️ Error Handling Tests: ${this.results.errorTests.map(t => `${t.status === 'pass' ? '✅' : t.status === 'fail' ? '❌' : '⚠️'} ${t.testName}`).join('\n')}
    `;
  }
}

// Export singleton instance
export const placesApiTester = new GooglePlacesAPITester();
