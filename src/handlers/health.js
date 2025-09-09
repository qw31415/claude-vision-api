import { corsHeaders } from '../middleware/cors.js';

export function handleHealth() {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Claude Vision API',
    version: '1.0.0',
    endpoints: [
      'GET /api/health - Health check',
      'POST /api/chat - Text chat',
      'POST /api/chat/stream - Streaming text chat', 
      'POST /api/chat/multimodal - Multimodal chat (text + images)',
      'POST /api/image/upload - Image upload and analysis'
    ],
    features: [
      'Text conversations',
      'Image analysis and vision',
      'Streaming responses',
      'Session management',
      'CORS support',
      'API key authentication'
    ]
  };

  return new Response(JSON.stringify(healthData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}