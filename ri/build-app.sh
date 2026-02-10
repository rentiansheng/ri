#!/bin/bash

# Build RI Application
# This script builds the Electron app for production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
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

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

print_info "Starting RI application build process..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Installing dependencies..."
    npm install
    echo ""
fi

# Check if electron-builder is installed
if ! npm list electron-builder --depth=0 >/dev/null 2>&1; then
    print_warning "electron-builder not found. Installing..."
    npm install --save-dev electron-builder
    echo ""
fi

# Clean previous builds
print_info "Cleaning previous builds..."
rm -rf dist/
rm -rf release/
print_success "Cleaned build directories"
echo ""

# Build frontend with Vite
print_info "Building frontend (Vite)..."
npm run build
if [ $? -ne 0 ]; then
    print_error "Frontend build failed!"
    exit 1
fi
print_success "Frontend built successfully"
echo ""

# Determine build target
PLATFORM=$(uname -s)
BUILD_TARGET=""

case "$PLATFORM" in
    Darwin*)
        BUILD_TARGET="mac"
        print_info "Detected platform: macOS"
        ;;
    Linux*)
        BUILD_TARGET="linux"
        print_info "Detected platform: Linux"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        BUILD_TARGET="win"
        print_info "Detected platform: Windows"
        ;;
    *)
        print_warning "Unknown platform: $PLATFORM"
        BUILD_TARGET="mac"
        ;;
esac
echo ""

# Parse command line arguments
QUICK_BUILD=false
SKIP_PACKAGE=false
TARGET_OVERRIDE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --quick|-q)
            QUICK_BUILD=true
            shift
            ;;
        --dir-only|-d)
            SKIP_PACKAGE=true
            shift
            ;;
        --mac)
            TARGET_OVERRIDE="mac"
            shift
            ;;
        --win)
            TARGET_OVERRIDE="win"
            shift
            ;;
        --linux)
            TARGET_OVERRIDE="linux"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --quick, -q        Quick build (dir only, no compression)"
            echo "  --dir-only, -d     Build directory only (no installer)"
            echo "  --mac              Build for macOS"
            echo "  --win              Build for Windows"
            echo "  --linux            Build for Linux"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                 # Full build for current platform"
            echo "  $0 --quick         # Quick build for testing"
            echo "  $0 --mac           # Build macOS app"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Override target if specified
if [ -n "$TARGET_OVERRIDE" ]; then
    BUILD_TARGET="$TARGET_OVERRIDE"
    print_info "Build target overridden: $BUILD_TARGET"
    echo ""
fi

# Build Electron app
if [ "$QUICK_BUILD" = true ]; then
    print_info "Running quick build (no compression)..."
    npx electron-builder --$BUILD_TARGET --dir
elif [ "$SKIP_PACKAGE" = true ]; then
    print_info "Building directory only..."
    npx electron-builder --$BUILD_TARGET --dir
else
    print_info "Building full package for $BUILD_TARGET..."
    npx electron-builder --$BUILD_TARGET
fi

if [ $? -ne 0 ]; then
    print_error "Electron app build failed!"
    exit 1
fi

print_success "Electron app built successfully!"
echo ""

# Show build output location
print_info "Build output location:"
case "$BUILD_TARGET" in
    mac)
        if [ "$SKIP_PACKAGE" = true ] || [ "$QUICK_BUILD" = true ]; then
            echo "  📁 release/mac/RI.app"
            print_info "To run: open release/mac/RI.app"
        else
            echo "  📦 release/RI-*.dmg"
            echo "  📁 release/mac/RI.app"
            print_info "To install: Open the .dmg file"
        fi
        ;;
    linux)
        if [ "$SKIP_PACKAGE" = true ] || [ "$QUICK_BUILD" = true ]; then
            echo "  📁 release/linux-unpacked/"
            print_info "To run: ./release/linux-unpacked/ri"
        else
            echo "  📦 release/RI-*.AppImage"
            echo "  📦 release/RI-*.deb (if built)"
            print_info "To install: chmod +x RI-*.AppImage && ./RI-*.AppImage"
        fi
        ;;
    win)
        if [ "$SKIP_PACKAGE" = true ] || [ "$QUICK_BUILD" = true ]; then
            echo "  📁 release/win-unpacked/"
            print_info "To run: ./release/win-unpacked/RI.exe"
        else
            echo "  📦 release/RI-Setup-*.exe"
            echo "  📦 release/RI-*.exe (portable)"
            print_info "To install: Run the Setup executable"
        fi
        ;;
esac
echo ""

# Show build summary
print_success "==================================="
print_success "✨ Build completed successfully! ✨"
print_success "==================================="
echo ""
print_info "Application name: RI"
print_info "Platform: $BUILD_TARGET"
if [ "$QUICK_BUILD" = true ]; then
    print_info "Build type: Quick (testing)"
elif [ "$SKIP_PACKAGE" = true ]; then
    print_info "Build type: Directory only"
else
    print_info "Build type: Full package"
fi
echo ""
print_info "Next steps:"
echo "  1. Test the built application"
echo "  2. Check the release/ directory for output files"
echo "  3. Distribute or install the package"
echo ""
