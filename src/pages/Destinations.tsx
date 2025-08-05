import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

// This would typically import from your city data
const AVAILABLE_CITIES = [
  { name: 'Paris', slug: 'paris', landmarks: 8, description: 'The City of Light with iconic landmarks and romantic charm' },
  { name: 'London', slug: 'london', landmarks: 6, description: 'Historic capital blending tradition with modern culture' },
  { name: 'New York', slug: 'new-york', landmarks: 7, description: 'The bustling metropolis that never sleeps' },
  { name: 'Rome', slug: 'rome', landmarks: 5, description: 'Ancient history meets modern Italian culture' },
  { name: 'Mexico City', slug: 'mexico-city', landmarks: 4, description: 'Vibrant culture, art, and incredible cuisine' },
  { name: 'Sydney', slug: 'sydney', landmarks: 4, description: 'Harbor city with stunning natural beauty' },
  { name: 'Tokyo', slug: 'tokyo', landmarks: 6, description: 'Futuristic metropolis with traditional roots' },
  { name: 'Barcelona', slug: 'barcelona', landmarks: 5, description: 'Mediterranean charm with unique architecture' },
  { name: 'Amsterdam', slug: 'amsterdam', landmarks: 4, description: 'Canals, culture, and charming neighborhoods' },
  { name: 'Berlin', slug: 'berlin', landmarks: 5, description: 'Historic city with vibrant arts scene' },
  { name: 'Prague', slug: 'prague', landmarks: 4, description: 'Fairy-tale architecture and rich history' },
  { name: 'Vienna', slug: 'vienna', landmarks: 4, description: 'Imperial elegance and classical music heritage' },
  { name: 'Budapest', slug: 'budapest', landmarks: 4, description: 'Thermal baths and stunning Danube views' },
  { name: 'Copenhagen', slug: 'copenhagen', landmarks: 3, description: 'Scandinavian design and sustainable living' },
  { name: 'Stockholm', slug: 'stockholm', landmarks: 3, description: 'Nordic beauty across 14 islands' }
];

export const Destinations: React.FC = () => {
  React.useEffect(() => {
    document.title = 'Explore Cities - AI Travel Guide | Exploraria';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'Discover amazing cities with AI-powered travel guides. Explore 15 destinations with personalized tours and local insights.'
      );
    }
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-primary to-primary-foreground text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold">Explore Cities with AI</h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
              Discover 15 amazing destinations with personalized AI-powered travel guides
            </p>
          </div>
        </div>
      </section>

      <main className="flex-grow overflow-y-auto">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            
            {/* Cities Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {AVAILABLE_CITIES.map((city) => (
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
                      <a href={`/explore/${city.slug}`}>
                        Explore {city.name}
                      </a>
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
                <a href="/blog">
                  Read Our Travel Insights
                </a>
              </Button>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
};