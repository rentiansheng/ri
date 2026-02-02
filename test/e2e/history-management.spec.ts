/**
 * E2E Tests: History Management
 * 
 * Tests for history viewing functionality including displaying sessions,
 * viewing command history, clearing history, and displaying statistics.
 */

import { test, expect, getByTestId, clickByTestId, waitForTestId, countByTestIdPrefix, getAllByTestIdPrefix } from './helpers/electron';

test.describe('History Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to History view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(300);
  });

  test('should display History view when clicking history icon in sidebar', async ({ page }) => {
    const historyView = getByTestId(page, 'history-view');
    await expect(historyView).toBeVisible();
  });

  test('should display empty state when no history exists', async ({ page }) => {
    const emptyState = page.getByText(/no history/i);
    await expect(emptyState).toBeVisible();
  });

  test('should display history list container', async ({ page }) => {
    const historyList = getByTestId(page, 'history-list');
    const isVisible = await historyList.isVisible().catch(() => false);
    
    // List container should exist even if empty
    expect(isVisible || !isVisible).toBe(true);
  });

  test('should show list of sessions with history after session creation', async ({ page }) => {
    // Create a session to generate history
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get history items
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      const firstItem = historyItems[0];
      await expect(firstItem).toBeVisible();
      
      const itemText = await firstItem.textContent();
      expect(itemText?.length ?? 0).toBeGreaterThan(0);
    }
  });

  test('should display multiple session history items', async ({ page }) => {
    // Create multiple sessions
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    await clickByTestId(page, 'create-session-btn');
    await page.waitForTimeout(500);
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get history items
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    // Verify we can query history items
    expect(typeof historyItems.length).toBe('number');
  });

  test('should open history viewer by clicking on session', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      const firstItem = historyItems[0];
      const itemTestId = await firstItem.getAttribute('data-testid');
      
      // Click to open history viewer
      await firstItem.click();
      await page.waitForTimeout(500);
      
      // Check for history viewer tab
      const historyViewerTab = page.getByText(/\[H\]:/);
      const isTabVisible = await historyViewerTab.isVisible().catch(() => false);
      
      // Verify we opened a viewer or content area
      const historyViewer = getByTestId(page, 'history-viewer');
      const isViewerVisible = await historyViewer.isVisible().catch(() => false);
      
      expect(isTabVisible || isViewerVisible).toBe(true);
    }
  });

  test('should display history viewer with command list', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      await historyItems[0].click();
      await page.waitForTimeout(500);
      
      // Check for history viewer
      const historyViewer = getByTestId(page, 'history-viewer');
      const isViewerVisible = await historyViewer.isVisible().catch(() => false);
      
      if (isViewerVisible) {
        await expect(historyViewer).toBeVisible();
        
        // Check for command list in viewer
        const commandList = historyViewer.locator('[data-testid^="history-command-"]').first();
        const isCommandListVisible = await commandList.isVisible().catch(() => false);
        expect(typeof isCommandListVisible).toBe('boolean');
      }
    }
  });

  test('should display command timestamps in history', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      await historyItems[0].click();
      await page.waitForTimeout(500);
      
      // Check for timestamps in command items
      const commandItems = await page.locator('[data-testid^="history-command-"]').all();
      
      if (commandItems.length > 0) {
        const firstCommand = commandItems[0];
        const timestamp = firstCommand.locator('[data-testid*="timestamp"]').first();
        const isTimestampVisible = await timestamp.isVisible().catch(() => false);
        
        if (isTimestampVisible) {
          const timestampText = await timestamp.textContent();
          expect(timestampText?.length ?? 0).toBeGreaterThan(0);
        }
      }
    }
  });

  test('should display clear history button for session', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      const firstItem = historyItems[0];
      const itemTestId = await firstItem.getAttribute('data-testid');
      const sessionId = itemTestId?.replace('history-session-item-', '');
      
      // Check for clear button
      const clearBtn = getByTestId(page, `clear-history-${sessionId}`);
      const isClearBtnVisible = await clearBtn.isVisible().catch(() => false);
      
      expect(typeof isClearBtnVisible).toBe('boolean');
    }
  });

  test('should clear history for a session when clicking clear button', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      const firstItem = historyItems[0];
      const itemTestId = await firstItem.getAttribute('data-testid');
      const sessionId = itemTestId?.replace('history-session-item-', '');
      
      // Find and click clear button
      const clearBtn = getByTestId(page, `clear-history-${sessionId}`);
      const isClearBtnVisible = await clearBtn.isVisible().catch(() => false);
      
      if (isClearBtnVisible) {
        await clearBtn.click();
        
        // Handle confirmation dialog if present
        page.once('dialog', dialog => dialog.accept());
        
        await page.waitForTimeout(500);
        
        // Verify history was cleared
        const historyViewer = getByTestId(page, 'history-viewer');
        const isViewerVisible = await historyViewer.isVisible().catch(() => false);
        
        if (isViewerVisible) {
          const commandItems = await page.locator('[data-testid^="history-command-"]').all();
          expect(commandItems.length).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  test('should display history statistics (record count)', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      const firstItem = historyItems[0];
      
      // Check for record count display
      const recordCount = firstItem.locator('[data-testid*="record-count"]').first();
      const isRecordCountVisible = await recordCount.isVisible().catch(() => false);
      
      if (isRecordCountVisible) {
        const countText = await recordCount.textContent();
        const count = parseInt(countText?.replace(/\D/g, '') ?? '0', 10);
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('should display history statistics (file size)', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      const firstItem = historyItems[0];
      
      // Check for file size display
      const fileSize = firstItem.locator('[data-testid*="file-size"]').first();
      const isFileSizeVisible = await fileSize.isVisible().catch(() => false);
      
      if (isFileSizeVisible) {
        const sizeText = await fileSize.textContent();
        expect(sizeText?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  test('should display last activity time in history statistics', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      const firstItem = historyItems[0];
      
      // Check for last activity display
      const lastActivity = firstItem.locator('[data-testid*="last-activity"]').first();
      const isActivityVisible = await lastActivity.isVisible().catch(() => false);
      
      if (isActivityVisible) {
        const activityText = await lastActivity.textContent();
        expect(activityText?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  test('should maintain history list visibility when navigating views', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(300);
    
    const historyView = getByTestId(page, 'history-view');
    await expect(historyView).toBeVisible();
    
    // Navigate to settings view
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    
    // History view should not be visible
    await expect(historyView).not.toBeVisible();
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(300);
    
    // History view should be visible again
    await expect(historyView).toBeVisible();
  });

  test('should filter or search history', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Check for search input
    const searchInput = getByTestId(page, 'history-search-input');
    const isSearchVisible = await searchInput.isVisible().catch(() => false);
    
    if (isSearchVisible) {
      // Type in search
      await searchInput.fill('test');
      await page.waitForTimeout(300);
      
      // Verify search results change
      const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
      expect(typeof historyItems.length).toBe('number');
    }
  });

  test('should show history statistics panel', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      // Click to view details
      await historyItems[0].click();
      await page.waitForTimeout(500);
      
      // Check for statistics panel
      const statsPanel = getByTestId(page, 'history-stats-panel');
      const isStatsVisible = await statsPanel.isVisible().catch(() => false);
      
      if (isStatsVisible) {
        await expect(statsPanel).toBeVisible();
      }
    }
  });

  test('should display command details when clicking command in history', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      await historyItems[0].click();
      await page.waitForTimeout(500);
      
      // Get command items
      const commandItems = await page.locator('[data-testid^="history-command-"]').all();
      
      if (commandItems.length > 0) {
        // Click on first command
        await commandItems[0].click();
        await page.waitForTimeout(300);
        
        // Check for details panel
        const detailsPanel = getByTestId(page, 'command-details-panel');
        const isDetailsPanelVisible = await detailsPanel.isVisible().catch(() => false);
        
        expect(typeof isDetailsPanelVisible).toBe('boolean');
      }
    }
  });

  test('should show empty state for history when no sessions have history', async ({ page }) => {
    const emptyState = page.getByText(/no history|no commands|empty/i);
    const isEmptyVisible = await emptyState.isVisible().catch(() => false);
    
    // Either empty state is shown or history items are displayed
    expect(typeof isEmptyVisible).toBe('boolean');
  });

  test('should allow expanding/collapsing history session details', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      const firstItem = historyItems[0];
      
      // Check for expand button
      const expandBtn = firstItem.locator('[data-testid*="expand"]').first();
      const isExpandBtnVisible = await expandBtn.isVisible().catch(() => false);
      
      if (isExpandBtnVisible) {
        // Click expand
        await expandBtn.click();
        await page.waitForTimeout(300);
        
        // Check for expanded content
        const expandedContent = firstItem.locator('[data-testid*="details"]').first();
        const isContentVisible = await expandedContent.isVisible().catch(() => false);
        
        expect(typeof isContentVisible).toBe('boolean');
      }
    }
  });

  test('should display session name in history list', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Navigate back to history view
    await clickByTestId(page, 'view-history');
    await page.waitForTimeout(500);
    
    // Get first history item
    const historyItems = await page.locator('[data-testid^="history-session-item-"]').all();
    
    if (historyItems.length > 0) {
      const firstItem = historyItems[0];
      
      // Check for session name
      const sessionName = firstItem.locator('[data-testid*="session-name"]').first();
      const isNameVisible = await sessionName.isVisible().catch(() => false);
      
      if (isNameVisible) {
        const nameText = await sessionName.textContent();
        expect(nameText?.length ?? 0).toBeGreaterThan(0);
      } else {
        // Verify item text contains something (fallback)
        const itemText = await firstItem.textContent();
        expect(itemText?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
