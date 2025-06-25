
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SkeletonLoaderProps {
  variant?: 'card' | 'thumbnail' | 'text' | 'avatar' | 'streetview' | 'carousel';
  count?: number;
  className?: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'card',
  count = 1,
  className = ''
}) => {
  const renderSkeleton = () => {
    switch (variant) {
      case 'card':
        return (
          <div className="w-full max-w-xs mx-auto border border-gray-700 h-96 rounded-lg p-3 bg-gray-900">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="h-32 w-full mb-3 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="mt-4 flex justify-between">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        );
        
      case 'thumbnail':
        return (
          <div className="flex-shrink-0">
            <Skeleton className="h-16 w-24 rounded-lg" />
          </div>
        );
        
      case 'streetview':
        return (
          <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Skeleton className="h-8 w-32 mx-auto mb-4" />
              <Skeleton className="h-4 w-48 mx-auto mb-2" />
              <Skeleton className="h-4 w-36 mx-auto" />
            </div>
          </div>
        );
        
      case 'carousel':
        return (
          <div className="flex gap-4 justify-center">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-full max-w-xs">
                <SkeletonLoader variant="card" />
              </div>
            ))}
          </div>
        );
        
      case 'text':
        return (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        );
        
      case 'avatar':
        return <Skeleton className="h-10 w-10 rounded-full" />;
        
      default:
        return <Skeleton className="h-4 w-full" />;
    }
  };

  return (
    <div className={cn('animate-pulse', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={count > 1 ? 'mb-4' : ''}>
          {renderSkeleton()}
        </div>
      ))}
    </div>
  );
};

export default SkeletonLoader;
