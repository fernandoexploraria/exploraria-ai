const { JSDOM } = require('jsdom');
const fs = require('fs').promises;
const path = require('path');
const { getPhase1Cities } = require('../src/utils/cityExtraction.ts');

// Blog posts that should be pre-rendered
const BLOG_POSTS = [
  'hidden-gems-mexico-city',
  'ai-powered-travel-future', 
  'personalized-itineraries-ai',
  'sustainable-tourism-ai',
  'local-culture-ai-guide',
  'smart-travel-planning-2024',
  'hidden-cities-world-exploration',
  'food-tourism-ai-recommendations',
  'digital-nomad-ai-city-selection',
  'art-culture-ai-city-tours',
  'weekend-getaways-ai-planning',
  'solo-travel-ai-safety-tips'
];

async function preRenderPages() {
  console.log('🚀 Starting pre-rendering process...');
  
  try {
    // Create output directory
    const outputDir = path.join(__dirname, '../dist/pre-rendered');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Pre-render city pages
    const cities = getPhase1Cities();
    console.log(`🏙️  Pre-rendering ${cities.length} city pages...`);
    
    for (const city of cities) {
      await preRenderCityPage(city, outputDir);
    }
    
    // Pre-render blog pages
    console.log(`📝 Pre-rendering ${BLOG_POSTS.length} blog posts...`);
    
    for (const blogSlug of BLOG_POSTS) {
      await preRenderBlogPost(blogSlug, outputDir);
    }
    
    // Pre-render blog listing page
    await preRenderBlogListing(outputDir);
    
    console.log('\n✅ Pre-rendering completed successfully!');
    console.log(`📂 Pre-rendered pages saved to: dist/pre-rendered/`);
    
  } catch (error) {
    console.error('❌ Pre-rendering failed:', error);
    process.exit(1);
  }
}

async function preRenderCityPage(city, outputDir) {
  try {
    // Load the city content
    const contentPath = path.join(__dirname, '../public/static-content/cities', `${city.slug}.json`);
    let cityContent = null;
    
    try {
      const contentData = await fs.readFile(contentPath, 'utf8');
      cityContent = JSON.parse(contentData);
    } catch (error) {
      console.log(`⚠️  No pre-generated content found for ${city.name}, using fallback`);
    }
    
    // Create basic HTML structure for the city page
    const html = generateCityPageHTML(city, cityContent);
    
    // Save the pre-rendered page
    const cityDir = path.join(outputDir, 'explore');
    await fs.mkdir(cityDir, { recursive: true });
    
    const filePath = path.join(cityDir, `${city.slug}.html`);
    await fs.writeFile(filePath, html);
    
    console.log(`✅ Pre-rendered: /explore/${city.slug}`);
    
  } catch (error) {
    console.error(`❌ Failed to pre-render city page for ${city.name}:`, error.message);
  }
}

async function preRenderBlogPost(blogSlug, outputDir) {
  try {
    // Load the blog content
    const contentPath = path.join(__dirname, '../public/static-content/blog', `${blogSlug}.json`);
    let blogContent = null;
    
    try {
      const contentData = await fs.readFile(contentPath, 'utf8');
      blogContent = JSON.parse(contentData);
    } catch (error) {
      console.log(`⚠️  No pre-generated content found for blog post ${blogSlug}, using fallback`);
    }
    
    // Create basic HTML structure for the blog post
    const html = generateBlogPostHTML(blogSlug, blogContent);
    
    // Save the pre-rendered page
    const blogDir = path.join(outputDir, 'blog');
    await fs.mkdir(blogDir, { recursive: true });
    
    const filePath = path.join(blogDir, `${blogSlug}.html`);
    await fs.writeFile(filePath, html);
    
    console.log(`✅ Pre-rendered: /blog/${blogSlug}`);
    
  } catch (error) {
    console.error(`❌ Failed to pre-render blog post ${blogSlug}:`, error.message);
  }
}

async function preRenderBlogListing(outputDir) {
  try {
    const html = generateBlogListingHTML();
    
    const blogDir = path.join(outputDir, 'blog');
    await fs.mkdir(blogDir, { recursive: true });
    
    const filePath = path.join(blogDir, 'index.html');
    await fs.writeFile(filePath, html);
    
    console.log(`✅ Pre-rendered: /blog`);
    
  } catch (error) {
    console.error(`❌ Failed to pre-render blog listing:`, error.message);
  }
}

function generateCityPageHTML(city, content) {
  const title = content?.seoTitle || `Explore ${city.name} - AI Travel Guide | Exploraria`;
  const description = content?.metaDescription || `Discover ${city.name} with AI-powered tours and personalized recommendations. Explore ${city.landmarks.length} landmarks and unique experiences.`;
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
      ${city.landmarks.map(landmark => `<li>${landmark.name}</li>`).join('')}
    </ul>
  </noscript>
</body>
</html>`;
}

function generateBlogPostHTML(blogSlug, content) {
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
    ${content?.excerpt ? `<p>${content.excerpt}</p>` : ''}
  </noscript>
</body>
</html>`;
}

function generateBlogListingHTML() {
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
}

// Run pre-rendering
if (require.main === module) {
  preRenderPages();
}

module.exports = { preRenderPages };