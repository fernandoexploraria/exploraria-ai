#!/usr/bin/env node

/**
 * Content Generation Script for Phase 1 Static SEO Pages
 * 
 * This script generates all static content for city pages and blog posts
 * using the existing API infrastructure (Gemini AI + Google Places API)
 * 
 * Usage: node scripts/generate-content.js
 */

const fs = require('fs');
const path = require('path');

// Mock data for development - in production, this would import from the actual files
const TOP_LANDMARKS = [
  { name: "Frida Kahlo Museum, Mexico City", coordinates: [-99.1625, 19.3547], description: "Historic blue house where renowned artist Frida Kahlo lived and worked", place_id: "ChIJOz-6AMT_0YURofTM9_ekAWI" },
  { name: "Eiffel Tower, Paris", coordinates: [2.2945, 48.8584], description: "Iconic iron lattice tower and symbol of Paris", place_id: "ChIJLU7jZClu5kcR4PcOOO6p3I0" },
  { name: "Times Square, New York", coordinates: [-73.9857, 40.758], description: "The crossroads of the world in Manhattan", place_id: "ChIJmQJIxlVYwokRLgeuocVOGVU" },
  { name: "Big Ben, London", coordinates: [-0.1246, 51.4994], description: "Famous clock tower at Westminster Palace", place_id: "ChIJ2dGMjMMEdkgRqVqkuXQkj7c" },
  { name: "Colosseum, Rome", coordinates: [12.4922, 41.8902], description: "Ancient Roman amphitheater", place_id: "ChIJrRMgU7ZhLxMRxAOFkC7I8Sg" },
  { name: "Sydney Opera House, Australia", coordinates: [151.2153, -33.8568], description: "Iconic performing arts venue with sail-like design", place_id: "ChIJ3S-JXmauEmsRUcIaWtf4MzE" }
  // Add more landmarks as needed for testing
];

const logStep = (step) => {
  console.log(`[CONTENT-GEN] ${new Date().toISOString()} - ${step}`);
};

const extractCitiesFromLandmarks = () => {
  const cityMap = new Map();

  TOP_LANDMARKS.forEach(landmark => {
    const parts = landmark.name.split(',');
    if (parts.length < 2) return;
    
    const cityName = parts[parts.length - 1].trim();
    const citySlug = cityName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');

    if (!cityMap.has(cityName)) {
      cityMap.set(cityName, {
        name: cityName,
        slug: citySlug,
        coordinates: landmark.coordinates,
        landmarks: [],
        primaryLandmark: landmark,
        landmarkCount: 0
      });
    }

    const cityData = cityMap.get(cityName);
    cityData.landmarks.push(landmark);
    cityData.landmarkCount = cityData.landmarks.length;
  });

  return Array.from(cityMap.values())
    .filter(city => city.landmarks.length > 0)
    .sort((a, b) => b.landmarkCount - a.landmarkCount);
};

const getPhase1Cities = () => {
  const allCities = extractCitiesFromLandmarks();
  
  // Prioritize cities for Phase 1
  const priorityCities = ['Paris', 'London', 'New York', 'Rome', 'Mexico City', 'Sydney'];
  const selectedCities = [];
  
  // Add priority cities first
  priorityCities.forEach(cityName => {
    const city = allCities.find(c => c.name === cityName);
    if (city) selectedCities.push(city);
  });
  
  // Add remaining cities up to 15
  allCities.forEach(city => {
    if (selectedCities.length < 15 && !selectedCities.find(c => c.name === city.name)) {
      selectedCities.push(city);
    }
  });
  
  return selectedCities.slice(0, 15);
};

const generateCityContent = async (city) => {
  logStep(`Generating content for ${city.name}`);
  
  // Simulate content generation (in production, this would call the edge function)
  const cityContent = {
    cityName: city.name,
    slug: city.slug,
    seoTitle: `Explore ${city.name} - AI Travel Guide | Exploraria`,
    metaDescription: `Discover ${city.name} with AI-powered tours and personalized recommendations. Explore ${city.landmarks.length} landmarks and unique experiences.`,
    metaKeywords: [`${city.name} travel`, `${city.name} tours`, 'AI travel guide', 'travel planning'],
    heroTitle: `Discover ${city.name} with AI`,
    heroDescription: `Experience ${city.name} like never before with AI-powered tours featuring ${city.landmarks.length} incredible landmarks.`,
    cityDescription: `${city.name} offers an amazing blend of culture, history, and modern attractions. Our AI-powered travel guide helps you discover the best experiences, from world-famous landmarks to hidden local gems. Whether you're interested in ${city.landmarks.map(l => l.name.split(',')[0]).join(', ')}, our personalized tours will create the perfect itinerary for your interests.`,
    landmarkHighlights: city.landmarks.reduce((acc, landmark) => {
      acc[landmark.name] = landmark.description;
      return acc;
    }, {}),
    travelTips: [
      `Visit ${city.name}'s top landmarks early in the morning to avoid crowds`,
      'Use our AI tour generator to create personalized itineraries',
      'Try local cuisine recommendations from our AI guide',
      'Book tours in advance for popular attractions'
    ],
    bestTimeToVisit: 'Year-round destination with unique seasonal highlights',
    transportation: 'Multiple transportation options available including public transit, walking tours, and ride-sharing',
    tourGenerationData: {
      coordinates: city.coordinates,
      primaryLandmark: city.primaryLandmark,
      availableLandmarks: city.landmarks
    },
    schema: {
      "@context": "https://schema.org",
      "@type": "Place",
      "name": city.name,
      "description": `Travel guide for ${city.name}`,
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": city.coordinates[1],
        "longitude": city.coordinates[0]
      },
      "containsPlace": city.landmarks.map(landmark => ({
        "@type": "TouristAttraction",
        "name": landmark.name,
        "description": landmark.description,
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": landmark.coordinates[1],
          "longitude": landmark.coordinates[0]
        }
      }))
    },
    generatedAt: new Date().toISOString()
  };
  
  return cityContent;
};

const generateBlogContent = async (blogPost) => {
  logStep(`Generating blog content: ${blogPost.title}`);
  
  // Simulate blog content generation
  const blogContent = {
    title: blogPost.title,
    slug: blogPost.slug,
    metaDescription: blogPost.metaDescription,
    metaKeywords: blogPost.keywords,
    introduction: blogPost.introduction,
    mainContent: blogPost.content,
    ctaSections: blogPost.ctaSections,
    conclusion: blogPost.conclusion,
    readingTime: '5 min read',
    category: blogPost.category,
    blogType: blogPost.blogType,
    cityData: blogPost.cityData || null,
    schema: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": blogPost.title,
      "description": blogPost.metaDescription,
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
        "@id": `https://lovable.exploraria.ai/blog/${blogPost.slug}`
      }
    },
    generatedAt: new Date().toISOString()
  };
  
  return blogContent;
};

const getBlogPostTemplates = (cities) => {
  return [
    // City-specific blog posts
    {
      title: "Hidden Gems of Mexico City: Beyond the Tourist Trail",
      slug: "mexico-city-hidden-gems",
      metaDescription: "Discover Mexico City's secret attractions and local favorites with our AI-powered travel guide. Explore beyond the typical tourist destinations.",
      keywords: ["Mexico City travel", "Mexico City hidden gems", "AI travel guide", "Mexico City attractions"],
      introduction: "Mexico City offers incredible experiences beyond the well-known tourist spots. Discover the city's hidden gems with AI-powered recommendations.",
      content: "<h2>Frida Kahlo Museum and Coyoacán</h2><p>While many visitors rush to the main museums, the Frida Kahlo Museum offers an intimate look into the artist's life...</p><h2>Local Neighborhoods to Explore</h2><p>Use our AI guide to discover authentic local experiences in neighborhoods like Roma Norte and Condesa...</p>",
      ctaSections: [
        {
          position: "mid-content",
          text: "Ready to explore Mexico City like a local?",
          buttonText: "Generate Your Mexico City Tour Now!"
        }
      ],
      conclusion: "Start your AI-powered Mexico City adventure today and discover the city's hidden treasures.",
      category: "city-guide",
      blogType: "city-specific",
      cityData: {
        featuredCity: "Mexico City",
        ctaDestination: "Mexico City"
      }
    },
    {
      title: "Paris Uncovered: AI Guide to 4 Iconic Landmarks",
      slug: "paris-iconic-landmarks-ai-guide",
      metaDescription: "Explore Paris's most famous landmarks with AI-powered insights and personalized recommendations for the perfect Parisian experience.",
      keywords: ["Paris travel", "Paris landmarks", "Eiffel Tower", "AI travel guide"],
      introduction: "Paris captivates millions of visitors with its iconic landmarks. Our AI guide helps you experience these world-famous sites with unique insights and personalized recommendations.",
      content: "<h2>The Eiffel Tower: More Than Just a Photo Op</h2><p>Discover the best times to visit and hidden viewpoints...</p><h2>Louvre Museum: AI-Curated Art Routes</h2><p>Navigate the world's largest art museum with personalized routes...</p>",
      ctaSections: [
        {
          position: "mid-content", 
          text: "Want a personalized Paris itinerary?",
          buttonText: "Generate Your Paris Tour Now!"
        }
      ],
      conclusion: "Experience Paris like never before with AI-powered tour planning.",
      category: "city-guide",
      blogType: "city-specific",
      cityData: {
        featuredCity: "Paris",
        ctaDestination: "Paris"
      }
    },
    // Educational blog posts
    {
      title: "How AI is Revolutionizing Travel Planning",
      slug: "ai-revolutionizing-travel-planning",
      metaDescription: "Discover how artificial intelligence is transforming the way we plan and experience travel, from personalized itineraries to real-time recommendations.",
      keywords: ["AI travel planning", "artificial intelligence travel", "smart travel", "travel technology"],
      introduction: "Artificial intelligence is fundamentally changing how we plan, book, and experience travel. From personalized recommendations to real-time optimization, AI is making travel smarter and more enjoyable.",
      content: "<h2>Personalized Itinerary Generation</h2><p>AI algorithms analyze your preferences, budget, and schedule to create perfectly tailored travel plans...</p><h2>Real-Time Optimization</h2><p>Smart systems adapt your plans based on weather, crowds, and local events...</p>",
      ctaSections: [
        {
          position: "mid-content",
          text: "Experience the future of travel planning",
          buttonText: "Try Our AI Tour Generator"
        }
      ],
      conclusion: "Join the AI travel revolution and discover how intelligent planning can transform your next adventure.",
      category: "education",
      blogType: "educational"
    },
    {
      title: "Voice-Guided Tours: The Future of Sightseeing",
      slug: "voice-guided-tours-future-sightseeing",
      metaDescription: "Learn how voice-guided AI tours are transforming sightseeing with personalized narration, real-time information, and hands-free exploration.",
      keywords: ["voice guided tours", "AI tour guide", "smart sightseeing", "audio tours"],
      introduction: "Voice-guided tours powered by AI are revolutionizing how we explore new destinations. Discover the benefits of hands-free, personalized audio experiences.",
      content: "<h2>Personalized Narration</h2><p>AI adapts the tour content to your interests and pace...</p><h2>Real-Time Information</h2><p>Get up-to-date details about opening hours, weather, and crowds...</p>",
      ctaSections: [
        {
          position: "mid-content",
          text: "Ready to try voice-guided exploration?",
          buttonText: "Experience AI Voice Tours"
        }
      ],
      conclusion: "Step into the future of sightseeing with AI-powered voice guidance.",
      category: "features",
      blogType: "product-feature"
    }
  ];
};

const generateAllContent = async () => {
  try {
    logStep('Starting content generation process');
    
    // Get Phase 1 cities
    const cities = getPhase1Cities();
    logStep(`Selected ${cities.length} cities for Phase 1`);
    
    // Generate city content
    logStep('Generating city page content');
    const cityPages = [];
    for (const city of cities) {
      const content = await generateCityContent(city);
      cityPages.push(content);
    }
    
    // Generate blog content
    logStep('Generating blog post content');
    const blogTemplates = getBlogPostTemplates(cities);
    const blogPosts = [];
    for (const template of blogTemplates) {
      const content = await generateBlogContent(template);
      blogPosts.push(content);
    }
    
    // Save content to static files
    const outputDir = path.join(process.cwd(), 'src/data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save city pages
    const cityPagesPath = path.join(outputDir, 'generated-city-pages.json');
    fs.writeFileSync(cityPagesPath, JSON.stringify(cityPages, null, 2));
    logStep(`Saved ${cityPages.length} city pages to ${cityPagesPath}`);
    
    // Save blog posts
    const blogPostsPath = path.join(outputDir, 'generated-blog-posts.json');
    fs.writeFileSync(blogPostsPath, JSON.stringify(blogPosts, null, 2));
    logStep(`Saved ${blogPosts.length} blog posts to ${blogPostsPath}`);
    
    // Generate summary
    const summary = {
      generatedAt: new Date().toISOString(),
      cityPages: cityPages.length,
      blogPosts: blogPosts.length,
      totalPages: cityPages.length + blogPosts.length,
      cities: cityPages.map(cp => cp.cityName),
      blogTitles: blogPosts.map(bp => bp.title)
    };
    
    const summaryPath = path.join(outputDir, 'content-generation-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    logStep('Content generation completed successfully');
    console.log('\n📊 GENERATION SUMMARY:');
    console.log(`   City Pages: ${summary.cityPages}`);
    console.log(`   Blog Posts: ${summary.blogPosts}`);
    console.log(`   Total Pages: ${summary.totalPages}`);
    console.log(`   Cities: ${summary.cities.join(', ')}`);
    console.log('\n✅ Static content ready for pre-rendering!\n');
    
    return summary;
    
  } catch (error) {
    console.error('❌ Error generating content:', error);
    process.exit(1);
  }
};

// Run content generation if script is executed directly
if (require.main === module) {
  generateAllContent();
}

module.exports = { generateAllContent };