import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

export const useDeepLinkHandler = () => {
  useEffect(() => {
    // Only run in Capacitor environment
    if (!(window as any).Capacitor?.isNativePlatform?.()) {
      return;
    }

    const handleAppUrlOpen = async (data: any) => {
      console.log('Deep link received:', data.url);
      
      // Check if this is an auth callback
      if (data.url.startsWith('app.lovable.exploraria://auth-callback')) {
        try {
          // Extract the fragment from the URL which contains the auth tokens
          const url = new URL(data.url);
          const fragment = url.hash || url.search;
          
          if (fragment) {
            console.log('Processing auth callback with fragment:', fragment);
            
            // Handle the auth callback - Supabase will automatically process the tokens
            const { data: sessionData, error } = await supabase.auth.getSession();
            
            if (error) {
              console.error('Error processing auth callback:', error);
            } else {
              console.log('Auth callback processed successfully');
            }
          }
        } catch (error) {
          console.error('Error handling deep link:', error);
        }
      }
    };

    // Add the listener for app URL open events
    App.addListener('appUrlOpen', handleAppUrlOpen);

    // Cleanup
    return () => {
      App.removeAllListeners();
    };
  }, []);
};