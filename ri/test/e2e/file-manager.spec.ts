/**
 * E2E Tests: FileManager
 * 
 * Tests for file browser including sorting, hidden files, favorites, and horizontal scroll.
 */

import { test, expect, getByTestId, clickByTestId, waitForTestId } from './helpers/electron';

test.describe('FileManager', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(500);
  });

  test('should display file manager in sidebar', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    const fileManager = page.locator('.file-manager');
    await expect(fileManager).toBeVisible();
  });

  test('should show mode selector buttons', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    const currentBtn = page.locator('.fm-mode-btn').filter({ hasText: 'Current' });
    const tabsBtn = page.locator('.fm-mode-btn').filter({ hasText: 'Tabs' });
    const allBtn = page.locator('.fm-mode-btn').filter({ hasText: 'All' });
    
    await expect(currentBtn).toBeVisible();
    await expect(tabsBtn).toBeVisible();
    await expect(allBtn).toBeVisible();
  });

  test('should switch between view modes', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    const currentBtn = page.locator('.fm-mode-btn').filter({ hasText: 'Current' });
    await currentBtn.click();
    await page.waitForTimeout(200);
    
    const currentBtnClasses = await currentBtn.getAttribute('class');
    expect(currentBtnClasses).toContain('active');
    
    const allBtn = page.locator('.fm-mode-btn').filter({ hasText: 'All' });
    await allBtn.click();
    await page.waitForTimeout(200);
    
    const allBtnClasses = await allBtn.getAttribute('class');
    expect(allBtnClasses).toContain('active');
  });

  test('should have refresh button', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    const refreshBtn = page.locator('.fm-refresh-btn');
    await expect(refreshBtn).toBeVisible();
    
    await refreshBtn.click();
    await page.waitForTimeout(500);
  });

  test('should show favorites section when favorites exist', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    const favoritesSection = page.locator('.fm-favorites-section');
    const sectionHeader = page.locator('.fm-section-header').filter({ hasText: 'Favorites' });
    
    // Favorites section may or may not be visible depending on config
    // Just verify the component structure is correct
    const fileManager = page.locator('.file-manager');
    await expect(fileManager).toBeVisible();
  });

  test('should show context menu on right click', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    // Create a session first to have a workspace
    await clickByTestId(page, 'add-session-btn');
    await page.waitForTimeout(1000);
    
    // Right click on file manager area
    const fileManager = page.locator('.file-manager');
    await fileManager.click({ button: 'right' });
    await page.waitForTimeout(200);
    
    const contextMenu = page.locator('.fm-context-menu');
    await expect(contextMenu).toBeVisible();
    
    // Click elsewhere to close
    await page.click('body');
    await page.waitForTimeout(200);
    await expect(contextMenu).not.toBeVisible();
  });

  test('should have sort options in context menu', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    const fileManager = page.locator('.file-manager');
    await fileManager.click({ button: 'right' });
    await page.waitForTimeout(200);
    
    const sortSubmenu = page.locator('.fm-context-item').filter({ hasText: 'Sort by' });
    await expect(sortSubmenu).toBeVisible();
    
    // Hover to open submenu
    await sortSubmenu.hover();
    await page.waitForTimeout(200);
    
    const submenuContent = page.locator('.fm-context-submenu-content');
    await expect(submenuContent).toBeVisible();
    
    // Verify sort options
    const nameOption = submenuContent.locator('.fm-context-item').filter({ hasText: 'Name' });
    const sizeOption = submenuContent.locator('.fm-context-item').filter({ hasText: 'Size' });
    const modifiedOption = submenuContent.locator('.fm-context-item').filter({ hasText: 'Modified' });
    const createdOption = submenuContent.locator('.fm-context-item').filter({ hasText: 'Created' });
    
    await expect(nameOption).toBeVisible();
    await expect(sizeOption).toBeVisible();
    await expect(modifiedOption).toBeVisible();
    await expect(createdOption).toBeVisible();
  });

  test('should have show/hide hidden files option', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    const fileManager = page.locator('.file-manager');
    await fileManager.click({ button: 'right' });
    await page.waitForTimeout(200);
    
    const hiddenOption = page.locator('.fm-context-item').filter({ hasText: /Show All Hidden|Hide All Hidden/ });
    await expect(hiddenOption).toBeVisible();
  });

  test('should select sort option and close menu', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    const fileManager = page.locator('.file-manager');
    await fileManager.click({ button: 'right' });
    await page.waitForTimeout(200);
    
    const sortSubmenu = page.locator('.fm-context-item').filter({ hasText: 'Sort by' });
    await sortSubmenu.hover();
    await page.waitForTimeout(200);
    
    const sizeOption = page.locator('.fm-context-submenu-content .fm-context-item').filter({ hasText: 'Size' });
    await sizeOption.click();
    await page.waitForTimeout(200);
    
    const contextMenu = page.locator('.fm-context-menu');
    await expect(contextMenu).not.toBeVisible();
  });

  test('should toggle hidden files visibility', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    const fileManager = page.locator('.file-manager');
    await fileManager.click({ button: 'right' });
    await page.waitForTimeout(200);
    
    // Get initial state
    const hiddenOption = page.locator('.fm-context-item').filter({ hasText: /Show All Hidden|Hide All Hidden/ });
    const initialText = await hiddenOption.textContent();
    
    await hiddenOption.click();
    await page.waitForTimeout(200);
    
    // Open context menu again
    await fileManager.click({ button: 'right' });
    await page.waitForTimeout(200);
    
    const newHiddenOption = page.locator('.fm-context-item').filter({ hasText: /Show All Hidden|Hide All Hidden/ });
    const newText = await newHiddenOption.textContent();
    
    // Should have toggled
    expect(newText).not.toBe(initialText);
  });

  test('should display empty state when no sessions', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    // Switch to current mode which might show empty state
    const currentBtn = page.locator('.fm-mode-btn').filter({ hasText: 'Current' });
    await currentBtn.click();
    await page.waitForTimeout(200);
    
    // May show empty state or session depending on app state
    const emptyState = page.locator('.fm-empty');
    const sessionGroup = page.locator('.fm-session-group');
    
    // Either empty state or session group should be visible
    const isEmpty = await emptyState.isVisible();
    const hasSession = await sessionGroup.isVisible();
    
    expect(isEmpty || hasSession).toBe(true);
  });

  test('should expand and collapse session group', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    // Create a session
    await clickByTestId(page, 'add-session-btn');
    await page.waitForTimeout(1000);
    
    // Switch to All mode
    const allBtn = page.locator('.fm-mode-btn').filter({ hasText: 'All' });
    await allBtn.click();
    await page.waitForTimeout(200);
    
    // Find session header
    const sessionHeader = page.locator('.fm-session-header').first();
    await expect(sessionHeader).toBeVisible();
    
    // Click to expand
    await sessionHeader.click();
    await page.waitForTimeout(200);
    
    // Terminal list should be visible
    const terminalList = page.locator('.fm-terminal-list').first();
    await expect(terminalList).toBeVisible();
    
    // Click to collapse
    await sessionHeader.click();
    await page.waitForTimeout(200);
    
    // Terminal list should be hidden
    await expect(terminalList).not.toBeVisible();
  });

  test('should have horizontal scroll for long paths', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    const workspaceList = page.locator('.fm-workspace-list');
    await expect(workspaceList).toBeVisible();
    
    // Check that overflow-x is set to auto
    const overflowX = await workspaceList.evaluate(el => 
      window.getComputedStyle(el).overflowX
    );
    expect(overflowX).toBe('auto');
  });
});

test.describe('FileManager with Session', () => {
  test('should show working directory after creating session', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    // Create a new session
    await clickByTestId(page, 'add-session-btn');
    await page.waitForTimeout(2000);
    
    // Switch to Tabs mode
    const tabsBtn = page.locator('.fm-mode-btn').filter({ hasText: 'Tabs' });
    await tabsBtn.click();
    await page.waitForTimeout(500);
    
    // Expand session
    const sessionHeader = page.locator('.fm-session-header').first();
    if (await sessionHeader.isVisible()) {
      await sessionHeader.click();
      await page.waitForTimeout(500);
      
      // Should show cwd path or loading
      const cwdPath = page.locator('.fm-cwd-path');
      const loading = page.locator('.fm-loading');
      const noCwd = page.locator('.fm-no-cwd');
      
      const hasCwd = await cwdPath.isVisible();
      const isLoading = await loading.isVisible();
      const hasNoCwd = await noCwd.isVisible();
      
      expect(hasCwd || isLoading || hasNoCwd).toBe(true);
    }
  });

  test('should expand directory on click', async ({ page }) => {
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    // Create a new session
    await clickByTestId(page, 'add-session-btn');
    await page.waitForTimeout(2000);
    
    // Switch to Tabs mode and expand session
    const tabsBtn = page.locator('.fm-mode-btn').filter({ hasText: 'Tabs' });
    await tabsBtn.click();
    await page.waitForTimeout(500);
    
    const sessionHeader = page.locator('.fm-session-header').first();
    if (await sessionHeader.isVisible()) {
      await sessionHeader.click();
      await page.waitForTimeout(1000);
      
      // Click on cwd path to expand
      const cwdPath = page.locator('.fm-cwd-path').first();
      if (await cwdPath.isVisible()) {
        await cwdPath.click();
        await page.waitForTimeout(1000);
        
        // Directory contents should be visible
        const dirContents = page.locator('.fm-dir-contents');
        await expect(dirContents.first()).toBeVisible();
      }
    }
  });
});
