#!/bin/bash
# OpenCode 插件自动安装和配置脚本
# 
# 功能:
#   1. 安装 OpenCode 插件到指定目录
#   2. 自动修改 OpenCode 配置，启用插件
#   3. 自动修改 RI 配置，启用 OpenCode 集成
#   4. 备份原配置文件
#
# 用法:
#   ./install-opencode-plugin.sh <plugin-source-dir> [--local]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
PLUGIN_NAME="opencode-ri-notification"
RI_CONFIG_FILE="${HOME}/Library/Application Support/secondbrain-app/config.json"

# 打印函数
print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  OpenCode 插件自动安装配置工具                ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${CYAN}━━━ $1 ━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# 检查依赖
check_dependencies() {
    print_section "检查依赖"
    
    # 检查 jq
    if ! command -v jq &> /dev/null; then
        print_error "需要安装 jq 来处理 JSON 文件"
        echo ""
        echo "安装命令:"
        echo "  brew install jq"
        echo ""
        exit 1
    fi
    print_success "jq 已安装"
    
    # 检查 OpenCode
    if ! command -v opencode &> /dev/null; then
        print_warning "OpenCode 未安装"
        print_info "插件安装后，需要先安装 OpenCode 才能使用"
    else
        print_success "OpenCode 已安装: $(which opencode)"
    fi
    
    # 检查 RI 配置文件
    if [ -f "$RI_CONFIG_FILE" ]; then
        print_success "RI 配置文件存在"
    else
        print_warning "RI 配置文件不存在: $RI_CONFIG_FILE"
    fi
}

# 备份配置文件
backup_config() {
    local config_file="$1"
    local backup_file="${config_file}.backup.$(date +%Y%m%d_%H%M%S)"
    
    if [ -f "$config_file" ]; then
        cp "$config_file" "$backup_file"
        print_success "已备份: $backup_file"
    fi
}

# 安装插件文件
install_plugin_files() {
    local source_dir="$1"
    local install_mode="$2"
    
    print_section "安装插件文件"
    
    # 确定安装目录
    if [ "$install_mode" = "local" ]; then
        PLUGIN_DIR=".opencode/plugins/${PLUGIN_NAME}"
        print_info "安装模式: 项目级"
    else
        PLUGIN_DIR="${HOME}/.config/opencode/plugins/${PLUGIN_NAME}"
        print_info "安装模式: 全局"
    fi
    
    print_info "目标目录: $PLUGIN_DIR"
    
    # 检查源目录
    if [ ! -d "$source_dir" ]; then
        print_error "源目录不存在: $source_dir"
        exit 1
    fi
    
    # 检查源目录是否包含必要文件
    if [ ! -f "$source_dir/package.json" ] || [ ! -f "$source_dir/index.ts" ]; then
        print_error "源目录不是有效的插件目录（缺少 package.json 或 index.ts）"
        exit 1
    fi
    
    # 创建目标目录
    mkdir -p "$(dirname "$PLUGIN_DIR")"
    
    # 如果已存在，询问是否覆盖
    if [ -d "$PLUGIN_DIR" ]; then
        print_warning "插件目录已存在"
        
        # 如果是非交互模式，自动覆盖
        if [ -t 0 ]; then
            read -p "是否覆盖? (y/N): " -n 1 -r
            echo ""
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_info "取消安装"
                exit 0
            fi
        else
            print_info "非交互模式，自动覆盖"
        fi
        
        rm -rf "$PLUGIN_DIR"
    fi
    
    # 复制文件
    cp -r "$source_dir" "$PLUGIN_DIR"
    print_success "插件文件已复制到: $PLUGIN_DIR"
}

# 更新 OpenCode 配置，启用插件
update_opencode_config() {
    local install_mode="$1"
    
    print_section "配置 OpenCode"
    
    # 确定配置文件路径
    if [ "$install_mode" = "local" ]; then
        OPENCODE_CONFIG=".opencode/opencode.json"
    else
        OPENCODE_CONFIG="${HOME}/.config/opencode/opencode.json"
    fi
    
    print_info "配置文件: $OPENCODE_CONFIG"
    
    # 创建配置目录
    mkdir -p "$(dirname "$OPENCODE_CONFIG")"
    
    # 备份配置文件
    if [ -f "$OPENCODE_CONFIG" ]; then
        backup_config "$OPENCODE_CONFIG"
    fi
    
    # 创建或更新配置文件
    if [ ! -f "$OPENCODE_CONFIG" ]; then
        # 配置文件不存在，创建新的
        cat > "$OPENCODE_CONFIG" <<EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "plugins": ["${PLUGIN_NAME}"]
}
EOF
        print_success "已创建配置文件并启用插件"
    else
        # 配置文件存在，检查并添加插件
        local has_plugin=$(jq -r ".plugins[]? | select(. == \"${PLUGIN_NAME}\")" "$OPENCODE_CONFIG")
        
        if [ -z "$has_plugin" ]; then
            # 插件未启用，添加到配置
            local tmp_file=$(mktemp)
            
            # 检查是否已有 plugins 字段
            local has_plugins=$(jq -r '.plugins // empty' "$OPENCODE_CONFIG")
            
            if [ -z "$has_plugins" ]; then
                # 没有 plugins 字段，添加
                jq ". + {\"plugins\": [\"${PLUGIN_NAME}\"]}" "$OPENCODE_CONFIG" > "$tmp_file"
            else
                # 已有 plugins 字段，追加
                jq ".plugins += [\"${PLUGIN_NAME}\"]" "$OPENCODE_CONFIG" > "$tmp_file"
            fi
            
            mv "$tmp_file" "$OPENCODE_CONFIG"
            print_success "已在配置中启用插件"
        else
            print_info "插件已在配置中启用"
        fi
    fi
    
    # 验证 JSON 格式
    if jq empty "$OPENCODE_CONFIG" 2>/dev/null; then
        print_success "配置文件 JSON 格式正确"
    else
        print_error "配置文件 JSON 格式错误"
        exit 1
    fi
    
    # 显示最终配置
    echo ""
    print_info "当前 OpenCode 配置:"
    jq '.' "$OPENCODE_CONFIG" | sed 's/^/  /'
}

# 更新 RI 配置，启用 OpenCode 集成
update_ri_config() {
    print_section "配置 RI 应用"
    
    if [ ! -f "$RI_CONFIG_FILE" ]; then
        print_warning "RI 配置文件不存在，跳过配置"
        print_info "如果你使用 RI 应用，请手动配置:"
        print_info "  文件: $RI_CONFIG_FILE"
        print_info "  设置: opencode.enabled = true"
        return
    fi
    
    # 备份 RI 配置
    backup_config "$RI_CONFIG_FILE"
    
    # 检查 OpenCode 是否已启用
    local opencode_enabled=$(jq -r '.opencode.enabled // false' "$RI_CONFIG_FILE")
    
    if [ "$opencode_enabled" = "true" ]; then
        print_info "RI 中的 OpenCode 集成已启用"
    else
        print_info "正在启用 RI 中的 OpenCode 集成..."
        
        # 更新配置
        local tmp_file=$(mktemp)
        jq '.opencode.enabled = true' "$RI_CONFIG_FILE" > "$tmp_file"
        mv "$tmp_file" "$RI_CONFIG_FILE"
        
        print_success "已启用 OpenCode 集成"
    fi
    
    # 检查通知配置
    local notification_enabled=$(jq -r '.notification.enabled // false' "$RI_CONFIG_FILE")
    local system_enabled=$(jq -r '.notification.channels.system.enabled // false' "$RI_CONFIG_FILE")
    
    echo ""
    print_info "RI 通知配置状态:"
    echo "  - 通知系统: $notification_enabled"
    echo "  - 系统通知: $system_enabled"
    
    if [ "$notification_enabled" != "true" ] || [ "$system_enabled" != "true" ]; then
        print_warning "建议启用通知功能以获得完整体验"
        print_info "可以在 RI 设置中启用，或手动编辑配置文件"
    fi
}

# 测试安装
test_installation() {
    print_section "测试安装"
    
    # 测试 1: 检查插件文件
    if [ -f "${PLUGIN_DIR}/index.ts" ]; then
        print_success "插件文件存在"
    else
        print_error "插件文件不存在"
        return 1
    fi
    
    # 测试 2: 检查 OpenCode 配置
    local plugin_in_config=$(jq -r ".plugins[]? | select(. == \"${PLUGIN_NAME}\")" "$OPENCODE_CONFIG" 2>/dev/null)
    if [ -n "$plugin_in_config" ]; then
        print_success "插件已在 OpenCode 配置中启用"
    else
        print_warning "插件未在 OpenCode 配置中找到"
    fi
    
    # 测试 3: 检查 RI 配置
    if [ -f "$RI_CONFIG_FILE" ]; then
        local opencode_enabled=$(jq -r '.opencode.enabled // false' "$RI_CONFIG_FILE")
        if [ "$opencode_enabled" = "true" ]; then
            print_success "RI 中的 OpenCode 集成已启用"
        else
            print_warning "RI 中的 OpenCode 集成未启用"
        fi
    fi
}

# 显示后续步骤
show_next_steps() {
    print_section "安装完成！"
    
    echo -e "${GREEN}✓ 插件文件已安装${NC}"
    echo -e "${GREEN}✓ OpenCode 配置已更新${NC}"
    echo -e "${GREEN}✓ RI 配置已更新${NC}"
    echo ""
    
    echo -e "${CYAN}━━━ 后续步骤 ━━━${NC}"
    echo ""
    
    echo "1️⃣  重启 RI 应用（使配置生效）:"
    echo "   $ pkill -f 'RI.app' && open -a 'RI'"
    echo ""
    
    echo "2️⃣  在 RI 终端中测试通知:"
    echo "   $ echo '__OM_NOTIFY:success:插件安装成功!__'"
    echo ""
    
    echo "3️⃣  启动 OpenCode（在 RI 终端中）:"
    echo "   $ opencode"
    echo ""
    
    echo "4️⃣  运行完整测试:"
    echo "   $ cd $(pwd)"
    echo "   $ ./scripts/test-webhook-notification.sh"
    echo ""
    
    echo "5️⃣  查看插件文档:"
    echo "   $ cat ${PLUGIN_DIR}/README.md"
    echo ""
    
    echo -e "${BLUE}━━━ 配置文件位置 ━━━${NC}"
    echo ""
    echo "  OpenCode: $OPENCODE_CONFIG"
    echo "  RI 应用:  $RI_CONFIG_FILE"
    echo "  插件:     $PLUGIN_DIR"
    echo ""
    
    echo -e "${BLUE}━━━ 备份文件 ━━━${NC}"
    echo ""
    echo "  所有原配置文件已备份（.backup.YYYYMMDD_HHMMSS）"
    echo "  如需恢复，使用: cp <备份文件> <原文件>"
    echo ""
}

# 显示使用说明
show_usage() {
    echo "用法: $0 <plugin-source-dir> [选项]"
    echo ""
    echo "参数:"
    echo "  plugin-source-dir   插件源代码目录"
    echo ""
    echo "选项:"
    echo "  --local            安装到项目级目录 (.opencode/plugins/)"
    echo "  --help, -h         显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  # 全局安装"
    echo "  $0 ./opencode-ri-notification"
    echo ""
    echo "  # 项目级安装"
    echo "  $0 ./opencode-ri-notification --local"
    echo ""
}

# 主函数
main() {
    # 解析参数
    if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        show_usage
        exit 0
    fi
    
    local source_dir="$1"
    local install_mode="global"
    
    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            --local)
                install_mode="local"
                shift
                ;;
            *)
                print_error "未知选项: $1"
                echo ""
                show_usage
                exit 1
                ;;
        esac
    done
    
    print_header
    
    # 执行安装流程
    check_dependencies
    install_plugin_files "$source_dir" "$install_mode"
    update_opencode_config "$install_mode"
    update_ri_config
    
    echo ""
    test_installation
    
    show_next_steps
    
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}安装成功！${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# 运行主函数
main "$@"
