
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
    navigation: 'Landmark Navigation',
    viewpoint: 'Viewpoint Controls',
    controls: 'View Controls',
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
      "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4",
      className
    )}>
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-8 w-full max-w-2xl sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Keyboard className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Shortcuts grid layout for wider dialog */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {Object.entries(categories).map(([categoryKey, categoryName]) => {
            const categoryShortcuts = shortcuts.filter(s => s.category === categoryKey);
            if (categoryShortcuts.length === 0) return null;

            return (
              <div key={categoryKey}>
                <h3 className={cn(
                  "font-semibold mb-4 text-base uppercase tracking-wide flex items-center gap-2",
                  categoryColors[categoryKey as keyof typeof categoryColors]
                )}>
                  <div className="w-1 h-6 bg-current rounded-full"></div>
                  {categoryName}
                </h3>
                <div className="space-y-3">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="text-white/90 text-sm pr-4">{shortcut.description}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            <kbd className="px-3 py-1.5 text-sm font-mono bg-gray-800 border border-gray-600 rounded text-white/90 min-w-[2rem] text-center">
                              {key}
                            </kbd>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-white/60 text-sm mx-1">+</span>
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

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <div className="text-center">
            <p className="text-sm text-white/70 mb-2">
              Pro Tip: Most shortcuts work in combination for faster navigation
            </p>
            <p className="text-xs text-white/50">
              Press <kbd className="px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded">?</kbd> anytime to toggle this help
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreetViewKeyboardHelp;
