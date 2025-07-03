
import { useState, useEffect } from 'react';

export const useDebugWindow = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle debug window with Ctrl+D
      if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggle = () => setIsVisible(prev => !prev);

  return {
    isVisible,
    toggle,
  };
};
