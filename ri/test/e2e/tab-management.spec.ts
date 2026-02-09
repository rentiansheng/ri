/**
 * E2E Tests: Tab Management
 * 
 * Tests for tab bar functionality including opening, switching, closing, and reordering tabs.
 */

import { test, expect, getByTestId, clickByTestId, waitForTestId, countByTestIdPrefix, getAllByTestIdPrefix } from './helpers/electron';

test.describe('Tab Management', () => {
  test('should not show tab bar when no sessions exist', async ({ page }) => {
    // Tab bar should not be visible on welcome screen
    const tabBar = getByTestId(page, 'tab-bar');
    await expect(tabBar).not.toBeVisible();
  });

  test('should show tab bar after creating first session', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'create-session-btn-welcome');
    await page.waitForTimeout(500);
    
    // Tab bar should now be visible
    const tabBar = getByTestId(page, 'tab-bar');
    await expect(tabBar).toBeVisible();
    
    // Should have one tab
    const tabCount = await countByTestIdPrefix(page, 'tab-');
    expect(tabCount).toBe(1);
  });

  test('should create new tab when creating new session', async ({ page }) => {
    // Create first session
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Create second session
    await clickByTestId(page, 'create-session-btn');
    await page.waitForTimeout(500);
    
    // Should have two tabs
    const tabCount = await countByTestIdPrefix(page, 'tab-');
    expect(tabCount).toBe(2);
  });

  test('should show active tab with active class', async ({ page }) => {
    // Create two sessions
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    await clickByTestId(page, 'create-session-btn');
    await page.waitForTimeout(500);
    
    // Get all tabs
    const tabs = await getAllByTestIdPrefix(page, 'tab-').all();
    expect(tabs.length).toBe(2);
    
    // The second tab (most recently created) should be active
    const secondTabClasses = await tabs[1].getAttribute('class');
    expect(secondTabClasses).toContain('active');
  });

  test('should switch tabs when clicking on different tab', async ({ page }) => {
    // Create two sessions
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    await clickByTestId(page, 'create-session-btn');
    await page.waitForTimeout(500);
    
    // Get all tabs
    const tabs = await getAllByTestIdPrefix(page, 'tab-').all();
    
    // Click on first tab
    await tabs[0].click();
    await page.waitForTimeout(300);
    
    // First tab should now be active
    const firstTabClasses = await tabs[0].getAttribute('class');
    expect(firstTabClasses).toContain('active');
    
    // Click on second tab
    await tabs[1].click();
    await page.waitForTimeout(300);
    
    // Second tab should now be active
    const secondTabClasses = await tabs[1].getAttribute('class');
    expect(secondTabClasses).toContain('active');
  });

  test('should close tab when clicking close button', async ({ page }) => {
    // Create two sessions
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    await clickByTestId(page, 'create-session-btn');
    await page.waitForTimeout(500);
    
    // Verify we have 2 tabs
    let tabCount = await countByTestIdPrefix(page, 'tab-');
    expect(tabCount).toBe(2);
    
    // Get all tabs
    const tabs = await getAllByTestIdPrefix(page, 'tab-').all();
    
    // Get the first tab's ID from its test-id attribute
    const firstTabTestId = await tabs[0].getAttribute('data-testid');
    const tabId = firstTabTestId?.replace('tab-', '');
    
    // Find and click the close button for first tab
    const closeBtn = getByTestId(page, `close-tab-${tabId}`);
    await closeBtn.click();
    await page.waitForTimeout(500);
    
    // Should now have 1 tab
    tabCount = await countByTestIdPrefix(page, 'tab-');
    expect(tabCount).toBe(1);
  });

  test('should hide tab bar when all tabs are closed', async ({ page }) => {
    // Create one session
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Get the tab
    const tabs = await getAllByTestIdPrefix(page, 'tab-').all();
    expect(tabs.length).toBe(1);
    
    // Get the tab's ID
    const tabTestId = await tabs[0].getAttribute('data-testid');
    const tabId = tabTestId?.replace('tab-', '');
    
    // Close the tab
    const closeBtn = getByTestId(page, `close-tab-${tabId}`);
    await closeBtn.click();
    await page.waitForTimeout(500);
    
    // Tab bar should not be visible
    const tabBar = getByTestId(page, 'tab-bar');
    await expect(tabBar).not.toBeVisible();
  });

  test('should support drag and drop tab reordering', async ({ page }) => {
    // Create three sessions
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    await clickByTestId(page, 'create-session-btn');
    await page.waitForTimeout(500);
    await clickByTestId(page, 'create-session-btn');
    await page.waitForTimeout(500);
    
    // Get all tabs
    const tabs = await getAllByTestIdPrefix(page, 'tab-').all();
    expect(tabs.length).toBe(3);
    
    // Get the test-id of first and last tab to track them
    const firstTabId = await tabs[0].getAttribute('data-testid');
    const lastTabId = await tabs[2].getAttribute('data-testid');
    
    // Drag first tab to the position of the last tab
    const firstTabBox = await tabs[0].boundingBox();
    const lastTabBox = await tabs[2].boundingBox();
    
    if (firstTabBox && lastTabBox) {
      // Perform drag operation
      await page.mouse.move(
        firstTabBox.x + firstTabBox.width / 2,
        firstTabBox.y + firstTabBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        lastTabBox.x + lastTabBox.width / 2,
        lastTabBox.y + lastTabBox.height / 2,
        { steps: 10 }
      );
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Get tabs again after reordering
      const reorderedTabs = await getAllByTestIdPrefix(page, 'tab-').all();
      
      // The tab that was first should now be in a different position
      const firstTabNewPosition = await reorderedTabs[0].getAttribute('data-testid');
      expect(firstTabNewPosition).not.toBe(firstTabId);
    }
  });

  test('should open settings tab when clicking settings view', async ({ page }) => {
    // Click on settings view
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(500);
    
    // Tab bar should be visible
    const tabBar = getByTestId(page, 'tab-bar');
    await expect(tabBar).toBeVisible();
    
    // Should have one tab (settings)
    const tabCount = await countByTestIdPrefix(page, 'tab-');
    expect(tabCount).toBe(1);
    
    // Tab should show settings content
    const tabs = await getAllByTestIdPrefix(page, 'tab-').all();
    const tabTitle = await tabs[0].locator('.tab-title').textContent();
    expect(tabTitle).toContain('Settings');
  });

  test('should not duplicate settings tab when clicking settings again', async ({ page }) => {
    // Click on settings view twice
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(500);
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(500);
    
    // Should still have only one tab
    const tabCount = await countByTestIdPrefix(page, 'tab-');
    expect(tabCount).toBe(1);
  });

  test('should show both session tabs and settings tab together', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Open settings
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(500);
    
    // Should have two tabs (one session, one settings)
    const tabCount = await countByTestIdPrefix(page, 'tab-');
    expect(tabCount).toBe(2);
  });

  test('should maintain tab order when adding new session', async ({ page }) => {
    // Create session
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Open settings
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(500);
    
    // Create another session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn');
    await page.waitForTimeout(500);
    
    // Should have three tabs
    const tabCount = await countByTestIdPrefix(page, 'tab-');
    expect(tabCount).toBe(3);
    
    // New session tab should be the active one
    const tabs = await getAllByTestIdPrefix(page, 'tab-').all();
    const lastTabClasses = await tabs[tabs.length - 1].getAttribute('class');
    expect(lastTabClasses).toContain('active');
  });
});
