import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageNavigation } from '@/components/PageNavigation';
import { getPhase1Cities } from '@/utils/cityExtraction';

// City descriptions helper function
const getDescriptionForCity = (cityName: string): string => {
  const descriptions: Record<string, string> = {
    'Paris': 'The City of Light with iconic landmarks and romantic charm',
    'London': 'Historic capital blending tradition with modern culture',
    'New York': 'The bustling metropolis that never sleeps',
    'Rome': 'Ancient history meets modern Italian culture',
    'Mexico City': 'Vibrant culture, art, and incredible cuisine',
    'Barcelona': 'Mediterranean charm with unique architecture',
    'Berlin': 'Historic city with vibrant arts scene',
    'Toronto': 'Cosmopolitan city with diverse neighborhoods and culture'
  };
  return descriptions[cityName] || 'Amazing destination with unique attractions';
};

export const Destinations: React.FC = () => {
  // Get verified working cities
  const availableCities = getPhase1Cities().map(city => ({
    name: city.name,
    slug: city.slug,
    landmarks: city.landmarkCount,
    description: getDescriptionForCity(city.name)
  }));

  React.useEffect(() => {
    document.title = 'Explore Cities - AI Travel Guide | Exploraria';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        `Discover amazing cities with AI-powered travel guides. Explore ${availableCities.length} verified destinations with personalized tours and local insights.`
      );
    }
  }, [availableCities.length]);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Navigation */}
      <PageNavigation
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Explore Cities' }
        ]}
        backLink={{
          href: '/',
          label: 'Back to Home'
        }}
      />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-primary to-primary-foreground text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold">Explore Cities with AI</h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
              Discover {availableCities.length} amazing destinations with personalized AI-powered travel guides
            </p>
          </div>
        </div>
      </section>

      <main className="flex-grow overflow-y-auto">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            
            {/* Cities Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {availableCities.map((city) => (
                <Card key={city.slug} className="hover:shadow-lg transition-shadow h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      {city.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {city.landmarks} landmarks
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        AI-Powered
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-muted-foreground mb-6 line-clamp-3 flex-1">
                      {city.description}
                    </p>
                    
                    <Button asChild className="w-full">
                      <Link to={`/explore/${city.slug}`}>
                        Explore {city.name}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Call to Action */}
            <section className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-8 text-center mt-16">
              <h2 className="text-2xl font-bold mb-4">Ready to Start Exploring?</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Each destination features AI-powered tours with personalized recommendations, 
                local insights, and real-time guidance for the perfect travel experience.
              </p>
              <Button size="lg" asChild>
                <Link to="/blog">
                  Read Our Travel Insights
                </Link>
              </Button>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
};