
import { useState, useEffect } from 'react';
import { gracePeriodDebugMetrics } from '@/utils/gracePeriodDebugMetrics';
import { gracePeriodTimerManager } from '@/utils/gracePeriodTimerManager';
import { gracePeriodStorage } from '@/utils/gracePeriodStorage';
import { gracePeriodDebouncer } from '@/utils/gracePeriodDebouncer';

export const useDebugWindow = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isGracePeriodDebugVisible, setIsGracePeriodDebugVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle debug window with Ctrl+D
      if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        setIsVisible(prev => !prev);
      }
      
      // Toggle grace period debug with Ctrl+G
      if (event.ctrlKey && event.key === 'g') {
        event.preventDefault();
        setIsGracePeriodDebugVisible(prev => !prev);
      }

      // Performance optimization debug commands
      if (event.ctrlKey && event.shiftKey) {
        switch (event.key) {
          case 'P': // Ctrl+Shift+P - Performance report
            event.preventDefault();
            console.log('🔧 [Debug] Performance Report:', gracePeriodDebugMetrics.getPerformanceMetrics());
            break;
            
          case 'C': // Ctrl+Shift+C - Clear all performance caches
            event.preventDefault();
            console.log('🧹 [Debug] Clearing performance caches...');
            gracePeriodStorage.clearCache();
            gracePeriodDebouncer.clearPendingOperations();
            console.log('✅ [Debug] Performance caches cleared');
            break;
            
          case 'T': // Ctrl+Shift+T - Timer report
            event.preventDefault();
            console.log('⏰ [Debug] Timer Report:', {
              metrics: gracePeriodTimerManager.getMetrics(),
              activeTimers: gracePeriodTimerManager.getActiveTimers(),
            });
            break;
            
          case 'F': // Ctrl+Shift+F - Force flush all pending operations
            event.preventDefault();
            console.log('🚀 [Debug] Force flushing all pending operations...');
            gracePeriodStorage.forceFlush();
            // Note: gracePeriodDebouncer.forceFlushAll() would need an update function
            console.log('✅ [Debug] Force flush completed');
            break;
            
          case 'H': // Ctrl+Shift+H - Comprehensive health report
            event.preventDefault();
            console.log('🏥 [Debug] Comprehensive Health Report:', gracePeriodDebugMetrics.getComprehensiveHealthReport());
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggle = () => setIsVisible(prev => !prev);
  const toggleGracePeriodDebug = () => setIsGracePeriodDebugVisible(prev => !prev);

  // Expose performance debugging methods to window for console access
  useEffect(() => {
    (window as any).gracePeriodPerformanceDebug = {
      getMetrics: () => gracePeriodDebugMetrics.getPerformanceMetrics(),
      getHealthReport: () => gracePeriodDebugMetrics.getComprehensiveHealthReport(),
      clearCaches: () => {
        gracePeriodStorage.clearCache();
        gracePeriodDebouncer.clearPendingOperations();
        console.log('✅ All performance caches cleared');
      },
      forceFlush: () => {
        gracePeriodStorage.forceFlush();
        console.log('✅ Storage operations flushed');
      },
      getTimerReport: () => ({
        metrics: gracePeriodTimerManager.getMetrics(),
        activeTimers: gracePeriodTimerManager.getActiveTimers(),
      }),
      runPerformanceTest: () => gracePeriodDebugMetrics.runAllTests(),
    };

    return () => {
      delete (window as any).gracePeriodPerformanceDebug;
    };
  }, []);

  return {
    isVisible,
    toggle,
    isGracePeriodDebugVisible,
    toggleGracePeriodDebug,
  };
};
