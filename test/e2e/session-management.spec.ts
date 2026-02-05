/**
 * E2E Tests: Session Management
 * 
 * Tests for creating, switching, renaming, and deleting terminal sessions.
 */

import { test, expect, getByTestId, clickByTestId, waitForTestId, countByTestIdPrefix, getAllByTestIdPrefix } from './helpers/electron';

test.describe('Session Management', () => {
  test('should display welcome screen when no sessions exist', async ({ page }) => {
    // Check for welcome message
    const welcomeText = page.getByText('Welcome to Second Brain OS');
    await expect(welcomeText).toBeVisible();
    
    // Check for create button in welcome screen
    const createBtn = getByTestId(page, 'create-session-btn-welcome');
    await expect(createBtn).toBeVisible();
  });

  test('should create a new session from welcome screen', async ({ page }) => {
    // Click create button
    await clickByTestId(page, 'create-session-btn-welcome');
    
    // Wait for session list to appear
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Check that one session was created
    const sessionCount = await countByTestIdPrefix(page, 'session-item-');
    expect(sessionCount).toBe(1);
    
    // Check that tab bar appeared
    const tabBar = getByTestId(page, 'tab-bar');
    await expect(tabBar).toBeVisible();
  });

  test('should create multiple sessions', async ({ page }) => {
    // Create first session
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Create second session
    await clickByTestId(page, 'create-session-btn');
    
    // Wait a bit for session to be created
    await page.waitForTimeout(500);
    
    // Check that two sessions exist
    const sessionCount = await countByTestIdPrefix(page, 'session-item-');
    expect(sessionCount).toBe(2);
    
    // Check that two tabs exist
    const tabCount = await countByTestIdPrefix(page, 'tab-');
    expect(tabCount).toBe(2);
  });

  test('should switch between sessions', async ({ page }) => {
    // Create two sessions
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    await clickByTestId(page, 'create-session-btn');
    await page.waitForTimeout(500);
    
    // Get all session items
    const sessions = await getAllByTestIdPrefix(page, 'session-item-').all();
    expect(sessions.length).toBe(2);
    
    // First session should be active initially (the second one just created)
    const firstSession = sessions[0];
    const secondSession = sessions[1];
    
    // Click on first session to switch to it
    await firstSession.click();
    await page.waitForTimeout(300);
    
    // Verify first session has active class
    const firstSessionClasses = await firstSession.getAttribute('class');
    expect(firstSessionClasses).toContain('active');
    
    // Click on second session
    await secondSession.click();
    await page.waitForTimeout(300);
    
    // Verify second session has active class
    const secondSessionClasses = await secondSession.getAttribute('class');
    expect(secondSessionClasses).toContain('active');
  });

  test('should rename a session', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Get the session item
    const sessionItem = await getAllByTestIdPrefix(page, 'session-item-').first();
    
    // Double-click to enter rename mode
    await sessionItem.dblclick();
    await page.waitForTimeout(200);
    
    // Find the rename input
    const renameInput = await getAllByTestIdPrefix(page, 'rename-input-').first();
    await expect(renameInput).toBeVisible();
    
    // Type new name
    await renameInput.fill('My Custom Session');
    
    // Press Enter to confirm
    await renameInput.press('Enter');
    await page.waitForTimeout(300);
    
    // Verify the session name changed
    const sessionName = sessionItem.locator('.session-item-name');
    await expect(sessionName).toHaveText('My Custom Session');
  });

  test('should delete a session', async ({ page }) => {
    // Create two sessions
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    await clickByTestId(page, 'create-session-btn');
    await page.waitForTimeout(500);
    
    // Verify we have 2 sessions
    let sessionCount = await countByTestIdPrefix(page, 'session-item-');
    expect(sessionCount).toBe(2);
    
    // Get all sessions
    const sessions = await getAllByTestIdPrefix(page, 'session-item-').all();
    
    // Get the first session's ID from its test-id attribute
    const firstSessionTestId = await sessions[0].getAttribute('data-testid');
    const sessionId = firstSessionTestId?.replace('session-item-', '');
    
    // Find and click the delete button for first session
    const deleteBtn = getByTestId(page, `delete-session-${sessionId}`);
    await deleteBtn.click();
    
    // Wait for confirmation dialog (if applicable) and handle it
    page.once('dialog', dialog => dialog.accept());
    
    await page.waitForTimeout(500);
    
    // Verify we now have 1 session
    sessionCount = await countByTestIdPrefix(page, 'session-item-');
    expect(sessionCount).toBe(1);
  });

  test('should maintain session list visibility when navigating views', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Verify session list is visible
    const sessionList = getByTestId(page, 'session-list');
    await expect(sessionList).toBeVisible();
    
    // Navigate to settings view
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    
    // Session list should be hidden in settings view
    await expect(sessionList).not.toBeVisible();
    
    // Navigate back to sessions view
    await clickByTestId(page, 'view-sessions');
    await page.waitForTimeout(300);
    
    // Session list should be visible again
    await expect(sessionList).toBeVisible();
  });

  test('should show active indicator for visible sessions', async ({ page }) => {
    // Create a session
    await clickByTestId(page, 'create-session-btn-welcome');
    await waitForTestId(page, 'session-list', { timeout: 5000 });
    
    // Get the session item
    const sessionItem = await getAllByTestIdPrefix(page, 'session-item-').first();
    
    // Check for active indicator (●) 
    const indicator = sessionItem.locator('.session-item-icon');
    const indicatorText = await indicator.textContent();
    
    // Should show filled circle for visible session
    expect(indicatorText?.trim()).toBe('●');
  });
});
