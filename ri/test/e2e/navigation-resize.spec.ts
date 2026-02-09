/**
 * E2E Tests: Navigation Panel Resize
 * 
 * Tests for resizing the navigation panel (session list) by dragging the resize handle.
 */

import { test, expect, getByTestId, clickByTestId, waitForTestId } from './helpers/electron';

test.describe('Navigation Panel Resize', () => {
  test.beforeEach(async ({ page }) => {
    // Create a session first so we have the navigation panel visible
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
  });

  test('should display navigation panel and resize handle', async ({ page }) => {
    // Verify navigation panel is visible
    const navPanel = getByTestId(page, 'navigation-panel');
    await expect(navPanel).toBeVisible();
    
    // Verify resize handle is visible
    const resizeHandle = getByTestId(page, 'navigation-resize-handle');
    await expect(resizeHandle).toBeVisible();
  });

  test('should have default width of 250px', async ({ page }) => {
    const navPanel = getByTestId(page, 'navigation-panel');
    
    // Get computed width
    const width = await navPanel.evaluate((el) => {
      return window.getComputedStyle(el).width;
    });
    
    // Default width should be 250px
    expect(width).toBe('250px');
  });

  test('should increase navigation panel width when dragging right', async ({ page }) => {
    const navPanel = getByTestId(page, 'navigation-panel');
    const resizeHandle = getByTestId(page, 'navigation-resize-handle');
    
    // Get initial width
    const initialWidth = await navPanel.evaluate((el) => {
      return el.getBoundingClientRect().width;
    });
    
    // Get resize handle position
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    
    if (!handleBox) return;
    
    // Drag the handle 100px to the right
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 100, handleBox.y + handleBox.height / 2, { steps: 10 });
    await page.mouse.up();
    
    // Wait for animation/state update
    await page.waitForTimeout(500);
    
    // Get new width
    const newWidth = await navPanel.evaluate((el) => {
      return el.getBoundingClientRect().width;
    });
    
    // Width should have increased
    expect(newWidth).toBeGreaterThan(initialWidth);
    expect(newWidth).toBeCloseTo(initialWidth + 100, 10); // Allow 10px tolerance
  });

  test('should decrease navigation panel width when dragging left', async ({ page }) => {
    const navPanel = getByTestId(page, 'navigation-panel');
    const resizeHandle = getByTestId(page, 'navigation-resize-handle');
    
    // Get initial width
    const initialWidth = await navPanel.evaluate((el) => {
      return el.getBoundingClientRect().width;
    });
    
    // Get resize handle position
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    
    if (!handleBox) return;
    
    // Drag the handle 50px to the left
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 50, handleBox.y + handleBox.height / 2, { steps: 10 });
    await page.mouse.up();
    
    // Wait for animation/state update
    await page.waitForTimeout(500);
    
    // Get new width
    const newWidth = await navPanel.evaluate((el) => {
      return el.getBoundingClientRect().width;
    });
    
    // Width should have decreased
    expect(newWidth).toBeLessThan(initialWidth);
    expect(newWidth).toBeCloseTo(initialWidth - 50, 10); // Allow 10px tolerance
  });

  test('should respect minimum width constraint (150px)', async ({ page }) => {
    const navPanel = getByTestId(page, 'navigation-panel');
    const resizeHandle = getByTestId(page, 'navigation-resize-handle');
    
    // Get resize handle position
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    
    if (!handleBox) return;
    
    // Try to drag the handle far to the left (beyond minimum)
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 200, handleBox.y + handleBox.height / 2, { steps: 10 });
    await page.mouse.up();
    
    // Wait for animation/state update
    await page.waitForTimeout(500);
    
    // Get new width
    const newWidth = await navPanel.evaluate((el) => {
      return el.getBoundingClientRect().width;
    });
    
    // Width should not be less than 150px
    expect(newWidth).toBeGreaterThanOrEqual(150);
  });

  test('should respect maximum width constraint (500px)', async ({ page }) => {
    const navPanel = getByTestId(page, 'navigation-panel');
    const resizeHandle = getByTestId(page, 'navigation-resize-handle');
    
    // Get resize handle position
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    
    if (!handleBox) return;
    
    // Try to drag the handle far to the right (beyond maximum)
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 400, handleBox.y + handleBox.height / 2, { steps: 10 });
    await page.mouse.up();
    
    // Wait for animation/state update
    await page.waitForTimeout(500);
    
    // Get new width
    const newWidth = await navPanel.evaluate((el) => {
      return el.getBoundingClientRect().width;
    });
    
    // Width should not exceed 500px
    expect(newWidth).toBeLessThanOrEqual(500);
  });

  test('should hide navigation panel when navigating to settings', async ({ page }) => {
    const navPanel = getByTestId(page, 'navigation-panel');
    const resizeHandle = getByTestId(page, 'navigation-resize-handle');
    
    // Verify both are visible initially
    await expect(navPanel).toBeVisible();
    await expect(resizeHandle).toBeVisible();
    
    // Navigate to settings
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    
    // Navigation panel and resize handle should not be visible
    await expect(navPanel).not.toBeVisible();
    await expect(resizeHandle).not.toBeVisible();
  });

  test('should show navigation panel when navigating back to sessions', async ({ page }) => {
    const navPanel = getByTestId(page, 'navigation-panel');
    
    // Navigate to settings (hides navigation)
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await expect(navPanel).not.toBeVisible();
    
    // Navigate back to sessions
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    // Navigation panel should be visible again
    await expect(navPanel).toBeVisible();
  });

  test('should maintain resized width when switching views', async ({ page }) => {
    const navPanel = getByTestId(page, 'navigation-panel');
    const resizeHandle = getByTestId(page, 'navigation-resize-handle');
    
    // Resize to 350px
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    
    if (!handleBox) return;
    
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 100, handleBox.y + handleBox.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    // Get the new width
    const resizedWidth = await navPanel.evaluate((el) => {
      return el.getBoundingClientRect().width;
    });
    
    // Navigate to notify view (which also shows navigation panel)
    await clickByTestId(page, 'view-notify');
    await page.waitForTimeout(300);
    
    // Navigate back to sessions
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    // Width should be maintained
    const maintainedWidth = await navPanel.evaluate((el) => {
      return el.getBoundingClientRect().width;
    });
    
    expect(maintainedWidth).toBeCloseTo(resizedWidth, 5);
  });
});
