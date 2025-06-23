
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useStoreSplashImage = () => {
  const [isStoring, setIsStoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeSplashImage = async () => {
    setIsStoring(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('store-splash-image');
      
      if (error) {
        throw error;
      }
      
      console.log('Splash image stored:', data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error storing splash image:', errorMessage);
      throw err;
    } finally {
      setIsStoring(false);
    }
  };

  return {
    storeSplashImage,
    isStoring,
    error
  };
};
