import { chromium } from 'playwright';

const target = process.env.STAGING_PUBLISHED_ACTIVITY_URL;
if (!target) {
  throw new Error('Set STAGING_PUBLISHED_ACTIVITY_URL to a published activity page in the staging deployment.');
}
const parsed = new URL(target);
if (parsed.protocol !== 'https:') {
  throw new Error('The staging activity URL must use HTTPS.');
}
if (/refjawgovrmsyigtcfdl\.supabase\.co|aks-hcd\.ai\.studio/i.test(target)) {
  throw new Error('Refusing a known production URL as the browser test target.');
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', () => pageErrors.push('page runtime error'));
  const response = await page.goto(target, { waitUntil: 'networkidle', timeout: 60000 });
  if (!response || !response.ok()) {
    throw new Error(`Published activity page did not return a successful HTTP response (status: ${response?.status() ?? 'no response'}).`);
  }

  // Trigger lazy-loaded media without logging image URLs or signed query strings.
  await page.evaluate(async () => {
    const step = Math.max(300, Math.floor(window.innerHeight * 0.75));
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
    await Promise.all(Array.from(document.images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 10000);
      });
    }));
  });

  const media = await page.evaluate(() => ({
    imageCount: document.images.length,
    brokenCount: Array.from(document.images).filter((img) => !img.complete || img.naturalWidth === 0).length,
    loadedCount: Array.from(document.images).filter((img) => img.complete && img.naturalWidth > 0).length,
    titlePresent: Boolean(document.title && document.title.trim()),
    bodyPresent: Boolean(document.body?.innerText?.trim()),
  }));
  await page.screenshot({ path: 'staging-published-activity.png', fullPage: true });
  console.log(JSON.stringify({ status: 'checked', media, runtimeErrorCount: pageErrors.length }));
  if (!media.titlePresent || !media.bodyPresent) throw new Error('Activity page rendered without a title or body content.');
  if (media.imageCount === 0) throw new Error('No image elements were rendered on the selected published activity page.');
  if (media.brokenCount > 0) throw new Error(`${media.brokenCount} image element(s) failed to render.`);
  if (pageErrors.length > 0) throw new Error(`${pageErrors.length} uncaught browser runtime error(s) detected.`);
} finally {
  await browser.close();
}
