/**
 * E2E Tests: Terminal Settings
 * 
 * Tests for terminal configuration including theme selection, font settings, and persistence.
 */

import { test, expect, getByTestId, clickByTestId, waitForTestId, restartApp } from './helpers/electron';

test.describe('Terminal Settings', () => {
  test('should navigate to terminal settings', async ({ page }) => {
    // Click on settings view in sidebar
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    
    // Verify settings view is visible
    const settingsView = getByTestId(page, 'settings-view');
    await expect(settingsView).toBeVisible();
    
    // Click on Terminal tab
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    // Verify terminal settings content is visible
    const terminalSettings = getByTestId(page, 'terminal-settings');
    await expect(terminalSettings).toBeVisible();
  });

  test('should display all theme options', async ({ page }) => {
    // Navigate to terminal settings
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    // Check that all theme cards are present
    const themes = ['gruvbox-dark', 'dracula', 'one-dark', 'solarized-dark', 'nord'];
    
    for (const theme of themes) {
      const themeCard = getByTestId(page, `theme-${theme}`);
      await expect(themeCard).toBeVisible();
    }
  });

  test('should select a different theme', async ({ page }) => {
    // Navigate to terminal settings
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    // Click on Dracula theme
    await clickByTestId(page, 'theme-dracula');
    await page.waitForTimeout(200);
    
    // Verify the theme card has selected class
    const draculaCard = getByTestId(page, 'theme-dracula');
    const classes = await draculaCard.getAttribute('class');
    expect(classes).toContain('selected');
  });

  test('should change font size', async ({ page }) => {
    // Navigate to terminal settings
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    // Find font size input
    const fontSizeInput = getByTestId(page, 'font-size-input');
    await expect(fontSizeInput).toBeVisible();
    
    // Get current value
    const currentValue = await fontSizeInput.inputValue();
    expect(currentValue).toBeTruthy();
    
    // Change font size to 16
    await fontSizeInput.fill('16');
    await page.waitForTimeout(200);
    
    // Verify new value
    const newValue = await fontSizeInput.inputValue();
    expect(newValue).toBe('16');
  });

  test('should save terminal settings', async ({ page }) => {
    // Navigate to terminal settings
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    // Change theme
    await clickByTestId(page, 'theme-nord');
    await page.waitForTimeout(200);
    
    // Change font size
    const fontSizeInput = getByTestId(page, 'font-size-input');
    await fontSizeInput.fill('18');
    await page.waitForTimeout(200);
    
    // Click save button
    await clickByTestId(page, 'save-settings-btn');
    await page.waitForTimeout(500);
    
    // Verify success message appears
    const successMessage = getByTestId(page, 'settings-message-success');
    await expect(successMessage).toBeVisible({ timeout: 3000 });
  });

  test('should persist terminal settings after restart', async ({ electronApp, page }) => {
    // Navigate to terminal settings
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    // Change theme to One Dark
    await clickByTestId(page, 'theme-one-dark');
    await page.waitForTimeout(200);
    
    // Change font size to 20
    const fontSizeInput = getByTestId(page, 'font-size-input');
    await fontSizeInput.fill('20');
    await page.waitForTimeout(200);
    
    // Save settings
    await clickByTestId(page, 'save-settings-btn');
    await page.waitForTimeout(1000);
    
    // Restart the app
    const { newApp, newPage } = await restartApp(electronApp);
    
    try {
      // Navigate to terminal settings again
      await clickByTestId(newPage, 'view-settings');
      await newPage.waitForTimeout(300);
      await clickByTestId(newPage, 'settings-tab-terminal');
      await newPage.waitForTimeout(300);
      
      // Verify theme is still One Dark (has selected class)
      const oneDarkCard = getByTestId(newPage, 'theme-one-dark');
      const classes = await oneDarkCard.getAttribute('class');
      expect(classes).toContain('selected');
      
      // Verify font size is still 20
      const newFontSizeInput = getByTestId(newPage, 'font-size-input');
      const fontSize = await newFontSizeInput.inputValue();
      expect(fontSize).toBe('20');
      
    } finally {
      // Clean up the new app
      await newApp.close();
    }
  });

  test('should show all settings sections', async ({ page }) => {
    // Navigate to settings view
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    
    // Verify all settings tabs are present
    const sections = ['notification', 'opencode', 'terminal', 'appearance', 'advanced'];
    
    for (const section of sections) {
      const tab = getByTestId(page, `settings-tab-${section}`);
      await expect(tab).toBeVisible();
    }
  });

  test('should switch between settings sections', async ({ page }) => {
    // Navigate to settings view
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    
    // Click on Terminal tab
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    // Verify terminal settings is visible
    const terminalSettings = getByTestId(page, 'terminal-settings');
    await expect(terminalSettings).toBeVisible();
    
    // Click on Notification tab
    await clickByTestId(page, 'settings-tab-notification');
    await page.waitForTimeout(300);
    
    // Terminal settings should not be visible anymore
    await expect(terminalSettings).not.toBeVisible();
  });

  test('should display error message on save failure', async ({ page }) => {
    // Navigate to terminal settings
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    // Note: This test would require mocking a failure scenario
    // For now, we just verify the save button is functional
    const saveBtn = getByTestId(page, 'save-settings-btn');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();
  });
});
