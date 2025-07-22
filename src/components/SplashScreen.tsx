
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface SplashScreenProps {
  onDismiss: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageError, setImageError] = useState(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  
  const { isSlowConnection, effectiveType, getRecommendedTimeout } = useNetworkStatus();

  useEffect(() => {
    const startTime = Date.now();
    const isManualTrigger = localStorage.getItem('splash-manual-trigger') === 'true';
    
    // Enhanced timing for different scenarios
    const minDisplayTime = isManualTrigger ? 3000 : 5000; // 5 seconds for auto (first-time), 3 for manual
    const isFirstTimeVisitor = !localStorage.getItem('has-visited');
    
    let imageLoadPromise: Promise<void>;
    let timeoutId: NodeJS.Timeout;
    let dismissed = false;

    console.log(`🎬 Splash screen initialized - ${isManualTrigger ? 'manually triggered' : 'auto triggered'}`);
    console.log(`🎬 First time visitor: ${isFirstTimeVisitor}`);
    
    // Clear manual trigger flag
    localStorage.removeItem('splash-manual-trigger');

    // Check if image is cached from previous visit
    const cachedImageUrl = localStorage.getItem('splash-image-url');
    const cachedImageTime = localStorage.getItem('splash-image-cached-at');
    const cacheAge = cachedImageTime ? Date.now() - parseInt(cachedImageTime) : Infinity;
    const maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours

    // Skip image loading on very slow connections
    const shouldSkipImage = effectiveType === '2g' || effectiveType === 'slow-2g';

    if (shouldSkipImage) {
      console.log('🎬 Skipping background image on slow connection');
      setImageError(true);
      imageLoadPromise = Promise.resolve();
    } else if (cachedImageUrl && cacheAge < maxCacheAge && !isFirstTimeVisitor) {
      console.log('🎬 Using cached splash image URL');
      setImageUrl(cachedImageUrl);
      imageLoadPromise = preloadImage(cachedImageUrl);
    } else {
      // Get fresh image URL from Supabase
      const { data } = supabase.storage
        .from('static-assets')
        .getPublicUrl('splash-bg.jpg');
      
      if (data?.publicUrl) {
        const urlWithCacheHeaders = `${data.publicUrl}?cache=${Date.now()}`;
        setImageUrl(urlWithCacheHeaders);
        
        // Cache the URL for future use
        localStorage.setItem('splash-image-url', urlWithCacheHeaders);
        localStorage.setItem('splash-image-cached-at', Date.now().toString());
        
        imageLoadPromise = preloadImage(urlWithCacheHeaders);
      } else {
        console.warn('Could not get public URL for splash background image');
        setImageError(true);
        imageLoadPromise = Promise.resolve();
      }
    }

    // Show loading indicator earlier for auto-triggers (first-time visitors)
    const loadingIndicatorDelay = isManualTrigger ? 500 : 200;
    const loadingIndicatorTimeout = setTimeout(() => {
      if (!imageLoaded && !imageError && !dismissed) {
        console.log(`🎬 Showing loading indicator after ${loadingIndicatorDelay}ms - image still loading`);
        setShowLoadingIndicator(true);
      }
    }, loadingIndicatorDelay);

    // Enhanced timeout strategy - longer for first-time visitors
    const baseTimeout = getRecommendedTimeout();
    let maxTimeout: number;
    
    if (isFirstTimeVisitor) {
      // First-time visitors get longer timeout to ensure image loads
      maxTimeout = Math.max(baseTimeout * 3, 20000); // At least 20 seconds
    } else if (isManualTrigger) {
      maxTimeout = baseTimeout * 2;
    } else {
      maxTimeout = baseTimeout * 1.5;
    }
    
    console.log(`🎬 Using adaptive timeout: ${maxTimeout}ms for ${effectiveType} connection (first-time: ${isFirstTimeVisitor})`);

    const handleDismiss = () => {
      if (dismissed) return;
      dismissed = true;
      
      const elapsedTime = Date.now() - startTime;
      const remainingMinTime = Math.max(0, minDisplayTime - elapsedTime);
      
      console.log(`🎬 Dismissing splash after ${elapsedTime}ms (waiting ${remainingMinTime}ms more for min time)`);
      
      clearTimeout(timeoutId);
      clearTimeout(loadingIndicatorTimeout);
      
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Wait for fade out animation
      }, remainingMinTime);
    };

    // For auto-triggered (first-time visitor) splash, wait for image OR minimum display time + timeout
    if (!isManualTrigger) {
      // Auto-trigger: wait for BOTH minimum time AND (image load OR timeout)
      const minTimePromise = new Promise<void>((resolve) => {
        setTimeout(resolve, minDisplayTime);
      });
      
      const imageOrTimeoutPromise = Promise.race([
        imageLoadPromise,
        new Promise<void>((resolve) => {
          timeoutId = setTimeout(() => {
            console.log('🎬 Maximum timeout reached for auto-triggered splash screen');
            resolve();
          }, maxTimeout);
        })
      ]);
      
      Promise.all([minTimePromise, imageOrTimeoutPromise]).then(() => {
        if (!dismissed) {
          console.log('🎬 Auto-dismissing splash screen after minimum time and image load/timeout');
          handleDismiss();
        }
      });
    } else {
      // Manual trigger: existing behavior - wait for image load or timeout
      Promise.race([
        imageLoadPromise,
        new Promise<void>((resolve) => {
          timeoutId = setTimeout(() => {
            console.log('🎬 Maximum timeout reached for manual splash screen');
            resolve();
          }, maxTimeout);
        })
      ]).then(() => {
        if (!dismissed) {
          console.log('🎬 Auto-dismissing manual splash screen after image load or timeout');
          handleDismiss();
        }
      });
    }

    // User interaction handlers - with different behavior for manual vs auto trigger
    const handleUserInteraction = (e: Event) => {
      const elapsedTime = Date.now() - startTime;
      
      // For auto-triggers, enforce longer minimum display time for first-time visitors
      const requiredMinTime = isManualTrigger ? 1000 : (isFirstTimeVisitor ? 3000 : 2000);
      
      if (elapsedTime >= requiredMinTime) {
        console.log(`🎬 User dismissed splash after ${elapsedTime}ms`);
        handleDismiss();
      } else {
        console.log(`🎬 Ignoring early dismiss attempt (${elapsedTime}ms < ${requiredMinTime}ms)`);
      }
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(loadingIndicatorTimeout);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [effectiveType, getRecommendedTimeout, onDismiss]);

  const preloadImage = (url: string): Promise<void> => {
    console.log(`🎬 Starting to preload image: ${url.substring(0, 50)}...`);
    const startLoadTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        setImageLoaded(true);
        setImageError(false);
        setShowLoadingIndicator(false);
        
        // Calculate load time for diagnostics
        const loadTime = Date.now() - startLoadTime;
        console.log(`🎬 Splash background image loaded successfully in ${loadTime}ms`);
        
        resolve();
      };
      
      img.onerror = (e) => {
        console.warn(`🎬 Failed to load splash background image: ${e.toString()}`);
        console.warn(`🎬 URL attempted: ${url.substring(0, 50)}...`);
        console.warn('🎬 Using gradient fallback instead');
        
        setImageLoaded(false);
        setImageError(true);
        setShowLoadingIndicator(false);
        resolve(); // Resolve anyway to prevent hanging
      };
      
      img.src = url;
      
      // Force load attempt
      if (img.complete) {
        console.log('🎬 Image already cached in browser, triggering onload');
        img.onload?.(new Event('load') as any);
      }
    });
  };

  // Build the complete background style
  const getBackgroundStyle = () => {
    const baseStyle = {
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #3730a3 100%)'
    };

    if (imageLoaded && imageUrl && !imageError) {
      return {
        ...baseStyle,
        backgroundImage: `url("${imageUrl}"), linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #3730a3 100%)`,
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center, center',
        backgroundRepeat: 'no-repeat, no-repeat'
      };
    }

    return baseStyle;
  };

  if (!isVisible) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center animate-fade-out pointer-events-none"
        style={getBackgroundStyle()}
      >
        <div className="relative text-center animate-scale-out z-10">
          <img 
            src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
            alt="Exploraria Logo" 
            className="h-24 w-auto mx-auto mb-6 bg-yellow-400 rounded-2xl p-2"
          />
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Explore the world like never before
          </h1>
          <div className="w-16 h-1 bg-yellow-400 mx-auto rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={getBackgroundStyle()}
    >
      <div className="relative text-center animate-scale-in z-10">
        <img 
          src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
          alt="Exploraria Logo" 
          className="h-24 w-auto mx-auto mb-6 bg-yellow-400 rounded-2xl p-2"
        />
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
          Explore the world like never before
        </h1>
        <div className="w-16 h-1 bg-yellow-400 mx-auto rounded-full"></div>
        
        {/* Enhanced loading indicator and interaction hint */}
        <div className="mt-6 space-y-2">
          {showLoadingIndicator && (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          )}
          <p className="text-sm text-white/60 opacity-60">
            {showLoadingIndicator ? 'Loading experience...' : 'Tap anywhere to continue'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
