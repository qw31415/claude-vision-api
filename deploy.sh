#!/bin/bash

# Claude Vision API 部署脚本
# 自动化部署到Cloudflare Workers

echo "🚀 开始部署 Claude Vision API..."

# 检查wrangler是否已安装
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI 未安装，请先安装: npm install -g wrangler"
    exit 1
fi

# 检查是否已登录
if ! wrangler whoami &> /dev/null; then
    echo "🔑 请先登录 Cloudflare: wrangler login"
    exit 1
fi

echo "✅ 环境检查通过"

# 检查必需的环境变量
echo "🔧 检查环境变量配置..."

if ! wrangler secret list | grep -q "ANTHROPIC_API_KEY"; then
    echo "❌ 缺少 ANTHROPIC_API_KEY，请运行: wrangler secret put ANTHROPIC_API_KEY"
    echo "   获取API密钥：https://console.anthropic.com/"
    exit 1
fi

echo "✅ API密钥配置正确"

# 创建KV命名空间（如果不存在）
echo "📦 检查KV命名空间..."

# 检查是否已有KV配置
if ! grep -q "kv_namespaces" wrangler.toml; then
    echo "🆕 创建新的KV命名空间..."
    
    # 创建生产KV命名空间
    PROD_KV=$(wrangler kv:namespace create "SESSIONS" 2>/dev/null | grep -o 'id = "[^"]*"' | head -1)
    PREVIEW_KV=$(wrangler kv:namespace create "SESSIONS" --preview 2>/dev/null | grep -o 'id = "[^"]*"' | head -1)
    
    if [ ! -z "$PROD_KV" ] && [ ! -z "$PREVIEW_KV" ]; then
        echo "✅ KV命名空间创建成功"
        echo "📝 请手动更新 wrangler.toml 中的以下配置："
        echo "   生产环境: $PROD_KV"  
        echo "   预览环境: $PREVIEW_KV"
        echo ""
        echo "⚠️  请编辑 wrangler.toml 文件并按任意键继续..."
        read -n 1 -s
    fi
else
    echo "✅ KV命名空间配置已存在"
fi

# 构建和部署
echo "🔨 开始构建和部署..."

# 部署到生产环境
if wrangler deploy; then
    echo "✅ 部署成功！"
    
    # 获取部署的URL
    WORKER_URL=$(wrangler whoami | grep -o "https://.*\.workers\.dev" | head -1)
    
    if [ ! -z "$WORKER_URL" ]; then
        echo ""
        echo "🎉 部署完成！您的API现在可以访问："
        echo "   📍 API地址: ${WORKER_URL}"
        echo "   🔍 健康检查: ${WORKER_URL}/api/health"
        echo ""
    fi
    
    echo "📚 API文档和使用示例请查看 README.md"
    echo ""
    echo "🔑 重要提醒："
    echo "   1. 设置客户端API密钥用于访问控制"
    echo "   2. 配置CORS允许的域名"
    echo "   3. 监控使用情况和成本"
    
else
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi

echo ""
echo "🎯 后续步骤："
echo "   1. 测试API端点功能"
echo "   2. 配置自定义域名（可选）"
echo "   3. 设置监控和告警"
echo "   4. 查看实时日志: wrangler tail"