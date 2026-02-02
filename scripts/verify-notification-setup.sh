#!/bin/bash

# 完整的通知功能验证脚本
# 验证 OpenCode 插件、RI 配置和通知系统

set -e

echo "🔍 Second Brain OS 通知系统完整验证"
echo "==========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

check_passed() {
  echo -e "${GREEN}✅ $1${NC}"
}

check_failed() {
  echo -e "${RED}❌ $1${NC}"
}

check_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

check_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# 1. 检查 OpenCode 插件安装
echo "📦 步骤 1: 检查 OpenCode 插件"
echo "----------------------------"

if [ -d ~/.config/opencode/plugins/opencode-ri-notification ]; then
  check_passed "插件已安装"
  
  # 检查插件文件
  if [ -f ~/.config/opencode/plugins/opencode-ri-notification/index.ts ]; then
    check_passed "插件入口文件存在"
  else
    check_failed "插件入口文件缺失"
  fi
  
  # 检查插件库文件
  if [ -d ~/.config/opencode/plugins/opencode-ri-notification/lib ]; then
    check_passed "插件库文件存在"
  else
    check_failed "插件库文件缺失"
  fi
else
  check_failed "插件未安装"
  echo ""
  echo "请运行以下命令安装插件:"
  echo "  cd /Users/reage/goDev/src/om/opencode-ri-notification"
  echo "  ./install.sh"
  exit 1
fi

# 2. 检查 OpenCode 配置
echo ""
echo "⚙️  步骤 2: 检查 OpenCode 配置"
echo "----------------------------"

if [ -f ~/.config/opencode/opencode.json ]; then
  check_passed "OpenCode 配置文件存在"
  
  # 检查 JSON 格式
  if cat ~/.config/opencode/opencode.json | jq '.' > /dev/null 2>&1; then
    check_passed "JSON 格式正确"
  else
    check_failed "JSON 格式错误"
    exit 1
  fi
  
  # 检查插件注册
  if cat ~/.config/opencode/opencode.json | jq -e '.plugins[]' 2>/dev/null | grep -q "opencode-ri-notification"; then
    check_passed "插件已注册"
  else
    check_warning "插件未在配置中注册"
    echo ""
    echo "请在 ~/.config/opencode/opencode.json 中添加:"
    echo '  "plugins": ["opencode-ri-notification"]'
  fi
  
  # 检查插件配置
  if cat ~/.config/opencode/opencode.json | jq -e '.riNotification.enabled' 2>/dev/null | grep -q "true"; then
    check_passed "插件已启用"
  else
    check_warning "插件配置中未启用"
  fi
else
  check_failed "OpenCode 配置文件不存在"
  exit 1
fi

# 3. 检查 RI 配置
echo ""
echo "🖥️  步骤 3: 检查 RI 配置"
echo "----------------------------"

RI_CONFIG=~/Library/Application\ Support/secondbrain-app/config.json

if [ -f "$RI_CONFIG" ]; then
  check_passed "RI 配置文件存在"
  
  # 检查 OpenCode 集成是否启用
  if cat "$RI_CONFIG" | jq -e '.opencode.enabled' 2>/dev/null | grep -q "true"; then
    check_passed "OpenCode 集成已启用"
  else
    check_failed "OpenCode 集成未启用"
    echo ""
    echo "需要在 RI 配置中启用 OpenCode:"
    echo "  \"opencode\": { \"enabled\": true }"
    exit 1
  fi
  
  # 检查通知系统
  if cat "$RI_CONFIG" | jq -e '.notification.enabled' 2>/dev/null | grep -q "true"; then
    check_passed "通知系统已启用"
  else
    check_failed "通知系统未启用"
  fi
  
  # 检查企业微信配置
  if cat "$RI_CONFIG" | jq -e '.notification.channels.wecom.enabled' 2>/dev/null | grep -q "true"; then
    check_passed "企业微信通知已启用"
    
    webhookUrl=$(cat "$RI_CONFIG" | jq -r '.notification.channels.wecom.webhookUrl' 2>/dev/null)
    if [ -n "$webhookUrl" ] && [ "$webhookUrl" != "null" ]; then
      masked_url=$(echo "$webhookUrl" | sed -E 's/key=[^&]+/key=***/g')
      check_info "Webhook URL: $masked_url"
    else
      check_warning "Webhook URL 未配置"
    fi
  else
    check_warning "企业微信通知未启用"
  fi
else
  check_failed "RI 配置文件不存在"
  exit 1
fi

# 4. 检查环境变量
echo ""
echo "🌍 步骤 4: 检查环境变量"
echo "----------------------------"

if [ "$RI_TERMINAL" = "true" ]; then
  check_passed "在 RI 终端中运行"
  check_info "SESSION_ID: ${RI_SESSION_ID:-未设置}"
  check_info "SESSION_NAME: ${RI_SESSION_NAME:-未设置}"
else
  check_warning "不在 RI 终端中运行"
  check_info "此验证脚本在任何终端都可运行"
  check_info "但插件只在 RI 终端中生效"
fi

# 5. 检查 RI 应用状态
echo ""
echo "🔄 步骤 5: 检查 RI 应用状态"
echo "----------------------------"

if pgrep -f "secondbrain-app" > /dev/null; then
  check_passed "RI 应用正在运行"
  
  # 检查配置修改时间
  CONFIG_MTIME=$(stat -f %m "$RI_CONFIG" 2>/dev/null || stat -c %Y "$RI_CONFIG" 2>/dev/null)
  CURRENT_TIME=$(date +%s)
  TIME_DIFF=$((CURRENT_TIME - CONFIG_MTIME))
  
  if [ $TIME_DIFF -lt 60 ]; then
    check_warning "配置文件刚被修改 (${TIME_DIFF}秒前)"
    check_warning "⚠️  需要重启 RI 应用使配置生效！"
    echo ""
    echo "重启命令:"
    echo "  pkill -f 'secondbrain-app' && sleep 2 && open -a 'Second Brain OS'"
  else
    check_info "配置修改于 ${TIME_DIFF} 秒前"
  fi
else
  check_warning "RI 应用未运行"
  echo ""
  echo "启动命令:"
  echo "  open -a 'Second Brain OS'"
fi

# 6. 测试 Webhook 连接
echo ""
echo "🧪 步骤 6: 测试企业微信 Webhook"
echo "----------------------------"

webhookUrl=$(cat "$RI_CONFIG" | jq -r '.notification.channels.wecom.webhookUrl' 2>/dev/null)

if [ -n "$webhookUrl" ] && [ "$webhookUrl" != "null" ] && [ "$webhookUrl" != "" ]; then
  check_info "发送测试消息到企业微信..."
  
  response=$(curl -s -X POST "$webhookUrl" \
    -H "Content-Type: application/json" \
    -d '{"msgtype":"markdown","markdown":{"content":"**✅ 验证脚本测试**\n\n配置验证完成，Webhook 连接正常"}}' \
    2>&1)
  
  if echo "$response" | grep -q '"errcode":0'; then
    check_passed "Webhook 连接测试成功"
    check_info "请检查企业微信群是否收到消息"
  else
    check_failed "Webhook 连接测试失败"
    echo "响应: $response"
  fi
else
  check_warning "Webhook URL 未配置，跳过连接测试"
fi

# 7. 生成验证报告
echo ""
echo "📊 验证报告"
echo "==========================================="
echo ""

echo "OpenCode 插件:"
echo "  安装位置: ~/.config/opencode/plugins/opencode-ri-notification"
echo "  配置文件: ~/.config/opencode/opencode.json"
echo ""

echo "RI 配置:"
echo "  配置文件: ~/Library/Application Support/secondbrain-app/config.json"
echo "  OpenCode: $(cat "$RI_CONFIG" | jq -r '.opencode.enabled')"
echo "  通知系统: $(cat "$RI_CONFIG" | jq -r '.notification.enabled')"
echo "  企业微信: $(cat "$RI_CONFIG" | jq -r '.notification.channels.wecom.enabled')"
echo ""

echo "✅ 配置验证完成！"
echo ""
echo "📝 下一步操作:"
echo "  1. 如果配置刚修改，重启 RI 应用"
echo "  2. 打开 RI 应用的开发者工具 (Cmd+Alt+I)"
echo "  3. 运行通知测试: ./scripts/test-webhook-notification.sh"
echo "  4. 查看 Console 日志中的 [NotificationManager] 信息"
echo ""
echo "🔗 相关文档:"
echo "  - 快速开始: cat WEBHOOK-QUICK-START.md"
echo "  - 调试指南: cat WEBHOOK-NOTIFICATION-DEBUG.md"
echo "  - 文档索引: cat WEBHOOK-DOCS-INDEX.md"
echo ""

echo "==========================================="
echo ""
