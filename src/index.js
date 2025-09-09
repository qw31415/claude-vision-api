import { handleChatRequest } from './handlers/chat.js';
import { handleChatStream } from './handlers/stream.js';
import { handleImageUpload } from './handlers/image.js';
import { handleHealth } from './handlers/health.js';
import { corsHeaders, handleCORS } from './middleware/cors.js';
import { validateAuth } from './middleware/auth.js';

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check endpoint
      if (path === '/api/health' && request.method === 'GET') {
        return handleHealth();
      }

      // Validate authentication for all API endpoints except health
      if (path.startsWith('/api/') && path !== '/api/health') {
        const authResult = await validateAuth(request, env);
        if (!authResult.valid) {
          return new Response(JSON.stringify({ error: authResult.error }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Route handling
      switch (true) {
        case path === '/api/chat' && request.method === 'POST':
          return handleChatRequest(request, env);

        case path === '/api/chat/stream' && request.method === 'POST':
          return handleChatStream(request, env);

        case path === '/api/image/upload' && request.method === 'POST':
          return handleImageUpload(request, env);

        case path === '/api/chat/multimodal' && request.method === 'POST':
          return handleChatRequest(request, env, { multimodal: true });

        default:
          return new Response(JSON.stringify({ 
            error: 'Not Found',
            message: 'Available endpoints: /api/health, /api/chat, /api/chat/stream, /api/image/upload, /api/chat/multimodal'
          }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
      }
    } catch (error) {
      console.error('Request error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};