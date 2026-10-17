import { test, expect } from '@playwright/test'
import path from 'path'

// The fake mic loops a 150 ms-per-note A minor pentatonic run: A3 C4 D4 E4 G4 A4 C5 A4 G4 E4 D4 C4
test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${path.join(__dirname, 'fixtures', 'run-a-minor-pentatonic.wav')}`,
    ],
  },
})

// Audio tests are timing-sensitive; don't run them alongside each other
test.describe.configure({ mode: 'serial', timeout: 45000 })

test('Listen keeps up with a fast run of consecutive notes', async ({ page }) => {
  await page.context().addCookies([{ name: 'fretwiki_instrument', value: 'guitar', domain: 'localhost', path: '/' }])
  await page.goto('/guitar')
  await page.getByRole('button', { name: 'Listen' }).click()

  const heard = await page.evaluate(() => new Promise<string[]>(resolve => {
    const btn = document.querySelector('.listen-btn')!
    const out: string[] = []
    const obs = new MutationObserver(() => {
      const txt = btn.textContent ?? ''
      if (/^[A-G]#?\d$/.test(txt) && out[out.length - 1] !== txt) out.push(txt)
    })
    obs.observe(btn, { childList: true, subtree: true, characterData: true })
    setTimeout(() => { obs.disconnect(); resolve(out) }, 4500)
  }))

  // Wherever the loop started, at least 8 consecutive notes of the run must appear in order
  const run = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'A4', 'G4', 'E4', 'D4', 'C4']
  const joined = heard.join(' ')
  const found = run.some((_, i) => joined.includes([...run.slice(i), ...run.slice(0, i)].slice(0, 8).join(' ')))
  expect(found, `heard: ${joined}`).toBe(true)
})
