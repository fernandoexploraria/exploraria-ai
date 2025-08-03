import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TOP_LANDMARKS } from '@/data/topLandmarks';

interface EnrichedLandmark {
  name: string;
  coordinates: [number, number];
  description: string;
  place_id?: string;
  enrichment_status: 'success' | 'failed' | 'not_found';
  error?: string;
}

const LandmarkEnrichmentTest: React.FC = () => {
  const [isEnriching, setIsEnriching] = useState(false);
  const [results, setResults] = useState<EnrichedLandmark[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [enrichedCode, setEnrichedCode] = useState<string>('');
  const [showCode, setShowCode] = useState(false);
  const { toast } = useToast();

  // Test with first 3 landmarks for Phase 1
  const testLandmarks = TOP_LANDMARKS.slice(0, 3);
  
  const BATCH_SIZE = 5; // Process 5 landmarks at a time
  const BATCH_DELAY = 2000; // 2 second delay between batches

  const handlePhase1Test = async () => {
    setIsEnriching(true);
    setResults([]);
    setProgress(0);

    try {
      console.log('Starting Phase 1 enrichment test with 3 landmarks...');
      
      const { data, error } = await supabase.functions.invoke('enrich-landmark', {
        body: {
          landmarks: testLandmarks
        }
      });

      if (error) {
        throw error;
      }

      if (data?.enrichedLandmarks) {
        setResults(data.enrichedLandmarks);
        
        console.log('Phase 1 results:', data.enrichedLandmarks);
      }

    } catch (error) {
      console.error('Phase 1 enrichment error:', error);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleBulkEnrichment = async () => {
    setIsEnriching(true);
    setResults([]);
    setProgress(0);
    setShowCode(false);
    setEnrichedCode('');

    const allResults: EnrichedLandmark[] = [];
    const batches = [];
    
    // Split landmarks into batches
    for (let i = 0; i < TOP_LANDMARKS.length; i += BATCH_SIZE) {
      batches.push(TOP_LANDMARKS.slice(i, i + BATCH_SIZE));
    }
    
    setTotalBatches(batches.length);
    
    try {
      console.log(`Starting bulk enrichment of ${TOP_LANDMARKS.length} landmarks in ${batches.length} batches...`);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        setCurrentBatch(batchIndex + 1);
        const batch = batches[batchIndex];
        
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} landmarks...`);
        
        try {
          const { data, error } = await supabase.functions.invoke('enrich-landmark', {
            body: {
              landmarks: batch
            }
          });

          if (error) {
            console.error(`Batch ${batchIndex + 1} error:`, error);
            // Add failed landmarks to results
            batch.forEach(landmark => {
              allResults.push({
                ...landmark,
                enrichment_status: 'failed',
                error: error.message
              });
            });
          } else if (data?.enrichedLandmarks) {
            allResults.push(...data.enrichedLandmarks);
            console.log(`Batch ${batchIndex + 1} completed: ${data.summary.success} successful`);
          }
        } catch (batchError) {
          console.error(`Batch ${batchIndex + 1} exception:`, batchError);
          // Add failed landmarks to results
          batch.forEach(landmark => {
            allResults.push({
              ...landmark,
              enrichment_status: 'failed',
              error: batchError.message
            });
          });
        }
        
        // Update progress
        const progressPercent = ((batchIndex + 1) / batches.length) * 100;
        setProgress(progressPercent);
        setResults([...allResults]);
        
        // Add delay between batches (except for the last one)
        if (batchIndex < batches.length - 1) {
          console.log(`Waiting ${BATCH_DELAY}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      // Generate the enriched TypeScript code
      generateEnrichedCode(allResults);
      
      const successCount = allResults.filter(l => l.enrichment_status === 'success').length;
      const failedCount = allResults.filter(l => l.enrichment_status === 'failed').length;
      const notFoundCount = allResults.filter(l => l.enrichment_status === 'not_found').length;
      
      console.log(`Bulk enrichment complete: ${successCount}/${TOP_LANDMARKS.length} landmarks enriched successfully`);

    } catch (error) {
      console.error('Bulk enrichment error:', error);
    } finally {
      setIsEnriching(false);
    }
  };

  const generateEnrichedCode = (enrichedResults: EnrichedLandmark[]) => {
    const codeLines = [
      'export interface TopLandmark {',
      '  name: string;',
      '  coordinates: [number, number];',
      '  description: string;',
      '  place_id?: string;',
      '}',
      '',
      '// Top 100 most visited landmarks around the world with approximate coordinates',
      'export const TOP_LANDMARKS: TopLandmark[] = ['
    ];

    enrichedResults.forEach((landmark, index) => {
      const placeIdPart = landmark.place_id ? `, place_id: "${landmark.place_id}"` : '';
      const line = `  { name: "${landmark.name}", coordinates: [${landmark.coordinates.join(', ')}], description: "${landmark.description}"${placeIdPart} }${index < enrichedResults.length - 1 ? ',' : ''}`;
      codeLines.push(line);
    });

    codeLines.push('];');
    
    setEnrichedCode(codeLines.join('\n'));
    setShowCode(true);
  };

  const copyCodeToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(enrichedCode);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const successCount = results.filter(l => l.enrichment_status === 'success').length;
  const failedCount = results.filter(l => l.enrichment_status === 'failed').length;
  const notFoundCount = results.filter(l => l.enrichment_status === 'not_found').length;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Landmark Enrichment - Phase 1 & 2</CardTitle>
            <p className="text-sm text-gray-600">
              Phase 1: Test with 3 landmarks | Phase 2: Bulk process all 100 landmarks
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Phase 1 Section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Phase 1: Test Enrichment (3 landmarks)</h3>
              <div className="mb-4">
                <h4 className="font-medium mb-2">Test Landmarks:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {testLandmarks.map((landmark, index) => (
                    <li key={index}>
                      {landmark.name} - {landmark.coordinates.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
              <Button 
                onClick={handlePhase1Test} 
                disabled={isEnriching}
                variant="outline"
                className="w-full"
              >
                {isEnriching ? 'Testing...' : 'Run Phase 1 Test'}
              </Button>
            </div>

            {/* Phase 2 Section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Phase 2: Bulk Enrichment (All 100 landmarks)</h3>
              <div className="mb-4 space-y-2">
                <p className="text-sm text-gray-600">
                  This will process all {TOP_LANDMARKS.length} landmarks in batches of {BATCH_SIZE} with {BATCH_DELAY/1000}s delays between batches.
                </p>
                {isEnriching && totalBatches > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Batch {currentBatch} of {totalBatches}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-gray-500">
                      Processed: {results.length} / {TOP_LANDMARKS.length} landmarks
                    </p>
                  </div>
                )}
              </div>
              <Button 
                onClick={handleBulkEnrichment} 
                disabled={isEnriching}
                className="w-full"
              >
                {isEnriching ? `Processing Batch ${currentBatch}/${totalBatches}...` : 'Start Phase 2 - Bulk Enrichment'}
              </Button>
            </div>

            {/* Results Summary */}
            {results.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Enrichment Summary</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{successCount}</div>
                    <div className="text-sm text-gray-600">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{failedCount}</div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{notFoundCount}</div>
                    <div className="text-sm text-gray-600">Not Found</div>
                  </div>
                </div>
                
                {showCode && enrichedCode && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">Generated Enriched Code:</h4>
                      <Button onClick={copyCodeToClipboard} size="sm" variant="outline">
                        Copy Code
                      </Button>
                    </div>
                    <ScrollArea className="h-96">
                      <div className="bg-gray-100 p-4 rounded-lg">
                        <pre className="text-xs font-mono whitespace-pre-wrap">{enrichedCode}</pre>
                      </div>
                    </ScrollArea>
                    <p className="text-sm text-gray-600 mt-2">
                      Copy this code and replace the content in <code>src/data/topLandmarks.ts</code>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Detailed Results */}
            {results.length > 0 && !showCode && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-4">Detailed Results (showing first 20):</h3>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {results.slice(0, 20).map((landmark, index) => (
                      <Card key={index} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{landmark.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">{landmark.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Coordinates: {landmark.coordinates.join(', ')}
                            </p>
                            {landmark.place_id && (
                              <p className="text-xs font-mono text-green-600 mt-1">
                                Place ID: {landmark.place_id}
                              </p>
                            )}
                            {landmark.error && (
                              <p className="text-xs text-red-600 mt-1">
                                Error: {landmark.error}
                              </p>
                            )}
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            landmark.enrichment_status === 'success' 
                              ? 'bg-green-100 text-green-800'
                              : landmark.enrichment_status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {landmark.enrichment_status}
                          </div>
                        </div>
                      </Card>
                    ))}
                    {results.length > 20 && (
                      <p className="text-sm text-gray-500 text-center">
                        ... and {results.length - 20} more results
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default LandmarkEnrichmentTest;
