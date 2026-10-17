import { test, expect } from '@playwright/test'
import path from 'path'

// The fake mic loops a steady A3 (220 Hz) tone
test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${path.join(__dirname, 'fixtures', 'tone-a3.wav')}`,
    ],
  },
})

test('Listen highlights every fretboard position of the played pitch', async ({ page }) => {
  await page.context().addCookies([{ name: 'fretwiki_instrument', value: 'guitar', domain: 'localhost', path: '/' }])
  await page.goto('/guitar')
  await page.getByRole('button', { name: 'Listen' }).click()

  const listen = page.locator('.listen-btn')
  await expect(listen).toHaveAttribute('aria-pressed', 'true')
  await expect(listen).toHaveAttribute('aria-label', 'Stop listening (hearing A3)')
  // A3 on standard tuning within frets 1-15: G string 2nd, D string 7th, A string 12th
  await expect(page.locator('.live-note')).toHaveCount(3)

  await listen.click()
  await expect(page.locator('.live-note')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Listen' })).toHaveAttribute('aria-pressed', 'false')
})
