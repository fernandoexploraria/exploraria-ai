
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { MapPin, Sparkles, CheckCircle, XCircle, Clock, Target } from "lucide-react";
import { useTourPlanner } from "@/hooks/useTourPlanner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import EnhancedDestinationSelector from "@/components/EnhancedDestinationSelector";

const TourPlannerV2Dialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { generateTour, isLoading, tourPlan, progressState } = useTourPlanner();

  const handleDestinationSelect = async (destination: string, destinationDetails: any) => {
    console.log('🎯 Generating tour for:', destination, 'with details:', destinationDetails);
    await generateTour(destination, destinationDetails);
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'generating': return 'text-blue-600';
      case 'refining': return 'text-purple-600';
      case 'validating': return 'text-orange-600';
      case 'finalizing': return 'text-green-600';
      case 'complete': return 'text-green-700';
      case 'ready': return 'text-green-700';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'complete':
      case 'ready':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Sparkles className="mr-2 h-5 w-5" />
          Plan New Tour
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Target className="h-6 w-6 text-purple-600" />
            AI Tour Planner
          </DialogTitle>
          <DialogDescription>
            Create a personalized tour with enhanced destination context and smart landmark recommendations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!isLoading && !tourPlan && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Choose Your Destination
                </label>
                <EnhancedDestinationSelector
                  onDestinationSelect={handleDestinationSelect}
                  placeholder="Search for cities, attractions, or landmarks..."
                  className="w-full"
                />
              </div>
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-blue-800">Enhanced Features</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Smart destination context analysis</li>
                    <li>• Hierarchical landmark prioritization</li>
                    <li>• High-quality coordinate validation</li>
                    <li>• Personalized recommendations</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          {isLoading && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {getPhaseIcon(progressState.phase)}
                  <span className={`font-medium ${getPhaseColor(progressState.phase)}`}>
                    {progressState.currentStep}
                  </span>
                </div>
                <Progress value={progressState.percentage} className="w-full h-2" />
                <p className="text-sm text-gray-500 mt-2">
                  {progressState.percentage.toFixed(0)}% complete
                </p>
              </div>

              {progressState.totalLandmarks > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Processing Landmarks</span>
                    <span className="text-sm text-gray-600">
                      {progressState.processedLandmarks}/{progressState.totalLandmarks}
                    </span>
                  </div>
                  {progressState.qualityMetrics && (
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        {progressState.qualityMetrics.highConfidence} High Quality
                      </Badge>
                      <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                        {progressState.qualityMetrics.mediumConfidence} Medium Quality
                      </Badge>
                      <Badge variant="outline" className="text-red-700 border-red-300">
                        {progressState.qualityMetrics.lowConfidence} Low Quality
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {progressState.errors.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-800 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Issues Encountered
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="text-sm text-red-700 space-y-1">
                      {progressState.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {tourPlan && (
            <div className="space-y-4">
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-5 w-5" />
                    Tour Generated Successfully!
                  </CardTitle>
                  <CardDescription className="text-green-700">
                    Your personalized tour for <strong>{tourPlan.destination}</strong> is ready with {tourPlan.landmarks.length} landmarks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {tourPlan.destinationDetails && (
                    <div className="mb-4 p-3 bg-white rounded-lg border border-green-200">
                      <h4 className="font-medium text-gray-800 mb-2">Destination Context</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span>{tourPlan.destinationDetails.formattedAddress}</span>
                      </div>
                      {tourPlan.destinationDetails.types && tourPlan.destinationDetails.types.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {tourPlan.destinationDetails.types.slice(0, 3).map((type, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {type.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {tourPlan.metadata && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Quality Breakdown:</span>
                        <div className="mt-1 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-green-600">High Confidence:</span>
                            <span className="font-medium">{tourPlan.metadata.coordinateQuality.highConfidence}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-yellow-600">Medium Confidence:</span>
                            <span className="font-medium">{tourPlan.metadata.coordinateQuality.mediumConfidence}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-red-600">Low Confidence:</span>
                            <span className="font-medium">{tourPlan.metadata.coordinateQuality.lowConfidence}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Processing Stats:</span>
                        <div className="mt-1 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Time:</span>
                            <span className="font-medium">{(tourPlan.metadata.processingTime / 1000).toFixed(1)}s</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Landmarks:</span>
                            <span className="font-medium">{tourPlan.metadata.totalLandmarks}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button onClick={() => setIsOpen(false)} className="flex-1">
                  Explore Tour
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    // Reset for new tour generation
                    window.location.reload();
                  }}
                >
                  Plan Another Tour
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TourPlannerV2Dialog;
