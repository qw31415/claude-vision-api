# Claude Vision API - Cloudflare Workers

一个完整的Claude AI API封装，支持文本对话和图像分析功能，部署在Cloudflare Workers上。

## 功能特性

- ✅ **文本对话**: 支持与Claude AI进行自然语言对话
- ✅ **视觉分析**: 支持图片上传和分析（支持JPEG、PNG、GIF、WebP格式）
- ✅ **多模态对话**: 在同一对话中混合文本和图片
- ✅ **流式响应**: 支持Server-Sent Events实时流式响应
- ✅ **会话管理**: 自动管理对话历史和上下文
- ✅ **CORS支持**: 支持跨域请求
- ✅ **API密钥验证**: 安全的访问控制
- ✅ **错误处理**: 完善的错误处理和日志记录

## API端点

### 1. 健康检查
```
GET /api/health
```

### 2. 文本对话
```
POST /api/chat
Content-Type: application/json
X-API-Key: your-api-key

{
  "message": "你好，请介绍一下你自己",
  "sessionId": "optional-session-id",
  "model": "claude-3-5-sonnet-20241022",
  "maxTokens": 4096,
  "temperature": 0.7,
  "systemPrompt": "你是一个有帮助的AI助手"
}
```

### 3. 流式对话
```
POST /api/chat/stream
Content-Type: application/json
X-API-Key: your-api-key

{
  "message": "写一首关于春天的诗",
  "sessionId": "optional-session-id"
}
```

### 4. 多模态对话（文本+图片）
```
POST /api/chat/multimodal
Content-Type: application/json
X-API-Key: your-api-key

{
  "message": "分析这张图片中的内容",
  "images": ["data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."],
  "sessionId": "optional-session-id"
}
```

### 5. 图片上传和分析
```
POST /api/image/upload
Content-Type: application/json
X-API-Key: your-api-key

{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "prompt": "请详细描述这张图片的内容",
  "sessionId": "optional-session-id"
}
```

## 部署说明

### 1. 环境准备

首先确保已安装Node.js和Wrangler CLI：

```bash
npm install -g wrangler
```

### 2. 配置环境变量

```bash
# 设置Anthropic API密钥
wrangler secret put ANTHROPIC_API_KEY

# 设置允许的API密钥（可选，用于访问控制）
wrangler secret put ALLOWED_API_KEYS
```

### 3. 创建KV命名空间

```bash
# 创建生产环境KV命名空间
wrangler kv:namespace create "SESSIONS"

# 创建预览环境KV命名空间  
wrangler kv:namespace create "SESSIONS" --preview
```

将返回的命名空间ID更新到`wrangler.toml`文件中。

### 4. 部署

```bash
# 开发环境
npm run dev

# 生产部署
npm run deploy
```

## 使用示例

### JavaScript客户端示例

```javascript
class ClaudeVisionClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async chat(message, sessionId = null) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({ message, sessionId })
    });
    
    return await response.json();
  }

  async analyzeImage(imageBase64, prompt = "描述这张图片") {
    const response = await fetch(`${this.baseUrl}/api/image/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({ 
        image: imageBase64, 
        prompt 
      })
    });
    
    return await response.json();
  }

  async streamChat(message, onData, sessionId = null) {
    const response = await fetch(`${this.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({ message, sessionId })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\\n').filter(line => line.startsWith('data: '));
      
      for (const line of lines) {
        const data = JSON.parse(line.slice(6));
        onData(data);
      }
    }
  }
}

// 使用示例
const client = new ClaudeVisionClient('https://your-worker.your-domain.workers.dev', 'your-api-key');

// 文本对话
const response = await client.chat('你好，Claude！');
console.log(response.message);

// 图片分析
const imageAnalysis = await client.analyzeImage('data:image/jpeg;base64,...');
console.log(imageAnalysis.analysis);

// 流式对话
await client.streamChat('写一首诗', (data) => {
  if (data.type === 'content') {
    process.stdout.write(data.text);
  }
});
```

### Python客户端示例

```python
import requests
import json
import base64

class ClaudeVisionClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {
            'Content-Type': 'application/json',
            'X-API-Key': api_key
        }
    
    def chat(self, message, session_id=None):
        payload = {'message': message}
        if session_id:
            payload['sessionId'] = session_id
            
        response = requests.post(
            f'{self.base_url}/api/chat',
            headers=self.headers,
            json=payload
        )
        return response.json()
    
    def analyze_image_file(self, image_path, prompt="描述这张图片"):
        # 读取并编码图片
        with open(image_path, 'rb') as f:
            image_data = base64.b64encode(f.read()).decode()
        
        # 检测图片类型
        if image_path.lower().endswith('.png'):
            image_data = f"data:image/png;base64,{image_data}"
        else:
            image_data = f"data:image/jpeg;base64,{image_data}"
        
        response = requests.post(
            f'{self.base_url}/api/image/upload',
            headers=self.headers,
            json={
                'image': image_data,
                'prompt': prompt
            }
        )
        return response.json()

# 使用示例
client = ClaudeVisionClient('https://your-worker.your-domain.workers.dev', 'your-api-key')

# 文本对话
result = client.chat('你好，Claude！')
print(result['message'])

# 图片分析
analysis = client.analyze_image_file('path/to/image.jpg', '这张图片里有什么？')
print(analysis['analysis'])
```

## 图片格式支持

- **JPEG** (.jpg, .jpeg)
- **PNG** (.png) 
- **GIF** (.gif)
- **WebP** (.webp)

### 图片要求
- 最大文件大小：20MB
- 图片必须使用base64编码
- 格式：`data:image/[type];base64,[data]`

## 错误处理

API使用标准HTTP状态码：

- `200` - 成功
- `400` - 请求错误（缺少参数、无效图片等）
- `401` - 未授权（无效API密钥）
- `500` - 服务器内部错误

错误响应格式：
```json
{
  "error": "错误类型",
  "message": "具体错误描述"
}
```

## 会话管理

- 会话自动过期时间：24小时
- 每个会话保留最近50条消息
- 会话ID可以自定义或由系统自动生成

## 限制说明

- 单次请求最大tokens：4096（可配置）
- 图片最大大小：20MB
- 会话历史：最多50条消息
- KV存储限制：遵循Cloudflare Workers KV限制

## 安全建议

1. 使用强API密钥并定期轮换
2. 配置CORS白名单限制访问来源
3. 监控API使用情况防止滥用
4. 定期检查和更新依赖项

## 监控和日志

使用Wrangler查看日志：

```bash
# 实时查看日志
wrangler tail

# 查看特定时间范围的日志
wrangler tail --since 2024-01-01T00:00:00Z
```

## 故障排除

### 常见问题

1. **CORS错误**：检查请求头和CORS配置
2. **API密钥错误**：确认环境变量设置正确
3. **图片上传失败**：检查图片格式和大小
4. **会话丢失**：检查KV命名空间配置

### 调试模式

开发环境下可以查看详细错误信息：

```bash
wrangler dev --local
```