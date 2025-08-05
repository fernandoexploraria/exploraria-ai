import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  MapPin, 
  Play, 
  CheckCircle, 
  Clock, 
  Globe, 
  Search, 
  Zap,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ContentSummary {
  generatedAt: string;
  cityPages: number;
  blogPosts: number;
  totalPages: number;
  cities: string[];
  blogTitles: string[];
}

export const ContentManagement: React.FC = () => {
  const [contentSummary, setContentSummary] = useState<ContentSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreRendering, setIsPreRendering] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadContentSummary();
  }, []);

  const loadContentSummary = async () => {
    try {
      // This would load from the generated summary file
      // For now, we'll use placeholder data
      const summary: ContentSummary = {
        generatedAt: new Date().toISOString(),
        cityPages: 15,
        blogPosts: 5,
        totalPages: 20,
        cities: [
          'Paris', 'London', 'New York', 'Rome', 'Mexico City', 'Sydney',
          'Tokyo', 'Barcelona', 'Amsterdam', 'Berlin', 'Prague', 'Vienna',
          'Budapest', 'Copenhagen', 'Stockholm'
        ],
        blogTitles: [
          'Hidden Gems of Mexico City: Beyond the Tourist Trail',
          'AI-Powered Travel: The Future of City Exploration',
          'How AI Creates Perfect Personalized Itineraries',
          'Sustainable Tourism Through Smart AI Recommendations',
          'Voice-Guided Tours: The Future of Sightseeing'
        ]
      };
      setContentSummary(summary);
    } catch (error) {
      console.error('Failed to load content summary:', error);
    }
  };

  const runContentGeneration = async () => {
    setIsGenerating(true);
    toast({
      title: "Content Generation Started",
      description: "Generating AI-powered content for cities and blog posts...",
    });

    try {
      // In a real implementation, this would call the script
      // For now, we'll simulate the process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast({
        title: "Content Generation Complete",
        description: "Successfully generated 20 pages with AI-powered content.",
      });
      
      loadContentSummary();
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "There was an error generating content. Please check the console.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const runPreRendering = async () => {
    setIsPreRendering(true);
    toast({
      title: "Pre-rendering Started",
      description: "Creating static HTML files for SEO optimization...",
    });

    try {
      // In a real implementation, this would call the script
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Pre-rendering Complete",
        description: "Successfully created static HTML files for all pages.",
      });
    } catch (error) {
      toast({
        title: "Pre-rendering Failed",
        description: "There was an error during pre-rendering. Please check the console.",
        variant: "destructive"
      });
    } finally {
      setIsPreRendering(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Header */}
      <section className="relative bg-gradient-to-r from-primary to-primary-foreground text-white py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold">Content Management System</h1>
            <p className="text-lg text-white/90">
              AI-Powered Content Generation & SEO Optimization
            </p>
          </div>
        </div>
      </section>

      <main className="flex-grow overflow-y-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto space-y-8">

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6 text-center">
                  <Globe className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="text-2xl font-bold">{contentSummary?.cityPages || 0}</h3>
                  <p className="text-muted-foreground">City Pages</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 text-center">
                  <FileText className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="text-2xl font-bold">{contentSummary?.blogPosts || 0}</h3>
                  <p className="text-muted-foreground">Blog Posts</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 text-center">
                  <Search className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="text-2xl font-bold">{contentSummary?.totalPages || 0}</h3>
                  <p className="text-muted-foreground">SEO Pages</p>
                </CardContent>
              </Card>
            </div>

            {/* How It Works */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  How Our AI CMS Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">🤖 AI Content Generation</h4>
                    <p className="text-muted-foreground text-sm">
                      Our system automatically generates high-quality, SEO-optimized content for city pages and blog posts using advanced AI models. Each page is tailored with relevant keywords, meta descriptions, and structured data.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">🔍 SEO Optimization</h4>
                    <p className="text-muted-foreground text-sm">
                      Generated content includes proper meta tags, JSON-LD structured data, canonical URLs, and Open Graph tags. This ensures maximum search engine visibility and social media sharing optimization.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">⚡ Static Pre-rendering</h4>
                    <p className="text-muted-foreground text-sm">
                      After content generation, we create static HTML files that search engines can crawl immediately. This improves page load times and provides fallback content for users without JavaScript.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">📊 Performance Tracking</h4>
                    <p className="text-muted-foreground text-sm">
                      Monitor content performance, track generated pages, and manage the entire content lifecycle from this dashboard. Real-time updates ensure your content strategy stays effective.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Content Generation Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Content Generation Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-primary/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                        Generate Content
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Creates AI-powered content for 15 priority cities and multiple blog posts with proper SEO metadata and structured data.
                      </p>
                      <Button 
                        onClick={runContentGeneration} 
                        disabled={isGenerating}
                        className="w-full"
                      >
                        {isGenerating ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Generating Content...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Run Content Generation
                          </>
                        )}
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        <code>node scripts/generate-content.js</code>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-secondary/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="bg-secondary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                        Pre-render for SEO
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Creates static HTML files with meta tags and structured data for search engine optimization and faster page loads.
                      </p>
                      <Button 
                        onClick={runPreRendering} 
                        disabled={isPreRendering}
                        variant="secondary"
                        className="w-full"
                      >
                        {isPreRendering ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Pre-rendering...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Run Pre-rendering
                          </>
                        )}
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        <code>node scripts/pre-render.js</code>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Generated Content Index */}
            {contentSummary && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* City Pages */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Generated City Pages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                      {contentSummary.cities.map((city, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-primary" />
                            <span className="font-medium">{city}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              /explore/{city.toLowerCase().replace(/\s+/g, '-')}
                            </Badge>
                            <Button size="sm" variant="ghost" asChild>
                              <a href={`/explore/${city.toLowerCase().replace(/\s+/g, '-')}`}>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Blog Posts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Generated Blog Posts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                      {contentSummary.blogTitles.map((title, index) => (
                        <div key={index} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-start gap-2">
                              <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span className="font-medium text-sm leading-relaxed">{title}</span>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`/blog/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Status */}
            {contentSummary && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      Last generated: {new Date(contentSummary.generatedAt).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};