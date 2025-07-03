
import { useState, useEffect } from 'react';

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggle = () => setIsVisible(prev => !prev);
  const toggleGracePeriodDebug = () => setIsGracePeriodDebugVisible(prev => !prev);

  return {
    isVisible,
    toggle,
    isGracePeriodDebugVisible,
    toggleGracePeriodDebug,
  };
};
