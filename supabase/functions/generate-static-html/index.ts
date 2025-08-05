import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string) => {
  console.log(`[PRE-RENDER] ${new Date().toISOString()} - ${step}`);
};

const generateCityPageHTML = (city: any, content: any) => {
  const title = content?.seoTitle || `Explore ${city.name} - AI Travel Guide | Exploraria`;
  const description = content?.metaDescription || `Discover ${city.name} with AI-powered tours and personalized recommendations. Explore landmarks and unique experiences.`;
  const keywords = content?.metaKeywords?.join(', ') || `${city.name} travel, ${city.name} tours, AI travel guide`;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${keywords}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://exploraria.ai/explore/${city.slug}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${content?.schema ? `<script type="application/ld+json">${JSON.stringify(content.schema)}</script>` : ''}
  <link rel="canonical" href="https://exploraria.ai/explore/${city.slug}">
</head>
<body>
  <div id="root"></div>
  <noscript>
    <h1>${city.name} Travel Guide</h1>
    <p>${description}</p>
    <h2>Featured Landmarks</h2>
    <ul>
      ${city.landmarks ? city.landmarks.map((landmark: any) => `<li>${landmark.name}</li>`).join('') : ''}
    </ul>
  </noscript>
</body>
</html>`;
};

const generateBlogPostHTML = (blogSlug: string, content: any) => {
  const title = content?.title || 'Exploraria Blog Post';
  const description = content?.metaDescription || 'Insights about AI-powered travel and city exploration.';
  const keywords = content?.metaKeywords?.join(', ') || 'AI travel, smart tourism, travel technology';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${keywords}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://exploraria.ai/blog/${blogSlug}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${content?.schema ? `<script type="application/ld+json">${JSON.stringify(content.schema)}</script>` : ''}
  <link rel="canonical" href="https://exploraria.ai/blog/${blogSlug}">
</head>
<body>
  <div id="root"></div>
  <noscript>
    <h1>${title}</h1>
    <p>${description}</p>
    ${content?.introduction ? `<p>${content.introduction}</p>` : ''}
  </noscript>
</body>
</html>`;
};

const generateBlogListingHTML = () => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exploraria Blog - AI Travel Insights and Tips</title>
  <meta name="description" content="Discover insights, tips, and stories about AI-powered travel and city exploration. Learn how AI is revolutionizing tourism.">
  <meta name="keywords" content="AI travel blog, smart tourism, travel technology, AI travel tips, personalized travel">
  <meta property="og:title" content="Exploraria Blog - AI Travel Insights and Tips">
  <meta property="og:description" content="Discover insights, tips, and stories about AI-powered travel and city exploration.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://exploraria.ai/blog">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://exploraria.ai/blog">
</head>
<body>
  <div id="root"></div>
  <noscript>
    <h1>Exploraria Blog</h1>
    <p>Insights, tips, and stories about AI-powered travel and city exploration</p>
  </noscript>
</body>
</html>`;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentData } = await req.json();
    
    if (!contentData) {
      return new Response(JSON.stringify({ error: 'Content data is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep('🚀 Starting pre-rendering process...');
    
    const preRenderedFiles = [];
    
    // Pre-render city pages
    if (contentData.cityContent) {
      logStep(`🏙️  Pre-rendering ${contentData.cityContent.length} city pages...`);
      
      for (const cityContent of contentData.cityContent) {
        const html = generateCityPageHTML(cityContent, cityContent);
        
        preRenderedFiles.push({
          path: `explore/${cityContent.slug}.html`,
          content: html,
          type: 'city'
        });
        
        logStep(`✅ Pre-rendered: /explore/${cityContent.slug}`);
      }
    }
    
    // Pre-render blog pages
    if (contentData.blogContent) {
      logStep(`📝 Pre-rendering ${contentData.blogContent.length} blog posts...`);
      
      for (const blogContent of contentData.blogContent) {
        const html = generateBlogPostHTML(blogContent.slug, blogContent);
        
        preRenderedFiles.push({
          path: `blog/${blogContent.slug}.html`,
          content: html,
          type: 'blog'
        });
        
        logStep(`✅ Pre-rendered: /blog/${blogContent.slug}`);
      }
    }
    
    // Pre-render blog listing page
    const blogListingHTML = generateBlogListingHTML();
    preRenderedFiles.push({
      path: 'blog/index.html',
      content: blogListingHTML,
      type: 'blog-listing'
    });
    
    logStep(`✅ Pre-rendered: /blog`);
    
    const summary = {
      generatedAt: new Date().toISOString(),
      totalFiles: preRenderedFiles.length,
      cityPages: preRenderedFiles.filter(f => f.type === 'city').length,
      blogPages: preRenderedFiles.filter(f => f.type === 'blog').length,
      files: preRenderedFiles,
      message: 'Pre-rendering completed successfully!'
    };
    
    logStep('\n✅ Pre-rendering completed successfully!');
    logStep(`📂 Generated ${summary.totalFiles} static HTML files`);
    
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('❌ Pre-rendering failed:', error);
    return new Response(JSON.stringify({ error: 'Pre-rendering failed', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});