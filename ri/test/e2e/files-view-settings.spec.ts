import { test, expect, getByTestId, clickByTestId } from './helpers/electron';

test.describe('Files View Settings', () => {
  test('should navigate to files view settings', async ({ page }) => {
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    
    const settingsView = getByTestId(page, 'settings-view');
    await expect(settingsView).toBeVisible();
    
    await clickByTestId(page, 'settings-tab-files-view');
    await page.waitForTimeout(300);
    
    const showHiddenLabel = page.locator('label').filter({ hasText: '显示隐藏文件' });
    await expect(showHiddenLabel).toBeVisible();
  });

  test('should display show hidden files toggle', async ({ page }) => {
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-files-view');
    await page.waitForTimeout(300);
    
    const toggleSwitch = page.locator('.toggle-switch').first();
    await expect(toggleSwitch).toBeVisible();
    
    const checkbox = toggleSwitch.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
  });

  test('should toggle show hidden files setting', async ({ page }) => {
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-files-view');
    await page.waitForTimeout(300);
    
    const checkbox = page.locator('.toggle-switch input[type="checkbox"]').first();
    const initialState = await checkbox.isChecked();
    
    await checkbox.click();
    await page.waitForTimeout(200);
    
    const newState = await checkbox.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('should show description for hidden files setting', async ({ page }) => {
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-files-view');
    await page.waitForTimeout(300);
    
    const description = page.locator('.settings-item-description').filter({ 
      hasText: '默认显示以 . 开头的隐藏文件' 
    });
    await expect(description).toBeVisible();
  });

  test('should have files view tab in sidebar', async ({ page }) => {
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    
    const filesViewTab = getByTestId(page, 'settings-tab-files-view');
    await expect(filesViewTab).toBeVisible();
    
    const tabIcon = filesViewTab.locator('.settings-nav-icon');
    const tabLabel = filesViewTab.locator('.settings-nav-label');
    
    await expect(tabIcon).toContainText('📁');
    await expect(tabLabel).toContainText('Files View');
  });

  test('should highlight active tab when selected', async ({ page }) => {
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-files-view');
    await page.waitForTimeout(300);
    
    const filesViewTab = getByTestId(page, 'settings-tab-files-view');
    const classes = await filesViewTab.getAttribute('class');
    expect(classes).toContain('active');
  });
});

test.describe('Terminal Settings - Scrollback', () => {
  test('should display scrollback input with k unit format', async ({ page }) => {
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    const scrollbackLabel = page.locator('label').filter({ hasText: '回滚缓冲区' });
    await expect(scrollbackLabel).toBeVisible();
    
    const scrollbackInput = page.locator('input[type="text"][placeholder="1k"]');
    await expect(scrollbackInput).toBeVisible();
  });

  test('should accept k unit format input', async ({ page }) => {
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    const scrollbackInput = page.locator('input[placeholder="1k"]');
    await scrollbackInput.fill('5k');
    await page.waitForTimeout(200);
    
    const value = await scrollbackInput.inputValue();
    expect(value).toBe('5k');
  });

  test('should accept decimal k format', async ({ page }) => {
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    const scrollbackInput = page.locator('input[placeholder="1k"]');
    await scrollbackInput.fill('1.5k');
    await page.waitForTimeout(200);
    
    const value = await scrollbackInput.inputValue();
    expect(value).toBe('1.5k');
  });

  test('should normalize value on blur', async ({ page }) => {
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    const scrollbackInput = page.locator('input[placeholder="1k"]');
    await scrollbackInput.fill('2');
    await page.waitForTimeout(100);
    
    await page.click('body');
    await page.waitForTimeout(200);
    
    const value = await scrollbackInput.inputValue();
    expect(value).toMatch(/k$/);
  });

  test('should show description with format examples', async ({ page }) => {
    await clickByTestId(page, 'view-settings');
    await page.waitForTimeout(300);
    await clickByTestId(page, 'settings-tab-terminal');
    await page.waitForTimeout(300);
    
    const description = page.locator('.settings-item-description').filter({ 
      hasText: /如: 1k, 1.5k, 10k/ 
    });
    await expect(description).toBeVisible();
  });
});
