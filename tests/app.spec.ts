import { test, expect, Page } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'

const accountsConfigured = existsSync('.env.local') && /^NEXT_PUBLIC_SUPABASE_URL=.+/m.test(readFileSync('.env.local', 'utf8'))

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
    await expect(page.locator('.chord-player-header h1')).toContainText('Chord Player')
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
    const chordBtn = page.locator('.cp-icon-btn[title="Chords"]')
    const drumBtn = page.locator('.cp-icon-btn[title="Drums"]')
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
    const loopBtn = page.locator('.cp-icon-btn[title="Loop"]')
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

// ─── Tuner (lives in the effects drawer now) ───

test.describe('Tuner', () => {
  test('old /tuner route redirects to the effects page', async ({ page }) => {
    await page.goto('/tuner')
    await expect(page).toHaveURL(/\/effects$/)
  })
})

// ─── Floating Buttons ───

test.describe('Floating Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await setInstrumentCookie(page)
  })

  test('compare and backing track buttons are visible; tuner and effects live in the drawer', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    await expect(page.locator('.compare-float-btn')).toBeVisible()
    await expect(page.locator('.backing-track-toggle')).toBeVisible()
    await expect(page.locator('.tuner-float-btn, .effects-float-btn')).toHaveCount(0)
  })

  test('compare button navigates to /compare-scales', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('svg.fretboard-svg', { timeout: 10000 })
    await page.locator('.compare-float-btn').click()
    await page.waitForURL('**/compare-scales', { timeout: 5000 })
    expect(page.url()).toContain('compare-scales')
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

// ─── Regression: audit fixes ───

test.describe('Regressions', () => {
  test.beforeEach(async ({ page }) => {
    await setInstrumentCookie(page)
  })

  test('/nixx keeps returning visitors on the route and shows V7', async ({ page }) => {
    await page.goto('/guitar')
    await page.goto('/nixx')
    await page.waitForTimeout(1000)
    expect(new URL(page.url()).pathname).toBe('/nixx')
    await expect(page.locator('.progression-btn')).toHaveCount(1)
  })

  test('Escape closes the export menu', async ({ page, isMobile }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile' || !!isMobile, 'export menu layout differs on mobile')
    await page.goto('/guitar')
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await expect(page.locator('.download-dropdown')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.download-dropdown-backdrop')).toHaveCount(0)
  })

  test('scale and key persist across refresh and sync to the URL', async ({ page }) => {
    await page.goto('/guitar')
    const scaleSelect = page.locator('.scale-select-prominent')
    await scaleSelect.selectOption('dorian')
    await page.locator('.key-selector button, .key-btn').filter({ hasText: /^E$/ }).first().click()
    await expect(page).toHaveURL(/key=E&scale=dorian/)
    await page.reload()
    await expect(scaleSelect).toHaveValue('dorian')
  })

  test('shared ?key&scale link opens that view', async ({ page }) => {
    await page.goto('/guitar?key=F%23&scale=blues')
    await expect(page.locator('.scale-select-prominent')).toHaveValue('blues')
  })

  test('no horizontal page scroll', async ({ page }) => {
    await page.goto('/guitar')
    await page.waitForTimeout(500)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('branded 404 page', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist')
    expect(res?.status()).toBe(404)
    await expect(page.locator('h1')).toContainText('Wrong note')
    await expect(page.locator('.not-found-link')).toHaveCount(4)
  })

  test('backing track progression survives refresh', async ({ page }) => {
    await page.goto('/backing-track')
    await page.waitForSelector('.chord-player-modal', { timeout: 10000 })
    await page.locator('.cp-select').selectOption('G')
    await page.reload()
    await expect(page.locator('.cp-select')).toHaveValue('G')
  })

  test('effects page: knobs are keyboard accessible, tuner toggles', async ({ page }) => {
    await page.goto('/effects')
    const knob = page.locator('.fx-rotary').first()
    await expect(knob).toHaveAttribute('role', 'slider')
    const before = Number(await knob.getAttribute('aria-valuenow'))
    await knob.focus()
    await page.keyboard.press('ArrowUp')
    await expect(knob).not.toHaveAttribute('aria-valuenow', String(before))
    await expect(page.locator('.fx-sample-rate, .fx-rate-select')).toHaveValue('48000')
  })

  test('every page has its own canonical URL', async ({ page }) => {
    for (const route of ['/guitar', '/effects', '/about']) {
      await page.goto(route)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://fretwiki.com${route}`)
    }
  })
})

// ─── Effects patches (local mode: no Supabase env configured) ───

test.describe('Effects patches', () => {
  test.skip(accountsConfigured, 'runs against the browser-only mode; see tests/accounts for signed-in flows')

  test('save, reload, load, and delete a patch', async ({ page }) => {
    page.on('dialog', d => d.accept())
    await page.goto('/effects')
    const volume = page.getByLabel('Output volume')
    await volume.fill('30')

    await page.getByRole('button', { name: 'Patches' }).click()
    await expect(page.locator('.fx-patches-status')).toContainText('saved in this browser')
    await page.getByLabel('Patch name').fill('Quiet Clean')
    await page.getByRole('button', { name: 'Save new' }).click()
    await expect(page.locator('.fx-patches-list li.active .fx-patch-name')).toHaveText('Quiet Clean')

    await page.reload()
    await volume.fill('90')
    await page.getByRole('button', { name: 'Patches' }).click()
    await page.locator('.fx-patch-load', { hasText: 'Quiet Clean' }).click()
    await expect(volume).toHaveValue('30')

    await volume.fill('55')
    await page.getByRole('button', { name: /Update “Quiet Clean”/ }).click()
    await page.reload()
    await page.getByRole('button', { name: 'Patches' }).click()
    await page.locator('.fx-patch-load', { hasText: 'Quiet Clean' }).click()
    await expect(volume).toHaveValue('55')

    await page.getByRole('button', { name: 'Delete Quiet Clean' }).click()
    await expect(page.locator('.fx-patches-empty')).toBeVisible()
  })

  test('requires a name', async ({ page }) => {
    await page.goto('/effects')
    await page.getByRole('button', { name: 'Patches' }).click()
    await page.getByRole('button', { name: 'Save new' }).click()
    await expect(page.locator('.fx-patches-error')).toContainText('name')
  })

  test('account button stays hidden without Supabase config', async ({ page }) => {
    await setInstrumentCookie(page)
    await page.goto('/guitar')
    await expect(page.locator('.brand-name')).toBeVisible()
    await expect(page.locator('.account-btn')).toHaveCount(0)
  })

  test('effects page has no horizontal scroll with patches open', async ({ page }) => {
    await page.goto('/effects')
    await page.getByRole('button', { name: 'Patches' }).click()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})

// ─── Effects drawer (compact chain on the scale pages) ───

test.describe('Effects drawer', () => {
  test.beforeEach(async ({ page }) => {
    await setInstrumentCookie(page)
    await page.goto('/guitar')
    await page.locator('svg.fretboard-svg').waitFor()
    await page.locator('.fx-drawer').waitFor()
  })

  test('is open by default and can be minimized', async ({ page }) => {
    const drawer = page.locator('.fx-drawer')
    await expect(drawer.locator('.fx-drawer-chain')).toBeVisible()
    await drawer.getByRole('button', { name: 'Collapse effects drawer' }).click()
    await expect(drawer.locator('.fx-drawer-chain')).toHaveCount(0)
    await expect(drawer.locator('.fx-drawer-bar')).toBeVisible()
    await drawer.getByRole('button', { name: 'Expand effects drawer' }).click()
    await expect(drawer.locator('.fx-drawer-chain')).toBeVisible()
  })

  test('drawer tuner opens without the old tuner button', async ({ page }) => {
    await page.locator('.fx-drawer').getByRole('button', { name: /Tuner/ }).click()
    await expect(page.locator('.fx-drawer .fx-tuner')).toBeVisible()
  })

  test('expanded drawer shows a compact chain with no knobs', async ({ page }) => {
    await expect(page).toHaveURL(/\/guitar/)
    await expect(page.locator('svg.fretboard-svg')).toBeVisible()
    const drawer = page.locator('.fx-drawer')
    await expect(drawer.locator('.fx-block').first()).toBeVisible()
    await expect(drawer.locator('.fx-rotary')).toHaveCount(0)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('clicking a block opens an editor with working knobs', async ({ page }) => {
    await page.locator('.fx-block-main').first().click()
    const knob = page.locator('.fx-popup .fx-rotary').first()
    await expect(knob).toBeVisible()
    const before = await knob.getAttribute('aria-valuenow')
    await knob.focus()
    await page.keyboard.press('ArrowUp')
    await expect(knob).not.toHaveAttribute('aria-valuenow', before!)
    await page.keyboard.press('Escape')
    await expect(page.locator('.fx-popup')).toHaveCount(0)
  })

  test('plays, keeps playing when collapsed, resets on a full reload', async ({ page }) => {
    const drawer = page.locator('.fx-drawer')
    await drawer.getByRole('button', { name: 'Unmute' }).click()
    await expect(drawer.getByRole('button', { name: 'Mute' })).toBeVisible()
    for (const label of ['IN', 'OUT']) {
      await expect.poll(async () => Number(await drawer.getByRole('meter', { name: `${label} level` }).getAttribute('aria-valuenow'))).toBeGreaterThan(0)
    }

    await drawer.getByRole('button', { name: 'Collapse effects drawer' }).click()
    await expect(drawer.locator('.fx-drawer-chain')).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: 'Mute' })).toBeVisible()

    await page.goto('/bass-4')
    await expect(page.locator('.fx-drawer').getByRole('button', { name: 'Unmute' })).toBeVisible()
  })

  test('survives a client-side instrument switch', async ({ page }) => {
    await page.locator('.fx-drawer').getByRole('button', { name: 'Unmute' }).click()
    await page.locator('.instrument-switch-btn').click()
    await page.locator('.instrument-col-card', { hasText: /4-String/ }).first().click()
    await expect(page).toHaveURL(/bass-4/)
    await expect(page.locator('.fx-drawer').getByRole('button', { name: 'Mute' })).toBeVisible()
  })

  test('full page button hands over to /effects with the same chain', async ({ page }) => {
    const names = await page.locator('.fx-drawer .fx-block-name').allTextContents()
    await page.getByRole('button', { name: 'Open full effects page' }).click()
    await expect(page).toHaveURL(/\/effects$/)
    await expect(page.locator('.fx-drawer')).toHaveCount(0)
    await expect(page.locator('.fx-pedalboard .fx-pedal h3')).toHaveText(names)
  })

  test('power button turns audio off but keeps the drawer', async ({ page }) => {
    const drawer = page.locator('.fx-drawer')
    await expect(drawer.getByRole('button', { name: 'Turn off audio' })).toHaveCount(0)
    await drawer.getByRole('button', { name: 'Unmute' }).click()
    await drawer.getByRole('button', { name: 'Turn off audio' }).click()
    await expect(drawer.getByRole('button', { name: 'Unmute' })).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Turn off audio' })).toHaveCount(0)
  })
})

test.describe('Pedal style switch', () => {
  test('classic skin persists, shows footswitches, and the footswitch bypasses', async ({ page }) => {
    await page.goto('/effects')
    await page.locator('.fx-pedalboard .fx-pedal').first().waitFor()
    await page.getByRole('radio', { name: 'Classic' }).click()
    await expect(page.locator('.fx-modal.fx-skin-classic')).toHaveCount(1)
    const first = page.locator('.fx-pedalboard .fx-pedal').first()
    await first.locator('.fx-stomp').click()
    await expect(first).toHaveClass(/\boff\b/)
    await first.locator('.fx-stomp').click()
    await expect(first).toHaveClass(/\bon\b/)

    await page.reload()
    await expect(page.locator('.fx-modal.fx-skin-classic')).toHaveCount(1)
    await page.getByRole('radio', { name: 'Modern' }).click()
    await expect(page.locator('.fx-stomp')).toHaveCount(0)
  })
})

test.describe('NIXX presets', () => {
  const PRESETS: [string, string[]][] = [
    ['Clean', ['Noise Gate', 'Compressor', 'Amplifier', 'Cabinet', 'Delay', 'Reverb']],
    ['Clean Sky', ['Compressor', 'Amplifier', 'Cabinet', 'Chorus', 'Delay', 'Reverb']],
    ['Funk', ['Noise Gate', 'Compressor', 'Amplifier', 'Cabinet', 'Phaser', 'Reverb']],
    ['Blues OD', ['Noise Gate', 'Overdrive', 'Amplifier', 'Cabinet', 'Reverb']],
    ['Butter OD', ['Noise Gate', 'Compressor', 'Overdrive', 'Amplifier', 'Cabinet', 'Delay', 'Reverb']],
    ['Drive', ['Noise Gate', 'Overdrive', 'Amplifier', 'Cabinet', 'Delay', 'Reverb']],
    ['Lead', ['Noise Gate', 'Overdrive', 'Amplifier', 'Cabinet', 'Delay', 'Reverb']],
    ['Metal', ['Noise Gate', 'Overdrive', 'Amplifier', 'Cabinet', '6-Band EQ']],
  ]

  test('every preset loads its chain and plays without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/effects')
    await page.locator('.fx-pedalboard .fx-pedal').first().waitFor()
    await page.getByRole('button', { name: 'Unmute' }).click()
    await page.getByRole('button', { name: /Patches/ }).click()
    for (const [name, chain] of PRESETS) {
      await page.locator('.fx-preset').filter({ has: page.locator('.fx-preset-name', { hasText: new RegExp(`^${name}$`) }) }).click()
      await expect(page.locator('.fx-pedalboard .fx-pedal h3')).toHaveText(chain)
      await expect(page.locator('.fx-preset.active .fx-preset-name')).toHaveText(name)
      await page.waitForTimeout(150)
    }
    expect(errors).toEqual([])
  })

  test('a tweaked preset saves as a new patch', async ({ page }) => {
    await page.goto('/effects')
    await page.evaluate(() => localStorage.removeItem('fretwiki-patches-v1'))
    await page.getByRole('button', { name: /Patches/ }).click()
    await page.locator('.fx-preset', { hasText: /^Blues OD/ }).click()
    await expect(page.getByLabel('Patch name')).toHaveValue('NIXX Blues OD (mine)')
    const knob = page.locator('.fx-pedalboard .fx-rotary').first()
    await knob.focus()
    await page.keyboard.press('ArrowUp')
    await page.getByRole('button', { name: 'Save new' }).click()
    await expect(page.locator('.fx-patch-name')).toHaveText(['NIXX Blues OD (mine)'])
    await expect(page.locator('.fx-preset')).toHaveCount(8)
  })
})
