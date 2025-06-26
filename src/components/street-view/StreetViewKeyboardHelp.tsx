
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: 'navigation' | 'viewpoint' | 'controls' | 'general';
}

interface StreetViewKeyboardHelpProps {
  isMultiViewpoint?: boolean;
  className?: string;
}

const StreetViewKeyboardHelp: React.FC<StreetViewKeyboardHelpProps> = ({
  isMultiViewpoint = false,
  className = ""
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const shortcuts: KeyboardShortcut[] = [
    // Navigation
    { keys: ['←', '→'], description: 'Navigate between landmarks', category: 'navigation' },
    { keys: ['Space'], description: 'Next landmark', category: 'navigation' },
    { keys: ['Shift', 'Space'], description: 'Previous landmark', category: 'navigation' },
    
    // Viewpoint controls (only for multi-viewpoint)
    ...(isMultiViewpoint ? [
      { keys: ['↑', '↓'], description: 'Change viewpoint', category: 'viewpoint' as const },
      { keys: ['Shift', '←', '→'], description: 'Quick viewpoint switch', category: 'viewpoint' as const },
      { keys: ['1-9'], description: 'Jump to viewpoint number', category: 'viewpoint' as const },
    ] : []),
    
    // Controls
    { keys: ['F'], description: 'Toggle fullscreen', category: 'controls' },
    { keys: ['I'], description: 'Toggle information panel', category: 'controls' },
    { keys: ['M'], description: 'Show on map', category: 'controls' },
    { keys: ['R'], description: 'Reset view', category: 'controls' },
    
    // General
    { keys: ['Esc'], description: 'Close Street View', category: 'general' },
    { keys: ['?'], description: 'Show/hide this help', category: 'general' },
  ];

  const categories = {
    navigation: 'Navigation',
    viewpoint: 'Viewpoint',
    controls: 'Controls',
    general: 'General'
  };

  const categoryColors = {
    navigation: 'text-blue-400',
    viewpoint: 'text-green-400',
    controls: 'text-purple-400',
    general: 'text-orange-400'
  };

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsVisible(true)}
        className={cn(
          "h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/20",
          className
        )}
        title="Keyboard shortcuts (Press ? for help)"
      >
        <Keyboard className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className={cn(
      "fixed inset-0 z-[9999] flex items-center justify-center p-4",
      className
    )}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsVisible(false)}
      />
      
      {/* Modal Panel */}
      <div className="relative w-full max-w-md max-h-[80vh] bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700 shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/20"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[60vh] p-4">
          <div className="space-y-4">
            {Object.entries(categories).map(([categoryKey, categoryName]) => {
              const categoryShortcuts = shortcuts.filter(s => s.category === categoryKey);
              if (categoryShortcuts.length === 0) return null;

              return (
                <div key={categoryKey} className="space-y-2">
                  <h4 className={cn(
                    "font-medium text-xs uppercase tracking-wide flex items-center gap-1",
                    categoryColors[categoryKey as keyof typeof categoryColors]
                  )}>
                    <div className="w-0.5 h-3 bg-current rounded-full"></div>
                    {categoryName}
                  </h4>
                  <div className="space-y-1.5">
                    {categoryShortcuts.map((shortcut, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <span className="text-white/90 pr-2 flex-1 text-left">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {shortcut.keys.map((key, keyIndex) => (
                            <React.Fragment key={keyIndex}>
                              <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-800 border border-gray-600 rounded text-white/90 min-w-[1.5rem] text-center">
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="text-white/60 text-xs font-medium">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer tip */}
          <div className="mt-4 pt-3 border-t border-gray-700">
            <p className="text-xs text-white/60 text-center">
              Press <kbd className="px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded">?</kbd> to toggle or click outside to close
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreetViewKeyboardHelp;
