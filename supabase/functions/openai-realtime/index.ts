
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  console.log("OpenAI Realtime function called");
  console.log("Upgrade header:", upgradeHeader);
  console.log("Request method:", req.method);
  console.log("Request URL:", req.url);

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log("Not a WebSocket request, returning 400");
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  // Extract token from URL query parameters
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  
  if (!token) {
    console.log("No token provided in query parameters");
    return new Response("Authentication token required", { status: 401 });
  }

  // Verify the token using Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log("Invalid token:", error?.message);
      return new Response("Invalid authentication token", { status: 401 });
    }

    console.log("User authenticated:", user.id);
  } catch (authError) {
    console.error("Authentication error:", authError);
    return new Response("Authentication failed", { status: 401 });
  }

  // Check for OpenAI API key
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    console.error("OpenAI API key not found in environment");
    return new Response("OpenAI API key not configured", { status: 500 });
  }

  console.log("OpenAI API key found, proceeding with WebSocket upgrade");

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    console.log("WebSocket upgrade successful");
    
    let openAISocket: WebSocket | null = null;

    socket.onopen = () => {
      console.log("Client WebSocket connection opened");
      
      // Connect to OpenAI Realtime API
      const openAIUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
      console.log("Attempting to connect to OpenAI:", openAIUrl);
      
      try {
        openAISocket = new WebSocket(openAIUrl, [], {
          headers: {
            "Authorization": `Bearer ${openAIApiKey}`,
            "OpenAI-Beta": "realtime=v1"
          }
        });

        openAISocket.onopen = () => {
          console.log("Successfully connected to OpenAI Realtime API");
        };

        openAISocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("Received from OpenAI:", data.type);
            
            // Send session update after receiving session.created
            if (data.type === 'session.created') {
              console.log("Session created, sending session update");
              const sessionUpdate = {
                type: 'session.update',
                session: {
                  modalities: ['text', 'audio'],
                  instructions: 'You are a knowledgeable Rome tour guide assistant. Provide helpful information about Rome\'s landmarks, attractions, history, and travel tips. Keep responses conversational, engaging, and informative. When users ask about specific places in Rome, provide interesting historical facts, visiting tips, and cultural insights.',
                  voice: 'alloy',
                  input_audio_format: 'pcm16',
                  output_audio_format: 'pcm16',
                  input_audio_transcription: {
                    model: 'whisper-1'
                  },
                  turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 1000
                  },
                  temperature: 0.8,
                  max_response_output_tokens: 'inf'
                }
              };
              
              if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
                openAISocket.send(JSON.stringify(sessionUpdate));
                console.log("Session update sent successfully");
              } else {
                console.error("OpenAI socket not ready for session update");
              }
            }

            // Forward all messages to client
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(event.data);
            } else {
              console.warn("Client socket not ready, message not forwarded");
            }
          } catch (error) {
            console.error("Error processing OpenAI message:", error);
          }
        };

        openAISocket.onerror = (error) => {
          console.error("OpenAI WebSocket error:", error);
          if (socket.readyState === WebSocket.OPEN) {
            socket.close(1000, "OpenAI connection error");
          }
        };

        openAISocket.onclose = (event) => {
          console.log("OpenAI WebSocket closed - Code:", event.code, "Reason:", event.reason);
          if (socket.readyState === WebSocket.OPEN) {
            socket.close(event.code, event.reason);
          }
        };

      } catch (error) {
        console.error("Error creating OpenAI WebSocket connection:", error);
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, "Failed to connect to OpenAI");
        }
      }
    };

    socket.onmessage = (event) => {
      console.log("Message received from client");
      try {
        const message = JSON.parse(event.data);
        console.log("Client message type:", message.type);
        
        // Forward client messages to OpenAI
        if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
          openAISocket.send(event.data);
          console.log("Message forwarded to OpenAI");
        } else {
          console.warn("OpenAI socket not ready, message not forwarded");
        }
      } catch (error) {
        console.error("Error processing client message:", error);
      }
    };

    socket.onclose = (event) => {
      console.log("Client WebSocket connection closed - Code:", event.code, "Reason:", event.reason);
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.close();
      }
    };

    socket.onerror = (error) => {
      console.error("Client WebSocket error:", error);
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.close();
      }
    };

    console.log("Returning WebSocket response");
    return response;

  } catch (error) {
    console.error("Error in WebSocket upgrade process:", error);
    return new Response(`Failed to upgrade WebSocket: ${error.message}`, { status: 500 });
  }
});
