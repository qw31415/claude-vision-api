import { ClaudeAPI, validateImageData } from '../utils/claude.js';
import { SessionManager } from '../utils/sessions.js';
import { corsHeaders } from '../middleware/cors.js';
import { generateSessionId } from '../middleware/auth.js';

export async function handleImageUpload(request, env) {
  try {
    const body = await request.json();
    
    const {
      image,
      prompt = "What do you see in this image? Please describe it in detail.",
      sessionId = generateSessionId(),
      model,
      maxTokens = 4096,
      temperature = 0.7
    } = body;

    // Validate image data
    if (!image) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Image data is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const validation = validateImageData(image);
    if (!validation.valid) {
      return new Response(JSON.stringify({
        error: 'Invalid Image',
        message: validation.error
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Initialize Claude API and session manager
    const claude = new ClaudeAPI(env.ANTHROPIC_API_KEY);
    const sessionManager = new SessionManager(env.SESSIONS);

    // Get or create session
    let session = await sessionManager.getSession(sessionId);
    if (!session) {
      session = await sessionManager.createSession(sessionId);
    }

    // Prepare multimodal message
    const messageContent = [
      {
        type: 'text',
        text: prompt
      },
      {
        type: 'image',
        media_type: validation.mediaType,
        data: validation.data
      }
    ];

    const userMessage = {
      role: 'user',
      content: messageContent
    };

    // Add user message to session
    await sessionManager.addMessage(sessionId, userMessage);

    // Get conversation history
    const conversationHistory = await sessionManager.getSessionHistory(sessionId, 10);

    // Send to Claude API for vision analysis
    const response = await claude.sendVisionMessage(conversationHistory, {
      model,
      maxTokens,
      temperature
    });

    // Add assistant response to session
    const assistantMessage = {
      role: 'assistant',
      content: response.content[0].text
    };
    await sessionManager.addMessage(sessionId, assistantMessage);

    // Extract image metadata for response
    const imageInfo = {
      mediaType: validation.mediaType,
      size: Math.round((validation.data.length * 3) / 4), // Approximate size in bytes
      format: validation.mediaType.split('/')[1]
    };

    return new Response(JSON.stringify({
      id: response.id,
      sessionId,
      analysis: response.content[0].text,
      imageInfo,
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
    console.error('Image upload error:', error);
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

// Helper function to handle image analysis with custom prompts
export async function analyzeImage(imageData, prompt, claudeAPI) {
  const validation = validateImageData(imageData);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const messageContent = [
    {
      type: 'text',
      text: prompt
    },
    {
      type: 'image',
      media_type: validation.mediaType,
      data: validation.data
    }
  ];

  const messages = [{
    role: 'user',
    content: messageContent
  }];

  return await claudeAPI.sendVisionMessage(messages);
}

// Helper function to compare multiple images
export async function compareImages(images, prompt, claudeAPI) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('At least one image is required');
  }

  const messageContent = [
    {
      type: 'text',
      text: prompt || "Compare these images and describe the differences and similarities."
    }
  ];

  // Add all images to the message
  for (const imageData of images) {
    const validation = validateImageData(imageData);
    if (!validation.valid) {
      throw new Error(`Invalid image: ${validation.error}`);
    }

    messageContent.push({
      type: 'image',
      media_type: validation.mediaType,
      data: validation.data
    });
  }

  const messages = [{
    role: 'user',
    content: messageContent
  }];

  return await claudeAPI.sendVisionMessage(messages);
}