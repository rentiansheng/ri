#!/bin/bash

# Webhook 通知诊断脚本
# 自动检查配置、测试连接、生成诊断报告

set -e

echo "🔍 Webhook 通知诊断工具"
echo "========================"
echo ""

CONFIG_FILE=~/Library/Application\ Support/secondbrain-app/config.json

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查函数
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

# 1. 检查配置文件
echo "📋 步骤 1: 检查配置文件"
echo "----------------------------"

if [ ! -f "$CONFIG_FILE" ]; then
  check_failed "配置文件不存在: $CONFIG_FILE"
  exit 1
fi

check_passed "配置文件存在"

# 检查 JSON 格式
if ! cat "$CONFIG_FILE" | jq . > /dev/null 2>&1; then
  check_failed "配置文件 JSON 格式错误"
  echo "请修复 JSON 格式后重试"
  exit 1
fi

check_passed "JSON 格式正确"

# 2. 检查通知配置
echo ""
echo "🔔 步骤 2: 检查通知配置"
echo "----------------------------"

NOTIFICATION_ENABLED=$(cat "$CONFIG_FILE" | jq -r '.notification.enabled // false')
if [ "$NOTIFICATION_ENABLED" = "true" ]; then
  check_passed "通知总开关已启用"
else
  check_failed "通知总开关未启用 (notification.enabled = false)"
  exit 1
fi

# 3. 检查各渠道配置
echo ""
echo "📡 步骤 3: 检查 Webhook 渠道"
echo "----------------------------"

CHANNELS=("wecom" "dingtalk" "slack" "discord" "telegram")
ENABLED_CHANNELS=()

for channel in "${CHANNELS[@]}"; do
  enabled=$(cat "$CONFIG_FILE" | jq -r ".notification.channels.$channel.enabled // false")
  webhookUrl=$(cat "$CONFIG_FILE" | jq -r ".notification.channels.$channel.webhookUrl // \"\"")
  
  if [ "$enabled" = "true" ]; then
    if [ -n "$webhookUrl" ] && [ "$webhookUrl" != "null" ] && [ "$webhookUrl" != "" ]; then
      check_passed "$channel: 已启用且已配置 URL"
      ENABLED_CHANNELS+=("$channel")
      
      # 显示 URL（隐藏敏感部分）
      masked_url=$(echo "$webhookUrl" | sed -E 's/(key=|token=|access_token=)[^&]+/\1***/g')
      check_info "  URL: $masked_url"
    else
      check_warning "$channel: 已启用但未配置 webhookUrl"
    fi
  else
    check_info "$channel: 未启用"
  fi
done

if [ ${#ENABLED_CHANNELS[@]} -eq 0 ]; then
  check_failed "没有已启用且配置完整的 Webhook 渠道"
  echo ""
  echo "📝 请在配置文件中启用并配置至少一个渠道："
  echo "   $CONFIG_FILE"
  echo ""
  echo "示例配置 (企业微信):"
  echo '  "wecom": {'
  echo '    "enabled": true,'
  echo '    "webhookUrl": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY"'
  echo '  }'
  exit 1
fi

# 4. 检查 RI 应用状态
echo ""
echo "🖥️  步骤 4: 检查 RI 应用状态"
echo "----------------------------"

if pgrep -f "secondbrain-app" > /dev/null; then
  check_passed "RI 应用正在运行"
  
  # 检查配置文件修改时间
  CONFIG_MTIME=$(stat -f %m "$CONFIG_FILE" 2>/dev/null || stat -c %Y "$CONFIG_FILE" 2>/dev/null)
  CURRENT_TIME=$(date +%s)
  TIME_DIFF=$((CURRENT_TIME - CONFIG_MTIME))
  
  if [ $TIME_DIFF -lt 300 ]; then
    check_warning "配置文件最近被修改 (${TIME_DIFF}秒前)"
    check_warning "如果刚修改配置，请重启 RI 应用使配置生效！"
    echo ""
    echo "重启命令:"
    echo "  pkill -f 'secondbrain-app' && sleep 2 && open -a 'Second Brain OS'"
  fi
else
  check_warning "RI 应用未运行"
  echo ""
  echo "启动命令:"
  echo "  open -a 'Second Brain OS'"
fi

# 5. 测试 Webhook 连接
echo ""
echo "🧪 步骤 5: 测试 Webhook 连接"
echo "----------------------------"

for channel in "${ENABLED_CHANNELS[@]}"; do
  webhookUrl=$(cat "$CONFIG_FILE" | jq -r ".notification.channels.$channel.webhookUrl")
  
  echo ""
  check_info "测试 $channel 渠道..."
  
  case $channel in
    wecom)
      response=$(curl -s -X POST "$webhookUrl" \
        -H "Content-Type: application/json" \
        -d '{"msgtype":"markdown","markdown":{"content":"**测试通知**\n\n来自诊断脚本的测试消息"}}' \
        2>&1)
      ;;
    dingtalk)
      response=$(curl -s -X POST "$webhookUrl" \
        -H "Content-Type: application/json" \
        -d '{"msgtype":"text","text":{"content":"测试通知: 来自诊断脚本"}}' \
        2>&1)
      ;;
    slack)
      response=$(curl -s -X POST "$webhookUrl" \
        -H "Content-Type: application/json" \
        -d '{"text":"测试通知: 来自诊断脚本"}' \
        2>&1)
      ;;
    discord)
      response=$(curl -s -X POST "$webhookUrl" \
        -H "Content-Type: application/json" \
        -d '{"content":"测试通知: 来自诊断脚本"}' \
        2>&1)
      ;;
    telegram)
      botToken=$(cat "$CONFIG_FILE" | jq -r ".notification.channels.$channel.botToken")
      chatId=$(cat "$CONFIG_FILE" | jq -r ".notification.channels.$channel.chatId")
      response=$(curl -s -X POST "https://api.telegram.org/bot$botToken/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\":\"$chatId\",\"text\":\"测试通知: 来自诊断脚本\"}" \
        2>&1)
      ;;
  esac
  
  # 检查响应
  if echo "$response" | grep -q "errcode.*0" || echo "$response" | grep -q "ok.*true" || echo "$response" | grep -q "\"ok\""; then
    check_passed "$channel 连接测试成功！请检查对应平台是否收到消息"
  else
    check_failed "$channel 连接测试失败"
    echo "响应内容: $response"
  fi
done

# 6. 生成诊断报告
echo ""
echo "📊 诊断报告"
echo "========================"
echo ""
echo "配置文件: $CONFIG_FILE"
echo "通知总开关: $NOTIFICATION_ENABLED"
echo "已启用渠道: ${ENABLED_CHANNELS[@]:-无}"
echo ""

if [ ${#ENABLED_CHANNELS[@]} -gt 0 ]; then
  echo "✅ 配置检查通过"
  echo ""
  echo "📝 下一步操作："
  echo "  1. 确认 RI 应用已重启（如果刚修改配置）"
  echo "  2. 打开开发者工具 (Cmd+Alt+I) 查看 Console 日志"
  echo "  3. 触发一个通知（运行测试脚本或让 OpenCode 返回错误）"
  echo "  4. 查找日志中的 [NotificationManager] 和 [WeComChannel] 信息"
  echo ""
  echo "测试脚本:"
  echo "  ./scripts/test-webhook-notification.sh"
  echo ""
  echo "查看日志:"
  echo "  打开 RI → 按 Cmd+Alt+I → Console 标签"
  echo ""
else
  echo "❌ 配置检查未通过"
  echo ""
  echo "请参考调试指南:"
  echo "  cat WEBHOOK-NOTIFICATION-DEBUG.md"
fi

echo "========================"
echo ""
