import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Only include landmarks for the 8 verified working cities
const TOP_LANDMARKS = [
  { name: "Frida Kahlo Museum, Mexico City", coordinates: [-99.1625, 19.3547], description: "Historic blue house where renowned artist Frida Kahlo lived and worked", place_id: "ChIJOz-6AMT_0YURofTM9_ekAWI" },
  { name: "Eiffel Tower, Paris", coordinates: [2.2945, 48.8584], description: "Iconic iron lattice tower and symbol of Paris", place_id: "ChIJLU7jZClu5kcR4PcOOO6p3I0" },
  { name: "Notre-Dame Cathedral, Paris", coordinates: [2.3499, 48.853], description: "Medieval Catholic cathedral on Île de la Cité", place_id: "ChIJATr1n-Fx5kcRjQb6q6cdQDY" },
  { name: "Louvre Museum, Paris", coordinates: [2.3376, 48.8606], description: "World's largest art museum and historic monument", place_id: "ChIJD3uTd9hx5kcR1IQvGfr8dbk" },
  { name: "Times Square, New York", coordinates: [-73.9857, 40.758], description: "The crossroads of the world in Manhattan", place_id: "ChIJmQJIxlVYwokRLgeuocVOGVU" },
  { name: "Statue of Liberty, New York", coordinates: [-74.0445, 40.6892], description: "Symbol of freedom and democracy", place_id: "ChIJPTacEpBQwokRKwIlDXelxkA" },
  { name: "Empire State Building, New York", coordinates: [-73.9857, 40.7484], description: "Art Deco skyscraper in Midtown Manhattan", place_id: "ChIJaXQRs6lZwokRY6EFpJnhNNE" },
  { name: "Big Ben, London", coordinates: [-0.1246, 51.4994], description: "Famous clock tower at Westminster Palace", place_id: "ChIJ2dGMjMMEdkgRqVqkuXQkj7c" },
  { name: "Tower Bridge, London", coordinates: [-0.0754, 51.5055], description: "Victorian Gothic bascule bridge over the Thames", place_id: "ChIJSdtli0MDdkgRLW9aCBpCeJ4" },
  { name: "Buckingham Palace, London", coordinates: [-0.1419, 51.5014], description: "London residence of the British monarch", place_id: "ChIJtV5bzSAFdkgRpwLZFPWrJgo" },
  { name: "Westminster Abbey, London", coordinates: [-0.1276, 51.4994], description: "Gothic abbey church and coronation site of British monarchs", place_id: "ChIJLzVDusQEdkgRelObBaL_jto" },
  { name: "London Eye, London", coordinates: [-0.1196, 51.5033], description: "Giant observation wheel on the South Bank of Thames", place_id: "ChIJH2U9GscEdkgR7sArcZd_NnI" },
  { name: "Colosseum, Rome", coordinates: [12.4922, 41.8902], description: "Ancient Roman amphitheater", place_id: "ChIJrRMgU7ZhLxMRxAOFkC7I8Sg" },
  { name: "Sagrada Familia, Barcelona", coordinates: [2.1734, 41.4036], description: "Unfinished basilica designed by Antoni Gaudí", place_id: "ChIJk_s92NyipBIRUMnDG8Kq2Js" },
  { name: "Brandenburg Gate, Berlin", coordinates: [13.3777, 52.5163], description: "Neoclassical monument and symbol of Berlin", place_id: "ChIJQVQd3s1RqEcRcDteqyLqHV8" },
  { name: "CN Tower, Toronto", coordinates: [-79.3871, 43.6426], description: "Communications tower and landmark of Toronto", place_id: "ChIJmzrzi9Y0K4gRgXUc3sTY7RU" }
];

const logStep = (step: string) => {
  console.log(`[CONTENT-GEN-V2] ${new Date().toISOString()} - ${step}`);
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
  
  // Only verified working cities (8 cities that actually work)
  const verifiedCityNames = [
    'Paris', 'London', 'New York', 'Rome', 
    'Barcelona', 'Berlin', 'Toronto', 'Mexico City'
  ];
  
  return allCities
    .filter(city => verifiedCityNames.includes(city.name))
    .sort((a, b) => b.landmarkCount - a.landmarkCount);
};

const generateCityContent = async (city: any) => {
  logStep(`Generating content for ${city.name}`);
  
  // Simulate content generation (in production, this would call the Gemini API)
  const cityContent = {
    cityName: city.name,
    slug: city.slug,
    seoTitle: `Explore ${city.name} - AI Travel Guide | Exploraria`,
    metaDescription: `Discover ${city.name} with AI-powered tours and personalized recommendations. Explore ${city.landmarks.length} landmarks and unique experiences.`,
    metaKeywords: [`${city.name} travel`, `${city.name} tours`, 'AI travel guide', 'travel planning'],
    heroTitle: `Discover ${city.name} with AI`,
    heroDescription: `Experience ${city.name} like never before with AI-powered tours featuring ${city.landmarks.length} incredible landmarks.`,
    cityDescription: `${city.name} offers an amazing blend of culture, history, and modern attractions. Our AI-powered travel guide helps you discover the best experiences, from world-famous landmarks to hidden local gems. Whether you're interested in ${city.landmarks.map((l: any) => l.name.split(',')[0]).join(', ')}, our personalized tours will create the perfect itinerary for your interests.`,
    landmarkHighlights: city.landmarks.reduce((acc: any, landmark: any) => {
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
      "containsPlace": city.landmarks.map((landmark: any) => ({
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

const generateBlogContent = async (blogPost: any) => {
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

const getBlogPostTemplates = (cities: any[]) => {
  return [
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
    },
    {
      title: "Sustainable Tourism Through Smart AI Recommendations",
      slug: "sustainable-tourism-ai-recommendations",
      metaDescription: "Explore how AI can help travelers make more sustainable choices while discovering amazing destinations and reducing environmental impact.",
      keywords: ["sustainable tourism", "AI travel", "eco-friendly travel", "responsible tourism"],
      introduction: "AI-powered travel planning isn't just about convenience—it's also helping travelers make more sustainable and responsible choices.",
      content: "<h2>Optimized Route Planning</h2><p>AI reduces travel distances and carbon footprint through smart itinerary planning...</p><h2>Local Business Support</h2><p>Discover authentic local experiences that benefit communities...</p>",
      ctaSections: [
        {
          position: "mid-content",
          text: "Plan your sustainable adventure",
          buttonText: "Create Eco-Friendly Tours"
        }
      ],
      conclusion: "Travel responsibly with AI-powered sustainable tourism recommendations.",
      category: "sustainability",
      blogType: "educational"
    }
  ];
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    
    // Generate summary
    const summary = {
      generatedAt: new Date().toISOString(),
      cityPages: cityPages.length,
      blogPosts: blogPosts.length,
      totalPages: cityPages.length + blogPosts.length,
      cities: cityPages.map(cp => cp.cityName),
      blogTitles: blogPosts.map(bp => bp.title),
      cityContent: cityPages,
      blogContent: blogPosts
    };
    
    logStep('Content generation completed successfully');
    console.log('\n📊 GENERATION SUMMARY:');
    console.log(`   City Pages: ${summary.cityPages}`);
    console.log(`   Blog Posts: ${summary.blogPosts}`);
    console.log(`   Total Pages: ${summary.totalPages}`);
    console.log(`   Cities: ${summary.cities.join(', ')}`);
    console.log('\n✅ Static content ready for pre-rendering!\n');
    
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('❌ Error generating content:', error);
    return new Response(JSON.stringify({ error: 'Content generation failed', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});