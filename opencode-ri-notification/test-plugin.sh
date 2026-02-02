#!/bin/bash
# OpenCode RI Notification Plugin Test Script
# 
# 用于测试各种通知场景

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_header() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  OpenCode RI Notification Test Suite  ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
    echo ""
}

print_test() {
    echo -e "${YELLOW}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}  ✓${NC} $1"
}

print_error() {
    echo -e "${RED}  ✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}  ℹ${NC} $1"
}

# 检查环境
check_environment() {
    echo -e "${BLUE}━━━ 检查环境 ━━━${NC}"
    echo ""
    
    # 检查是否在 RI 终端中
    if [ "$RI_TERMINAL" = "true" ]; then
        print_success "在 RI 终端中运行"
        print_info "Session ID: ${RI_SESSION_ID}"
        print_info "Session Name: ${RI_SESSION_NAME}"
    else
        print_error "不在 RI 终端中运行"
        print_info "此插件需要在 Second Brain OS (RI) 中使用"
        echo ""
        echo "请在 RI 终端中运行此脚本"
        exit 1
    fi
    
    echo ""
    
    # 检查 OpenCode 是否安装
    if command -v opencode &> /dev/null; then
        print_success "OpenCode 已安装"
    else
        print_error "OpenCode 未安装"
        exit 1
    fi
    
    echo ""
}

# 测试基础通知
test_basic_notifications() {
    echo -e "${BLUE}━━━ 测试 1: 基础通知 ━━━${NC}"
    echo ""
    
    print_test "发送 info 通知..."
    echo '__OM_NOTIFY:info:这是一条信息通知__'
    sleep 2
    print_success "已发送"
    
    print_test "发送 success 通知..."
    echo '__OM_NOTIFY:success:这是一条成功通知__'
    sleep 2
    print_success "已发送"
    
    print_test "发送 error 通知..."
    echo '__OM_NOTIFY:error:这是一条错误通知__'
    sleep 2
    print_success "已发送"
    
    print_test "发送 completed 通知..."
    echo '__OM_NOTIFY:completed:这是一条完成通知__'
    sleep 2
    print_success "已发送"
    
    echo ""
    print_info "检查是否看到了 4 个通知"
    echo ""
}

# 测试 OSC 不可见序列
test_osc_notifications() {
    echo -e "${BLUE}━━━ 测试 2: OSC 不可见序列 ━━━${NC}"
    echo ""
    
    print_test "发送 OSC 格式通知（不应该在终端显示）..."
    printf '\x1b]__OM_NOTIFY:info:OSC 格式通知测试__\x07'
    sleep 2
    print_success "已发送"
    
    print_info "OSC 格式通知不会在终端显示文本"
    print_info "但应该看到通知弹窗"
    echo ""
}

# 测试构建命令检测
test_build_commands() {
    echo -e "${BLUE}━━━ 测试 3: 构建命令检测 ━━━${NC}"
    echo ""
    
    print_test "模拟构建成功..."
    echo "$ npm run build"
    sleep 1
    echo "Build completed successfully!"
    echo '__OM_NOTIFY:success:构建成功 ✓__'
    sleep 2
    print_success "应该看到构建成功通知"
    
    echo ""
    
    print_test "模拟构建失败..."
    echo "$ npm run build"
    sleep 1
    echo "Error: Build failed!"
    echo '__OM_NOTIFY:error:构建失败 ✗__'
    sleep 2
    print_success "应该看到构建失败通知"
    
    echo ""
}

# 测试长时间运行命令
test_long_running_command() {
    echo -e "${BLUE}━━━ 测试 4: 长时间运行命令 ━━━${NC}"
    echo ""
    
    print_test "运行 35 秒命令（超过默认阈值 30 秒）..."
    print_info "等待中..."
    
    sleep 35
    
    echo '__OM_NOTIFY:completed:命令执行完成 (35.0s)__'
    print_success "应该看到长时间命令完成通知"
    
    echo ""
}

# 测试权限请求
test_permission_request() {
    echo -e "${BLUE}━━━ 测试 5: 权限请求通知 ━━━${NC}"
    echo ""
    
    print_test "模拟权限请求..."
    echo '__OM_NOTIFY:info:需要授权: file.write__'
    sleep 2
    print_success "应该看到权限请求通知"
    
    echo ""
}

# 测试插件配置
test_plugin_config() {
    echo -e "${BLUE}━━━ 测试 6: 插件配置 ━━━${NC}"
    echo ""
    
    local config_file="${HOME}/.config/opencode/opencode.json"
    
    if [ -f "$config_file" ]; then
        print_success "配置文件存在: ${config_file}"
        
        # 检查是否包含 riNotification 配置
        if grep -q "riNotification" "$config_file"; then
            print_success "找到 riNotification 配置"
        else
            print_info "未找到 riNotification 配置（使用默认配置）"
        fi
    else
        print_info "配置文件不存在（使用默认配置）"
    fi
    
    echo ""
}

# 交互式测试菜单
interactive_menu() {
    echo -e "${BLUE}━━━ 交互式测试菜单 ━━━${NC}"
    echo ""
    echo "1) 测试所有通知类型"
    echo "2) 测试 OSC 不可见序列"
    echo "3) 测试构建命令"
    echo "4) 测试长时间命令 (35秒)"
    echo "5) 测试权限请求"
    echo "6) 检查插件配置"
    echo "7) 运行完整测试套件"
    echo "0) 退出"
    echo ""
    read -p "请选择 (0-7): " choice
    
    case $choice in
        1) test_basic_notifications ;;
        2) test_osc_notifications ;;
        3) test_build_commands ;;
        4) test_long_running_command ;;
        5) test_permission_request ;;
        6) test_plugin_config ;;
        7) run_all_tests ;;
        0) exit 0 ;;
        *) 
            print_error "无效选项"
            interactive_menu
            ;;
    esac
    
    echo ""
    read -p "按 Enter 返回菜单..." -r
    interactive_menu
}

# 运行所有测试
run_all_tests() {
    check_environment
    test_plugin_config
    test_basic_notifications
    test_osc_notifications
    test_build_commands
    # 跳过长时间测试，因为太慢
    # test_long_running_command
    test_permission_request
    
    echo -e "${GREEN}━━━ 测试完成 ━━━${NC}"
    echo ""
    print_success "所有测试已运行"
    print_info "请检查是否看到了所有通知"
    echo ""
}

# 主函数
main() {
    print_header
    
    # 解析参数
    if [ $# -eq 0 ]; then
        # 无参数，显示交互式菜单
        check_environment
        interactive_menu
    else
        case $1 in
            --all)
                run_all_tests
                ;;
            --env)
                check_environment
                ;;
            --basic)
                check_environment
                test_basic_notifications
                ;;
            --osc)
                check_environment
                test_osc_notifications
                ;;
            --build)
                check_environment
                test_build_commands
                ;;
            --long)
                check_environment
                test_long_running_command
                ;;
            --permission)
                check_environment
                test_permission_request
                ;;
            --config)
                check_environment
                test_plugin_config
                ;;
            --help|-h)
                echo "用法: $0 [选项]"
                echo ""
                echo "选项:"
                echo "  --all          运行所有测试（跳过长时间测试）"
                echo "  --env          检查环境"
                echo "  --basic        测试基础通知"
                echo "  --osc          测试 OSC 不可见序列"
                echo "  --build        测试构建命令"
                echo "  --long         测试长时间命令 (35秒)"
                echo "  --permission   测试权限请求"
                echo "  --config       检查插件配置"
                echo "  --help         显示此帮助信息"
                echo ""
                echo "无参数时显示交互式菜单"
                exit 0
                ;;
            *)
                print_error "未知选项: $1"
                echo "使用 --help 查看帮助"
                exit 1
                ;;
        esac
    fi
}

# 运行主函数
main "$@"
