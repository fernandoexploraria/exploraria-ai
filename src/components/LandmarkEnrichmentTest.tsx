
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const { toast } = useToast();

  // Test with first 3 landmarks for Phase 1
  const testLandmarks = TOP_LANDMARKS.slice(0, 3);

  const handleEnrichment = async () => {
    setIsEnriching(true);
    setResults([]);

    try {
      console.log('Starting enrichment test with 3 landmarks...');
      
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
        
        const summary = data.summary;
        toast({
          title: "Enrichment Complete",
          description: `${summary.success} successful, ${summary.failed} failed, ${summary.notFound} not found`,
        });
        
        console.log('Enrichment results:', data.enrichedLandmarks);
        console.log('Summary:', summary);
      }

    } catch (error) {
      console.error('Enrichment error:', error);
      toast({
        title: "Enrichment Failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Landmark Enrichment Test - Phase 1</CardTitle>
          <p className="text-sm text-gray-600">
            Testing enrichment with the first 3 landmarks to validate the process
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Test Landmarks:</h3>
            <ul className="list-disc list-inside space-y-1">
              {testLandmarks.map((landmark, index) => (
                <li key={index} className="text-sm">
                  {landmark.name} - {landmark.coordinates.join(', ')}
                </li>
              ))}
            </ul>
          </div>

          <Button 
            onClick={handleEnrichment} 
            disabled={isEnriching}
            className="w-full"
          >
            {isEnriching ? 'Enriching Landmarks...' : 'Start Enrichment Test'}
          </Button>

          {results.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-4">Enrichment Results:</h3>
              <div className="space-y-3">
                {results.map((landmark, index) => (
                  <Card key={index} className="p-4">
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
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LandmarkEnrichmentTest;
