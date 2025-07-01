
import React from 'react';

interface CarouselErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface CarouselErrorBoundaryProps {
  children: React.ReactNode;
}

class CarouselErrorBoundary extends React.Component<CarouselErrorBoundaryProps, CarouselErrorBoundaryState> {
  constructor(props: CarouselErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): CarouselErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Carousel error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 text-white">
          <div className="text-center">
            <p className="text-gray-400 mb-2">Something went wrong with the carousel.</p>
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => this.setState({ hasError: false })}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CarouselErrorBoundary;
