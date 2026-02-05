#!/bin/bash

# 测试 Webhook 通知功能
# 发送各种类型的通知到配置的 webhook

set -e

echo "🔔 Webhook 通知测试脚本"
echo "========================"
echo ""

# 检查配置文件
CONFIG_FILE=~/Library/Application\ Support/secondbrain-app/config.json

if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ 错误: 配置文件不存在"
  echo "   路径: $CONFIG_FILE"
  exit 1
fi

echo "✅ 配置文件: $CONFIG_FILE"
echo ""

# 显示当前配置的 webhook 渠道
echo "📋 当前配置的 Webhook 渠道:"
echo "----------------------------"

# 提取并显示各渠道状态
for channel in slack discord telegram dingtalk wecom; do
  enabled=$(cat "$CONFIG_FILE" | grep -A 10 "\"$channel\"" | grep "\"enabled\"" | head -1 | awk -F: '{print $2}' | tr -d ' ,')
  if [ "$enabled" = "true" ]; then
    echo "  ✅ $channel: 已启用"
  else
    echo "  ⚪ $channel: 未启用"
  fi
done

echo ""
echo "🧪 发送测试通知..."
echo "----------------------------"

# 测试 1: Info 通知
echo ""
echo "📘 测试 1: 信息通知"
echo "__OM_NOTIFY:info:这是一条测试信息通知__"
sleep 2

# 测试 2: Success 通知
echo ""
echo "✅ 测试 2: 成功通知"
echo "__OM_NOTIFY:success:任务执行成功！__"
sleep 2

# 测试 3: Warning 通知
echo ""
echo "⚠️  测试 3: 警告通知"
echo "__OM_NOTIFY:warning:这是一条警告信息__"
sleep 2

# 测试 4: Error 通知
echo ""
echo "❌ 测试 4: 错误通知"
echo "__OM_NOTIFY:error:API 返回 Forbidden - 这是一个测试错误__"
sleep 2

echo ""
echo "✅ 测试完成！"
echo ""
echo "📊 检查结果:"
echo "----------------------------"
echo "  1. 查看 RI 应用右上角是否有桌面通知"
echo "  2. 查看企业微信群是否收到消息"
echo "  3. 如果企业微信没收到消息，请:"
echo "     - 检查 RI 应用是否已重启"
echo "     - 打开开发者工具 (Cmd+Alt+I) 查看 Console 日志"
echo "     - 查找 [NotificationManager] 相关的错误信息"
echo ""
echo "💡 提示: 如果修改了配置文件，必须重启 RI 应用才能生效！"
echo ""
