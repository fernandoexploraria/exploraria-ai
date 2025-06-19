
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  console.log("OpenAI Realtime function called with upgrade header:", upgradeHeader);

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log("Not a WebSocket request, returning 400");
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  // Check for OpenAI API key
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    console.error("OpenAI API key not found");
    return new Response("OpenAI API key not configured", { status: 500 });
  }

  console.log("OpenAI API key found, proceeding with WebSocket upgrade");

  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let openAISocket: WebSocket | null = null;

    socket.onopen = () => {
      console.log("Client WebSocket connection opened");
      
      // Connect to OpenAI Realtime API
      const openAIUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
      console.log("Connecting to OpenAI:", openAIUrl);
      
      try {
        openAISocket = new WebSocket(openAIUrl, [], {
          headers: {
            "Authorization": `Bearer ${openAIApiKey}`,
            "OpenAI-Beta": "realtime=v1"
          }
        });

        openAISocket.onopen = () => {
          console.log("Connected to OpenAI Realtime API successfully");
        };

        openAISocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("OpenAI message:", data.type);
            
            // Send session update after receiving session.created
            if (data.type === 'session.created') {
              console.log("Session created, sending session update");
              const sessionUpdate = {
                type: 'session.update',
                session: {
                  modalities: ['text', 'audio'],
                  instructions: 'You are a friendly tour guide assistant. Provide helpful information about landmarks, attractions, and travel tips. Keep responses conversational and engaging.',
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
              openAISocket?.send(JSON.stringify(sessionUpdate));
              console.log("Session update sent");
            }

            // Forward all messages to client
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(event.data);
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
          console.log("OpenAI WebSocket closed:", event.code, event.reason);
          if (socket.readyState === WebSocket.OPEN) {
            socket.close();
          }
        };
      } catch (error) {
        console.error("Error creating OpenAI WebSocket:", error);
        socket.close(1000, "Failed to connect to OpenAI");
      }
    };

    socket.onmessage = (event) => {
      console.log("Received message from client:", event.data);
      // Forward client messages to OpenAI
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
      } else {
        console.log("OpenAI socket not ready, message not forwarded");
      }
    };

    socket.onclose = (event) => {
      console.log("Client WebSocket connection closed:", event.code, event.reason);
      if (openAISocket) {
        openAISocket.close();
      }
    };

    socket.onerror = (error) => {
      console.error("Client WebSocket error:", error);
      if (openAISocket) {
        openAISocket.close();
      }
    };

    return response;
  } catch (error) {
    console.error("Error upgrading WebSocket:", error);
    return new Response("Failed to upgrade WebSocket", { status: 500 });
  }
});
