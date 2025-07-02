
import { useState, useCallback, useRef } from 'react';
import { useStreetView } from '@/hooks/useStreetView';
import { Landmark } from '@/data/landmarks';

interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  isLoading: boolean;
}

interface BatchResult {
  landmark: Landmark;
  data: any | null;
  status: 'success' | 'failed' | 'pending';
}

const MAX_CONCURRENT_REQUESTS = 3;
const BATCH_DELAY_MS = 500; // Delay between batches to avoid rate limiting

export const useStreetViewBatch = () => {
  const [progress, setProgress] = useState<BatchProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    isLoading: false
  });
  
  const [results, setResults] = useState<BatchResult[]>([]);
  const abortController = useRef<AbortController | null>(null);
  const { getStreetView, getCachedData, isKnownUnavailable } = useStreetView();

  const batchPreloadStreetView = useCallback(async (landmarks: Landmark[]): Promise<BatchResult[]> => {
    // Cancel any ongoing batch operation
    if (abortController.current) {
      abortController.current.abort();
    }
    
    abortController.current = new AbortController();
    const signal = abortController.current.signal;

    // Filter landmarks that need processing
    const landmarksToProcess = landmarks.filter(landmark => {
      const cached = getCachedData(landmark.id);
      const unavailable = isKnownUnavailable(landmark.id);
      return !cached && !unavailable;
    });

    console.log(`🔄 Starting batch Street View pre-loading for ${landmarksToProcess.length} landmarks`);

    setProgress({
      total: landmarksToProcess.length,
      completed: 0,
      failed: 0,
      isLoading: true
    });

    const batchResults: BatchResult[] = landmarks.map(landmark => ({
      landmark,
      data: getCachedData(landmark.id),
      status: getCachedData(landmark.id) ? 'success' : 
              isKnownUnavailable(landmark.id) ? 'failed' : 'pending'
    }));

    setResults([...batchResults]);

    // Process in batches to avoid overwhelming the API
    const batches: Landmark[][] = [];
    for (let i = 0; i < landmarksToProcess.length; i += MAX_CONCURRENT_REQUESTS) {
      batches.push(landmarksToProcess.slice(i, i + MAX_CONCURRENT_REQUESTS));
    }

    let completed = 0;
    let failed = 0;

    for (const batch of batches) {
      if (signal.aborted) break;

      // Process current batch concurrently
      const batchPromises = batch.map(async (landmark) => {
        try {
          const data = await getStreetView(landmark);
          const resultIndex = batchResults.findIndex(r => r.landmark.id === landmark.id);
          if (resultIndex !== -1) {
            batchResults[resultIndex] = {
              landmark,
              data,
              status: data ? 'success' : 'failed'
            };
          }
          return data ? 'success' : 'failed';
        } catch (error) {
          console.error(`❌ Batch error for ${landmark.name}:`, error);
          const resultIndex = batchResults.findIndex(r => r.landmark.id === landmark.id);
          if (resultIndex !== -1) {
            batchResults[resultIndex] = {
              landmark,
              data: null,
              status: 'failed'
            };
          }
          return 'failed';
        }
      });

      const batchResultStatuses = await Promise.all(batchPromises);
      
      // Update progress
      batchResultStatuses.forEach(status => {
        if (status === 'success') completed++;
        else failed++;
      });

      setProgress(prev => ({
        ...prev,
        completed,
        failed
      }));

      setResults([...batchResults]);

      // Add delay between batches to be API-friendly
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    setProgress(prev => ({ ...prev, isLoading: false }));
    
    console.log(`✅ Batch Street View pre-loading completed: ${completed} successful, ${failed} failed`);
    
    return batchResults;
  }, [getStreetView, getCachedData, isKnownUnavailable]);

  const cancelBatch = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
      console.log('🛑 Batch Street View pre-loading cancelled');
    }
    setProgress(prev => ({ ...prev, isLoading: false }));
  }, []);

  const getSuccessfulResults = useCallback(() => {
    return results.filter(result => result.status === 'success' && result.data);
  }, [results]);

  return {
    batchPreloadStreetView,
    cancelBatch,
    progress,
    results,
    getSuccessfulResults
  };
};
