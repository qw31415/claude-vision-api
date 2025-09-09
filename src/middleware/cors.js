export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Session-ID',
  'Access-Control-Max-Age': '86400'
};

export function handleCORS(request) {
  // Handle CORS preflight requests
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}

export function addCORSHeaders(response) {
  // Add CORS headers to existing response
  Object.keys(corsHeaders).forEach(key => {
    response.headers.set(key, corsHeaders[key]);
  });
  return response;
}