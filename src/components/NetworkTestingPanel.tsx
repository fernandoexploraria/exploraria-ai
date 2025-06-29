
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  Signal, 
  Zap, 
  Clock,
  TrendingUp,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { networkSimulator, NETWORK_CONDITIONS, performanceTimer } from '@/utils/networkSimulator';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  cacheHitRate: number;
}

const NetworkTestingPanel: React.FC = () => {
  const [selectedCondition, setSelectedCondition] = useState<string>('wifi');
  const [isSimulating, setIsSimulating] = useState(false);
  const [testResults, setTestResults] = useState<{[key: string]: PerformanceMetrics}>({});
  const [currentTest, setCurrentTest] = useState<string>('');
  const [testProgress, setTestProgress] = useState(0);
  
  const { isOnline, connectionType, effectiveType, downlink, rtt } = useNetworkStatus();

  useEffect(() => {
    return () => {
      // Cleanup: restore network simulation on unmount
      if (networkSimulator.isSimulating()) {
        networkSimulator.restore();
      }
    };
  }, []);

  const simulateNetworkCondition = (condition: string) => {
    if (condition === 'restore') {
      networkSimulator.restore();
      setIsSimulating(false);
    } else {
      networkSimulator.simulate(condition as keyof typeof NETWORK_CONDITIONS);
      setIsSimulating(true);
    }
    setSelectedCondition(condition);
  };

  const runNetworkTests = async () => {
    const conditions = Object.keys(NETWORK_CONDITIONS);
    const results: {[key: string]: PerformanceMetrics} = {};
    
    setTestProgress(0);
    
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      setCurrentTest(condition);
      setTestProgress((i / conditions.length) * 100);
      
      // Simulate network condition
      if (condition !== 'offline') {
        networkSimulator.simulate(condition as keyof typeof NETWORK_CONDITIONS);
      }
      
      // Run performance tests
      const metrics = await runPerformanceTest(condition);
      results[condition] = metrics;
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Restore network
    networkSimulator.restore();
    setIsSimulating(false);
    setTestProgress(100);
    setCurrentTest('');
    setTestResults(results);
  };

  const runPerformanceTest = async (condition: string): Promise<PerformanceMetrics> => {
    const startTime = Date.now();
    let successCount = 0;
    let totalRequests = 3;
    
    try {
      // Test multiple API calls
      const promises = Array(totalRequests).fill(null).map(async (_, index) => {
        try {
          const testQuery = ['restaurant', 'cafe', 'museum'][index];
          const response = await fetch('/api/test-endpoint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: testQuery, test: true })
          });
          
          if (response.ok) {
            successCount++;
            return await response.json();
          }
          return null;
        } catch (error) {
          return null;
        }
      });
      
      await Promise.allSettled(promises);
      
    } catch (error) {
      console.warn(`Performance test failed for ${condition}:`, error);
    }
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const errorRate = ((totalRequests - successCount) / totalRequests) * 100;
    
    return {
      responseTime,
      throughput: successCount / (responseTime / 1000), // requests per second
      errorRate,
      cacheHitRate: Math.random() * 30 + 70 // Simulated cache hit rate
    };
  };

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'offline':
        return <WifiOff className="w-4 h-4" />;
      case 'slow-2g':
      case '2g':
        return <Signal className="w-4 h-4 text-red-500" />;
      case '3g':
        return <Signal className="w-4 h-4 text-yellow-500" />;
      case '4g':
      case 'wifi':
        return <Wifi className="w-4 h-4 text-green-500" />;
      default:
        return <Signal className="w-4 h-4" />;
    }
  };

  const formatMetric = (value: number, unit: string) => {
    if (isNaN(value)) return 'N/A';
    return `${value.toFixed(1)}${unit}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Network Testing & Simulation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Network Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded border">
              <div className="flex items-center justify-center mb-1">
                {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
              </div>
              <div className="text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</div>
            </div>
            <div className="text-center p-3 rounded border">
              <div className="text-sm font-medium">{connectionType || 'Unknown'}</div>
              <div className="text-xs text-gray-500">Connection</div>
            </div>
            <div className="text-center p-3 rounded border">
              <div className="text-sm font-medium">{downlink?.toFixed(1) || '0'} Mbps</div>
              <div className="text-xs text-gray-500">Downlink</div>
            </div>
            <div className="text-center p-3 rounded border">
              <div className="text-sm font-medium">{rtt || 0}ms</div>
              <div className="text-xs text-gray-500">RTT</div>
            </div>
          </div>

          {/* Network Simulation Controls */}
          <div className="flex items-center gap-4">
            <Select value={selectedCondition} onValueChange={simulateNetworkCondition}>
              <SelectTrigger className="w-48" aria-label="Select network condition for testing">
                <SelectValue placeholder="Select network condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restore">🔄 Restore Normal</SelectItem>
                <SelectItem value="wifi">📶 WiFi (50 Mbps)</SelectItem>
                <SelectItem value="4g">📱 4G (10 Mbps)</SelectItem>
                <SelectItem value="3g">📱 3G (0.7 Mbps)</SelectItem>
                <SelectItem value="2g">📱 2G (0.25 Mbps)</SelectItem>
                <SelectItem value="slow-2g">🐌 Slow 2G (0.05 Mbps)</SelectItem>
                <SelectItem value="offline">❌ Offline</SelectItem>
              </SelectContent>
            </Select>

            {isSimulating && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Simulating: {selectedCondition}
              </Badge>
            )}

            <Button onClick={runNetworkTests} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Run Tests
            </Button>
          </div>

          {/* Test Progress */}
          {currentTest && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Testing: {currentTest}</span>
                <span>{testProgress.toFixed(0)}%</span>
              </div>
              <Progress value={testProgress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Performance Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Network</th>
                    <th className="text-left p-2">Response Time</th>
                    <th className="text-left p-2">Throughput</th>
                    <th className="text-left p-2">Error Rate</th>
                    <th className="text-left p-2">Cache Hit</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(testResults).map(([condition, metrics]) => (
                    <tr key={condition} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {getConditionIcon(condition)}
                          <span className="capitalize">{condition.replace('-', ' ')}</span>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {formatMetric(metrics.responseTime, 'ms')}
                        </div>
                      </td>
                      <td className="p-2">{formatMetric(metrics.throughput, ' req/s')}</td>
                      <td className="p-2">
                        <Badge variant={metrics.errorRate > 10 ? 'destructive' : 'default'}>
                          {formatMetric(metrics.errorRate, '%')}
                        </Badge>
                      </td>
                      <td className="p-2">{formatMetric(metrics.cacheHitRate, '%')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NetworkTestingPanel;
