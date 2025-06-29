import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  TestTube, 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw
} from 'lucide-react';
import { placesApiTester, GooglePlacesAPITester } from '@/utils/placesApiTesting';
import { useToast } from '@/hooks/use-toast';

interface TestResult {
  testName: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  data?: any;
  duration?: number;
}

const PlacesApiTestPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const runTests = async () => {
    setIsRunning(true);
    try {
      toast({
        title: "Starting Tests",
        description: "Running comprehensive Google Places API tests...",
      });

      const testResults = await placesApiTester.runComprehensiveTests();
      setResults(testResults);

      const allTests = [
        ...testResults.searchTests,
        ...testResults.nearbyTests,
        ...testResults.detailsTests,
        ...testResults.photoTests,
        ...testResults.compatibilityTests,
        ...testResults.errorTests,
        ...testResults.performanceTests
      ];

      const failCount = allTests.filter(t => t.status === 'fail').length;
      
      toast({
        title: failCount === 0 ? "Tests Completed Successfully!" : "Tests Completed with Issues",
        description: `${allTests.length} tests run, ${failCount} failures`,
        variant: failCount === 0 ? "default" : "destructive"
      });

    } catch (error) {
      console.error('Test execution failed:', error);
      toast({
        title: "Test Execution Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const downloadReport = () => {
    if (!results) return;

    const report = placesApiTester.generateReport();
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `places-api-test-report-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pass: 'default',
      fail: 'destructive',
      warning: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const renderTestResults = (tests: TestResult[], title: string) => {
    if (!tests || tests.length === 0) return null;

    const passCount = tests.filter(t => t.status === 'pass').length;
    const failCount = tests.filter(t => t.status === 'fail').length;
    const warningCount = tests.filter(t => t.status === 'warning').length;

    return (
      <Card className="mb-4">
        <Collapsible>
          <CollapsibleTrigger 
            className="w-full"
            onClick={() => toggleSection(title)}
          >
            <CardHeader className="cursor-pointer hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {expandedSections.has(title) ? 
                    <ChevronDown className="w-4 h-4" /> : 
                    <ChevronRight className="w-4 h-4" />
                  }
                  <CardTitle className="text-sm">{title}</CardTitle>
                </div>
                <div className="flex gap-2">
                  {passCount > 0 && <Badge variant="default">{passCount} ✅</Badge>}
                  {failCount > 0 && <Badge variant="destructive">{failCount} ❌</Badge>}
                  {warningCount > 0 && <Badge variant="secondary">{warningCount} ⚠️</Badge>}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent>
              <div className="space-y-2">
                {tests.map((test, index) => (
                  <div key={index} className="flex items-start gap-3 p-2 rounded border">
                    {getStatusIcon(test.status)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{test.testName}</span>
                        <div className="flex items-center gap-2">
                          {test.duration && (
                            <span className="text-xs text-gray-500">
                              {test.duration.toFixed(0)}ms
                            </span>
                          )}
                          {getStatusBadge(test.status)}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{test.message}</p>
                      {test.data && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer">
                            View test data
                          </summary>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(test.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            <CardTitle>Google Places API Test Suite</CardTitle>
          </div>
          <div className="flex gap-2">
            {results && (
              <Button
                variant="outline"
                size="sm"
                onClick={downloadReport}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            )}
            <Button
              onClick={runTests}
              disabled={isRunning}
              size="sm"
            >
              {isRunning ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {isRunning ? 'Running Tests...' : 'Run Tests'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!results && !isRunning && (
          <div className="text-center py-8 text-gray-500">
            <TestTube className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run Tests" to start comprehensive API validation</p>
          </div>
        )}

        {isRunning && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-600" />
            <p className="text-blue-600">Running comprehensive tests...</p>
            <p className="text-sm text-gray-500 mt-2">
              Testing search, nearby, photos, compatibility, and error handling
            </p>
          </div>
        )}

        {results && (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {renderTestResults(results.searchTests, 'Places Search Tests')}
              {renderTestResults(results.nearbyTests, 'Nearby Places Tests')}
              {renderTestResults(results.photoTests, 'Photo URL Tests')}
              {renderTestResults(results.compatibilityTests, 'Backward Compatibility Tests')}
              {renderTestResults(results.errorTests, 'Error Handling Tests')}
              {renderTestResults(results.performanceTests, 'Performance Tests')}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default PlacesApiTestPanel;
