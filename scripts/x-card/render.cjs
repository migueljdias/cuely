/**
 * Renders the X (Twitter) card: node scripts/x-card/render.cjs
 * Opens card.html in Chromium at 1200x630 and writes app/twitter-image.png.
 * The picks shown are a real start_project answer; keep prices out, they go stale.
 */
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(`file://${path.join(__dirname, "card.html")}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(__dirname, "../../app/twitter-image.png") });
  await browser.close();
})();
