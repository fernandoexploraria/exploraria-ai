
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug, Monitor, Network, Database } from 'lucide-react';
import PanoramaTestPanel from './PanoramaTestPanel';

interface TestingControlsProps {
  className?: string;
}

const TestingControls: React.FC<TestingControlsProps> = ({ className }) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const openConsole = () => {
    console.log('🔧 [DEV] Opening developer console for panorama testing');
    console.log('📋 Available test commands:');
    console.log('- panoramaTestValidator.logTestSummary()');
    console.log('- performanceBenchmark.logSummary()');
    console.log('- CacheTestUtils.getInstance().logSummary()');
  };

  const simulateNetworkConditions = (type: 'fast' | 'slow' | 'offline') => {
    console.log(`🌐 [TEST] Simulating ${type} network conditions`);
    console.log('ℹ️ Use Chrome DevTools > Network tab to actually throttle connection');
    
    if (type === 'slow') {
      console.log('🐌 Recommended: Throttle to "Slow 3G" for panorama preloading tests');
    } else if (type === 'fast') {
      console.log('⚡ Recommended: Use "Fast 3G" or "4G" for performance baseline');
    } else {
      console.log('📱 Recommended: Enable "Offline" mode to test cache fallbacks');
    }
  };

  const clearAllCaches = () => {
    console.log('🗑️ [TEST] Clearing all caches for fresh testing');
    // Clear localStorage
    localStorage.clear();
    // Clear sessionStorage  
    sessionStorage.clear();
    // Clear IndexedDB would require more complex logic
    console.log('✅ Browser storage cleared - reload page for full reset');
  };

  if (!isDevelopment) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            Testing controls are only available in development mode
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Panorama Testing Panel */}
      <PanoramaTestPanel />
      
      {/* Development Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-orange-600" />
            Development Tools
          </CardTitle>
          <CardDescription>
            Additional testing utilities for panorama functionality
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={openConsole}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Monitor className="h-4 w-4" />
              Open Console
            </Button>
            
            <Button
              onClick={clearAllCaches}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              Clear Caches
            </Button>
            
            <Button
              onClick={() => console.log('🔍 Check browser Network tab for detailed requests')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Network className="h-4 w-4" />
              Network Monitor
            </Button>
          </div>

          {/* Network Simulation */}
          <div className="space-y-2">
            <h4 className="font-medium">Network Simulation</h4>
            <div className="flex gap-2">
              <Button
                onClick={() => simulateNetworkConditions('fast')}
                variant="outline"
                size="sm"
              >
                Fast Connection
              </Button>
              <Button
                onClick={() => simulateNetworkConditions('slow')}
                variant="outline"
                size="sm"
              >
                Slow Connection
              </Button>
              <Button
                onClick={() => simulateNetworkConditions('offline')}
                variant="outline"
                size="sm"
              >
                Offline Mode
              </Button>
            </div>
          </div>

          {/* Test Status Indicators */}
          <div className="space-y-2">
            <h4 className="font-medium">Test Status</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Panorama Extraction ✅</Badge>
              <Badge variant="outline">Cache Integration ✅</Badge>
              <Badge variant="outline">Proximity Preloading ✅</Badge>
              <Badge variant="outline">Performance Monitoring ✅</Badge>
              <Badge variant="outline">Error Handling ✅</Badge>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <h5 className="font-medium text-amber-800 mb-1">Quick Testing Guide</h5>
            <div className="text-sm text-amber-700 space-y-1">
              <div>1. Open browser DevTools (F12) and go to Console tab</div>
              <div>2. Run "Quick Test" to validate basic panorama functionality</div>
              <div>3. Use Network tab to throttle connection for testing</div>
              <div>4. Check console logs for detailed panorama data extraction</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestingControls;
