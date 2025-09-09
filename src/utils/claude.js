// 2API配置 - 可通过环境变量自定义
const CLAUDE_API_URL = process.env.API_BASE_URL || 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const VISION_MODEL = 'claude-3-5-sonnet-20241022';

export class ClaudeAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async sendMessage(messages, options = {}) {
    const {
      model = DEFAULT_MODEL,
      maxTokens = 4096,
      temperature = 0.7,
      stream = false,
      systemPrompt = null
    } = options;

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01'
    };

    const body = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: this.formatMessages(messages),
      stream
    };

    // Add system prompt if provided
    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} ${error}`);
    }

    if (stream) {
      return response;
    }

    return await response.json();
  }

  async sendVisionMessage(messages, options = {}) {
    const {
      model = VISION_MODEL,
      maxTokens = 4096,
      temperature = 0.7,
      stream = false,
      systemPrompt = null
    } = options;

    return this.sendMessage(messages, {
      model,
      maxTokens,
      temperature,
      stream,
      systemPrompt
    });
  }

  formatMessages(messages) {
    return messages.map(message => {
      if (typeof message.content === 'string') {
        return {
          role: message.role,
          content: message.content
        };
      }

      // Handle multimodal content (text + images)
      if (Array.isArray(message.content)) {
        return {
          role: message.role,
          content: message.content.map(item => {
            if (item.type === 'text') {
              return {
                type: 'text',
                text: item.text
              };
            }
            if (item.type === 'image') {
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: item.media_type || 'image/jpeg',
                  data: item.data
                }
              };
            }
            return item;
          })
        };
      }

      return message;
    });
  }

  async processStreamResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return new ReadableStream({
      start(controller) {
        function pump() {
          return reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  controller.enqueue(`data: ${JSON.stringify(parsed)}\n\n`);
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }

            return pump();
          });
        }

        return pump();
      }
    });
  }
}

export function validateImageData(imageData) {
  // Check if it's a valid base64 image
  const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
  if (!base64Regex.test(imageData)) {
    return { valid: false, error: 'Invalid image format. Must be base64 encoded image.' };
  }

  // Extract media type and base64 data
  const match = imageData.match(/^data:image\/([^;]+);base64,(.+)$/);
  if (!match) {
    return { valid: false, error: 'Invalid base64 image format.' };
  }

  const [, mediaType, base64Data] = match;
  
  // Check file size (approximate)
  const sizeInBytes = (base64Data.length * 3) / 4;
  const maxSizeInMB = 20; // Anthropic's limit
  if (sizeInBytes > maxSizeInMB * 1024 * 1024) {
    return { valid: false, error: `Image too large. Maximum size is ${maxSizeInMB}MB.` };
  }

  return { 
    valid: true, 
    mediaType: `image/${mediaType}`, 
    data: base64Data 
  };
}