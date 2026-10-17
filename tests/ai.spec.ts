import { test, expect } from '@playwright/test'

test.describe('FretWiki AI', () => {
  test('loads the coach page with listen and analyze controls', async ({ page }) => {
    await page.goto('/ai')
    await expect(page.getByRole('heading', { name: 'FretWiki AI' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Listen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Analyze' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try Again' }).first()).toBeVisible()
    await expect(page.locator('svg.fp-fretboard')).toBeVisible()
  })

  test('tapping the fretboard and analyzing produces coaching', async ({ page }) => {
    await page.goto('/ai')
    const svg = page.locator('svg.fp-fretboard')
    await expect(svg).toBeVisible()
    const box = await svg.boundingBox()
    expect(box).toBeTruthy()
    if (!box) return
    await page.mouse.click(box.x + box.width * 0.18, box.y + box.height * 0.72)
    await page.mouse.click(box.x + box.width * 0.28, box.y + box.height * 0.55)
    await page.getByRole('button', { name: 'Analyze' }).click()
    await expect(page.locator('.fp-coach-steps')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.fp-coach-steps li').first()).toContainText(/played|phrase|note/i)
    await expect(page.getByText('Exercise ·')).toBeVisible()
  })

  test('chord field is editable', async ({ page }) => {
    await page.goto('/ai')
    const chords = page.getByPlaceholder('G Em C D')
    await expect(chords).toBeVisible()
    await chords.fill('Am F C G')
    await expect(page.locator('.fp-timeline-cell').first()).toHaveText('Am')
  })
})
