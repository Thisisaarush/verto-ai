import { test, expect } from "@playwright/test"

test.describe("Widget Embedding", () => {
  test("should load widget successfully", async ({ page }) => {
    // Navigate to demo page with widget
    await page.goto("/?organizationId=test-org")

    // Wait for widget to initialize
    await page.waitForSelector('[data-testid="widget-container"]', {
      timeout: 10000,
    })

    // Verify widget is visible
    const widget = page.locator('[data-testid="widget-container"]')
    await expect(widget).toBeVisible()
  })

  test("should show loading screen initially", async ({ page }) => {
    await page.goto("/?organizationId=test-org")

    // Should show loading indicator
    const loadingIndicator = page.locator("text=Loading")
    await expect(loadingIndicator).toBeVisible({ timeout: 5000 })
  })

  test("should handle missing organization ID", async ({ page }) => {
    await page.goto("/")

    // Should show error screen
    await page.waitForSelector("text=Organization ID is missing", {
      timeout: 10000,
    })
  })
})

test.describe("Chat Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navigate and authenticate
    await page.goto("/?organizationId=test-org")
    await page.waitForTimeout(2000) // Wait for initialization
  })

  test("should show auth form for new users", async ({ page }) => {
    // Check for auth form elements
    const nameInput = page.locator('input[placeholder*="name"]')
    const emailInput = page.locator('input[placeholder*="email"]')

    // Either auth form or selection should be visible
    const isAuthVisible = await nameInput.isVisible().catch(() => false)
    const isSelectionVisible = await page
      .locator("text=Start Chat")
      .isVisible()
      .catch(() => false)

    expect(isAuthVisible || isSelectionVisible).toBeTruthy()
  })

  test("should allow starting a new conversation", async ({ page }) => {
    // Fill auth form if visible
    const nameInput = page.locator('input[placeholder*="name"]')
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill("Test User")
      await page.locator('input[placeholder*="email"]').fill("test@example.com")
      await page.locator('button[type="submit"]').click()
      await page.waitForTimeout(1000)
    }

    // Click start chat
    const startChatButton = page.locator("text=Start Chat")
    if (await startChatButton.isVisible().catch(() => false)) {
      await startChatButton.click()
      await page.waitForTimeout(1000)
    }

    // Should navigate to chat screen
    const chatInput = page.locator('textarea[placeholder*="message"]')
    await expect(chatInput).toBeVisible({ timeout: 10000 })
  })
})

test.describe("Accessibility", () => {
  test("should have proper heading structure", async ({ page }) => {
    await page.goto("/?organizationId=test-org")
    await page.waitForTimeout(2000)

    // Check for accessible headings
    const headings = await page.locator("h1, h2, h3").count()
    expect(headings).toBeGreaterThan(0)
  })

  test("should have proper button labels", async ({ page }) => {
    await page.goto("/?organizationId=test-org")
    await page.waitForTimeout(2000)

    // All buttons should have accessible text
    const buttons = page.locator("button")
    const buttonCount = await buttons.count()

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i)
      const hasText = (await button.textContent()) !== ""
      const hasAriaLabel = (await button.getAttribute("aria-label")) !== null
      const hasTitle = (await button.getAttribute("title")) !== null

      // Button should have some accessible name
      expect(hasText || hasAriaLabel || hasTitle).toBeTruthy()
    }
  })
})

test.describe("Responsive Design", () => {
  test("should display correctly on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/?organizationId=test-org")
    await page.waitForTimeout(2000)

    // Widget should be visible and not overflow
    const widget = page.locator("main")
    await expect(widget).toBeVisible()

    const boundingBox = await widget.boundingBox()
    if (boundingBox) {
      expect(boundingBox.width).toBeLessThanOrEqual(375)
    }
  })
})
