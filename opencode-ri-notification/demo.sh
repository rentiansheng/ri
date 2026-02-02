#!/bin/bash
# OpenCode RI Notification Plugin - 一键演示脚本

echo "╔════════════════════════════════════════════╗"
echo "║  OpenCode RI Notification Plugin Demo     ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# 1. 安装插件
echo "📦 步骤 1: 安装插件..."
cd /Users/reage/goDev/src/om/opencode-ri-notification
./install.sh
echo ""

# 2. 重建 RI
echo "🔨 步骤 2: 重新构建 RI（注入环境变量）..."
cd /Users/reage/goDev/src/om
npm run build
echo ""

# 3. 启动 RI
echo "🚀 步骤 3: 启动 RI..."
echo ""
echo "请手动执行以下命令:"
echo "  cd /Users/reage/goDev/src/om"
echo "  npm run dev"
echo ""
echo "然后在 RI 终端中："
echo "  1. 运行: env | grep RI_"
echo "  2. 测试: echo '__OM_NOTIFY:info:测试通知__'"
echo "  3. 启动: opencode"
echo ""
echo "✅ 安装完成！查看完整文档:"
echo "   cat ~/.config/opencode/plugins/opencode-ri-notification/QUICKSTART.md"
