#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="RI.app"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

# electron-builder uses "mac" instead of "darwin"
case "$OS" in
  darwin) OS="mac" ;;
esac

case "$ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac

RELEASE_DIR="$SCRIPT_DIR/release/${OS}-${ARCH}"
INSTALL_DIR="/Applications"

cd "$SCRIPT_DIR"

echo "==> Building RI app..."
npm run build:local

echo "==> Stopping running RI instances..."
pkill -x "RI" 2>/dev/null || true
sleep 1

echo "==> Removing old installation..."
rm -rf "$INSTALL_DIR/$APP_NAME"

echo "==> Installing to $INSTALL_DIR..."
cp -R "$RELEASE_DIR/$APP_NAME" "$INSTALL_DIR/"

echo "==> Done! RI.app installed to $INSTALL_DIR"
echo "==> Run: open /Applications/RI.app"
