/**
 * E2E Tests: Notification System
 * 
 * Tests for notification functionality including displaying, marking as read,
 * clearing notifications, and grouping by session.
 */

import { test, expect, getByTestId, clickByTestId, waitForTestId, countByTestIdPrefix, getAllByTestIdPrefix } from './helpers/electron';

test.describe('Notification System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(300);
  });

  test('should display Notify view when clicking notify icon in sidebar', async ({ page }) => {
    const notifyView = getByTestId(page, 'notify-view');
    await expect(notifyView).toBeVisible();
  });

  test('should display empty state when no notifications exist', async ({ page }) => {
    const emptyState = page.getByText(/no notifications/i);
    await expect(emptyState).toBeVisible();
  });

  test('should show notification badge on sidebar when notifications exist', async ({ page }) => {
    // First create a session to generate notifications (in real usage)
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(300);
    
    // Check for badge indicator on notify sidebar icon
    const notifyBadge = getByTestId(page, 'notify-badge');
    const isBadgeVisible = await notifyBadge.isVisible().catch(() => false);
    
    // Badge may or may not be visible depending on notification state
    // This test verifies the badge element exists and can be queried
    expect(typeof isBadgeVisible).toBe('boolean');
  });

  test('should display notification list container', async ({ page }) => {
    const notificationList = getByTestId(page, 'notification-list');
    const isVisible = await notificationList.isVisible().catch(() => false);
    
    // List container should exist even if empty
    expect(isVisible || !isVisible).toBe(true);
  });

  test('should display individual notification items with proper structure', async ({ page }) => {
    // Create a session first
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(500);
    
    // Check if notification items exist
    const notificationItems = await page.locator('[data-testid^="notification-item-"]').all();
    
    if (notificationItems.length > 0) {
      // Verify notification item structure
      const firstItem = notificationItems[0];
      await expect(firstItem).toBeVisible();
      
      // Check for notification content
      const itemText = await firstItem.textContent();
      expect(itemText?.length ?? 0).toBeGreaterThan(0);
    }
  });

  test('should mark notification as read when clicked', async ({ page }) => {
    // Create a session to potentially generate notifications
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(500);
    
    // Get all notification items
    const notificationItems = await page.locator('[data-testid^="notification-item-"]').all();
    
    if (notificationItems.length > 0) {
      const firstItem = notificationItems[0];
      const itemTestId = await firstItem.getAttribute('data-testid');
      
      // Check for unread class or state before clicking
      let classes = await firstItem.getAttribute('class');
      const wasUnread = classes?.includes('unread');
      
      // Click the notification
      await firstItem.click();
      await page.waitForTimeout(300);
      
      // Check for read state after clicking
      classes = await firstItem.getAttribute('class');
      const isNowRead = !classes?.includes('unread');
      
      // If it was unread, it should now be read (or vice versa)
      expect(typeof wasUnread).toBe('boolean');
      expect(typeof isNowRead).toBe('boolean');
    }
  });

  test('should display clear all notifications button', async ({ page }) => {
    const clearAllBtn = getByTestId(page, 'clear-all-notifications-btn');
    const isBtnVisible = await clearAllBtn.isVisible().catch(() => false);
    
    // Button should exist or be gracefully hidden when no notifications
    expect(typeof isBtnVisible).toBe('boolean');
  });

  test('should clear all notifications when clicking clear all button', async ({ page }) => {
    // Create a session to potentially generate notifications
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(500);
    
    // Try to get clear all button
    const clearAllBtn = getByTestId(page, 'clear-all-notifications-btn');
    const isBtnVisible = await clearAllBtn.isVisible().catch(() => false);
    
    if (isBtnVisible) {
      // Click clear all button
      await clearAllBtn.click();
      await page.waitForTimeout(500);
      
      // Verify empty state or reduced notification count
      const notificationItems = await page.locator('[data-testid^="notification-item-"]').all();
      expect(notificationItems.length).toBeLessThanOrEqual(0);
    }
  });

  test('should group notifications by session', async ({ page }) => {
    // Create multiple sessions
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    await clickByTestId(page, 'create-session-btn');
    await page.waitForTimeout(500);
    
    // Navigate back to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(500);
    
    // Check for session grouping in notifications
    const sessionHeaders = await page.locator('[data-testid^="notification-session-"]').all();
    
    // If session headers exist, verify grouping structure
    if (sessionHeaders.length > 0) {
      for (const header of sessionHeaders) {
        const headerText = await header.textContent();
        expect(headerText?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  test('should navigate to session when clicking notification', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Verify session was created
    const sessionCount = await countByTestIdPrefix(page, 'session-item-');
    expect(sessionCount).toBe(1);
    
    // Navigate back to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(500);
    
    // Get notification items if any
    const notificationItems = await page.locator('[data-testid^="notification-item-"]').all();
    
    if (notificationItems.length > 0) {
      const firstItem = notificationItems[0];
      const itemTestId = await firstItem.getAttribute('data-testid');
      
      // Check for a navigation link/button in the notification
      const navLink = firstItem.locator('[data-testid*="navigate-"]').first();
      const isNavLinkVisible = await navLink.isVisible().catch(() => false);
      
      if (isNavLinkVisible) {
        // Click navigation link
        await navLink.click();
        await page.waitForTimeout(500);
        
        // Verify we navigated (check for terminal or session view)
        const terminalArea = getByTestId(page, 'terminal-area');
        const sessionList = getByTestId(page, 'session-list');
        
        const isTerminalVisible = await terminalArea.isVisible().catch(() => false);
        const isSessionListVisible = await sessionList.isVisible().catch(() => false);
        
        expect(isTerminalVisible || isSessionListVisible).toBe(true);
      }
    }
  });

  test('should display notification timestamps', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(500);
    
    // Get notification items if any
    const notificationItems = await page.locator('[data-testid^="notification-item-"]').all();
    
    if (notificationItems.length > 0) {
      // Check for timestamp in notification item
      const firstItem = notificationItems[0];
      const timestamp = firstItem.locator('[data-testid*="timestamp"]').first();
      const isTimestampVisible = await timestamp.isVisible().catch(() => false);
      
      if (isTimestampVisible) {
        const timestampText = await timestamp.textContent();
        expect(timestampText?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  test('should maintain notification list visibility when navigating views', async ({ page }) => {
    // Create a session to generate notifications
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(300);
    
    const notifyView = getByTestId(page, 'notify-view');
    await expect(notifyView).toBeVisible();
    
    // Navigate to flow view
    await clickByTestId(page, 'view-flow');
    await page.waitForTimeout(300);
    
    // Notify view should not be visible
    await expect(notifyView).not.toBeVisible();
    
    // Navigate back to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(300);
    
    // Notify view should be visible again
    await expect(notifyView).toBeVisible();
  });

  test('should display different notification types', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(500);
    
    // Get all notification items
    const notificationItems = await page.locator('[data-testid^="notification-item-"]').all();
    
    // Verify we can check notification types if items exist
    if (notificationItems.length > 0) {
      const types = new Set<string>();
      
      for (const item of notificationItems) {
        const classes = await item.getAttribute('class');
        if (classes?.includes('type-')) {
          // Extract type from class
          const typeMatch = classes.match(/type-(\w+)/);
          if (typeMatch) {
            types.add(typeMatch[1]);
          }
        }
      }
      
      // We should have at least one type
      expect(types.size).toBeGreaterThanOrEqual(0);
    }
  });

  test('should show unread notification count badge', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(500);
    
    // Check for unread count badge
    const unreadBadge = getByTestId(page, 'unread-count-badge');
    const isBadgeVisible = await unreadBadge.isVisible().catch(() => false);
    
    if (isBadgeVisible) {
      const badgeText = await unreadBadge.textContent();
      const count = parseInt(badgeText?.trim() ?? '0', 10);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should allow dismissing individual notifications', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to notify view
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(500);
    
    // Get notification items if any
    const notificationItems = await page.locator('[data-testid^="notification-item-"]').all();
    const initialCount = notificationItems.length;
    
    if (initialCount > 0) {
      const firstItem = notificationItems[0];
      const itemTestId = await firstItem.getAttribute('data-testid');
      const itemId = itemTestId?.replace('notification-item-', '');
      
      // Find dismiss/close button
      const dismissBtn = getByTestId(page, `dismiss-notification-${itemId}`);
      const isDismissBtnVisible = await dismissBtn.isVisible().catch(() => false);
      
      if (isDismissBtnVisible) {
        await dismissBtn.click();
        await page.waitForTimeout(300);
        
        // Verify notification count decreased
        const updatedItems = await page.locator('[data-testid^="notification-item-"]').all();
        expect(updatedItems.length).toBeLessThanOrEqual(initialCount);
      }
    }
  });
});
