#!/bin/bash

# RI Application Local Installer Script
# This script moves the compiled RI.app to the Applications folder and bypasses Gatekeeper.

APP_NAME="RI.app"
SOURCE_PATH="./release/mac-arm64/$APP_NAME"
# For Intel Macs, change to: SOURCE_PATH="./release/mac/$APP_NAME"
if [ ! -d "$SOURCE_PATH" ]; then
    SOURCE_PATH="./release/mac/$APP_NAME"
fi

DEST_PATH="/Applications/$APP_NAME"

echo "🚀 Starting local deployment of $APP_NAME..."

# Check if the source exists
if [ ! -d "$SOURCE_PATH" ]; then
    echo "❌ Error: Compiled application not found at $SOURCE_PATH"
    echo "Please run 'npm run build:local' first."
    exit 1
fi

# Remove existing version if it exists
if [ -d "$DEST_PATH" ]; then
    echo "清理旧版本: $DEST_PATH"
    sudo rm -rf "$DEST_PATH"
fi

# Copy the app
echo "正在安装到 Applications..."
sudo cp -R "$SOURCE_PATH" /Applications/

# Remove quarantine attribute to allow opening without signature errors
echo "正在授权应用 (Bypassing Gatekeeper)..."
sudo xattr -rd com.apple.quarantine "$DEST_PATH"

echo "✅ 安装成功！你现在可以在 Applications 文件夹中打开 RI 了。"
