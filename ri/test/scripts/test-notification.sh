#!/bin/bash

# Test notification script for Second Brain OS
# This script triggers a notification in the terminal

echo "Testing notification system..."
echo ""

# Test 1: Info notification
echo "Test 1: Sending info notification..."
echo '__OM_NOTIFY:info:This is a test info notification__'
sleep 2

# Test 2: Success notification
echo "Test 2: Sending success notification..."
echo '__OM_NOTIFY:success:Task completed successfully!__'
sleep 2

# Test 3: Error notification
echo "Test 3: Sending error notification..."
echo '__OM_NOTIFY:error:Something went wrong!__'
sleep 2

# Test 4: Completed notification
echo "Test 4: Sending completed notification..."
echo '__OM_NOTIFY:completed:Build finished!__'
sleep 2

echo ""
echo "All test notifications sent!"
echo ""
echo "=== How to Test Notifications ==="
echo ""
echo "The session name is displayed in all notifications."
echo ""
echo "Ways to navigate and clear notifications:"
echo ""
echo "1. Click a NOTIFICATION (toast or system):"
echo "   → Navigates to the session"
echo "   → Dismisses ONLY that specific notification"
echo ""
echo "2. Click a SESSION in the session list:"
echo "   → Navigates to the session"
echo "   → Clears ALL notifications for that session"
echo ""
echo "3. Click a TAB in the tab bar:"
echo "   → Switches to that session"
echo "   → Clears ALL notifications for that session"
echo ""
echo "Try creating multiple sessions and sending notifications from each!"
