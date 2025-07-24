import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DialogueScript {
  filename: string;
  text: string;
  voice: 'agent' | 'tourist';
}

const DIALOGUE_SCRIPTS: DialogueScript[] = [
  {
    filename: 'agent-welcome.mp3',
    text: "Hi! I'm Alexis, your personal AI tour guide. Welcome to New York City! What kind of adventure are you looking for today?",
    voice: 'agent'
  },
  {
    filename: 'tourist-historical.mp3',
    text: 'Show me iconic landmarks and history',
    voice: 'tourist'
  },
  {
    filename: 'agent-historical-response.mp3',
    text: "Perfect choice! New York is rich with incredible history. Look behind you - that's the magnificent Empire State Building! Built in 1931, it was the world's tallest building for 40 years. Would you like to explore it or see what other treasures are nearby?",
    voice: 'agent'
  },
  {
    filename: 'tourist-hidden.mp3',
    text: 'I want to discover hidden gems',
    voice: 'tourist'
  },
  {
    filename: 'agent-hidden-response.mp3',
    text: "Excellent! I love showing visitors NYC's secret spots. Just two blocks from here is a hidden speakeasy from the 1920s that most tourists never find. Plus, there's a rooftop garden with stunning city views that locals use as their quiet escape. Which sounds more intriguing?",
    voice: 'agent'
  },
  {
    filename: 'tourist-empire-state.mp3',
    text: 'Tell me more about the Empire State Building',
    voice: 'tourist'
  },
  {
    filename: 'agent-empire-final.mp3',
    text: "Here's a fascinating detail - the building has its own ZIP code! It was constructed in just 410 days, and on clear days, you can see five states from the top. The lights change colors for holidays and special events. I can help you skip the lines and find the best photo spots. Ready to start your New York adventure?",
    voice: 'agent'
  },
  {
    filename: 'tourist-nearby.mp3',
    text: 'Show me other nearby treasures',
    voice: 'tourist'
  },
  {
    filename: 'agent-nearby-final.mp3',
    text: "Within walking distance, you'll find the stunning New York Public Library with its famous lions, Bryant Park where locals relax, and Grand Central Terminal - an architectural masterpiece. I can create the perfect route based on your interests and show you insider tips for each location. Shall we begin your personalized tour?",
    voice: 'agent'
  },
  {
    filename: 'tourist-speakeasy.mp3',
    text: 'The secret speakeasy sounds amazing!',
    voice: 'tourist'
  },
  {
    filename: 'agent-speakeasy-final.mp3',
    text: "Perfect! It's called 'The Back Room' and you enter through a toy store - just like the prohibition era! They serve authentic 1920s cocktails in teacups and brown paper bags. I'll guide you there and share the secret password. Plus, I know the best time to visit when it's not crowded. Ready to discover New York's hidden side?",
    voice: 'agent'
  },
  {
    filename: 'tourist-garden.mp3',
    text: 'I love peaceful spots - show me the garden',
    voice: 'tourist'
  },
  {
    filename: 'agent-garden-final.mp3',
    text: "It's called the High Line - an elevated park built on old railway tracks. You'll walk among wildflowers with incredible views of the Hudson River and city skyline. There are art installations and cozy seating areas where you can watch the sunset. I can show you the best entrance and the most Instagram-worthy spots. Shall we head there now?",
    voice: 'agent'
  }
];

// Voice IDs for different speakers
const VOICE_CONFIG = {
  agent: {
    voice_id: '9BWtsMINqrJLrRacOk9x', // Aria - warm female voice
    model_id: 'eleven_multilingual_v2'
  },
  tourist: {
    voice_id: 'bIHbv24MWmeRgasZH58o', // Will - enthusiastic male voice  
    model_id: 'eleven_multilingual_v2'
  }
};

async function generateAudioFile(script: DialogueScript): Promise<ArrayBuffer> {
  const voiceConfig = VOICE_CONFIG[script.voice];
  
  console.log(`🎙️ Generating audio for: ${script.filename}`);
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voice_id}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY')!,
    },
    body: JSON.stringify({
      text: script.text,
      model_id: voiceConfig.model_id,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error for ${script.filename}: ${response.status} - ${errorText}`);
  }

  return response.arrayBuffer();
}

async function uploadToStorage(supabase: any, filename: string, audioBuffer: ArrayBuffer): Promise<void> {
  console.log(`📁 Uploading ${filename} to storage...`);
  
  const { data, error } = await supabase.storage
    .from('voice-demo-audio')
    .upload(filename, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true // Overwrite if exists
    });

  if (error) {
    throw new Error(`Storage upload error for ${filename}: ${error.message}`);
  }

  console.log(`✅ Successfully uploaded: ${filename}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🎭 Starting voice demo audio generation...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: Array<{ filename: string; status: 'success' | 'error'; error?: string }> = [];
    
    // Generate and upload each audio file
    for (const script of DIALOGUE_SCRIPTS) {
      try {
        console.log(`\n🔄 Processing: ${script.filename}`);
        
        // Generate audio
        const audioBuffer = await generateAudioFile(script);
        
        // Upload to storage
        await uploadToStorage(supabase, script.filename, audioBuffer);
        
        results.push({ filename: script.filename, status: 'success' });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error processing ${script.filename}:`, error);
        results.push({ 
          filename: script.filename, 
          status: 'error', 
          error: error.message 
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`\n📊 Generation completed: ${successCount} success, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      message: `Generated ${successCount} of ${DIALOGUE_SCRIPTS.length} audio files`,
      results: results,
      summary: {
        total: DIALOGUE_SCRIPTS.length,
        successful: successCount,
        failed: errorCount
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🚨 Fatal error in voice demo generation:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Failed to generate voice demo audio files'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});