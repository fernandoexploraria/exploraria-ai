import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlogPreview {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishDate: string;
  readTime: string;
  tags: string[];
  featuredImage?: string;
}

const FEATURED_POSTS: BlogPreview[] = [
  {
    slug: 'hidden-gems-mexico-city',
    title: 'Hidden Gems of Mexico City: Beyond the Tourist Trail',
    excerpt: 'Discover Mexico City\'s best-kept secrets and authentic local experiences with our AI-powered guide to hidden gems.',
    author: 'Exploraria Team',
    publishDate: new Date().toISOString().split('T')[0],
    readTime: '6 min read',
    tags: ['Mexico City', 'Hidden Gems', 'Local Culture']
  },
  {
    slug: 'ai-powered-travel-future',
    title: 'AI-Powered Travel: The Future of City Exploration',
    excerpt: 'Discover how artificial intelligence is revolutionizing the way we explore cities and create personalized travel experiences.',
    author: 'Exploraria Team',
    publishDate: new Date().toISOString().split('T')[0],
    readTime: '5 min read',
    tags: ['AI Travel', 'Technology', 'Future of Tourism']
  },
  {
    slug: 'personalized-itineraries-ai',
    title: 'How AI Creates Perfect Personalized Itineraries',
    excerpt: 'Learn how modern AI algorithms analyze your preferences to create travel experiences perfectly tailored to your interests.',
    author: 'Exploraria Team',
    publishDate: new Date().toISOString().split('T')[0],
    readTime: '4 min read',
    tags: ['Personalization', 'AI', 'Travel Planning']
  },
  {
    slug: 'sustainable-tourism-ai',
    title: 'Sustainable Tourism Through Smart AI Recommendations',
    excerpt: 'Explore how AI can help travelers make more sustainable choices while discovering amazing destinations.',
    author: 'Exploraria Team',
    publishDate: new Date().toISOString().split('T')[0],
    readTime: '7 min read',
    tags: ['Sustainability', 'Responsible Travel', 'AI']
  }
];

export const BlogListing: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-primary to-primary-foreground text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold">Exploraria Blog</h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto">
              Insights, tips, and stories about AI-powered travel and city exploration
            </p>
          </div>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Latest Posts</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURED_POSTS.map((post) => (
              <Card key={post.slug} className="hover:shadow-lg transition-shadow h-full flex flex-col">
                <CardHeader>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {post.tags.slice(0, 2).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(post.publishDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{post.readTime}</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-muted-foreground mb-6 line-clamp-3 flex-1">
                    {post.excerpt}
                  </p>
                  
                  <Button variant="outline" asChild className="w-full">
                    <a href={`/blog/${post.slug}`} className="flex items-center justify-center gap-2">
                      Read More
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
      </div>
      
      {/* Newsletter CTA */}
      <section className="bg-gradient-to-r from-primary/10 to-secondary/10 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-bold">Stay Updated</h2>
            <p className="text-muted-foreground">
              Get the latest insights about AI-powered travel and exclusive city exploration tips delivered to your inbox.
            </p>
            <Button size="lg">
              Subscribe to Newsletter
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};