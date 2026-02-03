# OpenCode RI Notification Plugin

> 为 OpenCode 和 Second Brain OS (RI) 提供无缝通知集成

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-blue.svg)](https://opencode.ai/docs/plugins)

## ✨ 特性

- ✅ **智能环境检测** - 自动识别 RI 终端环境，其他终端中自动禁用
- ✅ **零配置启动** - 开箱即用的默认配置
- ✅ **多场景通知** - 支持任务完成、构建、测试、错误和权限请求
- ✅ **高度可配置** - 细粒度的事件开关和消息模板
- ✅ **原生集成** - 使用 RI 的 `__OM_NOTIFY` 协议，无需额外依赖

## 📦 安装

### 方式 1: 本地安装（推荐用于开发）

将插件复制到 OpenCode 插件目录：

```bash
# 复制到全局插件目录
cp -r opencode-ri-notification ~/.config/opencode/plugins/

# 或复制到项目级插件目录
cp -r opencode-ri-notification .opencode/plugins/
```

### 方式 2: 从 Git 仓库安装

```bash
cd ~/.config/opencode/plugins/
git clone https://github.com/your-username/opencode-ri-notification.git
```

### 方式 3: 通过 npm 安装（未来支持）

```bash
# 在 opencode.json 中添加:
{
  "plugin": ["opencode-ri-notification"]
}
```

## 🚀 快速开始

### 1. 确保在 RI 终端中运行

插件会自动检测以下环境变量：
- `RI_TERMINAL=true`
- `RI_SESSION_ID=<session-id>`
- `RI_SESSION_NAME=<session-name>`

这些变量由 RI 自动注入，无需手动设置。

### 2. 启动 OpenCode

```bash
# 在 RI 终端中
opencode
```

插件会自动激活并记录日志：
```
[ri-notification] Plugin activated in session: MySession
```

### 3. 测试通知

运行一个构建命令测试：

```bash
npm run build
# 构建完成后会收到通知: "构建成功 ✓" 或 "构建失败 ✗"
```

或者手动触发通知（用于调试）：

```bash
echo '__OM_NOTIFY:completed:测试通知__'
```

## ⚙️ 配置

### 全局配置

编辑 `~/.config/opencode/opencode.json`:

```jsonc
{
  "plugin": ["opencode-ri-notification"],
  
  "riNotification": {
    // 是否启用插件
    "enabled": true,
    
    // 长时间命令阈值（毫秒）
    "minDuration": 30000,
    
    // 事件开关
    "events": {
      "sessionIdle": true,       // 任务完成
      "buildComplete": true,     // 构建完成
      "testComplete": true,      // 测试完成
      "sessionError": true,      // 错误发生
      "permissionAsked": true,   // 权限请求
      "longRunningCommand": true // 长时间命令
    },
    
    // 构建命令关键词（用于检测构建命令）
    "buildCommands": [
      "npm run build",
      "yarn build",
      "make"
    ],
    
    // 测试命令关键词
    "testCommands": [
      "npm test",
      "pytest"
    ],
    
    // 消息模板（支持变量：{duration}, {tool}, {session}）
    "messageTemplates": {
      "sessionIdle": "任务已完成",
      "buildSuccess": "构建成功 ✓",
      "buildError": "构建失败 ✗",
      "testSuccess": "测试通过 ✓",
      "testError": "测试失败 ✗",
      "permissionAsked": "需要授权: {tool}",
      "longCommand": "命令执行完成 ({duration}s)"
    }
  }
}
```

### 项目级配置

在项目根目录创建 `.opencode/opencode.json`:

```jsonc
{
  "riNotification": {
    // 只覆盖需要修改的配置
    "buildCommands": ["npm run build:prod"],
    "testCommands": ["npm run test:e2e"]
  }
}
```

## 📋 通知场景

### 1. 任务完成 (`session.idle`)

当 OpenCode 完成响应并等待下一个输入时触发。

**触发时机**: OpenCode AI 完成任务  
**通知类型**: `completed`  
**默认消息**: "任务已完成"

### 2. 构建完成 (`buildComplete`)

检测常见的构建命令并在完成时通知。

**触发命令**:
- `npm run build`, `yarn build`, `pnpm build`, `bun run build`
- `make`, `make build`
- `cargo build`, `go build`
- `mvn package`, `gradle build`

**通知类型**: `success` (退出码 0) / `error` (非 0)  
**默认消息**: "构建成功 ✓" / "构建失败 ✗"

### 3. 测试完成 (`testComplete`)

检测常见的测试命令并在完成时通知。

**触发命令**:
- `npm test`, `yarn test`, `pnpm test`, `bun test`
- `pytest`, `cargo test`, `go test`
- `mvn test`, `gradle test`

**通知类型**: `success` (通过) / `error` (失败)  
**默认消息**: "测试通过 ✓" / "测试失败 ✗"

### 4. 错误发生 (`session.error`)

当 OpenCode 执行过程中发生错误时触发。

**通知类型**: `error`  
**消息格式**: "错误: {错误信息}"

### 5. 权限请求 (`permission.asked`)

当 OpenCode 需要用户授权某个操作时触发。

**通知类型**: `info`  
**默认消息**: "需要授权: {tool}"

### 6. 长时间运行命令 (`longRunningCommand`)

当命令执行时间超过配置的阈值（默认 30 秒）时触发。

**通知类型**: `completed`  
**默认消息**: "命令执行完成 ({duration}s)"

## 🔧 高级用法

### 自定义通知类型

通过 RI 的通知协议，支持以下通知类型：

- `info` - 信息通知（蓝色）
- `success` - 成功通知（绿色）
- `error` - 错误通知（红色）
- `completed` - 完成通知（灰色）

### 调试模式

查看插件日志：

```bash
# 在 OpenCode 中运行
/log
```

或者在终端中直接查看环境变量：

```bash
env | grep RI_
```

预期输出：
```
RI_TERMINAL=true
RI_SESSION_ID=abc123
RI_SESSION_NAME=MySession
```

## 🐛 故障排查

### 问题 1: 没有收到通知

**检查步骤**:

1. 确认在 RI 终端中运行：
   ```bash
   echo $RI_TERMINAL  # 应该输出 "true"
   ```

2. 检查插件是否激活：
   ```bash
   # 在 OpenCode 日志中查找
   [ri-notification] Plugin activated
   ```

3. 测试 RI 通知系统：
   ```bash
   echo '__OM_NOTIFY:info:测试通知__'
   # 应该看到通知弹窗
   ```

### 问题 2: 插件未加载

**检查步骤**:

1. 确认插件文件存在：
   ```bash
   ls -la ~/.config/opencode/plugins/opencode-ri-notification/
   ```

2. 检查文件权限：
   ```bash
   chmod +x ~/.config/opencode/plugins/opencode-ri-notification/index.ts
   ```

3. 查看 OpenCode 日志中的错误信息

### 问题 3: 通知过于频繁

**解决方案**:

在配置中禁用某些事件：

```jsonc
{
  "riNotification": {
    "events": {
      "sessionIdle": false,  // 禁用任务完成通知
      "longRunningCommand": false  // 禁用长时间命令通知
    }
  }
}
```

或者增加长时间命令阈值：

```jsonc
{
  "riNotification": {
    "minDuration": 60000  // 改为 60 秒
  }
}
```

## 📚 技术细节

### 工作原理

1. **环境检测**: 插件在启动时检查 `RI_TERMINAL` 等环境变量
2. **事件监听**: 使用 OpenCode 的插件钩子系统监听各种事件
3. **通知发送**: 通过 shell 输出特殊格式的字符串 `__OM_NOTIFY:type:message__`
4. **RI 捕获**: RI 的 terminalManager 监听终端输出并捕获通知信号
5. **UI 显示**: RI 显示系统通知和应用内通知

### 通知协议

RI 支持两种通知格式：

**1. OSC 不可见序列（推荐）**:
```
\x1b]__OM_NOTIFY:type:message__\x07
```

优点：不会在终端中显示，用户体验更好

**2. 可见文本格式（Fallback）**:
```
__OM_NOTIFY:type:message__
```

优点：调试方便，兼容性好

插件优先使用 OSC 格式，失败时自动降级到可见格式。

### 性能影响

- **启动开销**: < 5ms（仅环境检测和配置加载）
- **事件处理**: < 1ms（异步执行，不阻塞 OpenCode）
- **通知发送**: < 10ms（shell 命令执行）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发环境

```bash
# Clone 项目
git clone https://github.com/your-username/opencode-ri-notification.git
cd opencode-ri-notification

# 安装依赖（如果有）
# npm install

# 复制到 OpenCode 插件目录进行测试
cp -r . ~/.config/opencode/plugins/opencode-ri-notification/

# 在 RI 终端中测试
opencode
```

### 测试脚本

查看 `test-plugin.sh` 了解如何测试各种通知场景。

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 🔗 相关链接

- [OpenCode 官网](https://opencode.ai)
- [OpenCode 插件文档](https://opencode.ai/docs/plugins)
- [Second Brain OS (RI)](https://github.com/your-org/ri)
- [问题反馈](https://github.com/your-username/opencode-ri-notification/issues)

## 📝 更新日志

### v1.0.0 (2024-02-03)

- ✨ 初始版本
- ✅ 支持 6 种通知场景
- ✅ 完整的配置系统
- ✅ 自动环境检测
- ✅ 详细的文档和示例
