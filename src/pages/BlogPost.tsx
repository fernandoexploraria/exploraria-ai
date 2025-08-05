import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Share2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import ShareButton from '@/components/ShareButton';

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  publishDate: string;
  readTime: string;
  tags: string[];
  featuredImage?: string;
  metaDescription: string;
  metaKeywords: string[];
  schema: any;
  cityContext?: {
    name: string;
    slug: string;
  };
}

export const BlogPost: React.FC = () => {
  const { blogSlug } = useParams<{ blogSlug: string }>();
  const [blogPost, setBlogPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!blogSlug) return;
    loadBlogPost();
  }, [blogSlug]);

  const loadBlogPost = async () => {
    try {
      setIsLoading(true);
      
      // For now, create placeholder content
      // In production, this would load from pre-generated static files
      const placeholderPost: BlogPost = {
        slug: blogSlug || '',
        title: "AI-Powered Travel: The Future of City Exploration",
        excerpt: "Discover how artificial intelligence is revolutionizing the way we explore cities and create personalized travel experiences.",
        content: `
          <h2>The Revolution of AI in Travel</h2>
          <p>Artificial intelligence is transforming the travel industry in unprecedented ways. From personalized recommendations to real-time itinerary optimization, AI is making travel more efficient, enjoyable, and accessible than ever before.</p>
          
          <h3>Personalized Experiences</h3>
          <p>Gone are the days of one-size-fits-all travel guides. AI algorithms can now analyze your preferences, past travel behavior, and real-time factors to create perfectly tailored experiences that match your unique interests and style.</p>
          
          <h3>Real-Time Intelligence</h3>
          <p>Modern AI travel assistants can process vast amounts of real-time data including weather conditions, crowd levels, local events, and transportation schedules to optimize your itinerary on the fly.</p>
          
          <h3>The Future is Here</h3>
          <p>With advances in natural language processing and machine learning, AI travel companions are becoming more conversational, intuitive, and helpful than ever before. The future of travel is not just digital—it's intelligent.</p>
        `,
        author: "Exploraria Team",
        publishDate: new Date().toISOString().split('T')[0],
        readTime: "5 min read",
        tags: ["AI Travel", "Technology", "Future of Tourism", "Smart Travel"],
        metaDescription: "Explore how AI is revolutionizing travel with personalized experiences and real-time intelligence. Discover the future of smart travel technology.",
        metaKeywords: ["AI travel", "smart travel", "travel technology", "personalized travel", "AI tourism"],
        schema: {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": "AI-Powered Travel: The Future of City Exploration",
          "description": "Discover how artificial intelligence is revolutionizing travel",
          "author": {
            "@type": "Organization",
            "name": "Exploraria"
          },
          "datePublished": new Date().toISOString(),
          "dateModified": new Date().toISOString()
        }
      };

      // Special handling for Mexico City post
      if (blogSlug === 'hidden-gems-mexico-city') {
        placeholderPost.title = "Hidden Gems of Mexico City: Beyond the Tourist Trail";
        placeholderPost.excerpt = "Discover Mexico City's best-kept secrets and authentic local experiences with our AI-powered guide to hidden gems.";
        placeholderPost.content = `
          <h2>Mexico City's Hidden Treasures</h2>
          <p>Mexico City is a treasure trove of hidden gems waiting to be discovered. Beyond the well-known attractions lie authentic neighborhoods, secret food spots, and cultural experiences that reveal the true soul of this magnificent city.</p>
          
          <h3>Neighborhood Gems</h3>
          <p>Explore the cobblestone streets of Coyoacán, where Frida Kahlo once lived, or wander through the artistic haven of Roma Norte. These neighborhoods offer a glimpse into authentic Mexican culture away from the tourist crowds.</p>
          
          <h3>Culinary Secrets</h3>
          <p>From hidden mezcalerías to family-run taquerías that have been serving the same recipes for generations, Mexico City's food scene extends far beyond the obvious. Let our AI guide you to the spots locals actually frequent.</p>
          
          <h3>Cultural Discoveries</h3>
          <p>Discover underground art galleries, secret rooftop bars with stunning city views, and traditional markets where you can experience the authentic rhythm of daily Mexican life.</p>
        `;
        placeholderPost.tags = ["Mexico City", "Hidden Gems", "Local Culture", "Authentic Travel"];
        placeholderPost.cityContext = {
          name: "Mexico City",
          slug: "mexico-city"
        };
      }

      setBlogPost(placeholderPost);
    } catch (err) {
      setError('Failed to load blog post');
      console.error('Error loading blog post:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (blogPost) {
      document.title = `${blogPost.title} | Exploraria Blog`;
      
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', blogPost.metaDescription);
      }
    }
  }, [blogPost]);

  if (!blogSlug) {
    return <Navigate to="/blog" replace />;
  }

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !blogPost) {
    return (
      <div className="bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-destructive mb-4">Blog Post Not Found</h1>
            <p className="text-muted-foreground">The blog post you're looking for doesn't exist.</p>
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPost.schema) }}
      />

      <div className="absolute inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-primary/5 to-secondary/5">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-r from-primary to-primary-foreground text-white py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex flex-wrap gap-2 mb-4">
                {blogPost.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="bg-white/20 text-white">
                    {tag}
                  </Badge>
                ))}
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold">{blogPost.title}</h1>
              
              <p className="text-xl text-white/90 max-w-3xl">
                {blogPost.excerpt}
              </p>
              
              <div className="flex items-center gap-6 text-white/80">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{blogPost.author}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(blogPost.publishDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{blogPost.readTime}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <main className="flex-grow overflow-y-auto">
        {/* Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <Card className="mb-8">
              <CardContent className="p-8">
                <div 
                  className="prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ __html: blogPost.content }}
                />
              </CardContent>
            </Card>

            {/* City Context CTA */}
            {blogPost.cityContext && (
              <Card className="mb-8 bg-gradient-to-r from-primary/10 to-secondary/10">
                <CardContent className="p-8 text-center">
                  <h3 className="text-2xl font-bold mb-4">
                    Ready to Explore {blogPost.cityContext.name}?
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Let our AI create a personalized tour featuring these hidden gems and more.
                  </p>
                  <Button size="lg" asChild>
                    <a href={`/explore/${blogPost.cityContext.slug}`}>
                      Generate Your {blogPost.cityContext.name} Tour
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Share Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Share This Post
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: blogPost.title,
                        text: blogPost.excerpt,
                        url: window.location.href
                      });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      alert('Link copied to clipboard!');
                    }
                  }}>
                    Share Article
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </main>
      </div>
    </>
  );
};