# Process Management and Cleanup

## 问题描述

删除 session 时，terminal 中运行的子进程可能不会被正确清理，导致：
- 僵尸进程（zombie processes）
- 孤立进程（orphaned processes）
- 资源泄漏

## 解决方案

### 1. 改进的进程清理逻辑

在 `electron/terminalManager.cjs` 中改进了 `dispose()` 方法：

**Unix/Linux/macOS:**
```javascript
// 1. 使用 pkill 杀死所有子进程
execSync(`pkill -TERM -P ${pid}`);

// 2. 杀死进程组
process.kill(-pid, 'SIGTERM');

// 3. 杀死主进程
process.kill(pid, 'SIGTERM');

// 4. 500ms 后强制杀死（SIGKILL）
setTimeout(() => {
  execSync(`pkill -KILL -P ${pid}`);
  process.kill(-pid, 'SIGKILL');
  process.kill(pid, 'SIGKILL');
}, 500);
```

**Windows:**
```bash
taskkill /pid ${pid} /T /F
```

### 2. 手动清理脚本

如果发现僵尸进程，可以使用清理脚本：

```bash
./cleanup-processes.sh
```

该脚本会：
- 查找并清理 opencode 进程
- 查找并清理 node-pty 进程
- 识别僵尸进程及其父进程
- 提供交互式清理选项

## 使用方法

### 正常删除 Session

1. 点击 session 列表中的删除按钮（🗑）
2. 如果有打开的 tab，会显示确认菜单
3. 确认后，系统会：
   - 关闭所有相关 tab
   - 终止 shell 进程
   - 终止所有子进程
   - 清理 session 数据

### 手动清理僵尸进程

如果发现僵尸进程：

```bash
# 运行清理脚本
./cleanup-processes.sh

# 或手动查找并杀死进程
ps aux | grep opencode
kill -9 <PID>
```

### 查找僵尸进程

```bash
# 查找所有僵尸进程
ps aux | awk '$8=="Z"'

# 查找 opencode 相关进程
pgrep -fl opencode

# 查找进程树
pstree -p <PID>
```

## 预防措施

1. **优雅退出应用**
   - 使用 Cmd+Q / Quit 菜单退出
   - 避免强制退出（Force Quit）

2. **关闭 tab 后再删除**
   - 虽然现在会自动关闭，但提前关闭更安全

3. **定期检查**
   ```bash
   # 检查是否有孤立进程
   pgrep -fl opencode
   ps aux | grep node-pty
   ```

4. **重启应用**
   - 如果遇到问题，重启应用会清理所有进程

## 技术细节

### SIGTERM vs SIGKILL

- **SIGTERM (15)**: 优雅终止，允许进程清理资源
- **SIGKILL (9)**: 强制终止，立即杀死进程

我们的策略：
1. 先发送 SIGTERM（优雅）
2. 等待 500ms
3. 发送 SIGKILL（强制）

### 进程组 (Process Group)

使用负数 PID (`-pid`) 可以杀死整个进程组：
```javascript
process.kill(-pid, 'SIGTERM');  // 杀死进程组
```

### pkill 命令

`pkill -P <parent_pid>` 杀死指定父进程的所有子进程：
```bash
pkill -TERM -P 12345  # 杀死 PID 12345 的所有子进程
```

## 日志输出

删除 session 时会输出详细日志：

```
[TerminalManager] Disposing terminal xxx with PID 12345
[TerminalManager] Sent SIGTERM to children of PID 12345
[TerminalManager] Sent SIGTERM to process group -12345
[TerminalManager] Sent SIGTERM to PID 12345
[TerminalManager] Sent SIGKILL to process tree 12345
```

## 常见问题

### Q: 为什么还有僵尸进程？

A: 僵尸进程的父进程没有正确 wait()。解决方法：
- 重启父进程（通常是终端应用）
- 使用清理脚本

### Q: 如何确认进程被清理？

```bash
# 检查特定进程
ps -p <PID>

# 检查所有 opencode 进程
pgrep -fl opencode
```

### Q: Windows 上如何清理？

```cmd
# 查看进程树
tasklist /FI "IMAGENAME eq opencode.exe"

# 杀死进程树
taskkill /PID <PID> /T /F
```

## 相关文件

- `electron/terminalManager.cjs` - 进程管理逻辑
- `cleanup-processes.sh` - 手动清理脚本
- `src/renderer/components/SessionList.tsx` - Session 删除 UI

## 更新日志

- **2024-02-02**: 改进进程清理逻辑，添加进程组和子进程清理
- **2024-02-02**: 添加详细日志输出
- **2024-02-02**: 创建手动清理脚本
