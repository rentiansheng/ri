#!/bin/bash
# OpenCode RI Notification Plugin Installer
# 
# 用法:
#   ./install.sh           # 安装到全局插件目录
#   ./install.sh --local   # 安装到当前项目

set -e

VERSION="1.0.0"
PLUGIN_NAME="opencode-ri-notification"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  OpenCode RI Notification Plugin v${VERSION}  ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
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
    print_info "检查依赖..."
    
    # 检查 OpenCode 是否安装
    if ! command -v opencode &> /dev/null; then
        print_error "OpenCode 未安装"
        echo ""
        echo "请先安装 OpenCode:"
        echo "  curl -fsSL https://opencode.ai/install | bash"
        echo ""
        exit 1
    fi
    print_success "OpenCode 已安装"
    
    # 检查是否在 RI 终端中（可选）
    if [ "$RI_TERMINAL" != "true" ]; then
        print_warning "当前不在 RI 终端中运行"
        print_info "此插件专为 Second Brain OS (RI) 设计"
        echo ""
        read -p "是否继续安装? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "取消安装"
            exit 0
        fi
    else
        print_success "在 RI 终端中运行"
    fi
}

# 安装到全局
install_global() {
    local plugin_dir="${HOME}/.config/opencode/plugins/${PLUGIN_NAME}"
    
    print_info "安装到全局插件目录: ${plugin_dir}"
    
    # 创建目录
    mkdir -p "$(dirname "$plugin_dir")"
    
    # 如果已存在，询问是否覆盖
    if [ -d "$plugin_dir" ]; then
        print_warning "插件目录已存在"
        read -p "是否覆盖? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "取消安装"
            exit 0
        fi
        rm -rf "$plugin_dir"
    fi
    
    # 复制文件
    cp -r "$SCRIPT_DIR" "$plugin_dir"
    print_success "文件已复制"
    
    # 检查并更新配置
    update_opencode_config "${HOME}/.config/opencode/opencode.json"
    
    print_success "全局安装完成"
    echo ""
    print_info "插件位置: ${plugin_dir}"
}

# 安装到项目
install_local() {
    local plugin_dir=".opencode/plugins/${PLUGIN_NAME}"
    
    print_info "安装到项目插件目录: ${plugin_dir}"
    
    # 检查是否在项目根目录
    if [ ! -d ".git" ] && [ ! -f "package.json" ]; then
        print_warning "当前目录似乎不是项目根目录"
        read -p "是否继续? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "取消安装"
            exit 0
        fi
    fi
    
    # 创建目录
    mkdir -p "$(dirname "$plugin_dir")"
    
    # 如果已存在，询问是否覆盖
    if [ -d "$plugin_dir" ]; then
        print_warning "插件目录已存在"
        read -p "是否覆盖? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "取消安装"
            exit 0
        fi
        rm -rf "$plugin_dir"
    fi
    
    # 复制文件
    cp -r "$SCRIPT_DIR" "$plugin_dir"
    print_success "文件已复制"
    
    # 检查并更新配置
    update_opencode_config ".opencode/opencode.json"
    
    print_success "项目安装完成"
    echo ""
    print_info "插件位置: ${plugin_dir}"
}

# 更新 OpenCode 配置
update_opencode_config() {
    local config_file="$1"
    local config_dir="$(dirname "$config_file")"
    
    # 创建配置目录
    mkdir -p "$config_dir"
    
    # 如果配置文件不存在，创建
    if [ ! -f "$config_file" ]; then
        echo '{}' > "$config_file"
        print_success "创建配置文件: ${config_file}"
    fi
    
    print_info "配置文件: ${config_file}"
    print_info "你可以在配置文件中自定义插件行为"
    print_info "详见: ${SCRIPT_DIR}/README.md"
}

# 显示后续步骤
show_next_steps() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════╗${NC}"
    echo -e "${GREEN}║        安装成功！后续步骤         ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════╝${NC}"
    echo ""
    echo "1️⃣  重启 RI 终端会话（使环境变量生效）"
    echo ""
    echo "2️⃣  在 RI 终端中启动 OpenCode:"
    echo "   $ opencode"
    echo ""
    echo "3️⃣  测试通知功能:"
    echo "   $ echo '__OM_NOTIFY:info:插件正常工作!__'"
    echo ""
    echo "4️⃣  查看文档:"
    echo "   $ cat ~/.config/opencode/plugins/${PLUGIN_NAME}/README.md"
    echo ""
    echo "5️⃣  自定义配置（可选）:"
    echo "   $ vim ~/.config/opencode/opencode.json"
    echo ""
    echo -e "${BLUE}更多信息请访问: https://opencode.ai/docs/plugins${NC}"
    echo ""
}

# 主函数
main() {
    print_header
    
    # 解析参数
    local install_mode="global"
    while [[ $# -gt 0 ]]; do
        case $1 in
            --local)
                install_mode="local"
                shift
                ;;
            --help|-h)
                echo "用法: $0 [选项]"
                echo ""
                echo "选项:"
                echo "  --local    安装到当前项目 (.opencode/plugins/)"
                echo "  --help     显示此帮助信息"
                echo ""
                echo "默认安装到全局插件目录 (~/.config/opencode/plugins/)"
                exit 0
                ;;
            *)
                print_error "未知选项: $1"
                echo "使用 --help 查看帮助"
                exit 1
                ;;
        esac
    done
    
    # 检查依赖
    check_dependencies
    echo ""
    
    # 执行安装
    if [ "$install_mode" = "local" ]; then
        install_local
    else
        install_global
    fi
    
    # 显示后续步骤
    show_next_steps
}

# 运行主函数
main "$@"
