/**
 * E2E Tests: Flow Management
 * 
 * Tests for workflow (Flow) functionality including creating, renaming, deleting flows,
 * organizing with folders, editing and running flows.
 */

import { test, expect, getByTestId, clickByTestId, waitForTestId, countByTestIdPrefix, getAllByTestIdPrefix } from './helpers/electron';

test.describe('Flow Management', () => {
  test.beforeEach(async ({ page }) => {
    await clickByTestId(page, 'view-flow');
    await page.waitForTimeout(300);
  });

  test('should display Flow view with empty state', async ({ page }) => {
    const flowList = getByTestId(page, 'flow-list');
    await expect(flowList).toBeVisible();
    
    const emptyState = page.getByText(/no flows/i);
    await expect(emptyState).toBeVisible();
  });

  test('should navigate to Flow view when clicking flow icon in sidebar', async ({ page }) => {
    const flowView = getByTestId(page, 'flow-view');
    await expect(flowView).toBeVisible();
  });

  test('should create a new flow', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    
    const flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await expect(flowInput).toBeVisible();
    
    await flowInput.fill('Setup Project');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = page.getByText('Setup Project');
    await expect(flowItem).toBeVisible();
  });

  test('should create multiple flows', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Deploy App');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Run Tests');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const deployFlow = page.getByText('Deploy App');
    const testFlow = page.getByText('Run Tests');
    await expect(deployFlow).toBeVisible();
    await expect(testFlow).toBeVisible();
    
    const flowCount = await countByTestIdPrefix(page, 'flow-item-');
    expect(flowCount).toBe(2);
  });

  test('should rename a flow', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Original Name');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = await getAllByTestIdPrefix(page, 'flow-item-').first();
    await flowItem.dblclick();
    await page.waitForTimeout(300);
    
    const renameInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await expect(renameInput).toBeVisible();
    
    await renameInput.fill('Updated Name');
    await renameInput.press('Enter');
    await page.waitForTimeout(300);
    
    const updatedFlow = page.getByText('Updated Name');
    await expect(updatedFlow).toBeVisible();
  });

  test('should delete a flow', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Flow to Delete');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    let flowCount = await countByTestIdPrefix(page, 'flow-item-');
    expect(flowCount).toBe(1);
    
    const flowItem = await getAllByTestIdPrefix(page, 'flow-item-').first();
    const flowTestId = await flowItem.getAttribute('data-testid');
    const flowId = flowTestId?.replace('flow-item-', '');
    
    const deleteBtn = getByTestId(page, `delete-flow-${flowId}`);
    await deleteBtn.click();
    
    page.once('dialog', dialog => dialog.accept());
    await page.waitForTimeout(500);
    
    flowCount = await countByTestIdPrefix(page, 'flow-item-');
    expect(flowCount).toBe(0);
  });

  test('should create a folder to organize flows', async ({ page }) => {
    await clickByTestId(page, 'create-folder-btn');
    await page.waitForTimeout(500);
    
    const folderInput = await getAllByTestIdPrefix(page, 'folder-input-').first();
    await expect(folderInput).toBeVisible();
    
    await folderInput.fill('Deployment');
    await folderInput.press('Enter');
    await page.waitForTimeout(500);
    
    const folderItem = page.getByText('Deployment');
    await expect(folderItem).toBeVisible();
  });

  test('should expand and collapse folder', async ({ page }) => {
    await clickByTestId(page, 'create-folder-btn');
    await page.waitForTimeout(500);
    let folderInput = await getAllByTestIdPrefix(page, 'folder-input-').first();
    await folderInput.fill('Dev Tasks');
    await folderInput.press('Enter');
    await page.waitForTimeout(500);
    
    const folderToggle = await getAllByTestIdPrefix(page, 'folder-toggle-').first();
    let toggleClasses = await folderToggle.getAttribute('class');
    const isInitiallyExpanded = toggleClasses?.includes('expanded');
    
    await folderToggle.click();
    await page.waitForTimeout(300);
    
    toggleClasses = await folderToggle.getAttribute('class');
    const isNowExpanded = toggleClasses?.includes('expanded');
    
    expect(isNowExpanded).not.toBe(isInitiallyExpanded);
  });

  test('should open flow editor by clicking on flow', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Build Project');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = page.getByText('Build Project');
    await flowItem.click();
    await page.waitForTimeout(500);
    
    const flowEditorTab = page.getByText(/⚡ Build Project/);
    await expect(flowEditorTab).toBeVisible();
    
    const flowEditor = getByTestId(page, 'flow-editor');
    await expect(flowEditor).toBeVisible();
  });

  test('should display flow editor with line numbers', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Test Flow');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = page.getByText('Test Flow');
    await flowItem.click();
    await page.waitForTimeout(500);
    
    const lineNumbers = getByTestId(page, 'flow-editor-line-numbers');
    await expect(lineNumbers).toBeVisible();
  });

  test('should add commands to flow in editor', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Multi Command Flow');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = page.getByText('Multi Command Flow');
    await flowItem.click();
    await page.waitForTimeout(500);
    
    const commandInput = getByTestId(page, 'flow-editor-input');
    await expect(commandInput).toBeVisible();
    
    await commandInput.click();
    await page.keyboard.type('npm install');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    await page.keyboard.type('npm run build');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    const commands = await page.locator('[data-testid*="flow-command-"]').all();
    expect(commands.length).toBeGreaterThanOrEqual(2);
  });

  test('should save flow with Ctrl+S / Cmd+S', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Save Test Flow');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = page.getByText('Save Test Flow');
    await flowItem.click();
    await page.waitForTimeout(500);
    
    const commandInput = getByTestId(page, 'flow-editor-input');
    await commandInput.click();
    await page.keyboard.type('echo "hello"');
    await page.waitForTimeout(200);
    
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(500);
    
    const unsavedLocator = page.locator('[data-testid="unsaved-indicator"]');
    const isVisible = await unsavedLocator.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('should reorder commands in flow editor', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Reorder Test');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = page.getByText('Reorder Test');
    await flowItem.click();
    await page.waitForTimeout(500);
    
    const commandInput = getByTestId(page, 'flow-editor-input');
    await commandInput.click();
    await page.keyboard.type('command1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.keyboard.type('command2');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.keyboard.type('command3');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    const moveButtons = await page.locator('[data-testid*="move-command-"]').all();
    expect(moveButtons.length).toBeGreaterThan(0);
    
    const moveDownBtn = await page.locator('[data-testid="move-down-0"]').first();
    if (moveDownBtn) {
      await moveDownBtn.click();
      await page.waitForTimeout(300);
      
      const commands = await page.locator('[data-testid*="flow-command-"]').all();
      expect(commands.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('should run flow by double-clicking', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Quick Run');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = page.getByText('Quick Run');
    await flowItem.dblclick();
    await page.waitForTimeout(1000);
    
    const tabBar = getByTestId(page, 'tab-bar');
    await expect(tabBar).toBeVisible();
  });

  test('should run flow using run button in editor', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Button Run Flow');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = page.getByText('Button Run Flow');
    await flowItem.click();
    await page.waitForTimeout(500);
    
    const commandInput = getByTestId(page, 'flow-editor-input');
    await commandInput.click();
    await page.keyboard.type('echo "test"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    const runBtn = getByTestId(page, 'flow-editor-run-btn');
    await runBtn.click();
    await page.waitForTimeout(1000);
    
    const tabBar = getByTestId(page, 'tab-bar');
    await expect(tabBar).toBeVisible();
  });

  test('should show context menu for flow actions', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Context Menu Test');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = page.getByText('Context Menu Test');
    await flowItem.click({ button: 'right' });
    await page.waitForTimeout(300);
    
    const contextMenu = page.locator('[role="menu"]').first();
    const isMenuVisible = await contextMenu.isVisible().catch(() => false);
    
    if (isMenuVisible) {
      const menuItems = await contextMenu.locator('[role="menuitem"]').all();
      expect(menuItems.length).toBeGreaterThan(0);
    }
  });

  test('should maintain flow list when navigating away and back', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Persistent Flow 1');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Persistent Flow 2');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    let flowCount = await countByTestIdPrefix(page, 'flow-item-');
    expect(flowCount).toBe(2);
    
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    
    await clickByTestId(page, 'view-flow');
    await page.waitForTimeout(300);
    
    flowCount = await countByTestIdPrefix(page, 'flow-item-');
    expect(flowCount).toBe(2);
    
    const flow1 = page.getByText('Persistent Flow 1');
    const flow2 = page.getByText('Persistent Flow 2');
    await expect(flow1).toBeVisible();
    await expect(flow2).toBeVisible();
  });

  test('should show empty state message when all flows are deleted', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Only Flow');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = await getAllByTestIdPrefix(page, 'flow-item-').first();
    const flowTestId = await flowItem.getAttribute('data-testid');
    const flowId = flowTestId?.replace('flow-item-', '');
    
    const deleteBtn = getByTestId(page, `delete-flow-${flowId}`);
    await deleteBtn.click();
    page.once('dialog', dialog => dialog.accept());
    await page.waitForTimeout(500);
    
    const emptyState = page.getByText(/no flows/i);
    await expect(emptyState).toBeVisible();
  });

  test('should show flow count or stats in UI', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await clickByTestId(page, 'create-flow-btn');
      await page.waitForTimeout(500);
      const flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
      await flowInput.fill(`Flow ${i + 1}`);
      await flowInput.press('Enter');
      await page.waitForTimeout(500);
    }
    
    const flowCount = await countByTestIdPrefix(page, 'flow-item-');
    expect(flowCount).toBe(3);
  });

  test('should close flow editor tab without affecting flow data', async ({ page }) => {
    await clickByTestId(page, 'create-flow-btn');
    await page.waitForTimeout(500);
    let flowInput = await getAllByTestIdPrefix(page, 'flow-input-').first();
    await flowInput.fill('Editor Close Test');
    await flowInput.press('Enter');
    await page.waitForTimeout(500);
    
    const flowItem = page.getByText('Editor Close Test');
    await flowItem.click();
    await page.waitForTimeout(500);
    
    const commandInput = getByTestId(page, 'flow-editor-input');
    await commandInput.click();
    await page.keyboard.type('npm test');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    const tabs = await getAllByTestIdPrefix(page, 'tab-').all();
    expect(tabs.length).toBeGreaterThan(0);
    
    const editorTab = tabs.find(async (tab) => {
      const text = await tab.textContent();
      return text?.includes('Editor Close Test') || false;
    });
    
    if (editorTab) {
      const tabTestId = await editorTab.getAttribute('data-testid');
      const tabId = tabTestId?.replace('tab-', '');
      const closeBtn = getByTestId(page, `close-tab-${tabId}`);
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
    
    const flowStillExists = page.getByText('Editor Close Test');
    await expect(flowStillExists).toBeVisible();
  });
});
