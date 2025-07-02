
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Play, RotateCcw, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import { usePanoramaTestRunner } from '@/hooks/usePanoramaTestRunner';

interface PanoramaTestPanelProps {
  className?: string;
}

const PanoramaTestPanel: React.FC<PanoramaTestPanelProps> = ({ className }) => {
  const {
    isRunning,
    currentTest,
    progress,
    results,
    errors,
    runAllTests,
    runQuickTest,
    getTestSummary,
    clearResults
  } = usePanoramaTestRunner();

  const summary = getTestSummary();

  return (
    <Card className={`w-full max-w-4xl ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-blue-600" />
          Panorama Testing & Validation
        </CardTitle>
        <CardDescription>
          Test panorama data extraction, caching, and proximity integration
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Test Controls */}
        <div className="flex gap-2">
          <Button
            onClick={runAllTests}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Run Full Test Suite
          </Button>
          
          <Button
            onClick={runQuickTest}
            disabled={isRunning}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Quick Test
          </Button>
          
          <Button
            onClick={clearResults}
            disabled={isRunning}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Clear Results
          </Button>
        </div>

        {/* Test Progress */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {currentTest ? `Running: ${currentTest}` : 'Preparing tests...'}
              </span>
              <span className="text-sm text-gray-500">{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Test Summary */}
        {summary.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
              <div className="text-sm text-gray-500">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
              <div className="text-sm text-gray-500">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.passRate}%</div>
              <div className="text-sm text-gray-500">Pass Rate</div>
            </div>
          </div>
        )}

        {/* Recent Test Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Recent Test Results</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {results.slice(-5).reverse().map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {result.passed ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">{result.scenario}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={result.passed ? "default" : "destructive"}>
                      {result.passed ? 'PASS' : 'FAIL'}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Messages */}
        {errors.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-red-600">Test Errors</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {errors.slice(-3).map((error, index) => (
                <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Test Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3 w-3" />
                Panorama Data Retrieval
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3 w-3" />
                Caching Behavior
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3 w-3" />
                Proximity Preloading
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3 w-3" />
                Fallback Scenarios
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-3 w-3" />
                Performance Validation
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Test Coverage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>• High-traffic landmarks (Times Square, Golden Gate)</div>
              <div>• Tourist destinations (Central Park, Pier 39)</div>
              <div>• Residential areas (Limited panorama)</div>
              <div>• Remote locations (No panorama)</div>
              <div>• Network conditions (Fast/slow/offline)</div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-2">Testing Instructions</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <div>1. <strong>Quick Test:</strong> Validates basic panorama functionality with Times Square</div>
            <div>2. <strong>Full Suite:</strong> Tests all scenarios including edge cases and performance</div>
            <div>3. <strong>Monitor Console:</strong> Check browser dev tools for detailed logs</div>
            <div>4. <strong>Network Testing:</strong> Use dev tools to throttle connection speeds</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PanoramaTestPanel;
