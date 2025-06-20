// Debug utility for WebSocket connection issues
// Call this from the browser console: window.debugOpenAIWebSocket()

window.debugOpenAIWebSocket = function() {
  console.log('🔧 Starting WebSocket Debug Session...');
  
  let debugWs = null;
  let connectionAttempts = 0;
  let lastCloseReason = null;
  let connectionStartTime = null;
  let heartbeatInterval = null;
  
  const wsUrl = 'wss://ejqgdmbuabrcjxbhpxup.functions.supabase.co/functions/v1/openai-realtime';
  
  function logWithTimestamp(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data || '');
  }
  
  function connectDebugSocket() {
    connectionAttempts++;
    connectionStartTime = Date.now();
    
    logWithTimestamp(`🔄 Connection attempt #${connectionAttempts}`);
    logWithTimestamp(`📡 Connecting to: ${wsUrl}`);
    
    try {
      debugWs = new WebSocket(wsUrl);
      
      // Log all WebSocket properties
      logWithTimestamp('🔍 WebSocket object created', {
        url: debugWs.url,
        protocol: debugWs.protocol,
        readyState: debugWs.readyState,
        extensions: debugWs.extensions
      });
      
      debugWs.onopen = function(event) {
        const connectionTime = Date.now() - connectionStartTime;
        logWithTimestamp(`✅ WebSocket OPENED in ${connectionTime}ms`, {
          event: event,
          readyState: debugWs.readyState,
          protocol: debugWs.protocol,
          extensions: debugWs.extensions
        });
        
        // Start heartbeat to keep connection alive
        heartbeatInterval = setInterval(() => {
          if (debugWs && debugWs.readyState === WebSocket.OPEN) {
            logWithTimestamp('💓 Sending heartbeat ping');
            debugWs.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, 30000); // Every 30 seconds
        
        // Send a test session create message
        setTimeout(() => {
          if (debugWs && debugWs.readyState === WebSocket.OPEN) {
            logWithTimestamp('📤 Sending test session create');
            debugWs.send(JSON.stringify({
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: 'You are a helpful test assistant.',
                voice: 'alloy',
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 1000
                }
              }
            }));
          }
        }, 1000);
      };
      
      debugWs.onmessage = function(event) {
        let messageData;
        try {
          messageData = JSON.parse(event.data);
          logWithTimestamp('📨 Message received', {
            type: messageData.type,
            size: event.data.length,
            data: messageData
          });
        } catch (e) {
          logWithTimestamp('📨 Raw message received', {
            size: event.data.length,
            data: event.data.substring(0, 200) + '...'
          });
        }
      };
      
      debugWs.onerror = function(error) {
        logWithTimestamp('❌ WebSocket ERROR', {
          error: error,
          readyState: debugWs ? debugWs.readyState : 'null',
          timestamp: Date.now()
        });
      };
      
      debugWs.onclose = function(event) {
        const connectionDuration = Date.now() - connectionStartTime;
        lastCloseReason = {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          timestamp: Date.now(),
          connectionDuration: connectionDuration
        };
        
        logWithTimestamp('🔴 WebSocket CLOSED', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          connectionDuration: `${connectionDuration}ms`,
          readyState: debugWs ? debugWs.readyState : 'null'
        });
        
        // Clear heartbeat
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        
        // Decode close codes
        const closeReasons = {
          1000: 'Normal Closure',
          1001: 'Going Away',
          1002: 'Protocol Error',
          1003: 'Unsupported Data',
          1004: 'Reserved',
          1005: 'No Status Received',
          1006: 'Abnormal Closure',
          1007: 'Invalid frame payload data',
          1008: 'Policy Violation',
          1009: 'Message too big',
          1010: 'Missing Extension',
          1011: 'Internal Error',
          1012: 'Service Restart',
          1013: 'Try Again Later',
          1014: 'Bad Gateway',
          1015: 'TLS Handshake'
        };
        
        logWithTimestamp(`📋 Close code meaning: ${closeReasons[event.code] || 'Unknown'}`);
        
        // Auto-reconnect after a delay for debugging
        if (connectionAttempts < 3) {
          logWithTimestamp(`⏰ Reconnecting in 5 seconds... (attempt ${connectionAttempts + 1}/3)`);
          setTimeout(connectDebugSocket, 5000);
        } else {
          logWithTimestamp('🛑 Max connection attempts reached. Debug session ended.');
          logWithTimestamp('📊 Final Summary:', {
            totalAttempts: connectionAttempts,
            lastCloseReason: lastCloseReason
          });
        }
      };
      
    } catch (error) {
      logWithTimestamp('💥 Failed to create WebSocket', error);
    }
  }
  
  // Start the debug session
  connectDebugSocket();
  
  // Return control functions
  return {
    close: function() {
      logWithTimestamp('🛑 Manually closing debug WebSocket');
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (debugWs) {
        debugWs.close();
      }
    },
    getStatus: function() {
      return {
        connectionAttempts,
        lastCloseReason,
        currentState: debugWs ? debugWs.readyState : 'null',
        url: wsUrl
      };
    },
    sendTest: function(message) {
      if (debugWs && debugWs.readyState === WebSocket.OPEN) {
        logWithTimestamp('📤 Sending test message', message);
        debugWs.send(JSON.stringify(message));
      } else {
        logWithTimestamp('❌ Cannot send - WebSocket not open', {
          readyState: debugWs ? debugWs.readyState : 'null'
        });
      }
    }
  };
};

// Also add a simpler function to check the current OpenAI connection
window.checkOpenAIConnection = async function() {
  console.log('🔍 Checking OpenAI API connectivity...');
  
  try {
    // Test the edge function endpoint
    const response = await fetch('https://ejqgdmbuabrcjxbhpxue.functions.supabase.co/functions/v1/openai-realtime', {
      method: 'GET'
    });
    
    console.log('📡 Edge function response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (response.status === 426) {
      console.log('✅ Edge function is responding (426 = Upgrade Required for WebSocket)');
    }
    
  } catch (error) {
    console.log('❌ Edge function check failed:', error);
  }
  
  // Test basic WebSocket creation
  try {
    const testWs = new WebSocket('wss://ejqgdmbuabrcjxbhpxup.functions.supabase.co/functions/v1/openai-realtime');
    
    setTimeout(() => {
      console.log('🔍 Test WebSocket state after 2s:', {
        readyState: testWs.readyState,
        url: testWs.url
      });
      testWs.close();
    }, 2000);
    
  } catch (error) {
    console.log('❌ WebSocket creation failed:', error);
  }
};

console.log('🎯 Debug functions loaded! Use:');
console.log('  - window.debugOpenAIWebSocket() - Full debug session');
console.log('  - window.checkOpenAIConnection() - Quick connectivity check');
