#!/bin/bash

# Cleanup zombie/orphaned processes related to RI application
# This script helps clean up processes that weren't properly terminated

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo ""
print_info "RI Process Cleanup Script"
print_info "=========================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   print_warning "Running as root. This will clean up processes for all users."
   read -p "Continue? (y/n) " -n 1 -r
   echo
   if [[ ! $REPLY =~ ^[Yy]$ ]]; then
       print_info "Aborted."
       exit 0
   fi
fi

# Find orphaned opencode processes
print_info "Searching for opencode processes..."
OPENCODE_PIDS=$(pgrep -f "opencode" || true)

if [ -z "$OPENCODE_PIDS" ]; then
    print_success "No opencode processes found."
else
    print_warning "Found opencode processes:"
    ps -f -p $OPENCODE_PIDS || true
    echo ""
    read -p "Kill these processes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        for pid in $OPENCODE_PIDS; do
            print_info "Killing process $pid..."
            kill -TERM $pid 2>/dev/null || true
        done
        
        # Wait a bit
        sleep 1
        
        # Force kill if still running
        for pid in $OPENCODE_PIDS; do
            if ps -p $pid > /dev/null 2>&1; then
                print_warning "Force killing process $pid..."
                kill -KILL $pid 2>/dev/null || true
            fi
        done
        
        print_success "Cleaned up opencode processes."
    else
        print_info "Skipped opencode cleanup."
    fi
fi
echo ""

# Find orphaned node-pty processes
print_info "Searching for node-pty related processes..."
PTY_PIDS=$(pgrep -f "node-pty" || true)

if [ -z "$PTY_PIDS" ]; then
    print_success "No node-pty processes found."
else
    print_warning "Found node-pty processes:"
    ps -f -p $PTY_PIDS || true
    echo ""
    read -p "Kill these processes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        for pid in $PTY_PIDS; do
            print_info "Killing process $pid..."
            kill -TERM $pid 2>/dev/null || true
        done
        
        sleep 1
        
        for pid in $PTY_PIDS; do
            if ps -p $pid > /dev/null 2>&1; then
                print_warning "Force killing process $pid..."
                kill -KILL $pid 2>/dev/null || true
            fi
        done
        
        print_success "Cleaned up node-pty processes."
    else
        print_info "Skipped node-pty cleanup."
    fi
fi
echo ""

# Find zombie processes
print_info "Searching for zombie processes..."
ZOMBIE_PIDS=$(ps aux | awk '$8=="Z" {print $2}' || true)

if [ -z "$ZOMBIE_PIDS" ]; then
    print_success "No zombie processes found."
else
    print_warning "Found zombie processes:"
    ps -f -p $ZOMBIE_PIDS || true
    echo ""
    print_info "Zombie processes need their parent to be killed or restart."
    
    # Find parent processes
    for zombie in $ZOMBIE_PIDS; do
        PARENT_PID=$(ps -o ppid= -p $zombie 2>/dev/null | tr -d ' ')
        if [ -n "$PARENT_PID" ] && [ "$PARENT_PID" != "1" ]; then
            print_warning "Zombie $zombie has parent $PARENT_PID:"
            ps -f -p $PARENT_PID || true
        fi
    done
    echo ""
fi

# Find orphaned shell processes from RI
print_info "Searching for orphaned shell processes..."
# Look for zsh/bash processes that might be from RI terminals
SHELL_PIDS=$(ps aux | grep -E "(/bin/zsh|/bin/bash)" | grep -v grep | grep -v "$$" | awk '{print $2}' || true)

if [ -z "$SHELL_PIDS" ]; then
    print_success "No suspicious shell processes found."
else
    print_info "Found ${#SHELL_PIDS[@]} shell processes (may include legitimate shells)"
    print_warning "Manual review recommended. Not auto-cleaning shell processes."
fi
echo ""

print_success "Cleanup complete!"
echo ""
print_info "Tips to prevent zombie processes:"
echo "  1. Always close tabs before deleting sessions"
echo "  2. Use the application's quit function instead of force-quit"
echo "  3. If you see persistent zombies, restart your terminal"
echo ""
