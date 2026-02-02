#!/bin/bash

# Test script to verify session name synchronization in notifications

echo "======================================"
echo "Session Name Sync Test"
echo "======================================"
echo ""
echo "This script will test if notifications use the current session display name."
echo ""
echo "Instructions:"
echo "1. Create a new terminal session"
echo "2. Run this script: ./test-session-name-sync.sh"
echo "3. The session name will auto-update to 'echo Testing...'"
echo "4. Then notifications will be sent"
echo "5. Check that all notifications show 'echo Testing...' as the session name"
echo ""
echo "Press ENTER to start test..."
read

echo "======================================"
echo "Step 1: Session name will auto-update"
echo "======================================"
echo "Testing session name auto-update..."
sleep 2

echo ""
echo "======================================"
echo "Step 2: Sending test notifications"
echo "======================================"
echo ""

echo "Sending info notification..."
echo "__OM_NOTIFY:info:Session name should be 'echo Testing...'__"
sleep 2

echo "Sending success notification..."
echo "__OM_NOTIFY:success:Check if session name is correct__"
sleep 2

echo "Sending warning notification..."
echo "__OM_NOTIFY:warning:Verify the session name in all channels__"
sleep 2

echo "Sending error notification..."
echo "__OM_NOTIFY:error:Final test notification__"
sleep 2

echo ""
echo "======================================"
echo "Test Complete!"
echo "======================================"
echo ""
echo "Verification checklist:"
echo "✓ Check system notifications - should show 'echo Testing...'"
echo "✓ Check in-app toast notifications - should show 'echo Testing...'"
echo "✓ Check external channels (Slack, Discord, etc.) - should show 'echo Testing...'"
echo ""
echo "Now try manually renaming the session:"
echo "1. Right-click on this session and rename it to 'My Custom Name'"
echo "2. Run this command: echo '__OM_NOTIFY:info:After rename test__'"
echo "3. Verify the notification shows 'My Custom Name'"
echo ""
