import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getCityBySlug } from '@/utils/cityExtraction';
import { CityTourCTA } from '@/components/static/CityTourCTA';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Info, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PageNavigation } from '@/components/PageNavigation';
import { useAuth } from '@/components/AuthProvider';
import DialogManager from '@/components/DialogManager';
import { useDialogStates } from '@/hooks/useDialogStates';
import { performComprehensiveTourReset } from '@/utils/tourResetUtils';
import { Landmark } from '@/data/landmarks';

interface CityContent {
  seoTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  heroTitle: string;
  heroDescription: string;
  cityDescription: string;
  landmarkHighlights: Record<string, string>;
  travelTips: string[];
  bestTimeToVisit: string;
  transportation: string;
  schema: any;
  generatedAt: string;
}

export const CityExplore: React.FC = () => {
  const { citySlug } = useParams<{ citySlug: string }>();
  const [cityData, setCityData] = useState(getCityBySlug(citySlug || ''));
  const [cityContent, setCityContent] = useState<CityContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Auth and dialog state management (same as Index.tsx)
  const { user } = useAuth();
  const {
    selectedLandmark,
    setSelectedLandmark,
    isInteractionHistoryOpen,
    setIsInteractionHistoryOpen,
    isAuthDialogOpen,
    setIsAuthDialogOpen,
    isNewTourAssistantOpen,
    setIsNewTourAssistantOpen,
    isIntelligentTourOpen,
    setIsIntelligentTourOpen,
    resetAllDialogStates,
  } = useDialogStates();

  // Handler functions (same as Index.tsx)
  const handleAuthRequired = () => {
    setIsAuthDialogOpen(true);
  };

  const handleIntelligentTourOpen = (landmark?: any) => {
    console.log('🎯 Opening Intelligent Tour dialog from city page');
    
    // If a landmark is provided, store it for the dialog
    if (landmark) {
      (window as any).pendingLandmarkDestination = landmark;
    }
    
    // Perform comprehensive reset before opening dialog
    performComprehensiveTourReset(
      {
        setIsIntelligentTourOpen,
        setIsNewTourAssistantOpen,
        setIsInteractionHistoryOpen,
        setSelectedLandmark,
      },
      {
        setSmartTourLandmarks: () => {}, // No-op for city page
        setVoiceTourData: () => {}, // No-op for city page
      }
    );
    
    // Open the dialog after reset
    setIsIntelligentTourOpen(true);
  };

  const handleTourGenerated = (landmarks: Landmark[]) => {
    console.log('🎯 Tour generated from city page, redirecting to main app with landmarks:', landmarks.length);
    
    // Redirect to main app with the generated tour
    window.location.href = '/';
  };

  useEffect(() => {
    if (!cityData) return;

    // Update page meta tags
    document.title = `Explore ${cityData.name} - AI Travel Guide | Exploraria`;
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        `Discover ${cityData.name} with AI-powered tours and personalized recommendations. Explore ${cityData.landmarks.length} landmarks and unique experiences.`
      );
    }

    // Load city content (this would normally come from pre-generated static files)
    loadCityContent();
  }, [cityData]);

  const loadCityContent = async () => {
    if (!cityData) return;

    try {
      setIsLoading(true);
      
      // For now, create placeholder content
      // In production, this would load from pre-generated static files
      const placeholderContent: CityContent = {
        seoTitle: `Explore ${cityData.name} - AI Travel Guide | Exploraria`,
        metaDescription: `Discover ${cityData.name} with AI-powered tours and personalized recommendations. Explore landmarks and unique experiences.`,
        metaKeywords: [`${cityData.name} travel`, `${cityData.name} tours`, 'AI travel guide'],
        heroTitle: `Discover ${cityData.name} with AI`,
        heroDescription: `Experience ${cityData.name} like never before with AI-powered tours featuring ${cityData.landmarks.length} incredible landmarks.`,
        cityDescription: `${cityData.name} offers an amazing blend of culture, history, and modern attractions. Our AI-powered travel guide helps you discover the best experiences, from world-famous landmarks to hidden local gems. Whether you're interested in ${cityData.landmarks.map(l => l.name.split(',')[0]).join(', ')}, our personalized tours will create the perfect itinerary for your interests.`,
        landmarkHighlights: cityData.landmarks.reduce((acc, landmark) => {
          acc[landmark.name] = landmark.description;
          return acc;
        }, {} as Record<string, string>),
        travelTips: [
          `Visit ${cityData.name}'s top landmarks early in the morning to avoid crowds`,
          'Use our AI tour generator to create personalized itineraries',
          'Try local cuisine recommendations from our AI guide',
          'Book tours in advance for popular attractions'
        ],
        bestTimeToVisit: 'Year-round destination with unique seasonal highlights',
        transportation: 'Multiple transportation options available including public transit, walking tours, and ride-sharing',
        schema: {
          "@context": "https://schema.org",
          "@type": "Place",
          "name": cityData.name,
          "description": `Travel guide for ${cityData.name}`,
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": cityData.coordinates[1],
            "longitude": cityData.coordinates[0]
          }
        },
        generatedAt: new Date().toISOString()
      };

      setCityContent(placeholderContent);
    } catch (err) {
      setError('Failed to load city content');
      console.error('Error loading city content:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!cityData) {
    return <Navigate to="/404" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !cityContent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-destructive mb-4">Content Not Available</h1>
            <p className="text-muted-foreground">We're working on generating content for {cityData.name}.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cityContent.schema) }}
      />

      <div className="absolute inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-primary/5 to-secondary/5">
        {/* Navigation */}
        <PageNavigation
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Explore Cities', href: '/destinations' },
            { label: cityData.name }
          ]}
          backLink={{
            href: '/destinations',
            label: 'Back to Cities'
          }}
        />

        {/* Hero Section */}
        <section className="relative bg-gradient-to-r from-primary to-primary-foreground text-white py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold">{cityContent.heroTitle}</h1>
              <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
                {cityContent.heroDescription}
              </p>
              <div className="pt-4">
                <CityTourCTA 
                  cityData={cityData}
                  variant="secondary"
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90"
                  onIntelligentTourOpen={handleIntelligentTourOpen}
                  onAuthDialogOpen={handleAuthRequired}
                />
              </div>
            </div>
          </div>
        </section>

        <main className="flex-grow overflow-y-auto">
        {/* Main Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto space-y-12">
            
            {/* City Overview */}
            <section>
              <h2 className="text-3xl font-bold mb-6">About {cityData.name}</h2>
              <div className="prose prose-lg max-w-none">
                <p className="text-lg leading-relaxed text-muted-foreground">
                  {cityContent.cityDescription}
                </p>
              </div>
            </section>

            {/* Featured Landmarks */}
            <section>
              <h2 className="text-3xl font-bold mb-6">Featured Landmarks</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {cityData.landmarks.map((landmark, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-start gap-2">
                        <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                        <span>{landmark.name}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">{landmark.description}</p>
                      {landmark.place_id && (
                        <Badge variant="outline" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Featured Attraction
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Travel Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Travel Tips */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Travel Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {cityContent.travelTips.map((tip, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Best Time to Visit */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    When to Visit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {cityContent.bestTimeToVisit}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Transportation:</strong> {cityContent.transportation}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Call to Action Section */}
            <section className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Ready to Explore {cityData.name}?</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Let our AI create a personalized tour that matches your interests and schedule. 
                Discover the best of {cityData.name} with expert recommendations and real-time guidance.
              </p>
              <CityTourCTA 
                cityData={cityData}
                size="lg"
                buttonText={`Start Your ${cityData.name} Adventure!`}
                onIntelligentTourOpen={handleIntelligentTourOpen}
                onAuthDialogOpen={handleAuthRequired}
              />
            </section>

          </div>
        </div>
        </main>
      </div>

      {/* Dialog Manager - handles auth and tour dialogs */}
      <DialogManager
        isVoiceSearchOpen={isInteractionHistoryOpen}
        onVoiceSearchOpenChange={setIsInteractionHistoryOpen}
        isAuthDialogOpen={isAuthDialogOpen}
        onAuthDialogOpenChange={setIsAuthDialogOpen}
        onLocationSelect={() => {}} // No-op for city page
        isIntelligentTourOpen={isIntelligentTourOpen}
        onIntelligentTourOpenChange={setIsIntelligentTourOpen}
        onTourGenerated={handleTourGenerated}
        onAuthRequired={handleAuthRequired}
      />
    </>
  );
};