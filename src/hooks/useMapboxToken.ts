
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useMapboxToken = () => {
  const [mapboxToken, setMapboxToken] = useState<string>('');

  useEffect(() => {
    const fetchMapboxToken = async () => {
      console.log('🗺️ [MapboxToken] Starting token fetch process...');
      
      try {
        console.log('🗺️ [MapboxToken] Calling Supabase edge function...');
        const startTime = Date.now();
        
        // Add a timeout to prevent hanging requests
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000);
        });
        
        const fetchPromise = supabase.functions.invoke('get-mapbox-token');
        
        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;
        const endTime = Date.now();
        
        console.log(`🗺️ [MapboxToken] Edge function completed in ${endTime - startTime}ms`);
        
        if (error) {
          console.error('🗺️ [MapboxToken] Edge function error:', error);
          console.log('🗺️ [MapboxToken] Falling back to hardcoded token...');
          setMapboxToken('pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg');
        } else if (data && data.token) {
          console.log('🗺️ [MapboxToken] Successfully received token from edge function');
          setMapboxToken(data.token);
        } else {
          console.log('🗺️ [MapboxToken] No token in response data, using fallback');
          setMapboxToken('pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg');
        }
      } catch (error) {
        console.error('🗺️ [MapboxToken] Fetch error:', error);
        console.log('🗺️ [MapboxToken] Exception caught, using fallback token...');
        setMapboxToken('pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg');
      }
    };

    console.log('🗺️ [MapboxToken] useEffect triggered, current token:', mapboxToken);
    fetchMapboxToken();
  }, []);

  console.log('🗺️ [MapboxToken] Hook returning token:', mapboxToken ? 'TOKEN_PRESENT' : 'TOKEN_EMPTY');
  return mapboxToken;
};
