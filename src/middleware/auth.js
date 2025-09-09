export async function validateAuth(request, env) {
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    return { valid: false, error: 'Missing API key. Please provide X-API-Key header or Authorization Bearer token.' };
  }

  // Get allowed API keys from environment
  const allowedKeys = env.ALLOWED_API_KEYS?.split(',') || [];
  
  // If no allowed keys are configured, accept any key (for development)
  if (allowedKeys.length === 0) {
    console.warn('No ALLOWED_API_KEYS configured. This is not recommended for production.');
    return { valid: true };
  }

  if (!allowedKeys.includes(apiKey)) {
    return { valid: false, error: 'Invalid API key.' };
  }

  return { valid: true };
}

export function generateSessionId() {
  return crypto.randomUUID();
}