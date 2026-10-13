import { test, expect, Page } from '@playwright/test'

// Set instrument cookie before navigating to prevent the instrument selector overlay
async function setInstrumentCookie(page: Page) {
  await page.context().addCookies([{
    name: 'fretwiki_instrument',
    value: 'guitar',
    domain: 'localhost',
    path: '/',
  }])
}

// ─── Main Page ───

test.describe('Main Page', () => {
  test.beforeEach(async ({ page }) => {
    await setInstrumentCookie(page)
  })

  test('loads and shows FretWiki header', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.brand-name')).toContainText('FretWiki')
  })

  test('renders fretboard SVG', async ({ page }) => {
    await page.goto('/')
    const svg = page.locator('svg.fretboard-svg')
    await expect(svg).toBeVisible({ timeout: 10000 })
  })

  test('scale selector is visible and has options', async ({ page }) => {
    await page.goto('/')
    const select = page.locator('.scale-select-prominent')
    await expect(select).toBeVisible()
    const optionCount = await select.locator('option').count()
    expect(optionCount).toBeGreaterThan(5)
  })

  test('key selector works - changes active key', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    const keyButtons = page.locator('.key-btn')
    await expect(keyButtons.first()).toBeVisible()
    const count = await keyButtons.count()
    expect(count).toBe(12)
    await keyButtons.nth(3).click()
    await expect(keyButtons.nth(3)).toHaveClass(/active/)
  })

  test('display mode buttons (ABC/135) are visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    const displayBtns = page.locator('.display-btn')
    await expect(displayBtns.first()).toBeVisible()
    const count = await displayBtns.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('changing scale updates the fretboard', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    const select = page.locator('.scale-select-prominent')
    await select.selectOption({ index: 2 })
    await page.waitForTimeout(300)
    const newNotes = await page.locator('g.clickable-note:not(.hidden-note):not(.empty-slot)').count()
    expect(newNotes).toBeGreaterThan(0)
  })

  test('pattern mode buttons work', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    const fullScaleBtn = page.locator('.pattern-btn', { hasText: 'Full Scale' })
    await expect(fullScaleBtn).toBeVisible()
    await expect(fullScaleBtn).toHaveClass(/active/)
  })

  test('export dropdown opens and shows 3 options', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    const exportBtn = page.locator('.download-btn', { hasText: 'Export' })
    await expect(exportBtn).toBeVisible()
    await exportBtn.click()
    const dropdown = page.locator('.download-dropdown')
    await expect(dropdown).toBeVisible()
    const options = dropdown.locator('.download-option')
    const count = await options.count()
    expect(count).toBe(3)
    await expect(options.nth(0)).toContainText('Dots Only')
    await expect(options.nth(1)).toContainText('Frets & Dots')
    await expect(options.nth(2)).toContainText('With Fretboard')
  })

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    await page.waitForTimeout(1000)
    const realErrors = errors.filter(e => !e.includes('favicon') && !e.includes('404') && !e.includes('hydration'))
    expect(realErrors).toHaveLength(0)
  })
})

// ─── Instrument Routes ───

test.describe('Instrument Routes', () => {
  const instruments = ['guitar', 'bass-4', 'bass-5', 'bass-6', 'ukulele']

  for (const inst of instruments) {
    test(`/${inst} loads and renders fretboard`, async ({ page }) => {
      await page.goto(`/${inst}`)
      await expect(page.locator('.brand-name')).toContainText('FretWiki')
      const svg = page.locator('svg.fretboard-svg')
      await expect(svg).toBeVisible({ timeout: 10000 })
    })
  }
})

// ─── Static Pages ───

test.describe('Static Pages', () => {
  test('/about loads with content', async ({ page }) => {
    await page.goto('/about')
    await expect(page).toHaveTitle(/FretWiki/)
    const content = await page.textContent('body')
    expect(content).toContain('FretWiki')
  })

  test('/terms loads with content', async ({ page }) => {
    await page.goto('/terms')
    await expect(page).toHaveTitle(/FretWiki/)
    const content = await page.textContent('body')
    expect(content).toContain('Terms')
  })
})

// ─── Backing Track / Chord Player ───

test.describe('Backing Track', () => {
  test('page loads with chord player UI', async ({ page }) => {
    await page.goto('/backing-track')
    await expect(page.locator('.chord-player-modal')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.chord-player-header h2')).toContainText('Chord Player')
  })

  test('style tabs: 5 genres, switching works', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    const tabs = page.locator('.style-tab')
    expect(await tabs.count()).toBe(5)
    await expect(tabs.nth(0)).toHaveClass(/active/)
    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveClass(/active/)
    await expect(tabs.nth(0)).not.toHaveClass(/active/)
    await expect(page.locator('.presets-header')).toContainText('Rock')
  })

  test('key selector changes key', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    const keySelect = page.locator('.cp-select')
    await keySelect.selectOption('G')
    await expect(keySelect).toHaveValue('G')
  })

  test('BPM increments and decrements by 5', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    const bpmDisplay = page.locator('.bpm-control span')
    const initialBpm = Number(await bpmDisplay.textContent())
    await page.locator('.bpm-control button').nth(1).click()
    expect(Number(await bpmDisplay.textContent())).toBe(initialBpm + 5)
    await page.locator('.bpm-control button').nth(0).click()
    expect(Number(await bpmDisplay.textContent())).toBe(initialBpm)
  })

  test('chord picker opens with root, accidental, type', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    await page.locator('.chord-slot').first().click()
    const picker = page.locator('.chord-picker')
    await expect(picker).toBeVisible()
    const rootOpts = picker.locator('.picker-row').nth(0).locator('.picker-opt')
    expect(await rootOpts.count()).toBe(7)
    const accOpts = picker.locator('.picker-row').nth(1).locator('.picker-opt')
    expect(await accOpts.count()).toBe(3)
    const typeOpts = picker.locator('.picker-row').nth(2).locator('.picker-opt')
    expect(await typeOpts.count()).toBe(15)
  })

  test('chord picker: select root, accidental, type and apply', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    await page.locator('.chord-slot').first().click()
    const picker = page.locator('.chord-picker')
    // Select E
    await picker.locator('.picker-row').nth(0).locator('.picker-opt', { hasText: /^E$/ }).click()
    // Select flat
    await picker.locator('.picker-row').nth(1).locator('.picker-opt', { hasText: '♭' }).click()
    // Select minor (exact match)
    await picker.locator('.picker-row').nth(2).locator('.picker-opt', { hasText: /^Minor$/ }).click()
    // Preview should show Ebm
    await expect(picker.locator('.picker-preview')).toContainText('Ebm')
    await picker.locator('.picker-apply').click()
    await expect(picker).not.toBeVisible()
    await expect(page.locator('.chord-slot').first()).toContainText('Ebm')
  })

  test('chord picker: manual input mode works', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    await page.locator('.chord-slot').first().click()
    const picker = page.locator('.chord-picker')
    await picker.locator('.picker-mode-toggle').click()
    await expect(picker.locator('.manual-chord-input')).toBeVisible()
    await picker.locator('.manual-chord-input').fill('Bbm7')
    await picker.locator('.picker-apply').click()
    await expect(picker).not.toBeVisible()
    await expect(page.locator('.chord-slot').first()).toContainText('Bbm7')
  })

  test('add chord adds a new slot', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    const initial = await page.locator('.chord-slot').count()
    await page.locator('.chord-add-btn').first().click()
    expect(await page.locator('.chord-slot').count()).toBe(initial + 1)
  })

  test('remove chord removes a slot', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    const initial = await page.locator('.chord-slot').count()
    await page.locator('.chord-slot').first().hover()
    const removeBtn = page.locator('.chord-slot').first().locator('.chord-remove')
    await removeBtn.click({ force: true })
    expect(await page.locator('.chord-slot').count()).toBe(initial - 1)
  })

  test('add section adds a new section block', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    const initial = await page.locator('.chord-section').count()
    await page.locator('.cp-action-btn', { hasText: 'Add section' }).click()
    expect(await page.locator('.chord-section').count()).toBe(initial + 1)
  })

  test('section label is editable', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    const labelInput = page.locator('.section-label-input').first()
    await labelInput.click()
    await labelInput.fill('Verse')
    await expect(labelInput).toHaveValue('Verse')
  })

  test('generate chords fills non-empty chords', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    await page.locator('.cp-action-btn.clear').click()
    await page.locator('.cp-action-btn.generate').click()
    await page.waitForTimeout(300)
    const texts = await page.locator('.chord-slot-name').allTextContents()
    const filled = texts.filter(t => t !== '+' && t !== '—')
    expect(filled.length).toBeGreaterThan(0)
  })

  test('preset buttons load progressions', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    await page.locator('.progression-btn').first().click()
    await page.waitForTimeout(300)
    const texts = await page.locator('.chord-slot-name').allTextContents()
    const filled = texts.filter(t => t !== '+' && t !== '—')
    expect(filled.length).toBeGreaterThan(0)
  })

  test('play/stop cycle works', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    await page.locator('.cp-action-btn.generate').click()
    await page.waitForTimeout(200)
    const playBtn = page.locator('.cp-play-btn')
    await playBtn.click()
    await expect(playBtn).toContainText('Stop')
    await expect(playBtn).toHaveClass(/playing/)
    await expect(page.locator('.chord-now-playing')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('.chord-progress-bar')).toBeVisible()
    await playBtn.click()
    await expect(playBtn).toContainText('Play')
    await expect(page.locator('.chord-now-playing')).not.toBeVisible()
  })

  test('volume sliders work', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    const sliders = page.locator('.cp-slider')
    expect(await sliders.count()).toBe(2)
    await expect(sliders.nth(0)).toBeVisible()
    await expect(sliders.nth(1)).toBeVisible()
  })

  test('instrument toggle buttons work', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    const chordBtn = page.locator('.cp-icon-btn', { hasText: '🎸' })
    const drumBtn = page.locator('.cp-icon-btn', { hasText: '🥁' })
    await expect(chordBtn).toHaveClass(/active/)
    await expect(drumBtn).toHaveClass(/active/)
    await chordBtn.click()
    await expect(chordBtn).not.toHaveClass(/active/)
    await chordBtn.click()
    await expect(chordBtn).toHaveClass(/active/)
  })

  test('loop toggle works', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    const loopBtn = page.locator('.cp-icon-btn', { hasText: '🔁' })
    await expect(loopBtn).toHaveClass(/active/)
    await loopBtn.click()
    await expect(loopBtn).not.toHaveClass(/active/)
  })

  test('close button navigates away', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    await page.locator('.chord-player-header .close-btn').click()
    await page.waitForTimeout(1000)
    await expect(page.locator('.chord-player-modal')).not.toBeVisible()
  })

  test('no console errors on backing track page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    await page.waitForTimeout(1000)
    const realErrors = errors.filter(e => !e.includes('favicon') && !e.includes('404'))
    expect(realErrors).toHaveLength(0)
  })
})

// ─── Compare Scales ───

test.describe('Compare Scales', () => {
  test('page loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/compare-scales')
    await page.waitForTimeout(2000)
    expect(errors).toHaveLength(0)
  })
})

// ─── Tuner ───

test.describe('Tuner', () => {
  test('page loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/tuner')
    await page.waitForTimeout(2000)
    expect(errors).toHaveLength(0)
  })
})

// ─── Floating Buttons ───

test.describe('Floating Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await setInstrumentCookie(page)
  })

  test('compare, tuner, and backing track buttons are visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    await expect(page.locator('.compare-float-btn')).toBeVisible()
    await expect(page.locator('.tuner-float-btn')).toBeVisible()
    await expect(page.locator('.backing-track-toggle')).toBeVisible()
  })

  test('compare button navigates to /compare-scales', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    await page.locator('.compare-float-btn').click()
    await page.waitForURL('**/compare-scales', { timeout: 5000 })
    expect(page.url()).toContain('compare-scales')
  })

  test('tuner button navigates to /tuner', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    await page.locator('.tuner-float-btn').click()
    await page.waitForURL('**/tuner', { timeout: 5000 })
    expect(page.url()).toContain('tuner')
  })

  test('backing track button navigates to /backing-track', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    await page.locator('.backing-track-toggle').click()
    await page.waitForURL('**/backing-track', { timeout: 5000 })
    expect(page.url()).toContain('backing-track')
  })
})

// ─── Footer ───

test.describe('Footer', () => {
  test('version footer has about and terms links', async ({ page }) => {
    await setInstrumentCookie(page)
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    const footer = page.locator('.version-footer')
    await expect(footer).toBeVisible()
    await expect(footer.locator('a', { hasText: 'About' })).toBeVisible()
    await expect(footer.locator('a', { hasText: 'Terms' })).toBeVisible()
  })
})
