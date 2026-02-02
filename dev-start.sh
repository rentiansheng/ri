#!/bin/bash

# Second Brain OS 开发环境启动脚本
# 自动设置代理并启动 Vite + Electron

echo "========================================"
echo "  Second Brain OS - 开发环境启动"
echo "========================================"
echo ""

# 设置代理
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897

echo "✅ 代理已配置:"
echo "   https_proxy = $https_proxy"
echo "   http_proxy  = $http_proxy"
echo ""

# 验证端口可用性
if lsof -i :5173 > /dev/null 2>&1; then
    echo "⚠️  端口 5173 已被占用，尝试释放..."
    lsof -ti :5173 | xargs kill -9 2>/dev/null
    sleep 2
fi

echo "🚀 启动开发服务器..."
echo ""
echo "========================================"
echo ""

# 启动开发服务器
npm run dev
