# 2API 配置指南

如果你使用2API而不是Anthropic官方API，请按照以下步骤配置：

## 🔧 配置步骤

### 1. 设置2API环境变量

```bash
# 设置你的2API基础URL
wrangler secret put API_BASE_URL
# 输入: https://your-2api-endpoint.com/v1/messages

# 设置你的2API密钥
wrangler secret put API_KEY
# 输入: your-2api-key

# （可选）设置允许访问你API的客户端密钥
wrangler secret put ALLOWED_API_KEYS
# 输入: key1,key2,key3
```

### 2. 创建KV命名空间

```bash
# 创建会话存储
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview

# 更新wrangler.toml中的ID
```

### 3. 部署

```bash
wrangler deploy
```

## 🔑 API密钥说明

### 服务端API密钥（必需）
- **API_KEY**: 你的2API提供商给你的密钥，用于调用Claude API
- **API_BASE_URL**: 2API的端点URL，如果不设置则使用官方API

### 客户端API密钥（可选）
- **ALLOWED_API_KEYS**: 允许访问你部署的API的客户端密钥
- 如果不设置，任何人都可以访问（不推荐生产环境）

## 🚀 使用示例

部署后，你的客户端可以这样调用：

```javascript
const response = await fetch('https://your-worker.workers.dev/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-client-api-key'  // ALLOWED_API_KEYS中的一个
  },
  body: JSON.stringify({
    message: '你好！',
    images: ['data:image/jpeg;base64,...']  // 可选，支持图片
  })
});
```

## 📋 完整流程

1. **你的应用** ➜ 发送请求到 **Cloudflare Workers** 
2. **Workers** ➜ 使用你的2API密钥调用 **2API服务**
3. **2API服务** ➜ 转发请求到 **Claude API**
4. **响应原路返回**

这样你就有了自己的Claude API代理服务！🎉