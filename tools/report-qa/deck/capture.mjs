/**
 * Capture screenshots of the real tool for the walkthrough deck.
 *
 * The deck showed hand-drawn approximations of the interface, which go stale
 * the moment the interface changes. These are the tool itself, driven to the
 * exact state each slide talks about, so a slide can never show something the
 * team will not recognise.
 *
 * The draft used is the repo's own fixture - a fictional "Northwind Trading" -
 * so no client text is ever baked into a deck that gets passed around.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const SHOTS = join(here, 'shots');
const TOOL = `file://${join(root, 'report-qa.html')}`;
const DRAFT = join(root, 'tools', 'report-qa', 'samples', 'powerpoint-package.pptx');

mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({
  viewport: { width: 1000, height: 1100 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

/** Shoot one element, padded a little so it does not look guillotined. */
async function shot(name, selector, pad = 10) {
  // Clip coordinates are page coordinates only while the page is at the top,
  // and a clipped shot has to be a full-page shot or it is cropped to the fold.
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`nothing to shoot for ${name} (${selector})`);
  const clip = {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
  await page.screenshot({ path: join(SHOTS, `${name}.png`), clip, fullPage: true });
  return { name, w: Math.round(clip.width), h: Math.round(clip.height) };
}

/** Shoot a span of the page from the top of one element to the bottom of another. */
async function shotSpan(name, fromSel, toSel, pad = 10) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const a = await page.locator(fromSel).first().boundingBox();
  const b = await page.locator(toSel).first().boundingBox();
  if (!a || !b) throw new Error(`nothing to shoot for ${name}`);
  const top = Math.min(a.y, b.y) - pad;
  const bottom = Math.max(a.y + a.height, b.y + b.height) + pad;
  const left = Math.min(a.x, b.x) - pad;
  const right = Math.max(a.x + a.width, b.x + b.width) + pad;
  await page.screenshot({
    path: join(SHOTS, `${name}.png`),
    clip: { x: Math.max(0, left), y: Math.max(0, top), width: right - left, height: bottom - top },
    fullPage: true,
  });
  return { name, w: Math.round(right - left), h: Math.round(bottom - top) };
}

const sizes = [];

await page.goto(TOOL);
await page.waitForTimeout(200);

// 1. the engagement settings, filled in the way a reviewer would
await page.fill('#clientName', 'Northwind Trading');
await page.fill('#otherClients', 'Contoso, Initech');
await page.fill('#classification', 'CONFIDENTIAL');
await page.waitForTimeout(150);
sizes.push(await shot('settings', '#settings-toggle'));

await page.setInputFiles('#file', DRAFT);
await page.waitForSelector('#results:not([hidden])');
await page.waitForTimeout(350);

// 2. the verdict and the counts, which is what a reviewer reads first
sizes.push(await shotSpan('verdict', '#verdict', '.counts'));

// 3. a real finding, with the flagged words highlighted in context
sizes.push(await shot('finding', '.sev.blocker .rule-group', 6));

// 4. a repeated check collapsed to one row, with its preview of flagged words
const collapsed = 'details.rule-group:not([open])';
sizes.push(await shot('grouped', collapsed, 6));

// 5. the copy row and the deck download, side by side as they appear
sizes.push(await shotSpan('handoff', '.bar:has(#copy-comments)', '#file-bar'));

// 6. the ignored section, which is the part people do not expect
await page.locator('.sev.blocker .rule-group').first().locator('.rule-head .act').click();
await page.waitForTimeout(250);
await page.locator('.sev.ignored').evaluate((el) => { el.open = true; });
await page.waitForTimeout(200);
sizes.push(await shot('ignored', '.sev.ignored', 6));

if (errors.length) throw new Error(`the tool errored while being photographed: ${errors.join('; ')}`);
await browser.close();

writeFileSync(join(SHOTS, 'sizes.json'), `${JSON.stringify(sizes, null, 2)}\n`);
for (const s of sizes) console.log(`  ${s.name.padEnd(10)} ${s.w}x${s.h}`);
console.log(`Captured ${sizes.length} screenshots into ${SHOTS}`);
