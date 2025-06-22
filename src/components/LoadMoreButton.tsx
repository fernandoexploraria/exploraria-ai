
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';

interface LoadMoreButtonProps {
  currentCount: number;
  currentLimit: number;
  isLoading: boolean;
  onLoadMore: () => void;
}

const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  currentCount,
  currentLimit,
  isLoading,
  onLoadMore,
}) => {
  if (currentLimit >= 50 || currentCount < currentLimit) {
    return null;
  }

  const nextLimit = currentLimit === 10 ? 20 : 50;

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <p className="text-sm text-gray-400">
        Showing {currentCount} recent conversations
      </p>
      <Button
        variant="outline"
        onClick={onLoadMore}
        disabled={isLoading}
        className="text-white border-gray-600 hover:bg-gray-800"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            Load More ({nextLimit})
          </>
        )}
      </Button>
    </div>
  );
};

export default LoadMoreButton;
