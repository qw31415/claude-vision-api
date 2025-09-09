import { ClaudeAPI } from '../utils/claude.js';
import { SessionManager } from '../utils/sessions.js';
import { corsHeaders } from '../middleware/cors.js';
import { generateSessionId } from '../middleware/auth.js';

export async function handleChatRequest(request, env, options = {}) {
  try {
    const { multimodal = false } = options;
    const body = await request.json();
    
    const {
      message,
      images = [],
      sessionId = generateSessionId(),
      model,
      maxTokens,
      temperature,
      systemPrompt
    } = body;

    // Validate required fields
    if (!message && images.length === 0) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Either message or images must be provided'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Initialize Claude API
    const claude = new ClaudeAPI(env.ANTHROPIC_API_KEY);
    const sessionManager = new SessionManager(env.SESSIONS);

    // Get or create session
    let session = await sessionManager.getSession(sessionId);
    if (!session) {
      session = await sessionManager.createSession(sessionId);
    }

    // Prepare the message content
    let messageContent;
    
    if (multimodal && images.length > 0) {
      // Multimodal message with text and images
      messageContent = [];
      
      if (message) {
        messageContent.push({
          type: 'text',
          text: message
        });
      }

      // Add images
      for (const imageData of images) {
        const { validateImageData } = await import('../utils/claude.js');
        const validation = validateImageData(imageData);
        
        if (!validation.valid) {
          return new Response(JSON.stringify({
            error: 'Invalid Image',
            message: validation.error
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        messageContent.push({
          type: 'image',
          media_type: validation.mediaType,
          data: validation.data
        });
      }
    } else {
      // Text-only message
      messageContent = message;
    }

    // Add user message to session
    const userMessage = { role: 'user', content: messageContent };
    await sessionManager.addMessage(sessionId, userMessage);

    // Prepare messages for Claude API (include conversation history)
    const conversationHistory = await sessionManager.getSessionHistory(sessionId, 10);
    
    // Send to Claude API
    const response = await claude.sendMessage(conversationHistory, {
      model,
      maxTokens,
      temperature,
      systemPrompt
    });

    // Add assistant response to session
    const assistantMessage = {
      role: 'assistant',
      content: response.content[0].text
    };
    await sessionManager.addMessage(sessionId, assistantMessage);

    // Return response
    return new Response(JSON.stringify({
      id: response.id,
      sessionId,
      message: response.content[0].text,
      model: response.model,
      usage: response.usage,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Chat request error:', error);
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