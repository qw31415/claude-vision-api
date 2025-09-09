@echo off
echo 正在上传Claude Vision API到GitHub...

cd /d "F:\claude working\claude-vision-api"

echo 检查Git配置...
git remote -v

echo 设置远程仓库URL（使用token认证）...
git remote set-url origin https://YOUR_GITHUB_TOKEN@github.com/qw31415/claude-vision-api.git

echo 确保分支为main...
git branch -M main

echo 推送到GitHub...
git push -u origin main

if %errorlevel% equ 0 (
    echo ✅ 成功上传到GitHub!
    echo 📍 仓库地址: https://github.com/qw31415/claude-vision-api
    echo.
    echo 🎯 下一步：
    echo 1. 访问GitHub仓库查看代码
    echo 2. 设置仓库topics（标签）
    echo 3. 部署到Cloudflare Workers
    echo.
    echo 部署命令：
    echo wrangler secret put ANTHROPIC_API_KEY
    echo wrangler deploy
) else (
    echo ❌ 上传失败，请检查网络连接
    echo 💡 你也可以手动在GitHub网页上上传文件
)

pause