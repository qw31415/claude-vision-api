import { ClaudeAPI } from '../utils/claude.js';
import { SessionManager } from '../utils/sessions.js';
import { corsHeaders } from '../middleware/cors.js';
import { generateSessionId } from '../middleware/auth.js';

export async function handleChatStream(request, env) {
  try {
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

    // Initialize Claude API and session manager
    const claude = new ClaudeAPI(env.ANTHROPIC_API_KEY);
    const sessionManager = new SessionManager(env.SESSIONS);

    // Get or create session
    let session = await sessionManager.getSession(sessionId);
    if (!session) {
      session = await sessionManager.createSession(sessionId);
    }

    // Prepare the message content (similar to chat handler)
    let messageContent;
    
    if (images.length > 0) {
      messageContent = [];
      
      if (message) {
        messageContent.push({
          type: 'text',
          text: message
        });
      }

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
      messageContent = message;
    }

    // Add user message to session
    const userMessage = { role: 'user', content: messageContent };
    await sessionManager.addMessage(sessionId, userMessage);

    // Prepare messages for Claude API
    const conversationHistory = await sessionManager.getSessionHistory(sessionId, 10);
    
    // Get streaming response from Claude
    const claudeResponse = await claude.sendMessage(conversationHistory, {
      model,
      maxTokens,
      temperature,
      systemPrompt,
      stream: true
    });

    // Create a readable stream to handle the SSE response
    let fullResponse = '';
    const readable = new ReadableStream({
      start(controller) {
        const reader = claudeResponse.body.getReader();
        const decoder = new TextDecoder();

        async function pump() {
          try {
            const { done, value } = await reader.read();
            
            if (done) {
              // Send final message and close
              controller.enqueue(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
              controller.close();
              
              // Save complete response to session
              if (fullResponse) {
                const assistantMessage = {
                  role: 'assistant',
                  content: fullResponse
                };
                await sessionManager.addMessage(sessionId, assistantMessage);
              }
              return;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                
                if (data === '[DONE]') {
                  controller.enqueue(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  
                  if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.text) {
                    fullResponse += parsed.delta.text;
                    
                    // Forward the streaming chunk
                    controller.enqueue(`data: ${JSON.stringify({
                      type: 'content',
                      text: parsed.delta.text,
                      sessionId
                    })}\n\n`);
                  } else if (parsed.type === 'message_start') {
                    controller.enqueue(`data: ${JSON.stringify({
                      type: 'start',
                      sessionId,
                      model: parsed.message?.model
                    })}\n\n`);
                  }
                } catch (parseError) {
                  console.error('Failed to parse streaming data:', parseError);
                }
              }
            }

            return pump();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.enqueue(`data: ${JSON.stringify({
              type: 'error',
              error: error.message,
              sessionId
            })}\n\n`);
            controller.close();
          }
        }

        return pump();
      }
    });

    // Return SSE response
    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Stream request error:', error);
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