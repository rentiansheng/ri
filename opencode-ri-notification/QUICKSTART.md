# 🚀 OpenCode RI Notification Plugin - 快速开始

## 1. 安装插件

```bash
cd /Users/reage/goDev/src/om/opencode-ri-notification
./install.sh
```

这将插件安装到 `~/.config/opencode/plugins/opencode-ri-notification/`

## 2. 重新构建并启动 RI

```bash
cd /Users/reage/goDev/src/om
npm run build
npm run dev
```

## 3. 测试环境变量

在 RI 终端中运行：

```bash
env | grep RI_
```

预期输出：
```
RI_TERMINAL=true
RI_SESSION_ID=<your-session-id>
RI_SESSION_NAME=<your-session-name>
```

## 4. 测试 RI 通知系统

```bash
echo '__OM_NOTIFY:info:测试通知__'
```

你应该看到一个通知弹窗。

## 5. 测试完整的插件功能

```bash
cd ~/.config/opencode/plugins/opencode-ri-notification
./test-plugin.sh
```

选择交互式菜单测试各种场景。

## 6. 在 RI 中使用 OpenCode

```bash
# 确保 OpenCode 已安装
which opencode

# 在 RI 终端中启动
opencode

# OpenCode 会自动检测 RI 环境并激活插件
```

## 通知触发示例

### 任务完成
当 OpenCode 完成响应后，会自动发送"任务已完成"通知。

### 构建命令
```bash
npm run build
# 完成后自动通知
```

### 测试命令
```bash
npm test
# 完成后自动通知
```

### 长时间命令
```bash
sleep 35
# 超过 30 秒后完成会自动通知
```

## 配置自定义

编辑 `~/.config/opencode/opencode.json`:

```jsonc
{
  "riNotification": {
    "enabled": true,
    "events": {
      "sessionIdle": true,
      "buildComplete": true,
      "testComplete": true
    }
  }
}
```

## 故障排查

### 问题: 没有收到通知

**检查步骤**:

1. 确认环境变量:
   ```bash
   echo $RI_TERMINAL  # 应该是 "true"
   ```

2. 测试 RI 通知:
   ```bash
   echo '__OM_NOTIFY:info:测试__'
   ```

3. 检查 OpenCode 插件:
   ```bash
   ls -la ~/.config/opencode/plugins/opencode-ri-notification/
   ```

### 问题: OpenCode 未找到

```bash
# 安装 OpenCode
curl -fsSL https://opencode.ai/install | bash

# 或使用 npm
npm install -g opencode-ai
```

## 下一步

- 📖 阅读完整文档: `cat ~/.config/opencode/plugins/opencode-ri-notification/README.md`
- 🔧 自定义配置: `vim ~/.config/opencode/opencode.json`
- 🐛 提交问题: https://github.com/your-org/opencode-ri-notification/issues

---

**提示**: 如果你遇到任何问题，运行测试脚本的 `--env` 选项检查环境：

```bash
cd ~/.config/opencode/plugins/opencode-ri-notification
./test-plugin.sh --env
```
