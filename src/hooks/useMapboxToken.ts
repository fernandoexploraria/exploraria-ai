
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useMapboxToken = () => {
  const [mapboxToken, setMapboxToken] = useState<string>('');

  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) {
          console.error('Error fetching Mapbox token:', error);
          // Fallback to hardcoded token if secret fetch fails
          setMapboxToken('pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg');
        } else {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        // Fallback to hardcoded token
        setMapboxToken('pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg');
      }
    };

    fetchMapboxToken();
  }, []);

  return mapboxToken;
};
