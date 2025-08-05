import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BlogContentRequest {
  blogType: 'city-specific' | 'educational' | 'product-feature';
  topic: string;
  targetKeywords: string[];
  featuredCity?: string;
  cityLandmarks?: Array<{
    name: string;
    description: string;
  }>;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-BLOG-CONTENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Blog content generation started");

    const { blogType, topic, targetKeywords, featuredCity, cityLandmarks }: BlogContentRequest = await req.json();
    
    if (!blogType || !topic || !targetKeywords) {
      throw new Error("Missing required fields: blogType, topic, targetKeywords");
    }

    logStep("Processing blog post", { blogType, topic, featuredCity });

    // Create Supabase client for Gemini API
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Generate blog content based on type
    let blogPrompt = '';
    let ctaText = '';
    let ctaDestination = '';

    switch (blogType) {
      case 'city-specific':
        ctaText = `Generate Your ${featuredCity} Tour Now!`;
        ctaDestination = featuredCity || '';
        blogPrompt = `Create a comprehensive, SEO-optimized blog post about ${topic}.

CONTEXT:
- Featured city: ${featuredCity}
- Landmarks to highlight: ${cityLandmarks?.map(l => l.name).join(', ') || 'Various attractions'}
- Target keywords: ${targetKeywords.join(', ')}
- Focus: Hidden gems, local insights, and unique experiences

CONTENT REQUIREMENTS:
1. Engaging title (SEO-optimized, 50-60 characters)
2. Meta description (150-160 characters)
3. Introduction (150-200 words)
4. Main content sections (1,500+ words total):
   - Featured landmarks and hidden gems
   - Local cultural insights
   - Best neighborhoods to explore
   - Food and dining recommendations
   - Transportation tips
   - Best time to visit
5. Call-to-action sections for AI tour generation
6. Conclusion with tour generation prompt

TONE: Informative, engaging, and inspiring. Write as a knowledgeable local expert.
PURPOSE: Drive organic traffic and convert readers to try AI tour generation.`;
        break;

      case 'educational':
        ctaText = 'Try Our AI Tour Generator';
        blogPrompt = `Create an educational, SEO-optimized blog post about ${topic}.

CONTEXT:
- Topic: ${topic}
- Target keywords: ${targetKeywords.join(', ')}
- Focus: How AI revolutionizes travel planning and tour experiences

CONTENT REQUIREMENTS:
1. SEO-optimized title (50-60 characters)
2. Meta description (150-160 characters)
3. Introduction explaining the topic (150-200 words)
4. Main educational content (1,200+ words):
   - How AI technology works in travel
   - Benefits over traditional planning methods
   - Real-world examples and use cases
   - Practical tips for travelers
   - Future of AI in travel
5. Interactive elements and feature explanations
6. Call-to-action for trying AI features

TONE: Expert, helpful, and accessible. Explain complex concepts simply.
PURPOSE: Educate users about AI travel benefits and encourage trial.`;
        break;

      case 'product-feature':
        ctaText = 'Experience AI Travel Planning';
        blogPrompt = `Create a product-focused, SEO-optimized blog post about ${topic}.

CONTEXT:
- Feature focus: ${topic}
- Target keywords: ${targetKeywords.join(', ')}
- Platform: Exploraria AI travel platform

CONTENT REQUIREMENTS:
1. SEO-optimized title highlighting the feature
2. Meta description emphasizing benefits
3. Introduction to the feature (150-200 words)
4. Detailed feature explanation (1,000+ words):
   - How the feature works
   - Benefits and advantages
   - User scenarios and examples
   - Comparison with alternatives
   - Tips for best results
5. Feature demonstration sections
6. Strong call-to-action for trying the feature

TONE: Confident, helpful, and persuasive. Showcase unique value.
PURPOSE: Highlight platform capabilities and drive feature adoption.`;
        break;
    }

    blogPrompt += `

FORMAT: Return as JSON with the following structure:
{
  "title": "SEO-optimized blog post title",
  "slug": "url-friendly-slug",
  "metaDescription": "Meta description here",
  "metaKeywords": ["keyword1", "keyword2", ...],
  "introduction": "Introduction paragraph",
  "mainContent": "Main blog content in HTML format with proper headings",
  "ctaSections": [
    {
      "position": "mid-content",
      "text": "CTA text here",
      "buttonText": "${ctaText}"
    }
  ],
  "conclusion": "Conclusion paragraph with final CTA",
  "readingTime": "Estimated reading time",
  "category": "${blogType}"
}`;

    logStep("Calling Gemini API for blog content");

    const { data: geminiResponse, error: geminiError } = await supabaseClient.functions.invoke('gemini-chat', {
      body: {
        prompt: blogPrompt,
        systemInstruction: "You are a travel content expert and SEO specialist. Create engaging, informative blog posts that educate readers and encourage them to try AI travel features. Use proper HTML formatting for the main content."
      }
    });

    if (geminiError) {
      throw new Error(`Gemini API error: ${geminiError.message}`);
    }

    logStep("Gemini blog content generated successfully");

    let blogContent;
    try {
      // Try to parse the JSON response
      const jsonMatch = geminiResponse.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        blogContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      logStep("JSON parsing failed, using fallback structure");
      
      // Fallback structure if JSON parsing fails
      const slug = topic.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      blogContent = {
        title: topic,
        slug,
        metaDescription: `Learn about ${topic} and how AI is transforming travel planning.`,
        metaKeywords: targetKeywords,
        introduction: `Discover how ${topic} is changing the way we travel.`,
        mainContent: geminiResponse.response,
        ctaSections: [
          {
            position: "mid-content", 
            text: "Ready to experience this yourself?",
            buttonText: ctaText
          }
        ],
        conclusion: "Start your AI-powered travel journey today.",
        readingTime: "5 min read",
        category: blogType
      };
    }

    // Generate JSON-LD schema for blog post
    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": blogContent.title,
      "description": blogContent.metaDescription,
      "author": {
        "@type": "Organization",
        "name": "Exploraria AI"
      },
      "publisher": {
        "@type": "Organization", 
        "name": "Exploraria AI"
      },
      "datePublished": new Date().toISOString(),
      "dateModified": new Date().toISOString(),
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://lovable.exploraria.ai/blog/${blogContent.slug}`
      }
    };

    // Add city-specific data for city blog posts
    const cityData = featuredCity ? {
      featuredCity,
      cityLandmarks,
      ctaDestination
    } : null;

    const finalContent = {
      ...blogContent,
      blogType,
      targetKeywords,
      cityData,
      schema,
      generatedAt: new Date().toISOString()
    };

    logStep("Blog content generation completed", { title: blogContent.title });

    return new Response(JSON.stringify(finalContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in blog content generation", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});